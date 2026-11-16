# SPEC-LANDING-001 진행 기록

## §E.1 Plan-phase Audit-Ready Signal

```yaml
plan_status: audit-ready
plan_complete_at: 2026-11-16
tier: M
artifacts: [interview.md, spec.md, plan.md, acceptance.md, spec-compact.md]
req_count: 16
ac_count: 16
depends_on: [SPEC-TOUR-001, SPEC-APPLY-001]   # 둘 다 status: completed
related_specs: [SPEC-INFRA-001, SPEC-ADMIN-001]
base_head: b8087f8   # = origin/main (계획 시점)
author: manager-spec
needs_clarification: 0
spec_version: "0.1.1"   # 2026-11-16 plan-audit 1회차(FAIL 0.79) must-fix D1~D5 + 선택 O-2·O-4·O-5·O-7·O-8 반영, REQ/AC 16/16 유지
plan_audit_history:
  - "review-1: FAIL 0.79 (.moai/reports/plan-audit/SPEC-LANDING-001-review-1.md) → v0.1.1 수정, 2회차 대기"
tier_rationale: "M 유지 — 제품 코드 약 350~500줄(M 범위), 파일 지침 초과분은 테스트·글꼴 파일, 분할 기준(plan.md §A.3) 불변"
spec_id_check: "SPEC-LANDING-001 → PASS (^SPEC(-[A-Z][A-Z0-9]*)+-[0-9]{3}$), .moai/specs/ 충돌 없음"
user_confirmation_recommended:   # 초안 작성자 결정 중 사용자 확인 권장(interview.md 굵은 항목)
  - "대표 사진 대체 텍스트 = 미디어 alt(장식용 아님)"
  - "사진 위 균일 덮개 rgba(29, 29, 31, 0.65) — 순백 사진에서도 흰 글자 5.24:1(반올림하지 않은 합성색 rgb(108.1, 108.1, 109.4) 기준), 대신 밝은 사진이 어두워짐"
  - "대표 사진으로 고른 미디어는 비공개 투어 사진이어도 공개됨(가정 A7, 필드 설명으로 안내)"
  - "추천 투어 = /tours 정렬 앞 6개(모집 중 회차 없는 투어가 남는 자리를 채움)"
  - "알 수 없는 주소의 404 = (frontend)/[...slug] 모든 경로 받기 페이지"
  - "글꼴 = 공식 PretendardVariable.woff2 2,057,688바이트 원본, next/font/local, display swap, preload false"
supersedes_clauses:
  - "SPEC-INFRA-001 REQ-INFRA-005 중 '/는 숨비투어·준비 중 임시 홈' 부분 (Tailwind 범위 조항은 유지)"
  - "SPEC-INFRA-001 AC-INFRA-008 중 홈 부분 (h1 '숨비투어', '준비 중' 문구, 임시 홈 Tailwind 유틸리티 값 — tests/e2e/home.spec.ts 11~32). 같은 AC의 expectE2ePort 단언은 유지"
  - "SPEC-TOUR-001 REQ-TOUR-014 (임시 홈 유지 + /tours 링크)"
  - "SPEC-TOUR-001 REQ-TOUR-005 중 익명 미디어 읽기 범위 (홈 대표 사진 추가)"
  - "SPEC-TOUR-001 AC-TOUR-013 중 '/가 사전 렌더링됨' 구조 단언, AC-TOUR-015 (홈의 /tours 링크 1개)"
research_evidence:   # plan.md §A.2 요약
  payload: "3.93.0 — globals/config/sanitize.js 27~37(defaultAccess), auth/executeAccess.js 10~15(read 거부 시 Forbidden), uploads/checkFileAccess.js 5~16(파일 주소 = media read 규칙), globals/operations/local/findOne.js 5(overrideAccess 기본 true), drizzle traverseFields.js 731~750(업로드 FK ON DELETE SET NULL)"
  next: "16.4.5 — next/font/local index.d.ts 2~20(옵션), validate 21(display swap·preload true 기본), docs font.md 184~196·224~240, image.md 266~294(preload, priority 폐기 예고), not-found.md 49~69(global-not-found 실험)"
  font_license: "SIL OFL 1.1, Copyright (c) 2021 Kil Hyung-jin, 예약 이름 Pretendard — github.com/orioncactus/pretendard/blob/main/LICENSE (2026-11-16 확인)"
  font_files: "v1.3.9 PretendardVariable.woff2 2,057,688B / dynamic-subset 92개 / Std 291,680B(한글 없음) / GOV 5,405,612B — GitHub API (2026-11-16)"
legal_review_required: false   # OFL 원본 그대로 + 라이선스 전문 동봉. 처리방침 본문은 범위 밖
pre_launch_carry_over:   # sync 단계에서 출시 전 점검 목록으로 옮김
  - "바닥글 '개인정보 처리방침(준비 중)'을 처리방침 문서 링크로 교체 — 배포 SPEC(로드맵 8번)"
  - "운영 대표 사진 크기·형식(sharp 없음, 원본 그대로 전송) 점검 — 배포 SPEC"
  - "업로드 저장소 전환 뒤 대표 사진 파일 주소(serverURL)와 익명 접근 재확인 — 배포 SPEC"
carry_over_followups:   # 이 SPEC 범위 밖 — 후속 SPEC 후보
  - "글꼴 첫 방문 약 2MB → 필요하면 공식 동적 분할본(92개, unicode-range) 직접 호스팅 검토"
  - "TourImage.tsx의 next/image priority(Next 16 폐기 예고) → preload 전환"
  - "listPublishedTours가 공개 투어 전체를 읽음 — 투어가 많아지면 홈용 6개만 읽는 질의"
```

## §E.2 Run-phase Evidence

_<pending run-phase — manager-develop>_

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase — manager-develop>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase — manager-docs>_

## plan-audit 2회차 결과 (2026-11-16)

PASS 0.93 (0.79 → 0.93). 반드시 고칠 항목 없음. 선택 지적은 run 단계에서 반영한다.

- O2-1: AC-005 (b)에 "h의 preload 링크가 1개 이상" 긍정 단언을 추가해 (a)의 0개 단언이 잘못된 선택자로 우연히 통과하지 않게 한다
- O2-2: REQ-LANDING-008 "익명 접근 규칙으로만" 문구는 접근 규칙 내부 조회(overrideAccess: true)와 구분된다는 점을 plan §B.2 근거대로 따른다
- O2-3: Tier M 근거 중복 문장 정리(문서 정리 단계)
