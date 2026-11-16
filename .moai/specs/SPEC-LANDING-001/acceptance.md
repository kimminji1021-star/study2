# SPEC-LANDING-001 수용 기준

> **검증 셸**: Windows PowerShell 5.1에서 그대로 실행되어야 한다. 명령 인자 안에 큰따옴표를 겹쳐 쓰지 않는다. 문자열·구조 검사는 셸 인용에 기대지 않고 테스트 코드(저장소 규칙 테스트 `tests/unit/repo-rules.spec.ts` 포함)나 `Select-String -SimpleMatch '<고정 문자열>'`로 한다.
> **판정**: 별도 표시가 없으면 "통과"는 해당 명령의 종료 코드가 0(`$LASTEXITCODE -eq 0`)임을 뜻한다.
> **빈 결과 방지**: "0건"이나 "없음"을 검사하는 테스트는 같은 검사 안에서 대상이 1건 이상 존재함(또는 검사가 실제로 무언가를 수집했음)을 먼저 단언한다.
> **전제**: SPEC-APPLY-001의 전제와 같다(`.env` 존재, PostgreSQL 컨테이너 `healthy`). `pnpm test`, `pnpm e2e`로 판정하는 기준은 모두 이 상태를 전제로 한다.
> **관리자 계정**: 실제 관리자 계정은 쓰지도 바꾸지도 않는다. 통합 테스트는 파일마다 `admin-<무작위 값>@example.test` 관리자를 만들고 끝나면 지운다. E2E는 준비 단계(`tests/e2e/global-setup.ts`)가 만든 테스트 관리자로만 로그인한다. 이 문서의 "테스트 관리자"는 둘 중 해당하는 계정이다.
> **전역 설정 원래 값**: `home-settings`를 바꾸는 테스트는 시작 직전 세 필드(`heroImage`, `headline`, `intro`) 값을 `depth: 0`으로 읽어(`heroImage`는 미디어 ID) gitignore 대상 파일 `.moai/state/verify/landing/home-settings-original.json`에 남긴 뒤에야 설정을 바꾸고, 끝나면(실패해도) 그 파일의 값으로 되돌린 뒤 다시 읽어 같음을 단언한다. 같음 판정은 저장값과 다시 읽은 값의 세 필드를 각각 `값 ?? null`로 맞춘 뒤 엄격 비교한다 — 저장한 적 없는 전역 설정은 필드가 없고(`undefined`) 되돌린 뒤에는 `null`이므로 둘을 같은 것으로 본다. 시작할 때 이 파일이 이미 있으면(이전 실행이 복원 전에 끊김) 지금 DB 값이 아니라 파일의 값을 원래 값으로 삼아 먼저 되돌린다. 복원 확인이 끝나면 파일을 지운다(`plan.md` §B.11). 아래 각 기준의 "설정을 ~로 바꾼다"는 이 절차 안에서 일어난다.
> **테스트 데이터 표식**: SPEC-TOUR-001·SPEC-APPLY-001과 같다(투어 slug·제목 `test-<무작위 값>…`, 미디어 파일 이름 `test-<무작위 값>-….png`, 신청 이메일 `<표식>…@example.test`). 개발 DB의 실제 투어가 화면에 함께 보여도, 추천 투어 단언은 페이지를 열기 직전 로컬 API로 구한 기대값과 비교한다.
> **시각 기준**: 다가오는 회차는 실행 시각 기준 하루 이상 뒤에 시작한다.
> **뷰포트**: "1440"은 1440×900, "375"는 375×812다. 따로 적지 않으면 1440이다.
> **공개 화면 6개**: `/`, `/tours`, `/tours/<공개 투어 slug>`, `/apply?session=<모집 중 회차 ID>`, `/apply/complete/<접수 번호>`, `/tours/<없는 slug>`(사용자 화면 404). E2E 준비 단계가 표식 투어·회차·신청을 로컬 API(신청은 기존 E2E 신청 도우미)로 만든다.
> **익명 미디어 읽기 판정**: 익명 `find`의 결과에 해당 미디어가 있는지로 본다. 파일 주소는 익명 `GET`의 응답 상태가 200인지(보임) 아닌지(안 보임)로 본다(SPEC-TOUR-001 AC-TOUR-006과 같은 판정).

## 0. 응답과 오류 (영문 고정, `error_messages: en`)

이 SPEC은 새 오류 코드를 만들지 않는다. 판정에 쓰는 Payload 기본 응답은 다음과 같다.

| 경우 | HTTP | 문구 |
|---|---|---|
| 관리자가 아닌 요청의 `home-settings` 수정(REST `POST /api/globals/home-settings`) | 403 | `You are not allowed to perform this action.`(Payload `Forbidden`) |
| GraphQL의 같은 수정 | 200(본문 `errors`) | `errors` 메시지 중 하나가 `You are not allowed to perform this action.` |
| 큰 제목 41자 이상·소개 121자 이상 저장 | 400 | Payload `ValidationError`(필드 `headline` 또는 `intro`). 로컬 API에서는 잡은 오류의 이름이 `ValidationError` |
| 처리하지 않는 주소, `notFound()` | 404 | 사용자 화면 404(`페이지를 찾을 수 없습니다`) |

## 1. 홈 화면 설정

### AC-LANDING-001 — 전역 설정 등록과 길이 검증

- **Given** 소스가 준비되어 있고 테스트 관리자가 있다
- **When** `pnpm test`를 실행한다
- **Then** 통합 테스트가 다음을 확인한다
  - Payload 설정의 전역 설정 slug 목록이 정확히 `['home-settings']`이고 라벨이 `홈 화면 설정`이다
  - Payload가 자동으로 더하는 필드 `id`·`createdAt`·`updatedAt`을 뺀 데이터 필드 이름 목록(정렬 후)이 정확히 `['headline', 'heroImage', 'intro']`이다. `heroImage`는 `type`이 `upload`, `relationTo`가 `media`이고 필수가 아니다. `headline`의 `maxLength`는 40, `intro`는 120이다
  - 필드 이름 목록에 `name`, `email`, `phone`, `requests`가 없다
  - 관리자가 큰 제목 40자(`가` 40개)를 저장하면 성공하고, 41자를 저장하면 오류 이름이 `ValidationError`이며 다시 읽은 큰 제목이 40자 값 그대로다
  - 소개 120자는 성공, 121자는 `ValidationError`이고 값이 그대로다
- **And** 테스트가 끝나면 전역 설정 원래 값으로 되돌아가 있다

### AC-LANDING-002 — 전역 설정 접근 규칙과 관리자 편집

- **Given** 테스트 관리자와 전역 설정 원래 값 저장이 끝났다
- **When** `pnpm test`와 `pnpm e2e`를 실행한다
- **Then** 통합 테스트가 다음을 확인한다
  - 익명(`overrideAccess: false`, 사용자 없음)의 `findGlobal`이 오류 없이 끝난다
  - 익명의 `updateGlobal`(`overrideAccess: false`, 큰 제목 `<표식>-익명`)은 권한 오류이고 다시 읽은 큰 제목이 그대로다
  - 테스트 관리자의 `updateGlobal`(`user`, `overrideAccess: false`, 큰 제목 `<표식>-관리자`)은 성공하고 다시 읽은 값이 `<표식>-관리자`다
- **And** E2E가 Playwright 요청 API로 다음을 확인한다(관리자는 `POST /api/users/login`으로 받은 토큰을 `Authorization: JWT <토큰>`으로 보냄)
  - 익명 `GET /api/globals/home-settings` → 200
  - 익명 `POST /api/globals/home-settings` 본문 `{"headline":"<표식>-익명"}` → 정확히 403, 이어서 읽은 큰 제목이 그대로
  - 관리자 같은 `POST`(본문 `{"headline":"<표식>-관리자"}`) → 200
  - GraphQL: 익명의 `updateHomeSetting`(큰 제목 변경) 요청 → `errors` 메시지 중 하나가 `You are not allowed to perform this action.`이고 큰 제목이 그대로다
- **And** E2E가 테스트 관리자로 로그인해 관리자 화면 메뉴에 `홈 화면 설정` 링크가 있음을 확인하고, `/admin/globals/home-settings`에서 큰 제목 입력란에 `<표식>-화면편집`을 넣어 저장하면 저장 성공 알림이 보이며, 새 익명 브라우저 컨텍스트로 연 `/`의 `h1` 텍스트가 정확히 `<표식>-화면편집`이다
- **And** (수동) 사용자가 관리자 화면 `홈 화면 설정`에서 사진을 직접 올려 대표 사진으로 고르고 저장하면 `/` 히어로에 그 사진이 보이고, 대표 사진을 비우고 저장하면 짙은 히어로로 돌아옴을 확인한다(코드 변경·다시 빌드 없음). 결과를 `progress.md` §E.2에 기록한다

### AC-LANDING-003 — 미디어 익명 읽기 범위

- **Given** 통합·E2E 준비 단계가 표식 미디어 h(어느 투어도 참조하지 않음), 공개 투어 A(대표 이미지 a), 어느 투어도 참조하지 않는 미디어 c를 만들고 전역 설정 원래 값을 저장했다
- **When** `pnpm test`와 `pnpm e2e`를 실행한다
- **Then** 통합 테스트가 익명 `find`(`media`, `overrideAccess: false`)로 다음을 차례로 확인한다
  1. 설정의 대표 사진을 비운 상태: 결과에 a가 있고, h와 c가 없다
  2. 설정의 대표 사진을 h로 바꾼 뒤: 결과에 h와 a가 있고 c가 없다
  3. 대표 사진을 다시 비운 뒤: h가 없고 a는 있다
  4. 대표 사진을 a로 바꿨다가 비운 뒤: a가 여전히 있다(공개 투어가 참조)
- **And** E2E가 설정의 대표 사진을 h로 바꾼 상태에서 익명 `GET <h의 url>`이 200이고 `content-type`이 `image/png`임을, 대표 사진을 비운 뒤 같은 요청이 200이 아님을 확인한다
- **And** SPEC-TOUR-001 AC-TOUR-006(익명 미디어 읽기는 공개 투어 대표 이미지만 — 홈 대표 사진이 비어 있는 상태 기준)이 계속 통과한다

## 2. 히어로

### AC-LANDING-004 — 큰 제목·소개와 기본 문구

- **Given** 소스가 준비되어 있다
- **When** `pnpm test`와 `pnpm e2e`를 실행한다
- **Then** 단위 테스트가 문구 결정 함수에 대해 다음을 확인한다: `undefined`·`null`·`''`·`'   '` → 기본 문구, `'  값  '` → `'값'`, `'<b>굵게</b>'` → `'<b>굵게</b>'`(문자열 그대로). 큰 제목 기본 문구는 정확히 `제주를 가장 가까이, 숨비투어`, 소개 기본 문구는 정확히 `제주의 소규모 투어와 다가오는 회차를 한눈에 확인하세요.`다
- **And** E2E가 다음을 확인한다
  - 설정의 큰 제목과 소개를 비운 상태에서 `/`의 응답이 200이고, 히어로(`h1`을 담은 `section`) 안에 `h1`(텍스트 정확히 큰 제목 기본 문구) → 소개(텍스트 정확히 소개 기본 문구) → `투어 둘러보기` 링크가 문서 순서대로 있다
  - `투어 둘러보기`의 `href`가 `/tours`이고, 누르면 `/tours`로 이동한다
  - 설정의 큰 제목을 `<표식> <b>굵게</b>`, 소개를 `  <표식>-소개  `로 바꾸면 `h1` 텍스트가 정확히 `<표식> <b>굵게</b>`이고 `h1` 안의 `b` 요소가 0개이며, 소개 텍스트가 정확히 `<표식>-소개`다
  - 홈 화면 어디에도 `서비스를 준비 중입니다`가 없다(임시 홈 대체)

### AC-LANDING-005 — 대표 사진이 있을 때와 없을 때

- **Given** 표식 미디어 h(순백 1×1 PNG, 대체 텍스트 `<표식>-대표 사진`)가 있고 전역 설정 원래 값 저장이 끝났다
- **When** `pnpm test`와 `pnpm e2e`를 실행한다
- **Then** E2E가 다음을 확인한다
  - (a) 대표 사진을 h로 설정했다가 비운 상태(h는 남아 있음): `/` 응답 200, 히어로 안 `img` 요소 0개, 히어로의 계산된 `background-color`가 `rgb(39, 39, 41)`, `<head>` 안 `link[rel=preload][as=image]` 요소 0개, 페이지를 여는 동안 경로에 h의 파일 이름이 든 요청 0건. 판정은 히어로에 한정한다 — 추천 투어 카드의 투어 대표 이미지는 같은 `/api/media/file/` 경로로 요청되어도 된다(카드 이미지는 `priority`를 넘기지 않아 미리 받기 링크를 만들지 않음 — `src/components/TourCard.tsx` 17행)
  - (b) 대표 사진을 h로 바꾼 상태: 히어로 안 `img` 요소 정확히 1개, 그 `alt`가 정확히 `<표식>-대표 사진`, 그 이미지 요청의 응답이 200, `naturalWidth`가 0보다 크다
  - (c) 대표 사진을 h로 바꾼 뒤 로컬 API로 h를 삭제한 상태: `/` 응답 200, 히어로 안 `img` 요소 0개
- **And** 통합 테스트가 다음을 확인한다
  - (c) 대표 사진을 h로 바꾼 뒤 h를 삭제하면 다시 읽은 설정의 `heroImage`가 비어 있고(외래 키 `ON DELETE SET NULL`), 홈 화면 데이터 함수의 대표 사진 값이 `null`이다
  - (d) 대표 사진 값이 채워지지 않은 ID(숫자)이거나 `url`이 없는 문서이면 대표 사진 변환 결과가 `null`이다(단위 또는 통합)

### AC-LANDING-006 — 짙은 히어로의 대비

- **Given** 소스가 준비되어 있다
- **When** `pnpm test`와 `pnpm e2e`를 실행한다
- **Then** 단위 테스트가 `src/app/(frontend)/tokens.css`에서 `--on-dark`, `--surface-dark`, `--overlay-photo`, `--color-text`, `--color-surface`, `--color-accent` 값을 읽어 WCAG 2.x 공식으로 계산한 대비가 다음과 같음을 확인한다(값을 읽어 오지 못하면 실패). 덮개를 `#FFFFFF` 위에 겹친 색은 `spec.md` §2.5 "덮개 합성" 규칙대로 채널마다 `α × 덮개 + (1 − α) × 255`의 실수값을 쓰고 정수로 반올림하지 않는다(`rgba(29, 29, 31, 0.65)` → `rgb(108.1, 108.1, 109.4)`). 마지막 대비 값만 소수 둘째 자리에서 반올림한다
  - `--on-dark` / `--surface-dark` = 14.91
  - `--on-dark` / (`--overlay-photo`를 `#FFFFFF` 위에 겹친 색, 반올림하지 않음) = 5.24, 그리고 4.5 이상
  - `--color-text` / `#FFFFFF` = 16.83, `--color-text` / `--color-surface` = 15.46
  - `#FFFFFF` / (`--overlay-photo`를 `#FFFFFF` 위에 겹친 색, 반올림하지 않음) = 5.24, 그리고 3 이상(버튼 경계·포커스 외곽선)
  - `--color-accent` / `--surface-dark` = 2.65, 그리고 3 미만(히어로에서 쓰지 않는 근거)
- **And** E2E가 대표 사진을 h(순백)로 바꾼 상태의 `/`에서 다음을 확인한다
  - 덮개 요소의 계산된 `background-color`가 `rgba(29, 29, 31, 0.65)`다
  - `h1`과 소개의 계산된 `color`가 `rgb(255, 255, 255)`다
  - `투어 둘러보기`의 계산된 `background-color`가 `rgb(255, 255, 255)`, `color`가 `rgb(29, 29, 31)`이다
  - 키보드 Tab으로 `투어 둘러보기`에 포커스를 주면 계산된 `outline-style`이 `solid`, `outline-color`가 `rgb(255, 255, 255)`, `outline-width`가 2px 이상이다
  - 히어로 안 모든 요소의 계산된 `color`·`background-color`·`border-color`·`outline-color` 어디에도 `rgb(0, 115, 122)`가 없다(검사한 요소가 3개 이상임을 먼저 단언)

## 3. 추천 투어

### AC-LANDING-007 — 추천 투어 6개와 빈 목록

- **Given** 통합 준비 단계가 표식 공개 투어 7개(각각 모집 중 회차 1개, 서로 다른 시작 시각)와 표식 비공개 투어 1개(모집 중 회차 1개)를 만들었다
- **When** `pnpm test`와 `pnpm e2e`를 실행한다
- **Then** 단위 테스트가 추천 자르기 함수에 대해 입력 0·3·6·8개 → 출력 0·3·6·6개, 출력이 입력의 앞부분과 순서가 같고 입력 배열이 바뀌지 않음을 확인한다
- **And** 통합 테스트가 같은 `now`로 다음을 확인한다
  - 홈 화면 데이터 함수의 추천 투어 ID 목록이 `listPublishedTours`(같은 `now`) 결과의 앞 6개 ID 목록과 정확히 같다(결과가 6개임 — 표식 공개 투어만으로 7개 이상)
  - 추천 투어 각 항목의 `nearestSession.availability`가 `listPublishedTours` 결과의 같은 투어 값과 같다
  - 비공개 표식 투어의 ID가 결과에 없다
  - 추천 투어 영역 구성 요소를 투어 0개로 `renderToStaticMarkup`하면 결과에 `지금은 공개된 투어가 없습니다.`와 `href="/tours"`가 있고 `<article`이 없다(그릴 수 없으면 `plan.md` §G R14의 대안으로 검증하고 §E.2에 기록)
- **And** E2E가 `/`를 열기 직전 로컬 API로 `listPublishedTours`를 구해 기대 목록(앞 6개)을 정하고 다음을 확인한다
  - `추천 투어` 제목(`h2`)을 가진 영역의 카드 수가 `min(6, 기대 목록 길이)`이고, 카드 제목이 기대 목록의 제목과 순서까지 같다
  - 각 카드의 가장 가까운 회차·남은 자리 문구가 `/tours`의 같은 투어 카드 문구와 같다
  - 영역 아래 `투어 전체 보기` 링크의 `href`가 `/tours`다
  - 비공개 표식 투어의 제목이 페이지에 없다
  - 홈 화면에 `h2`는 `추천 투어` 하나뿐이다(소개·이용 방법 영역 없음)

### AC-LANDING-008 — 홈 화면 데이터의 질의 수

- **Given** 통합 준비 단계가 표식 공개 투어 Q(대표 이미지와 모집 중 회차 1개)를 만들었다
- **When** `pnpm test`를 실행한다
- **Then** 홈 화면 데이터 함수 한 번이 실행되는 동안 `payload.db.pool.query` 호출 수를 센다. 이어서 표식 공개 투어 5개(각각 대표 이미지, 회차 2개, 회차마다 대기 신청 1건)를 더한 뒤 다시 센다. 두 수가 같고 1 이상이다
- **And** 같은 두 측정 구간마다 `payload.db.pool.connect` 호출 수가 `query` 호출 수와 같다(트랜잭션 등 직접 연결로 나간 질의 없음 — SPEC-ADMIN-001 AC-ADMIN-012와 같은 판정)
- **And** 같은 테스트가 홈 화면 데이터 함수 한 번이 실행되는 동안의 `payload.findGlobal` 호출을 감시해, `slug`가 `home-settings`이고 `req` 인자가 없는 호출이 정확히 1회이며 그 호출의 `overrideAccess`가 `false`이고 `user`가 없음을 확인한다. 그 밖의 `findGlobal` 호출(대표 사진·투어 대표 이미지를 채울 때 `mediaReadAccess`가 `req`를 넘겨 부르는 접근 규칙 내부 호출 — `plan.md` §B.2)은 허용하며 개수를 단언하지 않는다

## 4. 공통 머리글·바닥글·404

### AC-LANDING-009 — 공통 머리글

- **Given** E2E 준비 단계가 공개 화면 6개에 필요한 표식 데이터를 만들었다
- **When** `pnpm e2e`를 실행한다
- **Then** 공개 화면 6개 각각에서 다음을 확인한다
  - `banner` 역할 요소가 정확히 1개이고, 그 안의 링크가 정확히 2개다: 이름 `숨비투어`·`href` `/`, 이름 `투어`·`href` `/tours`
  - 머리글 안에 `h1`~`h6` 요소, `button` 요소, 고정 문자열 `로그인`·`회원가입`·`English`가 없다
- **And** `/tours`에서 `숨비투어`를 누르면 `/`로, `/`에서 머리글의 `투어`를 누르면 `/tours`로 이동한다
- **And** `/admin`(로그인 화면)에는 텍스트가 `숨비투어`이고 `href`가 `/`인 링크가 없다

### AC-LANDING-010 — 바닥글과 처리방침 자리표시

- **Given** AC-LANDING-009와 같다
- **When** `pnpm e2e`를 실행한다
- **Then** 공개 화면 6개 각각에서 다음을 확인한다
  - `contentinfo` 역할 요소가 정확히 1개이고, 그 텍스트에 `© 숨비투어`와 `개인정보 처리방침(준비 중)`이 있다
  - 바닥글 안의 링크(`a` 요소)가 0개다
  - 페이지 전체에서 `href`가 `#`이거나 빈 문자열이거나 없는 `a` 요소가 0개다(페이지의 `a` 요소가 1개 이상임을 먼저 단언)

### AC-LANDING-011 — 처리하지 않는 주소의 404

- **Given** 소스가 준비되어 있다
- **When** `pnpm e2e`를 실행한다
- **Then** `/no-such-page`와 `/a/b/c` 각각의 응답이 404이고, `h1` 텍스트가 `페이지를 찾을 수 없습니다`이며, `banner`와 `contentinfo`가 각각 1개다
- **And** `/tours/<없는 slug>`의 응답도 404이고 같은 머리글·바닥글이 있다(SPEC-TOUR-001 AC-TOUR-012 유지)
- **And** `/admin`은 응답이 200이고 Payload 로그인 화면(이메일 입력란)이 보이며 사용자 화면 머리글이 없다. 익명 `GET /api/tours?limit=1` 응답이 200이고 `content-type`에 `application/json`이 있다
- **And** 기존 관리자 E2E(`admin.spec.ts`, `admin-ops.spec.ts`, `admin-dashboard.spec.ts`, `participants-csv.spec.ts`)가 모두 통과한다

## 5. 글꼴과 디자인

### AC-LANDING-012 — Pretendard 직접 호스팅

- **Given** 소스가 준비되어 있다
- **When** `pnpm test`와 `pnpm e2e`를 실행한다
- **Then** 저장소 규칙 테스트가 다음을 확인한다
  - `src/app/(frontend)/fonts/PretendardVariable.woff2`가 있고 크기가 정확히 2,057,688바이트이며 SHA-256이 M2에서 공식 v1.3.9 파일로 기록한 값(`progress.md` §E.2)과 같다
  - 같은 디렉터리의 `OFL.txt`에 `SIL OPEN FONT LICENSE Version 1.1`과 `Copyright (c) 2021, Kil Hyung-jin`이 있다
  - `src/` 아래에서 `next/font/local`을 import하는 파일이 1개 이상이고 모두 `src/app/(frontend)/` 아래에 있다
  - `src/app/(payload)/` 아래 파일은 `PretendardVariable`을 참조하지 않는다
  - `package.json`의 의존성 이름에 `pretendard`가 없다
- **And** E2E가 `/`를 열어 다음을 확인한다
  - `font` 종류 요청이 1개 이상이고 모두 E2E 서버와 같은 출처이며 경로가 `/_next/static/media/`로 시작한다
  - 페이지를 여는 동안 E2E 서버가 아닌 출처로 나간 요청이 0건이다
  - `document.fonts.ready` 뒤, `body`의 계산된 `font-family` 첫 이름을 가진 `FontFace`가 `document.fonts`에 있고 상태가 `loaded`다
  - `body`의 계산된 `font-family`에 `"Pretendard Variable"`이 있고 마지막 이름이 `sans-serif`다(기존 대체 글꼴 유지)
- **And** E2E가 `/admin`을 열면 경로에 `/_next/static/media/`가 든 `font` 종류 요청 중 공개 화면에서 받은 Pretendard 파일과 같은 경로가 0건이다

### AC-LANDING-013 — 디자인 값과 375px 화면

- **Given** E2E 준비 단계가 표식 공개 투어(모집 중 회차)를 만들었고 설정의 대표 사진이 비어 있다
- **When** `pnpm e2e`를 실행한다
- **Then** 1440에서 `/`의 다음 계산값을 확인한다
  - `body`의 `font-size`가 `17px`, `line-height`가 `24.99px`
  - 히어로 `h1`의 `font-weight`가 `600`이고 `letter-spacing`이 0보다 작다
  - `투어 둘러보기`와 `투어 전체 보기`의 `border-top-left-radius`가 `9999px`이고 `box-shadow`가 `none`이다
  - 추천 투어 카드(`article`)의 `box-shadow`가 `none`이다(카드 1개 이상)
  - 히어로 `background-color` `rgb(39, 39, 41)`, 추천 투어 영역 `rgb(255, 255, 255)`, 바닥글 `rgb(245, 245, 247)`
- **And** 375에서 다음을 확인한다
  - `/`의 `body` `font-size`가 `16px`
  - `/`, `/tours`, `/tours/<공개 투어 slug>` 각각에서 `document.documentElement.scrollWidth`가 375 이하다
  - `/`의 머리글 링크 2개, `투어 둘러보기`, `투어 전체 보기`의 경계 상자가 각각 너비·높이 44 이상이다
- **And** (수동) 사용자가 AC-LANDING-016의 1440·375 스크린숏과 실제 화면을 보고 2026-11-16 디자인 방향(거의 검은 글자, 좁은 자간의 제목, 알약 버튼, 카드 그림자 없음, 면의 바뀜)과 맞음을 확인한다. 결과를 `progress.md` §E.2에 기록한다

## 6. 접근성과 렌더링

### AC-LANDING-014 — 랜드마크, 본문 바로가기, 제목 단계, 움직임

- **Given** AC-LANDING-009와 같다
- **When** `pnpm e2e`를 실행한다
- **Then** 공개 화면 6개 각각에서 `banner`·`main`·`contentinfo` 역할 요소와 `h1` 요소가 각각 정확히 1개이고 `html`의 `lang`이 `ko`다
- **And** `/`와 `/tours`에서 페이지를 연 뒤 첫 Tab의 포커스 요소가 이름 `본문 바로가기`인 링크이고, 그 경계 상자가 너비·높이 0보다 크며 뷰포트 안에 있다. Enter를 누른 뒤 다음 Tab의 포커스 요소가 `main` 안에 있고 `main` 안의 첫 포커스 가능한 요소와 같다(`/`에서는 `투어 둘러보기`)
- **And** `/`에서 `추천 투어`는 `h2`이고 카드 제목 `h3`의 수가 카드 수와 같다. `/tours`의 카드 제목은 계속 `h2`다
- **And** `/`에서 기본 설정과 `reducedMotion: 'reduce'` 두 경우 모두 모든 요소의 계산된 `animation-name`이 `none`이고, `video`·`marquee` 요소가 0개다
- **And** `reducedMotion: 'reduce'`에서 `/`와 `/tours`의 모든 요소의 계산된 `transition-duration` 값(쉼표로 나뉜 각 값)이 0.01초 이하다(검사한 요소 중 기본 설정에서 0보다 큰 값을 가진 요소가 1개 이상임을 먼저 단언)

### AC-LANDING-015 — 요청 시점 렌더링과 설정 반영

- **Given** 소스가 준비되어 있다
- **When** `pnpm build`, `pnpm test`, `pnpm e2e`를 차례로 실행한다(`plan.md` §E-1과 같은 순서)
- **Then** `pnpm build` 직후 대상 존재를 먼저 단언한다 — 다음 명령의 출력이 `True`다
  - `(Get-Content .next/app-path-routes-manifest.json -Raw | ConvertFrom-Json).PSObject.Properties.Value -contains '/'`
- **And** 이어서 다음 두 명령의 출력이 모두 `False`다
  - `(Get-Content .next/prerender-manifest.json -Raw | ConvertFrom-Json).routes.PSObject.Properties.Name -contains '/'` (홈이 사전 렌더링되지 않음 — SPEC-TOUR-001 AC-TOUR-013의 "`/`가 사전 렌더링됨" 구조 단언을 대체)
  - `(Get-Content .next/prerender-manifest.json -Raw | ConvertFrom-Json).routes.PSObject.Properties.Name -contains '/tours'` (SPEC-TOUR-001 유지)
- **And** 저장소 규칙 테스트(`pnpm test`)가 `src/app/(frontend)/page.tsx`가 `next/server`의 `connection`을 import하고 `await`로 호출하며 `generateStaticParams`를 내보내지 않음을 확인한다(기존 `tours`·`apply` 화면 규칙 유지)
- **And** E2E가 `/`를 연 뒤 로컬 API로 설정의 큰 제목을 `<표식>-갱신`으로 바꾸고 새로고침하면 `h1` 텍스트가 정확히 `<표식>-갱신`이다

## 7. 테스트 체계

### AC-LANDING-016 — 테스트 체계, 스크린숏, 정리

- **Given** PostgreSQL이 `healthy`이고 E2E 전용 포트가 비어 있다
- **When** `pnpm test`를 실행한 뒤 `pnpm e2e`를 실행한다
- **Then** 둘 다 종료 코드 0이고, 기존 테스트와 이 SPEC의 테스트를 모두 통과로 보고한다(기존 단언 중 이 SPEC이 대체한 것 — 임시 홈 문구와 `h1` 36px, 홈의 `/tours` 링크 1개 — 은 새 기준으로 바뀐 상태)
- **And** 커버리지 보고서의 `src/lib/` 합산 라인 커버리지가 85% 이상이다
- **And** `pnpm e2e`가 끝난 뒤 `.moai/state/verify/landing/` 아래에 다음 파일이 각각 있고 크기가 0보다 크다: `home-dark-1440.png`, `home-dark-375.png`, `home-photo-1440.png`, `home-photo-375.png`, `tours-1440.png`, `tours-375.png`, `tour-detail-1440.png`, `tour-detail-375.png`, `not-found-1440.png`, `not-found-375.png`(홈은 전체 페이지)
- **And** 전역 설정을 바꾼 각 테스트 파일이 끝날 때 다시 읽은(`depth: 0`) 세 필드가 시작 전 값과 같다는 단언이 통과한다 — 두 쪽 모두 `값 ?? null`로 맞추고 `heroImage`는 미디어 ID로 비교한다(머리말 "전역 설정 원래 값")
- **And** 두 명령이 끝난 뒤 `.moai/state/verify/landing/home-settings-original.json`이 남아 있지 않다(`Test-Path`의 출력이 `False` — 복원 확인 뒤 지워짐)
- **And** 두 명령이 끝난 뒤 다음 명령의 출력이 각각 `0`이다
  - `docker compose exec -T postgres psql -U <POSTGRES_USER 값> -d <POSTGRES_DB 값> -tAc 'SELECT count(*) FROM tours WHERE slug LIKE ''test-%'';'`
  - `docker compose exec -T postgres psql -U <POSTGRES_USER 값> -d <POSTGRES_DB 값> -tAc 'SELECT count(*) FROM media WHERE filename LIKE ''test-%'';'`
  - `docker compose exec -T postgres psql -U <POSTGRES_USER 값> -d <POSTGRES_DB 값> -tAc 'SELECT count(*) FROM applications WHERE email LIKE ''%example.test'';'`
  - `docker compose exec -T postgres psql -U <POSTGRES_USER 값> -d <POSTGRES_DB 값> -tAc 'SELECT count(*) FROM users WHERE email LIKE ''%@example.test'';'`
  - `docker compose exec -T postgres psql -U <POSTGRES_USER 값> -d <POSTGRES_DB 값> -tAc 'SELECT count(*) FROM home_settings WHERE headline LIKE ''%test-%'' OR intro LIKE ''%test-%'';'` (테이블·열 이름은 M1에서 확인한 실제 이름 — `plan.md` §B.1. 이름이 다르면 run 단계가 차단자로 보고하고 이 줄을 고친다)
- **And** 기존 SPEC-APPLY-001 데이터 정리 기준(AC-APPLY-016)과 SPEC-TOUR-001 기준(AC-TOUR-009)이 계속 통과한다

## 8. 품질 게이트

| 항목 | 기준 | 검증 명령 |
|---|---|---|
| 타입 | 오류 0건 | `pnpm typecheck` |
| 빌드 | 종료 코드 0, `/`가 사전 렌더링 목록에 없음 | `pnpm build` + AC-LANDING-015 |
| 단위·통합·저장소 규칙 테스트 | 전부 통과 | `pnpm test` |
| 커버리지 | `src/lib/` 합산 라인 85% 이상 | `pnpm test`(임계값 내장) |
| E2E | 기존 + 이 SPEC 전부 통과, 스크린숏 10개 생성 | `pnpm e2e` |
| 린트 | 오류 0건, 새 경고 0건 | `pnpm lint` |
| 포맷 | 차이 0건 | `pnpm format:check` |
| 의존성 | 잠금 파일·`package.json` 변경 없음, 새 패키지 없음 | `git diff --stat b8087f8 -- pnpm-lock.yaml package.json` 출력 없음 |
| 보존 | 점유 인원·단일 계산 지점·정렬·사이트 접수 불변 | `git diff --stat b8087f8 -- src/lib/occupancy.ts src/lib/session-availability.ts src/lib/catalog-order.ts src/lib/submit-application.ts` 출력 없음 |
| 생성 파일 | 타입이 설정과 일치 | `pnpm generate:types` 실행 후 `git status --short`에 `src/payload-types.ts` 변경이 남지 않음 |
| 글꼴 | 공식 원본 그대로 | AC-LANDING-012 저장소 규칙(크기·SHA-256) |

TRUST 5 대응: Tested(AC-LANDING-001~016, 실제 DB 통합 테스트와 1440·375 E2E), Readable(린트), Unified(포맷·생성 파일), Secured(AC-LANDING-002·003·008·010 — 설정 수정 권한, 미디어 공개 범위, 익명 조회 고정, 죽은 링크 없음, 외부 요청 없음), Trackable(Conventional Commits, 커밋 메시지에 `SPEC-LANDING-001`).

## 9. 완료 정의 (Definition of Done)

- [ ] AC-LANDING-001 ~ AC-LANDING-016이 모두 통과했고, 각 명령과 출력 요약이 `progress.md` §E.2에 기록되었다
- [ ] 수동 확인 2건(AC-LANDING-002 관리자 화면에서 사진 올리기·비우기, AC-LANDING-013 1440·375 디자인 확인)이 기록되었다
- [ ] 품질 게이트 표의 모든 명령이 같은 커밋에서 통과했다
- [ ] 글꼴 파일의 출처 주소·크기·SHA-256과 `next/font/local` 설정값(무게 범위 포함)이 `progress.md` §E.2에 기록되었다
- [ ] 전역 설정 원래 값이 테스트 전후로 같다(`값 ?? null` 비교, §E.2에 전후 값 기록 — 개인정보 아님)
- [ ] `.env`, `media/` 아래 파일, 검증 로그·스크린숏이 커밋에 포함되지 않았다
- [ ] 실제 관리자 계정이 테스트에 쓰이지 않았다(테스트 코드에 `@example.test` 외 관리자 이메일 없음)
- [ ] `spec.md` §5 제외 범위 항목(회원, 다국어, 이메일, 배포, 처리방침 본문, 사업자 정보, 투어 순서 지정, 애니메이션, 캔버스 갱신)이 구현에 섞이지 않았다
- [ ] 홈 데이터·미디어 공개 규칙에 `@MX:DEBT`(`@MX:CEILING`·`@MX:UPGRADE` 포함), 모든 경로 받기 페이지·글꼴 불러오기·히어로 덮개에 `@MX:NOTE`가 있다
- [ ] 출시 전 점검 이월 항목(바닥글 처리방침 링크 연결, 운영 대표 사진 크기·최적화)이 `progress.md`에 옮겨 적혔다
