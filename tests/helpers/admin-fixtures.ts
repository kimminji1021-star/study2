// SPEC-ADMIN-001 테스트 도우미 — 테스트 관리자, 관리자 상태 변경 경로, 작업 기록 조회, 잠금 대기 관찰.
// 관리자는 파일마다 `admin-<무작위 값>@example.test`로 만들고 끝나면 지운다(실제 관리자 계정은 조회도 하지 않는다).
import { randomUUID } from 'node:crypto'

import type { Payload } from 'payload'

import type { AdminAuditLog, Application, User } from '../../src/payload-types'

export type ApplicationStatus = Application['status']

/** 테스트 관리자 1명을 만든다. 이메일은 정리 조건(`@example.test`)에 걸린다. */
export async function createTestAdmin(payload: Payload, prefix: string): Promise<User> {
  return payload.create({
    collection: 'users',
    data: { email: `${prefix}-${randomUUID()}@example.test`, password: `pw-${randomUUID()}` },
  })
}

export async function deleteTestAdmin(payload: Payload, admin: User | undefined): Promise<void> {
  if (admin === undefined) return
  await payload.delete({ collection: 'users', where: { email: { equals: admin.email } } })
}

/**
 * 관리자 화면·REST와 같은 단건 수정 경로(updateByID)로 상태를 바꾼다(acceptance.md 머리말 "상태 변경 경로").
 * 다른 필드를 함께 보내는 사례는 data를 직접 넘긴다.
 */
export function updateAsAdmin(payload: Payload, admin: User, id: number, data: Record<string, unknown>) {
  return payload.update({ collection: 'applications', id, data: data as never, user: admin, overrideAccess: false })
}

/** 약속이 거부되면 그 오류를, 성공하면 undefined를 돌려준다(오류의 status·message·cause를 직접 단언하기 위해). */
export async function caught(promise: Promise<unknown>): Promise<(Error & { status?: number }) | undefined> {
  try {
    await promise
    return undefined
  } catch (error) {
    return error as Error & { status?: number }
  }
}

/** 신청 한 건의 작업 기록(작업 시각 → ID 순). */
export async function auditLogsOfApplication(payload: Payload, applicationId: number): Promise<AdminAuditLog[]> {
  const result = await payload.find({
    collection: 'admin-audit-logs',
    where: { applicationId: { equals: applicationId } },
    sort: ['occurredAt', 'id'],
    depth: 0,
    pagination: false,
  })
  return result.docs
}

type PoolView = { pool: { query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> } }

function pool(payload: Payload): PoolView['pool'] {
  return (payload.db as unknown as PoolView).pool
}

/** 같은 DB에서 행 잠금(FOR UPDATE)을 기다리는 세션 수. 연결 풀에서 트랜잭션 밖으로 조회한다(AC-ADMIN-006). */
export async function countLockWaiters(payload: Payload): Promise<number> {
  const { rows } = await pool(payload).query(
    `SELECT count(*)::int AS waiting FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock' AND query ILIKE '%for update%'`,
  )
  return Number(rows[0]?.waiting ?? 0)
}

/** 최대 limitMs 동안 잠금 대기 세션이 atLeast개 이상이 될 때까지 기다리고, 마지막으로 본 수를 돌려준다. */
export async function waitForLockWaiters(payload: Payload, atLeast: number, limitMs = 3000): Promise<number> {
  const deadline = Date.now() + limitMs
  let waiting = 0
  while (Date.now() < deadline) {
    waiting = await countLockWaiters(payload)
    if (waiting >= atLeast) return waiting
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  return waiting
}

/** Payload 문서 잠금 테이블에서 신청 한 건을 가리키는 행 수(plan-audit O2 — 동시성 사례의 전제 확인). */
export async function lockedDocumentRows(payload: Payload, applicationId: number): Promise<number> {
  const { rows } = await pool(payload).query(
    'SELECT count(*)::int AS rows FROM payload_locked_documents_rels WHERE applications_id = $1',
    [applicationId],
  )
  return Number(rows[0]?.rows ?? 0)
}

/** 회차의 저장된 상태(트랜잭션 밖, 커밋된 값). */
export async function sessionStatus(payload: Payload, sessionId: number): Promise<string> {
  const session = await payload.findByID({ collection: 'tour-sessions', id: sessionId, depth: 0 })
  return session.status
}
