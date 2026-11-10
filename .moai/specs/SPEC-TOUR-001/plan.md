# SPEC-TOUR-001 구현 계획

> 요구사항은 `spec.md`, 수용 기준은 `acceptance.md`가 기준이다. 이 문서는 결정의 근거, 작업 순서, 위험을 다룬다.
> 개발 방식: TDD(`quality.yaml` `constitution.development_mode: tdd`). 검증 셸: Windows PowerShell 5.1(7은 SPEC-INFRA-001의 수용한 부채 그대로).

## §A. 맥락

### A.1 현재 상태 (HEAD `ff00406`, main = origin/main)

- SPEC-INFRA-001 완료. 등록 컬렉션은 `users` 하나(`src/payload.config.ts`), 사용자 화면은 임시 홈(`src/app/(frontend)/page.tsx`) 하나다.
- 전역 편집기로 `lexicalEditor()`가 설정되어 있지만 리치 텍스트 필드는 아직 없다. 관리자 import map(`src/app/(payload)/admin/importMap.js`)에는 `CollectionCards` 하나만 있다.
- `next.config.ts`는 템플릿의 `images.localPatterns`를 뺀 상태다(Media가 없었기 때문 — 파일 상단 주석).
- 테스트: Vitest 98건, Playwright 4건. `tests/integration/users-auth.spec.ts`가 "시스템 컬렉션을 뺀 slug 목록 = `['users']`"를 단언한다 → 이 SPEC에서 바뀌어야 한다.
- 저장소 규칙 테스트(`tests/unit/repo-rules.spec.ts`) 중 이 SPEC과 맞닿는 규칙:
  - AC-INFRA-004: `src/app` 바로 아래는 `(frontend)`, `(payload)`뿐이고, `(frontend)` 아래 경로 구간에 `admin`·`api`가 없어야 한다 → `/tours` 경로는 문제없다.
  - AC-INFRA-009: `@import "tailwindcss"`를 담은 파일과 그 import 파일은 모두 `(frontend)` 아래, `(payload)`는 `tailwindcss`·그 파일명을 참조하지 않아야 한다.
  - AC-INFRA-010: `.prettierignore`와 ESLint `globalIgnores`가 검사 제외 목록과 **정확히** 같아야 한다 → 업로드 디렉터리를 이 두 파일에 넣으면 규칙이 깨진다. Prettier 3는 `.gitignore`도 기본으로 따르므로 `.gitignore`에만 넣는다.
  - AC-INFRA-005: 직접 의존성은 정식 안정 버전(메이저 1 이상)만 허용한다.
  - AC-INFRA-003: 스크립트에 `rm -rf`, 인라인 `VAR=value` 금지.

### A.2 확인한 버전 (설치본 기준, 이 트리에서 직접 확인)

새 npm 패키지를 추가하지 않으므로 레지스트리 조회 대상이 없다. 아래는 결정의 근거로 쓴 설치본 확인 결과다.

| 항목 | 값 | 확인 방법 |
|---|---|---|
| `payload` / `@payloadcms/*` | 3.93.0 | `package.json`, SPEC-INFRA-001 AC-INFRA-005 |
| `next` | 16.4.5 | `package.json` |
| `sharp`(간접) | 0.35.5 — `next`의 선택 의존성(`"sharp": "^0.35.5"`)으로만 설치됨. 설치 시 실행 스크립트(`install`/`postinstall`) 없음 | `node_modules/next/package.json`, `node_modules/.pnpm/sharp@0.35.5_…/node_modules/sharp/package.json`의 `scripts` |
| Payload의 sharp 없는 이미지 크기 측정 | 있음 — `probeImageSize`("Image dimension probe used as a fallback when `sharp` is not configured") | `node_modules/payload/dist/uploads/probeImageSize.js` |
| sharp 없을 때 경고 조건 | `imageSizes` 또는 `formatOptions`를 쓴 업로드 컬렉션이 있을 때만 경고 | `node_modules/payload/dist/index.js` 400~402행 |
| 자르기 처리 | `cropData && fileSupportsResize && sharp`일 때만 적용 → sharp가 없으면 조용히 무시 | `node_modules/payload/dist/uploads/generateFileData.js` 241행 |
| 업로드 저장 위치 기본값 | `staticDir`가 없으면 slug(상대 경로, 실행 디렉터리 기준) | `node_modules/payload/dist/collections/config/sanitize.js` 219행 |
| 파일 주소 접근 검사 | 파일 요청에도 컬렉션 `read` 접근 규칙을 실행하고, 결과가 조건(Where)이면 파일명과 함께 조회 | `node_modules/payload/dist/uploads/checkFileAccess.js` |
| 일시 필드 시간대 | 필드 단위 `timezone`(`defaultTimezone`, `supportedTimezones`) 지원 | `node_modules/payload/dist/fields/config/types.d.ts` 508~563행 |
| 스크립트 실행 | `payload run <script>` — Payload CLI가 `.env`를 읽고 스크립트를 import | `node_modules/payload/dist/bin/index.js` 76~95행 |
| 요청 시점 렌더링 | `connection()`(`next/server`) — "prerendering stops here", `new Date()`처럼 요청마다 달라지는 값에 쓰라고 안내 | `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/connection.md` |
| 라우트 설정 `dynamic` | `'force-dynamic'` 지원(Cache Components를 쓰지 않는 구성) | `node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md` |

### A.3 Tier M 판단

- 예상 변경: 컬렉션 3개, `payload.config.ts`, `src/lib/` 모듈 3~4개, 페이지 2개 + 홈 수정, 공통 조각 3개, 스타일 2개, 시드 진입점 1개, `package.json`·`.gitignore`·`next.config.ts` 일부, 테스트 8~10개, 생성 파일 2개(`payload-types.ts`, `importMap.js`).
- 직접 작성 코드 추정: 제품 코드 약 600~800줄, 테스트 약 700~900줄. 파일 수와 합계는 Tier M 지침(5~15개, 1,000줄)을 넘는다.
- 그래도 M으로 두는 이유: 단일 도메인이고 프로젝트 원칙·구조를 바꾸지 않으며, 늘어나는 부분 대부분이 테스트와 생성 파일이다. SPEC-INFRA-001이 1,372줄에서 같은 판단으로 M을 유지했다. 요구사항 16개·수용 기준 16개로 Tier M 예산 안이다.
- 넘칠 경우: run 단계 중 제품 코드가 1,200줄을 넘거나 마일스톤이 7개를 넘으면 차단자 보고 후 분할(시드를 별도 SPEC으로)을 검토한다.

## §B. 결정과 근거

### B.1 sharp — 도입하지 않는다

| 기준 | 도입 | 미도입(채택) |
|---|---|---|
| 의존성 규칙 | sharp 0.35.5는 메이저 0 → AC-INFRA-005("메이저 1 이상") 위반. 규칙 예외를 SPEC-INFRA-001 쪽에 새로 만들어야 함 | 규칙 그대로 |
| 설치 | 간접으로 이미 설치되어 있고 설치 스크립트가 없어 `allowBuilds` 변경은 불필요. 다만 직접 의존성 추가 필요 | 변경 없음 |
| 기능 | 크기별 이미지(카드용 썸네일), 자르기, 초점, 형식 변환 | 원본만 저장. 가로·세로 크기는 Payload의 대체 측정으로 기록 |
| 배포 | Vercel 서버리스에서 네이티브 바이너리 크기·플랫폼 문제를 배포 SPEC에서 다시 검증해야 함 | 영향 없음 |
| 되돌림 비용 | — | 나중에 도입하면 기존 원본에서 크기별 이미지를 다시 만들 수 있다. 운영 데이터가 생기기 전(배포 SPEC 이전)이면 비용이 작다 |

결론: 미도입. 업로드 컬렉션은 `imageSizes`·`formatOptions`·`resizeOptions`를 쓰지 않고, 자르기·초점 UI를 끈다(`crop: false`, `focalPoint: false`). sharp 없이 자르기 UI가 보이면 관리자가 자른 결과가 조용히 무시되므로(§A.2) 끄는 것이 맞다. 카드 이미지는 4:3 비율 상자에 원본을 `object-fit: cover`로 넣는다. 원본이 큰 경우의 전송량 문제는 업로드 크기 제한(B.6)으로 막고, 크기별 이미지는 배포 SPEC 또는 별도 SPEC에서 다시 판단한다.

### B.2 투어 설명 — 여러 줄 일반 텍스트(textarea)

| 기준 | 리치 텍스트(Lexical) | 일반 텍스트(채택) |
|---|---|---|
| 필요성 | 목록·제목 서식이 가능. 디자인 캔버스는 "투어 소개" 문단만 요구 | 문단과 줄바꿈으로 충분 |
| 구현 범위 | 관리자 import map에 Lexical 구성 요소 추가 재생성, 화면용 변환 컴포넌트, 시드·테스트에서 Lexical JSON 생성 | 없음. 빈 줄로 문단, 줄바꿈 유지 |
| 보안 | 변환기가 만드는 마크업 검토 필요 | React 기본 이스케이프만으로 안전 |
| 다국어 | 둘 다 필드 단위 `localized` 가능 | 같음 |
| 되돌림 비용 | — | 리치 텍스트로 바꾸려면 기존 값 변환이 필요하지만, 운영 데이터는 배포 SPEC 이후에 생기므로 그 전에는 개발 데이터만 다시 넣으면 된다 |

결론: `summary`(투어 카드에 보이는 한두 문장, REQ-TOUR-009·AC-TOUR-010)와 `description`(상세 본문) 모두 일반 텍스트. 디자인 핸드오프 §2의 투어 카드 구성에는 요약이 없지만, 관리자가 입력한 필수 값이 화면에 나오지 않는 불일치를 없애려고 오케스트레이터 결정(plan-audit 1회차 D5)에 따라 카드에 넣는다. 상세 화면은 빈 줄을 문단 경계로, 단일 줄바꿈은 그대로 보이게 표시한다. 전역 `lexicalEditor()` 설정은 손대지 않는다(SPEC-INFRA-001 유지 대상).

### B.3 렌더링·캐시 — 요청 시점 렌더링

| 선택지 | 장점 | 단점 |
|---|---|---|
| 사전 렌더링 + 저장 시 `revalidatePath` 훅 | 빠른 응답 | 컬렉션 3개 훅, 회차가 "지난 회차"로 바뀌는 시각에는 훅이 없어 화면이 낡음(시간 경과는 저장 이벤트가 아님) |
| 시간 기반 재검증(`revalidate = N`) | 단순 | N초 동안 낡은 화면. "수정 후 바로 보임" 미충족 |
| **요청 시점 렌더링(채택)** | 관리자 수정·시간 경과 모두 다음 요청에 바로 반영. 신청 SPEC의 남은 자리도 항상 최신 | 요청마다 DB 조회. 지금 규모(투어 수십 개 이하)에서는 문제없음 |

결론: 데이터를 읽는 두 페이지(`/tours`, `/tours/[slug]`)는 렌더링 시작 부분에서 `await connection()`(`next/server`)을 호출한다. 이 함수는 Next 16 문서가 "요청마다 다른 결과(`new Date()` 등)"에 쓰라고 안내하는 방식이고, 이후 Cache Components로 옮겨도 그대로 쓸 수 있다. 결과 확인은 운영 빌드에서 두 경로가 실제로 빌드되었는지(`.next/app-path-routes-manifest.json`)와 매니페스트 구조(`prerender-manifest.json`의 `routes`에 `/` 존재)를 먼저 단언한 뒤, `prerender-manifest.json`의 `routes`에 `/tours`가 없는지로 한다(AC-TOUR-013). `/tours/[slug]`는 `generateStaticParams`가 없으면 `connection()` 유무와 관계없이 사전 렌더링 목록에 나타나지 않으므로, 이 경로의 `dynamicRoutes` 검사는 `generateStaticParams` 회귀 감시일 뿐이고 요청 시점 렌더링 판정은 저장소 규칙(`connection` import·호출)이 맡는다. 개발 서버는 원래 요청마다 렌더링하므로 E2E만으로는 이 요구를 증명하지 못한다.

### B.4 남은 자리 계산 지점 — `src/lib/`의 순수 함수 하나

| 선택지 | 판단 |
|---|---|
| Payload 가상(계산) 필드 + `afterRead` 훅 | API·관리자 화면에도 값이 보이는 장점. 그러나 신청 SPEC에서 점유 인원을 구하려면 회차마다 조회가 생기고(N+1), 현재 시각에 기대는 "선택 가능" 판정을 데이터 필드로 두는 것은 어색하다 |
| **`src/lib/`의 순수 함수(채택)** | 입력: 회차(정원·상태·시작 시각), 현재 시각, 점유 인원(기본 0). 출력: 남은 자리, 정원, 선택 가능 여부와 불가 사유(마감·지남·자리 없음). 단위 테스트가 쉽고 시간대·현재 시각을 고정해 검증할 수 있다 |

- 이름 예시: `src/lib/session-availability.ts`의 `getSessionAvailability(session, { now, occupiedSeats })`. 정확한 이름은 run 단계가 정한다.
- 목록의 "가장 가까운 회차"와 카드 정렬, 상세의 회차 목록은 모두 이 함수의 결과로 계산한다. 정렬·선택 로직도 순수 함수로 둔다(예: `src/lib/catalog-order.ts`).
- 신청 SPEC의 확장 방법: 조회 계층이 회차별 점유 인원 맵을 만들어 넘겨 주는 부분만 바꾼다. 이 SPEC은 언제나 0을 넘긴다. 이 지점에 `@MX:ANCHOR`(호출자 3곳 이상: 목록·상세·정렬)와 신청 SPEC 확장 지점을 알리는 `@MX:NOTE`를 단다.
- 저장소 규칙 테스트로 "남은 자리" 문자열을 만드는 화면 코드가 이 함수를 거치는지까지 기계적으로 강제하지는 않는다(과한 규칙). 대신 단위 테스트가 점유 인원을 넘겼을 때의 결과를 미리 고정해 둔다(정원 15, 점유 15 → 남은 자리 0, 선택 불가 "자리 없음").

### B.5 접근 규칙

| 컬렉션 | 읽기 | 생성·수정·삭제 |
|---|---|---|
| `tours` | 관리자: 전부. 익명: `published = true`인 문서만(조건 반환) | 관리자만 |
| `tour-sessions` | 관리자: 전부. 익명: 소속 투어가 공개인 회차만(관계 경로 조건 `tour.published = true`) | 관리자만 |
| `media` | 관리자: 전부. 익명: 공개 투어가 대표 이미지로 참조하는 문서만 — 공개 투어의 이미지 ID 목록을 조회해 `id in [...]` 조건을 반환. 파일 주소(`/api/media/file/…`)도 같은 규칙(§A.2 `checkFileAccess`) | 관리자만 |
| `users` | 변경 없음(Payload 기본: 로그인 필요) | 변경 없음 |

- 관리자 판정은 `req.user?.collection === 'users'`(가정 A1). 접근 함수는 한 모듈(예: `src/access/`가 아니라 기존 구조에 맞춰 `src/lib/access.ts`)에 모아 단위·통합 테스트로 검증한다.
- **가장 큰 함정**: Payload 로컬 API는 기본값이 `overrideAccess: true`라 서버 컴포넌트에서 그냥 조회하면 공개되지 않은 투어도 읽힌다. 사용자 화면의 조회 계층(예: `src/lib/catalog.ts`)은 모든 호출에 `overrideAccess: false`를 넘기고 `user`를 넘기지 않는다. 통합 테스트가 이 계층을 직접 호출해 공개되지 않은 데이터가 나오지 않음을 확인한다(AC-TOUR-006).
- `media` 읽기 조건은 읽을 때마다 공개 투어 조회가 한 번 더 일어난다. 지금 규모에서는 문제없으므로 `@MX:DEBT`(한도: 공개 투어 수백 개, 갱신 조건: 미디어 조회가 느려지거나 투어당 여러 장 사진을 도입할 때)로 남긴다.
- 회차가 있는 투어 삭제 거부(REQ-TOUR-006)는 `tours`의 삭제 전 훅에서 연결된 회차 수를 세어 오류를 낸다. 관리자도 예외 없다. 오류 메시지는 영문 고정 문구 `Cannot delete a tour that has sessions. Delete its sessions first.`를 쓴다(`error_messages: en`, AC-TOUR-007이 앞 문장을 고정 문자열로 확인).

### B.6 업로드 저장과 제한

- 저장 위치: 저장소 루트의 `media/`(Payload `staticDir`를 설정 파일 기준 절대 경로로 지정 — 실행 디렉터리에 따라 위치가 바뀌지 않게). `.gitignore`에 `/media/`를 추가한다. `.prettierignore`·ESLint 무시 목록은 바꾸지 않는다(§A.1).
- 허용 형식: `image/jpeg`, `image/png`, `image/webp`(`mimeTypes`). SVG 제외.
- 크기 제한: 파일당 5MB = 5 × 1024 × 1024바이트(규범 — REQ-TOUR-001, AC-TOUR-002). 근거: 원본을 그대로 보여 주므로 큰 사진의 전송량을 묶어 둔다.
  - **주 판정(규범의 근거)**: `media` 컬렉션 훅에서 판정한다. 예: `beforeOperation` 훅이 `create`·`update` 작업에서 `req.file`이 있고 `req.file.size > 5 * 1024 * 1024`이면 Payload `ValidationError`(`payload`가 내보냄)를 던진다. 로컬 API는 `payload.create({ file })`의 파일을 `req.file`에 넣고(`collections/operations/local/create.js` 13행), `beforeOperation`은 파일 처리(`generateFileData`)보다 먼저 실행되므로(`collections/operations/create.js`) 문서와 파일이 생기기 전에 거부된다. 이 방식은 로컬 API와 REST에 똑같이 적용된다. 경계: 정확히 5MB는 허용, 1바이트라도 넘으면 거부.
  - **보조 수단**: 루트 `upload.limits.fileSize`(3.93 타입 `FetchAPIFileUploadOptions`)는 REST 멀티파트 요청을 일찍 끊는 용도로만 둔다. Payload 3.93에서 루트 `upload` 옵션을 쓰는 곳은 HTTP 멀티파트 파서뿐이며(`utilities/addDataAndFileToRequest.js` 35행 → `processMultipartFormdata`), 로컬 API 경로에는 적용되지 않는다(plan-audit 2회차 N1 실측). 파서 한도를 넘은 REST 요청은 검증 오류가 아니라 `File size limit has been reached`(HTTP 413)로 끝난다. 이 값을 근거로 쓰지 않으며, 설정한다면 주 판정과 같은 5MB로 맞춘다(그보다 작으면 정확히 5MB인 REST 업로드가 413으로 막힌다). 루트 `upload` 설정은 모든 업로드 컬렉션에 적용되지만 지금 업로드 컬렉션은 `media` 하나뿐이다.
  - 시험 파일(AC-TOUR-002): 올바른 1×1 PNG 뒤에 0바이트를 채워 전체 크기를 맞춘다. 세션 scratchpad에서 Payload `probeImageSize`로 실측한 결과, 정확히 5,242,880바이트와 5,242,881바이트 모두 `{"height":1,"width":1}`로 측정되었다. 따라서 이 파일은 크기 규칙 말고는 거부될 이유가 없다. 반대로 PNG 서명 뒤를 0으로만 채운 파일은 크기 측정 단계에서 실패하므로(2회차 감사 실측) 크기 규칙을 검증하지 못한다 — 쓰지 않는다.
- 대체 텍스트: `alt` 텍스트 필드, 필수.
- 화면 표시: 이미지 최적화(서버 리사이즈)를 쓰지 않는다. `next/image`에 `unoptimized`를 주거나 `<img>`를 쓰되, 린트 오류·새 경고 0건, 4:3 상자, `alt`는 `media.alt`. 이미지 주소는 Payload가 `serverURL`을 붙여 절대 주소로 만들 수 있으므로(E2E에서는 E2E 포트 주소), 주소 형태를 run 단계 M4에서 확인하고 필요하면 `next.config.ts`에 경로 허용을 되살린다.

### B.7 일시와 시간대

- 저장: Payload 일시 필드(UTC, 타임스탬프).
- 관리자 입력: 회차의 시작·종료 필드에 `timezone: { defaultTimezone: 'Asia/Seoul', supportedTimezones: [{ label: '서울', value: 'Asia/Seoul' }] }`를 지정해 브라우저 시간대와 관계없이 서울 기준으로 입력되게 한다. Payload가 시간대 보조 열(`<필드>_tz`)을 추가한다. run 단계 M1에서 관리자 화면으로 한 번 입력해 저장값(UTC)을 확인하고 `progress.md` §E.2에 기록한다. 기대대로 동작하지 않으면 차단자 보고.
- 표시: `Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', … })`를 감싼 도우미(예: `src/lib/format.ts`). 단위 테스트는 고정 UTC 값으로 확인한다(예: `2026-11-20T00:00:00Z` → "11월 20일", "금", "오전 9:00". 2026-11-20은 금요일 — Node `toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit' })` 실측 결과 `11월 20일 (금) 오전 9:00`). 이 PC의 시간대가 서울이라 `timeZone` 누락 결함을 그대로는 잡지 못하므로, 표기 테스트는 실행 전에 프로세스 시간대를 서울이 아닌 값으로 바꾼다(`process.env.TZ = 'America/New_York'` — Node는 실행 중 변경을 반영하며, 실측으로 같은 순간의 `getHours()`가 19). 같은 테스트 안에서 바뀐 시간대가 적용되었는지(`new Date('2026-11-20T00:00:00Z').getHours() !== 9`)를 먼저 단언한다.
  - 배치: 시간대를 바꾸는 표기 테스트는 **별도 테스트 파일**(예: `tests/unit/format-timezone.spec.ts`)에 둔다. 같은 프로세스 안에서는 운영체제 기본 시간대로 되돌릴 수 없기 때문이다(2회차 감사 실측: `delete process.env.TZ` 뒤에도 서울로 돌아오지 않음). Vitest는 테스트 파일마다 별도 작업자에서 실행하므로 영향이 그 파일 안으로 한정된다. 남은 자리·선택 가능 판정은 시각 비교라 시간대 영향을 받지 않지만, 같은 파일에 섞지 않는다.
  - 복원: 끝난 뒤(`afterAll`) 원래 값이 있었으면 그 값을 다시 넣고, 원래 값이 `undefined`였으면 `delete process.env.TZ`로 지운다. `process.env.TZ = undefined`처럼 그대로 대입하지 않는다 — 문자열 `"undefined"`가 되어 UTC로 해석된다(2회차 감사 실측).
- 소요 시간: 분 단위 정수 → "N시간 M분"(0분이면 "N시간", 60분 미만이면 "M분").

### B.8 목록 순서와 표시

- 공개 투어만. 선택 가능한 회차가 있는 투어를 먼저(가장 가까운 회차의 시작 시각 오름차순, 같으면 제목), 그다음 나머지를 제목 순(`localeCompare(…, 'ko')`).
- 카드 배지: 선택 가능한 회차가 있으면 "모집 중", 없으면 "모집 마감"(디자인 캔버스 화면 2의 문구). 회차 배지: "모집 중" / "마감".
- 남은 자리 표기: "남은 자리 N / M"(디자인 캔버스 예시 "남은 자리 4 / 15").
- 지난 회차: 상세 화면에서 숨김(가정 A2). 마감 회차: 흐리게 + "마감" 배지 + 선택 불가.

### B.9 시드

- 실행: `pnpm seed` → `cross-env NODE_OPTIONS=--no-deprecation payload run scripts/seed.ts`(Payload CLI가 `.env`를 읽는다. 기존 `generate:types` 스크립트와 같은 형태). 시작 전 점검(`scripts/preflight.mjs`)의 명령 목록은 넓히지 않는다 — 시드는 DB 연결 실패 시 Payload 오류로 끝나면 충분하다.
- 구조: 거부 판정(`NODE_ENV`, `DATABASE_URL` 호스트)과 시드 실행 로직은 `src/lib/seed.ts`에 두고 데이터 집합을 인자로 받는다. 진입점 `scripts/seed.ts`는 핸드오프 가상 데이터를 넘기고 결과를 출력한다. 이렇게 하면 통합 테스트가 테스트 데이터 표식을 붙인 데이터 집합으로 같은 로직을 검증할 수 있다(실제 시드 slug를 개발 DB에 만들지 않음).
- 종료 방식(실측 근거, plan-audit 1회차 D6): `payload run`은 스크립트를 `await import()`한 뒤 무조건 `process.exit(0)`으로 끝난다. 실측으로 `process.exitCode = 3`을 설정한 스크립트의 종료 코드는 0이었고, 예외를 던진 스크립트는 1이었다. 따라서 시드 거부는 **예외를 던지거나 `process.exit(1)`을 호출**해 끝내고, `process.exitCode`에 기대지 않는다. 진입점 `scripts/seed.ts`는 **최상위 `await`**로 거부 판정과 시드 작업이 끝날 때까지 기다린다(`main().catch(...)`처럼 기다리지 않는 호출은 작업 도중 `process.exit(0)`으로 끊길 수 있다). 거부 판정은 `getPayload()`보다 먼저 실행해 DB에 연결하지 않는다.
- 호스트 판정: WHATWG `URL`은 `postgres://u:p@[::1]:5432/db`의 `hostname`을 `[::1]`(대괄호 포함)로 돌려준다(실측). 판정은 대괄호를 벗긴 값을 `localhost`·`127.0.0.1`·`::1`과 비교한다. 거부 메시지에는 호스트 이름만 담고 비밀번호는 담지 않는다(REQ-INFRA-010).
- 멱등성: slug가 이미 있으면 투어와 회차 모두 건너뛴다(관리자가 고친 내용을 덮어쓰지 않음). 출력에 만든 수와 건너뛴 수를 담는다.
- 데이터: 한라산 영실 트레킹(45,000원 · 현장 결제, 정원 15), 우도 자전거 일주(38,000원 · 현장 결제, 정원 12), 해녀 물질 체험(55,000원 · 현장 결제, 정원 10). 각 투어에 실행일 기준 +3일·+10일 오전 9시(서울) 모집 중 회차, 한 투어에는 +5일 마감 회차를 더해 "마감" 표시를 확인할 수 있게 한다. 이미지는 넣지 않는다(가정 A5).
- 자동 실행 금지: `dev`·`build`·`test`·`e2e`·`postinstall` 어디에서도 부르지 않는다. 저장소 규칙 테스트로 확인한다.

### B.10 디자인 토큰 적용

- `tokens.css` 내용을 `src/app/(frontend)/` 아래 스타일 파일로 옮기고 `(frontend)` 전역 스타일시트에서만 불러온다. Tailwind 4의 `@theme`로 토큰을 유틸리티 이름(예: `bg-accent`, `text-text-2`)에 연결할지, CSS 변수를 직접 쓸지는 run 단계가 정한다.
- 기존 홈 E2E는 `h1`의 글자 크기 36px(Tailwind `text-4xl`)을 단언한다. 토큰의 `--text-h1`도 36px이지만 기본 `h1` 스타일을 토큰으로 덮으면 모바일 값(26px)이 데스크톱 테스트에 영향을 줄 수 있으므로, 전역 제목 스타일은 E2E 뷰포트(데스크톱)에서 36px를 유지하도록 한다.
- `body`에 `word-break: keep-all`, 글꼴 목록 `--font-sans`. 포커스 표시 규칙(`:focus-visible`)도 `(frontend)`에만.
- 저장소 규칙 테스트에 "`src/` 아래 파일 중 토큰 정의(`--color-accent:`)를 담은 파일은 모두 `(frontend)` 아래, `(payload)` 아래 파일은 그 파일명을 참조하지 않음"을 추가한다(AC-TOUR-014). 검사 범위는 AC-INFRA-009와 같이 `src/`다(`.moai/project/design/tokens.css`와 SPEC 문서는 대상이 아니다).

## §C. 사전 점검 (run 단계 시작 전, 순차)

```powershell
git branch --show-current          # main
git rev-parse --short HEAD         # 기준 HEAD 기록
git status --short                 # 추적 파일 변경 없음 확인(로그·감사 보고서 외)
docker compose ps --format '{{.Service}} {{.Health}}'   # postgres healthy
pnpm install --frozen-lockfile
pnpm test                          # 기준선: 98 passed
pnpm e2e                           # 기준선: 4 passed
pnpm lint
pnpm format:check
pnpm typecheck
```

기준선 결과(종료 코드와 통과 수)를 `progress.md` §E.2 첫머리에 적는다. 긴 출력은 `.moai/state/verify/<세션>/` 아래 파일로 남긴다(SPEC-INFRA-001과 같은 방식).

## §D. 제약 (지킬 것)

- 새 npm 패키지 추가 금지(직접·간접). `pnpm-lock.yaml`은 바뀌지 않아야 한다.
- `.prettierignore`, `eslint.config.mjs`의 검사 제외 목록, `pnpm-workspace.yaml`은 바꾸지 않는다.
- 전역 `lexicalEditor()`, `Users` 컬렉션, `src/lib/preflight.ts`, `scripts/preflight.mjs`, Playwright 포트 처리(`tests/helpers/e2e-env.ts`), Vitest 커버리지 설정(`src/lib/**`, 85%)은 유지한다.
- `src/app/(payload)/` 아래 템플릿 파일은 직접 고치지 않는다. import map은 `pnpm generate:importmap`으로만 다시 만든다.
- `src/payload-types.ts`는 `pnpm generate:types`로만 다시 만든다.
- 커밋은 경로를 명시해 스테이징한다(`git add -A` 금지). `.env`, `media/` 아래 파일, 검증 로그는 커밋하지 않는다.
- 파일 이름이 기존 `.gitignore` 규칙(`env/`, `*-key.*`, `*-secret.*`, `build/`, `out/`, `*.log`)에 걸리지 않게 한다. 새 경로는 커밋 전 `git check-ignore -v <경로>`로 확인한다.
- Conventional Commits, 메시지에 `SPEC-TOUR-001` 표기, 마지막 줄 `🗿 MoAI`. `--no-verify` 금지.

## §E. 자체 검증 순서

### E-1. 순차 실행 (상태를 쓰는 명령)

`pnpm test`와 `pnpm e2e`는 같은 개발 DB에 데이터를 만들고 지우며, `build`와 `e2e`는 `.next/`를 다시 쓰므로 병렬로 실행하지 않는다.

1. `docker compose up -d` → `postgres healthy`
2. `pnpm generate:types`, `pnpm generate:importmap` → 생성 파일 차이 확인
3. `pnpm typecheck`
4. `pnpm build` → 이어서 AC-TOUR-013의 사전 렌더링 목록 확인
5. `pnpm test`
6. `pnpm e2e`
7. AC-TOUR-016 시드 수동 확인(실행 2회, 거부 2종) → 시드 데이터 정리 여부는 개발자 선택(남겨도 됨)

### E-2. 병렬 실행 (읽기 전용 — E-1이 끝난 뒤 한 턴에)

```powershell
pnpm lint
pnpm format:check
git status --short
git check-ignore -q media/probe.png; $LASTEXITCODE
git diff --stat ff00406 -- pnpm-lock.yaml .prettierignore eslint.config.mjs pnpm-workspace.yaml
```

마지막 명령의 출력은 비어 있어야 한다(§D).

## §F. 마일스톤

결정이 바뀔 가능성이 높은 순서로 놓았다(데이터 모델 → 계산 인터페이스 → 조회 계층 → 화면 → 시드 → 정리). 각 마일스톤은 RED(실패하는 테스트) → GREEN(최소 구현) → REFACTOR 순서다.

### M1 — 데이터 모델과 접근 규칙 (우선순위: High)

- RED: 통합 테스트
  - 등록 컬렉션(시스템 컬렉션 제외) = `users`, `media`, `tours`, `tour-sessions` — 기존 `users-auth.spec.ts`의 단언을 이 목록으로 바꾸거나, 컬렉션 목록 단언을 새 테스트 파일로 옮기고 기존 테스트에서는 인증 흐름만 남긴다
  - `tours` 검증(slug 형식·고유, 소요 시간, 필수 값, 공개 기본값 꺼짐), `tour-sessions` 검증(종료 > 시작, 정원 정수 ≥ 1, 상태 기본값), `media` 검증(대체 텍스트 필수, 허용 형식 외 거부, 크기 규칙 — 올바른 1×1 PNG를 채운 5,242,881바이트는 `ValidationError`, 5,242,880바이트는 성공, B.6)
  - 접근 규칙(익명 생성·수정·삭제 거부, 익명 읽기 범위, 관리자 전체), 회차가 있는 투어 삭제 거부
- GREEN: `src/collections/{Media,Tours,TourSessions}.ts`, 접근 함수 모듈, slug 검사 도우미, `payload.config.ts` 등록과 업로드 제한, `.gitignore`에 `/media/`
- `pnpm generate:types`, `pnpm generate:importmap` 실행, 생성 파일 커밋
- 관리자 화면에서 회차 일시 입력 → 저장값 UTC 확인(B.7), 업로드 화면에 자르기·초점 도구가 없는지 확인 → §E.2 기록
- 검증: AC-TOUR-001~007
- 관련 REQ: 001~006

### M2 — 남은 자리·표시 도우미 (우선순위: High)

- RED: 단위 테스트(시각·시간대 고정)
  - 선택 가능 판정: 모집 중+예정+자리 있음 → 가능 / 마감 / 시작 시각 = 현재(경계) / 지남 / 점유 = 정원 → 자리 없음 / 점유 > 정원 → 남은 자리 0
  - 가장 가까운 회차, 투어 정렬(선택 가능 투어 먼저, 시작 시각, 제목), 상세 회차 목록(지난 회차 제외, 시작 시각 순)
  - 일시 표기(서울, 한국어, 요일·오전/오후 — 프로세스 시간대를 `America/New_York`로 바꾸고 적용 여부를 먼저 단언한 뒤 실행. 이 테스트만 별도 파일에 두고 복원은 `delete process.env.TZ` 규칙을 따른다, B.7), 소요 시간 표기(0·59·60·90·240분), slug 형식 판정(경계 사례)
- GREEN: `src/lib/` 순수 함수들. `@MX:ANCHOR`·`@MX:NOTE`(신청 SPEC 확장 지점)
- 검증: AC-TOUR-008
- 관련 REQ: 007, 008, 009(정렬)

### M3 — 카탈로그 조회 계층 (우선순위: High)

- RED: 통합 테스트 — 조회 함수가 공개 투어만, 공개 투어의 회차만 돌려주는지, 공개되지 않은 slug에 "없음"을 돌려주는지, 모든 호출이 접근 규칙을 적용하는지(테스트 데이터 표식으로 공개·비공개 투어를 만들어 확인)
- GREEN: `src/lib/catalog.ts`(목록용·상세용 조회, `overrideAccess: false`, 점유 인원 0 전달). 조회 결과를 M2 함수에 넘겨 화면용 모양으로 만든다
- 검증: AC-TOUR-006(조회 계층 부분)
- 관련 REQ: 005, 007

### M4 — 화면: 토큰, 공통 조각, 목록·상세·404, 홈 링크 (우선순위: Medium)

- RED: E2E(테스트 데이터는 각 테스트 파일의 준비 단계에서 로컬 API로 만들고 정리 단계에서 회차 → 투어 → 미디어 순서로 지운다)
  - 목록 카드(배지 글자·아이콘, 남은 자리, 가장 가까운 회차, 이미지 대체 텍스트와 실제 로드, 자리표시 블록), 공개되지 않은 투어 미노출
  - 상세(회차 순서, 지난 회차 미노출, 마감 회차 선택 불가, 모집 중 회차 선택 가능, 예정 회차 없음 안내)
  - 404(없는 slug, 공개되지 않은 slug), 익명 REST 조회 범위와 미디어 파일 주소
  - 375px 가로 스크롤 없음, 회차 선택 영역 44px 이상
  - 홈 `/tours` 링크, 기존 홈 테스트 유지, 각 페이지 방문 뒤 E2E 포트 단언(`expectE2ePort`)
  - 관리자 수정 반영(로컬 API로 제목 변경 후 새로고침)
- GREEN: 토큰 스타일, 상태 배지·투어 카드·회차 목록 컴포넌트(`src/components/` 또는 `(frontend)` 아래 — 구조 문서 §2 제안대로 `src/components/`), `/tours/page.tsx`, `/tours/[slug]/page.tsx`(`connection()`, 없으면 `notFound()`), 홈 링크. `src/app/(frontend)/tours/` 아래에는 `loading.tsx`를 두지 않는다(R21)
- 저장소 규칙 테스트: 토큰 범위(AC-TOUR-014), 데이터 페이지의 `connection` 호출(AC-TOUR-013)
- `pnpm build` 후 사전 렌더링 목록 확인
- 검증: AC-TOUR-010~015
- 관련 REQ: 009~014

### M5 — 개발용 시드 (우선순위: Medium)

- RED: 단위(거부 판정: `NODE_ENV=production`, 원격 호스트, 로컬 호스트 3종 허용 — IPv6는 `[::1]` 형식 URL로 시험, 잘못된 URL 거부) + 통합(테스트 데이터 표식 데이터 집합으로 2회 실행 → 두 번째는 전부 건너뜀, 투어·회차 수 불변, 기존 투어를 고치지 않음)
- GREEN: `src/lib/seed.ts`, `scripts/seed.ts`, `package.json`의 `seed` 스크립트(`cross-env` 사용)
- 저장소 규칙 테스트: `seed`가 다른 스크립트(`dev`, `build`, `start`, `test`, `e2e`, `postinstall` 등)에서 호출되지 않음
- README "개발 서버" 절 뒤에 샘플 데이터 안내 한 단락(`pnpm seed`, 다시 실행해도 안전, 운영 거부). AC-INFRA-016의 절 순서 규칙을 깨지 않는다. 또 AC-INFRA-016의 명령 순서 검사는 `readme.indexOf()`로 각 명령이 처음 나오는 위치를 비교하므로, 시드 단락에는 `pnpm test`·`pnpm e2e` 문자열을 쓰지 않는다(쓰면 `http://localhost:3000/admin`보다 앞에 나와 검사가 실패한다)
- 수동: `pnpm seed` 2회, 거부 2종 → §E.2 기록
- 검증: AC-TOUR-016
- 관련 REQ: 015

### M6 — 회귀 정리와 품질 게이트 (우선순위: Low)

- 전체 품질 게이트(`acceptance.md` §3) 실행, 커버리지 85% 이상 확인(조회 계층·시드 로직은 통합 테스트가 커버)
- MX 태그 정리(계산 지점 ANCHOR, 미디어 접근 DEBT, 시드 거부 NOTE)
- `@MX` 보고와 `progress.md` §E.2·§E.3 작성
- 검증: AC-TOUR-009
- 관련 REQ: 016

### 예상 생성·수정 파일

- 생성: `src/collections/{Media,Tours,TourSessions}.ts`, `src/lib/{session-availability,catalog-order,format,slug,access,catalog,seed}.ts`(이름은 예시, 합치거나 나눌 수 있음), `src/components/{StatusBadge,TourCard,SessionList}.tsx`(예시), `src/app/(frontend)/tours/page.tsx`, `src/app/(frontend)/tours/[slug]/page.tsx`, `src/app/(frontend)/tokens.css`(예시), `scripts/seed.ts`, `tests/unit/*`(도우미·시드 거부), `tests/integration/*`(컬렉션·접근·조회·시드), `tests/e2e/{tours-list,tour-detail}.spec.ts`, `tests/helpers/catalog-fixtures.ts`(예시)
- 수정: `src/payload.config.ts`, `src/app/(frontend)/{page.tsx,globals.css}`, `package.json`(`seed` 스크립트만), `.gitignore`(`/media/` 추가만), `next.config.ts`(필요할 때만 이미지 경로 허용과 주석), `tests/integration/users-auth.spec.ts`, `tests/unit/repo-rules.spec.ts`(규칙 추가), `README.md`(시드 단락)
- 생성 파일 갱신: `src/payload-types.ts`, `src/app/(payload)/admin/importMap.js`

## §G. 위험과 대응

| ID | 위험 | 대응 |
|---|---|---|
| R1 | 로컬 API 기본값 `overrideAccess: true` 때문에 서버 컴포넌트가 공개되지 않은 투어를 읽어 화면에 노출 | 조회 계층이 모든 호출에 `overrideAccess: false`를 넘김(B.5). 통합 테스트로 조회 계층을 직접 확인, E2E로 공개되지 않은 slug 404 확인 |
| R2 | sharp 없이 자르기·초점 UI가 보이면 관리자가 한 편집이 조용히 무시됨 | `crop: false`, `focalPoint: false`, `imageSizes`·`formatOptions` 미사용 → Payload 경고도 없음(§A.2). M1 수동 확인 |
| R3 | sharp를 직접 의존성으로 넣으면 AC-INFRA-005(메이저 1 이상) 위반 | 미도입(B.1). 나중에 도입할 때는 그 SPEC이 규칙 예외를 명시 |
| R4 | 업로드 디렉터리가 OneDrive 동기화 폴더 안에 있어 파일 잠금·동기화 지연 | `.gitignore`에 넣고 테스트가 만든 미디어는 정리 단계에서 문서와 함께 삭제(Payload가 파일도 지움). 잠금 오류가 나면 README 문제 해결의 OneDrive 안내를 따른다 |
| R5 | 관리자 import map이 새 구성 요소를 필요로 하는데 갱신하지 않아 관리자 화면 오류 | M1에서 `pnpm generate:importmap` 실행·커밋. 관리자 화면에서 세 컬렉션 목록·편집 화면을 한 번씩 열어 확인 |
| R6 | `payload-types.ts` 미갱신으로 타입 오류, 또는 포맷 검사 실패 | `pnpm generate:types` 후 `pnpm typecheck`. 이 파일은 이미 검사 제외 목록에 있음 |
| R7 | 기존 통합 테스트가 `['users']`를 단언해 실패 | M1 RED 단계에서 단언을 새 목록으로 바꾼다(REQ-TOUR-004) |
| R8 | E2E·통합 테스트 데이터가 실패 시 남거나, 삭제 순서가 틀려 회차가 있는 투어 삭제 거부(REQ-TOUR-006)에 걸림 | 정리 단계는 회차 → 투어 → 미디어 순서, `finally`로 실행. 모든 데이터에 테스트 데이터 표식을 붙여 남더라도 식별 가능 |
| R9 | 토큰·Tailwind 스타일이 관리자 화면에 섞임 | `(frontend)`에서만 로드, 저장소 규칙 테스트(AC-INFRA-009 + AC-TOUR-014) |
| R10 | 운영 빌드에서 페이지가 사전 렌더링되어 수정·시간 경과가 반영되지 않음 | `connection()`(B.3), 빌드 후 사전 렌더링 목록 확인(AC-TOUR-013) |
| R11 | 서버·테스트 PC의 시간대에 따라 일시 표기가 달라지거나, 관리자 브라우저 시간대로 일시가 잘못 입력됨 | 표시는 `timeZone: 'Asia/Seoul'` 명시, 단위 테스트는 고정 UTC 값. 입력은 필드 `timezone` 설정(B.7), M1 수동 확인 |
| R12 | 개발 모드 스키마 자동 반영이 기존 개발 DB 상태와 충돌해 대화형 확인을 요구하거나 실패 | 이 SPEC은 새 테이블만 추가한다. 문제가 생기면 `docker compose down -v`로 개발 DB를 비우는 절차를 §E.2에 기록(개발 데이터만 사라짐) |
| R13 | 미디어 읽기 접근 조건이 읽을 때마다 공개 투어를 한 번 더 조회 | 지금 규모에서 허용, `@MX:DEBT`로 한도와 갱신 조건 기록(B.5) |
| R14 | Payload가 미디어 주소를 `serverURL` 기반 절대 주소로 만들어 E2E 포트·이미지 컴포넌트 설정과 어긋남 | E2E는 이미 `NEXT_PUBLIC_SERVER_URL`을 E2E 주소로 덮어씀. M4에서 실제 주소 형태 확인 후 상대 경로 사용 또는 이미지 경로 허용 설정. E2E가 이미지 실제 로드(`naturalWidth > 0`)를 확인 |
| R15 | E2E 목록 화면에 개발자·시드 데이터가 함께 보여 단언이 흔들림 | 테스트는 자기 데이터 표식이 붙은 카드만 찾는다. 순서 검증은 단위 테스트가 맡는다 |
| R16 | 현재 시각 근처 회차 때문에 E2E가 시각에 따라 흔들림 | E2E 회차는 현재 시각 기준 하루 이상 떨어진 값만 쓴다. "시작 시각 = 현재" 경계는 단위 테스트에서만 확인 |
| R17 | `payload run`이 Windows에서 TypeScript 시드 스크립트를 불러오지 못하거나, 거부했는데도 종료 코드 0으로 끝남 | TS 로딩은 plan-audit 1회차에서 Windows·Node 24.22.1로 실측 확인(tsx 실행). 종료 코드: `payload run`은 import가 끝나면 무조건 `process.exit(0)`이므로 거부는 예외를 던지거나 `process.exit(1)`로 끝내고, 진입점은 최상위 `await`로 완료를 기다린다(B.9, 실측: `exitCode=3` → 0, `throw` → 1). M5 첫 단계에서 빈 스크립트와 거부 스크립트로 두 동작을 다시 확인 |
| R18 | 시드 거부 판정을 우회해 원격 DB에 쓰기 | 판정은 DB 연결 전에 실행, 단위 테스트로 고정. 개발용 원격 DB 시드는 범위 밖 |
| R19 | 직접 작성 코드가 Tier M 지침을 크게 넘음 | §A.3의 분할 기준 적용 |
| R20 | 기존 `.gitignore` 규칙에 새 파일이 걸려 커밋에서 조용히 빠짐 | §D의 이름 규칙과 `git check-ignore -v` 확인 |
| R21 | `src/app/(frontend)/tours/` 구간에 `loading.tsx`(Suspense 경계)가 있으면 `notFound()`가 스트리밍 중에 호출되어 HTTP 200으로 응답할 수 있음(AC-TOUR-012 실패) | `tours/` 아래에 `loading.tsx`를 두지 않는다(404 상태 코드 유지). AC-TOUR-012가 상태 코드로 확인 |

안티 패턴 (하지 말 것):

- 서버 컴포넌트에서 `payload.find`를 `overrideAccess` 지정 없이 호출하기
- 화면 컴포넌트 안에서 남은 자리나 선택 가능 여부를 따로 계산하기
- 공개 여부를 화면 쪽 `where`에만 두고 접근 규칙에는 두지 않기(REST·GraphQL이 그대로 노출됨)
- 테스트가 시드 데이터나 고정 slug에 기대기
- `.prettierignore`·ESLint 무시 목록에 `media/` 넣기(AC-INFRA-010 규칙 위반)
- 시드를 `postinstall`이나 `dev`에 연결하기
- 검증 명령을 실행하지 않고 통과로 기록하기

## §H. 상호 참조

- `spec.md` — REQ-TOUR-001~016, 용어(§2.5), 가정(§2.4), 제외 범위
- `acceptance.md` — AC-TOUR-001~016, 품질 게이트, 완료 정의
- `interview.md` — 사용자 결정 D1~D6
- `.moai/specs/SPEC-INFRA-001/` — 검증 방식, 저장소 규칙 테스트, 수용한 차이
- `.moai/project/design/handoff.md` §1~§4, `tokens.css`
- 근거 소스(설치본): §A.2 표의 경로
