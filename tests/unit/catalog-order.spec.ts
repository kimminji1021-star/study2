// SPEC-TOUR-001 M2 — 가장 가까운 회차, 목록 정렬, 상세 회차 목록(AC-TOUR-008, REQ-TOUR-009·010).
import { describe, expect, it } from 'vitest'

import { listUpcomingSessions, pickNearestSelectableSession, sortToursForListing } from '../../src/lib/catalog-order'
import { getSessionAvailability } from '../../src/lib/session-availability'

const NOW = new Date('2026-11-10T03:00:00.000Z')

function session(id: string, startsAt: string, status: 'open' | 'closed' = 'open', capacity = 10) {
  return {
    id,
    startsAt,
    status,
    capacity,
    availability: getSessionAvailability({ startsAt, status, capacity }, { now: NOW }),
  }
}

describe('가장 가까운 선택 가능 회차', () => {
  it('선택 불가 회차(마감·지남)를 건너뛰고 선택 가능한 회차 중 가장 이른 것을 고른다', () => {
    const sessions = [
      session('later-open', '2026-11-15T00:00:00.000Z'),
      session('earliest-closed', '2026-11-11T00:00:00.000Z', 'closed'),
      session('past-open', '2026-11-09T00:00:00.000Z'),
      session('nearest-open', '2026-11-12T00:00:00.000Z'),
    ]
    expect(pickNearestSelectableSession(sessions)?.id).toBe('nearest-open')
  })

  it('가장 이른 회차가 입력 앞쪽에 있어도 그대로 고른다', () => {
    const sessions = [session('first', '2026-11-12T00:00:00.000Z'), session('second', '2026-11-14T00:00:00.000Z')]
    expect(pickNearestSelectableSession(sessions)?.id).toBe('first')
  })

  it('남은 자리가 없는 회차도 건너뛴다', () => {
    const full = {
      ...session('full', '2026-11-11T00:00:00.000Z'),
      availability: getSessionAvailability(
        { startsAt: '2026-11-11T00:00:00.000Z', status: 'open', capacity: 10 },
        { now: NOW, occupiedSeats: 10 },
      ),
    }
    const sessions = [full, session('open', '2026-11-13T00:00:00.000Z')]
    expect(pickNearestSelectableSession(sessions)?.id).toBe('open')
  })

  it('선택 가능한 회차가 없으면 null', () => {
    expect(pickNearestSelectableSession([session('closed', '2026-11-12T00:00:00.000Z', 'closed')])).toBeNull()
    expect(pickNearestSelectableSession([])).toBeNull()
  })
})

describe('목록 정렬', () => {
  const tour = (title: string, nearestStartsAt: string | null) => ({
    title,
    nearestSession: nearestStartsAt === null ? null : { startsAt: nearestStartsAt },
  })

  it('선택 가능한 회차가 있는 투어가 먼저, 가장 가까운 회차의 시작 시각 오름차순', () => {
    const sorted = sortToursForListing([
      tour('가 마감 투어', null),
      tour('나 늦은 투어', '2026-11-20T00:00:00.000Z'),
      tour('다 이른 투어', '2026-11-12T00:00:00.000Z'),
    ])
    expect(sorted.map((t) => t.title)).toEqual(['다 이른 투어', '나 늦은 투어', '가 마감 투어'])
  })

  it('가장 가까운 회차의 시작 시각이 같으면 제목 순', () => {
    const sorted = sortToursForListing([
      tour('우도 자전거', '2026-11-12T00:00:00.000Z'),
      tour('한라산 영실', '2026-11-12T00:00:00.000Z'),
      tour('해녀 물질', '2026-11-12T00:00:00.000Z'),
    ])
    expect(sorted.map((t) => t.title)).toEqual(['우도 자전거', '한라산 영실', '해녀 물질'])
  })

  it('선택 가능한 회차가 없는 나머지 투어는 제목 순(한국어 정렬)', () => {
    const sorted = sortToursForListing([
      tour('해녀 물질', null),
      tour('Alpha', null),
      tour('가파도', null),
      tour('나비', null),
    ])
    expect(sorted.map((t) => t.title)).toEqual(['가파도', '나비', '해녀 물질', 'Alpha'])
  })

  it('입력 순서와 관계없이 모집 중 투어가 제목 순으로 앞서는 마감 투어보다 먼저', () => {
    const open = tour('하 모집 중', '2026-11-12T00:00:00.000Z')
    const closed = tour('가 모집 마감', null)
    expect(sortToursForListing([closed, open]).map((t) => t.title)).toEqual(['하 모집 중', '가 모집 마감'])
    expect(sortToursForListing([open, closed]).map((t) => t.title)).toEqual(['하 모집 중', '가 모집 마감'])
  })

  it('입력 배열을 바꾸지 않는다', () => {
    const input = [tour('나', null), tour('가', null)]
    sortToursForListing(input)
    expect(input.map((t) => t.title)).toEqual(['나', '가'])
  })
})

describe('상세 회차 목록', () => {
  it('지난 회차(시작 시각 ≤ 현재)를 빼고 시작 시각 오름차순, 마감 회차는 포함하되 선택 불가', () => {
    const sessions = [
      session('plus5-open', '2026-11-15T00:00:00.000Z'),
      session('minus2-past', '2026-11-08T00:00:00.000Z'),
      session('plus3-closed', '2026-11-13T00:00:00.000Z', 'closed'),
      session('now-boundary', NOW.toISOString()),
      session('plus2-open', '2026-11-12T00:00:00.000Z'),
    ]
    const upcoming = listUpcomingSessions(sessions, NOW)
    expect(upcoming.map((s) => s.id)).toEqual(['plus2-open', 'plus3-closed', 'plus5-open'])
    expect(upcoming.find((s) => s.id === 'plus3-closed')?.availability).toMatchObject({
      selectable: false,
      reason: 'closed',
    })
  })

  it('예정 회차가 없으면 빈 목록', () => {
    expect(listUpcomingSessions([session('past', '2026-11-01T00:00:00.000Z')], NOW)).toEqual([])
  })
})
