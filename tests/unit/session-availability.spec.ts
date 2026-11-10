// SPEC-TOUR-001 M2 — 남은 자리·선택 가능 판정(AC-TOUR-008, REQ-TOUR-007).
// 현재 시각은 고정 값으로 넘긴다. 시각 비교만 하므로 프로세스 시간대와 무관하다(시간대 표기 테스트는 format-timezone.spec.ts).
import { describe, expect, it } from 'vitest'

import { getSessionAvailability, hasStarted } from '../../src/lib/session-availability'

const NOW = new Date('2026-11-10T03:00:00.000Z')
const LATER = '2026-11-20T00:00:00.000Z'
const EARLIER = '2026-11-01T00:00:00.000Z'

const openSession = (
  overrides: Partial<{ capacity: number; status: 'open' | 'closed'; startsAt: string | Date }> = {},
) => ({
  capacity: 15,
  status: 'open' as const,
  startsAt: LATER,
  ...overrides,
})

describe('남은 자리 계산', () => {
  it('정원 15·점유 0이면 남은 자리 15', () => {
    const result = getSessionAvailability(openSession(), { now: NOW, occupiedSeats: 0 })
    expect(result.remainingSeats).toBe(15)
    expect(result.capacity).toBe(15)
  })

  it('정원 15·점유 15이면 남은 자리 0, 선택 불가(자리 없음)', () => {
    const result = getSessionAvailability(openSession(), { now: NOW, occupiedSeats: 15 })
    expect(result).toEqual({ capacity: 15, remainingSeats: 0, selectable: false, reason: 'full' })
  })

  it('정원 15·점유 20이면 남은 자리는 음수가 아니라 0', () => {
    const result = getSessionAvailability(openSession(), { now: NOW, occupiedSeats: 20 })
    expect(result.remainingSeats).toBe(0)
    expect(result.reason).toBe('full')
  })

  it('점유 인원을 넘기지 않으면 0으로 계산한다', () => {
    const result = getSessionAvailability(openSession({ capacity: 12 }), { now: NOW })
    expect(result.remainingSeats).toBe(12)
  })
})

describe('선택 가능 판정', () => {
  it('모집 중·시작 시각이 현재보다 뒤·남은 자리 1 이상이면 선택 가능', () => {
    const result = getSessionAvailability(openSession(), { now: NOW })
    expect(result).toEqual({ capacity: 15, remainingSeats: 15, selectable: true, reason: null })
  })

  it('남은 자리가 정확히 1이면 선택 가능', () => {
    const result = getSessionAvailability(openSession(), { now: NOW, occupiedSeats: 14 })
    expect(result.selectable).toBe(true)
    expect(result.remainingSeats).toBe(1)
  })

  it('마감 회차는 선택 불가(사유: 마감)', () => {
    const result = getSessionAvailability(openSession({ status: 'closed' }), { now: NOW })
    expect(result.selectable).toBe(false)
    expect(result.reason).toBe('closed')
    // 마감이어도 남은 자리 표기는 계산한다(상세 화면의 "남은 자리 13 / 13" — AC-TOUR-011)
    expect(result.remainingSeats).toBe(15)
  })

  it('시작 시각 = 현재(경계)이면 선택 불가(사유: 지남)', () => {
    const result = getSessionAvailability(openSession({ startsAt: NOW.toISOString() }), { now: NOW })
    expect(result.selectable).toBe(false)
    expect(result.reason).toBe('past')
  })

  it('시작 시각이 현재보다 1밀리초 뒤이면 선택 가능', () => {
    const startsAt = new Date(NOW.getTime() + 1)
    expect(getSessionAvailability(openSession({ startsAt }), { now: NOW }).selectable).toBe(true)
  })

  it('시작 시각 < 현재이면 선택 불가(사유: 지남)', () => {
    const result = getSessionAvailability(openSession({ startsAt: EARLIER }), { now: NOW })
    expect(result.selectable).toBe(false)
    expect(result.reason).toBe('past')
  })

  it('시작 시각을 해석할 수 없으면 지난 회차로 보고 선택 불가', () => {
    const result = getSessionAvailability(openSession({ startsAt: 'not-a-date' }), { now: NOW })
    expect(result.selectable).toBe(false)
    expect(result.reason).toBe('past')
  })

  it('사유가 여럿이면 마감 → 지남 → 자리 없음 순으로 하나만 돌려준다', () => {
    const closedPastFull = openSession({ status: 'closed', startsAt: EARLIER })
    expect(getSessionAvailability(closedPastFull, { now: NOW, occupiedSeats: 15 }).reason).toBe('closed')

    const pastFull = openSession({ startsAt: EARLIER })
    expect(getSessionAvailability(pastFull, { now: NOW, occupiedSeats: 15 }).reason).toBe('past')
  })
})

describe('hasStarted', () => {
  it('시작 시각이 현재와 같거나 앞이면 true, 뒤면 false', () => {
    expect(hasStarted(NOW.toISOString(), NOW)).toBe(true)
    expect(hasStarted(EARLIER, NOW)).toBe(true)
    expect(hasStarted(LATER, NOW)).toBe(false)
    expect(hasStarted(new Date(LATER), NOW)).toBe(false)
  })
})
