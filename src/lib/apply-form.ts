// 신청 양식 해석 — SPEC-APPLY-001 REQ-APPLY-007·008, plan.md §B.3·§B.8.
// 서버 액션은 FormData를 readApplyForm으로 신청 처리 함수 입력으로 바꾸고, 오류이면 refillValues로 방문자 본인 입력값만
// 돌려준다(가정 A3 — 다시 채우는 것은 노출이 아니다). 반환값은 오류 코드·입력란 코드·다시 채울 값으로 제한한다(spec.md §4 보안).
import { HONEYPOT_FIELD, PARTY_SIZE_MAX, type ApplicationFormInput, type FieldErrors } from './application-input'
import type { SubmitErrorCode } from './submit-application'

type FormDataReader = { get(name: string): FormDataEntryValue | null }

/** 화면 입력란에 다시 채울 값. 회차 식별 값과 허니팟 값은 담지 않는다. */
export type ApplyFormValues = {
  name: string
  email: string
  phone: string
  partySize: string
  requests: string
  privacyConsent: boolean
  requestsConsent: boolean
}

export type ApplyFormState =
  { status: 'idle' } | { status: 'error'; code: SubmitErrorCode; fieldErrors: FieldErrors; values: ApplyFormValues }

export const INITIAL_APPLY_FORM_STATE: ApplyFormState = { status: 'idle' }

function textOf(form: FormDataReader, name: string): string | undefined {
  const value = form.get(name)
  return typeof value === 'string' ? value : undefined
}

/** FormData → 신청 처리 함수 입력. 체크 상자는 체크되었을 때만 FormData에 들어오므로 "있음"을 true로 본다. */
export function readApplyForm(form: FormDataReader): ApplicationFormInput {
  return {
    session: textOf(form, 'session'),
    name: textOf(form, 'name'),
    email: textOf(form, 'email'),
    phone: textOf(form, 'phone'),
    partySize: textOf(form, 'partySize'),
    requests: textOf(form, 'requests'),
    privacyConsent: textOf(form, 'privacyConsent') !== undefined,
    requestsConsent: textOf(form, 'requestsConsent') !== undefined,
    [HONEYPOT_FIELD]: textOf(form, HONEYPOT_FIELD),
  }
}

const asText = (value: unknown): string => (typeof value === 'string' ? value : '')

/** 검증 오류 뒤 입력란에 다시 채울 방문자 본인 입력값. */
export function refillValues(input: ApplicationFormInput): ApplyFormValues {
  return {
    name: asText(input.name),
    email: asText(input.email),
    phone: asText(input.phone),
    partySize: asText(input.partySize),
    requests: asText(input.requests),
    privacyConsent: input.privacyConsent === true,
    requestsConsent: input.requestsConsent === true,
  }
}

/** 인원 선택지: 1부터 10과 남은 자리 중 작은 값까지(REQ-APPLY-007). 남은 자리가 없으면 빈 목록. */
export function partySizeOptions(remainingSeats: number): number[] {
  const max = Math.max(0, Math.min(PARTY_SIZE_MAX, remainingSeats))
  return Array.from({ length: max }, (_, index) => index + 1)
}
