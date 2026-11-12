// SPEC-APPLY-001 M1 — Applications 필드 검증, 이메일 표본 일관성, 신청이 있는 회차의 삭제 거부(실제 DB, Payload 로컬 API).
// AC-APPLY-002(필드 검증·입력 규칙 일관성), AC-APPLY-004(삭제 거부).
// 로컬 API 기본값(overrideAccess: true)은 서버 제출 경로와 같은 권한이다.
// 정리 순서: 신청 → 회차 → 투어(plan.md §B.9). 신청 삭제는 접근 규칙이 막으므로 로컬 API 기본값으로 지운다.
import { randomUUID } from 'node:crypto'

import { getPayload, ValidationError, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { checkEmail } from '../../src/lib/application-input'
import config from '../../src/payload.config'
import type { User } from '../../src/payload-types'
import { applicationInput, emailSamples, testReferenceCode } from '../helpers/application-fixtures'
import { daysFromNow, newMarker, tourInput } from '../helpers/catalog-fixtures'

const marker = newMarker()
const adminEmail = `applications-${randomUUID()}@example.test`
let payload: Payload
let admin: User

// 잘못된 모양의 입력도 일부러 넘기므로 타입 검사를 한 곳에서만 우회한다
function createApplication(data: Record<string, unknown>) {
  return payload.create({ collection: 'applications', data: data as never })
}

async function createTourWithSession(suffix: string, capacity: number) {
  const tour = await payload.create({
    collection: 'tours',
    data: tourInput(`${marker}-${suffix}`, { published: true }) as never,
  })
  const session = await payload.create({
    collection: 'tour-sessions',
    data: { tour: tour.id, startsAt: daysFromNow(3), endsAt: daysFromNow(3, 4), capacity } as never,
  })
  return { tourId: tour.id, sessionId: session.id }
}

async function countApplications(sessionId: number): Promise<number> {
  const result = await payload.count({ collection: 'applications', where: { session: { equals: sessionId } } })
  return result.totalDocs
}

async function cleanup(): Promise<void> {
  const tours = await payload.find({
    collection: 'tours',
    where: { slug: { like: marker } },
    pagination: false,
    depth: 0,
  })
  const tourIds = tours.docs.map((tour) => tour.id)
  const sessions =
    tourIds.length > 0
      ? await payload.find({
          collection: 'tour-sessions',
          where: { tour: { in: tourIds } },
          pagination: false,
          depth: 0,
        })
      : { docs: [] }
  const sessionIds = sessions.docs.map((session) => session.id)
  await payload.delete({
    collection: 'applications',
    where: {
      or: [{ email: { like: marker } }, ...(sessionIds.length > 0 ? [{ session: { in: sessionIds } }] : [])],
    },
  })
  if (tourIds.length > 0) {
    await payload.delete({ collection: 'tour-sessions', where: { tour: { in: tourIds } } })
    await payload.delete({ collection: 'tours', where: { id: { in: tourIds } } })
  }
}

describe('Applications 컬렉션 검증(실제 DB)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    admin = await payload.create({ collection: 'users', data: { email: adminEmail, password: `pw-${randomUUID()}` } })
  })

  afterAll(async () => {
    if (payload === undefined) return
    try {
      await cleanup()
    } finally {
      try {
        // 테스트 관리자 계정은 정리 실패와 관계없이 항상 지운다
        await payload.delete({ collection: 'users', where: { email: { equals: adminEmail } } })
      } finally {
        await payload.destroy()
      }
    }
  })

  describe('AC-APPLY-002 필드 검증', () => {
    let sessionId: number

    beforeAll(async () => {
      ;({ sessionId } = await createTourWithSession('fields', 50))
    })

    it('필수 값을 모두 갖춘 신청은 저장되고, 상태를 지정하지 않으면 pending이다', async () => {
      const doc = await createApplication(applicationInput(sessionId, marker))

      expect(doc.status).toBe('pending')
      expect(doc.partySize).toBe(2)
      const reread = await payload.findByID({ collection: 'applications', id: doc.id, depth: 0 })
      expect(reread.session).toBe(sessionId)
      expect(reread.requestsConsentAt ?? null).toBeNull()
      expect(reread.cancelledAt ?? null).toBeNull()
    })

    it.each([0, 11, 1.5])('인원 %d는 검증 오류로 끝나고 문서가 생기지 않는다', async (partySize) => {
      const before = await countApplications(sessionId)

      await expect(createApplication(applicationInput(sessionId, marker, { partySize }))).rejects.toBeInstanceOf(
        ValidationError,
      )

      expect(await countApplications(sessionId)).toBe(before)
    })

    it.each([1, 10])('인원 %d는 저장된다', async (partySize) => {
      const doc = await createApplication(applicationInput(sessionId, marker, { partySize }))
      expect(doc.partySize).toBe(partySize)
    })

    it('요청 사항 501자는 검증 오류이고 500자는 저장된다', async () => {
      const before = await countApplications(sessionId)
      await expect(
        createApplication(applicationInput(sessionId, marker, { requests: 'x'.repeat(501) })),
      ).rejects.toBeInstanceOf(ValidationError)
      expect(await countApplications(sessionId)).toBe(before)

      const doc = await createApplication(applicationInput(sessionId, marker, { requests: 'x'.repeat(500) }))
      expect(doc.requests).toHaveLength(500)
    })

    it.each([
      'session',
      'name',
      'email',
      'phone',
      'partySize',
      'referenceCode',
      'privacyConsentAt',
      'privacyPolicyVersion',
    ])('필수 값 %s가 빠지면 검증 오류로 끝나고 문서가 생기지 않는다', async (field) => {
      const before = await countApplications(sessionId)
      const data = applicationInput(sessionId, marker)
      delete data[field]

      await expect(createApplication(data)).rejects.toBeInstanceOf(ValidationError)

      expect(await countApplications(sessionId)).toBe(before)
    })

    it('이미 쓰인 접수 번호로 두 번째 신청을 만들면 오류로 끝나고 그 접수 번호의 문서가 하나만 남는다', async () => {
      const referenceCode = testReferenceCode()
      await createApplication(applicationInput(sessionId, marker, { referenceCode }))

      await expect(createApplication(applicationInput(sessionId, marker, { referenceCode }))).rejects.toThrow()

      const result = await payload.count({
        collection: 'applications',
        where: { referenceCode: { equals: referenceCode } },
      })
      expect(result.totalDocs).toBe(1)
    })

    it.each(['SB-ABCDI-00000', 'sb-abcde-fghjk', '12345'])(
      '형식이 틀린 접수 번호 %s는 검증 오류다(M2 접수 번호 모듈의 형식 검사)',
      async (referenceCode) => {
        const before = await countApplications(sessionId)
        await expect(createApplication(applicationInput(sessionId, marker, { referenceCode }))).rejects.toBeInstanceOf(
          ValidationError,
        )
        expect(await countApplications(sessionId)).toBe(before)
      },
    )

    it('이름이 공백뿐이거나 제어 문자를 담거나, 연락처 형식이 틀리면 검증 오류다', async () => {
      const before = await countApplications(sessionId)
      for (const overrides of [{ name: '   ' }, { name: `${marker}\u0000` }, { phone: '1234567' }]) {
        await expect(createApplication(applicationInput(sessionId, marker, overrides))).rejects.toBeInstanceOf(
          ValidationError,
        )
      }
      expect(await countApplications(sessionId)).toBe(before)
    })
  })

  describe('AC-APPLY-002 이메일 표본 일관성(서버 입력 검증 함수 ↔ 컬렉션 email 필드)', () => {
    const samples = emailSamples(marker)
    let sessionId: number

    beforeAll(async () => {
      ;({ sessionId } = await createTourWithSession('email', 50))
    })

    it.each(samples.accepted)('입력 검증 함수가 받는 %s는 컬렉션 저장도 성공한다', async (email) => {
      // 저장하는 표본은 모두 표식을 담고 example.test로 끝난다(정리 조건)
      expect(email).toContain(marker)
      expect(email.endsWith('example.test')).toBe(true)
      expect(checkEmail(email)).toBeNull()

      const doc = await createApplication(applicationInput(sessionId, marker, { email }))
      expect(doc.email).toBe(email)
    })

    it.each(samples.rejected)('입력 검증 함수는 %s를 EMAIL_INVALID로 거부한다(저장하지 않음)', (email) => {
      expect(checkEmail(email)).toBe('EMAIL_INVALID')
    })
  })

  describe('AC-APPLY-004 신청이 있는 회차의 삭제 거부', () => {
    it('신청이 있으면 관리자도 회차를 지울 수 없고, 신청을 먼저 지우면 지울 수 있다', async () => {
      const { sessionId } = await createTourWithSession('guarded', 5)
      const application = await createApplication(applicationInput(sessionId, marker))
      const asAdmin = { overrideAccess: false, user: admin } as const

      await expect(payload.delete({ collection: 'tour-sessions', id: sessionId, ...asAdmin })).rejects.toThrow(
        'Cannot delete a session that has applications',
      )

      // 회차와 신청이 모두 그대로 있다
      await expect(payload.findByID({ collection: 'tour-sessions', id: sessionId })).resolves.toMatchObject({
        id: sessionId,
      })
      await expect(payload.findByID({ collection: 'applications', id: application.id })).resolves.toMatchObject({
        id: application.id,
      })

      await payload.delete({ collection: 'applications', id: application.id })
      await expect(payload.delete({ collection: 'tour-sessions', id: sessionId, ...asAdmin })).resolves.toMatchObject({
        id: sessionId,
      })
      expect(
        (await payload.count({ collection: 'tour-sessions', where: { id: { equals: sessionId } } })).totalDocs,
      ).toBe(0)
    })
  })
})
