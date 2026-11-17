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

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase — manager-develop>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase — manager-docs>_

## plan-audit 2회차 결과 (2026-11-16)

PASS 0.93 (0.79 → 0.93). 반드시 고칠 항목 없음. 선택 지적은 run 단계에서 반영한다.

- O2-1: AC-005 (b)에 "h의 preload 링크가 1개 이상" 긍정 단언을 추가해 (a)의 0개 단언이 잘못된 선택자로 우연히 통과하지 않게 한다
- O2-2: REQ-LANDING-008 "익명 접근 규칙으로만" 문구는 접근 규칙 내부 조회(overrideAccess: true)와 구분된다는 점을 plan §B.2 근거대로 따른다
- O2-3: Tier M 근거 중복 문장 정리(문서 정리 단계)
