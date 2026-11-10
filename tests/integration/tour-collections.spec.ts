// SPEC-TOUR-001 M1 — Tours·TourSessions 필드 검증과 회차가 있는 투어의 삭제 거부(실제 DB, Payload 로컬 API).
// AC-TOUR-003(투어 검증), AC-TOUR-004(회차 검증·일시 저장), AC-TOUR-007(삭제 거부).
// 테스트가 만든 데이터는 afterAll에서 회차 → 투어 순서로 지운다(plan.md R8).
import { getPayload, ValidationError, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '../../src/payload.config'
import { newMarker, pngFile, tourInput } from '../helpers/catalog-fixtures'

const marker = newMarker()
let payload: Payload

// 잘못된 모양의 입력도 일부러 넘기므로 타입 검사를 한 곳에서만 우회한다
function createTour(data: Record<string, unknown>) {
  return payload.create({ collection: 'tours', data: data as never })
}

function createSession(data: Record<string, unknown>) {
  return payload.create({ collection: 'tour-sessions', data: data as never })
}

async function countTours(slugPrefix: string): Promise<number> {
  const result = await payload.count({ collection: 'tours', where: { slug: { like: slugPrefix } } })
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
  if (tourIds.length > 0) {
    await payload.delete({ collection: 'tour-sessions', where: { tour: { in: tourIds } } })
    await payload.delete({ collection: 'tours', where: { id: { in: tourIds } } })
  }
  await payload.delete({ collection: 'media', where: { alt: { like: marker } } })
}

describe('Tours·TourSessions 컬렉션 검증(실제 DB)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  afterAll(async () => {
    if (payload === undefined) return
    try {
      await cleanup()
    } finally {
      await payload.destroy()
    }
  })

  describe('AC-TOUR-003 Tours 필드 검증', () => {
    it('필수 값이 모두 있고 대표 이미지가 없는 투어는 저장되며 공개 여부 기본값은 false다', async () => {
      const slug = `${marker}-basic`
      const tour = await createTour(tourInput(slug))

      expect(tour.slug).toBe(slug)
      expect(tour.published).toBe(false)
      expect(tour.heroImage ?? null).toBeNull()
    })

    it.each(['Test-Upper', 'test_under', '-test', 'test-', 'test--double', '테스트', ''])(
      'slug %j는 검증 오류로 끝나고 문서가 생기지 않는다',
      async (badSlug) => {
        // 다른 필수 값은 표식을 붙여 두어 남더라도 찾을 수 있게 한다
        const before = await payload.count({ collection: 'tours' })

        await expect(createTour(tourInput(badSlug, { title: `${marker} bad slug` }))).rejects.toBeInstanceOf(
          ValidationError,
        )

        const after = await payload.count({ collection: 'tours' })
        expect(after.totalDocs).toBe(before.totalDocs)
      },
    )

    it('이미 쓰인 slug로 두 번째 투어를 만들면 오류로 끝나고 문서가 하나만 남는다', async () => {
      const slug = `${marker}-dup`
      await createTour(tourInput(slug))

      await expect(createTour(tourInput(slug))).rejects.toThrow()

      expect(await countTours(slug)).toBe(1)
    })

    it.each([0, -30, 1.5])('소요 시간 %d는 검증 오류다', async (durationMinutes) => {
      const slug = `${marker}-dur-${String(durationMinutes).replace(/\D/g, 'x')}`

      await expect(createTour(tourInput(slug, { durationMinutes }))).rejects.toBeInstanceOf(ValidationError)
      expect(await countTours(slug)).toBe(0)
    })

    it('소요 시간 1은 저장된다', async () => {
      const tour = await createTour(tourInput(`${marker}-dur-one`, { durationMinutes: 1 }))
      expect(tour.durationMinutes).toBe(1)
    })

    it.each(['title', 'slug', 'summary', 'description', 'durationMinutes', 'meetingPoint', 'priceNote'])(
      '필수 값 %s가 빠지면 검증 오류로 끝난다',
      async (field) => {
        const slug = `${marker}-missing-${field.toLowerCase()}`
        const input = tourInput(slug)
        delete input[field]

        await expect(createTour(input)).rejects.toBeInstanceOf(ValidationError)
        expect(await countTours(slug)).toBe(0)
      },
    )

    it('대표 이미지에 media 문서를 연결하면 저장되고 다시 읽으면 그 문서를 가리킨다', async () => {
      const media = await payload.create({
        collection: 'media',
        data: { alt: `${marker} hero` },
        file: pngFile(`${marker}-hero.png`),
      })
      const tour = await createTour(tourInput(`${marker}-hero`, { heroImage: media.id }))

      const reread = await payload.findByID({ collection: 'tours', id: tour.id, depth: 0 })
      expect(reread.heroImage).toBe(media.id)
    })
  })

  describe('AC-TOUR-004 TourSessions 필드 검증과 일시 저장', () => {
    const start = '2026-11-20T00:00:00.000Z'
    const end = '2026-11-20T04:30:00.000Z'
    let tourId: number

    beforeAll(async () => {
      const tour = await createTour(tourInput(`${marker}-sessions`))
      tourId = tour.id
    })

    async function countSessions(): Promise<number> {
      const result = await payload.count({ collection: 'tour-sessions', where: { tour: { equals: tourId } } })
      return result.totalDocs
    }

    it.each([
      ['같으면', start],
      ['앞서면', '2026-11-19T23:00:00.000Z'],
    ])('새로 만들 때 종료 일시가 시작 일시와 %s 검증 오류로 끝나고 문서가 생기지 않는다', async (_label, endsAt) => {
      const before = await countSessions()

      await expect(createSession({ tour: tourId, startsAt: start, endsAt, capacity: 10 })).rejects.toBeInstanceOf(
        ValidationError,
      )

      expect(await countSessions()).toBe(before)
    })

    it('기존 회차의 종료 일시만 시작 일시 이전으로 바꾸면 검증 오류로 끝나고 값이 그대로다', async () => {
      const session = await createSession({ tour: tourId, startsAt: start, endsAt: end, capacity: 10 })

      await expect(
        payload.update({ collection: 'tour-sessions', id: session.id, data: { endsAt: '2026-11-19T23:00:00.000Z' } }),
      ).rejects.toBeInstanceOf(ValidationError)

      const reread = await payload.findByID({ collection: 'tour-sessions', id: session.id })
      expect(new Date(reread.endsAt).toISOString()).toBe(end)
    })

    it.each([0, -1, 1.5])('정원 %d는 검증 오류다', async (capacity) => {
      const before = await countSessions()

      await expect(createSession({ tour: tourId, startsAt: start, endsAt: end, capacity })).rejects.toBeInstanceOf(
        ValidationError,
      )

      expect(await countSessions()).toBe(before)
    })

    it('정원 1은 저장되고, 상태를 지정하지 않으면 모집 중(open)이다', async () => {
      const session = await createSession({ tour: tourId, startsAt: start, endsAt: end, capacity: 1 })

      expect(session.capacity).toBe(1)
      expect(session.status).toBe('open')
    })

    it('소속 투어가 없으면 검증 오류로 끝난다', async () => {
      await expect(createSession({ startsAt: start, endsAt: end, capacity: 5 })).rejects.toBeInstanceOf(ValidationError)
    })

    it('시작 일시 2026-11-20T00:00:00.000Z로 만든 회차를 다시 읽으면 같은 순간(UTC)을 가리킨다', async () => {
      const session = await createSession({ tour: tourId, startsAt: start, endsAt: end, capacity: 3 })

      const reread = await payload.findByID({ collection: 'tour-sessions', id: session.id })
      expect(new Date(reread.startsAt).toISOString()).toBe(start)
    })
  })

  describe('AC-TOUR-007 회차가 있는 투어의 삭제 거부', () => {
    it('회차가 있으면 관리자도 투어를 지울 수 없고, 회차를 먼저 지우면 지울 수 있다', async () => {
      const tour = await createTour(tourInput(`${marker}-guarded`))
      const session = await createSession({
        tour: tour.id,
        startsAt: '2026-11-20T00:00:00.000Z',
        endsAt: '2026-11-20T04:00:00.000Z',
        capacity: 5,
      })

      await expect(payload.delete({ collection: 'tours', id: tour.id })).rejects.toThrow(
        'Cannot delete a tour that has sessions',
      )

      // 투어와 회차가 모두 그대로 있다
      await expect(payload.findByID({ collection: 'tours', id: tour.id })).resolves.toMatchObject({ id: tour.id })
      await expect(payload.findByID({ collection: 'tour-sessions', id: session.id })).resolves.toMatchObject({
        id: session.id,
      })

      await payload.delete({ collection: 'tour-sessions', id: session.id })
      await expect(payload.delete({ collection: 'tours', id: tour.id })).resolves.toMatchObject({ id: tour.id })
      expect(await countTours(`${marker}-guarded`)).toBe(0)
    })
  })
})
