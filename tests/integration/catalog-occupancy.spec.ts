// SPEC-APPLY-001 M3 — 화면 조회 계층에 점유 인원 반영(실제 DB, AC-APPLY-005).
// 조회 계층(src/lib/catalog.ts)이 점유 인원 모듈(src/lib/occupancy.ts)의 합계를 단일 계산 지점(getSessionAvailability)에 넘기는지,
// 그리고 목록·상세 조회 한 번의 질의 수가 회차 수와 무관한지(회차마다 점유 인원을 따로 세지 않는지) 확인한다.
// 개발 DB에 다른 공개 투어가 있을 수 있으므로 단언은 이 파일의 테스트 데이터 표식이 붙은 투어만 대상으로 한다.
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getTourDetailBySlug, listPublishedTours } from '../../src/lib/catalog'
import { getOccupiedSeatsBySession } from '../../src/lib/occupancy'
import config from '../../src/payload.config'
import { applicationInput, cleanupMarkerData } from '../helpers/application-fixtures'
import { daysFromNow, newMarker, tourInput } from '../helpers/catalog-fixtures'

const marker = newMarker()
let payload: Payload

type ApplicationStatus = 'pending' | 'confirmed' | 'cancelled'

async function createTour(suffix: string): Promise<{ id: number; slug: string }> {
  const slug = `${marker}-${suffix}`
  const tour = await payload.create({ collection: 'tours', data: tourInput(slug, { published: true }) as never })
  return { id: tour.id, slug }
}

async function createSession(tour: number, days: number, capacity: number): Promise<number> {
  const session = await payload.create({
    collection: 'tour-sessions',
    data: { tour, startsAt: daysFromNow(days), endsAt: daysFromNow(days, 4), capacity, status: 'open' } as never,
  })
  return session.id
}

async function addApplications(sessionId: number, statuses: ApplicationStatus[]): Promise<void> {
  for (const status of statuses) {
    await payload.create({
      collection: 'applications',
      data: applicationInput(sessionId, marker, { partySize: 1, status }) as never,
    })
  }
}

type PoolCalls = { query: number; connect: number }
type CountablePool = { query: (...args: unknown[]) => unknown; connect: (...args: unknown[]) => unknown }

// 측정 구간 동안 연결 풀의 query·connect 호출 수를 센다. Pool.query는 내부에서 this.connect를 한 번 부르므로
// connect 수 = query 수이면 트랜잭션 등 직접 연결로 나간 질의가 없다는 뜻이다(plan.md §A.2·§B.2)
async function countPoolCalls(run: () => Promise<unknown>): Promise<PoolCalls> {
  const pool = (payload.db as unknown as { pool: CountablePool }).pool
  const originalQuery = pool.query
  const originalConnect = pool.connect
  const calls: PoolCalls = { query: 0, connect: 0 }
  pool.query = function (this: unknown, ...args: unknown[]) {
    calls.query += 1
    return originalQuery.apply(this, args)
  }
  pool.connect = function (this: unknown, ...args: unknown[]) {
    calls.connect += 1
    return originalConnect.apply(this, args)
  }
  try {
    await run()
  } finally {
    pool.query = originalQuery
    pool.connect = originalConnect
  }
  return calls
}

describe('조회 계층의 점유 인원 반영(실제 DB, AC-APPLY-005)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  afterAll(async () => {
    if (payload === undefined) return
    try {
      await cleanupMarkerData(payload, marker)
    } finally {
      await payload.destroy()
    }
  })

  describe('남은 자리 = 정원 − 점유 인원(대기·확정만, 취소 제외)', () => {
    let tour: { id: number; slug: string }
    let s1: number
    let s2: number
    let emptySession: number

    beforeAll(async () => {
      tour = await createTour('seats')
      s1 = await createSession(tour.id, 2, 5)
      s2 = await createSession(tour.id, 3, 3)
      emptySession = await createSession(tour.id, 4, 4)
      await addApplications(s1, ['pending', 'pending', 'confirmed', 'cancelled', 'cancelled'])
    })

    it('점유 인원 모듈: S1은 3(취소 2명 제외), 신청이 없는 회차는 0', async () => {
      const seats = await getOccupiedSeatsBySession(payload, [s1, emptySession])
      expect(seats.get(s1)).toBe(3)
      expect(seats.get(emptySession)).toBe(0)
    })

    it('목록의 가장 가까운 회차(S1)와 상세의 S1: 남은 자리 2 / 정원 5', async () => {
      const listed = (await listPublishedTours(payload)).find((item) => item.slug === tour.slug)
      expect(listed?.nearestSession?.id).toBe(s1)
      expect(listed?.nearestSession?.availability).toMatchObject({ remainingSeats: 2, capacity: 5, selectable: true })

      const detail = await getTourDetailBySlug(payload, tour.slug)
      const session = detail?.sessions.find((item) => item.id === s1)
      expect(session?.availability).toMatchObject({ remainingSeats: 2, capacity: 5, selectable: true, reason: null })
      expect(detail?.sessions.find((item) => item.id === emptySession)?.availability.remainingSeats).toBe(4)
    })

    it('정원 3인 S2에 대기 3명을 만들면 남은 자리 0, 선택 불가 사유 full', async () => {
      await addApplications(s2, ['pending', 'pending', 'pending'])

      const detail = await getTourDetailBySlug(payload, tour.slug)
      const session = detail?.sessions.find((item) => item.id === s2)
      expect(session?.availability).toEqual({ capacity: 3, remainingSeats: 0, selectable: false, reason: 'full' })
    })
  })

  it('질의 수: 회차 1개일 때와 6개일 때 목록·상세 조회의 질의 수가 각각 같고, 직접 연결 질의가 없다', async () => {
    const q = await createTour('query-count')
    await addApplications(await createSession(q.id, 2, 10), ['pending'])

    const listOne = await countPoolCalls(() => listPublishedTours(payload))
    const detailOne = await countPoolCalls(() => getTourDetailBySlug(payload, q.slug))

    for (const days of [3, 4, 5, 6, 7]) {
      await addApplications(await createSession(q.id, days, 10), ['pending'])
    }
    // 측정 대상이 실제로 회차 6개를 돌려주는지 먼저 확인한다(질의 수 비교가 빈 비교가 되지 않게)
    expect((await getTourDetailBySlug(payload, q.slug))?.sessions).toHaveLength(6)

    const listSix = await countPoolCalls(() => listPublishedTours(payload))
    const detailSix = await countPoolCalls(() => getTourDetailBySlug(payload, q.slug))

    expect(listOne.query).toBeGreaterThanOrEqual(1)
    expect(detailOne.query).toBeGreaterThanOrEqual(1)
    expect(listSix.query).toBe(listOne.query)
    expect(detailSix.query).toBe(detailOne.query)
    for (const calls of [listOne, detailOne, listSix, detailSix]) {
      expect(calls.connect).toBe(calls.query)
    }
  })
})
