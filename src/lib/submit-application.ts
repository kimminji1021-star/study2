// 신청 처리 — SPEC-APPLY-001 REQ-APPLY-008~011·014·015, plan.md §B.1·§B.3.
// 서버 제출 경로의 핵심 로직. 서버 액션(M5)은 FormData 해석·접속 IP 추출·redirect만 맡고 이 함수를 부른다.
// 통합 테스트는 Next 없이 이 함수를 실제 DB로 직접 호출한다.
import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, type Payload, type PayloadRequest } from 'payload'

import { validateApplicationInput, type ApplicationFormInput, type FieldErrors } from './application-input'
import { PRIVACY_POLICY_VERSION } from './consent'
import { getOccupiedSeatsInTransaction } from './occupancy'
import { generateReferenceCode } from './reference-code'
import { getSessionAvailability, type SessionStatus, type UnavailableReason } from './session-availability'
import { transactionDb } from './transaction-db'

// 회차 행 잠금을 기다리는 최대 시간(밀리초). 넘기면 SESSION_BUSY(REQ-APPLY-010)
export const DEFAULT_LOCK_TIMEOUT_MS = 5000

// PostgreSQL SQLSTATE lock_not_available(lock_timeout 초과)
const LOCK_NOT_AVAILABLE = '55P03'

export type CapacityErrorCode = 'SESSION_NOT_FOUND' | 'SESSION_CLOSED' | 'SESSION_STARTED' | 'CAPACITY_EXCEEDED'
export type SubmitErrorCode = 'VALIDATION_FAILED' | CapacityErrorCode | 'SESSION_BUSY' | 'INTERNAL_ERROR'

export type SubmitApplicationResult =
  | { status: 'success'; referenceCode: string }
  | { status: 'error'; code: 'VALIDATION_FAILED'; fieldErrors: FieldErrors }
  | { status: 'error'; code: Exclude<SubmitErrorCode, 'VALIDATION_FAILED'> }

export type SubmitApplicationOptions = {
  /** 처리 시각. 시작 여부 판단과 동의 일시에 쓴다. 기본값은 호출 시점의 현재 시각 */
  now?: Date
  /** 회차 행 잠금 대기 제한(밀리초). 기본 DEFAULT_LOCK_TIMEOUT_MS */
  lockTimeoutMs?: number
  /**
   * 테스트 전용 주입 지점(plan.md §B.3): 회차 마감 갱신 뒤·커밋 바로 앞에서 같은 트랜잭션의 req로 부른다.
   * 서버 액션은 넘기지 않는다. 예외를 던지면 저장과 마감 갱신이 함께 되돌려진다.
   */
  beforeCommit?: (req: PayloadRequest) => Promise<void> | void
}

/** 잠금 대기 초과인지. drizzle은 pg 오류를 DrizzleQueryError로 감싸므로 SQLSTATE가 cause.code에 있다(plan.md §A.2). */
export function isLockTimeoutError(err: unknown): boolean {
  const codeOf = (value: unknown) =>
    typeof value === 'object' && value !== null ? (value as { code?: unknown }).code : undefined
  if (codeOf(err) === LOCK_NOT_AVAILABLE) return true
  const cause = typeof err === 'object' && err !== null ? (err as { cause?: unknown }).cause : undefined
  return codeOf(cause) === LOCK_NOT_AVAILABLE
}

const REASON_CODES: Record<UnavailableReason, CapacityErrorCode> = {
  closed: 'SESSION_CLOSED',
  past: 'SESSION_STARTED',
  full: 'CAPACITY_EXCEEDED',
}

type LockedSession = { capacity: number; occupied: number }

/**
 * 정원 확인 구간 앞부분(plan.md §B.1 2~4번): 잠금 대기 제한 설정 → 회차 행 잠금 → 잠근 뒤의 별도 문장으로 다시 읽기 → 판단.
 * 잠금 문장과 읽기를 한 문장으로 합치지 않는다 — Read Committed는 문장마다 새 스냅숏을 쓰므로, 잠금을 기다리는 동안
 * 커밋된 다른 신청은 잠금 뒤 문장에서만 보인다(plan.md R1).
 */
async function lockAndCheck(
  payload: Payload,
  transactionID: PayloadRequest['transactionID'],
  sessionId: number,
  partySize: number,
  { now, lockTimeoutMs }: { now: Date; lockTimeoutMs: number },
): Promise<CapacityErrorCode | LockedSession> {
  const db = transactionDb(payload, transactionID)

  // SET LOCAL lock_timeout = $1은 바인딩 인자를 받지 못해 42601로 실패한다(plan.md §A.2, R21). is_local = true → 이 트랜잭션에만
  await db.execute(sql`SELECT set_config('lock_timeout', ${String(lockTimeoutMs)}, true)`)
  const locked = await db.execute(sql`SELECT id FROM tour_sessions WHERE id = ${sessionId} FOR UPDATE`)
  if (locked.rows.length === 0) return 'SESSION_NOT_FOUND'

  const { rows } = await db.execute(sql`
    SELECT s.capacity, s.status, s.starts_at, t.published
    FROM tour_sessions s JOIN tours t ON t.id = s.tour_id
    WHERE s.id = ${sessionId}
  `)
  const row = rows[0]
  if (row === undefined || row.published !== true) return 'SESSION_NOT_FOUND'

  const capacity = Number(row.capacity)
  const occupied = await getOccupiedSeatsInTransaction(payload, transactionID, sessionId)
  if (!Number.isFinite(capacity)) throw new Error('Session capacity is not a number.')

  const availability = getSessionAvailability(
    { capacity, status: row.status as SessionStatus, startsAt: row.starts_at as string | Date },
    { now, occupiedSeats: occupied },
  )
  if (availability.reason !== null) return REASON_CODES[availability.reason]
  if (partySize > availability.remainingSeats) return 'CAPACITY_EXCEEDED'
  return { capacity, occupied }
}

/** 잡은 오류는 코드·오류 종류 이름·회차 ID만 기록한다. 메시지 원문은 바인딩 인자(개인정보)를 담을 수 있다(REQ-APPLY-015). */
function logFailure(payload: Payload, code: SubmitErrorCode, err: unknown, sessionId: number): void {
  const errorName = err instanceof Error ? err.constructor.name : typeof err
  payload.logger.error({ code, errorName, sessionId, msg: `Application submission failed: ${code}` })
}

// @MX:WARN: [AUTO] 명시적 트랜잭션 + 회차 행 잠금(SELECT … FOR UPDATE) 구간 — 구간 안의 모든 질의는 같은 req/트랜잭션 연결을 써야 한다
// @MX:REASON: 풀 연결을 새로 얻는 질의가 하나라도 있으면, 잠금을 기다리는 트랜잭션들이 연결 풀(기본 10개)을 다 차지했을 때
//   잠금을 쥔 쪽이 연결을 못 얻어 서로를 기다리며 멈춘다(plan.md R2). 잠금을 빼면 동시 신청이 정원을 넘는다(R1, AC-APPLY-010)
// @MX:ANCHOR: [AUTO] 신청을 만드는 유일한 경로(REQ-APPLY-003) — 서버 액션(M5)과 통합 테스트가 부르며, 접근 규칙 없이 저장한다
// @MX:REASON: applications의 생성 접근 규칙은 모두 거부라, 이 함수 밖에서 신청을 만들 방법이 없어야 정원·검증·동의 기록이 지켜진다
export async function submitApplication(
  payload: Payload,
  input: ApplicationFormInput,
  options: SubmitApplicationOptions = {},
): Promise<SubmitApplicationResult> {
  const validation = validateApplicationInput(input)
  if (!validation.ok) return { status: 'error', code: 'VALIDATION_FAILED', fieldErrors: validation.fieldErrors }
  const values = validation.value
  const now = options.now ?? new Date()
  const lockTimeoutMs = options.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS

  let transactionID: Awaited<ReturnType<Payload['db']['beginTransaction']>>
  try {
    transactionID = await payload.db.beginTransaction()
  } catch (err) {
    logFailure(payload, 'INTERNAL_ERROR', err, values.sessionId)
    return { status: 'error', code: 'INTERNAL_ERROR' }
  }
  // 트랜잭션이 꺼진 설정이면 잠금 없이 진행하지 않는다(안전 쪽 실패, plan.md R4)
  if (transactionID === null || transactionID === undefined) {
    logFailure(payload, 'INTERNAL_ERROR', null, values.sessionId)
    return { status: 'error', code: 'INTERNAL_ERROR' }
  }

  try {
    const req = await createLocalReq({}, payload)
    req.transactionID = transactionID

    const checked = await lockAndCheck(payload, transactionID, values.sessionId, values.partySize, {
      now,
      lockTimeoutMs,
    })
    if (typeof checked === 'string') {
      await payload.db.rollbackTransaction(transactionID)
      return { status: 'error', code: checked }
    }

    const keepRequests = values.requests !== '' && values.requestsConsent
    const referenceCode = generateReferenceCode()
    await payload.create({
      collection: 'applications',
      data: {
        session: values.sessionId,
        name: values.name,
        email: values.email,
        phone: values.phone,
        partySize: values.partySize,
        status: 'pending',
        referenceCode,
        privacyConsentAt: now.toISOString(),
        privacyPolicyVersion: PRIVACY_POLICY_VERSION,
        ...(keepRequests ? { requests: values.requests, requestsConsentAt: now.toISOString() } : {}),
      },
      req,
      overrideAccess: true,
    })

    // 저장 후 점유 인원이 정원과 같으면 같은 트랜잭션에서 마감한다. 마감을 다시 여는 코드는 두지 않는다(REQ-APPLY-010)
    if (checked.occupied + values.partySize === checked.capacity) {
      await payload.update({
        collection: 'tour-sessions',
        id: values.sessionId,
        data: { status: 'closed' },
        req,
        overrideAccess: true,
      })
    }

    await options.beforeCommit?.(req)
    // 안쪽 작업이 실패하며 트랜잭션을 이미 되돌렸다면 커밋은 아무것도 하지 않고 끝나므로, 살아 있는지 먼저 확인한다
    transactionDb(payload, transactionID)
    await payload.db.commitTransaction(transactionID)
    return { status: 'success', referenceCode }
  } catch (err) {
    await payload.db.rollbackTransaction(transactionID).catch(() => undefined)
    const code = isLockTimeoutError(err) ? 'SESSION_BUSY' : 'INTERNAL_ERROR'
    logFailure(payload, code, err, values.sessionId)
    return { status: 'error', code }
  }
}
