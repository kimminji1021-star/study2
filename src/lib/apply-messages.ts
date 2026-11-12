// 신청 화면 문구 — SPEC-APPLY-001 REQ-APPLY-007·008·012, plan.md §B.6·§B.8.
// 오류 코드(영문 고정)를 화면에 보일 한국어 안내로 바꾸는 대응표와 화면 고정 문구를 한 곳에 둔다.
// 다국어 SPEC(로드맵 7번)에서 언어별로 나눌 수 있게 경로 파일 밖에 둔다. 동의 고지 문구는 consent.ts가 맡는다.
// 안내 문구에는 입력값을 넣지 않는다(REQ-APPLY-015).
import type { FieldErrorCode } from './application-input'
import type { SubmitErrorCode } from './submit-application'

/** 입력란 옆에 보이는 안내(입력란 오류 코드별). */
export const FIELD_ERROR_MESSAGES: Record<FieldErrorCode, string> = {
  SESSION_INVALID: '회차 정보가 올바르지 않습니다. 투어 상세에서 회차를 다시 골라 주세요.',
  NAME_REQUIRED: '이름을 입력해 주세요.',
  NAME_TOO_LONG: '이름은 50자 이하로 입력해 주세요.',
  NAME_INVALID: '이름에 쓸 수 없는 문자가 들어 있습니다.',
  EMAIL_INVALID: '올바른 이메일 주소를 입력해 주세요.',
  PHONE_INVALID: '연락처는 숫자 8~15자리로 입력해 주세요. 하이픈·공백·괄호는 써도 됩니다.',
  PARTY_SIZE_INVALID: '인원을 다시 골라 주세요.',
  REQUESTS_TOO_LONG: '요청 사항은 500자 이하로 입력해 주세요.',
  REQUESTS_CONSENT_REQUIRED: '요청 사항을 남기려면 선택 동의에 체크하거나 입력란을 비워 주세요.',
  PRIVACY_CONSENT_REQUIRED: '개인정보 수집·이용에 동의해야 신청할 수 있습니다.',
  AGE_CONFIRM_REQUIRED: '만 14세 이상임을 확인해야 신청할 수 있습니다. 만 14세 미만은 보호자가 신청해 주세요.',
}

/** 양식 위에 보이는 안내(제출 결과 코드별). 허니팟 거부는 이유를 드러내지 않는다(REQ-APPLY-013). */
export const SUBMIT_ERROR_MESSAGES: Record<SubmitErrorCode, string> = {
  VALIDATION_FAILED: '입력 내용을 확인해 주세요.',
  RATE_LIMITED: '신청 시도가 너무 많습니다. 10분 뒤에 다시 시도해 주세요.',
  SUBMISSION_REJECTED: '신청을 처리할 수 없습니다. 잠시 뒤 다시 시도해 주세요.',
  SESSION_NOT_FOUND: '신청할 수 없는 회차입니다. 투어 상세에서 회차를 다시 골라 주세요.',
  SESSION_CLOSED: '회차가 마감되어 신청할 수 없습니다.',
  SESSION_STARTED: '이미 시작한 회차라 신청할 수 없습니다.',
  CAPACITY_EXCEEDED: '남은 자리보다 인원이 많습니다. 인원을 줄이거나 다른 회차를 골라 주세요.',
  SESSION_BUSY: '신청이 몰려 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
  INTERNAL_ERROR: '신청을 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
}

/** 접수 완료 화면의 상태 문구(REQ-APPLY-012). */
export const APPLICATION_STATUS_LABELS = {
  pending: '대기 — 관리자 확인 후 확정',
  confirmed: '확정',
  cancelled: '취소',
} as const

/** 신청 화면·접수 완료 화면의 고정 문구. */
export const APPLY_TEXT = {
  formTitle: '신청 정보 입력',
  unavailableTitle: '신청할 수 없는 회차입니다',
  unavailableBody: '마감되었거나 이미 시작했거나 남은 자리가 없는 회차입니다. 투어 상세에서 다른 회차를 골라 주세요.',
  backToTour: '투어 상세로 돌아가기',
  privacyConsentLabel: '개인정보 수집·이용에 동의합니다(필수)',
  requestsConsentLabel: '요청 사항 수집·이용에 동의합니다(선택)',
  ageConfirmLabel: '만 14세 이상입니다(필수)',
  submit: '신청 접수하기',
  submitting: '접수하는 중…',
  completeTitle: '신청이 접수되었습니다',
  completeBody: '관리자가 확인한 뒤 신청을 확정합니다. 접수 번호를 적어 두세요.',
  toTours: '다른 투어 보기',
} as const
