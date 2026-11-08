# 디자인 핸드오프 — 숨비투어 (Claude Design)

> 기록일: 2026-11-08
> 디자인 원본: [숨비투어 디자인 캔버스](https://claude.ai/artifact/UvLLCUaZkT1RYBTM3PHTpD) (Claude Design, 캔버스 버전 `1794119888-8e95`)
> 근거 프롬프트: [`claude-design-prompt.md`](claude-design-prompt.md)
> 디자인 토큰: [`tokens.css`](tokens.css)

이 문서는 Claude Design으로 만든 화면을 앞으로의 화면 구현 SPEC에 연결하기 위한 기준 자료입니다. 아직 앱 코드가 없으므로(SPEC-INFRA-001 진행 중) 화면 코드는 각 SPEC의 구현 단계에서 작성합니다. 화면 SPEC을 작성할 때는 이 문서의 대응표와 디자인 결정을 근거 문서로 인용합니다.

## 1. 화면과 구현 위치 대응

경로는 `structure.md` §2의 제안 구조를 따릅니다. `[locale]` 접두어는 다국어 SPEC(로드맵 7번)에서 도입하므로, 그 전에 구현하는 화면은 접두어 없는 경로로 시작할 수 있습니다.

| 캔버스 화면 | 파일 | 구현 위치 (제안) | 담당 로드맵 |
|---|---|---|---|
| 1. 홈 · PC | `Main.dc.html` | `src/app/(frontend)/[locale]/page.tsx` | 2. 투어 카탈로그 (SPEC-INFRA-001의 임시 홈을 교체) |
| 2. 투어 목록 · PC | `Tours.dc.html` | `src/app/(frontend)/[locale]/tours/page.tsx` | 2. 투어 카탈로그 |
| 3. 투어 상세 · PC | `TourDetail.dc.html` | `src/app/(frontend)/[locale]/tours/[slug]/page.tsx` | 2. 투어 카탈로그 |
| 4. 신청 정보 입력 · PC | `Apply.dc.html` | `src/app/(frontend)/[locale]/apply/` | 3. 신청 흐름 + 정원 |
| 5. 신청 완료 · PC | `Complete.dc.html` | `src/app/(frontend)/[locale]/apply/` (접수 완료) | 3. 신청 흐름 + 정원 |
| 6. 로그인 / 회원가입 · PC | `Auth.dc.html` | `src/app/(frontend)/[locale]/login/`, `signup/` | 4. 회원 인증 |
| 7. 내 신청 내역 · PC | `MyBookings.dc.html` | `src/app/(frontend)/[locale]/my/applications/` | 4. 회원 인증 |
| 8. 관리자 · 회차별 신청 현황 | `Admin.dc.html` | `src/components/admin/` (Payload 관리자 대시보드 확장) | 6. 관리자 운영 기능 |
| 모바일 ① 홈 · 목록 · 상세 · 신청 입력 | `MobileA.dc.html` | 위 화면들의 375px 반응형 | 2, 3 |
| 모바일 ② 입력 오류 · 완료 · 로그인 · 내 신청 내역 | `MobileB.dc.html` | 위 화면들의 375px 반응형 | 3, 4 |
| 공통 컴포넌트 | `Components.dc.html` | `src/components/` | 화면을 처음 쓰는 SPEC |
| 디자인 토큰 | `Tokens.dc.html` | 전역 스타일 (`tokens.css` 참고) | 2. 투어 카탈로그 (첫 화면 SPEC) |

확인 필요: 투어 목록 화면(`/tours`)은 `structure.md` §2 디렉터리 제안에 별도 경로로 나와 있지 않습니다(랜딩이 투어 목록 역할). 로드맵 2번 SPEC에서 별도 목록 페이지를 둘지 정하고 `structure.md`를 갱신합니다.

## 2. 공통 컴포넌트 목록

`Components.dc.html` 기준입니다.

| 컴포넌트 | 쓰이는 화면 | 메모 |
|---|---|---|
| 버튼 (기본 · 보조 · 비활성) | 전체 | 높이 48px, `--radius-sm`, hover 시 `--color-accent-hover` |
| 입력창 (이름 · 이메일 · 연락처 등) | 신청 입력, 로그인/회원가입 | 테두리 `--color-input-border`, 오류는 `--status-canceled-fg` + 문구 |
| 상태 배지 | 홈, 목록, 상세, 내 신청 내역, 관리자 | 색 + 아이콘 + 글자. 모집 중 / 마감 / 대기 / 확정 / 취소 |
| 투어 카드 | 홈, 목록 | 사진 4:3, 상태 배지, 소요 시간, 가격(현장 결제), 가장 가까운 회차와 남은 자리 |
| 회차 카드 (라디오 그룹) | 투어 상세 | 마감 회차는 비활성·선택 불가, 남은 자리 / 정원 표시 |
| 인원 선택 · 동의 항목 | 신청 입력 | 개인정보 필수 동의와 선택 동의 구분 |
| 정원 진행 막대 | 관리자 | 여유 = 회색, 80% 이상 = 주황(곧 마감), 정원 도달 = 진회색 |
| 언어 전환 · 머리글 | 전체 | KO / EN 토글, 주요 메뉴(투어 · 내 신청 내역 · 로그인) |

## 3. 디자인 결정 (화면 SPEC에서 지킬 것)

- **포인트 색은 하나**: `#00737A`. 대비 수치는 `tokens.css` 주석에 기록되어 있습니다.
- **상태는 색만으로 구분하지 않음**: 배지와 진행 막대 모두 아이콘·글자를 함께 표시합니다.
- **입력 오류 색 = 취소 색** (`#B3261E`).
- **관리자 대시보드는 Payload 톤의 회색 계열**을 따로 씁니다(`--admin-*`). 포커스 표시만 accent를 공유합니다.
- **결제는 모두 현장 결제**: 가격 옆에 "현장 결제"를 함께 표시하고, 온라인 결제 UI는 없습니다.
- **정원은 신청 인원 합계 기준**: 상세 화면의 "남은 자리 N / 정원"과 관리자의 "신청 / 정원명"이 같은 계산을 써야 합니다(`structure.md` §3).
- **화면 폭**: 기준 PC 1440px, 콘텐츠 최대 1200px, 모바일 375px, 최소 터치 영역 44×44px.
- **글꼴**: Pretendard 우선, 한국어 줄바꿈은 `word-break: keep-all`.

## 4. 디자인에 남아 있는 가짜 값과 빈칸

캔버스의 내용은 기획용 예시입니다. 구현 시 실제 데이터(Payload 컬렉션)로 바꾸거나 운영자에게 받아야 합니다.

| 항목 | 캔버스 값 | 처리 |
|---|---|---|
| 투어명 · 가격 · 일정 · 정원 | 한라산 영실(45,000원) · 우도 자전거(38,000원) · 해녀 체험(55,000원) 등 | 가상 예시. `Tours` · `TourSessions` 데이터로 대체 |
| 대표 사진 · 투어 사진 | 색 블록 자리표시 + 대체 텍스트 초안 | 실제 사진 확보 후 `Media`에 업로드, 사진 위 오버레이 대비 재측정 |
| 푸터 문의 정보 | `[대표 전화번호]`, `[문의 이메일]`, `[운영 시간]`, `[사업자 정보]` | 운영자에게 받아야 함 |
| 개인정보 처리방침 링크 | `#` | 처리방침 문서 확정 후 연결 |
| 서비스명 상표 · 도메인 | 숨비투어 / Soombi Tours | 출시 전 확인 필요(`claude-design-prompt.md` 참고) |

## 5. 디자인을 고쳤을 때

1. Claude Design 캔버스에서 수정합니다.
2. 토큰이 바뀌었으면 `tokens.css`를, 화면이 추가·삭제되었으면 이 문서의 §1 대응표를 갱신합니다.
3. 이미 구현된 화면이 영향을 받으면 해당 SPEC에 변경 이력을 남깁니다.
