// SPEC-APPLY-001 M1 — applications·application-attempts 접근 규칙(실제 DB, Payload 로컬 API).
// AC-APPLY-003(로컬 API 부분): 익명·관리자 모두 생성·수정·삭제 거부, 신청 읽기는 관리자만, 시도 기록은 아무도 못 읽음.
// REST·GraphQL 부분은 M5 E2E에서, 관리자 화면 확인은 수동으로 한다.
// 접근 규칙을 적용하려면 로컬 API에 overrideAccess: false를 꼭 넘긴다(기본값 true).
import { randomBytes, randomUUID } from 'node:crypto'

import { Forbidden, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '../../src/payload.config'
import type { User } from '../../src/payload-types'
import { applicationInput } from '../helpers/application-fixtures'
import { daysFromNow, newMarker, tourInput } from '../helpers/catalog-fixtures'

const marker = newMarker()
const adminEmail = `access-${randomUUID()}@example.test`
// 시도 기록 키 해시 자리에 넣는 무작위 64자 16진수(원문 IP가 아님)
const attemptKey = randomBytes(32).toString('hex')
let payload: Payload
let admin: User

const fixture = {} as { tourId: number; sessionId: number; applicationId: number; attemptId: number }

const ANON = { overrideAccess: false } as const

function asAdmin() {
  return { overrideAccess: false, user: admin } as const
}

async function snapshot() {
  const application = await payload.findByID({ collection: 'applications', id: fixture.applicationId, depth: 0 })
  const attempt = await payload.findByID({ collection: 'application-attempts', id: fixture.attemptId })
  const applications = await payload.count({ collection: 'applications', where: { email: { like: marker } } })
  const attempts = await payload.count({
    collection: 'application-attempts',
    where: { keyHash: { equals: attemptKey } },
  })
  return {
    application: { status: application.status, name: application.name, partySize: application.partySize },
    attempt: { keyHash: attempt.keyHash, attemptedAt: attempt.attemptedAt },
    applications: applications.totalDocs,
    attempts: attempts.totalDocs,
  }
}

describe('신청 접근 규칙(실제 DB)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    admin = await payload.create({ collection: 'users', data: { email: adminEmail, password: `pw-${randomUUID()}` } })

    const tour = await payload.create({
      collection: 'tours',
      data: tourInput(`${marker}-access`, { published: true }) as never,
    })
    const session = await payload.create({
      collection: 'tour-sessions',
      data: { tour: tour.id, startsAt: daysFromNow(3), endsAt: daysFromNow(3, 4), capacity: 10 } as never,
    })
    const application = await payload.create({
      collection: 'applications',
      data: applicationInput(session.id, marker) as never,
    })
    const attempt = await payload.create({
      collection: 'application-attempts',
      data: { keyHash: attemptKey, attemptedAt: new Date().toISOString() },
    })
    Object.assign(fixture, {
      tourId: tour.id,
      sessionId: session.id,
      applicationId: application.id,
      attemptId: attempt.id,
    })
  })

  afterAll(async () => {
    if (payload === undefined) return
    // 한 단계가 실패해도 나머지 정리는 계속하고, 마지막에 첫 실패를 다시 던진다.
    // 순서: 신청 시도 기록 → 신청 → 회차 → 투어 → 테스트 관리자(plan.md §B.9)
    const failures: unknown[] = []
    const step = async (run: () => Promise<unknown>) => {
      try {
        await run()
      } catch (error) {
        failures.push(error)
      }
    }
    await step(() => payload.delete({ collection: 'application-attempts', where: { keyHash: { equals: attemptKey } } }))
    await step(() => payload.delete({ collection: 'applications', where: { email: { like: marker } } }))
    await step(async () => {
      const tours = await payload.find({ collection: 'tours', where: { slug: { like: marker } }, pagination: false })
      const tourIds = tours.docs.map((tour) => tour.id)
      if (tourIds.length > 0) {
        await payload.delete({ collection: 'tour-sessions', where: { tour: { in: tourIds } } })
        await payload.delete({ collection: 'tours', where: { id: { in: tourIds } } })
      }
    })
    await step(() => payload.delete({ collection: 'users', where: { email: { equals: adminEmail } } }))
    await payload.destroy()
    if (failures.length > 0) throw failures[0]
  })

  describe('쓰기 거부(익명과 관리자 모두)', () => {
    it.each([
      ['익명', () => ANON],
      ['관리자', asAdmin],
    ])('%s의 applications 생성·수정·삭제는 모두 권한 오류이고 문서 수와 값이 그대로다', async (_label, context) => {
      const before = await snapshot()
      const email = `${marker}-denied@example.test`

      await expect(
        payload.create({
          collection: 'applications',
          data: applicationInput(fixture.sessionId, marker, { email }) as never,
          ...context(),
        }),
      ).rejects.toBeInstanceOf(Forbidden)
      await expect(
        payload.update({
          collection: 'applications',
          id: fixture.applicationId,
          data: { status: 'confirmed' },
          ...context(),
        }),
      ).rejects.toBeInstanceOf(Forbidden)
      await expect(
        payload.delete({ collection: 'applications', id: fixture.applicationId, ...context() }),
      ).rejects.toBeInstanceOf(Forbidden)

      expect(await snapshot()).toEqual(before)
      expect((await payload.count({ collection: 'applications', where: { email: { equals: email } } })).totalDocs).toBe(
        0,
      )
    })

    it.each([
      ['익명', () => ANON],
      ['관리자', asAdmin],
    ])(
      '%s의 application-attempts 생성·수정·삭제는 모두 권한 오류이고 문서 수와 값이 그대로다',
      async (_label, context) => {
        const before = await snapshot()

        await expect(
          payload.create({
            collection: 'application-attempts',
            data: { keyHash: attemptKey, attemptedAt: new Date().toISOString() },
            ...context(),
          }),
        ).rejects.toBeInstanceOf(Forbidden)
        await expect(
          payload.update({
            collection: 'application-attempts',
            id: fixture.attemptId,
            data: { attemptedAt: daysFromNow(-1) },
            ...context(),
          }),
        ).rejects.toBeInstanceOf(Forbidden)
        await expect(
          payload.delete({ collection: 'application-attempts', id: fixture.attemptId, ...context() }),
        ).rejects.toBeInstanceOf(Forbidden)

        expect(await snapshot()).toEqual(before)
      },
    )
  })

  describe('읽기 범위', () => {
    it('익명의 applications 조회는 권한 오류이고, 관리자의 조회 결과에는 준비한 신청이 있다', async () => {
      await expect(
        payload.find({ collection: 'applications', where: { email: { like: marker } }, ...ANON }),
      ).rejects.toBeInstanceOf(Forbidden)
      await expect(
        payload.findByID({ collection: 'applications', id: fixture.applicationId, ...ANON }),
      ).rejects.toBeInstanceOf(Forbidden)

      const result = await payload.find({
        collection: 'applications',
        where: { email: { like: marker } },
        depth: 0,
        ...asAdmin(),
      })
      expect(result.docs.map((doc) => doc.id)).toEqual([fixture.applicationId])
    })

    it.each([
      ['익명', () => ANON],
      ['관리자', asAdmin],
    ])('%s의 application-attempts 조회는 권한 오류다', async (_label, context) => {
      // 대상 존재 단언: 접근 규칙 없이 읽으면 준비한 기록이 있다
      const exists = await payload.count({
        collection: 'application-attempts',
        where: { keyHash: { equals: attemptKey } },
      })
      expect(exists.totalDocs).toBe(1)

      await expect(
        payload.find({ collection: 'application-attempts', where: { keyHash: { equals: attemptKey } }, ...context() }),
      ).rejects.toBeInstanceOf(Forbidden)
      await expect(
        payload.findByID({ collection: 'application-attempts', id: fixture.attemptId, ...context() }),
      ).rejects.toBeInstanceOf(Forbidden)
    })
  })

  describe('관리자 화면 노출 설정', () => {
    it('application-attempts는 관리자 화면 메뉴에서 숨겨지고 applications는 보인다', () => {
      const bySlug = new Map(payload.config.collections.map((collection) => [collection.slug, collection]))
      expect(bySlug.get('application-attempts')?.admin.hidden).toBe(true)
      expect(bySlug.get('applications')?.admin.hidden ?? false).toBe(false)
    })
  })
})
