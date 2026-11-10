// SPEC-TOUR-001 M2 — 소요 시간·남은 자리 표기(AC-TOUR-008, REQ-TOUR-008).
// 일시 표기는 프로세스 시간대를 바꿔야 하므로 별도 파일(format-timezone.spec.ts)에 둔다(plan.md §B.7).
import { describe, expect, it } from 'vitest'

import { formatDuration, formatSeats } from '../../src/lib/format'

describe('소요 시간 표기', () => {
  it.each([
    [30, '30분'],
    [59, '59분'],
    [60, '1시간'],
    [90, '1시간 30분'],
    [240, '4시간'],
    [270, '4시간 30분'],
    [0, '0분'],
  ])('%i분 → "%s"', (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected)
  })

  it.each([-1, 1.5, Number.NaN])('음수·소수·NaN(%s)은 RangeError', (minutes) => {
    expect(() => formatDuration(minutes)).toThrow(RangeError)
  })
})

describe('남은 자리 표기', () => {
  it('"남은 자리 N / M"', () => {
    expect(formatSeats(4, 15)).toBe('남은 자리 4 / 15')
    expect(formatSeats(0, 15)).toBe('남은 자리 0 / 15')
  })
})
