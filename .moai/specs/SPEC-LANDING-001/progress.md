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

### 기준선 (plan.md §C, 2026-11-16, HEAD `4eac201` = 계획 커밋, 코드는 `b8087f8`과 같음)

긴 출력: `.moai/state/verify/landing-m1/baseline-*.log`(gitignore 대상).

| 점검 | 명령 | 결과 |
|---|---|---|
| 범위 파일 변화 | `git diff --stat b8087f8 -- src tests pnpm-lock.yaml package.json` | 출력 없음 |
| 작업 트리 | `git status --short` | 출력 없음(깨끗한 작업 트리) |
| DB | `docker compose ps --format "{{.Service}} {{.Health}}"` | `postgres healthy` |
| 의존성 | `pnpm install --frozen-lockfile` | 종료 0 |
| 단위·통합 | `pnpm test` | 종료 0, `Test Files  39 passed (39)`, `Tests  609 passed (609)` |
| E2E | `pnpm e2e` | 종료 0, `60 passed (1.3m)` |
| 린트 | `pnpm lint` | 종료 0 |
| 포맷 | `pnpm format:check` | 종료 0, `All matched files use Prettier code style!` |
| 타입 | `pnpm typecheck` | 종료 0 |
| 원래 값 파일 | `.moai/state/verify/landing/home-settings-original.json` | 시작 전 없음(디렉터리도 없음) |

### M1 — 홈 화면 설정과 미디어 공개 범위

**RED** (구현 전, `npx vitest run --coverage.enabled=false tests/unit/home-page.spec.ts tests/integration/home-settings.spec.ts tests/integration/home-page.spec.ts`)

1차(모듈 없음, 종료 1, `.moai/state/verify/landing-m1/red.log`):

```
 FAIL  |unit| tests/unit/home-page.spec.ts [ tests/unit/home-page.spec.ts ]
Error: Cannot find module '../../src/lib/home-page' imported from …/tests/unit/home-page.spec.ts
 Test Files  3 failed (3)
      Tests  no tests
```

2차(빈 골격 — 동작 실패 확인, 종료 1, `.moai/state/verify/landing-m1/red-behavioral.log`):

```
 FAIL  |integration| tests/integration/home-settings.spec.ts > 홈 화면 설정(실제 DB)
APIError: The global with slug home-settings can't be found.
 FAIL  |unit| tests/unit/home-page.spec.ts > AC-LANDING-004 문구 결정 함수 > 기본 문구가 정확히 정해진 값이다
AssertionError: expected '' to be '제주를 가장 가까이, 숨비투어' // Object.is equality
 FAIL  |unit| tests/unit/home-page.spec.ts > AC-LANDING-007 추천 투어 자르기 > 추천 개수 상한은 6이다
AssertionError: expected +0 to be 6 // Object.is equality
 FAIL  |unit| tests/unit/home-page.spec.ts > AC-LANDING-005 (d) 대표 사진 변환 > 채워지지 않은 ID(숫자)·null·undefined는 null이다
TypeError: toImage is not a function
 FAIL  |integration| tests/integration/home-page.spec.ts > … > AC-LANDING-008 질의 수 > req 없이 부른 home-settings 조회는 정확히 1회이고 …
Error: not implemented
 Test Files  3 failed (3)
      Tests  19 failed | 13 skipped (32)
```

**GREEN** (같은 명령, 종료 0, `.moai/state/verify/landing-m1/green-1.log`): `Test Files  3 passed (3)`, `Tests  32 passed (32)`

**테이블·열 이름 확인** (Node `pg` 스크립트로 `information_schema.columns`·`pg_constraint` 조회 — psql 복합 명령 대신):

```
columns: ["id:integer","hero_image_id:integer","headline:character varying","intro:character varying","updated_at:timestamp with time zone","created_at:timestamp with time zone"]
fk: [{"conname":"home_settings_hero_image_id_media_id_fk","def":"FOREIGN KEY (hero_image_id) REFERENCES media(id) ON DELETE SET NULL"}]
```

→ 테이블 `home_settings`, 열 `hero_image_id`·`headline`·`intro` — plan.md §B.1 예상과 같다. AC-LANDING-016 SQL을 고칠 필요 없음.

**전역 설정 원래 값(M1 직후)**: `rows: [{"id":1,"hero_image_id":null,"headline":null,"intro":null}]` → `값 ?? null`로 맞추면 세 필드 모두 `null`. 테스트가 끝난 뒤 `.moai/state/verify/landing/home-settings-original.json` 없음(복원 확인 뒤 삭제됨).

**표식 잔여(M1 테스트 뒤, 같은 스크립트)**: `tours test-%: 0`, `media test-%: 0`, `users @example.test: 0`, `home_settings test-%: 0`, `applications example.test: 1` — 남은 1건은 ID 2033(2026-11-12 생성, 사용자의 개발용 신청)이며 이 SPEC의 테스트 데이터가 아니다.

**AC 상태 (M1 범위)**

| AC | 상태 | 근거 |
|---|---|---|
| AC-LANDING-001 | PASS | `tests/integration/home-settings.spec.ts` "AC-LANDING-001" 4개 사례(slug·라벨, 필드·형식·길이, 40/41자, 120/121자) |
| AC-LANDING-002 (통합 부분) | PASS | 같은 파일 "AC-LANDING-002" 3개 사례. E2E·수동 부분은 M4 |
| AC-LANDING-003 (통합 부분) | PASS | 같은 파일 "AC-LANDING-003" 1~4단계 + 익명 depth 1 채우기. E2E 파일 주소 부분은 M4. 기존 AC-TOUR-006(`catalog-access.spec.ts`) 계속 통과 |
| AC-LANDING-005 (c) 통합 | PASS | 같은 파일 "AC-LANDING-005 (c)" — 미디어 삭제 뒤 `heroImage` null(FK `ON DELETE SET NULL`), `getHomePageData().heroImage` null |
| AC-LANDING-005 (d) | PASS | `tests/unit/home-page.spec.ts` "AC-LANDING-005 (d)" — ID 숫자·null·url 없음 → null |
| AC-LANDING-004 (단위 부분) | PASS | `tests/unit/home-page.spec.ts` "AC-LANDING-004". E2E 부분은 M3 |
| AC-LANDING-007 (단위·통합 부분) | PASS | 단위 0·3·6·8개, 통합 `listPublishedTours` 앞 6개·남은 자리·비공개 제외. 빈 목록 렌더링(`renderToStaticMarkup`)과 E2E는 M3 |
| AC-LANDING-008 | PASS | `tests/integration/home-page.spec.ts` "AC-LANDING-008" — 투어 5개(대표 이미지·회차 2개·대기 신청) 추가 전후 질의 수 같음, connect = query, `req` 없는 `home-settings` 조회 1회(`overrideAccess: false`, 사용자 없음) |

**구현 메모**

- `mediaReadAccess`는 익명 미디어 읽기 한 번에 `findGlobal`(depth 0, `select: { heroImage: true }`, `req` 전달)을 1회 더 부른다. 질의 수 고정 단언(AC-LANDING-008)이 이 호출을 포함한 채 통과했다(R10 해당 없음).
- `src/app/(payload)/admin/importMap.js`: `pnpm generate:importmap` 뒤 내용 변화 없음 → 커밋하지 않음.
- `src/payload-types.ts`: `pnpm generate:types`로 다시 만듦(`HomeSetting` 타입, `GlobalSlug`에 `home-settings`).
- 공유 개발 DB에 `home_settings` 테이블이 개발 모드 스키마 반영(push)으로 생겼다. 이 SPEC 이전 코드로 개발 서버를 다시 시작하면 Payload가 이 테이블을 지우려 할 수 있다(사용자 확인 필요 시 경고가 뜸) — 잔여 위험.

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase — manager-develop>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase — manager-docs>_

## plan-audit 2회차 결과 (2026-11-16)

PASS 0.93 (0.79 → 0.93). 반드시 고칠 항목 없음. 선택 지적은 run 단계에서 반영한다.

- O2-1: AC-005 (b)에 "h의 preload 링크가 1개 이상" 긍정 단언을 추가해 (a)의 0개 단언이 잘못된 선택자로 우연히 통과하지 않게 한다
- O2-2: REQ-LANDING-008 "익명 접근 규칙으로만" 문구는 접근 규칙 내부 조회(overrideAccess: true)와 구분된다는 점을 plan §B.2 근거대로 따른다
- O2-3: Tier M 근거 중복 문장 정리(문서 정리 단계)
