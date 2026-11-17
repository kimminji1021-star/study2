// SPEC-LANDING-001 M1 — 홈 화면 데이터 함수(실제 DB).
// AC-LANDING-007(통합): 추천 투어 = listPublishedTours(같은 now) 앞 6개, 남은 자리 동일, 비공개 투어 제외.
// AC-LANDING-008: 질의 수가 공개 투어 수와 무관하고 연결 풀만 쓰며, 전역 설정 조회는 익명 규칙으로 한 번만 한다.
// 이 파일은 전역 설정을 바꾸지 않는다(바꾸는 시험은 home-settings.spec.ts에 모음 — plan.md §B.11).
// 개발 DB의 실제 공개 투어가 섞이므로 기대값은 같은 시점의 listPublishedTours 결과로 정한다.
// M3: 빈 추천 목록 렌더링(AC-LANDING-007 — 공유 개발 DB에서 E2E로 재현할 수 없어 서버 구성 요소를 직접 그린다, plan.md §G R14).
import { getPayload, type Payload } from 'payload'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { RecommendedTours } from '../../src/components/RecommendedTours'
import { listPublishedTours } from '../../src/lib/catalog'
import { getHomePageData } from '../../src/lib/home-page'
import config from '../../src/payload.config'
import { applicationInput, cleanupMarkerData } from '../helpers/application-fixtures'
import { daysFromNow, newMarker, pngFile, tourInput } from '../helpers/catalog-fixtures'

const marker = newMarker()
let payload: Payload

async function createMedia(name: string): Promise<number> {
  const doc = await payload.create({
    collection: 'media',
    data: { alt: `${marker}-${name}` },
    file: pngFile(`${marker}-${name}.png`),
  })
  return doc.id
}

async function createTour(suffix: string, published: boolean, heroImage?: number): Promise<number> {
  const tour = await payload.create({
    collection: 'tours',
    data: tourInput(`${marker}-${suffix}`, { published, ...(heroImage === undefined ? {} : { heroImage }) }) as never,
  })
  return tour.id
}

async function createSession(tour: number, days: number, hours = 0): Promise<number> {
  const session = await payload.create({
    collection: 'tour-sessions',
    data: {
      tour,
      startsAt: daysFromNow(days, hours),
      endsAt: daysFromNow(days, hours + 3),
      capacity: 8,
      status: 'open',
    } as never,
  })
  return session.id
}

type PoolCalls = { query: number; connect: number }
type CountablePool = { query: (...args: unknown[]) => unknown; connect: (...args: unknown[]) => unknown }

// 측정 구간 동안 연결 풀의 query·connect 호출 수를 센다(SPEC-ADMIN-001 AC-ADMIN-012와 같은 판정).
// Pool.query는 내부에서 this.connect를 한 번 부르므로 connect 수 = query 수이면 직접 연결(트랜잭션)로 나간 질의가 없다
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

describe('홈 화면 데이터(실제 DB)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  afterAll(async () => {
    if (payload === undefined) return
    try {
      await cleanupMarkerData(payload, marker)
      await payload.delete({ collection: 'media', where: { filename: { like: marker } } })
    } finally {
      await payload.destroy()
    }
  })

  describe('AC-LANDING-007 추천 투어(통합)', () => {
    let hiddenTour: number

    beforeAll(async () => {
      for (let index = 0; index < 7; index += 1) {
        const tour = await createTour(`pub-${index}`, true)
        await createSession(tour, 2 + index, index)
      }
      hiddenTour = await createTour('hidden', false)
      await createSession(hiddenTour, 2)
    })

    it('추천 투어가 같은 now의 listPublishedTours 앞 6개와 ID·순서·남은 자리까지 같고 비공개 투어가 없다', async () => {
      const now = new Date()
      const listed = await listPublishedTours(payload, { now })
      const home = await getHomePageData(payload, { now })

      expect(listed.length).toBeGreaterThanOrEqual(7)
      expect(home.recommendedTours).toHaveLength(6)
      expect(home.recommendedTours.map((tour) => tour.id)).toEqual(listed.slice(0, 6).map((tour) => tour.id))

      const listedById = new Map(listed.map((tour) => [tour.id, tour]))
      for (const tour of home.recommendedTours) {
        expect(tour.nearestSession?.availability).toEqual(listedById.get(tour.id)?.nearestSession?.availability)
      }
      expect(home.recommendedTours.map((tour) => tour.id)).not.toContain(hiddenTour)
    })

    it('큰 제목·소개는 비어 있으면 기본 문구, 아니면 공백을 뺀 문자열이다', async () => {
      const home = await getHomePageData(payload)
      expect(typeof home.headline).toBe('string')
      expect(home.headline.trim()).toBe(home.headline)
      expect(home.headline.length).toBeGreaterThan(0)
      expect(typeof home.intro).toBe('string')
      expect(home.intro.length).toBeGreaterThan(0)
    })
  })

  describe('AC-LANDING-007 추천 투어 영역 렌더링', () => {
    it('투어 0개이면 안내 문구와 /tours 링크가 있고 카드가 없다', () => {
      const html = renderToStaticMarkup(createElement(RecommendedTours, { tours: [] }))

      expect(html).toContain('지금은 공개된 투어가 없습니다.')
      expect(html).toContain('href="/tours"')
      expect(html).toContain('투어 전체 보기')
      expect(html).not.toContain('<article')
    })

    it('투어가 있으면 영역 제목 추천 투어는 h2이고 카드 제목은 h3이다', async () => {
      const tours = (await listPublishedTours(payload)).slice(0, 2)
      expect(tours.length, '공개 투어가 2개 이상 있어야 한다(위 준비 단계의 표식 투어)').toBe(2)

      const html = renderToStaticMarkup(createElement(RecommendedTours, { tours }))

      expect(html).toMatch(/<h2[^>]*>추천 투어<\/h2>/)
      expect(html.match(/<h2/g)).toHaveLength(1)
      expect(html.match(/<article/g)).toHaveLength(2)
      expect(html.match(/<h3/g)).toHaveLength(2)
      expect(html).not.toContain('지금은 공개된 투어가 없습니다.')
    })
  })

  describe('AC-LANDING-008 질의 수', () => {
    beforeAll(async () => {
      const q = await createTour('q', true, await createMedia('q'))
      await createSession(q, 3)
    })

    it('공개 투어 5개(대표 이미지·회차 2개·회차마다 대기 신청 1건)를 더해도 질의 수가 같고 연결 풀만 쓴다', async () => {
      await getHomePageData(payload) // 준비 실행(첫 호출의 초기화 질의를 측정에서 뺀다)
      const before = await countPoolCalls(() => getHomePageData(payload))

      for (let index = 0; index < 5; index += 1) {
        const tour = await createTour(`more-${index}`, true, await createMedia(`more-${index}`))
        for (const days of [4, 5]) {
          const session = await createSession(tour, days, index)
          await payload.create({
            collection: 'applications',
            data: applicationInput(session, marker, { partySize: 1, status: 'pending' }) as never,
          })
        }
      }

      const after = await countPoolCalls(() => getHomePageData(payload))
      expect(before.query).toBeGreaterThanOrEqual(1)
      expect(after.query).toBe(before.query)
      expect(before.connect).toBe(before.query)
      expect(after.connect).toBe(after.query)
    })

    it('req 없이 부른 home-settings 조회는 정확히 1회이고 overrideAccess: false, 사용자 없음이다', async () => {
      const spy = vi.spyOn(payload, 'findGlobal')
      try {
        await getHomePageData(payload)
        const own = spy.mock.calls
          .map(([options]) => options as unknown as Record<string, unknown>)
          .filter((options) => options.slug === 'home-settings' && options.req === undefined)
        expect(own).toHaveLength(1)
        expect(own[0].overrideAccess).toBe(false)
        expect(own[0].user).toBeUndefined()
      } finally {
        spy.mockRestore()
      }
    })
  })
})
