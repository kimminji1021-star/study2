// SPEC-TOUR-001 M2 — 소요 시간·남은 자리 표기(AC-TOUR-008, REQ-TOUR-008).
// 일시 표기는 프로세스 시간대를 바꿔야 하므로 별도 파일(format-timezone.spec.ts)에 둔다(plan.md §B.7).
import { describe, expect, it } from 'vitest'

import { formatDuration, formatSeats, splitParagraphs } from '../../src/lib/format'

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

// 상세 화면 설명: 빈 줄은 문단 경계, 한 줄 바꿈은 문단 안에 그대로 둔다(plan.md §B.2, AC-TOUR-011)
describe('설명 문단 나누기', () => {
  it('빈 줄로 나뉜 두 문단을 두 항목으로 돌려준다', () => {
    expect(splitParagraphs('첫 문단\n\n두 번째 문단')).toEqual(['첫 문단', '두 번째 문단'])
  })

  it('한 줄 바꿈은 문단 안에 남기고, 공백만 있는 줄도 문단 경계로 본다', () => {
    expect(splitParagraphs('첫 줄\n둘째 줄\n  \n다음 문단')).toEqual(['첫 줄\n둘째 줄', '다음 문단'])
  })

  it('Windows 줄바꿈(CRLF)과 앞뒤 빈 줄·여러 빈 줄을 정리한다', () => {
    expect(splitParagraphs('\r\n가\r\n\r\n\r\n나\r\n')).toEqual(['가', '나'])
  })

  it('빈 문자열·공백뿐인 값은 빈 배열', () => {
    expect(splitParagraphs('')).toEqual([])
    expect(splitParagraphs(' \n \n')).toEqual([])
  })
})
