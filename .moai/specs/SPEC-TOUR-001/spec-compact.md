# SPEC-TOUR-001 (compact) — 투어 카탈로그와 회차

> run 단계용 요약본. 원본: `spec.md`(요구사항·용어·가정), `acceptance.md`(수용 기준), `plan.md`(결정·마일스톤·위험), `interview.md`(사용자 결정). 내용이 다르면 원본이 우선한다.
> Tier M · status: draft · 문서 버전 0.1.2(plan-audit 1회차 D1~D14, 2회차 N1·N2 반영) · 개발 방식: TDD · 검증 셸: Windows PowerShell 5.1 · 의존: SPEC-INFRA-001(completed) · 기준 HEAD `ff00406`

## 사용자 결정 (구속)

D1 기능 페이지 + 토큰(`(frontend)`만), 단순 배지·카드·회차 목록, 375px 사용 가능 · D2 `Media` 업로드(대체 텍스트 필수, 로컬 디스크, git 제외) · D3 한국어만, `/tours`·`/tours/[slug]`, localization 끔 · D4 남은 자리 = 정원, 계산 지점 하나, 마감·지난 회차 선택 불가 · D5 임시 홈 유지 + `/tours` 링크 · D6 개발 전용 `pnpm seed`, 운영 거부, 재실행 안전.

## 핵심 결정 (plan.md §B)

- sharp 미도입 — 원본만 저장, `crop: false`·`focalPoint: false`, `imageSizes`·`formatOptions` 없음. sharp 0.35.5는 메이저 0이라 AC-INFRA-005와도 충돌
- 설명·요약은 일반 텍스트(textarea). 요약은 투어 카드에 표시. 전역 `lexicalEditor()`는 그대로
- `/tours`, `/tours/[slug]`는 `await connection()`으로 요청 시점 렌더링
- 남은 자리·선택 가능 판정은 `src/lib/`의 순수 함수 하나(점유 인원 인자, 지금은 0). `@MX:ANCHOR` + 신청 SPEC 확장 `@MX:NOTE`
- 접근: 쓰기는 관리자(`req.user?.collection === 'users'`)만. 익명 읽기는 공개 투어, 그 회차(`tour.published`), 그 대표 이미지만. 화면 조회는 반드시 `overrideAccess: false`
- 회차가 있는 투어 삭제 거부
- 업로드: 루트 `media/`(설정 기준 절대 경로), `.gitignore`에 `/media/`만 추가(`.prettierignore`·ESLint 무시 목록은 그대로), JPEG·PNG·WebP, 5MB — `media` 컬렉션 훅(`beforeOperation` create·update, `req.file.size > 5 * 1024 * 1024` → `ValidationError`)이 주 판정(로컬 API·REST 공통, 정확히 5MB는 허용). 루트 `upload.limits.fileSize`는 REST 보조 수단일 뿐이며 한도 초과 응답은 HTTP 413(검증 오류 아님)
- 일시: UTC 저장, 회차 필드 `timezone` 기본 `Asia/Seoul`, 표시는 `Intl` + `timeZone: 'Asia/Seoul'`
- 시드: `payload run scripts/seed.ts`, 로직은 `src/lib/seed.ts`(데이터 집합 인자), slug 있으면 건너뜀, `NODE_ENV=production`·비로컬 호스트 거부(IPv6 `[::1]`은 대괄호를 벗겨 판정). `payload run`은 import 뒤 무조건 `process.exit(0)`이므로 거부는 예외를 던지거나 `process.exit(1)`, 진입점은 최상위 `await`(`process.exitCode`에 기대지 않음)
- 투어 삭제 거부 오류 문구: `Cannot delete a tour that has sessions. Delete its sessions first.`(영문 고정)
- `src/app/(frontend)/tours/` 아래 `loading.tsx` 금지(404 상태 코드 유지)
- 일시 표기 테스트는 별도 테스트 파일에 두고 `process.env.TZ = 'America/New_York'`로 바꾼 뒤 적용 여부를 먼저 단언(2026-11-20은 금요일). 복원은 원래 값이 있으면 다시 대입, 없으면 `delete process.env.TZ`(문자열 `"undefined"` 대입 금지)
- 스키마는 개발 모드 자동 반영 유지(마이그레이션은 배포 SPEC). 새 npm 패키지 없음

## 요구사항 (GEARS)

- **REQ-TOUR-001** `media`: JPEG·PNG·WebP만, 대체 텍스트 필수, git 제외 로컬 디렉터리에 원본 저장, 크기 변환·자르기·초점 없음. **When** 대체 텍스트 없음·허용 외 형식(SVG 포함)·5MB 초과 → 검증 오류, 문서·파일 없음. 5MB 판정은 컬렉션 자체(로컬 API·REST 공통). REST는 그보다 먼저 HTTP 413으로 끝날 수 있음(문서·파일 없음). 정확히 5MB는 허용.
- **REQ-TOUR-002** `tours`: 제목·slug·요약·설명(일반 텍스트)·대표 이미지(선택)·소요 시간(분, 정수 ≥1)·집결 장소·가격 안내 문구·공개 여부(기본 꺼짐). slug는 `소문자/숫자` + 단일 하이픈, 고유. **When** 잘못된 값 → 검증 오류, 변경 없음.
- **REQ-TOUR-003** `tour-sessions`: 소속 투어·시작/종료 일시·정원(정수 ≥1)·상태(모집 중/마감, 기본 모집 중). UTC 저장, 관리자 입력은 서울 기준. **When** 종료 ≤ 시작, 정원 위반 → 검증 오류.
- **REQ-TOUR-004** 시스템 컬렉션 제외 등록 목록 = `users`, `media`, `tours`, `tour-sessions`.
- **REQ-TOUR-005** 세 컬렉션 쓰기는 관리자만, 익명 쓰기 거부. **While** 요청이 인증되지 않은 상태이면 읽기는 공개 투어·그 회차·그 대표 이미지만 — 화면·REST·GraphQL·파일 주소 동일, 화면 조회도 우회 금지.
- **REQ-TOUR-006** **When** 회차가 있는 투어 삭제 → 거부 + 회차 먼저 정리 안내(영문 고정 문구), 아무것도 지우지 않음.
- **REQ-TOUR-007** 남은 자리(정원 − 점유, 최소 0, 지금 점유 0)와 선택 가능 여부(모집 중 ∧ 시작 > 현재 ∧ 남은 자리 ≥ 1)는 한 지점에서만 계산, 목록·상세가 같이 씀.
- **REQ-TOUR-008** 일시는 서버 시간대와 무관하게 `Asia/Seoul` 한국어 표기, 소요 시간은 "N시간 M분".
- **REQ-TOUR-009** **When** `/tours` → 공개 투어 카드(이미지 또는 자리표시, 제목, 요약, 소요 시간, 가격 문구, 배지, 상세 링크). 선택 가능 회차 있으면 "모집 중" + 가장 가까운 회차 일시 + "남은 자리 N / M", 없으면 "모집 마감". 순서: 선택 가능 투어(가장 가까운 회차 순) → 나머지(제목 순).
- **REQ-TOUR-010** **When** 공개 투어 `/tours/[slug]` → 제목·이미지·설명·소요 시간·집결 장소·가격 문구 + 예정 회차(시작 순, 지난 회차 없음, 일시·남은 자리·배지, 선택 가능은 단일 선택, 불가는 비활성). 예정 회차 없으면 안내.
- **REQ-TOUR-011** **When** 없는/비공개 slug → HTTP 404, 내용 비노출.
- **REQ-TOUR-012** 목록·상세는 사전 렌더링하지 않음. **When** 관리자 수정 후 재요청 → 재빌드 없이 반영.
- **REQ-TOUR-013** 토큰은 `(frontend)`에서만, 관리자 화면 미로드. 배지는 색 + 아이콘 + 글자. **While** 화면 폭 375px → 가로 스크롤 없음, 회차 선택 터치 영역 ≥ 44×44px.
- **REQ-TOUR-014** **When** `/` → 기존 임시 홈 유지 + `/tours` 링크.
- **REQ-TOUR-015** `pnpm seed`: 가상 투어 3개(한라산 영실·우도 자전거·해녀 체험) 공개 + 예정 회차. 자동 실행 금지. **When** 같은 slug 있음 → 건너뜀(수 불변). **When** `NODE_ENV=production` 또는 비로컬 DB 호스트 → 쓰기 전 거부, 0이 아닌 종료 코드.
- **REQ-TOUR-016** 단위(도우미)·통합(컬렉션·접근·조회·시드)·E2E(목록·상세·404·홈 링크). 테스트 데이터는 표식(`test-`, `@example.test`)을 붙여 스스로 만들고 지움. 커버리지 85%·기존 품질 게이트 유지.

## 수용 기준 (요약 — 상세는 acceptance.md)

| AC | 핵심 검증 |
|---|---|
| AC-TOUR-001 | 통합: 시스템 제외 slug(정렬) = `['media','tour-sessions','tours','users']`, 기존 Users 인증 테스트 유지 |
| AC-TOUR-002 | 통합: PNG 업로드 성공·`media/`에 파일·크기 1×1, 대체 텍스트 빈 값·텍스트·SVG 거부, 올바른 1×1 PNG를 채운 5,242,881바이트 → `ValidationError`·문서·파일 없음, 대조 5,242,880바이트 → 성공(1×1) 후 정리, 삭제 시 파일 삭제; `git check-ignore -q media/probe.png` → 0; 수동: 자르기·초점 없음, `sharp not installed` 0건 |
| AC-TOUR-003 | 통합: slug 잘못된 값 7종·중복 거부, 소요 시간 0/-30/1.5 거부, 필수 값 누락 거부, 공개 기본 false, 이미지 연결 |
| AC-TOUR-004 | 통합: 종료 ≤ 시작(생성·수정) 거부, 정원 0/-1/1.5 거부, 투어 누락 거부, 상태 기본 모집 중, UTC 왕복; 수동: 관리자 서울 09:00 입력 → `00:00Z` |
| AC-TOUR-005 | 통합: 익명(`overrideAccess:false`) 생성·수정·삭제 거부·데이터 불변, 관리자 성공; 단위: 관리자 판정 `users` 기준 |
| AC-TOUR-006 | 통합: 익명 로컬 API·조회 계층 범위; E2E: REST `tours`/`tour-sessions` 범위, GraphQL, 파일 주소(a 200, b·c 비200), 익명 POST 거부 |
| AC-TOUR-007 | 통합: 회차 있는 투어 삭제 거부(메시지에 `Cannot delete a tour that has sessions`, 둘 다 유지), 회차 삭제 후 성공 |
| AC-TOUR-008 | 단위: 남은 자리, 선택 가능(경계 시작 = 현재), 가장 가까운 회차, 목록 정렬, 상세 목록, 서울 일시 표기(TZ를 뉴욕으로 바꾸고 적용 단언 후 "11월 20일"·"금"·"오전 9:00"/"오후 3:30"), 소요 시간, slug |
| AC-TOUR-009 | `pnpm test`·`pnpm e2e` 통과, 커버리지 ≥85%, 실행 뒤 `test-%` 투어·`@example.test` 사용자 0건, `Test-Path media` True 확인 후 `media/test-*` 0건 |
| AC-TOUR-010 | E2E `/tours`: O 카드(요약, 모집 중, +2일, 남은 자리 11 / 11, alt·로드), C 카드(모집 마감, 자리표시), 배지 글자+아이콘, H 미노출, 카드 링크 |
| AC-TOUR-011 | E2E 상세: 내용·문단, 회차 순서 11→13(마감)→12, 지난 회차(/19) 없음, 마감 비활성, 단일 선택, 키보드; E는 회차 없음 안내 |
| AC-TOUR-012 | E2E: 없는 slug·H slug·`Not_A_Slug` → 404 |
| AC-TOUR-013 | 순서 build → test → e2e. 빌드 후 존재 단언 True 3건(`app-path-routes-manifest.json`에 `/tours`·`/tours/[slug]`, `prerender-manifest.json` `routes`에 `/`), 이어서 False 2건(`routes`에 `/tours` — 판정, `dynamicRoutes`에 `/tours/[slug]` — `generateStaticParams` 회귀 감시); 규칙: 두 페이지가 `connection` import·호출(상세 판정); E2E: 제목 변경 후 새로고침 반영 |
| AC-TOUR-014 | 규칙(범위 `src/`): `--color-accent:` 파일과 그 import가 `(frontend)`에만, `(payload)` 참조 0건, AC-INFRA-009 유지; E2E: 배지 배경 `rgb(226, 244, 236)`, 375px 가로 스크롤 없음·선택 영역 ≥44px |
| AC-TOUR-015 | E2E: 기존 홈 2건 유지, 홈 → `/tours` 링크 이동 |
| AC-TOUR-016 | 수동: `pnpm seed` 2회(`created 3` → `created 0`·`skipped 3`, 개수 3), 거부 2종(production, `db.example.com`·비밀번호 비노출); 단위·통합: 거부 판정(IPv6는 `[::1]` URL), 표식 데이터로 멱등·수정 보존; 규칙: 자동 호출 없음 |

## 마일스톤 (plan.md §F)

M1 데이터 모델·접근 규칙(High) → M2 남은 자리·표시 도우미(High) → M3 조회 계층(High) → M4 화면·토큰·404·홈 링크(Medium) → M5 시드(Medium) → M6 회귀·품질 게이트(Low).

## 제외 범위

신청·정원 차감·자동 마감 · 다국어(localization, `/ko`·`/en`) · 외부 스토리지·sharp·이미지 변환·갤러리 · 픽셀 일치 랜딩·웹 폰트·머리글/푸터 · 회원·이메일·관리자 대시보드·CSV · 마이그레이션·배포·원격 DB 시드.

## 주요 위험 (plan.md §G 요약)

R1 로컬 API 기본 `overrideAccess: true` 노출 · R2 sharp 없이 자르기 UI · R5 import map 미갱신 · R7 기존 `['users']` 단언 · R8 테스트 정리 순서(회차 → 투어 → 미디어) · R10 사전 렌더링 · R11 시간대 · R14 미디어 절대 주소 · R17 `payload run` TS 로딩·종료 코드(무조건 exit 0) · R21 `tours/` 아래 `loading.tsx` 금지(404 유지).
