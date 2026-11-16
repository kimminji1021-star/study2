// SPEC-ADMIN-001 M3 — 요청 사항 삭제(실제 PostgreSQL). 엔드포인트가 부르는 src/lib 처리 함수를 직접 호출한다(plan.md §B.4·§B.9).
// AC-ADMIN-008(권한·결과 코드·원자성·잠금 대기 초과·되살림 방지 결정적 사례 2개), AC-ADMIN-005(회차 없는 신청의 삭제 SESSION_MISSING),
// AC-ADMIN-006(요청 사항 삭제 ↔ 상태 변경 — 결정적 사례 1개 + 병렬 3회).
// 결정적 사례는 한쪽이 회차 행 잠금을 쥔 채 멈춘 동안 상대가 FOR UPDATE에서 기다리는 것을 pg_stat_activity로 확인한 뒤 풀어 준다.
// 사례의 전제(plan-audit O2): 대상 신청을 가리키는 Payload 문서 잠금 행(payload_locked_documents_rels)이 없다.
import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { clearApplicationRequests, clearRequestsEndpoint, type ClearRequestsResult } from '../../src/lib/clear-requests'
import { transactionDb } from '../../src/lib/transaction-db'
import config from '../../src/payload.config'
import type { Application, User } from '../../src/payload-types'
import {
  auditLogsOfApplication,
  caught,
  createTestAdmin,
  deleteTestAdmin,
  lockedDocumentRows,
  updateAsAdmin,
  waitForLockWaiters,
} from '../helpers/admin-fixtures'
import { applicationInput, cleanupMarkerData, createTourWithSession } from '../helpers/application-fixtures'
import { newMarker } from '../helpers/catalog-fixtures'

const marker = newMarker()
const FIXED_NOW = new Date('2026-11-16T03:04:05.678Z')
let payload: Payload
let admin: User

async function createApplication(sessionId: number, overrides: Record<string, unknown> = {}): Promise<Application> {
  const doc = await payload.create({
    collection: 'applications',
    data: applicationInput(sessionId, marker, overrides) as never,
  })
  // 전제(O2): 이 신청을 가리키는 문서 잠금 행이 없다
  expect(await lockedDocumentRows(payload, doc.id)).toBe(0)
  return doc
}

function withRequests(text: string, extra: Record<string, unknown> = {}) {
  return { requests: text, requestsConsentAt: new Date(Date.now() - 60_000).toISOString(), ...extra }
}

async function read(id: number): Promise<Application> {
  return payload.findByID({ collection: 'applications', id, depth: 0 })
}

function clearAsAdmin(id: unknown, options: { now?: Date; beforeCommit?: () => Promise<void> } = {}) {
  return clearApplicationRequests(payload, { applicationId: id, user: admin, ...options })
}

function isEmpty(value: string | null | undefined): boolean {
  return value === null || value === undefined || value === ''
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

/** 별도 트랜잭션으로 회차 행을 FOR UPDATE로 쥔다. 끝에 rollback으로 풀어 준다. */
async function holdSessionRow(sessionId: number) {
  const transactionID = await payload.db.beginTransaction()
  if (transactionID === null || transactionID === undefined) throw new Error('Transaction is not available.')
  await transactionDb(payload, transactionID).execute(
    sql`SELECT id FROM tour_sessions WHERE id = ${sessionId} FOR UPDATE`,
  )
  return { rollback: () => payload.db.rollbackTransaction(transactionID).catch(() => undefined) }
}

/** admin-audit-logs 생성만 한 번 실패시킨다(plan.md §B.9 — 제품 코드에 시험용 분기를 두지 않음). */
function failAuditCreateOnce() {
  const original = payload.create.bind(payload)
  let failed = false
  return vi.spyOn(payload, 'create').mockImplementation(((args: { collection: string }) => {
    if (!failed && args.collection === 'admin-audit-logs') {
      failed = true
      return Promise.reject(new Error('audit insert failed (test)'))
    }
    return original(args as never)
  }) as never)
}

describe('요청 사항 삭제(실제 DB)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    admin = await createTestAdmin(payload, 'admin-clear-requests')
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
    await step(() => cleanupMarkerData(payload, marker))
    await step(() => deleteTestAdmin(payload, admin))
    await payload.destroy()
    if (failures.length > 0) throw failures[0]
  })

  describe('AC-ADMIN-008: 처리 결과와 권한', () => {
    it('익명 FORBIDDEN, 없는 ID·형식 오류 NOT_FOUND, 빈 요청 사항 REQUESTS_EMPTY — 아무것도 바뀌지 않고 기록도 없다', async () => {
      const { sessionId } = await createTourWithSession(payload, marker, 'perm', { capacity: 10 })
      const r = await createApplication(sessionId, withRequests(`${marker}-요청`))
      const e = await createApplication(sessionId)

      expect(await clearApplicationRequests(payload, { applicationId: r.id, user: null })).toEqual({
        status: 'error',
        code: 'FORBIDDEN',
      })
      expect((await read(r.id)).requests).toBe(`${marker}-요청`)

      for (const id of [2147483000, 'abc', 0, -1, '2147483648', 1.5, '']) {
        expect(await clearAsAdmin(id), String(id)).toEqual({ status: 'error', code: 'NOT_FOUND' })
      }
      expect(await clearAsAdmin(e.id)).toEqual({ status: 'error', code: 'REQUESTS_EMPTY' })

      expect(await auditLogsOfApplication(payload, 2147483000)).toHaveLength(0)
      expect(await auditLogsOfApplication(payload, e.id)).toHaveLength(0)
      expect(await auditLogsOfApplication(payload, r.id)).toHaveLength(0)
    })

    it('관리자 삭제는 cleared이고 요청 사항만 비우며 삭제 일시를 남긴다. 두 번째는 REQUESTS_EMPTY이고 아무것도 바뀌지 않는다', async () => {
      const { sessionId } = await createTourWithSession(payload, marker, 'clear', { capacity: 10 })
      const r = await createApplication(sessionId, withRequests(`${marker}-요청`))

      const result = await clearAsAdmin(r.id, { now: FIXED_NOW })
      expect(result).toEqual({ status: 'cleared', requestsDeletedAt: FIXED_NOW.toISOString() })
      expect(JSON.stringify(result)).not.toContain(marker)

      const after = await read(r.id)
      expect(isEmpty(after.requests)).toBe(true)
      expect(new Date(after.requestsDeletedAt ?? '').getTime()).toBe(FIXED_NOW.getTime())
      expect(after.requestsConsentAt).toBe(r.requestsConsentAt)
      expect(after.name).toBe(r.name)
      expect(after.email).toBe(r.email)
      expect(after.phone).toBe(r.phone)
      expect(after.partySize).toBe(r.partySize)
      expect(after.status).toBe(r.status)
      expect(after.referenceCode).toBe(r.referenceCode)

      const logs = await auditLogsOfApplication(payload, r.id)
      expect(logs).toHaveLength(1)
      expect(logs[0]).toMatchObject({
        action: 'application.requests_delete',
        actorId: admin.id,
        applicationId: r.id,
        referenceCode: r.referenceCode,
        sessionId,
      })
      expect(logs[0].fromStatus ?? null).toBeNull()
      expect(logs[0].toStatus ?? null).toBeNull()

      expect(await clearAsAdmin(r.id)).toEqual({ status: 'error', code: 'REQUESTS_EMPTY' })
      expect(new Date((await read(r.id)).requestsDeletedAt ?? '').getTime()).toBe(FIXED_NOW.getTime())
      expect(await auditLogsOfApplication(payload, r.id)).toHaveLength(1)
    })

    it('원자성: 작업 기록 생성이 실패하면 INTERNAL_ERROR이고 요청 사항·삭제 일시가 그대로다', async () => {
      const { sessionId } = await createTourWithSession(payload, marker, 'atomic', { capacity: 10 })
      const r2 = await createApplication(sessionId, withRequests(`${marker}-원자성`))

      const spy = failAuditCreateOnce()
      let result: ClearRequestsResult
      try {
        result = await clearAsAdmin(r2.id)
      } finally {
        spy.mockRestore()
      }

      expect(result).toEqual({ status: 'error', code: 'INTERNAL_ERROR' })
      const after = await read(r2.id)
      expect(after.requests).toBe(`${marker}-원자성`)
      expect(after.requestsDeletedAt ?? null).toBeNull()
      expect(await auditLogsOfApplication(payload, r2.id)).toHaveLength(0)
    })

    it('관리자의 일반 수정으로 요청 사항을 보내면 오류 없이 끝나지만 글이 그대로다', async () => {
      const { sessionId } = await createTourWithSession(payload, marker, 'plain', { capacity: 10 })
      const r2 = await createApplication(sessionId, withRequests(`${marker}-일반`))

      expect(await caught(updateAsAdmin(payload, admin, r2.id, { requests: '바뀐 글' }))).toBeUndefined()
      expect((await read(r2.id)).requests).toBe(`${marker}-일반`)
    })

    it('잠금 대기 초과: 회차 행이 잡혀 있으면 7초 안에 SESSION_BUSY이고 아무것도 바뀌지 않는다', async () => {
      const { sessionId } = await createTourWithSession(payload, marker, 'busy', { capacity: 10 })
      const r3 = await createApplication(sessionId, withRequests(`${marker}-대기`))
      const holder = await holdSessionRow(sessionId)

      let result: ClearRequestsResult
      let elapsed: number
      try {
        const started = Date.now()
        result = await clearAsAdmin(r3.id)
        elapsed = Date.now() - started
      } finally {
        await holder.rollback()
      }

      expect(result).toEqual({ status: 'error', code: 'SESSION_BUSY' })
      expect(elapsed).toBeLessThan(7000)
      const after = await read(r3.id)
      expect(after.requests).toBe(`${marker}-대기`)
      expect(after.requestsDeletedAt ?? null).toBeNull()
      expect(await auditLogsOfApplication(payload, r3.id)).toHaveLength(0)
    })
  })

  it('엔드포인트 처리 함수: 결과 코드를 HTTP 상태와 본문으로 바꾸고 요청 사항 글을 담지 않는다', async () => {
    const { sessionId } = await createTourWithSession(payload, marker, 'endpoint', { capacity: 10 })
    const r = await createApplication(sessionId, withRequests(`${marker}-엔드포인트`))
    const handler = clearRequestsEndpoint.handler

    async function call(user: User | null, id: string) {
      const req = await createLocalReq({ user: (user ?? undefined) as never }, payload)
      req.routeParams = { id }
      const response = await handler(req)
      return { status: response.status, text: await response.text(), cache: response.headers.get('cache-control') }
    }

    const anonymous = await call(null, String(r.id))
    expect(anonymous.status).toBe(403)
    expect(JSON.parse(anonymous.text)).toEqual({ code: 'FORBIDDEN' })
    expect((await call(admin, 'abc')).status).toBe(404)

    const cleared = await call(admin, String(r.id))
    expect(cleared.status).toBe(200)
    expect(JSON.parse(cleared.text)).toMatchObject({ status: 'cleared' })
    expect(cleared.text).not.toContain(marker)
    expect(cleared.cache).toContain('no-store')

    const again = await call(admin, String(r.id))
    expect(again.status).toBe(409)
    expect(JSON.parse(again.text)).toEqual({ code: 'REQUESTS_EMPTY' })
  })

  describe('AC-ADMIN-008: 되살림 방지(결정적)', () => {
    /** 삭제를 커밋 직전에 멈춘 채 겹치는 저장을 시작하고, 그 저장이 회차 행 잠금을 기다리는 것을 확인한 뒤 풀어 준다. */
    async function clearWhileSaving(id: number, data: Record<string, unknown>) {
      const hold = gate()
      const clearing = clearAsAdmin(id, { now: FIXED_NOW, beforeCommit: hold.hold })
      let saving: Promise<Awaited<ReturnType<typeof caught>>> | undefined
      let waiting = 0
      try {
        // 삭제가 주입 지점에 닿기 전에 끝나면(오류 등) 기다리지 않고 바로 실패한다
        await Promise.race([
          hold.entered,
          clearing.then((result) => {
            throw new Error(`clear finished before the commit hook: ${JSON.stringify(result)}`)
          }),
        ])
        // 이 저장은 삭제가 커밋되기 전의 문서(요청 사항 있음)를 읽은 뒤 잠금을 기다린다
        saving = caught(updateAsAdmin(payload, admin, id, data))
        waiting = await waitForLockWaiters(payload, 1)
      } finally {
        hold.release()
      }
      const [cleared, saveError] = await Promise.all([clearing, saving])
      return { cleared, saveError, waiting }
    }

    it('같은 상태 저장이 삭제 전 문서로 진행돼도 요청 사항이 되살아나지 않는다(G)', async () => {
      const { sessionId } = await createTourWithSession(payload, marker, 'revive-same', { capacity: 10 })
      const g = await createApplication(sessionId, withRequests(`${marker}-되살림`))

      const { cleared, saveError, waiting } = await clearWhileSaving(g.id, { status: 'pending' })

      expect(waiting).toBeGreaterThanOrEqual(1)
      expect(cleared).toEqual({ status: 'cleared', requestsDeletedAt: FIXED_NOW.toISOString() })
      expect(saveError).toBeUndefined()
      const after = await read(g.id)
      expect(isEmpty(after.requests)).toBe(true)
      expect(new Date(after.requestsDeletedAt ?? '').getTime()).toBe(FIXED_NOW.getTime())
      expect(after.status).toBe('pending')
      const logs = await auditLogsOfApplication(payload, g.id)
      expect(logs.map((log) => log.action)).toEqual(['application.requests_delete'])
    })

    it('상태 없는 수정(이름)이 삭제 전 문서로 진행돼도 요청 사항이 되살아나지 않고 이름·상태가 그대로다(H)', async () => {
      const { sessionId } = await createTourWithSession(payload, marker, 'revive-name', { capacity: 10 })
      const h = await createApplication(sessionId, withRequests(`${marker}-되살림2`))

      const { cleared, saveError, waiting } = await clearWhileSaving(h.id, { name: `${marker}-바꾼이름` })

      expect(waiting).toBeGreaterThanOrEqual(1)
      expect(cleared).toEqual({ status: 'cleared', requestsDeletedAt: FIXED_NOW.toISOString() })
      expect(saveError).toBeUndefined()
      const after = await read(h.id)
      expect(isEmpty(after.requests)).toBe(true)
      expect(new Date(after.requestsDeletedAt ?? '').getTime()).toBe(FIXED_NOW.getTime())
      expect(after.name).toBe(h.name)
      expect(after.status).toBe(h.status)
    })
  })

  it('AC-ADMIN-005: 회차 없는 신청의 요청 사항 삭제는 SESSION_MISSING이고 아무것도 바뀌지 않으며 기록이 없다(O2)', async () => {
    // 현재 스키마에서 applications.session_id는 NOT NULL이다(M2 확인). 테스트 트랜잭션 안에서만 NOT NULL을 풀고
    // session_id를 NULL로 바꾼 뒤 같은 트랜잭션의 req로 삭제를 시도하고, 끝에 트랜잭션을 되돌린다
    const { sessionId } = await createTourWithSession(payload, marker, 'orphan', { capacity: 10 })
    const o2 = await createApplication(sessionId, withRequests(`${marker}-고아`, { partySize: 1 }))

    try {
      const transactionID = await payload.db.beginTransaction()
      if (transactionID === null || transactionID === undefined) throw new Error('Transaction is not available.')
      let result: ClearRequestsResult
      try {
        const db = transactionDb(payload, transactionID)
        await db.execute(sql`SELECT set_config('lock_timeout', '3000', true)`)
        await db.execute(sql`ALTER TABLE applications ALTER COLUMN session_id DROP NOT NULL`)
        await db.execute(sql`UPDATE applications SET session_id = NULL WHERE id = ${o2.id}`)
        const req: PayloadRequest = await createLocalReq({ user: admin as never }, payload)
        req.transactionID = transactionID
        result = await clearApplicationRequests(payload, { applicationId: o2.id, user: admin, req })
      } finally {
        await payload.db.rollbackTransaction(transactionID).catch(() => undefined)
      }

      expect(result).toEqual({ status: 'error', code: 'SESSION_MISSING' })
      const after = await read(o2.id)
      expect(after.requests).toBe(`${marker}-고아`)
      expect(after.requestsDeletedAt ?? null).toBeNull()
      expect(after.session).toBe(sessionId)
      expect(await auditLogsOfApplication(payload, o2.id)).toHaveLength(0)
    } finally {
      await payload.delete({ collection: 'applications', where: { id: { equals: o2.id } } })
    }
  })

  describe('AC-ADMIN-006: 요청 사항 삭제 ↔ 상태 변경(같은 신청)', () => {
    function expectFinalState(after: Application) {
      expect(after.status).toBe('cancelled')
      expect(after.cancelledAt ?? null).not.toBeNull()
      expect(isEmpty(after.requests)).toBe(true)
      expect(after.requestsDeletedAt ?? null).not.toBeNull()
    }

    async function expectOneLogEach(id: number) {
      const logs = await auditLogsOfApplication(payload, id)
      expect(logs.map((log) => log.action).sort()).toEqual(['application.requests_delete', 'application.status_change'])
      const change = logs.find((log) => log.action === 'application.status_change')
      expect(change).toMatchObject({ fromStatus: 'confirmed', toStatus: 'cancelled' })
    }

    it('결정적 사례: 회차 행이 잡힌 동안 둘 다 잠금을 기다리고, 풀리면 교착 없이 둘 다 성공한다(K)', async () => {
      const { sessionId } = await createTourWithSession(payload, marker, 'k-det', { capacity: 10 })
      const k = await createApplication(sessionId, withRequests(`${marker}-요청`, { status: 'confirmed' }))
      const holder = await holdSessionRow(sessionId)

      let change: Promise<Awaited<ReturnType<typeof caught>>> | undefined
      let clearing: Promise<ClearRequestsResult> | undefined
      let firstWaiting = 0
      let bothWaiting = 0
      try {
        change = caught(updateAsAdmin(payload, admin, k.id, { status: 'cancelled' }))
        firstWaiting = await waitForLockWaiters(payload, 1)
        clearing = clearAsAdmin(k.id)
        bothWaiting = await waitForLockWaiters(payload, 2)
      } finally {
        await holder.rollback()
      }
      const [changeError, cleared] = await Promise.all([change, clearing])

      expect(firstWaiting).toBeGreaterThanOrEqual(1)
      expect(bothWaiting).toBeGreaterThanOrEqual(2)
      expect(changeError).toBeUndefined()
      expect(cleared?.status).toBe('cleared')
      expectFinalState(await read(k.id))
      await expectOneLogEach(k.id)
    })

    describe.each([1, 2, 3])('병렬 사례, 반복 %d', (round) => {
      it('취소와 요청 사항 삭제를 함께 시작하면 둘 다 성공하고 최종 상태와 기록이 결정적 사례와 같다', async () => {
        const { sessionId } = await createTourWithSession(payload, marker, `k-par-${round}`, { capacity: 10 })
        const k = await createApplication(sessionId, withRequests(`${marker}-요청`, { status: 'confirmed' }))

        const [changeError, cleared] = await Promise.all([
          caught(updateAsAdmin(payload, admin, k.id, { status: 'cancelled' })),
          clearAsAdmin(k.id),
        ])

        expect(changeError).toBeUndefined()
        expect(cleared).toMatchObject({ status: 'cleared' })
        expectFinalState(await read(k.id))
        await expectOneLogEach(k.id)
      })
    })
  })
})
