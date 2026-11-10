// SPEC-TOUR-001 M3 — 사용자 화면 조회 계층(src/lib/catalog.ts, 실제 DB).
// AC-TOUR-006(조회 계층 부분): 공개되지 않은 투어·회차·이미지가 목록·상세 어디에도 나오지 않고, 공개되지 않은 slug는 "없음".
// REQ-TOUR-007·009·010: 가장 가까운 회차, 목록 정렬, 상세 회차 목록(지난 회차 제외, 마감 포함·선택 불가).
// plan.md R1: 로컬 API 기본값 overrideAccess: true를 막으려고, 조회 계층의 모든 호출을 기록해 overrideAccess: false·사용자 없음을 확인한다.
// 개발 DB에 다른 공개 투어가 있을 수 있으므로 단언은 이 파일의 테스트 데이터 표식이 붙은 투어만 대상으로 한다(plan.md R15).
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { getTourDetailBySlug, listPublishedTours } from '../../src/lib/catalog'
import config from '../../src/payload.config'
import { daysFromNow, newMarker, pngFile, tourInput } from '../helpers/catalog-fixtures'

const marker = newMarker()
let payload: Payload

// 조회 계층에 넘기는 기록용 payload — find 호출 인자를 모아 두고 실제 payload에 그대로 넘긴다
type FindArgs = Parameters<Payload['find']>[0]
let findCalls: FindArgs[] = []
let recordingPayload: Payload

const ids = {} as Record<
  'imageOpen' | 'imageHidden' | 'open' | 'early' | 'noSessions' | 'closedOnly' | 'hidden',
  number
>
const slugs = {
  open: `${marker}-open`,
  early: `${marker}-early`,
  noSessions: `${marker}-no-sessions`,
  closedOnly: `${marker}-closed-only`,
  hidden: `${marker}-hidden`,
}

async function createTour(slug: string, title: string, overrides: Record<string, unknown> = {}) {
  const doc = await payload.create({
    collection: 'tours',
    data: tourInput(slug, { title, published: true, ...overrides }) as never,
  })
  return doc.id
}

async function createSession(tour: number, days: number, capacity: number, status: 'open' | 'closed' = 'open') {
  await payload.create({
    collection: 'tour-sessions',
    data: { tour, startsAt: daysFromNow(days), endsAt: daysFromNow(days, 3), capacity, status } as never,
  })
}

const mine = <T extends { slug: string }>(items: T[]) => items.filter((item) => item.slug.startsWith(marker))

describe('카탈로그 조회 계층(실제 DB)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    recordingPayload = new Proxy(payload, {
      get(target, property, receiver) {
        if (property === 'find') {
          return (args: FindArgs) => {
            findCalls.push(args)
            return target.find(args)
          }
        }
        return Reflect.get(target, property, receiver)
      },
    })

    ids.imageOpen = (
      await payload.create({
        collection: 'media',
        data: { alt: `${marker} 영실 능선` },
        file: pngFile(`${marker}-open.png`),
      })
    ).id
    ids.imageHidden = (
      await payload.create({
        collection: 'media',
        data: { alt: `${marker} 숨김 이미지` },
        file: pngFile(`${marker}-hidden.png`),
      })
    ).id

    // 제목 순과 시작 시각 순이 서로 반대가 되게 골라, 정렬이 시작 시각 기준임을 드러낸다
    ids.open = await createTour(slugs.open, `${marker} 라 모집 중`, { heroImage: ids.imageOpen })
    ids.early = await createTour(slugs.early, `${marker} 마 가장 이른`)
    ids.noSessions = await createTour(slugs.noSessions, `${marker} 다 회차 없음`)
    ids.closedOnly = await createTour(slugs.closedOnly, `${marker} 나 마감만`)
    ids.hidden = await createTour(slugs.hidden, `${marker} 가 숨김`, { published: false, heroImage: ids.imageHidden })

    // AC-TOUR-010·011과 같은 모양: +2일 정원 11, +3일 마감 정원 13, +5일 정원 12, 지난 회차 −2일 정원 19
    await createSession(ids.open, 2, 11)
    await createSession(ids.open, 3, 13, 'closed')
    await createSession(ids.open, 5, 12)
    await createSession(ids.open, -2, 19)
    await createSession(ids.early, 1, 8)
    await createSession(ids.closedOnly, 4, 9, 'closed')
    // 공개되지 않은 투어의 회차 — 가장 이르지만 어디에도 나오면 안 된다
    await createSession(ids.hidden, 1, 7)
  })

  beforeEach(() => {
    findCalls = []
  })

  afterAll(async () => {
    if (payload === undefined) return
    // 한 단계가 실패해도 나머지 정리는 계속한다. 순서는 회차 → 투어 → 미디어(plan.md R8)
    const failures: unknown[] = []
    const step = async (run: () => Promise<unknown>) => {
      try {
        await run()
      } catch (error) {
        failures.push(error)
      }
    }
    await step(async () => {
      const tours = await payload.find({ collection: 'tours', where: { slug: { like: marker } }, pagination: false })
      const tourIds = tours.docs.map((tour) => tour.id)
      if (tourIds.length > 0) {
        await payload.delete({ collection: 'tour-sessions', where: { tour: { in: tourIds } } })
        await payload.delete({ collection: 'tours', where: { id: { in: tourIds } } })
      }
    })
    await step(() => payload.delete({ collection: 'media', where: { filename: { like: marker } } }))
    await payload.destroy()
    if (failures.length > 0) throw failures[0]
  })

  describe('목록 조회 listPublishedTours', () => {
    it('공개 투어만 돌려주고, 공개되지 않은 투어는 없다(AC-TOUR-006)', async () => {
      const tours = mine(await listPublishedTours(recordingPayload))
      expect(tours.map((tour) => tour.slug).sort()).toEqual(
        [slugs.open, slugs.early, slugs.noSessions, slugs.closedOnly].sort(),
      )
      expect(tours.some((tour) => tour.id === ids.hidden)).toBe(false)
    })

    it('선택 가능한 회차가 있는 투어가 먼저(가장 가까운 회차 순), 나머지는 제목 순', async () => {
      const tours = mine(await listPublishedTours(recordingPayload))
      expect(tours.map((tour) => tour.slug)).toEqual([slugs.early, slugs.open, slugs.closedOnly, slugs.noSessions])
    })

    it('가장 가까운 회차는 선택 가능한 회차 중 가장 이른 것이고, 남은 자리 = 정원(점유 0)', async () => {
      const tours = mine(await listPublishedTours(recordingPayload))
      const open = tours.find((tour) => tour.slug === slugs.open)
      expect(open?.nearestSession?.capacity).toBe(11)
      expect(open?.nearestSession?.availability).toEqual({
        capacity: 11,
        remainingSeats: 11,
        selectable: true,
        reason: null,
      })
      expect(tours.find((tour) => tour.slug === slugs.early)?.nearestSession?.capacity).toBe(8)
      // 마감 회차만 있거나 회차가 없으면 가장 가까운 회차가 없다("모집 마감")
      expect(tours.find((tour) => tour.slug === slugs.closedOnly)?.nearestSession).toBeNull()
      expect(tours.find((tour) => tour.slug === slugs.noSessions)?.nearestSession).toBeNull()
    })

    it('카드 표시 값과 대표 이미지(대체 텍스트·주소)를 담고, 이미지가 없으면 null', async () => {
      const tours = mine(await listPublishedTours(recordingPayload))
      const open = tours.find((tour) => tour.slug === slugs.open)
      expect(open).toMatchObject({
        title: `${marker} 라 모집 중`,
        summary: `${slugs.open} 요약`,
        durationMinutes: 270,
        priceNote: '45,000원 · 현장 결제',
      })
      expect(open?.heroImage?.alt).toBe(`${marker} 영실 능선`)
      expect(open?.heroImage?.url).toContain(`${marker}-open`)
      expect(open?.heroImage?.width).toBe(1)
      expect(tours.find((tour) => tour.slug === slugs.noSessions)?.heroImage).toBeNull()
    })

    it('기준 시각(now)을 넘기면 그 시각 기준으로 판정한다 — 모든 회차가 지난 시각이면 가장 가까운 회차가 없다', async () => {
      const tours = mine(
        await listPublishedTours(recordingPayload, { now: new Date(Date.now() + 30 * 24 * 3600 * 1000) }),
      )
      expect(tours.every((tour) => tour.nearestSession === null)).toBe(true)
      // 모두 "모집 마감"이 되므로 제목 순(나 → 다 → 라 → 마)
      expect(tours.map((tour) => tour.slug)).toEqual([slugs.closedOnly, slugs.noSessions, slugs.open, slugs.early])
    })
  })

  describe('상세 조회 getTourDetailBySlug', () => {
    it('예정 회차를 시작 시각 순으로 돌려주고, 지난 회차는 빼며, 마감 회차는 선택 불가로 담는다', async () => {
      const detail = await getTourDetailBySlug(recordingPayload, slugs.open)
      expect(detail).not.toBeNull()
      expect(detail?.sessions.map((session) => session.capacity)).toEqual([11, 13, 12])
      expect(detail?.sessions.map((session) => session.availability.selectable)).toEqual([true, false, true])
      expect(detail?.sessions[1]?.availability.reason).toBe('closed')
      expect(detail?.sessions.some((session) => session.capacity === 19)).toBe(false)
    })

    it('상세 표시 값(설명·집결 장소·대표 이미지)을 담는다', async () => {
      const detail = await getTourDetailBySlug(recordingPayload, slugs.open)
      expect(detail).toMatchObject({
        id: ids.open,
        slug: slugs.open,
        description: `${slugs.open} 첫 문단\n\n두 번째 문단`,
        meetingPoint: `${slugs.open} 집결 장소`,
        durationMinutes: 270,
      })
      expect(detail?.heroImage?.alt).toBe(`${marker} 영실 능선`)
    })

    it('회차가 없는 공개 투어는 빈 회차 목록', async () => {
      const detail = await getTourDetailBySlug(recordingPayload, slugs.noSessions)
      expect(detail?.slug).toBe(slugs.noSessions)
      expect(detail?.sessions).toEqual([])
    })

    it('공개되지 않은 투어의 slug는 null(AC-TOUR-006)', async () => {
      expect(await getTourDetailBySlug(recordingPayload, slugs.hidden)).toBeNull()
    })

    it('없는 slug는 null', async () => {
      expect(await getTourDetailBySlug(recordingPayload, `${marker}-missing`)).toBeNull()
    })

    it('형식에 맞지 않는 slug는 DB를 조회하지 않고 null', async () => {
      expect(await getTourDetailBySlug(recordingPayload, 'Not_A_Slug')).toBeNull()
      expect(await getTourDetailBySlug(recordingPayload, '')).toBeNull()
      expect(findCalls).toHaveLength(0)
    })
  })

  describe('접근 규칙 적용(plan.md R1)', () => {
    it('목록·상세의 모든 조회가 overrideAccess: false이고 사용자·요청 객체를 넘기지 않는다', async () => {
      await listPublishedTours(recordingPayload)
      await getTourDetailBySlug(recordingPayload, slugs.open)
      await getTourDetailBySlug(recordingPayload, slugs.hidden)

      expect(findCalls.length).toBeGreaterThanOrEqual(4)
      for (const call of findCalls) {
        expect(call.overrideAccess).toBe(false)
        expect(call.user).toBeUndefined()
        expect(call.req).toBeUndefined()
      }
    })

    it('공개되지 않은 투어의 회차와 이미지는 목록·상세 결과 어디에도 없다', async () => {
      const list = await listPublishedTours(recordingPayload)
      const detail = await getTourDetailBySlug(recordingPayload, slugs.open)
      const serialized = JSON.stringify({ list, detail })
      expect(serialized).not.toContain(`${marker} 가 숨김`)
      expect(serialized).not.toContain(`${marker}-hidden`)
      expect(serialized).not.toContain(`${marker} 숨김 이미지`)
      // 숨김 투어의 회차(정원 7)도 나오지 않는다
      const sessions = [...mine(list).map((tour) => tour.nearestSession), ...(detail?.sessions ?? [])]
      expect(sessions.some((session) => session?.capacity === 7)).toBe(false)
    })
  })
})
