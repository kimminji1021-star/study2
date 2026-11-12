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
    // 투어는 유료(현장 결제)라 신청이 거래 기록이 된다 — 전자상거래법 시행령 제6조(계약·청약철회·대금결제 기록 5년)
    {
      label: '보유 기간',
      text: '투어 종료일(취소한 경우 취소일)부터 5년 동안 보관한 뒤 지체 없이 파기(「전자상거래 등에서의 소비자보호에 관한 법률」에 따른 거래 기록 보존)',
    },
    { label: '동의를 거부할 권리', text: '동의를 거부할 수 있으며, 거부하면 신청할 수 없습니다.' },
  ],
}

// 민감정보(개인정보 보호법 제23조)는 받지 않는다. 받으려면 별도 동의가 필요하므로 수집 항목에서 명시적으로 뺀다
export const REQUESTS_CONSENT: ConsentNotice = {
  title: '요청 사항 수집·이용 동의(선택)',
  items: [
    { label: '수집 항목', text: '요청 사항(건강·장애 등 민감정보 제외)' },
    { label: '이용 목적', text: '투어 진행 시 요청 반영' },
    { label: '보유 기간', text: '투어 종료 후 지체 없이 파기' },
    { label: '동의를 거부할 권리', text: '동의를 거부해도 신청할 수 있습니다.' },
  ],
}

// 요청 사항 입력란 바로 위에 두는 안내
// @MX:NOTE: [AUTO] "확인하는 즉시 삭제"는 운영 약속이다 — 관리자가 민감정보를 발견하면 지우는 절차가 출시 전에 있어야 한다
export const SENSITIVE_INFO_NOTICE =
  '건강 상태·장애·복용 약, 종교·신념, 정치적 견해 등 민감한 정보는 적지 마세요. 적힌 경우 확인하는 즉시 삭제합니다.'

// 만 14세 이상 확인 체크 상자에 연결하는 안내(개인정보 보호법 제22조의2 — 만 14세 미만은 법정대리인 동의 필요)
export const AGE_NOTICE = '만 14세 이상만 직접 신청할 수 있습니다. 만 14세 미만은 보호자가 신청해 주세요.'

// <문구 확정일>.<consentDocument()의 SHA-256 앞 8자리>. 실행 중에 계산하지 않는다(문구 변경 ⇒ 버전 변경을 테스트로 강제)
export const PRIVACY_POLICY_VERSION = '2026-11-12.99052510'

/** 고지 하나를 한 덩어리 글로 펼친다(제목 다음 줄마다 `항목: 내용`). */
export function noticeText(notice: ConsentNotice): string {
  return [notice.title, ...notice.items.map((item) => `${item.label}: ${item.text}`)].join('\n')
}

/** 버전 해시의 대상: 필수 고지 → 선택 고지 → 민감정보 안내 → 나이 안내 순서로 이어 붙인 문자열. */
export function consentDocument(): string {
  return [noticeText(REQUIRED_CONSENT), noticeText(REQUESTS_CONSENT), SENSITIVE_INFO_NOTICE, AGE_NOTICE].join('\n\n')
}
