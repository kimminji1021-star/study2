// SPEC-ADMIN-001 M2 — 상태 변경과 사이트 접수·다른 수정의 동시성(실제 PostgreSQL, AC-ADMIN-006·AC-ADMIN-008 일부).
// 결정적 사례는 한쪽이 회차 행 잠금을 쥔 채 멈춘 동안 상대가 FOR UPDATE에서 기다리는 것을 pg_stat_activity로 확인한 뒤 풀어 준다.
// 병렬 사례는 모두 시작한 뒤 Promise.all로 한꺼번에 기다린다(순차 await는 아무것도 증명하지 못함).
// 사이트 접수는 SPEC-APPLY-001 처리 함수를 그대로 쓰고(잠금 대기 제한 30초), 접속 IP는 문서용 대역 198.51.100.160~에서 받는다.
// 사례의 전제(plan-audit O2): 대상 신청을 가리키는 Payload 문서 잠금 행(payload_locked_documents_rels)이 없다 —
// 있으면 수정이 훅보다 먼저 그 행에서 기다려(plan.md R26) 이 시험이 보려는 회차 행 잠금 대기가 아닌 것을 보게 된다.
import { sql } from '@payloadcms/db-postgres'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getOccupiedSeatsBySession } from '../../src/lib/occupancy'
import { submitApplication, type SubmitApplicationOptions } from '../../src/lib/submit-application'
import { transactionDb } from '../../src/lib/transaction-db'
import config from '../../src/payload.config'
import type { User } from '../../src/payload-types'
import {
  auditLogsOfApplication,
  caught,
  createTestAdmin,
  deleteTestAdmin,
  lockedDocumentRows,
  sessionStatus,
  updateAsAdmin,
  waitForLockWaiters,
} from '../helpers/admin-fixtures'
import {
  applicationInput,
  cleanupAttempts,
  cleanupMarkerData,
  createTourWithSession,
  submissionInput,
  testIpPool,
} from '../helpers/application-fixtures'
import { newMarker } from '../helpers/catalog-fixtures'

const marker = newMarker()
const ips = testIpPool('198.51.100', 160)
const WAIT_LIMIT_MS = 30_000
let payload: Payload
let admin: User

async function occupied(sessionId: number): Promise<number> {
  return (await getOccupiedSeatsBySession(payload, [sessionId])).get(sessionId) ?? Number.NaN
}

async function createApplication(sessionId: number, overrides: Record<string, unknown> = {}) {
  const doc = await payload.create({
    collection: 'applications',
    data: applicationInput(sessionId, marker, overrides) as never,
  })
  // 전제(O2): 이 신청을 가리키는 문서 잠금 행이 없다
  expect(await lockedDocumentRows(payload, doc.id)).toBe(0)
  return doc
}

function cancelledInput(partySize: number) {
  return { status: 'cancelled', partySize, cancelledAt: new Date(Date.now() - 60_000).toISOString() }
}

function submit(sessionId: number, partySize: number, options: Partial<SubmitApplicationOptions> = {}) {
  return submitApplication(payload, submissionInput(sessionId, marker, { partySize: String(partySize) }), {
    clientIp: ips.next(),
    lockTimeoutMs: WAIT_LIMIT_MS,
    ...options,
  })
}

/** 테스트가 풀어 줄 때까지 멈추는 주입 지점. entered는 주입 함수가 실행되면 풀린다. */
function gate() {
  let release!: () => void
  let markEntered!: () => void
  const opened = new Promise<void>((resolve) => {
    release = resolve
  })
  const entered = new Promise<void>((resolve) => {
    markEntered = resolve
  })
  return {
    entered,
    release,
    hold: async () => {
      markEntered()
      await opened
    },
  }
}

/** 별도 트랜잭션으로 회차 행을 FOR UPDATE로 쥔다. 끝에 rollback 또는 commit으로 풀어 준다. */
async function holdSessionRow(sessionId: number) {
  const transactionID = await payload.db.beginTransaction()
  if (transactionID === null || transactionID === undefined) throw new Error('Transaction is not available.')
  const db = transactionDb(payload, transactionID)
  await db.execute(sql`SELECT id FROM tour_sessions WHERE id = ${sessionId} FOR UPDATE`)
  return {
    db,
    rollback: () => payload.db.rollbackTransaction(transactionID).catch(() => undefined),
    commit: () => payload.db.commitTransaction(transactionID),
  }
}

describe('상태 변경 동시성(실제 DB)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    admin = await createTestAdmin(payload, 'admin-status-concurrency')
  })

  afterAll(async () => {
    if (payload === undefined) return
    const failures: unknown[] = []
    const step = async (run: () => Promise<unknown>) => {
      try {
        await run()
      } catch (error) {
        failures.push(error)
      }
    }
    await step(() => cleanupAttempts(payload, ips.used()))
    await step(() => cleanupMarkerData(payload, marker))
    await step(() => deleteTestAdmin(payload, admin))
    await payload.destroy()
    if (failures.length > 0) throw failures[0]
  })

  it('AC-ADMIN-006 결정적 사례: 사이트 접수가 회차 행을 쥔 동안 복원은 잠금을 기다리고, 풀린 뒤 정원 초과로 거부된다', async () => {
    const { sessionId } = await createTourWithSession(payload, marker, 'det-restore', { capacity: 3 })
    const c = await createApplication(sessionId, cancelledInput(2))
    const hold = gate()

    const submission = submit(sessionId, 2, { beforeCommit: hold.hold })
    let restore: Promise<Awaited<ReturnType<typeof caught>>> | undefined
    let waiting = 0
    try {
      await hold.entered
      restore = caught(updateAsAdmin(payload, admin, c.id, { status: 'pending' }))
      waiting = await waitForLockWaiters(payload, 1)
    } finally {
      hold.release()
    }
    const [submitted, restoreError] = await Promise.all([submission, restore])

    expect(waiting).toBeGreaterThanOrEqual(1)
    expect(submitted.status).toBe('success')
    expect(restoreError?.status).toBe(409)
    expect(restoreError?.message.startsWith('RESTORE_CAPACITY_EXCEEDED:')).toBe(true)
    expect(await occupied(sessionId)).toBe(2)
    expect((await payload.findByID({ collection: 'applications', id: c.id, depth: 0 })).status).toBe('cancelled')
    expect(await auditLogsOfApplication(payload, c.id)).toHaveLength(0)
  })

  describe.each([1, 2, 3])(
    'AC-ADMIN-006 병렬 사례 — 정원 4에 복원 2건 + 사이트 접수 인원 2 두 건, 반복 %d',
    (round) => {
      it('성공한 인원 합 ≤ 4, DB 점유 인원 = 그 합, 합이 4면 마감, 실패 사유가 정해진 코드뿐이다', async () => {
        const { sessionId } = await createTourWithSession(payload, marker, `parallel-${round}`, { capacity: 4 })
        const r1 = await createApplication(sessionId, cancelledInput(2))
        const r2 = await createApplication(sessionId, cancelledInput(2))

        const [restore1, restore2, submit1, submit2] = await Promise.all([
          caught(updateAsAdmin(payload, admin, r1.id, { status: 'pending' })),
          caught(updateAsAdmin(payload, admin, r2.id, { status: 'pending' })),
          submit(sessionId, 2),
          submit(sessionId, 2),
        ])

        const restoredSeats = [restore1, restore2].filter((error) => error === undefined).length * 2
        const submittedSeats = [submit1, submit2].filter((result) => result.status === 'success').length * 2
        const total = restoredSeats + submittedSeats

        expect(total).toBeLessThanOrEqual(4)
        expect(await occupied(sessionId)).toBe(total)
        if (total === 4) expect(await sessionStatus(payload, sessionId)).toBe('closed')
        for (const error of [restore1, restore2]) {
          if (error !== undefined) expect(error.message.startsWith('RESTORE_CAPACITY_EXCEEDED:')).toBe(true)
        }
        for (const result of [submit1, submit2]) {
          if (result.status === 'error') expect(['CAPACITY_EXCEEDED', 'SESSION_CLOSED']).toContain(result.code)
        }
      })
    },
  )

  it('AC-ADMIN-006 잠금 대기 초과: 회차 행이 잡혀 있으면 7초 안에 409 SESSION_BUSY이고 아무것도 바뀌지 않는다', async () => {
    const { sessionId } = await createTourWithSession(payload, marker, 'busy', { capacity: 10 })
    const c = await createApplication(sessionId, cancelledInput(2))
    const holder = await holdSessionRow(sessionId)

    let error: Awaited<ReturnType<typeof caught>>
    let elapsed: number
    try {
      const started = Date.now()
      error = await caught(updateAsAdmin(payload, admin, c.id, { status: 'pending' }))
      elapsed = Date.now() - started
    } finally {
      await holder.rollback()
    }

    expect(error?.status).toBe(409)
    expect(error?.message.startsWith('SESSION_BUSY:')).toBe(true)
    expect((error as { cause?: unknown }).cause).toBeUndefined()
    expect(elapsed).toBeLessThan(7000)
    expect((await payload.findByID({ collection: 'applications', id: c.id, depth: 0 })).status).toBe('cancelled')
    expect(await auditLogsOfApplication(payload, c.id)).toHaveLength(0)
  })

  it('AC-ADMIN-008(상태 없는 수정): 잠금 전에 읽힌 문서로 진행된 이름 수정이 잠금 뒤 상태·요청 사항·취소일을 되돌리지 않는다', async () => {
    const { sessionId } = await createTourWithSession(payload, marker, 'stateless', { capacity: 10 })
    const h = await createApplication(sessionId, { requests: `${marker}-되살림2` })
    const holder = await holdSessionRow(sessionId)

    let rename: Promise<Awaited<ReturnType<typeof caught>>> | undefined
    let waiting = 0
    try {
      // 이름 수정은 잠금 전 문서(대기, 요청 사항 있음)를 읽은 뒤 회차 행 잠금을 기다린다
      rename = caught(updateAsAdmin(payload, admin, h.id, { name: `${marker}-바꾼이름` }))
      waiting = await waitForLockWaiters(payload, 1)
      // 그동안 다른 트랜잭션(같은 순서: 회차 → 신청)이 상태·요청 사항·취소일을 바꾸고 커밋한다
      await holder.db.execute(sql`
        UPDATE applications
           SET status = 'cancelled', cancelled_at = now(), requests = NULL, requests_deleted_at = now()
         WHERE id = ${h.id}
      `)
    } finally {
      if (waiting >= 1) await holder.commit()
      else await holder.rollback()
    }
    const renameError = await rename

    expect(waiting).toBeGreaterThanOrEqual(1)
    expect(renameError).toBeUndefined()
    const after = await payload.findByID({ collection: 'applications', id: h.id, depth: 0 })
    expect(after.name).toBe(h.name)
    expect(after.status).toBe('cancelled')
    expect(after.cancelledAt ?? null).not.toBeNull()
    expect(after.requests ?? null).toBeNull()
    expect(after.requestsDeletedAt ?? null).not.toBeNull()
    expect(await auditLogsOfApplication(payload, h.id)).toHaveLength(0)
  })

  it('잠금을 기다리는 사이 신청의 회차가 바뀌면(plan.md §B.2 4번) 409 SESSION_MISSING이고 아무것도 바뀌지 않는다', async () => {
    const { sessionId } = await createTourWithSession(payload, marker, 'moved-a', { capacity: 10 })
    const { sessionId: otherId } = await createTourWithSession(payload, marker, 'moved-b', { capacity: 10 })
    const m = await createApplication(sessionId)
    const holder = await holdSessionRow(sessionId)

    let change: Promise<Awaited<ReturnType<typeof caught>>> | undefined
    let waiting = 0
    try {
      change = caught(updateAsAdmin(payload, admin, m.id, { status: 'confirmed' }))
      waiting = await waitForLockWaiters(payload, 1)
      await holder.db.execute(sql`UPDATE applications SET session_id = ${otherId} WHERE id = ${m.id}`)
    } finally {
      if (waiting >= 1) await holder.commit()
      else await holder.rollback()
    }
    const error = await change

    expect(waiting).toBeGreaterThanOrEqual(1)
    expect(error?.status).toBe(409)
    expect(error?.message.startsWith('SESSION_MISSING:')).toBe(true)
    const after = await payload.findByID({ collection: 'applications', id: m.id, depth: 0 })
    expect(after.status).toBe('pending')
    expect(await auditLogsOfApplication(payload, m.id)).toHaveLength(0)
  })
})
