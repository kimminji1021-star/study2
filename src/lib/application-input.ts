// 신청 입력 규칙 순수 함수 — SPEC-APPLY-001 REQ-APPLY-001·008, plan.md §B.6.
// 서버 제출 경로의 입력 검증(validateApplicationInput)과 applications 컬렉션 필드 검증이 같은 함수를 써서
// "서버 검증은 통과했는데 컬렉션이 거부해 일반 오류가 보이는" 불일치를 막는다(plan.md R13).
// 각 함수는 통과하면 null, 아니면 입력란 오류 코드(acceptance.md §0, 영문 고정)를 돌려준다.

export const NAME_MAX_LENGTH = 50
export const EMAIL_MAX_LENGTH = 254
export const PHONE_RAW_MAX_LENGTH = 30
export const PARTY_SIZE_MIN = 1
export const PARTY_SIZE_MAX = 10
export const REQUESTS_MAX_LENGTH = 500

// tour_sessions.id는 PostgreSQL integer — 범위를 넘으면 조회가 22003으로 실패해 404 대신 500이 된다(plan.md R22)
export const SESSION_ID_MAX = 2147483647

export type FieldErrorCode =
  | 'SESSION_INVALID'
  | 'NAME_REQUIRED'
  | 'NAME_TOO_LONG'
  | 'NAME_INVALID'
  | 'EMAIL_INVALID'
  | 'PHONE_INVALID'
  | 'PARTY_SIZE_INVALID'
  | 'REQUESTS_TOO_LONG'
  | 'REQUESTS_CONSENT_REQUIRED'
  | 'PRIVACY_CONSENT_REQUIRED'
  | 'AGE_CONFIRM_REQUIRED'

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

// 0으로 시작하지 않는 10자리 이하 십진 정수 문자열(앞뒤 공백·부호·소수점 없음)
const SESSION_ID_TEXT = /^[1-9][0-9]{0,9}$/
const PARTY_SIZE_TEXT = /^(?:[1-9]|10)$/

/** 회차 식별 값: 1 이상 2147483647 이하의 정수 문자열이면 숫자, 아니면 null. 신청 화면(M5)도 같은 함수로 404를 판정한다. */
export function parseSessionId(value: unknown): number | null {
  if (typeof value !== 'string' || !SESSION_ID_TEXT.test(value)) return null
  const id = Number(value)
  return id <= SESSION_ID_MAX ? id : null
}

/** 서버 제출 경로가 받는 양식 값(FormData 해석 결과). 체크 상자는 체크되었을 때만 true. */
export type ApplicationFormInput = {
  session?: unknown
  name?: unknown
  email?: unknown
  phone?: unknown
  partySize?: unknown
  requests?: unknown
  privacyConsent?: unknown
  requestsConsent?: unknown
  /** 만 14세 이상 확인(필수 체크 상자). 개인정보 보호법 제22조의2 — 만 14세 미만은 보호자가 신청한다 */
  ageConfirmed?: unknown
  /** 허니팟 입력란(화면에 보이지 않음). 사람은 비워 두고, 값이 있으면 봇으로 보고 거부한다(REQ-APPLY-013) */
  website?: unknown
}

// 허니팟 입력란 이름(plan.md §B.8). 신청 화면(M5)의 숨은 입력란과 서버 액션의 FormData 해석이 같은 이름을 쓴다
export const HONEYPOT_FIELD = 'website'

/** 허니팟 입력란에 값이 있는지. 빈 문자열·없음은 비어 있는 것으로 본다(공백만 있어도 채운 것으로 본다). */
export function isHoneypotFilled(input: Pick<ApplicationFormInput, 'website'>): boolean {
  return input.website !== undefined && input.website !== null && input.website !== ''
}

export type ApplicationField =
  'session' | 'name' | 'email' | 'phone' | 'partySize' | 'requests' | 'privacyConsent' | 'ageConfirmed'
export type FieldErrors = Partial<Record<ApplicationField, FieldErrorCode>>

/** 검증을 통과한 값. 문자열은 앞뒤 공백을 뺐고, 요청 사항은 비어 있을 수 있다. */
export type ApplicationValues = {
  sessionId: number
  name: string
  email: string
  phone: string
  partySize: number
  requests: string
  requestsConsent: boolean
}

export type ApplicationValidation = { ok: true; value: ApplicationValues } | { ok: false; fieldErrors: FieldErrors }

function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * 서버 제출 경로의 입력 재검증(REQ-APPLY-008). 브라우저 쪽 검사와 관계없이 모든 입력란을 보고,
 * 틀린 입력란마다 코드 하나를 돌려준다. 요청 사항이 있는데 선택 동의가 없으면 요청 사항만 버리지 않고 거부한다.
 */
export function validateApplicationInput(input: ApplicationFormInput): ApplicationValidation {
  const fieldErrors: FieldErrors = {}
  const sessionId = parseSessionId(input.session)
  const requests = trimmed(input.requests)
  const requestsConsent = input.requestsConsent === true

  if (sessionId === null) fieldErrors.session = 'SESSION_INVALID'
  const nameError = checkName(input.name)
  if (nameError) fieldErrors.name = nameError
  const emailError = checkEmail(input.email)
  if (emailError) fieldErrors.email = emailError
  const phoneError = checkPhone(input.phone)
  if (phoneError) fieldErrors.phone = phoneError
  const partySizeText = typeof input.partySize === 'string' ? input.partySize : ''
  if (!PARTY_SIZE_TEXT.test(partySizeText)) fieldErrors.partySize = 'PARTY_SIZE_INVALID'
  const requestsError =
    checkRequests(requests) ?? (requests !== '' && !requestsConsent ? 'REQUESTS_CONSENT_REQUIRED' : null)
  if (requestsError) fieldErrors.requests = requestsError
  if (input.privacyConsent !== true) fieldErrors.privacyConsent = 'PRIVACY_CONSENT_REQUIRED'
  if (input.ageConfirmed !== true) fieldErrors.ageConfirmed = 'AGE_CONFIRM_REQUIRED'

  if (sessionId === null || Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors }
  return {
    ok: true,
    value: {
      sessionId,
      name: trimmed(input.name),
      email: trimmed(input.email),
      phone: trimmed(input.phone),
      partySize: Number(partySizeText),
      requests,
      requestsConsent,
    },
  }
}
