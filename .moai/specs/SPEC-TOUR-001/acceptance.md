# SPEC-TOUR-001 수용 기준

> **검증 셸**: Windows PowerShell 5.1에서 그대로 실행되어야 한다(PowerShell 7 확인은 SPEC-INFRA-001의 수용한 부채를 따른다). 명령 인자 안에 큰따옴표를 겹쳐 쓰지 않는다. 문자열·구조 검사는 셸 인용에 기대지 않고 테스트 코드(저장소 규칙 테스트 `tests/unit/repo-rules.spec.ts` 포함)나 `Select-String -SimpleMatch '<고정 문자열>'`로 한다.
> **판정**: 별도 표시가 없으면 "통과"는 해당 명령의 종료 코드가 0(`$LASTEXITCODE -eq 0`)임을 뜻한다.
> **빈 결과 방지**: "0건" 조건을 검사하는 테스트는 같은 검사 안에서 대상이 1건 이상 존재함을 먼저 단언한다.
> **전제**: SPEC-INFRA-001의 전제(사용자 사전 작업 완료, `.env` 존재)와 같고, 별도 표시가 없으면 PostgreSQL 컨테이너가 `healthy`다. `pnpm test`, `pnpm e2e`로 판정하는 기준은 모두 이 상태를 전제로 한다.
> **테스트 데이터 표식**: 테스트가 만드는 투어 slug와 제목은 `test-`로 시작하고 실행마다 고유한 값을 포함한다(예: `test-<무작위 값>-open`). 테스트가 만드는 관리자 이메일은 `@example.test`로 끝난다(SPEC-INFRA-001과 같음). 테스트는 시드 데이터나 개발자가 만든 데이터에 기대지 않는다.
> **시각 기준**: E2E·통합 테스트의 회차 일시는 실행 시각 기준 하루 이상 떨어진 값만 쓴다. "시작 시각 = 현재" 같은 경계는 단위 테스트에서 현재 시각을 고정해 확인한다.

## 1. 데이터 모델과 접근 규칙

### AC-TOUR-001 — 등록 컬렉션

- **Given** 소스가 준비되어 있다
- **When** `pnpm test`를 실행한다
- **Then** 통합 테스트가 Payload 설정의 컬렉션 slug 목록에서 `payload-`로 시작하는 slug를 뺀 결과(정렬 후)가 정확히 `['media', 'tour-sessions', 'tours', 'users']`임을 단언하고 통과한다
- **And** 같은 테스트는 필터 전 목록이 필터 후보다 길다는 것(시스템 컬렉션 존재)을 먼저 단언한다
- **And** 기존 `Users` 인증 흐름 테스트(생성·로그인·틀린 비밀번호·삭제)가 계속 통과한다

### AC-TOUR-002 — Media 업로드 검증과 저장 위치

- **Given** 통합 테스트가 메모리에서 만든 작은 PNG 파일(1×1)과 텍스트 파일, SVG 파일을 준비한다
- **When** `pnpm test`를 실행한다
- **Then** 통합 테스트가 다음을 확인한다
  - 대체 텍스트가 있는 PNG 업로드는 성공하고, 저장소 루트 `media/` 디렉터리에 그 파일이 생기며, 문서에 가로·세로 크기(1, 1)가 기록된다
  - 대체 텍스트가 빈 문자열인 업로드는 검증 오류로 끝나고 `media` 문서 수가 늘지 않는다
  - 텍스트 파일과 SVG 파일 업로드는 오류로 끝나고 문서 수가 늘지 않는다
  - 크기 규칙(로컬 API 경로): 올바른 1×1 PNG 뒤에 바이트를 채워 전체 크기를 정확히 5 × 1024 × 1024 + 1바이트(5,242,881바이트)로 만든 파일(크기 규칙 말고는 거부될 이유가 없는 파일)을 대체 텍스트와 함께 업로드하면 검증 오류(Payload `ValidationError`)로 끝나고, 문서 수가 늘지 않으며, `media/`에 그 파일이 생기지 않는다
  - 크기 규칙 대조 사례: 같은 방식으로 정확히 5 × 1024 × 1024바이트(5,242,880바이트)로 만든 파일은 업로드에 성공하고 문서에 가로·세로 크기(1, 1)가 기록된다(거부가 크기 때문임을 증명). 이 문서는 같은 테스트의 정리 단계에서 지우고, 지운 뒤 `media/`에 그 파일이 남지 않는다
  - 만든 문서를 지우면 `media/`의 해당 파일도 사라진다
- **And** `git check-ignore -q media/probe.png; $LASTEXITCODE`의 출력이 `0`이다(업로드 디렉터리가 git 추적에서 제외됨)
- **And** 저장소 규칙 테스트 AC-INFRA-010(`.prettierignore`·ESLint 무시 목록이 검사 제외 목록과 정확히 같음)이 계속 통과한다
- **And** (수동) 관리자 화면의 미디어 편집 화면에 자르기·초점 도구가 보이지 않고, `pnpm dev` 출력에 `sharp not installed` 경고가 0건이다(`Select-String -SimpleMatch 'sharp not installed'`). 결과를 `progress.md` §E.2에 기록한다

### AC-TOUR-003 — Tours 필드 검증

- **Given** 통합 테스트가 테스트 데이터 표식을 붙인 투어 입력값을 준비한다
- **When** `pnpm test`를 실행한다
- **Then** 통합 테스트가 다음을 확인한다
  - 필수 값이 모두 있고 대표 이미지가 없는 투어는 저장되며, 공개 여부를 지정하지 않으면 `false`로 저장된다
  - slug `Test-Upper`, `test_under`, `-test`, `test-`, `test--double`, `테스트`, 빈 문자열은 각각 검증 오류로 끝나고 문서가 생기지 않는다
  - 이미 쓰인 slug로 두 번째 투어를 만들면 오류로 끝나고 문서가 하나만 남는다
  - 소요 시간 `0`, `-30`, `1.5`는 검증 오류, `1`은 저장된다
  - 제목·slug·요약·설명·소요 시간·집결 장소·가격 안내 문구 중 하나라도 빠지면 검증 오류로 끝난다(필드별로 1건씩)
  - 대표 이미지에 `media` 문서를 연결하면 저장되고, 다시 읽었을 때 그 문서를 가리킨다

### AC-TOUR-004 — TourSessions 필드 검증과 일시 저장

- **Given** 통합 테스트가 테스트 데이터 표식을 붙인 투어 1개를 만들었다
- **When** `pnpm test`를 실행한다
- **Then** 통합 테스트가 다음을 확인한다
  - 종료 일시가 시작 일시와 같거나 앞서면 검증 오류로 끝나고 문서가 생기지 않는다(새로 만들 때와 기존 회차의 종료 일시만 바꿀 때 모두)
  - 정원 `0`, `-1`, `1.5`는 검증 오류, `1`은 저장된다
  - 소속 투어가 없으면 검증 오류로 끝난다
  - 상태를 지정하지 않으면 모집 중으로 저장된다
  - 시작 일시 `2026-11-20T00:00:00.000Z`로 만든 회차를 다시 읽으면 같은 순간(UTC)을 가리킨다
- **And** (수동) 관리자 화면에서 회차 시작 일시를 서울 기준 2026-11-20 오전 9:00으로 입력해 저장하면, 같은 문서를 로컬 API나 REST로 읽은 값이 `2026-11-20T00:00:00.000Z`다. 관리자 화면의 시간대 선택 기본값이 서울이다. 결과를 `progress.md` §E.2에 기록한다

### AC-TOUR-005 — 쓰기 권한

- **Given** 통합 테스트가 테스트 관리자 계정(`@example.test`)과 테스트 데이터 표식을 붙인 투어·회차·미디어를 준비했다
- **When** `pnpm test`를 실행한다
- **Then** 통합 테스트가 로컬 API를 접근 규칙 적용 상태(`overrideAccess: false`, 사용자 없음)로 호출해 `media`, `tours`, `tour-sessions` 각각에 대해 생성·수정·삭제가 모두 권한 오류로 끝나고, 호출 전후의 문서 수와 값이 같음을 확인한다
- **And** 같은 호출을 테스트 관리자 사용자로 하면 생성·수정·삭제가 모두 성공한다
- **And** 관리자 판정이 `users` 컬렉션 기준임을 확인하는 단위 테스트가 있다: 사용자 없음 → 거부, `collection: 'users'` → 허용, 다른 컬렉션 이름(예: `members`) → 거부

### AC-TOUR-006 — 익명 읽기 범위 (로컬 API·조회 계층·REST·GraphQL·파일 주소)

- **Given** 테스트가 다음을 만들었다: 공개 투어 A(대표 이미지 a, 회차 1개 이상), 공개되지 않은 투어 B(대표 이미지 b, 회차 1개 이상), 어느 투어도 참조하지 않는 미디어 c
- **When** `pnpm test`와 `pnpm e2e`를 실행한다
- **Then** 통합 테스트(`pnpm test`)가 다음을 확인한다
  - 접근 규칙 적용 상태의 익명 로컬 API 조회 결과에 A·A의 회차·a는 있고, B·B의 회차·b·c는 없다
  - 사용자 화면의 조회 계층(목록용·상세용)도 같은 결과를 내며, B의 slug로 상세 조회하면 "없음"을 돌려준다
- **And** E2E(`pnpm e2e`)가 Playwright 요청 API로 다음을 확인한다(로그인하지 않은 요청)
  - `GET /api/tours?where[slug][equals]=<B의 slug>`의 `totalDocs`가 0, A의 slug로는 1
  - `GET /api/tour-sessions?where[tour][equals]=<B의 id>`의 `totalDocs`가 0, A의 id로는 1 이상
  - `POST /api/graphql`로 B의 slug를 조회한 결과에 B가 없다
  - a의 파일 주소 응답 상태가 200, b와 c의 파일 주소 응답 상태가 200이 아니다
  - `POST /api/tours`(익명, 유효한 본문)의 응답 상태가 2xx가 아니고, 이후 그 slug의 투어가 없다

### AC-TOUR-007 — 회차가 있는 투어의 삭제 거부

- **Given** 테스트 데이터 표식을 붙인 투어 1개와 그 회차 1개가 있다
- **When** `pnpm test`를 실행한다
- **Then** 통합 테스트가 관리자 권한으로 그 투어 삭제를 요청하면 오류로 끝나고, 오류 메시지에 영문 고정 문자열 `Cannot delete a tour that has sessions`가 들어 있으며(`language.yaml`의 `error_messages: en`), 투어와 회차가 모두 그대로 있음을 확인한다
- **And** 회차를 먼저 지운 뒤 투어를 삭제하면 성공한다

## 2. 계산·표시 도우미와 테스트 체계

### AC-TOUR-008 — 남은 자리·표시 도우미 단위 테스트

- **Given** 현재 시각과 입력값을 고정한 단위 테스트가 있다(테스트 PC의 시간대와 무관)
- **When** `pnpm test`를 실행한다
- **Then** 다음 사례가 모두 통과한다
  - 남은 자리: 정원 15·점유 0 → 15 / 정원 15·점유 15 → 0 / 정원 15·점유 20 → 0. 점유 인원을 넘기지 않으면 0으로 계산한다
  - 선택 가능: 모집 중·시작 시각이 현재보다 뒤·남은 자리 1 이상 → 가능. 마감 → 불가(사유: 마감). 시작 시각 = 현재 → 불가(사유: 지남). 시작 시각 < 현재 → 불가(사유: 지남). 남은 자리 0 → 불가(사유: 자리 없음)
  - 가장 가까운 회차: 선택 불가 회차를 건너뛰고 선택 가능한 회차 중 가장 이른 것. 없으면 "없음"
  - 목록 정렬: 선택 가능한 회차가 있는 투어가 먼저, 그 안에서 가장 가까운 회차의 시작 시각 오름차순(같으면 제목 순), 나머지는 제목 순
  - 상세 회차 목록: 지난 회차 제외, 시작 시각 오름차순, 마감 회차는 포함하되 선택 불가
  - 일시 표기: 테스트는 표기 사례를 실행하기 전에 프로세스 시간대를 서울이 아닌 값으로 바꾸고(`process.env.TZ = 'America/New_York'`), 같은 테스트 안에서 그 시간대가 적용되었음을 먼저 단언한다(`new Date('2026-11-20T00:00:00Z').getHours()`가 9가 아님 — 뉴욕 기준 19). 그 상태에서 `2026-11-20T00:00:00Z` → "11월 20일", "금", "오전 9:00"을 포함 / `2026-11-20T06:30:00Z` → "11월 20일", "금", "오후 3:30" 포함(2026-11-20은 금요일). 시간대를 바꾸는 이 표기 테스트는 다른 단위 테스트와 섞지 않고 **별도 테스트 파일**에 둔다(같은 프로세스 안에서는 운영체제 기본 시간대로 되돌아오지 않음). 끝난 뒤 원래 값이 있었으면 그 값을 다시 넣고, 원래 값이 없었으면(`undefined`) `delete process.env.TZ`로 지운다 — 문자열 `"undefined"`를 대입하지 않는다
  - 소요 시간 표기: 30 → "30분", 60 → "1시간", 90 → "1시간 30분", 240 → "4시간"
  - slug 판정: AC-TOUR-003의 잘못된 값은 거부, `hallasan-yeongsil`, `udo-bike-2`, `a`는 허용

### AC-TOUR-009 — 테스트 체계, 커버리지, 데이터 정리

- **Given** PostgreSQL이 `healthy`이고 E2E 전용 포트가 비어 있다
- **When** `pnpm test`를 실행한 뒤 `pnpm e2e`를 실행한다
- **Then** 둘 다 종료 코드 0이고, `pnpm test`는 단위·통합 테스트를, `pnpm e2e`는 기존 4건과 이 SPEC의 E2E를 모두 통과로 보고한다
- **And** 커버리지 보고서의 `src/lib/` 합산 라인 커버리지가 85% 이상이다(미달 시 `pnpm test`가 실패하도록 설정된 기존 임계값 유지)
- **And** 두 명령이 끝난 뒤 다음 명령의 출력이 각각 `0`이다(테스트가 만든 데이터가 남지 않음)
  - `docker compose exec -T postgres psql -U <POSTGRES_USER 값> -d <POSTGRES_DB 값> -tAc 'SELECT count(*) FROM tours WHERE slug LIKE ''test-%'';'`
  - `docker compose exec -T postgres psql -U <POSTGRES_USER 값> -d <POSTGRES_DB 값> -tAc 'SELECT count(*) FROM users WHERE email LIKE ''%@example.test'';'`
- **And** `media/` 디렉터리에 테스트가 올린 파일이 남지 않는다. 먼저 `Test-Path media`의 출력이 `True`임을 확인하고(디렉터리가 없어서 0건이 되는 경우 방지), 이어서 `(Get-ChildItem media -Filter 'test-*' | Measure-Object).Count`의 출력이 `0`이다(테스트 업로드 파일 이름은 `test-`로 시작)

## 3. 화면

### AC-TOUR-010 — 투어 목록 `/tours`

- **Given** E2E 준비 단계가 다음 공개 투어를 만들었다: 투어 O(대표 이미지와 대체 텍스트, 모집 중 예정 회차 2개 — +2일 정원 11, +5일 정원 12, 그리고 +3일 마감 회차 정원 13), 투어 C(이미지 없음, +4일 마감 회차만), 공개되지 않은 투어 H
- **When** `pnpm e2e`를 실행한다
- **Then** E2E 테스트가 `/tours`에서 다음을 확인한다
  - 응답이 HTTP 200이고 페이지 방문 뒤 E2E 포트 단언이 통과한다
  - O의 카드에 제목, 요약, 소요 시간 표기, 가격 안내 문구, "모집 중" 배지, 가장 가까운 회차(+2일)의 일시 표기, "남은 자리 11 / 11"이 보인다
  - O의 카드 이미지의 `alt`가 준비한 대체 텍스트와 같고, 이미지가 실제로 로드된다(`naturalWidth`가 0보다 큼)
  - C의 카드에 "모집 마감" 배지가 보이고 "남은 자리"가 보이지 않으며, 깨진 이미지 대신 자리표시 블록이 있다
  - 두 배지 모두 상태 글자와 아이콘 요소를 함께 담는다
  - H의 제목이 페이지에 없다
  - O의 카드 링크를 누르면 O의 상세 경로(`/tours/<O의 slug>`)로 이동한다

### AC-TOUR-011 — 투어 상세 `/tours/[slug]`

- **Given** AC-TOUR-010의 투어 O에 지난 회차(−2일, 정원 19)가 하나 더 있고, 공개 투어 E(회차 없음)가 있다
- **When** `pnpm e2e`를 실행한다
- **Then** E2E 테스트가 `/tours/<O의 slug>`에서 다음을 확인한다
  - 응답이 HTTP 200이고 E2E 포트 단언이 통과한다
  - 제목(`h1`), 대체 텍스트가 맞는 대표 이미지, 설명, 소요 시간, 집결 장소, 가격 안내 문구가 보인다. 설명의 빈 줄로 나뉜 두 문단이 서로 다른 문단으로 보인다
  - 회차가 시작 시각 순서대로 "남은 자리 11 / 11"(+2일), "남은 자리 13 / 13"(+3일, 마감), "남은 자리 12 / 12"(+5일) 순으로 나온다
  - 지난 회차의 "/ 19"가 페이지에 없다
  - 마감 회차의 선택 항목은 비활성(`disabled`)이고 "마감" 배지가 있으며, 모집 중 회차의 선택 항목은 눌러서 선택할 수 있고 한 번에 하나만 선택된다
  - 회차 선택 항목은 키보드(화살표 키)로도 옮겨 갈 수 있다
- **And** `/tours/<E의 slug>`에는 예정된 회차가 없다는 안내 문구가 보인다

### AC-TOUR-012 — 없는 투어와 공개되지 않은 투어는 404

- **Given** AC-TOUR-010의 준비 데이터가 있다
- **When** `pnpm e2e`를 실행한다
- **Then** E2E 테스트가 다음을 확인한다
  - `/tours/test-<무작위 값>-missing`의 응답 상태가 404다
  - `/tours/<H의 slug>`의 응답 상태가 404이고, 페이지에 H의 제목이 없다
  - 형식에 맞지 않는 slug(`/tours/Not_A_Slug`)의 응답 상태가 404다

### AC-TOUR-013 — 요청 시점 렌더링과 수정 반영

- **Given** 소스가 준비되어 있다
- **When** `pnpm build`, `pnpm test`, `pnpm e2e`를 차례로 실행한다(`plan.md` §E-1과 같은 순서)
- **Then** `pnpm build` 직후 대상 존재를 먼저 단언한다 — 다음 세 명령의 출력이 모두 `True`다
  - `(Get-Content .next/app-path-routes-manifest.json -Raw | ConvertFrom-Json).PSObject.Properties.Value -contains '/tours'` (목록 경로가 실제로 빌드됨)
  - `(Get-Content .next/app-path-routes-manifest.json -Raw | ConvertFrom-Json).PSObject.Properties.Value -contains '/tours/[slug]'` (상세 경로가 실제로 빌드됨)
  - `(Get-Content .next/prerender-manifest.json -Raw | ConvertFrom-Json).routes.PSObject.Properties.Name -contains '/'` (매니페스트 구조 확인 — 임시 홈은 사전 렌더링됨)
- **And** 이어서 다음 두 명령의 출력이 모두 `False`다
  - `(Get-Content .next/prerender-manifest.json -Raw | ConvertFrom-Json).routes.PSObject.Properties.Name -contains '/tours'` (목록이 사전 렌더링되지 않음 — REQ-TOUR-012 판정)
  - `(Get-Content .next/prerender-manifest.json -Raw | ConvertFrom-Json).dynamicRoutes.PSObject.Properties.Name -contains '/tours/[slug]'` (`generateStaticParams` 회귀 감시. `generateStaticParams`가 없으면 `connection()` 유무와 관계없이 이 값은 `False`이므로, 상세 경로의 요청 시점 렌더링 판정은 아래 저장소 규칙이 맡는다)
- **And** 저장소 규칙 테스트(`pnpm test`)가 `src/app/(frontend)/tours/page.tsx`와 `src/app/(frontend)/tours/[slug]/page.tsx`가 각각 `next/server`의 `connection`을 import하고 호출함을 확인한다
- **And** E2E 테스트가 투어 O의 상세를 연 뒤 로컬 API로 O의 제목을 `test-…-renamed` 값으로 바꾸고 새로고침하면 새 제목이 보이고, `/tours`에도 새 제목이 보인다(테스트는 끝나면 원래 데이터를 지운다)

### AC-TOUR-014 — 토큰 적용 범위, 상태 배지, 375px

- **Given** 소스가 준비되어 있다
- **When** `pnpm test`와 `pnpm e2e`를 실행한다
- **Then** 저장소 규칙 테스트가 다음을 확인한다
  - `src/` 아래 파일 중 고정 문자열 `--color-accent:`를 담은 파일이 1개 이상 있고 모두 `src/app/(frontend)/` 아래에 있다(검사 범위는 AC-INFRA-009와 같은 `src/`. `.moai/project/design/tokens.css`와 SPEC 문서는 대상이 아니다)
  - `src/` 아래 파일 중 그 파일을 import하거나 `@import`하는 파일이 1개 이상 있고 모두 `src/app/(frontend)/` 아래에 있다
  - `src/app/(payload)/` 아래 파일 중 그 파일명을 참조하는 파일이 0건이다
  - 기존 AC-INFRA-009(Tailwind 범위) 규칙이 계속 통과한다
- **And** E2E 테스트가 `/tours`의 O 카드 배지 배경색이 토큰 `--status-open-bg` 값(`rgb(226, 244, 236)`)과 같음을 확인한다
- **And** E2E 테스트가 뷰포트 375×812에서 `/tours`와 `/tours/<O의 slug>`를 열어 `document.documentElement.scrollWidth`가 375 이하이고, 모집 중 회차 선택 영역(라벨 포함)의 높이와 너비가 각각 44px 이상임을 확인한다

### AC-TOUR-015 — 홈 링크

- **Given** E2E 전용 포트가 비어 있다
- **When** `pnpm e2e`를 실행한다
- **Then** 기존 홈 E2E 2건(200 응답·제목·준비 중 문구, 제목 글자 크기 36px)이 그대로 통과한다
- **And** 새 E2E 테스트가 `/`에서 `/tours`를 가리키는 링크를 찾아 누르면 경로가 `/tours`가 되고 E2E 포트 단언이 통과함을 확인한다

## 4. 시드

### AC-TOUR-016 — 개발용 시드 명령

- **Given** 개발 DB에 시드 slug(`hallasan-yeongsil`, `udo-bike`, `haenyeo-experience`)의 투어가 없다(다음 명령 출력 `0`: `docker compose exec -T postgres psql -U <POSTGRES_USER 값> -d <POSTGRES_DB 값> -tAc 'SELECT count(*) FROM tours WHERE slug IN (''hallasan-yeongsil'', ''udo-bike'', ''haenyeo-experience'');'`)
- **When** `pnpm seed *> seed-1.log`를 실행한 뒤 `pnpm seed *> seed-2.log`를 실행한다
- **Then** 두 실행의 종료 코드가 모두 0이다
- **And** `seed-1.log`에 `created 3`, `seed-2.log`에 `created 0`과 `skipped 3`이 나타난다(`Select-String -SimpleMatch`로 각각 1건 이상)
- **And** 위의 개수 조회 명령 출력이 두 실행 뒤 모두 `3`이고, `/tours`에 세 투어가 "모집 중" 배지와 함께 보인다(수동 확인)
- **And** 거부 1 — `$env:NODE_ENV = 'production'; pnpm seed *> seed-prod.log; $LASTEXITCODE; Remove-Item Env:NODE_ENV`의 종료 코드 출력이 0이 아니고, 로그에 `NODE_ENV`가 나타나며, 개수 조회 출력이 바뀌지 않는다
- **And** 거부 2 — `$env:DATABASE_URL = 'postgres://seed:probe-pass-7731@db.example.com:5432/x'; pnpm seed *> seed-remote.log; $LASTEXITCODE; Remove-Item Env:DATABASE_URL`의 종료 코드 출력이 0이 아니고, 로그에 `db.example.com`이 나타나며 `probe-pass-7731`은 0건이다
- **And** `pnpm test`의 단위·통합 테스트가 다음을 확인한다
  - 거부 판정: `NODE_ENV=production` → 거부, 호스트 `localhost`·`127.0.0.1`·IPv6 루프백 → 허용(IPv6는 `postgres://u:p@[::1]:5432/db` 형식으로 시험하며, URL의 호스트 값 `[::1]`의 대괄호를 벗겨 판정한다), 그 밖의 호스트 → 거부, 해석할 수 없는 `DATABASE_URL` → 거부
  - 테스트 데이터 표식을 붙인 데이터 집합으로 시드 로직을 2번 실행하면 두 번째는 전부 건너뛰고 투어·회차 수가 그대로이며, 첫 실행 뒤 관리자가 바꾼 제목이 두 번째 실행 뒤에도 유지된다
- **And** 저장소 규칙 테스트가 `package.json`의 `seed`를 뺀 어떤 스크립트도 `seed`를 호출하지 않고, `postinstall`·`prepare` 스크립트가 없음을 확인한다
- 정리: 로그 파일 삭제. 시드 데이터는 남겨도 된다

## 5. 품질 게이트

| 항목 | 기준 | 검증 명령 |
|---|---|---|
| 타입 | 오류 0건 | `pnpm typecheck` |
| 빌드 | 종료 코드 0, 목록·상세가 사전 렌더링 목록에 없음 | `pnpm build` + AC-TOUR-013 |
| 단위·통합·저장소 규칙 테스트 | 전부 통과 | `pnpm test` |
| 커버리지 | `src/lib/` 합산 라인 85% 이상 | `pnpm test`(임계값 내장) |
| E2E | 기존 4건 + 이 SPEC 전부 통과 | `pnpm e2e` |
| 린트 | 오류 0건, 새 경고 0건 | `pnpm lint` |
| 포맷 | 차이 0건 | `pnpm format:check` |
| 의존성 | 잠금 파일 변경 없음, 새 패키지 없음 | `git diff --stat ff00406 -- pnpm-lock.yaml` 출력 없음 |
| 생성 파일 | 타입·import map이 설정과 일치 | `pnpm generate:types`, `pnpm generate:importmap` 실행 후 `git status --short`에 두 파일 변경이 남지 않음(커밋된 상태와 같음) |

TRUST 5 대응: Tested(AC-TOUR-008·009), Readable(린트), Unified(포맷·생성 파일), Secured(AC-TOUR-005·006·016, SVG 거부), Trackable(Conventional Commits, 커밋 메시지에 `SPEC-TOUR-001`).

## 6. 완료 정의 (Definition of Done)

- [ ] AC-TOUR-001 ~ AC-TOUR-016이 모두 통과했고, 각 명령과 출력 요약이 `progress.md` §E.2에 기록되었다
- [ ] 수동 확인 3건(AC-TOUR-002 관리자 업로드 화면·sharp 경고, AC-TOUR-004 관리자 일시 입력, AC-TOUR-016 `/tours` 시드 결과)이 기록되었다
- [ ] 품질 게이트 표의 모든 명령이 같은 커밋에서 통과했다
- [ ] `.env`, `media/` 아래 파일, 검증 로그, 시드 로그가 커밋에 포함되지 않았다
- [ ] `spec.md` §5 제외 범위 항목(신청, 다국어, 외부 스토리지, sharp, 회원, 대시보드)이 구현에 섞이지 않았다
- [ ] 남은 자리 계산 지점에 `@MX:ANCHOR`와 신청 SPEC 확장 지점 `@MX:NOTE`가, 미디어 읽기 조건에 `@MX:DEBT`(`@MX:CEILING`·`@MX:UPGRADE` 포함)가 있다
