// SPEC-APPLY-001 M1 — 신청 입력 규칙 순수 함수 단위 테스트(컬렉션 필드 검증이 쓰는 범위).
// AC-APPLY-002(인원·요청 사항 범위, 이메일 표본 일관성), plan.md §B.6 입력 규칙 표.
// 입력란 전체를 묶는 검증(회차·동의·오류 코드 목록)은 M2에서 더했다(파일 끝 describe, AC-APPLY-008).
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
  parseSessionId,
  validateApplicationInput,
  type ApplicationFormInput,
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

// SPEC-APPLY-001 M2 — 서버 제출 경로의 입력란 묶음 검증(AC-APPLY-008 단위 부분).
// 각 사례는 나머지 입력이 모두 올바른 상태에서 하나만 바꾼다.
describe('입력란 묶음 검증 validateApplicationInput(AC-APPLY-008)', () => {
  const valid: ApplicationFormInput = {
    session: '1',
    name: '김민지',
    email: samples.accepted[0],
    phone: '010-1234-5678',
    partySize: '2',
    requests: '',
    privacyConsent: true,
    requestsConsent: false,
  }

  function errorsOf(overrides: Partial<ApplicationFormInput>) {
    const result = validateApplicationInput({ ...valid, ...overrides })
    return result.ok ? {} : result.fieldErrors
  }

  it('올바른 입력은 통과하고 정리된 값을 돌려준다', () => {
    const result = validateApplicationInput({ ...valid, name: '  김민지  ', phone: ' 010-1234-5678 ' })
    expect(result).toEqual({
      ok: true,
      value: {
        sessionId: 1,
        name: '김민지',
        email: samples.accepted[0],
        phone: '010-1234-5678',
        partySize: 2,
        requests: '',
        requestsConsent: false,
      },
    })
  })

  describe('이름', () => {
    it.each(['', '   '])('%j는 NAME_REQUIRED다', (name) => {
      expect(errorsOf({ name })).toEqual({ name: 'NAME_REQUIRED' })
    })

    it('앞뒤 공백을 제거하면 내부 공백 포함 50자인 이름은 통과한다', () => {
      const name = `  ${'a'.repeat(24)} ${'b'.repeat(25)}  `
      expect(name.trim()).toHaveLength(50)
      expect(errorsOf({ name })).toEqual({})
    })

    it('앞뒤 공백을 제거해도 51자인 이름은 NAME_TOO_LONG이다', () => {
      const name = `  ${'a'.repeat(25)} ${'b'.repeat(25)}  `
      expect(name.trim()).toHaveLength(51)
      expect(errorsOf({ name })).toEqual({ name: 'NAME_TOO_LONG' })
    })

    it('제어 문자(\\u0007)를 담은 이름은 NAME_INVALID다', () => {
      expect(errorsOf({ name: '김\u0007민지' })).toEqual({ name: 'NAME_INVALID' })
    })
  })

  describe('연락처', () => {
    it.each(['010-1234-5678', '02-123-4567', '+82 10-1234-5678', '+1 (415) 555-0100'])('%s는 통과한다', (phone) => {
      expect(errorsOf({ phone })).toEqual({})
    })

    it.each(['1234567', '010-1234-567a', '12+3456789', '1234567890123456'])('%s는 PHONE_INVALID다', (phone) => {
      expect(errorsOf({ phone })).toEqual({ phone: 'PHONE_INVALID' })
    })

    it('원문 길이만 다른 짝: 30자는 통과하고 31자는 PHONE_INVALID다', () => {
      const thirty = `010${' '.repeat(17)}-1234-5678`
      const thirtyOne = `010${' '.repeat(18)}-1234-5678`
      expect(thirty).toHaveLength(30)
      expect(thirtyOne).toHaveLength(31)
      expect(thirty.replace(/[\s\-().]/g, '')).toHaveLength(11)
      expect(thirtyOne.replace(/[\s\-().]/g, '')).toHaveLength(11)

      expect(errorsOf({ phone: thirty })).toEqual({})
      expect(errorsOf({ phone: thirtyOne })).toEqual({ phone: 'PHONE_INVALID' })
    })
  })

  describe('인원', () => {
    it.each(['1', '10'])('%j는 통과한다', (partySize) => {
      expect(errorsOf({ partySize })).toEqual({})
    })

    it.each(['0', '11', '1.5', 'abc', '', '01', ' 2'])('%j는 PARTY_SIZE_INVALID다', (partySize) => {
      expect(errorsOf({ partySize })).toEqual({ partySize: 'PARTY_SIZE_INVALID' })
    })
  })

  describe('요청 사항과 선택 동의', () => {
    it('500자 + 선택 동의는 통과한다', () => {
      expect(errorsOf({ requests: 'x'.repeat(500), requestsConsent: true })).toEqual({})
    })

    it('501자는 REQUESTS_TOO_LONG이다', () => {
      expect(errorsOf({ requests: 'x'.repeat(501), requestsConsent: true })).toEqual({ requests: 'REQUESTS_TOO_LONG' })
    })

    it('요청 사항이 있는데 선택 동의가 없으면 REQUESTS_CONSENT_REQUIRED다', () => {
      expect(errorsOf({ requests: '창가 자리', requestsConsent: false })).toEqual({
        requests: 'REQUESTS_CONSENT_REQUIRED',
      })
    })

    it('요청 사항이 비어 있으면 선택 동의가 없어도 통과한다', () => {
      expect(errorsOf({ requests: '', requestsConsent: false })).toEqual({})
      expect(errorsOf({ requests: undefined, requestsConsent: false })).toEqual({})
    })
  })

  it('필수 동의가 없으면 PRIVACY_CONSENT_REQUIRED다', () => {
    expect(errorsOf({ privacyConsent: false })).toEqual({ privacyConsent: 'PRIVACY_CONSENT_REQUIRED' })
    expect(errorsOf({ privacyConsent: undefined })).toEqual({ privacyConsent: 'PRIVACY_CONSENT_REQUIRED' })
  })

  describe('회차 식별 값(1 이상 2147483647 이하의 정수)', () => {
    it.each(['abc', '0', '-1', '1.5', '2147483648', '', '99999999999', '01'])('%j는 SESSION_INVALID다', (session) => {
      expect(errorsOf({ session })).toEqual({ session: 'SESSION_INVALID' })
    })

    it.each(['1', '2147483647'])('%j는 통과한다', (session) => {
      expect(errorsOf({ session })).toEqual({})
    })

    it('parseSessionId는 범위 안의 정수 문자열만 숫자로 바꾼다', () => {
      expect(parseSessionId('2147483647')).toBe(2147483647)
      expect(parseSessionId('2147483648')).toBeNull()
      expect(parseSessionId(undefined)).toBeNull()
      expect(parseSessionId(['1'])).toBeNull()
    })
  })

  it('여러 입력이 동시에 틀리면 입력란별 코드가 모두 돌아온다', () => {
    expect(
      errorsOf({
        session: 'abc',
        name: '',
        email: 'a@b',
        phone: '123',
        partySize: '11',
        requests: 'x',
        requestsConsent: false,
        privacyConsent: false,
      }),
    ).toEqual({
      session: 'SESSION_INVALID',
      name: 'NAME_REQUIRED',
      email: 'EMAIL_INVALID',
      phone: 'PHONE_INVALID',
      partySize: 'PARTY_SIZE_INVALID',
      requests: 'REQUESTS_CONSENT_REQUIRED',
      privacyConsent: 'PRIVACY_CONSENT_REQUIRED',
    })
  })
})
