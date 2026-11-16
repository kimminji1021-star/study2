# SPEC-LANDING-001 (compact) — 랜딩 페이지(디자인)

> run 단계용 요약본. 원본: `spec.md`(요구사항·용어·가정), `acceptance.md`(응답 표·수용 기준), `plan.md`(결정·근거·마일스톤·위험), `interview.md`(사용자 결정). 내용이 다르면 원본이 우선한다.
> Tier M · status: draft · 문서 버전 0.1.1(2026-11-16, plan-audit 1회차 반영) · 개발 방식: TDD · 검증 셸: Windows PowerShell 5.1 · 의존: SPEC-TOUR-001·SPEC-APPLY-001(completed) · 기준 HEAD `b8087f8`

## 사용자 결정 (구속)

D1 홈 = 전폭 히어로(대표 사진·큰 제목·한 줄 소개·알약 `투어 둘러보기`) + 추천 투어(가장 가까운 회차 순 공개 투어 최대 6개, 기존 `TourCard`, 단일 점유 정의, N+1 없음, `투어 전체 보기`). about·이용 방법 없음 · D2 대표 사진은 관리자 전역 설정 "홈 화면 설정"의 `media` 업로드, 없으면 깨진 이미지 없는 짙은 히어로, 코드 변경 없이 교체 · D3 큰 제목·소개도 같은 설정, 비면 한국어 기본 문구 · D4 머리글 = 텍스트 로고 `숨비투어` + `투어`, 모든 공개 화면(홈·`/tours`·상세·`/apply`·`/apply/complete`·404), 로그인·언어 전환 없음 · D5 바닥글 한 줄 `© 숨비투어` + 처리방침 자리표시(죽은 링크 없게 정해 기록) · D6 teal `#00737A` 유지, 2026-11-16 디자인 방향, 짙은 면 위 대비(2.65:1) 해결·수치 기록, Pretendard 실제 로드(`next/font/local` 또는 근거, OFL, 대체 글꼴 유지), 접근성(랜드마크·본문 바로가기·대체 텍스트·동작 줄이기) · D7 제외: 회원·i18n·이메일·배포·처리방침 본문·사업자 정보·CMS 투어 순서·애니메이션/WebGL·Claude Design 캔버스.

## 핵심 결정 (plan.md §B)

- 설정: 전역 설정 `home-settings`(라벨 `홈 화면 설정`), 필드 `heroImage`(upload→media, 선택)·`headline`(text, `maxLength: 40`)·`intro`(text, `maxLength: 120`). `access: { read: () => true, update: adminOnly }`(정하지 않으면 `defaultAccess` = 로그인 사용자 — `globals/config/sanitize.js` 27~37). 버전 기록 없음. 기본 문구는 코드에서(비었거나 공백뿐이면 `제주를 가장 가까이, 숨비투어` / `제주의 소규모 투어와 다가오는 회차를 한눈에 확인하세요.`), Payload `defaultValue`는 안 씀(`afterRead/promise.js` 240~246은 저장 전에만 채움). 테이블·열 이름은 M1에서 확인
- **미디어 공개 범위 확장(필수)**: 파일 주소는 `media` `access.read`를 그대로 씀(`uploads/checkFileAccess.js` 5~16·53~60) → `mediaReadAccess` 익명 분기에 `findGlobal({ slug: 'home-settings', depth: 0, select: { heroImage: true }, req })` ID 추가(관리자가 아닌 모든 요청에 적용 — 가정 A7: 비공개 투어 사진을 대표 사진으로 고르면 공개됨, 필드 설명에 안내). 이전 사진은 다음 요청부터 숨김. `@MX:DEBT` 갱신. 이 `req` 있는 호출은 홈 데이터의 미디어 채우기 때마다 함께 일어남 → AC-008은 `req` 없는 `home-settings` 호출만 단언
- 홈 데이터 `src/lib/home-page.ts`: `findGlobal({ depth: 1, overrideAccess: false })`(로컬 기본값이 `true` — `globals/operations/local/findOne.js` 5) + `listPublishedTours(payload, { now })` 앞 6개(`/tours`와 같은 정렬, 모집 중 없는 투어는 남는 자리만). 대표 사진은 `catalog.ts` `toImage` 재사용(내보내기). `@MX:DEBT`(전체 공개 투어 읽고 6개만 씀)
- 히어로: `section` 바탕 항상 `--surface-dark #272729`. 사진 있으면 `next/image` `fill`·`unoptimized`·`preload`(Next 16, `priority` 폐기 예고)·`sizes="100vw"`·`alt=미디어 alt` + 균일 덮개 `--overlay-photo` = `rgba(29, 29, 31, 0.65)`(쓰는 곳 없던 토큰, 0.6→0.65). 사진 없으면 사진·덮개 층 없음(요청 0건). 글자 흰색, 버튼 흰 알약·짙은 글자, 히어로 범위 포커스 외곽선 흰색. 히어로 안 포인트 색 금지
- 대비(§B.5): 덮개 합성은 채널별 `α×덮개+(1−α)×바탕` 실수값, 반올림하지 않음(대비 값만 소수 둘째 자리 반올림) · 흰/짙은 면 14.91 · 흰/덮개 최악 `rgb(108.1, 108.1, 109.4)` 5.24(0.60 → `rgb(119.4, 119.4, 120.6)` 4.45 미달) · 버튼 글자/흰 16.83 · hover 15.46 · 흰 버튼·포커스/짙은 면 14.91, /덮개 최악 5.24 · 포인트/짙은 면 2.65(미달 → 미사용) · `--on-dark-2`/덮개 최악 3.26(사진 위 미사용)
- 머리글·바닥글: `(frontend)/layout.tsx`가 `본문 바로가기`(→`#main-content`, `tabIndex=-1`) → `SiteHeader`(흰 띠, 로고 `/`·`투어` `/tours`, 제목 요소 없음, 44px) → 본문 → `SiteFooter`(연회색, `--color-text-2`, `© 숨비투어` · `개인정보 처리방침(준비 중)`, 링크 없음 — 배포 SPEC이 링크로)
- 404: `src/app/(frontend)/[...slug]/page.tsx`가 `notFound()`만(정적 경로 우선이라 `/admin`·`/api` 안 가림). `global-not-found`(실험) 안 씀
- 글꼴: 공식 v1.3.9 `PretendardVariable.woff2`(2,057,688바이트, 원본 그대로, SHA-256 M2 기록) + `OFL.txt`(라이선스 전문) → `src/app/(frontend)/fonts/`. `localFont({ src, weight: '45 920'(공식 CSS로 확인), display: 'swap', preload: false, variable: '--font-pretendard' })`, `<html className>`. `--font-sans: var(--font-pretendard, "Pretendard Variable"), "Pretendard Variable", …, sans-serif`(대체값은 변수 미정의 시 선언 무효 방지). Next의 보정 대체 글꼴 `'<이름> Fallback'`은 `--font-pretendard` 값 안, 즉 Pretendard와 기존 목록 사이에 놓임. 동적 분할본(92개)은 `next/font/local`이 `unicode-range`를 못 정해 기각, CDN 기각
- 토큰·전역 CSS: `--font-sans`, `--overlay-photo`, 주석 갱신. `globals.css`에 `prefers-reduced-motion: reduce` 전환·애니메이션 0.01ms. `.moai/project/design/` 문서 동기화는 sync 단계
- `TourCard`에 `headingLevel?: 'h2' | 'h3'`(기본 `h2`). 홈 `추천 투어` `h2`, 카드 `h3`
- `/`는 `await connection()`(사전 렌더링 제외), `generateStaticParams` 없음
- 테스트: 전역 설정 원래 값(`depth: 0`, `heroImage`는 ID)을 바꾸기 전에 `.moai/state/verify/landing/home-settings-original.json`(gitignore)에 저장(파일이 이미 있으면 그 값으로 먼저 복원) → `afterAll` 파일 값으로 복원 → 세 필드 `?? null` 정규화 후 같음 단언 → 파일 삭제. 새 E2E도 `expectE2ePort` 호출(AC-INFRA-008 중 대체 안 되는 부분). 표식 미디어(순백 1×1 PNG 상수). E2E 추천 기대값은 열기 직전 로컬 API `listPublishedTours` 앞 6개. 관리자 화면은 큰 제목 편집만, 사진 선택은 REST(JWT) + 사용자 수동. 스크린숏 `.moai/state/verify/landing/`(1440×900·375×812). 질의 수는 AC-ADMIN-012 방식. 빈 목록은 `renderToStaticMarkup`
- 새 npm 패키지 없음, `.gitattributes`·`.prettierignore` 불변, `occupancy`·`session-availability`·`catalog-order`·`submit-application` 불변

## 요구사항 (GEARS)

- **REQ-LANDING-001** 전역 설정 = `home-settings` 하나(라벨 `홈 화면 설정`), 데이터 필드 `heroImage`·`headline`(≤40)·`intro`(≤120)뿐, 개인정보 필드 없음. **When** 길이 초과 → 검증 오류, 값 불변.
- **REQ-LANDING-002** 읽기 누구나. **While** 비관리자 → 모든 접근 규칙 경로에서 수정 거부·값 불변. 관리자는 메뉴 `홈 화면 설정`에서 편집, 코드 변경·재빌드 없이 다음 `/`에 반영.
- **REQ-LANDING-003** **While** 관리자가 아님(익명 포함) → `media` 읽기(문서·파일)는 공개 투어 대표 이미지 + 홈 대표 사진만. 바꾸거나 비우면 이전 미디어 숨김(투어 참조 제외). REQ-TOUR-005 미디어 범위만 넓힘.
- **REQ-LANDING-004** **When** `/` → 히어로에 `h1`·소개·알약 `투어 둘러보기`(`/tours`) 순서. **When** 비었거나 공백 → 기본 문구, 값은 trim·HTML 미해석.
- **REQ-LANDING-005** **While** 사진 있음·익명 읽기 가능 → 전면 사진, `alt` = 미디어 alt. **While** 없음(미설정·비움·삭제)·읽기 불가 → 짙은 면만, 이미지 요소·요청 없음. 항상 200.
- **REQ-LANDING-006** 히어로 글자 흰색, 사진 위 균일 덮개로 최악 배경 ≥4.5:1, 버튼 흰 알약·짙은 글자, 포커스 흰 ≥2px. 히어로 안 포인트 색 금지. 수치는 plan §B.5.
- **REQ-LANDING-007** **When** `/` → `추천 투어`에 `/tours` 정렬 앞 ≤6개 `TourCard`(단일 점유·단일 계산), `투어 전체 보기`(`/tours`). **When** 0개 → `지금은 공개된 투어가 없습니다.` 비공개 투어 없음, about·이용 방법 없음.
- **REQ-LANDING-008** 홈 데이터 질의 수는 투어·회차 수와 무관, 모두 연결 풀. 익명(`overrideAccess: false`, 사용자 없음)만.
- **REQ-LANDING-009** **When** 공개 화면 → 같은 머리글(링크 2개: `숨비투어` `/`, `투어` `/tours`), 로그인·회원가입·언어 전환·제목 요소 없음. `/admin`엔 없음.
- **REQ-LANDING-010** **When** 공개 화면 → 바닥글 `© 숨비투어` · `개인정보 처리방침(준비 중)`, 바닥글 링크 0, 어느 공개 화면에도 `href` `#`·빈·없는 `a` 없음. 사업자·연락처 없음.
- **REQ-LANDING-011** **When** 처리하지 않는 주소 또는 `notFound()` → 404 + 머리글·바닥글 있는 사용자 화면 404. `/admin`·`/api` 불변.
- **REQ-LANDING-012** Pretendard 가변을 같은 출처에서. 공식 v1.3.9 원본 + OFL 1.1 전문, `next/font/local`. 외부 글꼴 요청 없음, 기존 대체 목록은 Pretendard(와 Next 보정 대체 글꼴) 뒤에 순서 그대로. 관리자 화면은 불러오지 않음.
- **REQ-LANDING-013** 디자인 방향: 본문 17px(≤767px 16px)·1.47, 제목 600·음수 자간, 알약, 카드·버튼 그림자 없음, 면의 바뀜(짙은 히어로 → 흰 추천 → 연회색 바닥글). **While** 375px → `/`·`/tours`·상세 가로 스크롤 없음, 머리글 링크·두 버튼 44×44 이상.
- **REQ-LANDING-014** 공개 화면마다 `banner`·`main`·`contentinfo`·`h1` 각 1개, `lang="ko"`. 첫 포커스 `본문 바로가기`(포커스 시 보임) → 다음 Tab이 `main`의 첫 포커스 요소. 홈 `h2` 추천 투어 + 카드 `h3`. 자동 애니메이션·동영상·슬라이드 없음. **While** 동작 줄이기 → 전환 ≤0.01초.
- **REQ-LANDING-015** `/` 요청 시점 렌더링(`connection()`, 사전 렌더링 목록에 없음), 변경이 다음 요청에 반영. 기존 화면 규칙 유지.
- **REQ-LANDING-016** 단위·통합(실제 DB)·E2E(테스트 관리자) + 1440·375 스크린숏, 실제 관리자 미사용, 표식 데이터 자체 생성·정리, 전역 설정 원래 값 저장·복원, 커버리지 85%, 기존 게이트 유지.

## 수용 기준 요약 (acceptance.md)

AC-001 전역 설정 등록·필드(`id`·`createdAt`·`updatedAt` 제외)·`maxLength`·40/41·120/121 저장 · AC-002 접근 규칙(통합 익명 읽기 OK·수정 거부·관리자 OK, E2E REST 200/403/200·GraphQL `errors`, 관리자 화면 메뉴·큰 제목 편집 → 익명 `/` 반영) + 수동(사진 올리기·비우기) · AC-003 미디어 익명 범위 4단계(h·a·c) + 파일 주소 200/비200 + AC-TOUR-006 유지 · AC-004 문구 결정 함수 단위, 기본 문구·순서·`href`·HTML 미해석·임시 홈 문구 없음 · AC-005 사진 없음(h를 설정했다 비운 상태 — 히어로 img 0·`rgb(39, 39, 41)`·`<head>`의 `link[rel=preload][as=image]` 0·h 파일 이름 요청 0, 카드 이미지 요청은 허용)·있음(img 1·alt·200·`naturalWidth`)·삭제 뒤(img 0, 통합 `heroImage` 비움·`null`) · AC-006 토큰 값으로 대비 재계산(14.91·5.24·16.83·15.46·2.65, 덮개 합성은 반올림하지 않는 실수값) + E2E 덮개 `rgba(29, 29, 31, 0.65)`·흰 글자·흰 버튼·흰 포커스·히어로 안 `rgb(0, 115, 122)` 없음 · AC-007 자르기 단위, 통합 = `listPublishedTours` 앞 6개 ID·availability·비공개 제외·빈 목록 렌더링, E2E 카드 수·순서·남은 자리 `/tours`와 같음·`투어 전체 보기`·`h2` 하나 · AC-008 질의 수 동일(이미지 있는 투어 5개 추가)·`connect` = `query`·`req` 없는 `home-settings` `findGlobal` 정확히 1회(`overrideAccess: false`, `user` 없음 — `req` 있는 접근 규칙 내부 호출은 허용) · AC-009 머리글(6개 화면, 링크 2·제목/버튼/로그인 없음, 이동, `/admin`엔 없음) · AC-010 바닥글 문구·링크 0·죽은 링크 0 · AC-011 `/no-such-page`·`/a/b/c`·없는 slug 404 + 머리글, `/admin` 200·`/api/tours` JSON, 기존 관리자 E2E 통과 · AC-012 글꼴 크기·SHA-256·OFL 문구·import 위치·`(payload)` 미참조·패키지 없음, E2E 같은 출처 `/_next/static/media/`·외부 요청 0·`FontFace` loaded·대체 목록, `/admin` 미요청 · AC-013 1440 계산값(17px·24.99px·600·음수 자간·`9999px`·`box-shadow: none`·면 색), 375(16px·`scrollWidth` ≤375·44×44) + 수동 디자인 확인 · AC-014 랜드마크·`h1`·`lang`·본문 바로가기·`h2`/`h3`·`animation-name: none`·동작 줄이기 ≤0.01s · AC-015 매니페스트(`/` 빌드됨, 사전 렌더링 아님)·저장소 규칙·새로고침 반영 · AC-016 테스트·커버리지·스크린숏 10개·설정 복원 단언(`?? null`, `heroImage` ID)·원래 값 파일 잔여 없음·SQL 잔여 0(`home_settings` 이름은 M1 확인)

## 마일스톤 (plan.md §F)

M1 전역 설정·미디어 공개 범위·홈 데이터(질의 수) → M2 머리글·바닥글·404·Pretendard(파일 받기·SHA-256 첫 작업)·동작 줄이기 → M3 히어로·추천 투어·대비·`TourCard` 제목 단계·`connection()`·`home.spec.ts` 재작성 → M4 관리자 편집 E2E·REST/GraphQL·375/1440 디자인 값·스크린숏·수동 확인 → M5 품질 게이트·MX·출시 전 점검 이월
