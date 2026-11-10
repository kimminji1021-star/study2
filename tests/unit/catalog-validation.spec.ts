// SPEC-TOUR-001 M1 — 컬렉션 검증·접근 규칙에 쓰는 순수 도우미 단위 테스트.
// AC-TOUR-005(관리자 판정은 users 컬렉션 기준), AC-TOUR-003·008(slug 형식), AC-TOUR-002(5MB 경계),
// AC-TOUR-003·004(1 이상 정수), AC-TOUR-004(종료 > 시작).
import { describe, expect, it } from 'vitest'

import { isAdmin } from '../../src/lib/access'
import {
  MAX_UPLOAD_BYTES,
  exceedsUploadLimit,
  isEndAfterStart,
  isPositiveInteger,
  isValidSlug,
} from '../../src/lib/validation'

describe('관리자 판정(가정 A1: users 컬렉션 사용자만 관리자)', () => {
  it('사용자가 없으면 관리자가 아니다', () => {
    expect(isAdmin(null)).toBe(false)
    expect(isAdmin(undefined)).toBe(false)
  })

  it("collection이 'users'인 사용자는 관리자다", () => {
    expect(isAdmin({ collection: 'users' })).toBe(true)
  })

  it('다른 인증 컬렉션 사용자(예: members)는 관리자가 아니다', () => {
    expect(isAdmin({ collection: 'members' })).toBe(false)
    expect(isAdmin({})).toBe(false)
  })
})

describe('slug 형식(영문 소문자·숫자, 단어 사이 하이픈 하나)', () => {
  it.each(['hallasan-yeongsil', 'udo-bike-2', 'a', 'test-123-open'])('%s는 허용한다', (slug) => {
    expect(isValidSlug(slug)).toBe(true)
  })

  it.each(['Test-Upper', 'test_under', '-test', 'test-', 'test--double', '테스트', '', 'a b'])(
    '%j는 거부한다',
    (slug) => {
      expect(isValidSlug(slug)).toBe(false)
    },
  )
})

describe('1 이상 정수 판정(소요 시간·정원)', () => {
  it.each([1, 2, 240])('%d는 허용한다', (value) => {
    expect(isPositiveInteger(value)).toBe(true)
  })

  it.each([0, -1, -30, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('%d는 거부한다', (value) => {
    expect(isPositiveInteger(value)).toBe(false)
  })
})

describe('종료 일시 > 시작 일시', () => {
  const start = '2026-11-20T00:00:00.000Z'

  it('종료가 시작보다 뒤면 참이다', () => {
    expect(isEndAfterStart(start, '2026-11-20T04:00:00.000Z')).toBe(true)
    expect(isEndAfterStart(new Date(start), new Date('2026-11-20T00:00:00.001Z'))).toBe(true)
  })

  it('종료가 시작과 같거나 앞서면 거짓이다', () => {
    expect(isEndAfterStart(start, start)).toBe(false)
    expect(isEndAfterStart(start, '2026-11-19T23:59:59.999Z')).toBe(false)
  })

  it('둘 중 하나라도 해석할 수 없으면 거짓이다', () => {
    expect(isEndAfterStart(undefined, start)).toBe(false)
    expect(isEndAfterStart(start, null)).toBe(false)
    expect(isEndAfterStart('not-a-date', start)).toBe(false)
  })
})

describe('업로드 크기 제한(5MB = 5 × 1024 × 1024바이트)', () => {
  it('한도는 5,242,880바이트다', () => {
    expect(MAX_UPLOAD_BYTES).toBe(5_242_880)
  })

  it('정확히 5MB는 넘지 않는다(경계 허용)', () => {
    expect(exceedsUploadLimit({ size: MAX_UPLOAD_BYTES })).toBe(false)
  })

  it('1바이트라도 넘으면 넘는다', () => {
    expect(exceedsUploadLimit({ size: MAX_UPLOAD_BYTES + 1 })).toBe(true)
  })

  it('size와 실제 데이터 길이 중 큰 값으로 판정한다(size가 작게 적힌 경우 대비)', () => {
    expect(exceedsUploadLimit({ size: 10, data: Buffer.alloc(MAX_UPLOAD_BYTES + 1) })).toBe(true)
    expect(exceedsUploadLimit({ size: MAX_UPLOAD_BYTES + 1, data: Buffer.alloc(0) })).toBe(true)
    expect(exceedsUploadLimit({ size: 10, data: Buffer.alloc(10) })).toBe(false)
  })

  it('파일이 없으면 넘지 않는다', () => {
    expect(exceedsUploadLimit(undefined)).toBe(false)
  })
})
