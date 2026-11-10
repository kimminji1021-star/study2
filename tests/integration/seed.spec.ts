// SPEC-TOUR-001 M5 — 개발용 시드 로직(src/lib/seed.ts, 실제 DB).
// AC-TOUR-016: 테스트 데이터 표식을 붙인 데이터 집합으로 시드 로직을 2번 실행하면 두 번째는 전부 건너뛰고 투어·회차 수가 그대로이며,
// 첫 실행 뒤 관리자가 바꾼 제목이 두 번째 실행 뒤에도 유지된다. 실제 시드 slug는 만들지 않는다(plan.md §B.9).
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '../../src/payload.config'
import { runSeed, seoulDateAt, type SeedTour } from '../../src/lib/seed'
import { newMarker } from '../helpers/catalog-fixtures'

const marker = newMarker()
// 실행 시각 하나로 고정해 회차 일시를 정확히 비교한다
const now = new Date()
let payload: Payload

function seedTour(name: string, sessions: SeedTour['sessions']): SeedTour {
  return {
    title: `${marker} ${name}`,
    slug: `${marker}-${name}`,
    summary: `${name} 요약`,
    description: `${name} 첫 문단\n\n두 번째 문단`,
    durationMinutes: 150,
    meetingPoint: `${name} 집결 장소`,
    priceNote: '45,000원 · 현장 결제',
    sessions,
  }
}

const dataset: SeedTour[] = [
  seedTour('alpha', [
    { dayOffset: 3, hour: 9, capacity: 15 },
    { dayOffset: 5, hour: 9, capacity: 15, status: 'closed' },
    { dayOffset: 10, hour: 9, capacity: 15 },
  ]),
  seedTour('beta', [
    { dayOffset: 3, hour: 9, capacity: 12 },
    { dayOffset: 10, hour: 9, capacity: 12 },
  ]),
]

async function countMine() {
  const tours = await payload.find({
    collection: 'tours',
    where: { slug: { like: marker } },
    pagination: false,
    depth: 0,
  })
  const ids = tours.docs.map((tour) => tour.id)
  const sessions =
    ids.length === 0
      ? 0
      : (await payload.count({ collection: 'tour-sessions', where: { tour: { in: ids } } })).totalDocs
  return { tours: tours.docs.length, sessions }
}

describe('개발용 시드 로직(실제 DB)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  afterAll(async () => {
    if (payload === undefined) return
    // 회차 → 투어 순서로 지운다(plan.md R8)
    try {
      const tours = await payload.find({ collection: 'tours', where: { slug: { like: marker } }, pagination: false })
      const ids = tours.docs.map((tour) => tour.id)
      if (ids.length > 0) {
        await payload.delete({ collection: 'tour-sessions', where: { tour: { in: ids } } })
        await payload.delete({ collection: 'tours', where: { id: { in: ids } } })
      }
    } finally {
      await payload.destroy()
    }
  })

  it('첫 실행은 투어를 공개 상태로, 회차를 서울 기준 일시와 상태대로 만든다', async () => {
    const result = await runSeed(payload, dataset, { now })

    expect(result).toEqual({ created: [dataset[0]!.slug, dataset[1]!.slug], skipped: [], sessionsCreated: 5 })
    expect(await countMine()).toEqual({ tours: 2, sessions: 5 })

    const alpha = (await payload.find({ collection: 'tours', where: { slug: { equals: dataset[0]!.slug } }, depth: 0 }))
      .docs[0]
    expect(alpha).toMatchObject({
      title: `${marker} alpha`,
      published: true,
      durationMinutes: 150,
      priceNote: '45,000원 · 현장 결제',
      meetingPoint: 'alpha 집결 장소',
    })
    expect(alpha?.heroImage ?? null).toBeNull()

    const sessions = await payload.find({
      collection: 'tour-sessions',
      where: { tour: { equals: alpha!.id } },
      sort: 'startsAt',
      depth: 0,
    })
    expect(sessions.docs.map((session) => new Date(session.startsAt).toISOString())).toEqual([
      seoulDateAt(now, 3, 9).toISOString(),
      seoulDateAt(now, 5, 9).toISOString(),
      seoulDateAt(now, 10, 9).toISOString(),
    ])
    expect(sessions.docs.map((session) => session.status)).toEqual(['open', 'closed', 'open'])
    expect(sessions.docs.map((session) => session.capacity)).toEqual([15, 15, 15])
    // 종료 = 시작 + 투어 소요 시간(150분)
    const first = sessions.docs[0]!
    expect(new Date(first.endsAt).getTime() - new Date(first.startsAt).getTime()).toBe(150 * 60 * 1000)
  })

  it('두 번째 실행은 전부 건너뛰고, 수가 그대로이며, 관리자가 바꾼 제목을 덮어쓰지 않는다', async () => {
    const before = await countMine()
    await payload.update({
      collection: 'tours',
      where: { slug: { equals: dataset[0]!.slug } },
      data: { title: `${marker} alpha 관리자 수정` },
    })

    const result = await runSeed(payload, dataset, { now })

    expect(result).toEqual({ created: [], skipped: [dataset[0]!.slug, dataset[1]!.slug], sessionsCreated: 0 })
    expect(await countMine()).toEqual(before)
    const alpha = (await payload.find({ collection: 'tours', where: { slug: { equals: dataset[0]!.slug } }, depth: 0 }))
      .docs[0]
    expect(alpha?.title).toBe(`${marker} alpha 관리자 수정`)
  })

  it('회차를 만들다 실패하면 그 투어를 남기지 않고 오류를 그대로 던진다(다음 실행이 건너뛰지 않게)', async () => {
    // 정원 0은 회차 검증(정수 ≥ 1)에 걸린다
    const broken = seedTour('broken', [
      { dayOffset: 3, hour: 9, capacity: 10 },
      { dayOffset: 4, hour: 9, capacity: 0 },
    ])

    await expect(runSeed(payload, [broken], { now })).rejects.toThrow()

    const left = await payload.find({ collection: 'tours', where: { slug: { equals: broken.slug } }, depth: 0 })
    expect(left.totalDocs).toBe(0)
    expect(await countMine()).toEqual({ tours: 2, sessions: 5 })
  })
})
