// SPEC-ADMIN-001 M2 — 신청 상태 변경 규칙(실제 DB, Payload 로컬 API의 단건 수정 경로).
// AC-ADMIN-004(전환과 취소일), AC-ADMIN-005(복원 정원 확인·자동 마감·회차 없는 신청), AC-ADMIN-007(취소가 마감을 풀지 않음),
// AC-ADMIN-014(작업 기록 내용과 원자성). 동시성 사례는 application-status-concurrency.spec.ts가 다룬다.
// 관리자 상태 변경은 payload.update({ id, data, user: 관리자, overrideAccess: false }) — REST·관리자 화면과 같은 updateByID 경로.
import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { getApplySession } from '../../src/lib/catalog'
import { getOccupiedSeatsBySession } from '../../src/lib/occupancy'
import { submitApplication } from '../../src/lib/submit-application'
import { transactionDb } from '../../src/lib/transaction-db'
import config from '../../src/payload.config'
import type { User } from '../../src/payload-types'
import {
  auditLogsOfApplication,
  caught,
  createTestAdmin,
  deleteTestAdmin,
  sessionStatus,
  updateAsAdmin,
  type ApplicationStatus,
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
const ips = testIpPool('198.51.100', 120)
let payload: Payload
let admin: User

async function occupied(sessionId: number): Promise<number> {
  return (await getOccupiedSeatsBySession(payload, [sessionId])).get(sessionId) ?? Number.NaN
}

async function createApplication(sessionId: number, overrides: Record<string, unknown> = {}) {
  return payload.create({ collection: 'applications', data: applicationInput(sessionId, marker, overrides) as never })
}

function cancelledInput(partySize: number) {
  return { status: 'cancelled', partySize, cancelledAt: new Date(Date.now() - 60_000).toISOString() }
}

async function readApplication(id: number) {
  return payload.findByID({ collection: 'applications', id, depth: 0 })
}

function setStatus(id: number, status: ApplicationStatus) {
  return updateAsAdmin(payload, admin, id, { status })
}

/** admin-audit-logs 생성만 한 번 실패시킨다(plan.md §B.9 — 제품 코드에 시험용 분기를 두지 않음). 훅은 req.payload(같은 인스턴스)를 쓴다. */
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

describe('신청 상태 변경 규칙(실제 DB)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    admin = await createTestAdmin(payload, 'admin-status')
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

  it('AC-ADMIN-004: 전환표대로 상태와 취소일이 바뀌고, 상태가 바뀐 4번만 작업 기록이 남는다', async () => {
    const { sessionId } = await createTourWithSession(payload, marker, 'transitions', { capacity: 10 })
    const p = await createApplication(sessionId, { partySize: 2 })

    const step = async (status: ApplicationStatus) => {
      const t0 = Date.now()
      await setStatus(p.id, status)
      const t1 = Date.now()
      return { doc: await readApplication(p.id), t0, t1 }
    }

    const s1 = await step('confirmed')
    expect(s1.doc.status).toBe('confirmed')
    expect(s1.doc.cancelledAt ?? null).toBeNull()
    expect(await occupied(sessionId)).toBe(2)

    const s2 = await step('cancelled')
    expect(s2.doc.status).toBe('cancelled')
    const cancelledAt = Date.parse(s2.doc.cancelledAt ?? '')
    expect(cancelledAt).toBeGreaterThanOrEqual(s2.t0)
    expect(cancelledAt).toBeLessThanOrEqual(s2.t1)
    expect(await occupied(sessionId)).toBe(0)

    const s3 = await step('cancelled')
    expect(s3.doc.status).toBe('cancelled')
    expect(s3.doc.cancelledAt).toBe(s2.doc.cancelledAt)

    const s4 = await step('pending')
    expect(s4.doc.status).toBe('pending')
    expect(s4.doc.cancelledAt ?? null).toBeNull()
    expect(await occupied(sessionId)).toBe(2)

    const s5 = await step('confirmed')
    expect(s5.doc.cancelledAt ?? null).toBeNull()

    const logs = await auditLogsOfApplication(payload, p.id)
    expect(logs.map((log) => [log.fromStatus, log.toStatus])).toEqual([
      ['pending', 'confirmed'],
      ['confirmed', 'cancelled'],
      ['cancelled', 'pending'],
      ['pending', 'confirmed'],
    ])
    for (const log of logs) {
      expect(log.action).toBe('application.status_change')
      expect(log.actorId).toBe(admin.id)
      expect(log.applicationId).toBe(p.id)
      expect(log.referenceCode).toBe(p.referenceCode)
      expect(log.sessionId).toBe(sessionId)
    }
  })

  describe('AC-ADMIN-005: 취소 복원의 정원 확인과 자동 마감', () => {
    it('정원을 넘는 복원은 409 RESTORE_CAPACITY_EXCEEDED이고 아무것도 바뀌지 않으며, 자리가 생기면 복원된다(S5)', async () => {
      const { sessionId } = await createTourWithSession(payload, marker, 'restore-s5', { capacity: 5 })
      const x = await createApplication(sessionId, { partySize: 3 })
      const y = await createApplication(sessionId, cancelledInput(3))

      const error = await caught(setStatus(y.id, 'pending'))
      expect(error?.status).toBe(409)
      expect(error?.message.startsWith('RESTORE_CAPACITY_EXCEEDED:')).toBe(true)
      const yAfter = await readApplication(y.id)
      expect(yAfter.status).toBe('cancelled')
      expect(yAfter.cancelledAt).toBe(y.cancelledAt)
      expect(await sessionStatus(payload, sessionId)).toBe('open')
      expect(await auditLogsOfApplication(payload, y.id)).toHaveLength(0)

      await setStatus(x.id, 'cancelled')
      await setStatus(y.id, 'confirmed')
      expect(await occupied(sessionId)).toBe(3)
      expect(await sessionStatus(payload, sessionId)).toBe('open')
    })

    it('정원을 정확히 채우는 복원은 같은 저장에서 회차를 마감한다(S4)', async () => {
      const { sessionId } = await createTourWithSession(payload, marker, 'restore-s4', { capacity: 4 })
      await createApplication(sessionId, { partySize: 2 })
      const z = await createApplication(sessionId, cancelledInput(2))

      await setStatus(z.id, 'pending')

      expect(await occupied(sessionId)).toBe(4)
      expect(await sessionStatus(payload, sessionId)).toBe('closed')
    })

    it('이미 마감된 회차에 자리가 있으면 복원되고 마감은 그대로다(U6)', async () => {
      const { sessionId } = await createTourWithSession(payload, marker, 'restore-u6', {
        capacity: 6,
        status: 'closed',
      })
      await createApplication(sessionId, { partySize: 2 })
      const w = await createApplication(sessionId, cancelledInput(2))

      await setStatus(w.id, 'confirmed')

      expect(await occupied(sessionId)).toBe(4)
      expect(await sessionStatus(payload, sessionId)).toBe('closed')
    })

    it('마감된 회차라도 정원을 넘는 복원은 거부된다(V3)', async () => {
      const { sessionId } = await createTourWithSession(payload, marker, 'restore-v3', {
        capacity: 3,
        status: 'closed',
      })
      await createApplication(sessionId, { partySize: 2 })
      const q = await createApplication(sessionId, cancelledInput(2))

      const error = await caught(setStatus(q.id, 'pending'))

      expect(error?.status).toBe(409)
      expect(error?.message.startsWith('RESTORE_CAPACITY_EXCEEDED:')).toBe(true)
      expect((await readApplication(q.id)).status).toBe('cancelled')
    })

    describe('회차 없는 신청(SESSION_MISSING)', () => {
      // 현재 스키마에서 applications.session_id는 NOT NULL이라(외래 키는 ON DELETE SET NULL) 회차 없는 신청을
      // 커밋할 수 없다. 테스트 트랜잭션 안에서만 NOT NULL을 풀고 session_id를 NULL로 바꾼 뒤 같은 트랜잭션의 req로
      // 수정을 시도하고, 끝에 트랜잭션을 되돌려 스키마·데이터를 원래대로 둔다(SPEC-APPLY-001 F1 결과의 재현)
      async function attemptOnOrphan(ids: number[], run: (req: PayloadRequest) => Promise<unknown>) {
        const transactionID = await payload.db.beginTransaction()
        if (transactionID === null || transactionID === undefined) throw new Error('Transaction is not available.')
        try {
          const db = transactionDb(payload, transactionID)
          // 테이블 잠금을 오래 기다리지 않는다(같은 DB의 다른 연결이 쓰는 중이면 이 사례가 실패로 끝남)
          await db.execute(sql`SELECT set_config('lock_timeout', '3000', true)`)
          await db.execute(sql`ALTER TABLE applications ALTER COLUMN session_id DROP NOT NULL`)
          await db.execute(
            sql`UPDATE applications SET session_id = NULL WHERE id IN (${sql.join(
              ids.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          )
          const req = await createLocalReq({ user: admin as never }, payload)
          req.transactionID = transactionID
          return await caught(run(req))
        } finally {
          // 실패한 수정이 이미 트랜잭션을 되돌렸으면(killTransaction) 이 호출은 아무것도 하지 않는다
          await payload.db.rollbackTransaction(transactionID).catch(() => undefined)
        }
      }

      function updateInTransaction(req: PayloadRequest, id: number, data: Record<string, unknown>) {
        return payload.update({ collection: 'applications', id, data: data as never, req, overrideAccess: false })
      }

      it('복원·취소·같은 상태 저장·상태 없는 수정이 모두 409 SESSION_MISSING이고 아무것도 바뀌지 않는다', async () => {
        const { sessionId } = await createTourWithSession(payload, marker, 'orphan', { capacity: 10 })
        const o = await createApplication(sessionId, cancelledInput(1))
        const o2 = await createApplication(sessionId, { partySize: 1, requests: `${marker}-고아` })

        const cases: [number, Record<string, unknown>][] = [
          [o.id, { status: 'pending' }],
          [o2.id, { status: 'cancelled' }],
          [o2.id, { status: 'pending' }],
          [o2.id, { name: `${marker}-바꾼이름` }],
        ]
        try {
          for (const [id, data] of cases) {
            const error = await attemptOnOrphan([o.id, o2.id], (req) => updateInTransaction(req, id, data))
            expect(error?.status).toBe(409)
            expect(error?.message.startsWith('SESSION_MISSING:')).toBe(true)
            expect((error as { cause?: unknown } | undefined)?.cause).toBeUndefined()
          }

          const oAfter = await readApplication(o.id)
          expect(oAfter.status).toBe('cancelled')
          const o2After = await readApplication(o2.id)
          expect(o2After.status).toBe('pending')
          expect(o2After.cancelledAt ?? null).toBeNull()
          expect(o2After.requests).toBe(`${marker}-고아`)
          expect(o2After.name).toBe(o2.name)
          expect(await auditLogsOfApplication(payload, o.id)).toHaveLength(0)
          expect(await auditLogsOfApplication(payload, o2.id)).toHaveLength(0)
          // 트랜잭션을 되돌렸으므로 회차 관계와 NOT NULL 제약이 그대로다
          expect((await readApplication(o.id)).session).toBe(sessionId)
        } finally {
          await payload.delete({ collection: 'applications', where: { id: { in: [o.id, o2.id] } } })
        }
      })
    })
  })

  it('AC-ADMIN-007: 취소는 마감을 풀지 않는다(조회 계층 사유 closed, 이어진 접수는 SESSION_CLOSED)', async () => {
    const { sessionId } = await createTourWithSession(payload, marker, 'no-reopen', { capacity: 2 })
    const submit = () =>
      submitApplication(payload, submissionInput(sessionId, marker, { partySize: '1' }), { clientIp: ips.next() })
    expect((await submit()).status).toBe('success')
    expect((await submit()).status).toBe('success')
    expect(await sessionStatus(payload, sessionId)).toBe('closed')

    const one = await payload.find({
      collection: 'applications',
      where: { session: { equals: sessionId } },
      limit: 1,
      depth: 0,
    })
    await setStatus(one.docs[0].id, 'cancelled')

    expect(await sessionStatus(payload, sessionId)).toBe('closed')
    const apply = await getApplySession(payload, sessionId)
    expect(apply?.session.availability.reason).toBe('closed')
    expect(await submit()).toEqual({ status: 'error', code: 'SESSION_CLOSED' })
  })

  describe('AC-ADMIN-014: 작업 기록 내용과 원자성', () => {
    it('관리자가 아닌 서버 경로(로컬 API 기본값)의 상태 변경도 기록되고 관리자 ID가 비어 있다', async () => {
      const { sessionId } = await createTourWithSession(payload, marker, 'audit-server', { capacity: 10 })
      const a = await createApplication(sessionId)

      await payload.update({ collection: 'applications', id: a.id, data: { status: 'confirmed' } })

      const logs = await auditLogsOfApplication(payload, a.id)
      expect(logs).toHaveLength(1)
      expect(logs[0].actorId ?? null).toBeNull()
      expect([logs[0].fromStatus, logs[0].toStatus]).toEqual(['pending', 'confirmed'])
    })

    it('기록 생성이 실패하면 취소가 함께 되돌려진다(상태·취소일 그대로, 기록 없음)', async () => {
      const { sessionId } = await createTourWithSession(payload, marker, 'audit-atomic-cancel', { capacity: 10 })
      const a = await createApplication(sessionId)

      const spy = failAuditCreateOnce()
      let error: Awaited<ReturnType<typeof caught>>
      try {
        error = await caught(setStatus(a.id, 'cancelled'))
      } finally {
        spy.mockRestore()
      }

      expect(error).toBeDefined()
      expect((error as { cause?: unknown }).cause).toBeUndefined()
      expect(error?.message).not.toContain('audit insert failed')
      const after = await readApplication(a.id)
      expect(after.status).toBe('pending')
      expect(after.cancelledAt ?? null).toBeNull()
      expect(await auditLogsOfApplication(payload, a.id)).toHaveLength(0)
    })

    it('기록 생성이 실패하면 정원을 채우는 복원의 회차 마감도 함께 되돌려진다', async () => {
      const { sessionId } = await createTourWithSession(payload, marker, 'audit-atomic-close', { capacity: 4 })
      await createApplication(sessionId, { partySize: 2 })
      const z = await createApplication(sessionId, cancelledInput(2))

      const spy = failAuditCreateOnce()
      let error: Awaited<ReturnType<typeof caught>>
      try {
        error = await caught(setStatus(z.id, 'pending'))
      } finally {
        spy.mockRestore()
      }

      expect(error).toBeDefined()
      expect((await readApplication(z.id)).status).toBe('cancelled')
      expect(await sessionStatus(payload, sessionId)).toBe('open')
      expect(await occupied(sessionId)).toBe(2)
    })

    it('이 파일이 남긴 작업 기록 어디에도 신청자 개인정보가 없고, 기록 컬렉션에 개인정보 필드가 없다', async () => {
      const tours = await payload.find({ collection: 'tours', where: { slug: { like: marker } }, pagination: false })
      const sessions = await payload.find({
        collection: 'tour-sessions',
        where: { tour: { in: tours.docs.map((tour) => tour.id) } },
        pagination: false,
        depth: 0,
      })
      const logs = await payload.find({
        collection: 'admin-audit-logs',
        where: { sessionId: { in: sessions.docs.map((session) => session.id) } },
        pagination: false,
        depth: 0,
      })
      const text = JSON.stringify(logs.docs)

      // 대상 존재 단언: 이 파일의 사례들이 남긴 기록이 실제로 있다
      expect(logs.docs.length).toBeGreaterThanOrEqual(4)
      expect(text).not.toContain(marker)
      expect(text).not.toContain('010-1234-5678')
      expect(text).not.toContain('@example.test')

      const fieldNames = (payload.collections['admin-audit-logs'].config.fields as { name?: string }[])
        .map((field) => field.name)
        .filter((name): name is string => name !== undefined)
      expect(fieldNames.length).toBeGreaterThan(0)
      for (const name of ['name', 'email', 'phone', 'requests']) expect(fieldNames).not.toContain(name)
    })
  })
})
