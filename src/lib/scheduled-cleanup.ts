// 예약 정리 — SPEC-DEPLOY-001 REQ-DEPLOY-007·008, plan.md §B.5.
// Vercel Cron이 하루 한 번 GET /api/cron/cleanup을 부르면, 10분 지난 신청 시도 기록과 2년 지난 관리자 작업 기록을 지운다.
// 두 컬렉션은 접근 규칙이 삭제를 모두 거부하므로(denyAll) 서버 코드의 원시 SQL로만 지운다.
import { createHash, timingSafeEqual } from 'node:crypto'

import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import { RATE_LIMIT_WINDOW_MS } from './rate-limit'
import { poolDb, type SqlQuery } from './transaction-db'

// 작업 기록 보관 기간(SPEC-ADMIN-001 R20). 기준이 법률상 맞는지는 2단계 변호사 확인 목록에 있다
export const AUDIT_LOG_RETENTION_YEARS = 2

// Vercel 문서가 권하는 CRON_SECRET 최소 길이. 이보다 짧거나 없으면 어떤 요청도 통과시키지 않는다
export const CRON_SECRET_MIN_LENGTH = 16

export type CleanupCutoffs = { attemptsBefore: Date; auditLogsBefore: Date }
export type CleanupResult = { attemptsDeleted: number; auditLogsDeleted: number }

/**
 * 정리 기준 시각. 시도 기록은 now − 10분(신청 처리 때의 recordAttempt와 같은 기준),
 * 작업 기록은 now의 UTC 연도 − 2(같은 월·일·시각). 2월 29일은 setUTCFullYear 규칙대로 3월 1일로 넘어간다.
 */
export function cleanupCutoffs(now: Date): CleanupCutoffs {
  const auditLogsBefore = new Date(now.getTime())
  auditLogsBefore.setUTCFullYear(auditLogsBefore.getUTCFullYear() - AUDIT_LOG_RETENTION_YEARS)
  return { attemptsBefore: new Date(now.getTime() - RATE_LIMIT_WINDOW_MS), auditLogsBefore }
}

const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest()

/**
 * `Authorization` 머리글이 정확히 `Bearer <CRON_SECRET>`인지. 두 값의 SHA-256을 timingSafeEqual로 비교해
 * 길이가 달라도 비교 시간이 갈리지 않게 한다. 서버 비밀값이 없거나 16자 미만이면 항상 거짓이다.
 */
export function isAuthorizedCronRequest(authorization: string | null, secret: string | undefined): boolean {
  if (secret === undefined || secret.length < CRON_SECRET_MIN_LENGTH || authorization === null) return false
  return timingSafeEqual(sha256(authorization), sha256(`Bearer ${secret}`))
}

/** DELETE 한 문장의 지운 행 수(CTE로 묶어 결과 한 행만 돌려받는다). */
async function deletedCount(payload: Payload, query: SqlQuery): Promise<number> {
  const { rows } = await poolDb(payload).execute(query)
  return Number(rows[0]?.deleted ?? 0)
}

// @MX:NOTE: [AUTO] 고지의 "늦어도 72시간 안에 삭제" 근거 — Hobby Cron은 하루 한 번 지정한 시(hour) 안의 아무 때나 실행되므로
//   정상 최대 보관은 약 25시간 10분, 한 번 빠지면 약 49시간 10분이다(plan.md §B.5). 연속 두 번 빠지면 넘을 수 있다(R4)
// @MX:NOTE: [AUTO] 테스트는 실제 현재 시각으로만 부른다 — 미래 시각을 넘기면 개발 DB의 실제 기록을 지울 수 있다(plan.md R8)
/**
 * 정리 실행. 각 삭제는 트랜잭션 밖 연결 풀의 질의 한 번이라 지울 행 수와 관계없이 질의 수가 2로 고정되고,
 * 같은 now로 다시 실행하면 두 값 모두 0이다(Cron 중복 전달에 안전). 다른 테이블은 건드리지 않는다.
 * 테이블·열 이름은 README "배포" 절의 수동 정리 SQL과 같아야 한다(저장소 규칙 테스트 AC-DEPLOY-015).
 */
export async function runScheduledCleanup(payload: Payload, now: Date): Promise<CleanupResult> {
  const { attemptsBefore, auditLogsBefore } = cleanupCutoffs(now)
  const attemptsDeleted = await deletedCount(
    payload,
    sql`with d as (delete from application_attempts where attempted_at < ${attemptsBefore.toISOString()} returning 1)
      select count(*)::int as deleted from d`,
  )
  const auditLogsDeleted = await deletedCount(
    payload,
    sql`with d as (delete from admin_audit_logs where occurred_at < ${auditLogsBefore.toISOString()} returning 1)
      select count(*)::int as deleted from d`,
  )
  return { attemptsDeleted, auditLogsDeleted }
}
