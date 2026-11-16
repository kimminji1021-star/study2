// 신청 수정 보호 구간과 상태 변경 규칙 — SPEC-ADMIN-001 REQ-ADMIN-004~007·013, plan.md §B.2·§B.3·§B.7.
// applications 컬렉션 훅(beforeOperation·beforeChange·afterChange)이 이 모듈의 함수만 부른다.
//
// Payload는 요청에 없던 필드를 잠금 전에 읽은 문서 값으로 채워 beforeChange에 넘긴다(plan.md §A.2). 그래서
// (1) 상태 변경 요청인지는 필드 처리 전의 원본 입력(beforeOperation의 args.data)으로 가리고,
// (2) 모든 수정이 회차 행 → 신청 행 순서로 잠근 뒤 다시 읽은 값으로 판단·저장한다.
import { sql } from '@payloadcms/db-postgres'
import {
  APIError,
  type CollectionAfterChangeHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeOperationHook,
  type PayloadRequest,
} from 'payload'

import { recordAdminAction } from './admin-audit'
import { APPLICATION_UPDATE_MESSAGES, type ApplicationUpdateErrorCode } from './admin-messages'
import { getOccupiedSeatsInTransaction } from './occupancy'
import { DEFAULT_LOCK_TIMEOUT_MS, isLockTimeoutError } from './submit-application'
import { transactionDb } from './transaction-db'

type ApplicationStatus = 'pending' | 'confirmed' | 'cancelled'

const APPLICATION_STATUSES: readonly string[] = ['pending', 'confirmed', 'cancelled']

// PostgreSQL SQLSTATE deadlock_detected. 이 SPEC의 경로끼리는 생기지 않아야 하지만 생기면 SESSION_BUSY로 바꾼다
const DEADLOCK_DETECTED = '40P01'

type StatusChange = { from: ApplicationStatus; to: ApplicationStatus; sessionId: number; referenceCode: string }

/** req.context.adminOps.applications[<신청 ID>]에 담는 값. 같은 req를 쓰는 다른 신청 수정과 섞이지 않게 신청 ID를 키로 둔다. */
type ApplicationOpState = {
  /** 원본 입력(args.data)에 status 키가 있었는지(beforeOperation이 수정마다 다시 적는다) */
  statusRequested?: boolean
  /** beforeChange가 정한 이전·이후 상태 — afterChange가 작업 기록을 남기고 항목을 지운다 */
  statusChange?: StatusChange
}

type AdminOpsContext = { applications: Record<string, ApplicationOpState> }

/** 상태 변경 오류. 고정 문구만 담고 원인 오류(cause)를 붙이지 않는다(REQ-ADMIN-015 — 바인딩 인자에 개인정보가 실릴 수 있음). */
class ApplicationUpdateError extends APIError {
  readonly code: ApplicationUpdateErrorCode

  constructor(code: ApplicationUpdateErrorCode) {
    super(APPLICATION_UPDATE_MESSAGES[code], code === 'INTERNAL_ERROR' ? 500 : 409, undefined, true)
    this.code = code
    // Payload APIError는 data(기본 null)를 Error cause에 넣는다. 원인 정보가 실리지 않게 속성 자체를 없앤다(AC-ADMIN-015)
    delete (this as { cause?: unknown }).cause
  }
}

/** 신청 ID를 context 키로 정규화한다(REST는 문자열, 로컬 API는 숫자로 온다). 양의 정수가 아니면 null. */
function applicationKey(id: unknown): string | null {
  const value = typeof id === 'number' ? id : typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : Number.NaN
  return Number.isSafeInteger(value) && value > 0 ? String(value) : null
}

function opStates(req: PayloadRequest): Record<string, ApplicationOpState> {
  const context = req.context as { adminOps?: AdminOpsContext }
  context.adminOps ??= { applications: {} }
  return context.adminOps.applications
}

function opState(req: PayloadRequest, key: string): ApplicationOpState {
  const states = opStates(req)
  states[key] ??= {}
  return states[key]
}

function toId(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const id = Number(value)
  return Number.isSafeInteger(id) ? id : null
}

/** epoch 밀리초(원시 SQL 결과) → ISO 문자열. 비어 있으면 null. */
function msToIso(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const ms = Number(value)
  if (!Number.isFinite(ms)) throw new Error('Timestamp is not a number.')
  return new Date(ms).toISOString()
}

function hasCode(err: unknown, code: string): boolean {
  const codeOf = (value: unknown) =>
    typeof value === 'object' && value !== null ? (value as { code?: unknown }).code : undefined
  const cause = typeof err === 'object' && err !== null ? (err as { cause?: unknown }).cause : undefined
  return codeOf(err) === code || codeOf(cause) === code
}

/**
 * 잡은 오류를 고정 문구 오류로 바꾼다. 이 모듈이 던진 오류는 그대로, 잠금 대기 초과(55P03)·교착(40P01)은 SESSION_BUSY,
 * 그 밖은 INTERNAL_ERROR. 변환한 사실은 코드·오류 종류 이름·ID만 기록한다(메시지 원문은 바인딩 인자를 담을 수 있음).
 */
function toUpdateError(
  err: unknown,
  req: PayloadRequest,
  ids: { applicationId: number | null; sessionId: number | null },
): ApplicationUpdateError {
  if (err instanceof ApplicationUpdateError) return err
  const code = isLockTimeoutError(err) || hasCode(err, DEADLOCK_DETECTED) ? 'SESSION_BUSY' : 'INTERNAL_ERROR'
  const errorName = err instanceof Error ? err.constructor.name : typeof err
  req.payload.logger.error({ code, errorName, ...ids, msg: `Application update failed: ${code}` })
  return new ApplicationUpdateError(code)
}

/**
 * beforeOperation(plan.md §B.2 0번): 단건 수정이면 원본 입력에 status 키가 있는지를 그 신청 ID 항목에 적는다.
 * 접근 검사·잠금 전 문서 읽기·필드 채움보다 먼저 실행되므로 Payload가 채워 넣은 status와 섞이지 않는다.
 * 일괄 수정은 id가 없어 적지 않는다(disableBulkEdit로 이미 403, R25).
 */
export const markStatusRequest: CollectionBeforeOperationHook = ({ args, operation, req }) => {
  if (operation !== 'update') return args
  const { id, data } = args as { id?: unknown; data?: unknown }
  const key = applicationKey(id)
  if (key === null) return args
  opState(req, key).statusRequested =
    typeof data === 'object' &&
    data !== null &&
    Object.hasOwn(data, 'status') &&
    (data as { status?: unknown }).status !== undefined
  return args
}

// @MX:WARN: [AUTO] 신청 수정 보호 구간 — 모든 수정이 회차 행 → 신청 행 순서로 FOR UPDATE 잠금을 얻고, 잠긴 필드는 모든 분기에서
//   잠금 뒤 다시 읽은 값으로 덮어쓴다. 구간 안의 질의는 모두 같은 트랜잭션 연결(transactionDb)·같은 req를 쓴다
// @MX:REASON: 신청 행을 먼저 잠그는 경로가 하나라도 생기면 사이트 접수·다른 수정과 교착하고(plan.md R3), 덮어쓰기를 건너뛰는
//   분기가 있으면 잠금 전 문서 값이 다른 탭의 취소·요청 사항 삭제를 되돌린다(R1·R15). 풀 연결을 새로 얻는 질의는 풀 고갈로 멈춘다(R2)
/**
 * beforeChange(plan.md §B.2 1~12번, 요청 사항 삭제 분기 6번은 M3): 잠근 뒤 다시 읽은 현재 값으로 판단하고 저장 값을 정한다.
 * 생성(사이트 접수)은 건드리지 않는다 — 그 경로는 submit-application.ts의 정원 확인 구간이 맡는다.
 */
export const lockApplicationForUpdate: CollectionBeforeChangeHook = async ({ data, operation, originalDoc, req }) => {
  if (operation !== 'update') return data
  const key = applicationKey((originalDoc as { id?: unknown } | undefined)?.id)
  const applicationId = key === null ? null : Number(key)
  let sessionId: number | null = null
  try {
    if (applicationId === null || key === null) throw new ApplicationUpdateError('INTERNAL_ERROR')
    const db = transactionDb(req.payload, req.transactionID ?? null)

    // 2. 잠금 대기 제한(사이트 접수와 같은 상수). SET LOCAL은 바인딩 인자를 받지 못하므로 set_config(is_local = true)
    await db.execute(sql`SELECT set_config('lock_timeout', ${String(DEFAULT_LOCK_TIMEOUT_MS)}, true)`)

    // 3. 회차 ID(잠긴 필드라 API로는 바뀌지 않는다). 회차 없는 신청은 어떤 잠금도 걸기 전에 거부한다(필드 필수 검증 때문에 저장 불가)
    const before = await db.execute(sql`SELECT session_id FROM applications WHERE id = ${applicationId}`)
    if (before.rows.length === 0) throw new ApplicationUpdateError('INTERNAL_ERROR')
    sessionId = toId(before.rows[0].session_id)
    if (sessionId === null) throw new ApplicationUpdateError('SESSION_MISSING')
    const locked = await db.execute(
      sql`SELECT id, capacity, status FROM tour_sessions WHERE id = ${sessionId} FOR UPDATE`,
    )
    // 회차 행이 사라졌으면 4번 재조회와 같은 결론(회차 없는 신청)이다
    if (locked.rows.length === 0) throw new ApplicationUpdateError('SESSION_MISSING')
    const session = locked.rows[0]

    // 4. 신청 행 잠금 → 잠금 뒤의 별도 문장으로 현재 값 읽기(Read Committed는 문장마다 새 스냅숏)
    await db.execute(sql`SELECT id FROM applications WHERE id = ${applicationId} FOR UPDATE`)
    const { rows } = await db.execute(sql`
      SELECT session_id, status, party_size, requests, reference_code,
             round(extract(epoch FROM requests_deleted_at) * 1000)::float8 AS requests_deleted_at_ms,
             round(extract(epoch FROM cancelled_at) * 1000)::float8 AS cancelled_at_ms
      FROM applications WHERE id = ${applicationId}
    `)
    const current = rows[0]
    if (current === undefined) throw new ApplicationUpdateError('INTERNAL_ERROR')
    // 3번과 4번 사이에 회차가 바뀌었으면(지워져 비었거나 다른 값) 이미 잠근 회차로 판단하지 않는다
    if (toId(current.session_id) !== sessionId) throw new ApplicationUpdateError('SESSION_MISSING')
    const previous = current.status as ApplicationStatus

    // 5. 잠긴 필드 덮어쓰기 — 모든 분기에서, 아래 어떤 판단보다 먼저. originalDoc은 판단에도 저장에도 쓰지 않는다
    data.requests = (current.requests as string | null) ?? null
    data.requestsDeletedAt = msToIso(current.requests_deleted_at_ms)
    data.cancelledAt = msToIso(current.cancelled_at_ms)
    const state = opState(req, key)
    delete state.statusChange
    if (state.statusRequested !== true || !APPLICATION_STATUSES.includes(String(data.status))) {
      // 상태 변경 요청이 아니면 잠금 뒤 상태를 저장한다(다른 탭이 바꾼 상태를 되돌리지 않음). 알 수 없는 값은 필드 검증이 거부한다
      if (state.statusRequested !== true) data.status = previous
      return data
    }

    // 7·8. 같은 상태 저장은 기록 없이 끝(cancelledAt은 5번의 현재 값 그대로)
    const requested = data.status as ApplicationStatus
    if (requested === previous) return data

    // 9. 취소 복원: 이 신청은 취소 상태라 점유 인원에 빠져 있다. 정확히 채우면 같은 트랜잭션에서 마감한다(다시 열지는 않음)
    if (previous === 'cancelled') {
      const capacity = Number(session.capacity)
      const partySize = Number(current.party_size)
      const occupied = await getOccupiedSeatsInTransaction(req.payload, req.transactionID, sessionId)
      if (!Number.isFinite(capacity) || !Number.isFinite(partySize)) throw new Error('Seat values are not numbers.')
      if (occupied + partySize > capacity) throw new ApplicationUpdateError('RESTORE_CAPACITY_EXCEEDED')
      if (occupied + partySize === capacity && session.status === 'open') {
        // 중첩 payload.update(tour-sessions)는 쓰지 않는다 — 행 잠금을 쥔 채 문서 잠금 행을 지워 교착할 수 있다(plan.md §B.2 9번, R26)
        await db.execute(sql`UPDATE tour_sessions SET status = 'closed', updated_at = now() WHERE id = ${sessionId}`)
      }
    }

    // 10. 취소일(plan.md §B.3): 취소로 → 처리 시각, 취소에서 → 비움, 대기 ↔ 확정 → 그대로
    if (requested === 'cancelled') data.cancelledAt = new Date().toISOString()
    else if (previous === 'cancelled') data.cancelledAt = null

    // 11. 작업 기록은 afterChange가 같은 req(같은 트랜잭션)로 남긴다
    state.statusChange = { from: previous, to: requested, sessionId, referenceCode: String(current.reference_code) }
    return data
  } catch (err) {
    throw toUpdateError(err, req, { applicationId, sessionId })
  }
}

/**
 * afterChange(plan.md §B.7): beforeChange가 그 신청 ID 항목에 남긴 상태 변경이 있으면 같은 req로 작업 기록을 남기고 항목을 지운다.
 * 기록이 실패하면 예외가 updateByID의 catch로 가서 저장·회차 마감이 함께 되돌려진다.
 */
export const recordStatusChange: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'update') return doc
  const key = applicationKey((doc as { id?: unknown }).id)
  if (key === null) return doc
  const states = opStates(req)
  const change = states[key]?.statusChange
  delete states[key]
  if (change === undefined) return doc
  try {
    await recordAdminAction(req, {
      action: 'application.status_change',
      applicationId: Number(key),
      referenceCode: change.referenceCode,
      sessionId: change.sessionId,
      fromStatus: change.from,
      toStatus: change.to,
    })
  } catch (err) {
    throw toUpdateError(err, req, { applicationId: Number(key), sessionId: change.sessionId })
  }
  return doc
}
