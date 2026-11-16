// SPEC-ADMIN-001 M1 — 관리자 작업 기록(admin-audit-logs) 접근 규칙과 기록 함수(실제 DB, Payload 로컬 API).
// AC-ADMIN-015(접근 부분), REQ-ADMIN-014: 익명·관리자 모두 생성·수정·삭제 거부, 읽기는 관리자만, 개인정보 필드 없음.
// 기록은 서버 코드가 recordAdminAction(같은 req, overrideAccess: true)으로만 남긴다(plan.md §B.7).
// 정리: cleanupMarkerData가 회차를 지우기 전에 그 회차들의 작업 기록을 지운다(AC-ADMIN-016 고아 기록 방지).
import { randomUUID } from 'node:crypto'

import { createLocalReq, Forbidden, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { recordAdminAction } from '../../src/lib/admin-audit'
import config from '../../src/payload.config'
import type { User } from '../../src/payload-types'
import {
  applicationInput,
  cleanupMarkerData,
  createTourWithSession,
  testReferenceCode,
} from '../helpers/application-fixtures'
import { newMarker } from '../helpers/catalog-fixtures'

const COLLECTION = 'admin-audit-logs'
const marker = newMarker()
const adminEmail = `admin-${randomUUID()}@example.test`
let payload: Payload
let admin: User

const fixture = {} as { sessionId: number; applicationId: number; referenceCode: string; logId: number }

const ANON = { overrideAccess: false } as const

function asAdmin() {
  return { overrideAccess: false, user: admin } as const
}

async function logsOfSession() {
  const result = await payload.find({
    collection: COLLECTION,
    where: { sessionId: { equals: fixture.sessionId } },
    sort: 'id',
    depth: 0,
    pagination: false,
  })
  return result.docs
}

describe('관리자 작업 기록(실제 DB)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    admin = await payload.create({ collection: 'users', data: { email: adminEmail, password: `pw-${randomUUID()}` } })

    const { sessionId } = await createTourWithSession(payload, marker, 'audit', { capacity: 10 })
    const referenceCode = testReferenceCode()
    const application = await payload.create({
      collection: 'applications',
      data: applicationInput(sessionId, marker, { referenceCode }) as never,
    })

    const req = await createLocalReq({ user: admin as never }, payload)
    const log = await recordAdminAction(req, {
      action: 'application.status_change',
      applicationId: application.id,
      referenceCode,
      sessionId,
      fromStatus: 'pending',
      toStatus: 'confirmed',
    })
    Object.assign(fixture, { sessionId, applicationId: application.id, referenceCode, logId: log.id })
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
    // 순서: 작업 기록 → 신청 → 회차 → 투어(cleanupMarkerData) → 테스트 관리자
    await step(() => cleanupMarkerData(payload, marker))
    await step(async () => {
      const left = await payload.count({ collection: COLLECTION, where: { sessionId: { equals: fixture.sessionId } } })
      expect(left.totalDocs).toBe(0)
    })
    await step(() => payload.delete({ collection: 'users', where: { email: { equals: adminEmail } } }))
    await payload.destroy()
    if (failures.length > 0) throw failures[0]
  })

  describe('recordAdminAction', () => {
    it('관리자 요청으로 남긴 기록은 관리자 ID·처리 시각·신청·회차·상태를 담는다', async () => {
      const [log] = await logsOfSession()

      expect(log.id).toBe(fixture.logId)
      expect(log.action).toBe('application.status_change')
      expect(log.actorId).toBe(admin.id)
      expect(log.applicationId).toBe(fixture.applicationId)
      expect(log.referenceCode).toBe(fixture.referenceCode)
      expect(log.sessionId).toBe(fixture.sessionId)
      expect(log.fromStatus).toBe('pending')
      expect(log.toStatus).toBe('confirmed')
      expect(Math.abs(Date.parse(log.occurredAt) - Date.now())).toBeLessThan(60_000)
    })

    it('관리자가 아닌 서버 경로의 기록은 관리자 ID를 비운다', async () => {
      const req = await createLocalReq({}, payload)
      const log = await recordAdminAction(req, {
        action: 'session.participants_csv',
        sessionId: fixture.sessionId,
        rowCount: 3,
      })

      expect(log.actorId ?? null).toBeNull()
      expect(log.rowCount).toBe(3)
      expect(log.applicationId ?? null).toBeNull()
      expect(log.fromStatus ?? null).toBeNull()
    })
  })

  describe('접근 규칙(AC-ADMIN-015 접근 부분)', () => {
    it.each([
      ['익명', () => ANON],
      ['관리자', asAdmin],
    ])('%s의 작업 기록 생성·수정·삭제는 모두 권한 오류이고 문서 수와 값이 그대로다', async (_label, context) => {
      const before = await logsOfSession()
      // 대상 존재 단언: 준비한 기록이 실제로 있다
      expect(before.length).toBeGreaterThanOrEqual(1)

      await expect(
        payload.create({
          collection: COLLECTION,
          data: {
            action: 'application.status_change',
            occurredAt: new Date().toISOString(),
            sessionId: fixture.sessionId,
          },
          ...context(),
        }),
      ).rejects.toBeInstanceOf(Forbidden)
      await expect(
        payload.update({ collection: COLLECTION, id: fixture.logId, data: { toStatus: 'cancelled' }, ...context() }),
      ).rejects.toBeInstanceOf(Forbidden)
      await expect(payload.delete({ collection: COLLECTION, id: fixture.logId, ...context() })).rejects.toBeInstanceOf(
        Forbidden,
      )

      expect(await logsOfSession()).toEqual(before)
    })

    it('관리자의 일괄 수정도 거부되고 값이 그대로다', async () => {
      const before = await logsOfSession()
      expect(before.length).toBeGreaterThanOrEqual(1)

      await expect(
        payload.update({
          collection: COLLECTION,
          where: { sessionId: { equals: fixture.sessionId } },
          data: { toStatus: 'cancelled' },
          ...asAdmin(),
        }),
      ).rejects.toThrow()

      expect(await logsOfSession()).toEqual(before)
    })

    it('익명의 조회는 권한 오류이고, 관리자의 조회 결과에는 준비한 기록이 있다', async () => {
      await expect(
        payload.find({ collection: COLLECTION, where: { sessionId: { equals: fixture.sessionId } }, ...ANON }),
      ).rejects.toBeInstanceOf(Forbidden)
      await expect(payload.findByID({ collection: COLLECTION, id: fixture.logId, ...ANON })).rejects.toBeInstanceOf(
        Forbidden,
      )

      const result = await payload.find({
        collection: COLLECTION,
        where: { sessionId: { equals: fixture.sessionId } },
        depth: 0,
        ...asAdmin(),
      })
      expect(result.docs.map((doc) => doc.id)).toContain(fixture.logId)
    })
  })

  describe('컬렉션 설정', () => {
    it('신청자 개인정보 필드가 없고 모든 필드가 수정 거부이며 관리자 화면 메뉴에 보인다', () => {
      const collection = payload.config.collections.find((entry) => entry.slug === COLLECTION)
      expect(collection).toBeDefined()

      const named = (collection?.fields ?? []).filter(
        (field): field is typeof field & { name: string } => 'name' in field && typeof field.name === 'string',
      )
      const appFields = named.filter((field) => !['id', 'createdAt', 'updatedAt'].includes(field.name))
      expect(appFields.map((field) => field.name).sort()).toEqual(
        [
          'action',
          'actorId',
          'applicationId',
          'fromStatus',
          'occurredAt',
          'referenceCode',
          'rowCount',
          'sessionId',
          'toStatus',
        ].sort(),
      )
      for (const piiField of ['name', 'email', 'phone', 'requests']) {
        expect(appFields.map((field) => field.name)).not.toContain(piiField)
      }
      for (const field of appFields) {
        const access = (field as { access?: { update?: unknown } }).access
        expect(typeof access?.update, field.name).toBe('function')
      }
      expect(collection?.disableBulkEdit).toBe(true)
      expect(collection?.admin.hidden ?? false).toBe(false)
    })
  })
})
