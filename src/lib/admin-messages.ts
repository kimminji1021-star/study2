// 관리자 운영 문구 모음(SPEC-ADMIN-001 plan.md §B.8).
// 오류 문구는 영문 고정(language.yaml error_messages: en)이며 `<코드>: <문장>` 형태로 코드를 앞에 둔다 —
// Payload 저장 오류로 관리자 화면 알림·REST errors[0].message에 그대로 실리므로 코드로 판정할 수 있게 한다.
// 문구에는 입력값·신청자 정보를 넣지 않는다(REQ-ADMIN-015).

// 상태 변경(신청 수정) 오류 문구 — acceptance.md §0
export const APPLICATION_UPDATE_MESSAGES = {
  RESTORE_CAPACITY_EXCEEDED: 'RESTORE_CAPACITY_EXCEEDED: Restoring this application would exceed the session capacity.',
  SESSION_BUSY: 'SESSION_BUSY: The session is being updated by another request. Try again.',
  SESSION_MISSING: 'SESSION_MISSING: This application has no session, so it cannot be changed.',
  // 요청 사항 삭제 표시가 있는 수정에서만 나온다(plan.md §B.2 6번). 엔드포인트는 본문 {"code":"REQUESTS_EMPTY"}로 바꿔 내보낸다
  REQUESTS_EMPTY: 'REQUESTS_EMPTY: The requests of this application are already empty.',
  INTERNAL_ERROR: 'INTERNAL_ERROR: The application could not be updated.',
} as const

export type ApplicationUpdateErrorCode = keyof typeof APPLICATION_UPDATE_MESSAGES

// 관리자 첫 화면의 회차 현황 표 문구(한국어, plan.md §B.6). 열 머리글 순서가 표의 열 순서다
export const SESSION_DASHBOARD_UI = {
  caption: '다가오는 회차 현황',
  headers: ['투어', '시작 일시', '정원', '대기', '확정', '남은 자리', '상태', '참가자 명단'],
  unpublished: '비공개',
  status: { open: '모집 중', closed: '마감' },
  csvLink: 'CSV 내려받기',
  empty: '다가오는 회차가 없습니다',
} as const

// 관리자 상세 화면의 요청 사항 삭제 문구(한국어, plan.md §B.4)
export const CLEAR_REQUESTS_UI = {
  button: '요청 사항 삭제',
  heading: '요청 사항을 삭제할까요?',
  body: '요청 사항 글 전체가 지워지며 되돌릴 수 없습니다. 삭제 일시와 작업 기록이 남습니다.',
  confirm: '삭제',
  confirming: '삭제 중…',
  cancel: '취소',
  success: '요청 사항을 삭제했습니다.',
  failed: '요청 사항을 삭제하지 못했습니다.',
} as const
