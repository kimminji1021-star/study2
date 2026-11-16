// SPEC-ADMIN-001 M5 — 회차 현황 대시보드 데이터 함수와 서버 구성 요소(실제 PostgreSQL, plan.md §B.6·§B.9).
// AC-ADMIN-012(행 값·순서·지난 회차 제외·비공개 투어 포함·카탈로그 남은 자리와 일치·질의 수), REQ-ADMIN-011(관리자 전용 표·비공개 표시).
// 개발 DB의 다른 회차도 결과에 함께 나오므로 단언은 이 파일의 표식 투어 행만 대상으로 한다.
import { getPayload, type Payload } from 'payload'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { SessionDashboard } from '../../src/components/admin/SessionDashboard'
import { getSessionDashboard, type SessionDashboardRow } from '../../src/lib/admin-dashboard'
import { getTourDetailBySlug } from '../../src/lib/catalog'
import { getOccupiedSeatsBySession, getSeatsByStatusBySession } from '../../src/lib/occupancy'
import config from '../../src/payload.config'
import type { User } from '../../src/payload-types'
import { createTestAdmin, deleteTestAdmin } from '../helpers/admin-fixtures'
import { applicationInput, cleanupMarkerData } from '../helpers/application-fixtures'
import { daysFromNow, newMarker, tourInput } from '../helpers/catalog-fixtures'

const marker = newMarker()
let payload: Payload
let admin: User
let seq = 0

type ApplicationStatus = 'pending' | 'confirmed' | 'cancelled'

async function createTour(suffix: string, published: boolean): Promise<{ id: number; slug: string; title: string }> {
  const doc = await payload.create({
    collection: 'tours',
    data: tourInput(`${marker}-${suffix}`, { published }) as never,
  })
  return { id: doc.id, slug: doc.slug, title: doc.title }
}

async function createSession(tour: number, days: number, capacity: number, status: 'open' | 'closed' = 'open') {
  const doc = await payload.create({
    collection: 'tour-sessions',
    data: { tour, startsAt: daysFromNow(days), endsAt: daysFromNow(days, 4), capacity, status } as never,
  })
  return doc.id
}

async function addApplication(sessionId: number, partySize: number, status: ApplicationStatus) {
  seq += 1
  await payload.create({
    collection: 'applications',
    data: applicationInput(sessionId, marker, {
      partySize,
      status,
      email: `${marker}-dash-${seq}@example.test`,
      ...(status === 'cancelled' ? { cancelledAt: new Date(Date.now() - 60_000).toISOString() } : {}),
    }) as never,
  })
}

type PoolCalls = { query: number; connect: number }
type CountablePool = { query: (...args: unknown[]) => unknown; connect: (...args: unknown[]) => unknown }

// 측정 구간 동안 연결 풀의 query·connect 호출 수를 센다(catalog-occupancy.spec.ts와 같은 판정 — SPEC-APPLY-001 AC-APPLY-005).
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

/** 서버 구성 요소를 HTML 문자열로 그린다. 관리자가 아니면 null을 돌려준다. */
async function renderDashboard(user: unknown): Promise<string | null> {
  const element = await SessionDashboard({ payload, user: user as never })
  return element === null ? null : renderToStaticMarkup(element)
}

/** 표에서 회차 한 건의 행(<tr data-session-id="…">…</tr>) HTML. */
function rowHtml(html: string, sessionId: number): string {
  const match = new RegExp(`<tr[^>]*data-session-id="${sessionId}"[^>]*>([\\s\\S]*?)</tr>`).exec(html)
  expect(match, `row for session ${sessionId}`).not.toBeNull()
  return match?.[1] ?? ''
}

function cells(row: string): string[] {
  return [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((match) => match[1])
}

describe('회차 현황 대시보드(실제 DB, AC-ADMIN-012)', () => {
  let t: { id: number; slug: string; title: string }
  let p: { id: number; slug: string; title: string }
  let s0: number
  let s1: number
  let s2: number
  let s3: number

  beforeAll(async () => {
    payload = await getPayload({ config })
    admin = await createTestAdmin(payload, 'admin-dashboard')

    t = await createTour('dash-public', true)
    s1 = await createSession(t.id, 2, 10)
    s2 = await createSession(t.id, 3, 3, 'closed')
    s0 = await createSession(t.id, -1, 10)
    await addApplication(s1, 1, 'pending')
    await addApplication(s1, 1, 'pending')
    await addApplication(s1, 3, 'confirmed')
    await addApplication(s1, 4, 'cancelled')
    await addApplication(s2, 3, 'pending')
    await addApplication(s0, 1, 'pending')

    p = await createTour('dash-private', false)
    s3 = await createSession(p.id, 4, 6)
    await addApplication(s3, 2, 'confirmed')
  })

  afterAll(async () => {
    if (payload === undefined) return
    try {
      await cleanupMarkerData(payload, marker)
      await deleteTestAdmin(payload, admin)
    } finally {
      await payload.destroy()
    }
  })

  async function markerRows(): Promise<SessionDashboardRow[]> {
    const rows = await getSessionDashboard(payload, { now: new Date() })
    return rows.filter((row) => [s0, s1, s2, s3].includes(row.sessionId))
  }

  it('점유 인원 모듈의 상태별 합계: 대기 + 확정 = 점유 인원(getOccupiedSeatsBySession), 신청 없는 회차는 0, 빈 목록은 빈 Map', async () => {
    const empty = await createSession(t.id, 5, 4)
    const seats = await getSeatsByStatusBySession(payload, [s1, s3, empty])
    expect(seats.get(s1)).toEqual({ pending: 2, confirmed: 3, occupied: 5 })
    expect(seats.get(s3)).toEqual({ pending: 0, confirmed: 2, occupied: 2 })
    expect(seats.get(empty)).toEqual({ pending: 0, confirmed: 0, occupied: 0 })

    const occupied = await getOccupiedSeatsBySession(payload, [s1, s3, empty])
    for (const id of [s1, s3, empty]) expect(seats.get(id)?.occupied).toBe(occupied.get(id))

    expect((await getSeatsByStatusBySession(payload, [])).size).toBe(0)
    await payload.delete({ collection: 'tour-sessions', id: empty })
  })

  it('지난 회차(S0)는 빠지고 S1, S2, S3이 시작 일시 순으로 나온다', async () => {
    expect((await markerRows()).map((row) => row.sessionId)).toEqual([s1, s2, s3])
  })

  it('다가오는 회차가 없으면(기준 시각이 모든 회차 뒤) 빈 목록, 질의는 회차 1회뿐', async () => {
    let rows: SessionDashboardRow[] = []
    const calls = await countPoolCalls(async () => {
      rows = await getSessionDashboard(payload, { now: new Date('9999-01-01T00:00:00Z') })
    })
    expect(rows).toEqual([])
    expect(calls.query).toBe(1)
  })

  it('행 값: 대기·확정은 상태별 인원 합계(취소 제외), 남은 자리·상태·CSV 경로, 비공개 투어 회차도 포함', async () => {
    const [row1, row2, row3] = await markerRows()
    expect(row1).toEqual({
      sessionId: s1,
      tourTitle: t.title,
      tourPublished: true,
      startsAt: expect.any(String),
      capacity: 10,
      pending: 2,
      confirmed: 3,
      remainingSeats: 5,
      status: 'open',
      csvPath: `/api/tour-sessions/${s1}/participants-csv`,
    })
    expect(row2).toMatchObject({ sessionId: s2, pending: 3, confirmed: 0, remainingSeats: 0, status: 'closed' })
    expect(row3).toMatchObject({
      sessionId: s3,
      tourTitle: p.title,
      tourPublished: false,
      capacity: 6,
      pending: 0,
      confirmed: 2,
      remainingSeats: 4,
      status: 'open',
      csvPath: `/api/tour-sessions/${s3}/participants-csv`,
    })
  })

  it('S1의 남은 자리가 조회 계층(getTourDetailBySlug)의 S1 남은 자리와 같다(같은 점유 인원 정의)', async () => {
    const detail = await getTourDetailBySlug(payload, t.slug)
    const catalogSeats = detail?.sessions.find((session) => session.id === s1)?.availability.remainingSeats
    expect(catalogSeats).toBe(5)
    expect((await markerRows())[0].remainingSeats).toBe(catalogSeats)
  })

  it('질의 수: 회차 1개일 때와 6개일 때 같고 1 이상이며, 직접 연결로 나간 질의가 없다', async () => {
    const q = await createTour('dash-query-count', true)
    await addApplication(await createSession(q.id, 2, 10), 1, 'pending')
    const one = await countPoolCalls(() => getSessionDashboard(payload, { now: new Date() }))

    for (const days of [3, 4, 5, 6, 7]) {
      await addApplication(await createSession(q.id, days, 10), 1, 'pending')
    }
    // 측정 대상이 실제로 Q의 회차 6개를 돌려주는지 먼저 확인한다(빈 비교 방지)
    const qRows = (await getSessionDashboard(payload, { now: new Date() })).filter((row) => row.tourTitle === q.title)
    expect(qRows).toHaveLength(6)
    const six = await countPoolCalls(() => getSessionDashboard(payload, { now: new Date() }))

    expect(one.query).toBeGreaterThanOrEqual(1)
    expect(six.query).toBe(one.query)
    expect(one.connect).toBe(one.query)
    expect(six.connect).toBe(six.query)
  })

  describe('서버 구성 요소(beforeDashboard)', () => {
    it('관리자가 아니면(익명·다른 인증 컬렉션) 아무것도 그리지 않는다', async () => {
      expect(await renderDashboard(null)).toBeNull()
      expect(await renderDashboard(undefined)).toBeNull()
      expect(await renderDashboard({ id: 1, collection: 'members' })).toBeNull()
    })

    it('관리자: 열 머리글, 행 값, 비공개 투어 행에만 `비공개` 표시, CSV 링크(download)', async () => {
      const html = await renderDashboard(admin)
      expect(html).not.toBeNull()
      const markup = html ?? ''
      for (const header of ['투어', '시작 일시', '정원', '대기', '확정', '남은 자리', '상태']) {
        expect(markup).toContain(`>${header}</th>`)
      }

      const publicCells = cells(rowHtml(markup, s1))
      expect(publicCells[0]).toContain(t.title)
      expect(publicCells[0]).not.toContain('비공개')
      expect(publicCells.slice(2, 7)).toEqual(['10', '2', '3', '5', '모집 중'])
      expect(publicCells[7]).toContain(`href="/api/tour-sessions/${s1}/participants-csv"`)
      expect(publicCells[7]).toContain('download=""')
      expect(publicCells[7]).toContain('CSV 내려받기')

      const closedCells = cells(rowHtml(markup, s2))
      expect(closedCells[6]).toBe('마감')

      const privateCells = cells(rowHtml(markup, s3))
      expect(privateCells[0]).toContain(p.title)
      expect(privateCells[0]).toContain('비공개')
      expect(privateCells.slice(2, 7)).toEqual(['6', '0', '2', '4', '모집 중'])
      expect(privateCells[7]).toContain(`href="/api/tour-sessions/${s3}/participants-csv"`)

      expect(markup).not.toContain(`data-session-id="${s0}"`)
    })
  })
})
