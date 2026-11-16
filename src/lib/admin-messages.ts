// 관리자 운영 문구 모음(SPEC-ADMIN-001 plan.md §B.8).
// 오류 문구는 영문 고정(language.yaml error_messages: en)이며 `<코드>: <문장>` 형태로 코드를 앞에 둔다 —
// Payload 저장 오류로 관리자 화면 알림·REST errors[0].message에 그대로 실리므로 코드로 판정할 수 있게 한다.
// 문구에는 입력값·신청자 정보를 넣지 않는다(REQ-ADMIN-015).

// 상태 변경(신청 수정) 오류 문구 — acceptance.md §0
export const APPLICATION_UPDATE_MESSAGES = {
  RESTORE_CAPACITY_EXCEEDED: 'RESTORE_CAPACITY_EXCEEDED: Restoring this application would exceed the session capacity.',
  SESSION_BUSY: 'SESSION_BUSY: The session is being updated by another request. Try again.',
  SESSION_MISSING: 'SESSION_MISSING: This application has no session, so it cannot be changed.',
  INTERNAL_ERROR: 'INTERNAL_ERROR: The application could not be updated.',
} as const

export type ApplicationUpdateErrorCode = keyof typeof APPLICATION_UPDATE_MESSAGES
