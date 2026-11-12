// SPEC-APPLY-001 M1 — 신청 입력 규칙 순수 함수 단위 테스트(컬렉션 필드 검증이 쓰는 범위).
// AC-APPLY-002(인원·요청 사항 범위, 이메일 표본 일관성), plan.md §B.6 입력 규칙 표.
// 입력란 전체를 묶는 검증(회차·동의·오류 코드 목록)은 M2에서 더한다.
import { describe, expect, it } from 'vitest'

import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PARTY_SIZE_MAX,
  PARTY_SIZE_MIN,
  PHONE_RAW_MAX_LENGTH,
  REQUESTS_MAX_LENGTH,
  checkEmail,
  checkName,
  checkPhone,
  checkRequests,
  isValidPartySize,
} from '../../src/lib/application-input'
import { emailSamples } from '../helpers/application-fixtures'

// 계획 단계에서 Payload email 정규식 통과를 계산해 확인한 표식(acceptance.md AC-APPLY-002)
const samples = emailSamples('test-ab12cd34')

describe('입력 규칙 상수', () => {
  it('plan.md §B.6 표의 한도와 같다', () => {
    expect(NAME_MAX_LENGTH).toBe(50)
    expect(EMAIL_MAX_LENGTH).toBe(254)
    expect(PHONE_RAW_MAX_LENGTH).toBe(30)
    expect(PARTY_SIZE_MIN).toBe(1)
    expect(PARTY_SIZE_MAX).toBe(10)
    expect(REQUESTS_MAX_LENGTH).toBe(500)
  })
})

describe('이름(앞뒤 공백 제거 후 1~50자, 제어 문자 없음)', () => {
  it.each(['김민지', '  김민지  ', 'Kim Minji', '가'.repeat(50), ` ${'가'.repeat(50)} `])('%j는 통과한다', (name) => {
    expect(checkName(name)).toBeNull()
  })

  it.each(['', '   ', '\t\n'])('%j는 NAME_REQUIRED다', (name) => {
    expect(checkName(name)).toBe('NAME_REQUIRED')
  })

  it('앞뒤 공백을 뺀 51자는 NAME_TOO_LONG이다', () => {
    expect(checkName('가'.repeat(51))).toBe('NAME_TOO_LONG')
  })

  it.each(['김\u0000민지', '김\n민지', '김\u007F민지', '김\u0085민지'])(
    '제어 문자를 담은 %j는 NAME_INVALID다',
    (name) => {
      expect(checkName(name)).toBe('NAME_INVALID')
    },
  )

  it('문자열이 아니면 NAME_REQUIRED다', () => {
    expect(checkName(undefined)).toBe('NAME_REQUIRED')
    expect(checkName(42)).toBe('NAME_REQUIRED')
  })
})

describe('이메일(Payload email 필드 정규식 + 254자 이하)', () => {
  it.each(samples.accepted)('받는 표본 %s는 통과한다', (email) => {
    expect(checkEmail(email)).toBeNull()
  })

  it.each(samples.rejected)('거부 표본 %s는 EMAIL_INVALID다', (email) => {
    expect(checkEmail(email)).toBe('EMAIL_INVALID')
  })

  it('거부 표본의 긴 주소는 정확히 255자다(254자 경계 바로 위)', () => {
    expect(samples.rejected.at(-1)).toHaveLength(255)
  })

  it('254자 주소는 통과하고 앞뒤 공백은 제거한 뒤 판정한다', () => {
    const address = `${'a'.repeat(241)}@example.test`
    expect(address).toHaveLength(254)
    expect(checkEmail(address)).toBeNull()
    expect(checkEmail(`  ${samples.accepted[0]}  `)).toBeNull()
  })

  it('빈 값이나 문자열이 아닌 값은 EMAIL_INVALID다', () => {
    expect(checkEmail('')).toBe('EMAIL_INVALID')
    expect(checkEmail(null)).toBe('EMAIL_INVALID')
  })
})

describe('연락처(원문 30자 이하, 구분 기호를 뺀 값이 +와 숫자 8~15자리)', () => {
  it.each(['010-1234-5678', '02-123-4567', '+82 10-1234-5678', '+1 (415) 555-0100', '010.1234.5678', ' 01012345678 '])(
    '%s는 통과한다',
    (phone) => {
      expect(checkPhone(phone)).toBeNull()
    },
  )

  it.each(['1234567', '010-1234-567a', '12+3456789', '1234567890123456', '', '++821012345678'])(
    '%j는 PHONE_INVALID다',
    (phone) => {
      expect(checkPhone(phone)).toBe('PHONE_INVALID')
    },
  )

  it('숫자 15자리라도 원문이 31자면 거부하고, 30자면 통과한다', () => {
    // 숫자 15자리 각각 뒤에 하이픈 → 30자, 하이픈 하나를 더하면 31자(숫자 수는 같음)
    const thirty = '0-1-2-3-4-5-6-7-8-9-0-1-2-3-4-'
    const thirtyOne = `${thirty}-`
    expect(thirtyOne).toHaveLength(31)
    expect(thirty).toHaveLength(30)
    expect(checkPhone(thirtyOne)).toBe('PHONE_INVALID')
    expect(checkPhone(thirty)).toBeNull()
  })

  it('문자열이 아니면 PHONE_INVALID다', () => {
    expect(checkPhone(undefined)).toBe('PHONE_INVALID')
  })
})

describe('인원(1 이상 10 이하의 정수)', () => {
  it.each([1, 5, 10])('%d는 통과한다', (size) => {
    expect(isValidPartySize(size)).toBe(true)
  })

  it.each([0, 11, 1.5, -1, Number.NaN, '3', null])('%j는 거부한다', (size) => {
    expect(isValidPartySize(size)).toBe(false)
  })
})

describe('요청 사항(500자 이하, 비어 있어도 됨)', () => {
  it.each(['', 'x'.repeat(500), '휠체어 없음'])('길이 %#번 사례는 통과한다', (requests) => {
    expect(checkRequests(requests)).toBeNull()
  })

  it('501자는 REQUESTS_TOO_LONG이다', () => {
    expect(checkRequests('x'.repeat(501))).toBe('REQUESTS_TOO_LONG')
  })

  it('값이 없으면(선택 입력) 통과한다', () => {
    expect(checkRequests(undefined)).toBeNull()
    expect(checkRequests(null)).toBeNull()
  })

  it('문자열이 아닌 값은 REQUESTS_TOO_LONG으로 거부한다', () => {
    expect(checkRequests(42)).toBe('REQUESTS_TOO_LONG')
  })
})
