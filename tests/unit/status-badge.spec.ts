// SPEC-TOUR-001 M4 — 상태 배지 문구와 색 구분(AC-TOUR-010·011·014, plan.md §B.8).
// 화면은 배지 문구를 직접 정하지 않고 이 도우미의 결과만 쓴다. 판정 자체(선택 가능·사유)는 session-availability가 한다.
import { describe, expect, it } from 'vitest'

import type { SessionAvailability } from '../../src/lib/session-availability'
import { sessionStatusBadge, tourStatusBadge } from '../../src/lib/status-badge'

const availability = (overrides: Partial<SessionAvailability>): SessionAvailability => ({
  capacity: 15,
  remainingSeats: 15,
  selectable: true,
  reason: null,
  ...overrides,
})

describe('투어 카드 배지', () => {
  it('선택 가능한 회차가 있으면 "모집 중"(open)', () => {
    expect(tourStatusBadge({ hasSelectableSession: true })).toEqual({ tone: 'open', label: '모집 중' })
  })

  it('선택 가능한 회차가 없으면 "모집 마감"(closed)', () => {
    expect(tourStatusBadge({ hasSelectableSession: false })).toEqual({ tone: 'closed', label: '모집 마감' })
  })
})

describe('회차 배지', () => {
  it('선택 가능하면 "모집 중"(open)', () => {
    expect(sessionStatusBadge(availability({}))).toEqual({ tone: 'open', label: '모집 중' })
  })

  it.each([
    ['closed', '마감'],
    ['full', '자리 없음'],
    ['past', '지난 회차'],
  ] as const)('선택 불가 사유 %s → "%s"(closed)', (reason, label) => {
    expect(sessionStatusBadge(availability({ selectable: false, reason }))).toEqual({ tone: 'closed', label })
  })
})
