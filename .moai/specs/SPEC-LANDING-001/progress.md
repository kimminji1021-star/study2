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

### M2 — 공통 머리글·바닥글·404·글꼴 (2026-11-16, 기준 HEAD `cb480c6`)

긴 출력: `.moai/state/verify/landing-m2/*.log`(gitignore 대상).

**글꼴 파일 (첫 작업, plan.md §B.8)**

| 항목 | 값 |
|---|---|
| 출처 주소 | `https://github.com/orioncactus/pretendard/raw/v1.3.9/packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2` (태그 고정, `curl -sSL` → `http=200 size=2057688`) |
| 크기 | 2,057,688바이트 (계획 값과 같음) |
| SHA-256 | `9599f12fd42fc0bce1cd50b47a0c022e108d7aa64dd0d1bb0ed44f3282d900b4` (`sha256sum`) |
| 파일 시그니처 | 첫 4바이트 `wOF2` |
| 라이선스 | `https://github.com/orioncactus/pretendard/raw/v1.3.9/LICENSE` 원문 그대로 → `src/app/(frontend)/fonts/OFL.txt` (4,418바이트, SHA-256 `d31ddd9f2bed32fd7e302a205cf2380ba0de6529152d239ef99cfb6f261bfc04`, CR 0개). 1행 `Copyright (c) 2021, Kil Hyung-jin (…)`, 10행 `SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007` |
| 무게 축 | 공식 `packages/pretendard/dist/web/variable/pretendardvariable.css`(v1.3.9)의 `font-weight: 45 920` |
| `next/font/local` 설정 | `src: './fonts/PretendardVariable.woff2'`, `weight: '45 920'`, `display: 'swap'`, `preload: false`, `variable: '--font-pretendard'`, `adjustFontFallback` 기본값(`'Arial'`). `src/app/(frontend)/layout.tsx`에서 부르고 `<html className={pretendard.variable}>` |
| 토큰 | `--font-sans: var(--font-pretendard, "Pretendard Variable"), "Pretendard Variable", Pretendard, -apple-system, …, sans-serif` |

파일은 잘라 내거나 이름을 바꾸지 않았다. 저장소 규칙 테스트가 크기·SHA-256을 상수로 단언한다.

**RED** (구현 전 — 글꼴 파일만 놓은 상태)

단위(`npx vitest run --coverage.enabled=false tests/unit/repo-rules.spec.ts`, 종료 1, `red-unit.log`):

```
 FAIL  |unit| tests/unit/repo-rules.spec.ts > AC-LANDING-012 Pretendard 직접 호스팅 > next/font/local을 import하는 파일이 1개 이상 있고 모두 (frontend) 아래에 있다
AssertionError: next/font/local을 import하는 파일이 있어야 한다: expected 0 to be greater than or equal to 1
 Test Files  1 failed (1)
      Tests  1 failed | 68 passed (69)
```

E2E(`pnpm exec playwright test tests/e2e/layout.spec.ts tests/e2e/home.spec.ts`, `red-e2e.log`, `13 failed`, `7 passed (5.5m)`) — 발췌:

```
x   4 … AC-LANDING-009 공통 머리글 › 공개 화면 6개의 머리글은 하나이고 …
    Error: 홈
    Locator:  getByRole('banner')
    Expected: 1
    Received: 0
x   8 … AC-LANDING-011 … › /no-such-page는 머리글·바닥글이 있는 사용자 화면 404다
    Expected: "페이지를 찾을 수 없습니다"
    Received: "404"
x  13 … AC-LANDING-012 … › /는 같은 출처의 /_next/static/media/ 글꼴만 받고 …
    Error: font 요청이 1개 이상 있어야 한다
    Expected: >= 1
    Received:    0
x  16 … AC-LANDING-014 … › /의 첫 Tab은 보이는 본문 바로가기이고 …
    Locator:  locator(':focus')
    Expected: "본문 바로가기"
    Received: "투어 둘러보기"
x  19 … AC-LANDING-014 … › /에서 동작 줄이기를 켜면 모든 전환 시간이 0.01초 이하다
    Error: 기본 설정에서 전환 시간이 0보다 큰 요소가 있어야 한다
    Expected: >= 1
    Received:    0
x  20 … AC-LANDING-014 … › /tours에서 동작 줄이기를 켜면 …
    - Array []
    + Array [
    +   0.15,
```

통과한 7개는 기존 `home.spec.ts` 3개(아직 머리글이 없어 깨지지 않음), `/admin` 쪽 2개, `/api/tours` 1개, 애니메이션 없음 1개다 — 모두 "바뀌면 안 되는 것"을 보는 단언이다.

**GREEN** (같은 E2E 명령, 종료 0, `green-e2e.log`): `20 passed (1.0m)`. 단위 같은 명령, 종료 0, `green-unit.log`: `Tests  69 passed (69)`.

**구현**

- `src/components/SiteHeader.tsx`: 흰 면·아래 장식선, 링크 `숨비투어`(`/`)·`투어`(`/tours`, `nav aria-label="주요 메뉴"` 안) 두 개, 둘 다 `min-h`·`min-w` 44px. 제목 요소·버튼 없음
- `src/components/SiteFooter.tsx`: 연회색 면(`--surface-parchment`)·위 장식선, `--text-small`·`--color-text-2`, `© 숨비투어 · 개인정보 처리방침(준비 중)` 한 줄, 링크 없음
- `src/app/(frontend)/layout.tsx`: `next/font/local` 글꼴, `본문 바로가기`(`href="#main-content"`, 평소 화면 위로 밀어 두고 포커스 때 `translate-y-0`, 흰 면·높이 44px) → 머리글 → `<div id="main-content" tabIndex={-1} className="flex-1">` → 바닥글. `body`는 `flex min-h-screen flex-col`. `metadata.description`을 `제주의 소규모 투어와 다가오는 회차를 한눈에 확인하세요.`로 바꿈
- `src/app/(frontend)/[...slug]/page.tsx`: `notFound()`만 부름(`@MX:NOTE` — 관리자·API를 가리지 않는 이유)
- `globals.css`: `#main-content:focus { outline: none }`(계층 밖 — `tokens.css`의 `:focus-visible`을 이기려면 같은 계층 밖이어야 함), 동작 줄이기 규칙(plan.md §B.9 그대로)
- `tokens.css`: `--font-sans` 앞에 `var(--font-pretendard, "Pretendard Variable")`
- 기존 단언 갱신(plan.md M2 "깨지는 단언만"): `tests/e2e/home.spec.ts`의 `getByText(/준비 중/)` → `main` 안(바닥글 `개인정보 처리방침(준비 중)`과 겹침), `a[href="/tours"]` 1개 → `main a[href="/tours"]`(머리글 링크가 생김). 제목 36px 단언은 그대로(M3에서 파일 전체 교체)

**빌드** (`pnpm build`, 종료 0, `build.log`): 경로 표에 `ƒ /[...slug]`가 요청 시점 렌더링으로 나타나고, `/`는 아직 `○`(정적) — 홈의 `connection()` 전환은 M3(AC-LANDING-015) 범위다.

**AC 상태 (M2 범위)**

| AC | 상태 | 근거 |
|---|---|---|
| AC-LANDING-009 | PASS | `tests/e2e/layout.spec.ts` "AC-LANDING-009" 3개(공개 화면 6개 머리글 구조, 이동 2건, `/admin`에 `숨비투어`(`/`) 링크 없음) |
| AC-LANDING-010 | PASS | 같은 파일 "AC-LANDING-010" — 6개 화면 바닥글 1개·두 문구·링크 0개, 페이지 `a` 1개 이상 먼저 단언 뒤 `href` 없음·빈 값·`#` 0개 |
| AC-LANDING-011 | PASS | 같은 파일 "AC-LANDING-011" 4개 + 전체 `pnpm e2e`에서 기존 관리자 E2E 4개 파일 통과(아래) |
| AC-LANDING-012 | PASS | 저장소 규칙 5개(`repo-rules.spec.ts` "AC-LANDING-012") + E2E 2개(같은 출처 `/_next/static/media/` 글꼴, 외부 요청 0건, 첫 글꼴 이름의 `FontFace` `loaded`, `"Pretendard Variable"` 포함·마지막 `sans-serif`, `/admin`이 같은 글꼴 경로를 요청하지 않음) |
| AC-LANDING-014 (공통 부분) | PASS | 같은 파일 "AC-LANDING-014" 6개 — 6개 화면 랜드마크·`h1`·`lang`, `/`·`/tours` 본문 바로가기, `/` 애니메이션·`video`·`marquee` 없음(두 설정), `/`·`/tours` 동작 줄이기 전환 시간. 홈 `h2`·카드 `h3`은 M3 |

**M2 품질 게이트** (같은 작업 트리, 순서대로)

| 점검 | 명령 | 결과 |
|---|---|---|
| 생성 파일 | `pnpm generate:types` | 종료 0, `git status`에 `src/payload-types.ts` 변경 없음 |
| 타입 | `pnpm typecheck` | 종료 0 |
| 빌드 | `pnpm build` | 종료 0 (`ƒ /[...slug]`) |
| 단위·통합 | `pnpm test` | 종료 0, `Test Files  42 passed (42)`, `Tests  646 passed (646)` (기준 641 + 저장소 규칙 5), `All files` 줄 커버리지 99.35% |
| E2E | `pnpm e2e` | 종료 0, `77 passed (2.5m)` (기준 60 + `layout.spec.ts` 17) |
| 린트 | `pnpm lint` | 종료 0 |
| 포맷 | `pnpm format:check` | 종료 0, `All matched files use Prettier code style!` |
| 보존 | `git diff --stat b8087f8 -- pnpm-lock.yaml package.json .prettierignore eslint.config.mjs pnpm-workspace.yaml .gitattributes src/lib/occupancy.ts src/lib/session-availability.ts src/lib/catalog-order.ts src/lib/submit-application.ts` | 출력 없음 |
| 표식 잔여 | Node `pg` 스크립트(AC-LANDING-016 SQL 조건) | `tours test-%: 0`, `media test-%: 0`, `users @example.test: 0`, `home_settings test-%: 0`, `applications example.test: 1`(ID 2033 — 사용자의 개발용 신청, M1 기록과 같음) |
| 원래 값 파일 | `.moai/state/verify/landing/home-settings-original.json` | 없음(M2는 전역 설정을 바꾸지 않음) |

**과정에서 고친 것**

- 첫 전체 `pnpm e2e`(`e2e.log`)는 `2 failed`, `2 did not run`, `73 passed`였다. 원인 하나는 이 마일스톤의 시험 코드: `layout.spec.ts`의 `afterAll`이 `payload.destroy()`를 불러, 같은 워커에서 다음에 도는 `participants-csv.spec.ts`가 닫힌 Payload 단일 인스턴스를 받아 `beforeAll`이 멈췄다(DB 쪽 잠금은 없음을 `pg_stat_activity`로 확인). 다른 E2E 파일처럼 정리만 하고 닫지 않게 고쳤다. 다시 돌린 전체 실행이 위 `77 passed`다.
- 첫 커밋 시도는 PC가 꺼지며 끊겼다(pre-commit 훅이 실패 문구 없이 종료, `HEAD`는 `cb480c6` 그대로). 2026-11-17 재시작 뒤(PostgreSQL 컨테이너 재시작, `postgres healthy`) 글꼴 크기·SHA-256(위 표와 같음)을 다시 확인하고 게이트를 처음부터 다시 돌렸다: `pnpm typecheck` 종료 0, `pnpm build` 종료 0, `pnpm test` 종료 0 `Tests  646 passed (646)`, `pnpm e2e` 종료 0 `77 passed (1.8m)`, `pnpm lint` 종료 0, `pnpm format:check` 종료 0, 보존 diff 출력 없음, 표식 잔여는 위와 같음(`resume-*.log`).
- 같은 첫 실행의 나머지 실패 하나는 `admin-ops.spec.ts:324`(요청 사항 삭제 뒤 상세 화면 다시 열기)의 `page.goto: net::ERR_ABORTED`였다 — 관리자 화면((payload) 레이아웃, 이 마일스톤과 무관)에서 삭제 직후 화면 자체 이동과 테스트의 이동이 겹친 것으로 보이며, 다시 돌린 실행에서는 통과했다(`ok 13 … (9.3s)`). 간헐 실패 후보로 기록한다(잔여 위험).

### M3 — 홈 화면: 히어로와 추천 투어 (2026-11-17, 기준 HEAD `b82065b`)

긴 출력: `.moai/state/verify/landing-m3/*.log`(gitignore 대상).

**RED** (구현 전)

단위·통합(`npx vitest run --coverage.enabled=false tests/unit/contrast.spec.ts tests/unit/repo-rules.spec.ts tests/integration/home-page.spec.ts`, 종료 1, `red-vitest.log`):

```
 FAIL  |integration| tests/integration/home-page.spec.ts [ tests/integration/home-page.spec.ts ]
Error: Cannot find module '../../src/components/RecommendedTours' imported from …/tests/integration/home-page.spec.ts
 FAIL  |unit| tests/unit/contrast.spec.ts > AC-LANDING-006 … > 덮개 토큰은 rgba(29, 29, 31, 0.65)이고, 순백 위 합성색은 반올림하지 않은 rgb(108.1, 108.1, 109.4)다
AssertionError: expected { r: 29, g: 29, b: 31, a: 0.6 } to deeply equal { r: 29, g: 29, b: 31, a: 0.65 }
 FAIL  |unit| tests/unit/contrast.spec.ts > AC-LANDING-006 … > 흰 글자(--on-dark) / 덮개 최악 배경 = 5.24이고 본문 기준 4.5 이상이다
AssertionError: expected 4.45 to be 5.24 // Object.is equality
 FAIL  |unit| tests/unit/contrast.spec.ts > AC-LANDING-006 … > 흰 버튼 경계·포커스 외곽선 / 덮개 최악 배경 = 5.24이고 UI 기준 3 이상이다
AssertionError: expected 4.45 to be 5.24 // Object.is equality
 FAIL  |unit| tests/unit/repo-rules.spec.ts > AC-TOUR-013 요청 시점 렌더링 > src/app/(frontend)/page.tsx는 next/server의 connection을 import하고 await로 호출한다
AssertionError: expected '// 임시 홈 페이지 — 실제 홈 화면 디자인 전까지 쓰는 안내 페…' to match /\bimport\s*\{[^}]*\bconnect…/server['"]
 Test Files  3 failed (3)
      Tests  4 failed | 76 passed (80)
```

같은 RED에서 14.91·16.83·15.46·2.65 사례는 이미 통과했다 — 토큰 값이 바뀌지 않은 쌍이고, 계산 도우미가 plan.md §B.5 수치를 그대로 재현함을 보여 준다(0.6 → 4.45도 계획 표와 같음).

E2E(`pnpm exec playwright test tests/e2e/home.spec.ts`, 종료 1, `red-e2e.log`, `9 failed`, `2 passed (2.9m)`) — 발췌:

```
x 1 … AC-LANDING-004 … › 설정이 비면 h1 → 소개 → 투어 둘러보기 순서로 …   Expected: 1  Received: 0   (h1을 담은 section 없음)
x 2 … AC-LANDING-004 … › 사용자 문구는 …   Expected: "test-f21c6fec <b>굵게</b>"
x 3 … AC-LANDING-004 … › 홈 화면에 임시 홈의 준비 중 안내가 없다   Expected: 0  Received: 1
x 4 … AC-LANDING-005 … › (a) …   Expected: "rgb(39, 39, 41)"
x 5 … AC-LANDING-005 … › (b) …   Expected: 1  Received: 0
x 7 … AC-LANDING-006 … › …   Expected: "rgba(29, 29, 31, 0.65)"
x 8 … AC-LANDING-007 … › …   Expected: 1  Received: 0
x 9 … AC-LANDING-014 … › …   Expected: >= 1  Received: 0
x10 … AC-LANDING-015 … › …   Expected: "제주를 가장 가까이, 숨비투어"  Received: "숨비투어"
```

통과한 2개는 (c)(이미지 0개 — 임시 홈에도 이미지가 없어 "바뀌면 안 되는 것" 쪽 단언)와 스크린숏 생성(단언 없음)이다. RED 실행 뒤에도 원래 값 파일은 남지 않았다(복원 확인 뒤 삭제).

**GREEN** — 단위·통합 같은 명령 종료 0, `green-vitest.log`: `Test Files  3 passed (3)`, `Tests  86 passed (86)`. E2E 같은 명령: 첫 실행 `10 passed`·`1 failed`(`green-e2e.log`) — 실패는 시험 코드의 선택자 결함(`cardOf`가 `has:`에 바깥 범위에서 만든 로케이터를 넘겨 절대 경로가 됨, `locator.innerText` 시간 초과)이라 CSS `article:has(a[href="/tours/<slug>"])`로 고쳤다. 다시 돌린 실행 종료 0, `11 passed (24.4s)`(`green-e2e-2.log`).

**구현**

- `src/components/HomeHero.tsx`: `section[aria-labelledby=hero-heading][data-on-dark]`, 바탕 `--surface-dark`. 사진이 있으면 `next/image`(`fill`·`unoptimized`·`preload`·`sizes="100vw"`·`object-cover`, `alt` = 미디어 alt) + `div[data-hero-overlay]`(`--overlay-photo`, `@MX:NOTE` 대비 수치). 사진이 없으면 두 층 모두 그리지 않음. `h1#hero-heading`(`--text-display`·600·`--tracking-display`) → 소개 `p`(`--text-h3`, 흰색) → `투어 둘러보기`(`/tours`, 흰 알약·짙은 글자, hover `--color-surface`, `min-h` 48px). PC `min-height: min(88vh, 760px)`, 모바일은 내용 높이 + 위아래 80px
- `src/components/RecommendedTours.tsx`: 흰 면, 가운데 `h2#recommended-heading` `추천 투어`, 카드 격자(`/tours`와 같은 `sm:2열·lg:3열`) `TourCard headingLevel="h3"`, 0개면 `지금은 공개된 투어가 없습니다.`, 아래 가운데 `투어 전체 보기`(`/tours`, 테두리 알약, 포인트 색 — 흰 면 5.63:1)
- `src/components/TourCard.tsx`: `headingLevel?: 'h2' | 'h3'`(기본 `h2`)만 더함. 문구·스타일 불변
- `src/app/(frontend)/page.tsx`: `await connection()` → `getHomePageData(payload)` → `<main>` 안에 히어로·추천 투어. `generateStaticParams` 없음
- `tokens.css`: `--overlay-photo` 0.6 → `rgba(29, 29, 31, 0.65)`(주석에 5.24·4.45 수치), `--surface-dark`·`--on-dark`·`--on-dark-2`·accent 경고 주석을 이 결정으로 갱신
- `globals.css`: `[data-on-dark] :focus-visible { outline-color: var(--on-dark) }`(계층 밖 — 전역 `:focus-visible`이 계층 밖이라 Tailwind 유틸리티로는 덮을 수 없음). 두께·간격은 전역 규칙 그대로
- 시험: `tests/unit/contrast.spec.ts` + `tests/helpers/contrast.ts`(WCAG 공식, 반올림하지 않는 덮개 합성, `tokens.css` 사용자 정의 속성 읽기), `tests/helpers/home-fixtures.ts`(순백 1×1 PNG 바이트 상수 — RGB 8비트, `setHomeSettings`), `tests/integration/home-page.spec.ts`에 영역 렌더링 2개(`renderToStaticMarkup` — `next/link` 포함 그대로 그려져 R14 대안 불필요), `tests/unit/repo-rules.spec.ts` `DATA_PAGES`에 홈 추가, `tests/e2e/home.spec.ts` 전체 재작성(임시 홈 단언 3개 제거 → 11개)
- `tests/e2e/home.spec.ts`는 `beforeAll`에서 원래 값을 먼저 저장하고, `afterAll`에서 되돌린 뒤 `toEqual` 단언 → 표식 정리 순서. `payload.destroy()`는 부르지 않음(M2 교훈). 뷰포트 1440×900 고정

**AC 상태 (M3 범위)**

| AC | 상태 | 근거 |
|---|---|---|
| AC-LANDING-004 (E2E 부분) | PASS | `home.spec.ts` "AC-LANDING-004" 3개 — 기본 문구·문서 순서·`href`·이동, `<b>` 미해석·공백 제거, `서비스를 준비 중입니다` 없음 |
| AC-LANDING-005 (a)(b)(c) E2E | PASS | 같은 파일 "AC-LANDING-005" 3개 — (a) img 0·`rgb(39, 39, 41)`·`head link[rel=preload][as=image]` 0·h 파일 요청 0, (b) img 1·alt·응답 모두 200·`naturalWidth` > 0·**h 파일 이름이 든 preload 링크 1개 이상(O2-1 반영)**, (c) 미디어 삭제 뒤 img 0·200 |
| AC-LANDING-006 | PASS | 단위 `contrast.spec.ts` 6개(14.91·5.24·16.83·15.46·5.24·2.65, 합성색 108.1/108.1/109.4) + E2E 1개(덮개 `rgba(29, 29, 31, 0.65)`, h1·소개 흰색, 버튼 흰 바탕·`rgb(29, 29, 31)`, Tab 포커스 `solid`·흰색·2px 이상, 히어로 요소 3개 이상 중 `rgb(0, 115, 122)` 0건) |
| AC-LANDING-007 (렌더링·E2E 부분) | PASS | 통합 2개(0개 → 문구·`href="/tours"`·`<article` 없음 / 2개 → `h2` 1·`article` 2·`h3` 2) + E2E 1개(카드 수·제목 순서 = `listPublishedTours` 앞 6개, 카드 문구가 `/tours` 같은 투어 카드와 같음, `투어 전체 보기` `/tours`·이동, 비공개 표식 투어 없음, `h2`는 `추천 투어` 하나) |
| AC-LANDING-014 (홈 부분) | PASS | E2E — `/` 카드 `h3` 수 = 카드 수·`h2` 0, `/tours` 카드 `h2` 수 = 카드 수·`h3` 0. 공통 부분(M2)의 `/` 본문 바로가기 → 다음 Tab `투어 둘러보기` 사례도 전체 E2E에서 통과 |
| AC-LANDING-015 | PASS | 매니페스트(아래) + 저장소 규칙(`page.tsx` `connection` import·`await`, `generateStaticParams` 없음) + E2E 새로고침 반영 1개(M4 계획 항목이지만 같은 파일에 넣음) |

**빌드 매니페스트 (AC-LANDING-015)** — `pnpm build` 직후 Node로 같은 판정(PowerShell 명령과 같은 조건): `routes has /: true`, `prerender has /: false`, `prerender has /tours: false`. 경로 표 `┌ ƒ /`(M2의 `○ /`에서 바뀜). 빌드 출력에 `warn` 0줄(`TourImage`의 `priority`를 포함해 새 경고 없음).

**M3 품질 게이트** (같은 작업 트리, 순서대로)

| 점검 | 명령 | 결과 |
|---|---|---|
| 생성 파일 | `pnpm generate:types` | 종료 0, `git status`에 `src/payload-types.ts` 변경 없음 |
| 타입 | `pnpm typecheck` | 종료 0 |
| 빌드 | `pnpm build` | 종료 0 (`ƒ /`) |
| 단위·통합 | `pnpm test` | 종료 0, `Test Files  43 passed (43)`, `Tests  659 passed (659)` (646 + 대비 9 + 저장소 규칙 2 + 렌더링 2), `All files` 줄 커버리지 99.35% |
| E2E | `pnpm e2e` | 종료 0, `85 passed (1.9m)` (77 − 임시 홈 3 + `home.spec.ts` 11) |
| 린트 | `pnpm lint` | 종료 0 |
| 포맷 | `pnpm format:check` | 종료 0, `All matched files use Prettier code style!` |
| 보존 | `git diff --stat b8087f8 -- pnpm-lock.yaml package.json .prettierignore eslint.config.mjs pnpm-workspace.yaml .gitattributes src/lib/occupancy.ts src/lib/session-availability.ts src/lib/catalog-order.ts src/lib/submit-application.ts` | 출력 없음 |
| 표식 잔여 | Node `pg` 스크립트(AC-LANDING-016 SQL 조건) | `tours test-%: 0`, `media test-%: 0`, `users @example.test: 0`, `home_settings test-%: 0`, `applications example.test: 1`(ID 2033 — 사용자의 개발용 신청) |
| 설정 복원 | 같은 스크립트 | `home_settings` `[{"id":1,"hero_image_id":null,"headline":null,"intro":null}]` — M1 직후 원래 값과 같음. 원래 값 파일 없음 |
| `importMap.js` | — | 관리자 화면 구성 요소를 바꾸지 않아 다시 만들지 않음 |

**스크린숏** (E2E 스크린숏 시험이 `.moai/state/verify/landing/`에 남김 — AC-LANDING-016 이름, 홈 4개. 같은 파일을 `.moai/state/verify/landing-m3/`에 복사): `home-dark-1440.png`, `home-dark-375.png`, `home-photo-1440.png`(순백 1×1 표식 사진 + 덮개 → 균일한 회색 히어로), `home-photo-375.png`. 나머지 6개(`/tours`·상세·404)는 M4. 화면 왼쪽 아래의 `N` 원형 표시는 `next dev` 개발 표시기다(운영 빌드에는 없음).

**잔여 위험·메모**

- 스크린숏의 사진 상태는 1×1 순백 PNG라 실제 사진의 인상(밝은 사진이 0.65 덮개로 어두워지는 정도 — R8)은 M4 수동 확인(실제 사진 업로드)에서 본다.
- 추천 투어 E2E는 개발 DB의 실제 공개 투어와 섞이며 기대값을 같은 순간의 `listPublishedTours`로 정한다. 페이지 요청과 기대값 계산 사이에 회차 시각 경계를 넘으면 순서가 달라질 수 있다(회차는 하루 이상 뒤라 실제로는 일어나지 않음).
- `tests/e2e/home.spec.ts`의 AC-LANDING-015 새로고침 시험은 plan.md M4 목록에 있던 항목이다 — M4에서 중복으로 만들지 않는다.

### M4 — 관리자 편집 흐름, 반응형, 스크린숏 (2026-11-17, 기준 HEAD `928bcd2`)

긴 출력: `.moai/state/verify/landing-m4/*.log`(gitignore 대상). 시작 전 `.moai/state/verify/landing/home-settings-original.json` 없음(디렉터리도 없음), E2E 포트 3100·3000 모두 비어 있음.

**새 시험 파일**

- `tests/e2e/home-admin.spec.ts`(4개): REST 권한(익명 `GET` 200, 익명 `POST` 정확히 403·값 불변, 관리자 `POST` 200·값 반영), GraphQL 익명 `updateHomeSetting` → `errors`에 `You are not allowed to perform this action.`·값 불변, 관리자 화면(테스트 관리자 로그인 → `nav`의 `홈 화면 설정` 링크 `href=/admin/globals/home-settings` → `#field-headline`에 `<표식>-화면편집` 입력·`#action-save` → 성공 알림 → 새 익명 브라우저 컨텍스트의 `/` `h1` = `<표식>-화면편집`), 익명 파일 주소(대표 사진 h → 200·`image/png`, 비운 뒤 200 아님)
- `tests/e2e/responsive.spec.ts`(5개): 1440 디자인 값(본문 17px/24.99px, `h1` 600·자간 음수, 두 알약 `9999px`·그림자 없음, 카드 그림자 없음, 면 색 3개), 375(본문 16px, `/`·`/tours`·상세 `scrollWidth` ≤ 375, 머리글 링크 2개·두 버튼 44×44 이상), 스크린숏 6개(`/tours`·상세·`/no-such-page` × 1440·375, 각 파일 크기 > 0 단언)
- 두 파일 모두 `beforeAll`에서 원래 값을 먼저 저장하고 `afterAll`에서 되돌림 → `toEqual` → 표식 정리. `payload.destroy()`는 부르지 않음. 홈 스크린숏 4개와 AC-LANDING-015 새로고침은 M3(`home.spec.ts`)에 있어 다시 만들지 않음

**RED** — 이 마일스톤의 시험은 M1~M3에서 이미 구현한 동작을 E2E로 확인하는 것이라, 구현 전 상태가 없다. 첫 실행(`pnpm exec playwright test tests/e2e/home-admin.spec.ts tests/e2e/responsive.spec.ts`, 종료 0, `red-e2e.log`)은 `9 passed (37.8s)`였다. 시험이 헛돌지 않음을 보이려고 제품 코드 세 곳을 일부러 깨뜨린 상태(`HomeSettings` `update`를 항상 허용, `mediaReadAccess`에서 홈 대표 사진 ID 제외, `tokens.css` `--text-body` 18px·`--touch-min` 40px)로 같은 명령을 돌렸다(종료 1, `red-mutation.log`):

```
  x  1 … AC-LANDING-002 전역 설정 접근 규칙(요청 API) › REST: 익명 읽기는 200, 익명 수정은 정확히 403이고 …
    Expected: 403
    Received: 200
  x  2 … › GraphQL: 익명 updateHomeSetting은 권한 오류이고 큰 제목이 그대로다
    Expected value: "You are not allowed to perform this action."
    Received array: []
  x  4 … AC-LANDING-003 대표 사진 파일 주소(익명) › 대표 사진으로 정하면 익명 파일 요청이 200·image/png이고, 비우면 200이 아니다
    Expected: 200
    Received: 403
  x  5 … AC-LANDING-013 디자인 값(1440) › …
    Expected: "17px"
    Received: "18px"
  x  8 … AC-LANDING-013 375px 화면 › /의 머리글 링크 2개·투어 둘러보기·투어 전체 보기의 터치 영역이 44px 이상이다
    Error: 머리글 숨비투어 높이
    Expected: >= 44
    Received:    40
  5 failed
  4 passed (1.0m)
```

깨뜨린 세 곳은 Edit·`sed`로 원래대로 되돌렸고 `git status --short`에 제품 파일 변경이 없음을 확인했다. 깨뜨린 실행에서도 원래 값 파일이 남지 않았다(`afterAll` 복원 확인).

**GREEN** — 되돌린 뒤 같은 명령 종료 0, `green-e2e.log`: `9 passed (29.5s)`. 제품 코드는 바꾸지 않았다(화면 조정 필요 없음 — 1440·375 값과 터치 영역이 M2·M3 구현 그대로 통과).

**AC 상태 (M4 범위)**

| AC | 상태 | 근거 |
|---|---|---|
| AC-LANDING-002 (E2E 부분) | PASS | `home-admin.spec.ts` "AC-LANDING-002" 3개 — REST 200/403/200, GraphQL 권한 오류·값 불변, 관리자 화면 메뉴·편집·저장 알림·익명 `/` 반영 |
| AC-LANDING-002 (수동) | PENDING-human | 사용자가 관리자 화면에서 사진을 직접 올려 대표 사진으로 고르고 저장 → `/` 히어로에 사진, 대표 사진 비우고 저장 → 짙은 히어로 |
| AC-LANDING-003 (E2E 부분) | PASS | `home-admin.spec.ts` "AC-LANDING-003" — 익명 파일 주소 200·`image/png` → 비운 뒤 200 아님 |
| AC-LANDING-013 (자동) | PASS | `responsive.spec.ts` "AC-LANDING-013" 4개 |
| AC-LANDING-013 (수동) | PENDING-human | 사용자가 `.moai/state/verify/landing/`의 1440·375 스크린숏과 실제 화면으로 디자인 방향(거의 검은 글자, 좁은 자간 제목, 알약 버튼, 카드 그림자 없음, 면의 바뀜) 확인 |
| AC-LANDING-015 (E2E 부분) | PASS | M3 `home.spec.ts` "AC-LANDING-015"(중복 생성 안 함), 아래 전체 E2E에서 계속 통과 |
| AC-LANDING-016 (스크린숏) | PASS | 10개 모두 있음 — 홈 4개(M3) + `tours-1440/375`, `tour-detail-1440/375`, `not-found-1440/375`(M4) |

**M4 점검** (같은 작업 트리)

| 점검 | 명령 | 결과 |
|---|---|---|
| E2E 전체 | `pnpm e2e` | 종료 0, `94 passed (1.9m)` (85 + `home-admin` 4 + `responsive` 5), `e2e-full.log` |
| 린트 | `pnpm lint` | 종료 0 |
| 포맷 | `pnpm format:check` | 첫 실행 종료 1(`responsive.spec.ts` 줄바꿈) → `prettier --write` 두 파일 뒤 종료 0, `All matched files use Prettier code style!` |
| 타입 | `pnpm typecheck` | 종료 0 |
| 표식 잔여·설정 복원 | Node `pg` 스크립트(AC-LANDING-016 SQL 조건, `.env` 값 출력 안 함) | `tours test-%: 0`, `media test-%: 0`, `applications example.test: 1`(ID `[2033]` — 사용자의 개발용 신청), `users @example.test: 0`, `home_settings test-%: 0`, `home_settings` `[{"id":1,"hero_image_id":null,"headline":null,"intro":null}]` |
| 원래 값 파일 | `.moai/state/verify/landing/home-settings-original.json` | 없음 |

**사용자 수동 확인 (PENDING-human — 결과를 이 절에 기록)**

1. AC-LANDING-002: 관리자 화면 `홈 화면 설정`에서 사진을 직접 올려 대표 사진으로 고르고 저장 → `/` 히어로에 그 사진이 보임, 대표 사진을 비우고 저장 → 짙은 히어로로 돌아옴(코드 변경·다시 빌드 없음)
2. AC-LANDING-013: 스크린숏 10개(`.moai/state/verify/landing/*.png`)와 실제 화면을 보고 2026-11-16 디자인 방향과 맞는지 확인. 실제 사진에서 0.65 덮개로 어두워지는 정도(R8)도 이때 본다

**메모**

- 스크린숏 왼쪽 아래 `N` 원형 표시는 `next dev` 개발 표시기다(운영 빌드에는 없음).
- 투어 상세 화면의 사진 상자에는 그림자가 있다(`tours/[slug]/page.tsx` 44행 `shadow-(--shadow-photo)` — 사진 전용 토큰, SPEC-TOUR-001 화면, 이 SPEC은 면 배치·스타일을 바꾸지 않음 — plan.md §D 유지). AC-LANDING-013의 "카드 그림자 없음"은 홈 추천 투어 카드 기준이며 통과했다.

### M5 — 회귀 정리, 품질 게이트, MX (2026-11-17, 기준 HEAD `019f6f4` = M4 커밋)

긴 출력: `.moai/state/verify/landing-m5/*.log`(gitignore 대상). 이 마일스톤은 새 동작을 더하지 않으므로 RED 단계가 없다(제품·시험 코드 변경 없음, `progress.md`만 갱신). RED 증거는 M1~M3의 구현 전 실패 출력과 M4의 일부러 깨뜨린 실행(위)에 있다.

**품질 게이트** (plan.md §E-1 순서대로 실행한 뒤 §E-2를 실행, 같은 작업 트리)

| 점검 | 명령 | 결과 |
|---|---|---|
| DB | `docker compose ps --format "{{.Service}} {{.Health}}"` | `postgres healthy` |
| 생성 파일 | `pnpm generate:types` | 종료 0, 뒤이은 `git status --short` 출력 없음(`src/payload-types.ts` 변경 없음) |
| 타입 | `pnpm typecheck` | 종료 0 |
| 빌드 | `pnpm build` | 종료 0, 출력에 `warn` 0줄, 경로 표 `┌ ƒ /`·`├ ƒ /[...slug]`·`├ ƒ /tours`·`└ ƒ /tours/[slug]` |
| 빌드 매니페스트(AC-LANDING-015) | Node로 같은 조건 판정(`.next/app-path-routes-manifest.json` 값에 `/`, `.next/prerender-manifest.json` `routes` 키) | `routes has /: true` → `prerender has /: false`, `prerender has /tours: false`. 수용 기준의 PowerShell 명령 그대로의 실행은 이 세션의 자동 승인 분류기가 거부해 Node 판정으로 대신했다(M3와 같은 방식) |
| 단위·통합 | `pnpm test` | 종료 0, `Test Files  43 passed (43)`, `Tests  659 passed (659)` |
| 커버리지 | 같은 실행(`src/lib/**`, 임계값 lines 85) | `All files` 줄 99.35%(`coverage-summary.json` `total.lines` `{"total":621,"covered":617,"pct":99.35}`). `home-page.ts` 100%, `access.ts` 100%, `catalog.ts` 100% |
| E2E | `pnpm e2e` | 종료 0, `94 passed (1.9m)` |
| 표식 잔여(AC-LANDING-016) | Node `pg` 스크립트(수용 기준 SQL 5개와 같은 조건, `.env` 값 출력 안 함, `residue.log`) | `tours test-%: 0`, `media test-%: 0`, `applications example.test: 1`, `users @example.test: 0`, `home_settings test-%: 0` |
| 남은 신청 1건 | 같은 스크립트 | ID `[2033]` — 2026-11-12에 생긴 사용자의 개발용 신청(M1 기준선부터 같음, 증가 0). 이 SPEC의 테스트 데이터가 아니다 |
| 설정 복원 | 같은 스크립트 | `home_settings` `[{"id":1,"hero_image_id":null,"headline":null,"intro":null}]` — M1 직후 원래 값과 같음 |
| 원래 값 파일 | `test -e .moai/state/verify/landing/home-settings-original.json` | 없음 |
| 스크린숏 10개 | `stat -c "%n %s"` | `home-dark-1440` 113136, `home-dark-375` 110889, `home-photo-1440` 112645, `home-photo-375` 110748, `tours-1440` 90489, `tours-375` 96558, `tour-detail-1440` 60107, `tour-detail-375` 49453, `not-found-1440` 25963, `not-found-375` 19923(바이트, 모두 > 0) |
| 린트 | `pnpm lint` | 종료 0 |
| 포맷 | `pnpm format:check` | 종료 0, `All matched files use Prettier code style!` |
| 작업 트리 | `git status --short` | 출력 없음 |
| 보존 | `git diff --stat b8087f8 -- pnpm-lock.yaml package.json .prettierignore eslint.config.mjs pnpm-workspace.yaml .gitattributes src/lib/occupancy.ts src/lib/session-availability.ts src/lib/catalog-order.ts src/lib/submit-application.ts` | 출력 없음 |
| `importMap.js` | `pnpm generate:importmap` → `git status --short` | 종료 0, 변경 없음 → 커밋하지 않음 |
| 관리자 이메일 | `tests/` 아래 이메일 형식 문자열 중 `example.test`가 아닌 것 | 0건 |
| 커밋 제외 파일 | `git ls-files`에서 `.env`·`media/`·`.moai/state/` | 0건 |

**@MX 태그 점검** (`src/`에서 `@MX:` 검색)

| 대상 | 태그 | 판정 |
|---|---|---|
| `src/lib/home-page.ts` `getHomePageData` | `@MX:DEBT` + `@MX:CEILING`(공개 투어 수백 개 이하) + `@MX:UPGRADE`(정렬 키를 DB 질의로 옮겨 6개만 읽기) | 있음 |
| `src/lib/access.ts` `mediaReadAccess` | `@MX:DEBT`(추가 조회 2회) + `@MX:CEILING` + `@MX:UPGRADE` — 홈 대표 사진 포함으로 갱신됨 | 있음 |
| `src/app/(frontend)/[...slug]/page.tsx` | `@MX:NOTE`(우선순위가 가장 낮아 `/admin`·`/api`를 가리지 않음, 실험 기능 안 씀) | 있음 |
| `src/app/(frontend)/layout.tsx` 글꼴 | `@MX:NOTE`(원본 고정·OFL·무게 축·`preload: false` 이유·`(frontend)`에서만) | 있음 |
| `src/components/HomeHero.tsx` 덮개 | `@MX:NOTE`(균일 덮개 0.65, 순백 위 5.24:1) | 있음 |
| `src/lib/catalog.ts` `toImage` | 직접 호출 2곳(`catalog.ts` `toCard`, `home-page.ts` `getHomePageData`) — fan_in 3 미만 | `@MX:ANCHOR` 붙이지 않음(plan.md M5 "3곳이 되면 검토" 조건 미충족) |

모든 새 태그에 `[AUTO]` 접두어가 있고, 파일별 한도(ANCHOR 3·WARN 5·NOTE 10·TODO 5)를 넘는 파일이 없다. 이번 마일스톤에서 태그를 더하거나 지우지 않았다.

**`TourImage.tsx` `priority`**: 이 SPEC 범위 밖이라 바꾸지 않았다. 빌드 출력의 `warn` 0줄로 새 경고가 없음을 확인했다.

**문서 정리 이월 (manager-spec — 이 에이전트는 spec.md·plan.md·acceptance.md 본문을 고치지 않음)**

- O2-2: REQ-LANDING-008의 "익명 접근 규칙으로만" 문구가 `mediaReadAccess` 내부의 `findGlobal`(`overrideAccess` 생략 = `true`, `req` 전달) 호출과 구분된다는 점을 문구에 드러낸다. 구현은 plan.md §B.2 근거대로이며 AC-LANDING-008 통합 시험이 "`req` 없이 부른 `home-settings` 호출 정확히 1회(`overrideAccess: false`, 사용자 없음)"로 판정해 통과했다 — 동작 변경 없이 문구만 맞추면 된다.
- O2-3: plan.md §A.3 Tier M 근거의 중복 문장(“M으로 두는 이유”와 “plan-audit 1회차 O-1 뒤에도 M을 유지한다”가 같은 근거를 되풀이) 정리.
- AC-LANDING-015 첫 명령(PowerShell `ConvertFrom-Json`)은 이 환경에서 자동 승인 분류기가 거부했다. 판정 조건이 같은 Node 명령으로 확인했으므로, 필요하면 acceptance.md에 동등한 Node 판정을 대안으로 적는 것을 검토한다.
- AC-LANDING-016의 `applications WHERE email LIKE '%example.test'` 기준 `0`은 사용자의 개발용 신청 ID 2033 때문에 이 개발 DB에서 `1`이다(이 SPEC 시작 전부터 있던 행). SPEC-ADMIN-001과 같은 해석("증가 0")을 쓴다는 점을 수용 기준에 적을지 검토한다.

**출시 전 점검 이월 (sync 단계가 출시 전 점검 목록으로 옮김)**

- 바닥글 `개인정보 처리방침(준비 중)`을 처리방침 문서 링크로 교체 — 배포 SPEC
- 운영 대표 사진 크기·형식 점검(`sharp` 없음, 원본 그대로 전송, 관리자 필드 설명으로만 안내) — 배포 SPEC
- 업로드 저장소 전환 뒤 대표 사진 파일 주소(`serverURL`)와 익명 접근 재확인 — 배포 SPEC

**후속 SPEC 후보 (범위 밖, §E.1과 같음)**: 글꼴 동적 분할본 검토, `TourImage.tsx`의 `priority` → `preload`, 홈용 6개만 읽는 질의.

**잔여 위험**

- 공유 개발 DB에 `home_settings` 테이블이 있다(M1). 이 SPEC 이전 코드로 개발 서버를 다시 시작하면 Payload 스키마 반영이 이 테이블을 지우려 할 수 있다.
- `admin-ops.spec.ts:324`의 간헐 실패 후보(M2 기록) — M3 기록의 전체 E2E와 이번 세션의 전체 E2E 2회(M4 `e2e-full.log`, M5 `e2e.log`)에서는 다시 나타나지 않았다.
- 실제 사진 위 0.65 덮개의 인상(R8)과 관리자 화면 사진 올리기 흐름은 사람 확인 전이다(PENDING-human 2건).

### 최종 AC 판정표 (AC-LANDING-001 ~ 016)

| AC | 상태 | 확인 명령 | 근거(이번 M5 실행) |
|---|---|---|---|
| AC-LANDING-001 | PASS | `pnpm test` | `tests/integration/home-settings.spec.ts` "AC-LANDING-001" 4개 — `Tests  659 passed (659)` 안 |
| AC-LANDING-002 | PASS (자동) · PENDING-human (수동 1건) | `pnpm test`, `pnpm e2e` | 통합 3개(M1) + `home-admin.spec.ts` 3개(REST·GraphQL·관리자 화면) — `94 passed` 안. 수동: 관리자 화면에서 사진 올려 고르기·비우기 |
| AC-LANDING-003 | PASS | `pnpm test`, `pnpm e2e` | 통합 1~4단계(M1) + `home-admin.spec.ts` 파일 주소 200·`image/png` → 비운 뒤 200 아님. 기존 AC-TOUR-006 계속 통과 |
| AC-LANDING-004 | PASS | `pnpm test`, `pnpm e2e` | 단위(M1) + `home.spec.ts` 3개(M3) |
| AC-LANDING-005 | PASS | `pnpm test`, `pnpm e2e` | 통합 (c)·단위 (d)(M1) + `home.spec.ts` (a)(b)(c)(M3) |
| AC-LANDING-006 | PASS | `pnpm test`, `pnpm e2e` | `contrast.spec.ts` 14.91·5.24·16.83·15.46·5.24·2.65 + `home.spec.ts` 색·포커스·포인트 색 0건 |
| AC-LANDING-007 | PASS | `pnpm test`, `pnpm e2e` | 단위 0·3·6·8개, 통합 앞 6개·남은 자리·비공개 제외·빈 목록 렌더링, `home.spec.ts` 카드 순서·문구 |
| AC-LANDING-008 | PASS | `pnpm test` | `home-page.spec.ts` 질의 수 같음·connect = query·`req` 없는 `home-settings` 조회 1회 |
| AC-LANDING-009 | PASS | `pnpm e2e` | `layout.spec.ts` "AC-LANDING-009" 3개 |
| AC-LANDING-010 | PASS | `pnpm e2e` | `layout.spec.ts` "AC-LANDING-010" |
| AC-LANDING-011 | PASS | `pnpm e2e` | `layout.spec.ts` "AC-LANDING-011" 4개 + 기존 관리자 E2E 4개 파일 통과(`94 passed`) |
| AC-LANDING-012 | PASS | `pnpm test`, `pnpm e2e` | 저장소 규칙 5개(크기 2,057,688·SHA-256 `9599f12f…00b4`·OFL·import 위치·의존성) + `layout.spec.ts` 글꼴 2개 |
| AC-LANDING-013 | PASS (자동) · PENDING-human (수동 1건) | `pnpm e2e` | `responsive.spec.ts` 4개(1440 값, 375 본문·가로 스크롤·터치 영역). 수동: 스크린숏·실제 화면으로 디자인 방향 확인 |
| AC-LANDING-014 | PASS | `pnpm e2e` | `layout.spec.ts` "AC-LANDING-014" 6개 + `home.spec.ts` 홈 `h2`·카드 `h3` |
| AC-LANDING-015 | PASS | `pnpm build` + 매니페스트, `pnpm test`, `pnpm e2e` | `routes has /: true`, `prerender has /: false`, `prerender has /tours: false`, 저장소 규칙(`connection`·`await`, `generateStaticParams` 없음), `home.spec.ts` 새로고침 반영 |
| AC-LANDING-016 | PASS | `pnpm test`, `pnpm e2e`, 잔여 SQL | 두 명령 종료 0, `src/lib` 줄 커버리지 99.35%, 스크린숏 10개 > 0바이트, 원래 값 파일 없음, 잔여 `0/0/1(ID 2033, 사용자 개발 신청)/0/0`, 각 시험 파일 `afterAll` 복원 `toEqual` 통과 |

## §E.3 Run-phase Audit-Ready Signal

```yaml
run_complete_at: 2026-11-17
run_commit_sha: pending-backfill   # M5 커밋 자기 SHA는 같은 커밋에 쓸 수 없음 — 오케스트레이터/sync 단계가 기록
run_base_head: 928bcd2             # M3 병합(main)
run_status: complete-pending-human # 자동 검증 전부 통과, 사람 확인 2건 남음(아래)
milestone_commits: [M1 cb480c6, M2 b82065b, M3 928bcd2, M4 019f6f4, M5 pending-backfill]
m1_to_mN_commit_strategy: "마일스톤마다 격리 작업 트리에서 커밋 1개 → 오케스트레이터가 main에 fast-forward 병합(푸시는 오케스트레이터)"
ac_pass_count: 16          # 자동 판정 부분 기준
ac_fail_count: 0
ac_pending_human:
  - "AC-LANDING-002 (수동) 관리자 화면에서 사진을 올려 대표 사진으로 고르고 저장·비우기"
  - "AC-LANDING-013 (수동) 1440·375 스크린숏과 실제 화면으로 디자인 방향 확인"
tests:
  unit_integration: "pnpm test → exit 0, Test Files 43 passed (43), Tests 659 passed (659) (기준선 609)"
  e2e: "pnpm e2e → exit 0, 94 passed (1.9m) (기준선 60)"
  coverage_lines_src_lib: "99.35% (임계값 85%)"
quality_gate:
  typecheck: 0
  build: 0
  lint: 0
  format_check: 0
  generated_files_drift: none   # generate:types·generate:importmap 뒤 git status 출력 없음
build_manifest: { routes_has_root: true, prerender_has_root: false, prerender_has_tours: false }
mutation_checks:
  m4_home_settings_update_open: "FAIL as expected (REST 403→200, GraphQL errors []) → restored PASS"
  m4_media_read_drop_home_hero: "FAIL as expected (file URL 200→403) → restored PASS"
  m4_tokens_body_18px_touch_40px: "FAIL as expected (17px→18px, 44→40) → restored PASS (9 passed)"
preserve_list_post_run_count: 0   # git diff --stat b8087f8 -- (plan.md §E-2 보존 목록) → 출력 없음
leftover_data: "tours_test=0, media_test=0, users_example_test=0, home_settings_test=0, applications_example_test=1 (= 기존 개발 신청 id 2033, 증가 0)"
home_settings_original_restored: "[{id:1, hero_image_id:null, headline:null, intro:null}] — M1 직후 값과 같음, 원래 값 파일 없음"
screenshots: ".moai/state/verify/landing/ 10개 (gitignore 대상)"
new_warnings_or_lints_introduced: 0
new_dependencies: 0
cross_platform_build:
  windows_git_bash: "pnpm build exit 0"
  other_os: not-run   # Windows 개발 환경만 확인. CI 결과는 오케스트레이터 몫
l44_pre_commit_fetch: not-run   # 격리 작업 트리 에이전트 — 원격 동기화·푸시는 오케스트레이터
l44_post_push_fetch: not-run    # 푸시하지 않음(지시)
total_run_phase_files: 32       # git diff --name-only 4eac201..019f6f4 (M5는 progress.md만 수정 — 이미 포함)
doc_carry_over_for_manager_spec: [O2-2 REQ-LANDING-008 문구, O2-3 Tier M 근거 중복, AC-LANDING-015 Node 대안 명령, AC-LANDING-016 ID 2033 해석]
status_frontmatter: in-progress  # implemented/completed 전환은 sync(manager-docs) 몫
```

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase — manager-docs>_

## plan-audit 2회차 결과 (2026-11-16)

PASS 0.93 (0.79 → 0.93). 반드시 고칠 항목 없음. 선택 지적은 run 단계에서 반영한다.

- O2-1: AC-005 (b)에 "h의 preload 링크가 1개 이상" 긍정 단언을 추가해 (a)의 0개 단언이 잘못된 선택자로 우연히 통과하지 않게 한다
- O2-2: REQ-LANDING-008 "익명 접근 규칙으로만" 문구는 접근 규칙 내부 조회(overrideAccess: true)와 구분된다는 점을 plan §B.2 근거대로 따른다
- O2-3: Tier M 근거 중복 문장 정리(문서 정리 단계)
