// SPEC-TOUR-001 M2 — 일시 표기가 프로세스 시간대와 관계없이 서울 기준인지(AC-TOUR-008, REQ-TOUR-008, plan.md §B.7).
// 이 PC의 기본 시간대가 서울이라 timeZone 누락 결함을 그대로는 잡지 못한다. 그래서 프로세스 시간대를 뉴욕으로 바꾼 뒤 검사한다.
// - 같은 프로세스 안에서는 운영체제 기본 시간대로 되돌릴 수 없으므로 이 검사만 별도 파일에 둔다(Vitest는 파일마다 별도 작업자).
// - 표기 모듈은 시간대를 바꾼 뒤 동적으로 불러온다. 정적 import는 시간대 변경보다 먼저 실행되므로,
//   timeZone 없이 모듈 최상위에서 만든 포매터가 서울 시간대를 붙잡은 채 테스트를 통과하는 일을 막는다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const originalTz = process.env.TZ
let formatSessionDateTime: (value: string | Date) => string

describe('일시 표기(프로세스 시간대 America/New_York)', () => {
  beforeAll(async () => {
    process.env.TZ = 'America/New_York'
    ;({ formatSessionDateTime } = await import('../../src/lib/format'))
  })

  afterAll(() => {
    // 원래 값이 없었으면 지운다. undefined를 대입하면 문자열 "undefined"가 되어 UTC로 해석된다(plan.md §B.7)
    if (originalTz === undefined) {
      delete process.env.TZ
    } else {
      process.env.TZ = originalTz
    }
  })

  it('바뀐 시간대가 적용되었다(같은 순간의 getHours()가 서울 9시가 아님 — 뉴욕 19시)', () => {
    expect(new Date('2026-11-20T00:00:00Z').getHours()).not.toBe(9)
    expect(new Date('2026-11-20T00:00:00Z').getHours()).toBe(19)
  })

  it('2026-11-20T00:00:00Z → "11월 20일 (금) 오전 9:00"', () => {
    expect(new Date('2026-11-20T00:00:00Z').getHours()).not.toBe(9)
    const text = formatSessionDateTime('2026-11-20T00:00:00Z')
    expect(text).toContain('11월 20일')
    expect(text).toContain('금')
    expect(text).toContain('오전 9:00')
    expect(text).toBe('11월 20일 (금) 오전 9:00')
  })

  it('2026-11-20T06:30:00Z → "11월 20일 (금) 오후 3:30"', () => {
    const text = formatSessionDateTime('2026-11-20T06:30:00Z')
    expect(text).toContain('11월 20일')
    expect(text).toContain('금')
    expect(text).toContain('오후 3:30')
    expect(text).toBe('11월 20일 (금) 오후 3:30')
  })

  it('서울 날짜로 하루가 넘어가는 순간도 서울 기준(2026-11-20T15:05Z → 11월 21일 (토) 오전 12:05)', () => {
    expect(formatSessionDateTime(new Date('2026-11-20T15:05:00Z'))).toBe('11월 21일 (토) 오전 12:05')
  })
})
