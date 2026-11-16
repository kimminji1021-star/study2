// 요청 사항 삭제 — SPEC-ADMIN-001 REQ-ADMIN-008, plan.md §B.4.
// 관리자 전용 엔드포인트(POST /api/applications/:id/clear-requests)가 이 처리 함수만 부르고 결과를 HTTP 응답으로 바꾼다.
// 잠금(회차 행 → 신청 행)과 "비어 있는지" 판단은 신청 수정 보호 구간(application-status.ts §B.2 6번)이 잠근 뒤 값으로 한다 —
// 이 함수는 신청 행을 먼저 잠그지 않는다(먼저 잠그면 상태 변경과 반대 순서가 되어 교착할 수 있음, plan.md R3).
// 요청 사항 글은 응답·로그 어디에도 담지 않는다(REQ-ADMIN-015).
import { sql } from '@payloadcms/db-postgres'
import {
  commitTransaction,
  createLocalReq,
  initTransaction,
  killTransaction,
  type Endpoint,
  type Payload,
  type PayloadRequest,
} from 'payload'

import { isAdmin } from './access'
import { recordAdminAction } from './admin-audit'
import { applicationUpdateErrorCode, markRequestsClear, unmarkRequestsClear } from './application-status'
import { parseRouteId } from './route-id'
import { transactionDb } from './transaction-db'

export type ClearRequestsErrorCode =
  'FORBIDDEN' | 'NOT_FOUND' | 'REQUESTS_EMPTY' | 'SESSION_BUSY' | 'SESSION_MISSING' | 'INTERNAL_ERROR'

export type ClearRequestsResult =
  { status: 'cleared'; requestsDeletedAt: string } | { status: 'error'; code: ClearRequestsErrorCode }

export type ClearRequestsOptions = {
  /** 경로 값 그대로(문자열) 또는 숫자. 1~2147483647 정수가 아니면 NOT_FOUND */
  applicationId: unknown
  /** 작업한 사용자. users 컬렉션 사용자(관리자)가 아니면 FORBIDDEN */
  user: PayloadRequest['user']
  /** 처리 시각(테스트가 고정 값을 넣는다) */
  now?: Date
  /** 테스트 전용 주입 지점 — 삭제·작업 기록 뒤, 커밋 직전에 기다린다(회차·신청 행 잠금을 쥔 채). 엔드포인트는 넘기지 않는다 */
  beforeCommit?: () => Promise<void>
  /** 이 요청의 req(엔드포인트). 없으면 user로 로컬 req를 만든다. 이미 트랜잭션이 있으면 그 트랜잭션 안에서 처리하고 커밋하지 않는다 */
  req?: PayloadRequest
}

// 수정 보호 구간이 던지는 오류 중 이 동작의 결과 코드로 그대로 내보내는 것. 나머지는 INTERNAL_ERROR
const PASS_THROUGH_CODES: readonly ClearRequestsErrorCode[] = ['REQUESTS_EMPTY', 'SESSION_BUSY', 'SESSION_MISSING']

const HTTP_STATUS: Record<ClearRequestsErrorCode, number> = {
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  REQUESTS_EMPTY: 409,
  SESSION_BUSY: 409,
  SESSION_MISSING: 409,
  INTERNAL_ERROR: 500,
}

/** 신청을 찾지 못함(트랜잭션 안의 존재 확인). 결과 코드 변환용 내부 표시 */
class ApplicationNotFound extends Error {}

function failure(code: ClearRequestsErrorCode): ClearRequestsResult {
  return { status: 'error', code }
}

/**
 * 신청 한 건의 요청 사항을 지운다(plan.md §B.4 순서). 관리자 확인 → ID 확인 → 트랜잭션 → 잠금 없는 존재 확인 →
 * 요청 사항 삭제 표시 → 같은 req의 단건 수정(보호 구간이 잠그고 판단·저장) → 작업 기록 → 주입 지점 → 커밋. 예외면 되돌린다.
 */
export async function clearApplicationRequests(
  payload: Payload,
  { applicationId, user, now = new Date(), beforeCommit, req: given }: ClearRequestsOptions,
): Promise<ClearRequestsResult> {
  if (!isAdmin(user)) return failure('FORBIDDEN')
  const id = parseRouteId(applicationId)
  if (id === null) return failure('NOT_FOUND')

  const req = given ?? (await createLocalReq({ user: user as never }, payload))
  const at = now.toISOString()
  let sessionId: number | null = null
  const ownsTransaction = await initTransaction(req)
  try {
    const db = transactionDb(payload, req.transactionID ?? null)
    const found = await db.execute(sql`SELECT id FROM applications WHERE id = ${id}`)
    if (found.rows.length === 0) throw new ApplicationNotFound()

    markRequestsClear(req, id, at)
    // 요청 사항 필드는 수정 거부(lockedField)라 서버 코드만 접근 규칙을 건너뛰어 저장한다. 실제 값은 보호 구간 6번이 정한다
    const doc = await payload.update({
      collection: 'applications',
      id,
      data: { requests: null, requestsDeletedAt: at },
      req,
      overrideAccess: true,
      depth: 0,
    })
    sessionId = typeof doc.session === 'number' ? doc.session : null
    if (sessionId === null) throw new Error('Session is missing after update.')
    await recordAdminAction(req, {
      action: 'application.requests_delete',
      applicationId: id,
      referenceCode: doc.referenceCode,
      sessionId,
    })

    if (beforeCommit !== undefined) await beforeCommit()
    if (ownsTransaction) await commitTransaction(req)
    return { status: 'cleared', requestsDeletedAt: at }
  } catch (err) {
    if (ownsTransaction) await killTransaction(req)
    if (err instanceof ApplicationNotFound) return failure('NOT_FOUND')
    const thrown = applicationUpdateErrorCode(err)
    const code: ClearRequestsErrorCode =
      thrown !== null && (PASS_THROUGH_CODES as readonly string[]).includes(thrown)
        ? (thrown as ClearRequestsErrorCode)
        : 'INTERNAL_ERROR'
    if (thrown === null) {
      // 보호 구간 밖의 실패(작업 기록 등). 코드·오류 종류 이름·ID만 기록한다(메시지 원문은 바인딩 인자를 담을 수 있음)
      const errorName = err instanceof Error ? err.constructor.name : typeof err
      payload.logger.error({
        code,
        errorName,
        applicationId: id,
        sessionId,
        msg: `Clearing application requests failed: ${code}`,
      })
    }
    return failure(code)
  } finally {
    unmarkRequestsClear(req, id)
  }
}

/** POST /api/applications/:id/clear-requests — 처리 함수의 결과를 상태 코드와 본문으로 바꾼다(경로에 개인정보 없음). */
export const clearRequestsEndpoint: Endpoint = {
  path: '/:id/clear-requests',
  method: 'post',
  handler: async (req) => {
    const result = await clearApplicationRequests(req.payload, {
      applicationId: req.routeParams?.id,
      user: req.user,
      req,
    })
    const headers = { 'Cache-Control': 'no-store, private' }
    if (result.status === 'cleared') return Response.json(result, { status: 200, headers })
    return Response.json({ code: result.code }, { status: HTTP_STATUS[result.code], headers })
  },
}
