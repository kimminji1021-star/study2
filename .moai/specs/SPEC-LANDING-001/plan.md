# SPEC-LANDING-001 구현 계획

> 요구사항은 `spec.md`, 수용 기준은 `acceptance.md`가 기준이다. 이 문서는 결정의 근거, 작업 순서, 위험을 다룬다.
> 개발 방식: TDD(`quality.yaml` `constitution.development_mode: tdd`). 검증 셸: Windows PowerShell 5.1(SPEC-INFRA-001·SPEC-TOUR-001·SPEC-APPLY-001·SPEC-ADMIN-001과 같음).
> 마일스톤은 되돌리기 어려운 결정(전역 설정 데이터 모델과 미디어 공개 범위)을 앞에, 모든 공개 화면에 영향을 주는 공통 레이아웃·글꼴을 그다음에, 홈 화면 겉모습과 정리 작업을 뒤에 놓았다.

## §A. 맥락

### A.1 현재 상태 (계획 시점 HEAD `b8087f8` = `origin/main`)

- SPEC-INFRA-001·SPEC-TOUR-001·SPEC-APPLY-001·SPEC-ADMIN-001 완료(`status: completed`). 등록 컬렉션 7개, 전역 설정(`globals`)은 없음(`src/payload.config.ts`는 61행이고 39행의 `collections` 목록만 있으며 `globals` 키가 없음).
- `src/app/(frontend)/page.tsx`(17행): SPEC-INFRA-001의 임시 홈. `h1` "숨비투어"(`text-4xl font-bold`), "서비스를 준비 중입니다.", `/tours` 링크 하나(`rounded-(--radius-sm)` — 알약이 아님). `connection()`을 부르지 않아 빌드 때 사전 렌더링된다(SPEC-TOUR-001 AC-TOUR-013이 이 사실을 구조 단언으로 씀).
- `src/app/(frontend)/layout.tsx`(8~18행): `<html lang="ko"><body>{children}</body></html>`만 그린다. 머리글·바닥글·글꼴 없음. `metadata.description`이 "숨비투어 — 서비스 준비 중".
- `src/app/(frontend)/globals.css`(8~20행): `body`에 `font-family: var(--font-sans)`, 본문 크기·줄 간격·자간 토큰, `word-break: keep-all`.
- `src/app/(frontend)/tokens.css`: `--font-sans`(49~51행)가 `"Pretendard Variable", Pretendard, …`로 시작하지만 **어디서도 글꼴 파일을 불러오지 않는다** — 이 PC에 Pretendard가 설치되어 있지 않으면 시스템 글꼴로 보인다. `--surface-dark #272729`·`--on-dark`·`--on-dark-2`(28~30행)는 아직 쓰는 화면이 없다. `--overlay-photo: rgba(29, 29, 31, 0.6)`(23행)는 "실제 사진 확정 후 대비 재측정" 주석이 있고 쓰는 곳이 없다(`grep` 결과 정의 1곳뿐). 전역 포커스 표시는 `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px }`(120행).
- 공개 화면: `/tours`(`tours/page.tsx`, 흰 머리 영역 + 연회색 카드 영역), `/tours/[slug]`, `/apply`, `/apply/complete/[ref]`, `not-found.tsx`. 각 화면이 자기 `<main>`을 그린다. 공통 머리글·바닥글 없음.
- `src/components/TourCard.tsx`: 카드 제목이 `h2`로 고정(20행), 그림자 없음, 테두리 `--color-divider`. `TourImage.tsx`는 `next/image`의 `priority`(35행 — Next 16에서 폐기 예고, `preload`로 대체됨, §A.2)를 쓴다.
- `src/lib/catalog.ts`: 익명 읽기 고정(`ANONYMOUS_READ`, 45행), `listPublishedTours`(106~128행)가 공개 투어 전체 + 예정 회차 1회 + 점유 인원 `GROUP BY` 1회로 카드 데이터를 만들고 `sortToursForListing`(`catalog-order.ts` 25~39행)으로 정렬한다.
- `src/lib/access.ts` `mediaReadAccess`(37~55행): 익명이면 "공개 투어가 대표 이미지로 참조하는 미디어 ID 목록"만 허용. `@MX:DEBT`(추가 조회 1회).
- `src/collections/Media.ts`: `alt`(대체 텍스트) 필수(48~55행), 이미지 MIME만, `sharp` 없음.
- 테스트: E2E는 Chromium 데스크톱 프로젝트 하나(`playwright.config.ts` 23~28행), `workers: 1`. 통합은 `fileParallelism: false`(`vitest.config.mts`). 스크린숏은 기존 관례대로 `.moai/state/verify/<이름>/`(gitignore 대상)에 남긴다(`tests/e2e/admin-dashboard.spec.ts` 18행). 통합 테스트에서 서버 컴포넌트를 `react-dom/server`의 `renderToStaticMarkup`으로 그리는 선례가 있다(`tests/integration/admin-dashboard.spec.ts` 5·84행).
- 이 SPEC 때문에 단언이 바뀌는 기존 테스트:
  - `tests/e2e/home.spec.ts` 10~45행 — 임시 홈의 "준비 중" 문구, `h1` 36px, `a[href="/tours"]` 1개(SPEC-INFRA-001 AC-INFRA-008 홈 부분, SPEC-TOUR-001 AC-TOUR-015)
  - `tests/unit/repo-rules.spec.ts` 721~747행 — 요청 시점 렌더링 대상 목록(`DATA_PAGES`)에 홈 추가
  - SPEC-TOUR-001 AC-TOUR-013의 `pnpm build` 뒤 "`/`가 사전 렌더링됨" 구조 단언 — 이 SPEC 뒤에는 거짓이 된다(AC-LANDING-015가 대체)
- 작업 트리: `git status`의 미추적 파일(`.claude/launch.json`, `.moai/design/`, `.moai/logs/…`, `.moai/reports/legal/`, `.moai/reports/sync-audit/`)은 이 SPEC과 무관하며 건드리지 않는다.

### A.2 확인한 근거 (설치본·공식 자료)

새 npm 패키지를 추가하지 않는다. 확인 대상은 설치된 Payload 3.93.0(`node_modules/payload/package.json`)과 Next.js 16.4.5(`node_modules/next/package.json`). 경로는 저장소 루트 기준.

| 항목 | 확인 내용 | 근거 (파일:행) |
|---|---|---|
| 전역 설정 타입 | `GlobalConfig`는 `access { read, readVersions, update }`, `admin`, `fields`, `hooks`, `label`, `lockDocuments`, `slug`, `versions` 등을 갖는다 | `node_modules/payload/dist/globals/config/types.d.ts` 204~262 |
| 전역 설정 기본 접근 규칙 | `access.read`·`access.update`를 정하지 않으면 `defaultAccess`가 들어가고, 이는 "로그인한 사용자면 허용"이다 → 익명 읽기를 원하면 `read`를 명시해야 하고, 수정은 `adminOnly`로 좁혀야 한다(다른 인증 컬렉션이 생겨도 새지 않게) | `node_modules/payload/dist/globals/config/sanitize.js` 27~37, `node_modules/payload/dist/auth/defaultAccess.js` 1 |
| 전역 설정 읽기 | `findOneOperation`은 `overrideAccess`가 아니면 `executeAccess`로 `access.read`를 실행한다. 규칙이 거짓이면 `executeAccess`가 먼저 `Forbidden`을 던진다(`disableErrors`가 아닐 때). `disableErrors`이면 `executeAccess`가 `false`를 돌려주고 `findOne.js`는 `null`을 돌려주므로, `findOne.js` 41행의 `NotFound`는 이 흐름에서 닿지 않는다. 이 SPEC은 `read`가 항상 `true`라 어느 쪽도 일어나지 않는다. PostgreSQL은 한 번도 저장하지 않은 전역 설정에 `{}`를 돌려주며 이때 문서는 빈 객체다 | `node_modules/payload/dist/globals/operations/findOne.js` 33~44·61~76, `node_modules/payload/dist/auth/executeAccess.js` 10~15 |
| 로컬 API 기본값 | `payload.findGlobal`의 `overrideAccess` 기본값은 `true` → 홈 화면 조회는 `overrideAccess: false`를 명시해야 익명 규칙을 탄다 | `node_modules/payload/dist/globals/operations/local/findOne.js` 5 |
| 저장 전 전역 설정의 기본값 | 필드 `afterRead`는 "처음 만들어지기 전 전역 설정"에 대해 필드 `defaultValue`를 채운다. 그러나 관리자가 칸을 비우고 저장한 경우는 채우지 않는다 → 기본 문구는 코드에서 적용한다(§B.3) | `node_modules/payload/dist/fields/hooks/afterRead/promise.js` 240~246 |
| 관계 채우기의 접근 규칙 | 업로드·관계 필드를 `depth`로 채울 때 호출의 `overrideAccess` 값을 그대로 넘겨 대상 컬렉션 읽기 규칙을 적용한다 → 익명으로 전역 설정을 읽으면 대표 사진도 `media` 익명 읽기 규칙을 탄다 | `node_modules/payload/dist/fields/hooks/afterRead/relationshipPopulationPromise.js` 23~36 |
| **업로드 파일 주소의 접근 규칙** | 파일 요청(`/api/media/file/<이름>`)은 `media`의 `access.read`를 `isReadingStaticFile: true`로 실행하고, 결과 조건과 파일 이름으로 문서를 찾지 못하면 내주지 않는다 → 지금 규칙으로는 홈 대표 사진 파일이 익명에게 막힌다(§B.2의 근거) | `node_modules/payload/dist/uploads/checkFileAccess.js` 5~16·53~60, `src/lib/access.ts` 37~55 |
| 전역 설정 REST | 기본 엔드포인트: `GET /api/globals/<slug>`(읽기), `POST /api/globals/<slug>`(수정) | `node_modules/payload/dist/globals/endpoints/index.js` 13~17·34~38, `node_modules/payload/dist/utilities/handleEndpoints.js` 119~132 |
| 전역 설정 수정 권한 | `updateOperation`은 `overrideAccess`가 아니면 `access.update`를 실행한다 | `node_modules/payload/dist/globals/operations/update.js` 88~95 |
| 관리자 화면 | 전역 설정은 메뉴의 "Globals" 묶음에 라벨로 나타나고, `/admin/globals/<slug>`에서 문서 편집 화면으로 열린다 | `node_modules/@payloadcms/ui/dist/utilities/groupNavItems.js` 50~56, `node_modules/@payloadcms/next/dist/views/Root/getRouteData.js` 194~198 |
| 업로드 필드의 외래 키 | 단일 업로드·관계 필드는 대상 테이블을 가리키는 `<열>_id` 외래 키를 만들고 `onDelete: 'set null'`이다 → 대표 사진 미디어를 지우면 설정 값이 비고 히어로는 짙은 면이 된다 | `node_modules/.pnpm/@payloadcms+drizzle@3.93.0__ba5d6d62ca5ea44ea9fc1d4d503a023b/node_modules/@payloadcms/drizzle/dist/schema/traverseFields.js` 731~750 |
| 글자 길이 검증 | 글자 필드 `maxLength`는 JS 문자열 길이(UTF-16 단위)로 비교한다. 한글 음절 하나는 1이다 | `node_modules/payload/dist/fields/validations.js` 6~40 |
| `next/font/local` 옵션 | `src`(woff2 등), `display`(기본 `swap`), `weight`, `preload`(기본 `true`), `variable`(CSS 변수), `fallback`, `adjustFontFallback`(기본 `'Arial'`), `declarations`. 경로는 호출한 파일 기준 | `node_modules/next/dist/compiled/@next/font/dist/local/index.d.ts` 2~20, `…/local/validate-local-font-function-call.js` 21, `node_modules/next/dist/docs/01-app/01-getting-started/13-fonts.md` 264 |
| `next/font/local` 동작 | 빌드 때 글꼴 파일을 출력 디렉터리로 내보내고 `@font-face`를 만든다. 글꼴 이름은 Next가 정한 이름이다(`declarations`의 `font-family`로만 바꿈) → 기존 `"Pretendard Variable"` 이름과 겹치지 않으므로 `--font-sans` 맨 앞에 CSS 변수를 더해야 한다 | `node_modules/next/dist/compiled/@next/font/dist/local/loader.js` 15~52, `node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md` 224~240 |
| `preload` | `preload: true`이면 `<head>`에 미리 받기 링크를 넣는다(기본값). 끄면 CSS가 글꼴을 쓸 때 받는다 | `node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md` 184~196 |
| `next/image` `preload` | Next 16부터 `priority`는 폐기 예고되고 `preload`가 대체한다. 첫 화면의 가장 큰 이미지(히어로)에 쓰라고 안내한다 | `node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md` 266~294·1405 |
| 알 수 없는 주소의 404 | 루트 레이아웃이 여럿(라우트 그룹마다)이면 처리하지 않는 주소에 쓸 공통 레이아웃이 없다. 이를 위한 `global-not-found.js`는 실험 기능(`experimental.globalNotFound`, v15.4.0 도입) | `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md` 49~69·135·237 |
| Pretendard 라이선스 | "SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007", "Copyright (c) 2021, Kil Hyung-jin", 예약 글꼴 이름 "Pretendard". 소프트웨어와 함께 번들·재배포 가능(사본마다 저작권 표시와 라이선스 전문 포함), 단독 판매 금지, 수정본은 예약 이름 사용 금지 | https://github.com/orioncactus/pretendard/blob/main/LICENSE (2026-11-16 WebFetch 확인) |
| Pretendard 배포 파일 | 최신 릴리스 `v1.3.9`. `packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2` 2,057,688바이트. 같은 디렉터리 구조의 동적 분할본(`woff2-dynamic-subset`)은 92개 파일. `PretendardStdVariable.woff2`(291,680바이트)는 라틴 환경용으로 한글이 없다. GOV 가변본은 5,405,612바이트 | GitHub API `repos/orioncactus/pretendard/releases/latest`, `contents/packages/pretendard/dist/web/variable/woff2`, `contents/packages/pretendard-std/…`, `packages/pretendard-std/README.md`(2026-11-16 `curl` 확인) |

### A.3 Tier M 판단

- 예상 변경: 전역 설정 1개(`src/globals/HomeSettings.ts`), `src/lib/` 모듈 1~2개(홈 데이터·기본 문구·추천 자르기, 대비 계산은 테스트 도우미로 충분할 수 있음), 공통 조각 3~4개(`SiteHeader`·`SiteFooter`·`HomeHero`·`RecommendedTours`), 모든 경로 받기 페이지 1개, 글꼴 파일 2개(woff2·라이선스), 수정: `page.tsx`·`layout.tsx`·`globals.css`·`tokens.css`·`not-found.tsx`(필요시)·`TourCard.tsx`(제목 단계 선택값)·`access.ts`·`payload.config.ts`, 생성 파일 `payload-types.ts`(필요하면 `importMap.js`).
- 파일 수 추정: 생성 약 13개(제품 7~8, 테스트 4~5), 수정 약 12개(제품 8, 테스트 3~4, 생성 파일 1~2). 합계 약 25개로 Tier M 파일 지침(5~15개)을 넘는다. 넘는 부분의 절반 이상이 테스트와 바이너리 파일이다.
- 직접 작성 코드 추정: 제품 코드 약 350~500줄, 테스트 약 700~1,000줄.
- M으로 두는 이유(plan-audit 1회차 O-1 뒤에도 유지): 공개 화면 겉모습이라는 한 도메인이고 동시성·트랜잭션이 없으며 프로젝트 원칙을 바꾸지 않는다. 요구사항 16개·수용 기준 16개로 예산 안이다. Tier S(300줄 미만·5개 파일 미만)는 공통 레이아웃·글꼴·접근 규칙 변경까지 담기에 작다.
- 넘칠 경우: run 단계 중 제품 코드가 800줄을 넘거나 마일스톤이 6개를 넘으면 차단자 보고 후 분할을 검토한다(1순위: 글꼴과 공통 머리글·바닥글(M2)을 별도 SPEC으로).

## §B. 결정과 근거

### B.1 홈 화면 설정 — Payload 전역 설정 하나

| 선택지 | 장점 | 단점 | 판단 |
|---|---|---|---|
| **전역 설정(Global) `home-settings`(채택)** | 문서가 하나뿐인 설정에 맞는 Payload 기본 기능. 관리자 메뉴에 이름으로 나타나고, 업로드 필드로 기존 `media`를 그대로 고른다. 코드 변경 없이 교체 | 개발 DB에 하나뿐이라 테스트가 원래 값을 저장·복원해야 함(§B.11) | 채택 |
| 문서 한 개만 두는 컬렉션 | 익숙한 컬렉션 규칙 재사용 | "하나만" 규칙을 직접 강제해야 하고, 목록·새로 만들기 화면이 생김 | 기각 |
| 투어 데이터에서 사진·문구를 빌려 옴 | 새 데이터 없음 | 사용자 결정 D2·D3(관리자가 별도로 정함)과 어긋남 | 기각 |
| 환경 변수·설정 파일 | 단순 | 바꾸려면 배포가 필요 — "코드 변경 없음"과 어긋남 | 기각 |

- 정의(예: `src/globals/HomeSettings.ts`, `payload.config.ts`의 `globals: [HomeSettings]`):
  - `slug: 'home-settings'`, `label: '홈 화면 설정'`
  - 필드: `heroImage`(`type: 'upload'`, `relationTo: 'media'`, 필수 아님, 라벨 `대표 사진`, 설명 "가로 2000px·1MB 안팎의 JPEG를 권합니다. 고른 사진은 누구나 볼 수 있습니다. 비워 두면 짙은 배경이 보입니다." — 가정 A7), `headline`(`type: 'text'`, `maxLength: 40`, 라벨 `큰 제목`, 설명 "비워 두면 '제주를 가장 가까이, 숨비투어'가 보입니다."), `intro`(`type: 'text'`, `maxLength: 120`, 라벨 `한 줄 소개`, 설명에 기본 문구)
  - `access: { read: () => true, update: adminOnly }`
  - 버전 기록(`versions`)은 켜지 않는다(필요 없음).
- 길이 제한 40·120은 히어로 줄바꿈이 무너지지 않게 하는 초안 작성자 결정이다(`interview.md`). 검증 오류는 Payload 기본 문구(영문)다.
- `payload-types.ts`를 다시 만들어 `HomeSetting` 타입을 얻는다(`pnpm generate:types`). 테이블·열 이름은 Payload 규칙상 `home_settings`·`hero_image_id`·`headline`·`intro`일 것으로 보이며, M1에서 실제 이름을 확인해 `progress.md` §E.2에 적는다(AC-LANDING-016 SQL이 이 이름을 씀).

### B.2 미디어 익명 읽기 범위 — 홈 대표 사진 하나를 더함

- 문제: 업로드 파일 주소는 `media` 읽기 규칙을 그대로 쓰고(§A.2), 지금 규칙은 "공개 투어의 대표 이미지"만 익명에게 허용한다. 홈 대표 사진은 보통 어느 투어도 참조하지 않으므로, 넓히지 않으면 홈 화면 데이터 조회에서 사진이 채워지지 않고(ID 숫자로 남음) 파일 주소도 막힌다.
- 결정: `mediaReadAccess`의 익명 분기에서 공개 투어 대표 이미지 ID 목록에 `home-settings`의 `heroImage` ID를 더한다. 조회는 `req.payload.findGlobal({ slug: 'home-settings', depth: 0, select: { heroImage: true }, req })`(로컬 API 기본 `overrideAccess: true` — 이 함수가 직접 거르므로 문제 없음, 기존 투어 조회와 같은 방식). 익명 미디어 읽기 한 번에 조회가 1회 늘어난다(고정).
- `@MX:DEBT`(+`@MX:CEILING`·`@MX:UPGRADE`) 문구를 "공개 투어 대표 이미지 + 홈 대표 사진"으로 갱신한다.
- `depth: 0`이라 재귀(전역 설정 → 미디어 채우기 → 미디어 읽기 규칙 → 전역 설정)가 생기지 않는다.
- 홈 화면 데이터와의 상호작용(AC-LANDING-008): `getHomePageData`가 `depth: 1`로 전역 설정을 읽어 대표 사진을 채우거나 `listPublishedTours`가 투어 대표 이미지를 채울 때마다 이 규칙이 익명 미디어 읽기로 실행되고, 같은 `payload` 인스턴스(`req.payload`)에서 `findGlobal({ slug: 'home-settings', …, req })`(`overrideAccess` 생략 = `true`)가 함께 불린다. 그래서 AC-LANDING-008은 `findGlobal` 호출 전체가 아니라 "`req` 없이 부른 `home-settings` 호출(홈 화면 데이터 함수 자신의 호출) 정확히 1회"를 단언 대상으로 삼고, `req`를 넘기는 이 규칙 내부 호출은 허용한다. 이 규칙의 호출 역시 질의이므로 질의 수 고정 단언(같은 AC)에 그대로 포함된다.
- 범위 문구: 이 규칙은 관리자가 아닌 모든 요청에 같게 적용된다(지금은 관리자 외 인증 사용자가 없어 익명과 같음 — `spec.md` 가정 A7, REQ-LANDING-003).
- 이전 대표 사진은 다음 요청부터 목록에서 빠진다(규칙이 매번 현재 값을 읽음). 공개 투어가 같은 미디어를 참조하면 계속 보인다.

### B.3 홈 화면 데이터 — 기존 조회 계층을 그대로 잘라 씀

- 모듈(예: `src/lib/home-page.ts`):
  - `HOME_DEFAULTS = { headline: '제주를 가장 가까이, 숨비투어', intro: '제주의 소규모 투어와 다가오는 회차를 한눈에 확인하세요.' }`
  - `resolveHeroText(value, fallback)`: `null`·`undefined`·공백뿐이면 기본값, 아니면 앞뒤 공백을 뺀 값(순수 함수, 단위 시험).
  - `RECOMMENDED_TOUR_LIMIT = 6`, `pickRecommendedTours(tours)`: 입력 순서를 지킨 앞 6개(입력 배열 불변, 순수 함수).
  - `getHomePageData(payload, { now })`: (1) `payload.findGlobal({ slug: 'home-settings', depth: 1, overrideAccess: false })` — 사용자·`req`를 넘기지 않는다. (2) `listPublishedTours(payload, { now })`(이미 익명 읽기 고정). (3) 대표 사진은 `catalog.ts`의 `toImage`와 같은 규칙(채워진 문서이고 `url`이 있을 때만 이미지, 아니면 `null`)으로 바꾼다 — 같은 함수를 내보내 재사용한다.
- 추천 투어 정렬은 `/tours`와 같다(사용자 결정 D1 "가장 가까운 예정 회차 순"을 SPEC-TOUR-001 REQ-TOUR-009 정렬로 해석): 모집 중 회차가 있는 투어가 가장 가까운 회차 시작 시각 순으로 먼저, 6개가 안 되면 모집 중 회차가 없는 공개 투어가 제목 순으로 뒤를 채운다. 새 정렬 함수를 만들지 않는다.
- 남은 자리는 `listPublishedTours`가 이미 `getOccupiedSeatsBySession`(단일 점유 정의, `GROUP BY` 1회) → `getSessionAvailability`(단일 계산 지점)로 구한 값이다. 투어 카드는 그 값을 그대로 그린다.
- `@MX:DEBT`: `listPublishedTours`는 공개 투어 전체를 읽고 홈은 그중 6개만 쓴다(`@MX:CEILING` 공개 투어 수백 개, `@MX:UPGRADE` 투어가 늘어 홈이 느려지면 정렬 키를 DB 질의로 옮겨 6개만 읽기).

### B.4 히어로 구성

- 구조(예: `src/components/HomeHero.tsx`, 서버 컴포넌트): `<section aria-labelledby="hero-heading">` 안에 (사진 층) → (덮개 층) → (글자 층: `h1#hero-heading`, 소개 `p`, `투어 둘러보기` 링크). 바탕색은 항상 `--surface-dark` — 사진이 늦게 오거나 실패해도 짙은 면이 보인다.
- 사진: `next/image`에 `fill`, `unoptimized`(기존 원칙, `sharp` 없음), `preload`(Next 16 — `priority` 대신), `sizes="100vw"`, `className="object-cover"`, `alt={미디어 alt}`. 사진이 없으면(`image === null`) 사진 층과 덮개 층을 그리지 않는다(이미지 요청 0건).
- 대체 텍스트: 미디어의 `alt`는 업로드 때 필수라 비지 않는다(`Media.ts` 48~55행). 장식용(`alt=""`)으로 두지 않은 이유: 운영자가 고른 사진은 서비스 분위기를 전하는 내용이고, 관리자가 이미 대체 텍스트를 입력하는 흐름이 있다. 사용자가 장식용을 원하면 `alt=""`로 바꾸는 한 줄 변경이다(`interview.md` 확인 권장 항목).
- 높이: PC는 첫 화면에서 제목·소개·버튼이 접히지 않는 높이(예: `min-height: min(88vh, 760px)`), 모바일은 내용에 맞춘 높이와 위아래 `--section-y` 여백. 정확한 값은 run 단계가 스크린숏을 보고 정한다.
- 글자: 큰 제목 `--text-display`(56px/모바일 34px)·무게 600·`--tracking-display`·`--leading-display`, 소개 `--text-h3`(21px/19px)·무게 400. 줄바꿈은 기존 `word-break: keep-all`.
- 머리글은 히어로 위에 겹치지 않는다(§B.6).

### B.5 짙은 히어로의 대비 (WCAG 2.x 상대 휘도, 2026-11-16 계산)

계산은 `tokens.css`와 같은 공식으로 했다(스크래치 계산 스크립트, run 단계에서 단위 시험으로 다시 잰다 — AC-LANDING-006).

합성 규칙(plan-audit 1회차 D2로 하나로 정함, `spec.md` §2.5 "덮개 합성"): 덮개를 바탕 위에 겹친 색은 채널마다 `α × 덮개 + (1 − α) × 바탕`의 **실수값을 반올림하지 않고** 쓰며, 마지막 대비 값만 소수 둘째 자리에서 반올림한다. 아래 표의 덮개 배경 색 표기는 모두 이 실수값이다. 참고로 합성색을 정수로 반올림하면 5.25·4.47·3.27이 나오지만(4.5·3 판정은 같음) 이 SPEC은 그 값을 쓰지 않는다.

| 쌍 | 대비 | 기준 | 판정 |
|---|---|---|---|
| 흰 글자(`--on-dark`) / 짙은 면 `#272729` | 14.91:1 | 본문 4.5 | 통과 |
| 보조 글자 `--on-dark-2 #CCCCCC` / 짙은 면 | 9.28:1 | 4.5 | 통과(짙은 면에서만) |
| 흰 글자 / 덮개 0.60의 최악 배경 `rgb(119.4, 119.4, 120.6)` | 4.45:1 | 4.5 | **미달** — 기존 `--overlay-photo` 값 |
| **흰 글자 / 덮개 0.65의 최악 배경 `rgb(108.1, 108.1, 109.4)`** | **5.24:1** | 4.5 | **통과 — 채택** |
| 보조 글자 `#CCCCCC` / 덮개 0.65의 최악 배경 `rgb(108.1, 108.1, 109.4)` | 3.26:1 | 4.5 | 미달 → 사진 위에서는 보조 글자색을 쓰지 않고 소개도 흰색 |
| 버튼 글자 `--color-text #1D1D1F` / 흰 버튼 | 16.83:1 | 4.5 | 통과 |
| 버튼 글자 / 버튼 hover 바탕 `#F5F5F7` | 15.46:1 | 4.5 | 통과 |
| 흰 버튼 경계 / 짙은 면 | 14.91:1 | UI 3 | 통과 |
| 흰 버튼 경계 / 덮개 최악 배경 | 5.24:1 | UI 3 | 통과 |
| 흰 포커스 외곽선 / 짙은 면 · 덮개 최악 배경 | 14.91:1 · 5.24:1 | UI 3 | 통과 |
| 포인트 색 `#00737A` / 짙은 면 | 2.65:1 | UI 3 | **미달 → 히어로 안에서 쓰지 않음** |
| 포인트 색 / 흰 면(추천 투어 영역의 `투어 전체 보기`) | 5.63:1 | 4.5 | 통과 |

- 덮개는 그라데이션이 아니라 균일한 값이다. 위쪽만 어둡게 하는 그라데이션은 글자 아래가 순백인 사진에서 대비를 보장하지 못한다. 대가: 밝은 사진이 눈에 띄게 어두워진다(`interview.md` 확인 권장 항목).
- 토큰: `--overlay-photo`를 `rgba(29, 29, 31, 0.65)`로 바꾸고 주석에 위 수치를 적는다(쓰는 곳이 없던 토큰이라 영향 없음, §A.1). 이름은 그대로 둔다.
- 히어로 안 포커스 표시: 전역 `:focus-visible`(포인트 색)을 히어로 범위에서 `outline-color: var(--on-dark)`로 덮는다. 외곽선 두께 2px·간격 2px는 그대로.
- 버튼: `bg-(--on-dark) text-(--color-text) rounded-(--radius-pill) min-h-(--button-height)`, hover `bg-(--color-surface)`, 그림자 없음.

### B.6 공통 머리글·바닥글·본문 바로가기

- 위치: `(frontend)/layout.tsx`가 `<body>` 안에 `본문 바로가기` → `<SiteHeader/>` → 본문 영역 → `<SiteFooter/>`를 그린다. 관리자 화면은 `(payload)/layout.tsx`라 영향이 없다. 각 화면의 `<main>`은 그대로 둔다(화면마다 폭·여백이 다름).
- 본문 바로가기: 첫 포커스 요소. 평소에는 화면 밖에 두고 포커스를 받으면 보인다(Tailwind `sr-only focus:not-sr-only` 같은 방식). 대상은 본문 영역을 감싸는 `id="main-content"` 요소(`tabIndex={-1}`, 포커스 외곽선은 감춤)이며, 활성화하면 다음 Tab이 본문의 첫 포커스 요소로 간다. 터치 영역 44px 이상.
- 머리글(`SiteHeader`, 서버 컴포넌트): 흰 면, 아래쪽 가는 장식선(`--color-divider`, 대비 요구 없음), 콘텐츠 최대 폭 1200px 안에 왼쪽 텍스트 로고 `숨비투어`(`/`, 무게 600, `--color-text`)와 오른쪽 `투어`(`/tours`, `--color-accent`, hover `--color-accent-hover`). 두 링크 모두 높이 44px 이상. 제목 요소를 쓰지 않는다(화면마다 `h1`이 하나여야 함). 로그인·언어 전환 없음.
- 바닥글(`SiteFooter`): 연회색 면(`--surface-parchment`), 글자 `--color-text-2`(연회색 면 5.50:1), `--text-small`. 한 줄: `© 숨비투어` · `개인정보 처리방침(준비 중)`. 링크 없음.
- 바닥글 자리표시 결정(사용자 위임): 링크가 아닌 글자로 둔다. `href="#"`는 눌러도 아무 데도 가지 않는 죽은 링크이고, 빈 처리방침 페이지는 "처리방침이 있다"는 잘못된 인상을 준다. 배포 SPEC이 처리방침 문서를 만들 때 이 글자를 링크로 바꾼다(출시 전 점검 이월, `progress.md` §E.1).
- 머리글의 `투어` 링크에 현재 위치 표시(`aria-current`)는 두지 않는다(클라이언트 경로 확인이 필요해 서버 컴포넌트 원칙과 맞지 않고, 링크가 둘뿐이라 효과가 작음).

### B.7 알 수 없는 주소의 404 — 사용자 화면 모든 경로 받기 페이지

| 선택지 | 판단 |
|---|---|
| **`src/app/(frontend)/[...slug]/page.tsx`가 `notFound()`만 부름(채택)** | 정적 경로(`/admin`, `/api`, `/tours`, `/apply`)와 그 하위 동적 경로가 모든 경로 받기보다 우선하므로 기존 경로를 가리지 않는다. 처리하지 않는 주소가 `(frontend)/not-found.tsx`(머리글·바닥글 포함)로 404가 된다. 실험 기능을 쓰지 않는다 |
| Next 실험 기능 `global-not-found.js` | 실험 기능이고, 레이아웃을 따로 다시 써야 함(§A.2). 기각 |
| 처리하지 않는 주소는 Next 기본 404 그대로 | 머리글·바닥글이 없는 404가 남아 사용자 결정 D4("404에도 머리글")와 어긋남. 기각 |

- 확인할 위험: 모든 경로 받기가 관리자·API 경로를 가리면 안 된다(AC-LANDING-011이 `/admin` 로그인 화면과 `/api/tours` 응답을 확인, 기존 관리자 E2E도 계속 통과해야 함). 이 페이지는 요청 시점 렌더링이며 `generateStaticParams`를 두지 않는다.
- `notFound()`가 부르는 기존 404(`/tours/<없는 slug>` 등)는 그대로이며, 레이아웃이 머리글·바닥글을 더할 뿐이다.

### B.8 글꼴 — 공식 Pretendard 가변 파일을 `next/font/local`로

| 선택지 | 장점 | 단점 | 판단 |
|---|---|---|---|
| **A. 공식 `PretendardVariable.woff2`(2,057,688바이트)를 `src/app/(frontend)/fonts/`에 두고 `next/font/local`(채택)** | 사용자가 지정한 방식. 파일 하나, 같은 출처, 외부 요청 없음, 새 패키지 없음. 원본 그대로라 OFL 예약 이름 문제 없음 | 첫 방문에 약 2MB(이후 캐시). 저장소에 바이너리 약 2MB | 채택 |
| B. 공식 동적 분할본(92개 파일 + `unicode-range` CSS)을 정적 파일로 직접 호스팅 | 화면에 쓰인 글자 범위만 받아 첫 방문이 가벼움 | `next/font/local`은 파일별 `unicode-range`를 정할 수 없어(§A.2 옵션 목록) Next 글꼴 기능 밖에서 CSS를 따로 관리해야 함. 파일 93개 | 기각(사용자가 원하면 후속 작업) |
| C. 외부 CDN(jsDelivr 등) | 설정이 가장 쉬움 | 방문자 IP가 제3자에 전달됨, 외부 장애 의존, 사용자 결정 D6("직접 호스팅")과 어긋남 | 기각 |
| D. 직접 잘라 만든 한글 일부 글꼴 | 가벼움 | OFL상 수정본은 "Pretendard" 이름을 쓸 수 없고 관리 부담 | 기각 |

- 불러오기(예: `src/app/(frontend)/fonts.ts` 또는 `layout.tsx` 안): `localFont({ src: './fonts/PretendardVariable.woff2', weight: '45 920', display: 'swap', preload: false, variable: '--font-pretendard' })`. `<html lang="ko" className={pretendard.variable}>`.
  - `weight: '45 920'`은 Pretendard 가변 글꼴의 무게 축 범위다(공식 CSS 값). run 단계가 공식 `pretendardvariable.css`의 `font-weight` 값을 확인해 §E.2에 적는다.
  - `preload: false`: 히어로 사진이 첫 화면의 가장 큰 요소이고 `preload`로 먼저 받는다. 2MB 글꼴을 같이 미리 받으면 느린 회선에서 사진과 대역을 다툰다. 글자는 `swap`으로 대체 글꼴이 먼저 보인다.
  - `adjustFontFallback` 기본값(`'Arial'`)은 그대로 둔다(라틴 글자의 자리 밀림만 줄이며, 한글은 뒤의 대체 글꼴로 넘어감).
  - 보정 대체 글꼴의 위치: `adjustFontFallback`이 켜져 있으면 Next가 `local("Arial")`에 크기 보정값을 단 `@font-face`(이름 `'<생성 이름> Fallback'`)를 만들고, `variable` 클래스가 정의하는 `--font-pretendard`의 값을 `'<생성 이름>', '<생성 이름> Fallback'`으로 둔다(`node_modules/next/dist/build/webpack/loaders/next-font-loader/postcss-next-font.js` 60~74·104~111·137~144). 그래서 계산된 `font-family`는 `'<생성 이름>', '<생성 이름> Fallback', "Pretendard Variable", Pretendard, …, sans-serif` 순서가 된다 — 보정 대체 글꼴은 불러온 Pretendard와 기존 목록 사이에 끼고, 기존 목록은 순서 그대로 그 뒤에 남는다(REQ-LANDING-012 문구가 이 위치를 반영함. AC-LANDING-012는 첫 이름의 `FontFace` 상태, `"Pretendard Variable"` 포함, 마지막 이름 `sans-serif`만 본다).
- 토큰: `--font-sans: var(--font-pretendard, "Pretendard Variable"), "Pretendard Variable", Pretendard, -apple-system, …, sans-serif`. 기존 목록은 그대로 뒤에 남는다. `:root`와 `<html>`이 같은 요소라 변수가 그 자리에서 풀린다.
  - `var()` 대체값을 두는 이유(plan-audit 1회차 O-5): `--font-pretendard`가 정의되지 않은 요소에서 대체값 없는 `var(--font-pretendard)`는 `--font-sans` 선언 전체를 계산값 시점 무효로 만들어 기존 대체 목록까지 잃는다. 대체값 `"Pretendard Variable"`을 두면 변수가 없을 때 `"Pretendard Variable", "Pretendard Variable", Pretendard, …, sans-serif`가 되어(같은 이름이 두 번 나와도 해가 없음) 기존 목록이 그대로 살아남는다. 지금 설계는 `<html>`에 클래스를 붙여 변수가 항상 정의되므로 방어용이다.
- 파일 출처와 무결성: run 단계 M2 첫 작업에서 `https://github.com/orioncactus/pretendard/raw/v1.3.9/packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2`(태그 고정 주소)를 내려받아 크기 2,057,688바이트를 확인하고 SHA-256을 `progress.md` §E.2에 적는다. 저장소 규칙 테스트가 크기와 SHA-256을 상수로 단언한다(바뀌면 실패).
- 라이선스: 같은 태그의 `LICENSE` 전문을 `src/app/(frontend)/fonts/OFL.txt`로 둔다(저작권 줄 포함, 바꾸지 않음). `.prettierignore`는 바꾸지 않는다(Prettier는 `.txt`·`.woff2`를 검사하지 않음 — run 단계가 `pnpm format:check`로 확인).
- 줄바꿈 정규화: `.gitattributes`의 `* text=auto eol=lf`는 바이너리를 자동 판별하므로 `.woff2`는 변환되지 않는다. 커밋 전 `git diff --cached --numstat`에서 woff2가 `-	-`(바이너리)로 보이는지 확인한다. `.gitattributes`는 바꾸지 않는다.
- 관리자 화면: 글꼴 불러오기는 `(frontend)` 아래 파일에서만 한다. 저장소 규칙 테스트가 `next/font/local` import 위치를 확인한다(AC-LANDING-012).

### B.9 디자인 토큰과 전역 스타일

- `tokens.css`(`(frontend)`): `--font-sans` 앞에 `var(--font-pretendard, "Pretendard Variable")` 추가(§B.8), `--overlay-photo` 0.65와 대비 주석 갱신, `--surface-dark` 주석("홈 히어로에서 사용")과 포인트 색 경고 주석을 이 SPEC의 결정으로 갱신. 새 토큰은 꼭 필요할 때만 더한다.
- `globals.css`: 동작 줄이기 규칙 — `@media (prefers-reduced-motion: reduce) { *, ::before, ::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important } }`. 기존 화면의 `transition-colors`도 이 규칙을 따른다.
- 섹션 면: 홈은 짙은 히어로 → 흰 추천 투어(`--surface-white`, 위아래 `--section-y`) → 연회색 바닥글. 기존 화면의 면 배치는 바꾸지 않는다.
- 원본 토큰 파일(`.moai/project/design/tokens.css`)과 `handoff.md` §3·§4의 문서 갱신(덮개 값, 짙은 면 사용, 바닥글 자리표시)은 sync 단계(manager-docs)가 한다.

### B.10 투어 카드 제목 단계

- `TourCard`에 `headingLevel?: 'h2' | 'h3'`(기본 `'h2'`)를 더한다. `/tours`는 그대로 `h2`, 홈은 `h3`(영역 제목 `추천 투어`가 `h2`). 다른 동작·문구·스타일은 바꾸지 않는다.

### B.11 테스트가 홈 화면을 다루는 방법

| 대상 | 단위(Vitest) | 통합(Vitest, 실제 PostgreSQL) | E2E(Playwright, `next dev`) |
|---|---|---|---|
| 기본 문구·추천 자르기 | `resolveHeroText`, `pickRecommendedTours` | — | 문구가 비었을 때 기본 문구 표시 |
| 대비 | `tokens.css` 값을 읽어 표 §B.5 수치 재계산(시험 도우미에 WCAG 공식) | — | 덮개·글자·버튼·포커스의 계산된 색 |
| 전역 설정 | — | 등록·필드·길이 검증·접근 규칙(`overrideAccess: false`) | REST·GraphQL 권한, 관리자 화면 편집 반영 |
| 미디어 공개 범위 | — | 익명 `find`의 결과 집합 | 익명 파일 주소 응답 |
| 홈 데이터 | — | `getHomePageData`와 `listPublishedTours` 앞 6개 비교, 질의 수, 빈 목록 렌더링(`renderToStaticMarkup`) | 카드 순서·남은 자리가 `/tours`와 같음 |
| 공통 레이아웃·404·글꼴·접근성 | 저장소 규칙(글꼴 파일·import 위치·요청 시점 렌더링) | — | 6개 공개 화면의 머리글·바닥글·랜드마크, 글꼴 요청, 375px, 동작 줄이기, 스크린숏 |

- 전역 설정 원래 값: 전역 설정은 개발 DB에 하나뿐이고 운영자가 개발 중 실제 값을 넣었을 수 있다. 전역 설정을 바꾸는 통합 시험 파일과 E2E 파일은 다음 순서를 지킨다(시험 도우미 하나로 모아 두 쪽이 같이 쓴다).
  1. 시작: `.moai/state/verify/landing/home-settings-original.json`(gitignore 대상 — `.gitignore` 203행 `.moai/state/`)이 이미 있으면 이전 실행이 복원 전에 끊긴 것이므로, 지금 DB 값이 아니라 그 파일의 값을 원래 값으로 삼아 먼저 되돌린다. 없으면 `findGlobal`(`overrideAccess: true`, `depth: 0`)로 세 필드를 읽어 `값 ?? null`로 맞춘 객체(`heroImage`는 미디어 ID 숫자 또는 `null`)를 이 파일에 쓴다. 파일 쓰기가 끝나기 전에는 설정을 바꾸지 않는다.
  2. 끝(`afterAll`, 실패해도 실행): 파일의 값으로 `updateGlobal`(`overrideAccess: true`)을 불러 되돌리고, `depth: 0`으로 다시 읽어 세 필드를 `값 ?? null`로 맞춘 뒤 파일의 값과 엄격 비교(`toEqual`)한다. 저장한 적 없는 전역 설정은 처음에 필드가 없고(`undefined`) 되돌린 뒤에는 `null`이므로 정규화 없이는 첫 실행에서 실패한다(plan-audit 1회차 D5).
  3. 비교가 통과하면 파일을 지운다. 비교가 실패하면 파일을 남겨 다음 실행이나 사람이 복원할 수 있게 한다.
  - 파일에 남는 값은 홈 화면 문구와 미디어 ID뿐이라 개인정보가 아니다(가정 A2). 프로세스가 강제 종료되어 `afterAll`이 실행되지 않아도 원래 값이 파일로 남는다(plan-audit 1회차 O-8). 통합 시험은 파일을 하나씩 실행하고(`fileParallelism: false`) E2E는 `workers: 1`이라 서로 겹치지 않는다. 그래도 전역 설정을 바꾸는 통합 시험은 한 파일에 모은다.
- 표식 미디어: 테스트가 대표 사진으로 쓰는 미디어는 파일 이름 `test-<무작위 값>-…png`로 만들고 끝나면 지운다(설정을 먼저 되돌린 뒤). 순백 1×1 PNG가 하나 필요하다(덮개 최악 배경 확인용) — 시험 도우미에 바이트 상수로 둔다(새 패키지 없음).
- E2E의 추천 투어는 개발 DB의 실제 공개 투어와 섞인다. 기대값은 페이지를 열기 직전에 로컬 API로 구한 `listPublishedTours`(익명) 앞 6개로 정하고, 표식 투어에 기대지 않는다.
- 관리자 화면 편집: E2E는 테스트 관리자로 로그인해 `/admin/globals/home-settings`에서 큰 제목만 바꿔 저장한다. 대표 사진 선택은 업로드 선택 창 구조에 기대어 깨지기 쉬우므로 요청 API(`POST /api/globals/home-settings`, `Authorization: JWT`)로 정하고, 관리자 화면에서 사진을 올려 고르는 흐름은 사용자 수동 확인으로 남긴다(AC-LANDING-002).
- E2E 포트 단언: SPEC-INFRA-001 AC-INFRA-008의 "각 페이지 방문 뒤 E2E 포트 단언"(`tests/helpers/e2e-assert.ts`의 `expectE2ePort`)은 이 SPEC이 대체하지 않으므로, 이 SPEC의 새 E2E도 페이지를 연 뒤마다 이 도우미를 부른다(대체하는 것은 같은 AC의 홈 부분뿐 — `spec.md` §2.3).
- 스크린숏: `.moai/state/verify/landing/` 아래(gitignore 대상). 1440×900과 375×812 뷰포트, 홈(사진 없음·사진 있음), `/tours`, 상세, 404.
- 질의 수: SPEC-ADMIN-001 AC-ADMIN-012와 같은 방식(`payload.db.pool.query`·`connect` 감시). 기준 측정 뒤 표식 공개 투어 5개(대표 이미지와 회차 포함)를 더하고 다시 잰다.

## §C. 사전 점검 (run 단계 시작 전, 순차)

```powershell
git branch --show-current          # main
git rev-parse --short HEAD         # 기준 HEAD 기록 (계획 시점 b8087f8)
git diff --stat b8087f8 -- src tests pnpm-lock.yaml package.json   # 계획 뒤 이 SPEC 범위 파일이 바뀌었는지 확인(바뀌었으면 §A.1 다시 점검)
git status --short                 # 추적 파일 변경 확인(미추적 파일은 §A.1 목록과 같아야 함)
docker compose ps --format '{{.Service}} {{.Health}}'   # postgres healthy
pnpm install --frozen-lockfile
pnpm test                          # 기준선 통과 수 기록
pnpm e2e                           # 기준선 통과 수 기록
pnpm lint
pnpm format:check
pnpm typecheck
```

- 기준선 결과(종료 코드와 통과 수)를 `progress.md` §E.2 첫머리에 적는다. 긴 출력은 `.moai/state/verify/<세션>/` 아래 파일로 남긴다.
- 개발 DB의 현재 `home-settings`는 아직 없다(테이블이 M1에서 생김). M1 직후 전역 설정 원래 값(비어 있을 것 — `값 ?? null`로 맞추면 세 필드 모두 `null`)을 §E.2에 적는다. 시작 전 `.moai/state/verify/landing/home-settings-original.json`이 없음을 확인한다(있으면 이전 실행의 원래 값이므로 지우지 말고 §B.11 1번 절차를 따른다).
- 글꼴 파일 내려받기와 크기·SHA-256 기록은 M2 첫 작업이다(§B.8). 크기가 2,057,688바이트가 아니면 차단자 보고.
- `.env` 내용은 출력하지 않는다.

## §D. 제약 (지킬 것)

- **실제 관리자 계정을 건드리지 않는다.** 테스트는 `@example.test` 계정만 만들고 쓰고 지운다. 수동 확인(AC-LANDING-002·013)은 사용자가 직접 한다.
- **전역 설정 원래 값을 잃지 않는다.** 전역 설정을 바꾸는 테스트는 저장·복원·복원 확인을 반드시 한다(§B.11).
- 테스트 데이터는 표식을 붙이고 끝나면 지운다(투어·회차·신청·미디어).
- 새 npm 패키지 추가 금지(직접·간접). `pnpm-lock.yaml`과 `package.json`의 의존성은 바뀌지 않아야 한다. 외부 글꼴·이미지 CDN을 쓰지 않는다.
- 글꼴 파일은 공식 v1.3.9 원본 그대로(크기·SHA-256 고정), 라이선스 전문을 함께 둔다. 글꼴을 잘라 내거나 이름을 바꾸지 않는다.
- 유지: `occupancy.ts`·`session-availability.ts`·`catalog-order.ts`의 규칙과 `catalog.ts`의 익명 읽기 고정(이 SPEC은 `toImage`를 내보내기만 할 수 있음), `submit-application.ts`, 신청·관리자 운영 기능, `(payload)/` 템플릿 파일, 투어 카드의 문구·스타일(제목 단계 선택값만 더함), 기존 공개 화면의 내용과 면 배치.
- 토큰과 글꼴은 `(frontend)` 안에서만 불러온다(REQ-TOUR-013, AC-TOUR-014 유지).
- `.prettierignore`, `eslint.config.mjs`의 검사 제외 목록, `pnpm-workspace.yaml`, `.gitattributes`는 바꾸지 않는다.
- 생성 파일은 `pnpm generate:types`(필요하면 `pnpm generate:importmap`)로만 다시 만든다.
- 검증 셸은 Windows PowerShell 5.1. 명령 인자 안에 큰따옴표를 겹쳐 쓰지 않는다.
- 커밋은 경로를 명시해 스테이징한다(`git add -A` 금지). `.env`, `media/`, 검증 로그·스크린숏은 커밋하지 않는다.
- Conventional Commits, 메시지에 `SPEC-LANDING-001`, 마지막 줄 `🗿 MoAI`. `--no-verify` 금지.

## §E. 자체 검증 순서

### E-1. 순차 실행 (상태를 쓰는 명령)

`pnpm test`와 `pnpm e2e`는 같은 개발 DB를 쓰고, `build`와 `e2e`는 `.next/`를 다시 쓰므로 병렬로 실행하지 않는다.

1. `docker compose up -d` → `postgres healthy`
2. `pnpm generate:types` → 생성 파일 차이 확인
3. `pnpm typecheck`
4. `pnpm build` → AC-LANDING-015 매니페스트 확인(대상 존재 단언 먼저)
5. `pnpm test`
6. `pnpm e2e`
7. 전역 설정 원래 값과 표식 데이터 잔여 확인(AC-LANDING-016 SQL)

### E-2. 병렬 실행 (읽기 전용 — E-1이 끝난 뒤 한 턴에)

```powershell
pnpm lint
pnpm format:check
git status --short
git diff --stat b8087f8 -- pnpm-lock.yaml package.json .prettierignore eslint.config.mjs pnpm-workspace.yaml .gitattributes src/lib/occupancy.ts src/lib/session-availability.ts src/lib/catalog-order.ts src/lib/submit-application.ts
```

마지막 명령의 출력은 비어 있어야 한다(§D).

## §F. 마일스톤

각 마일스톤은 RED(실패하는 테스트) → GREEN(최소 구현) → REFACTOR 순서다. RED 단계의 실패 출력은 `progress.md` §E.2에 그대로 남긴다.

### M1 — 홈 화면 설정과 미디어 공개 범위 (우선순위: High — 데이터 모델과 접근 규칙, 되돌리기 가장 어려운 결정)

- RED: 통합 — 전역 설정 목록이 정확히 `['home-settings']`, 라벨·필드·`maxLength`, 41자·121자 저장 거부와 값 불변(AC-LANDING-001), 익명 읽기 허용·익명 수정 거부·관리자 수정 허용(AC-LANDING-002 통합 부분), 미디어 익명 읽기 범위(설정 전·설정 후·비운 뒤·투어가 참조하는 미디어 유지·고아 미디어 계속 숨김, AC-LANDING-003 통합 부분), 대표 사진 미디어 삭제 → 설정 값 비움(AC-LANDING-005 (c)). 단위 — `resolveHeroText`, `pickRecommendedTours`(AC-LANDING-004·007 단위 부분)
- GREEN: `src/globals/HomeSettings.ts`, `payload.config.ts` 등록, `access.ts` `mediaReadAccess` 확장(+`@MX:DEBT` 갱신), `src/lib/home-page.ts`(기본 문구·자르기·`getHomePageData`), `catalog.ts`의 `toImage` 내보내기, `pnpm generate:types`
- 통합 — `getHomePageData`가 `listPublishedTours` 앞 6개와 같음, 비공개 투어 없음, 질의 수 고정·연결 풀만(AC-LANDING-007·008)
- 테이블·열 이름과 전역 설정 원래 값(M1 직후)을 §E.2에 기록
- 검증: AC-LANDING-001, AC-LANDING-002(통합 부분), AC-LANDING-003(통합 부분), AC-LANDING-005 (c)·(d), AC-LANDING-007(단위·통합 부분), AC-LANDING-008
- 관련 REQ: 001, 002, 003, 005, 007, 008

### M2 — 공통 머리글·바닥글·404·글꼴 (우선순위: High — 모든 공개 화면에 영향, 기존 E2E 단언이 바뀜)

- 첫 작업: Pretendard v1.3.9 파일·라이선스 내려받기, 크기·SHA-256 기록(§B.8)
- RED: 저장소 규칙 — 글꼴 파일 크기·SHA-256, `OFL.txt` 문구, `next/font/local` import가 `(frontend)` 아래에만, `(payload)`가 글꼴 파일 이름을 참조하지 않음(AC-LANDING-012). E2E — 6개 공개 화면의 머리글(링크 2개, 제목 요소 없음)·바닥글(링크 0개)·`href="#"` 없음(AC-LANDING-009·010), `/no-such-page`·`/a/b/c` 404와 머리글, `/admin`·`/api/tours` 영향 없음(AC-LANDING-011), 글꼴 요청이 같은 출처의 `/_next/static/media/`이고 외부 출처 요청 0건, 본문 글꼴 이름(AC-LANDING-012 E2E 부분), 랜드마크·`h1` 하나·본문 바로가기·동작 줄이기(AC-LANDING-014의 공통 부분)
- GREEN: `SiteHeader`·`SiteFooter`, `layout.tsx`(본문 바로가기·글꼴 변수·`metadata.description` 갱신), `(frontend)/[...slug]/page.tsx`, `src/app/(frontend)/fonts/{PretendardVariable.woff2,OFL.txt}`, `tokens.css` `--font-sans`, `globals.css` 동작 줄이기 규칙
- 기존 단언 갱신: `tests/e2e/home.spec.ts`의 `a[href="/tours"]` 1개 단언(머리글 링크가 생김) — M3에서 파일 전체를 새 기준으로 바꾸되, M2에서는 깨지는 단언만 고친다
- 검증: AC-LANDING-009, AC-LANDING-010, AC-LANDING-011, AC-LANDING-012, AC-LANDING-014(공통 부분)
- 관련 REQ: 009, 010, 011, 012, 014

### M3 — 홈 화면: 히어로와 추천 투어 (우선순위: Medium)

- RED: 단위 — 대비 재계산(AC-LANDING-006 단위 부분). 통합 — 빈 추천 목록의 렌더링 문구(`renderToStaticMarkup`, AC-LANDING-007). E2E — 기본 문구·사용자 문구·HTML 미해석(AC-LANDING-004), 사진 없음(이미지 요소·요청 0건, 짙은 면)·사진 있음(`alt`)·미디어 삭제 뒤(AC-LANDING-005), 덮개·글자·버튼·포커스 색과 히어로 안 포인트 색 없음(AC-LANDING-006), 추천 투어 순서·개수·남은 자리·`투어 전체 보기`(AC-LANDING-007), 홈 `h2`·카드 `h3`(AC-LANDING-014 홈 부분), 저장소 규칙 `DATA_PAGES`에 홈 추가와 빌드 매니페스트(AC-LANDING-015)
- GREEN: `HomeHero`, `RecommendedTours`, `TourCard` 제목 단계 선택값, `page.tsx`(`connection()`·`getHomePageData`), `tokens.css` 덮개 값·주석
- `tests/e2e/home.spec.ts`를 새 기준으로 다시 씀(임시 홈 단언 제거 — SPEC-INFRA-001 AC-INFRA-008 홈 부분·SPEC-TOUR-001 AC-TOUR-015 대체)
- 검증: AC-LANDING-004, AC-LANDING-005, AC-LANDING-006, AC-LANDING-007, AC-LANDING-014(홈 부분), AC-LANDING-015
- 관련 REQ: 004, 005, 006, 007, 014, 015

### M4 — 관리자 편집 흐름, 반응형, 스크린숏 (우선순위: Medium)

- RED: E2E — 관리자 화면 메뉴의 `홈 화면 설정`, 큰 제목 편집·저장 → 익명 `/`에 반영, REST·GraphQL 권한(AC-LANDING-002 E2E 부분), 익명 파일 주소 응답(AC-LANDING-003 E2E 부분), 1440·375 디자인 값(본문 크기, 알약, 그림자 없음, 면 색, 가로 스크롤 없음, 터치 영역, AC-LANDING-013), 전역 설정 바꾼 뒤 새로고침 반영(AC-LANDING-015 E2E 부분), 스크린숏 파일 생성(AC-LANDING-016)
- GREEN: 필요한 화면 조정(여백·높이·줄바꿈)만. 새 기능은 더하지 않는다
- 수동: 사용자가 관리자 화면에서 사진을 직접 올려 대표 사진으로 고르고 저장·비우기, 1440·375 스크린숏과 실제 화면을 보고 디자인 방향을 확인 → §E.2 기록(AC-LANDING-002·013)
- 검증: AC-LANDING-002, AC-LANDING-003, AC-LANDING-013, AC-LANDING-015
- 관련 REQ: 002, 003, 013, 015

### M5 — 회귀 정리, 품질 게이트, MX (우선순위: Low)

- 전체 품질 게이트(`acceptance.md` §8), 커버리지 85% 이상, 표식 데이터·전역 설정 원래 값 잔여 확인(AC-LANDING-016)
- `TourImage.tsx`의 `priority`는 이 SPEC 범위가 아니므로 바꾸지 않는다(빌드 경고가 새로 생기지 않는지만 확인). 새 코드는 `preload`를 쓴다
- MX 태그: `getHomePageData` `@MX:DEBT`(+`@MX:CEILING`·`@MX:UPGRADE`, §B.3), `mediaReadAccess` `@MX:DEBT` 갱신(§B.2), 모든 경로 받기 페이지 `@MX:NOTE`(관리자·API 경로를 가리지 않는 이유, §B.7), 글꼴 불러오기 `@MX:NOTE`(원본 고정·라이선스·`preload: false` 이유), 히어로 덮개 `@MX:NOTE`(대비 수치), `catalog.ts`의 `toImage`가 호출자 3곳이 되면 `@MX:ANCHOR` 검토
- 출시 전 점검 이월 후보(바닥글 처리방침 링크 연결, 운영 대표 사진 크기·최적화)를 §E.2에 적어 sync 단계가 옮기게 한다
- `progress.md` §E.2·§E.3 작성
- 검증: AC-LANDING-016
- 관련 REQ: 016

### 예상 생성·수정 파일

- 생성: `src/globals/HomeSettings.ts`, `src/lib/home-page.ts`, `src/components/{SiteHeader,SiteFooter,HomeHero,RecommendedTours}.tsx`(이름은 예시, 합치거나 나눌 수 있음), `src/app/(frontend)/[...slug]/page.tsx`, `src/app/(frontend)/fonts/{PretendardVariable.woff2,OFL.txt}`, 필요하면 `src/app/(frontend)/fonts.ts`, `tests/unit/home-page.spec.ts`, `tests/unit/contrast.spec.ts`(또는 저장소 규칙 안), `tests/integration/home-settings.spec.ts`, `tests/integration/home-page.spec.ts`, `tests/e2e/{layout,home-admin}.spec.ts`(예시), 필요하면 `tests/helpers/home-fixtures.ts`
- 수정: `src/app/(frontend)/{page.tsx,layout.tsx,globals.css,tokens.css}`, `src/components/TourCard.tsx`(제목 단계 선택값만), `src/lib/access.ts`(`mediaReadAccess`), `src/lib/catalog.ts`(`toImage` 내보내기만), `src/payload.config.ts`, `tests/e2e/home.spec.ts`, `tests/unit/repo-rules.spec.ts`, 필요하면 `tests/integration/catalog-access.spec.ts`(새 사례 추가만)
- 생성 파일 갱신: `src/payload-types.ts`(필요하면 `src/app/(payload)/admin/importMap.js`)

## §G. 위험과 대응

| ID | 위험 | 대응 |
|---|---|---|
| R1 | 미디어 공개 범위를 넓히지 않으면 익명 방문자에게 대표 사진 파일이 막혀 사진이 안 보이거나 깨진 이미지가 됨 | §B.2 확장, AC-LANDING-003(익명 `find`와 파일 주소 둘 다), AC-LANDING-005 |
| R2 | 넓힌 범위가 지나쳐 다른 미디어(이전 사진, 고아 미디어)가 공개됨 | 규칙이 매번 현재 설정 값만 더함. AC-LANDING-003이 비운 뒤 숨김과 고아 미디어 숨김을 확인, SPEC-TOUR-001 AC-TOUR-006 유지 |
| R3 | 테스트가 개발 DB의 전역 설정(운영자가 넣은 실제 값)을 덮어쓰고 되돌리지 못함 | 바꾸기 전에 원래 값을 gitignore 대상 파일에 남기고, `afterAll` 복원·`?? null` 비교·파일 삭제(§B.11). 강제 종료로 복원이 빠지면 다음 실행이 파일 값으로 먼저 되돌림. AC-LANDING-016 SQL로 표식 잔여 0, 파일 잔여 없음 확인 |
| R4 | 모든 경로 받기 페이지가 관리자·API·정적 파일 경로를 가림 | 정적 경로 우선 규칙. AC-LANDING-011이 `/admin`·`/api/tours`를 확인하고 기존 관리자 E2E 전체가 계속 통과해야 함. 문제가 생기면 차단자 보고(대안: 실험 기능 또는 처리하지 않는 주소는 범위에서 제외 — 사용자 결정 필요) |
| R5 | 글꼴 2MB가 첫 방문을 느리게 함 | `preload: false`·`swap`으로 글자 표시를 막지 않음, 캐시 뒤에는 영향 없음. 더 가볍게 하려면 동적 분할본(§B.8 B안)을 후속 SPEC으로 |
| R6 | 운영자가 큰 사진(최대 5MB)을 올리면 `sharp` 없이 원본이 그대로 나가 첫 화면이 느림 | 관리자 필드 설명으로 권장 크기 안내(가정 A3). 이미지 최적화는 범위 밖, 출시 전 점검 이월 |
| R7 | 미디어 문서는 있는데 파일이 디스크에서 사라지면 `<img>`가 깨진 이미지로 보일 수 있음 | 바탕이 짙은 면이라 글자는 그대로 읽힘. 운영 저장소 전환(배포 SPEC)에서 다시 확인. 잔여 위험으로 기록 |
| R8 | 덮개 0.65로 밝은 사진이 어둡게 보여 사용자가 싫어할 수 있음 | 최악 배경 기준 대비 보장의 대가로 기록(`interview.md` 확인 권장). 바꾸면 §B.5 표와 AC-LANDING-006 수치를 함께 고침 |
| R9 | 개발 DB의 실제 공개 투어 때문에 E2E 추천 투어 기대값이 흔들림 | 기대값을 페이지 열기 직전 로컬 API 결과로 정함(§B.11). 표식 투어 존재에 기대지 않음 |
| R10 | `listPublishedTours`의 대표 이미지 채우기가 투어 수에 따라 질의를 늘림(SPEC-TOUR-001에서 이미지 포함 질의 수를 잰 적 없음) | AC-LANDING-008이 대표 이미지가 있는 투어로 잰다. 늘면 이 SPEC 범위 밖 기존 조회 계층의 결함이므로 차단자 보고(조회 계층 수정 여부는 사용자 결정) |
| R11 | `next/font/local`의 글꼴 이름이 바뀌어 기존 `"Pretendard Variable"` 이름으로는 적용되지 않음 | `--font-sans` 맨 앞에 `var(--font-pretendard)`(§B.8). AC-LANDING-012가 계산된 글꼴 목록 첫 이름이 불러온 글꼴이고 상태가 `loaded`임을 확인 |
| R12 | 히어로 안에서 전역 포커스 표시(포인트 색 2.65:1)가 그대로 쓰임 | 히어로 범위에서 흰 외곽선으로 덮음. AC-LANDING-006이 포커스된 버튼의 외곽선 색을 확인 |
| R13 | 머리글·바닥글이 생겨 기존 E2E의 링크 개수·제목 단언이 깨짐 | 머리글·바닥글에 제목 요소를 두지 않음. 링크 개수 단언은 `home.spec.ts`뿐(§A.1 확인). 나머지 E2E는 그대로 통과해야 함 |
| R14 | 빈 추천 목록은 공유 개발 DB에서 E2E로 재현할 수 없음 | 통합 시험에서 `renderToStaticMarkup`으로 빈 목록 렌더링 확인(선례 있음). `next/link`가 그 환경에서 렌더링되지 않으면 문구 상수와 분기를 순수 함수로 분리해 단위 시험하고 §E.2에 기록 |
| R15 | Payload 관리자 화면의 전역 설정 편집 화면 구조(선택자)가 바뀌어 E2E가 깨짐 | 버전 3.93.0 고정, 라벨 기반 선택자 우선. 사진 선택은 요청 API로(§B.11) |
| R16 | 글꼴 파일이 바뀌거나 잘못 받은 파일이 커밋됨 | 크기·SHA-256 상수 단언(AC-LANDING-012) |
| R17 | 처리방침 자리표시가 출시까지 링크로 바뀌지 않음 | 출시 전 점검 이월(배포 SPEC), `progress.md` §E.1 기록 |
| R18 | 동작 줄이기 전역 규칙이 기존 화면의 의도된 전환을 없앰 | 동작 줄이기를 설정한 방문자에게만 적용(의도한 결과). 기본 설정에서는 바뀌지 않음 |
| R19 | 직접 작성 코드가 Tier M 지침을 크게 넘음 | §A.3 분할 기준 |
| R20 | 관리자가 비공개 투어의 사진이나 어느 투어도 참조하지 않는 사진을 대표 사진으로 고르면 그 사진이 문서·파일 주소 모두 공개됨 | 대표 사진은 공개하려고 고르는 것이므로 의도된 결과(`spec.md` 가정 A7). 관리자 필드 설명에 "고른 사진은 누구나 볼 수 있습니다"를 적음(§B.1). 대표 사진을 바꾸거나 비우면 다음 요청부터 다시 숨김(AC-LANDING-003) |

알려진 한계 (sync-audit 선택 지적 F1~F4 — 지금은 고치지 않음, 동작 결함 아님):

- **F1 익명 미디어 읽기 비용**: `mediaReadAccess`가 공개 투어 목록에 더해 `home-settings`도 읽으므로(§B.2), 익명 이미지 파일 요청(`/api/media/file/*`) 하나가 투어 목록 + 전역 설정 + 미디어 조회의 질의 3회가 된다. 공개 투어 수십 개 규모에서는 문제없으며 `src/lib/access.ts`의 `@MX:DEBT`(+`@MX:CEILING`·`@MX:UPGRADE`)에 기록했다. 규모가 커지면 요청 단위로 ID 목록을 기억하거나 미디어 쪽 공개 표시로 바꾼다.
- **F2 원래 값 파일과 공유 DB 행**: 전역 설정 원래 값 파일(§B.11)은 체크아웃(작업 트리)마다 따로 생기지만 `home-settings` 행은 개발 DB에 하나뿐이다. 두 체크아웃에서 시험을 동시에 돌리거나, 시험 중에 같은 DB를 쓰는 개발 서버를 보면 표식 문구·사진이 잠깐 보이고 복원 순서가 엇갈릴 수 있다. 전역 설정을 바꾸는 시험(`pnpm test`, `pnpm e2e`)은 한 번에 하나씩만 실행한다.
- **F3 질의 수 측정 범위**: AC-LANDING-008의 질의 수 측정은 대표 사진이 비어 있는 상태에서만 이뤄진다. 사진이 있을 때 더해지는 채우기 경로(미디어 조회 + 접근 규칙 내부 조회)는 측정 구간 밖이다. 투어·회차 수와 무관한 고정 비용이라 REQ-LANDING-008 위반은 아니며, 필요하면 같은 측정을 사진이 있는 상태로 한 번 더 한다.
- **F4 모든 경로 받기의 범위**: `(frontend)/[...slug]/page.tsx`는 처리하지 않는 모든 경로(`/api` 단독, 저장소에 파비콘이 없어 `/favicon.ico` 포함)에 요청 시점 HTML 404를 그린다. DB 조회는 없고 REQ-LANDING-011대로의 동작이다. 배포 SPEC에서 파비콘을 둘 때 함께 고려한다.

배포 SPEC로 넘기는 출시 전 점검(로드맵 8번):

- 바닥글의 `개인정보 처리방침(준비 중)` 글자를 실제 처리방침 페이지 링크로 바꾼다(R17, REQ-LANDING-010의 "처리방침 문서가 생기기 전까지").
- 운영 대표 사진의 크기·형식을 확인한다(`sharp` 없음 — 원본 그대로 전송, R6·가정 A3).
- 업로드 저장소를 Supabase Storage로 바꾼 뒤 대표 사진 파일 주소(`serverURL`)와 익명 접근을 다시 확인한다(R7, 가정 A4).

안티 패턴 (하지 말 것):

- 홈 화면 조회에서 `overrideAccess`를 생략하기(로컬 API 기본값 `true` — 공개되지 않은 투어·미디어가 읽힘)
- 추천 투어용 정렬·점유 인원 계산을 새로 쓰기(`listPublishedTours`를 잘라 씀)
- 기본 문구를 Payload `defaultValue`에만 기대기(관리자가 비운 경우를 놓침)
- 히어로 안에서 포인트 색을 글자·버튼·포커스에 쓰기
- 사진 위 대비를 그라데이션이나 "보통 사진" 기준으로 판정하기(최악 배경 기준)
- 대표 사진이 없을 때 빈 `src`나 자리표시 이미지를 그리기
- `href="#"` 같은 죽은 링크로 처리방침 자리를 채우기
- 글꼴을 외부 CDN에서 불러오거나 직접 잘라 이름을 그대로 쓰기
- 테스트에서 전역 설정을 바꾸고 되돌리지 않기, 실제 관리자 계정으로 로그인하기
- 검증 명령을 실행하지 않고 통과로 기록하기

## §H. 상호 참조

- `spec.md` — REQ-LANDING-001~016, 용어(§2.5), 가정(§2.4), 제외 범위
- `acceptance.md` — 응답 표(§0), AC-LANDING-001~016, 품질 게이트, 완료 정의
- `interview.md` — 사용자 결정 D1~D7과 초안 작성자 결정
- `.moai/specs/SPEC-TOUR-001/` — 조회 계층·익명 읽기(REQ-TOUR-005), 단일 계산 지점(REQ-TOUR-007), 목록 정렬(REQ-TOUR-009), 요청 시점 렌더링(REQ-TOUR-012, AC-TOUR-013), 토큰 범위(REQ-TOUR-013), 임시 홈 링크(REQ-TOUR-014)
- `.moai/specs/SPEC-APPLY-001/` — 점유 인원 단일 정의(REQ-APPLY-005)
- `.moai/specs/SPEC-ADMIN-001/` — 질의 수 측정 방식(AC-ADMIN-012), 서버 컴포넌트 렌더링 시험 선례
- `.moai/project/product.md` §7, `structure.md` §2, `tech.md` §8·§8.1, `design/handoff.md` §2~§4, `design/tokens.css`
- 근거 소스: §A.2 표의 경로와 URL
