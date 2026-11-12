// 신청 입력 규칙 순수 함수 — SPEC-APPLY-001 REQ-APPLY-001·008, plan.md §B.6.
// 서버 제출 경로의 입력 검증(M2)과 applications 컬렉션 필드 검증이 같은 함수를 써서
// "서버 검증은 통과했는데 컬렉션이 거부해 일반 오류가 보이는" 불일치를 막는다(plan.md R13).
// 각 함수는 통과하면 null, 아니면 입력란 오류 코드(acceptance.md §0, 영문 고정)를 돌려준다.

export const NAME_MAX_LENGTH = 50
export const EMAIL_MAX_LENGTH = 254
export const PHONE_RAW_MAX_LENGTH = 30
export const PARTY_SIZE_MIN = 1
export const PARTY_SIZE_MAX = 10
export const REQUESTS_MAX_LENGTH = 500

export type FieldErrorCode =
  | 'NAME_REQUIRED'
  | 'NAME_TOO_LONG'
  | 'NAME_INVALID'
  | 'EMAIL_INVALID'
  | 'PHONE_INVALID'
  | 'PARTY_SIZE_INVALID'
  | 'REQUESTS_TOO_LONG'

// @MX:NOTE: [AUTO] Payload 3.93.0 email 필드 검증 정규식의 복사본(node_modules/payload/dist/fields/validations.js 89~112행).
// Payload가 정규식을 내보내지 않아 복사했다. 어긋나면 이메일 표본 일관성 테스트(AC-APPLY-002 단위·통합)가 실패한다
const PAYLOAD_EMAIL_PATTERN =
  /^(?!.*\.\.)[\w!#$%&'*+/=?^`{|}~-](?:[\w!#$%&'*+/=?^`{|}~.-]*[\w!#$%&'*+/=?^`{|}~-])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i

// 제어 문자(C0·DEL·C1). 줄바꿈·탭도 이름에는 허용하지 않는다
const CONTROL_CHARACTER = /\p{Cc}/u

// 연락처에서 무시하는 구분 기호: 공백·하이픈·괄호·점
const PHONE_SEPARATORS = /[\s\-().]/g
const PHONE_DIGITS = /^\+?[0-9]{8,15}$/

/** 글자 수(코드 포인트 기준 — 한글·이모지 한 글자를 1로 센다). */
function charLength(value: string): number {
  return [...value].length
}

/** 이름: 앞뒤 공백 제거 후 1~50자, 제어 문자 없음. */
export function checkName(value: unknown): FieldErrorCode | null {
  const name = typeof value === 'string' ? value.trim() : ''
  if (name === '') return 'NAME_REQUIRED'
  if (charLength(name) > NAME_MAX_LENGTH) return 'NAME_TOO_LONG'
  if (CONTROL_CHARACTER.test(name)) return 'NAME_INVALID'
  return null
}

/** 이메일: 앞뒤 공백 제거, 254자 이하, Payload email 필드 정규식 통과. */
export function checkEmail(value: unknown): FieldErrorCode | null {
  const email = typeof value === 'string' ? value.trim() : ''
  if (email === '' || email.length > EMAIL_MAX_LENGTH) return 'EMAIL_INVALID'
  return PAYLOAD_EMAIL_PATTERN.test(email) ? null : 'EMAIL_INVALID'
}

/** 연락처: 원문(앞뒤 공백 제거) 30자 이하, 구분 기호를 뺀 값이 +(선택)와 숫자 8~15자리. */
export function checkPhone(value: unknown): FieldErrorCode | null {
  const phone = typeof value === 'string' ? value.trim() : ''
  if (phone === '' || charLength(phone) > PHONE_RAW_MAX_LENGTH) return 'PHONE_INVALID'
  return PHONE_DIGITS.test(phone.replace(PHONE_SEPARATORS, '')) ? null : 'PHONE_INVALID'
}

/** 인원: 1 이상 10 이하의 정수(숫자 값). 문자열 입력의 해석은 서버 제출 경로가 맡는다. */
export function isValidPartySize(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= PARTY_SIZE_MIN && value <= PARTY_SIZE_MAX
}

/** 요청 사항: 선택 입력, 500자 이하. */
export function checkRequests(value: unknown): FieldErrorCode | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') return 'REQUESTS_TOO_LONG'
  return charLength(value) > REQUESTS_MAX_LENGTH ? 'REQUESTS_TOO_LONG' : null
}
