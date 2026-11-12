// 개인정보 수집·이용 동의 문구와 문구 버전 — SPEC-APPLY-001 REQ-APPLY-014, plan.md §B.7.
// 신청 화면(M5)과 신청 처리 함수가 이 모듈 하나만 쓴다. 다국어 SPEC(로드맵 7번)에서 언어별로 나눌 수 있게 경로 파일 밖에 둔다.
// @MX:NOTE: [AUTO] 법률 문구 초안(product.md §8.3 참고안) — 출시 전 전문가 확인 필요(가정 A9)
// @MX:NOTE: [AUTO] 문구를 고치면 PRIVACY_POLICY_VERSION 리터럴도 고쳐야 한다. 버전의 해시 부분은 consentDocument()의
//   SHA-256 앞 8자리이며, 단위 테스트(tests/unit/consent.spec.ts)가 어긋나면 실패한다. 날짜 부분은 문구를 확정한 날이다

export type NoticeItem = { label: string; text: string }
export type ConsentNotice = { title: string; items: readonly NoticeItem[] }

export const REQUIRED_CONSENT: ConsentNotice = {
  title: '개인정보 수집·이용 동의(필수)',
  items: [
    {
      label: '수집 항목',
      text: '이름, 이메일, 연락처, 신청 인원, 선택한 회차. 부정 신청 방지를 위해 접속 IP를 변환한 값(10분간 신청 횟수를 세는 데만 쓰고 그 뒤 다음 신청 처리 때 삭제)',
    },
    { label: '이용 목적', text: '투어 신청 접수와 확인, 신청 관련 연락, 현장 참가자 확인' },
    { label: '보유 기간', text: '투어 종료일(취소한 경우 취소일)부터 5년 동안 보관한 뒤 지체 없이 파기' },
    { label: '동의를 거부할 권리', text: '동의를 거부할 수 있으며, 거부하면 신청할 수 없습니다.' },
  ],
}

export const REQUESTS_CONSENT: ConsentNotice = {
  title: '요청 사항 수집·이용 동의(선택)',
  items: [
    { label: '수집 항목', text: '요청 사항' },
    { label: '이용 목적', text: '투어 진행 시 요청 반영' },
    { label: '보유 기간', text: '투어 종료 후 지체 없이 파기' },
    { label: '동의를 거부할 권리', text: '동의를 거부해도 신청할 수 있습니다.' },
  ],
}

// 요청 사항 입력란 바로 위에 두는 안내
export const SENSITIVE_INFO_NOTICE = '건강·장애 등 민감한 정보는 적지 마세요.'

// <문구 확정일>.<consentDocument()의 SHA-256 앞 8자리>. 실행 중에 계산하지 않는다(문구 변경 ⇒ 버전 변경을 테스트로 강제)
export const PRIVACY_POLICY_VERSION = '2026-11-10.8deb2c9f'

/** 고지 하나를 한 덩어리 글로 펼친다(제목 다음 줄마다 `항목: 내용`). */
export function noticeText(notice: ConsentNotice): string {
  return [notice.title, ...notice.items.map((item) => `${item.label}: ${item.text}`)].join('\n')
}

/** 버전 해시의 대상: 필수 고지 → 선택 고지 → 민감정보 안내 순서로 이어 붙인 문자열. */
export function consentDocument(): string {
  return [noticeText(REQUIRED_CONSENT), noticeText(REQUESTS_CONSENT), SENSITIVE_INFO_NOTICE].join('\n\n')
}
