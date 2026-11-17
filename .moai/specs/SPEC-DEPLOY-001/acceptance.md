# SPEC-DEPLOY-001 수용 기준

> **검증 셸**: Windows PowerShell 5.1에서 그대로 실행되어야 한다. 명령 인자 안에 큰따옴표를 겹쳐 쓰지 않는다. 문자열·구조 검사는 테스트 코드나 `Select-String -SimpleMatch '<고정 문자열>'`로 한다.
> **판정**: 별도 표시가 없으면 "통과"는 해당 명령의 종료 코드가 0(`$LASTEXITCODE -eq 0`)임을 뜻한다.
> **빈 결과 방지**: "0건"이나 "없음"을 검사하는 테스트는 같은 검사 안에서 대상이 1건 이상 존재함(또는 검사가 실제로 무언가를 수집했음)을 먼저 단언한다.
> **전제**: 앞선 SPEC과 같다(`.env` 존재, `DATABASE_URL`은 루프백 DB, PostgreSQL 컨테이너 `healthy`). `pnpm test`, `pnpm e2e`로 판정하는 기준은 이 상태를 전제로 한다.
> **비밀값**: 테스트·명령·로그·커밋 어디에도 실제 비밀값을 쓰지 않는다. 시험용 값은 테스트가 실행 중에 만드는 무작위 값이거나 `test-` 접두어가 붙은 가짜 값이다. 원격 주소 예시는 실제로 연결되지 않는 `db.example.invalid`를 쓴다.
> **관리자 계정**: 실제 관리자 계정은 쓰지도 바꾸지도 않는다. 통합 테스트는 필요하면 `admin-<무작위 값>@example.test` 관리자를 만들고 끝나면 지운다.
> **테스트 데이터 표식**: 신청 시도 기록은 `keyHash`가 `test-`로 시작, 작업 기록은 테스트가 만든 표식 회차 ID, 그 밖은 앞선 SPEC과 같다(`test-<무작위 값>…`, `…@example.test`).
> **시각**: 정리 통합 시험은 실행 시점의 실제 현재 시각만 쓴다(미래 시각 금지 — `plan.md` §B.11).
> **수동 확인**: "(수동)" 표시는 사용자가 비공개 미리보기에서 `plan.md` §I.4 절차로 수행하고, 오케스트레이터가 결과를 `progress.md` §E.2에 기록한다.

## 0. 응답과 오류 (영문 고정, `error_messages: en`)

| 경우 | 결과 | 문구·내용 |
|---|---|---|
| 정리 엔드포인트, `Authorization` 없음·틀림·서버에 `CRON_SECRET` 없음 | HTTP 401 | 본문 `Unauthorized`(고정), 아무것도 지우지 않음 |
| 정리 엔드포인트, `GET` 외 메서드 | HTTP 405 | 고정 문구, `Allow: GET` |
| 정리 엔드포인트, 인증 통과 | HTTP 200 | `{"attemptsDeleted": <정수>, "auditLogsDeleted": <정수>}`, `Cache-Control: no-store` |
| 정리 중 DB 오류 | HTTP 500 | 원인 없는 고정 문구(질의 값 없음) |
| 운영 빌드의 운영 변수 누락·형식 오류 | 종료 코드 ≠ 0 | `[preflight] Missing or invalid production environment variables: <이름, …>.`(형태 예시 — 이름만, 값 없음) |
| 원격 DB로 `dev`·`test`·`e2e` 시작, 또는 Vitest·Playwright 직접 실행 | 종료 코드 ≠ 0 | `[preflight] Only a loopback database is allowed for this command (host: <호스트>).`(형태 예시 — 호스트 이름이 든 영문 거부 문구) |
| 원격 DB로 `seed` 시작 | 종료 코드 ≠ 0 | 기존 `assertSeedAllowed` 문구 그대로(`Refusing to seed: database host "<호스트>" is not local …`) |
| 원격 DB인데 `DATABASE_CA_CERT` 없음·형식 오류(운영 여부 무관) | 연결 전 중단 | 변수 이름 `DATABASE_CA_CERT`만, 연결 문자열·값 없음 |
| `migrate:check`에서 새 마이그레이션 파일이 생김 | 종료 코드 ≠ 0 | 생긴 파일 이름(새 파일은 지워지고 `index.ts`는 실행 전 내용으로 되돌린 상태 — 실행 뒤 `git status --short src/migrations` 출력 없음) |
| Vercel 빌드 스크립트를 운영이 아닌 환경에서 실행 | 종료 코드 ≠ 0 | 운영이 아니라 거부한다는 영문 문구, 마이그레이션 미실행 |
| S3 변수 일부만 설정 | 시작 중단 | 빠진 변수 이름만 |

정확한 문구는 run 단계가 정하고 `progress.md` §E.2에 적는다. 판정은 "변수 이름·호스트가 들어 있고 값이 들어 있지 않음"으로 한다.

## 1. 운영 설정과 DB 보호

### AC-DEPLOY-001 — 운영 빌드의 필수 설정 점검

- **Given** 소스가 준비되어 있다
- **When** `pnpm test`를 실행한다
- **Then** 단위 테스트가 운영 변수 점검 함수에 대해 다음을 확인한다
  - 모든 변수가 올바르면 문제 목록이 비어 있다
  - `NEXT_PUBLIC_SERVER_URL`·`CRON_SECRET`·`DATABASE_CA_CERT`·S3 다섯 변수를 각각 하나씩 빼면 그 이름 하나만 목록에 있다
  - 형식 오류: `http://…`, 끝 빗금, 경로 있는 주소 / 15자·특수문자·공백 포함 `CRON_SECRET` / `BEGIN CERTIFICATE`가 없는 인증서 / `sslmode=` 또는 `sslrootcert=`가 든 `DATABASE_URL` — 각각 해당 이름이 목록에 있다
  - 출력 문구에 어떤 시험 값(각 값에 넣은 표식 문자열)도 들어 있지 않다
- **And** 통합 테스트가 자식 프로세스로 시작 전 점검을 실행해 다음을 확인한다
  - `VERCEL_ENV=production`과 운영 변수 하나가 빠진 가짜 환경으로 `build` 단계 → 종료 코드 ≠ 0, 출력에 그 변수 이름이 있고 시험 값 표식은 없다
  - 같은 가짜 환경에서 `VERCEL_ENV`만 없애면 운영 점검이 실행되지 않는다(출력에 운영 변수 문구 없음)
- **And** 기존 SPEC-INFRA-001 시작 전 점검 테스트가 계속 통과한다

### AC-DEPLOY-002 — 원격 DB 차단

- **Given** 소스가 준비되어 있다
- **When** `pnpm test`를 실행한다
- **Then** 단위 테스트가 루프백 판정에서 `localhost`·`127.0.0.1`·`::1`·`[::1]`은 참, `db.example.invalid`·`aws-0-ap-northeast-2.pooler.supabase.com`·`10.0.0.5`는 거짓임을 확인한다
- **And** 통합 테스트가 `DATABASE_URL`의 호스트를 `db.example.invalid`로 바꾼 자식 프로세스로 `dev`·`test`·`e2e` 단계의 시작 전 점검과 `seed` 진입점을 각각 실행해, 넷 모두 종료 코드 ≠ 0이고 출력에 `db.example.invalid`가 있으며 비밀번호 표식은 없음을 확인한다(실제 연결 시도 없음 — 점검이 연결 확인보다 먼저). `seed`의 출력은 기존 `assertSeedAllowed` 문구(`Refusing to seed`)다
- **And** 통합 테스트가 같은 원격 주소를 준 자식 프로세스로 시작 전 점검을 거치지 않는 직접 실행을 해 다음을 확인한다: ① `pnpm exec vitest run --project integration <통합 시험 파일 하나>` → 종료 코드 ≠ 0, 출력에 `db.example.invalid`와 거부 문구가 있고 시험 본문이 실행되지 않음(`tests/integration/setup-env.ts`의 판정) ② `tests/helpers/e2e-env.ts`를 불러오는 Node 자식 프로세스 → 종료 코드 ≠ 0, 같은 거부 문구(Playwright 설정과 E2E가 공유하는 환경 해석). 판정 시점은 다음으로 확인한다: 두 파일의 판정은 모듈 최상위(`.env` 로드 바로 다음)에서 실행되어 원격이면 DB 연결이나 시험 본문이 시작되기 전에 예외를 던진다. `setup-env.ts`는 Vitest `setupFiles`(`vitest.config.mts`)라 시험 파일과 그 시험 파일이 불러오는 모듈(`payload`, `@payload-config`, 시험 도우미)보다 먼저 평가되고, 두 파일 자신은 Node 내장 모듈(`node:` 접두어)과 `src/lib/preflight.ts`만 import한다(DB에 연결하는 모듈을 불러오지 않음)
- **And** 저장소 규칙 테스트가 `src/payload.config.ts`의 어댑터 설정에서 `push`가 루프백 판정 결과에 묶여 있음을, `tests/integration/setup-env.ts`·`tests/helpers/e2e-env.ts`가 루프백 판정 함수를 모듈 최상위에서 부르고, 두 파일의 `import` 대상이 `node:`로 시작하는 모듈과 `src/lib/preflight`뿐임을 확인한다(각 파일의 import 1개 이상 수집을 먼저 단언)

### AC-DEPLOY-003 — 마이그레이션

- **Given** PostgreSQL 컨테이너가 `healthy`이고 개발 DB가 push 모드 스키마를 갖고 있다
- **When** `pnpm test`와 `pnpm migrate:check`(이름은 run 단계에서 확정해 `progress.md` §E.2에 기록)를 실행한다
- **Then** 저장소 규칙 테스트가 마이그레이션 디렉터리에 마이그레이션 파일 1개 이상과 `index.ts`가 있음을 확인한다
- **And** 통합 테스트가 같은 컨테이너에 임시 데이터베이스를 만들고 모든 마이그레이션을 적용한 뒤, 임시 DB와 개발 DB의 스키마 목록(테이블, 열 이름·형식·널 허용·기본값, 인덱스 정의, 외래 키 정의, 열거형 값)이 같음을 확인한다. 비교 전에 개발 DB가 현재 설정(저장소 플러그인 등록 포함)으로 push된 상태임을 보장하고(Payload 초기화), 비교 대상 테이블이 10개 이상임을 먼저 단언하며, `payload_migrations`의 행 내용은 비교하지 않는다. 시험이 끝나면(실패해도) 임시 데이터베이스를 지운다
- **And** 같은 통합 테스트가 임시 DB의 `media` 테이블에 저장소 플러그인이 더하는 열(`prefix`, `_objectKey` 필드의 열 — 실제 열 이름은 M1에서 확인해 `progress.md` §E.2에 기록)이 있음을 확인한다
- **And** `pnpm migrate:check`가 S3 변수 없는 설정과 가짜 S3 값 다섯 개(`test-` 접두어, 연결 없음)를 준 설정에서 각각 새 마이그레이션 생성을 시도하고, 둘 다 새 파일이 없어 종료 코드 0이며, 실행 전후 마이그레이션 디렉터리의 파일 목록이 같고, 실행 뒤 `git status --short src/migrations`의 출력이 비어 있다
- **And** `migrate:check` 스크립트의 시험(스키마를 일부러 바꾼 임시 설정이나 임시 복사 디렉터리 사용)이, 새 파일이 생기면 종료 코드 ≠ 0이고 출력에 그 파일 이름이 있으며, 실행 뒤 대상 마이그레이션 디렉터리가 실행 전과 같음 — 파일 목록이 같고(새 `.ts`·`.json` 없음) `index.ts`의 내용이 실행 전과 바이트 단위로 같음(Payload의 `writeMigrationIndex`가 새 파일을 import하도록 다시 쓴 것이 되돌려짐) — 을 확인한다. 이 시험이 끝난 뒤 `git status --short src/migrations`의 출력은 비어 있다(종료 코드만으로 판정하지 않음 — `migrate:create --skip-empty`는 바뀐 점이 있어도 파일을 쓰고 0으로 끝난다)
- **And** 개발 DB의 `payload_migrations`에 이 SPEC 실행 전에 없던 행이 생기지 않는다(개발 DB에 마이그레이션을 적용하지 않음)
- **And** 빌드 스크립트 단위 테스트가 `VERCEL_ENV=production`이면 "시작 전 점검 → 마이그레이션 → 빌드" 순서의 명령 목록을 만들고, 그 밖의 값(없음·`preview`·`development`)이면 명령 없이 거부(종료 코드 ≠ 0)함을 확인한다

### AC-DEPLOY-004 — DB 연결 설정

- **Given** 소스가 준비되어 있다
- **When** `pnpm test`를 실행한다
- **Then** 단위 테스트가 연결 설정 함수에 대해 다음을 확인한다
  - 원격 주소 + 인증서: `ssl.ca`가 그 인증서, `ssl.rejectUnauthorized`가 `true`, `max`가 5(`DATABASE_POOL_MAX` 없음)
  - 원격 주소 + `DATABASE_CA_CERT` 없음, 또는 `BEGIN CERTIFICATE`가 없는 값: 설정 오류이고, 오류 문구에 `DATABASE_CA_CERT`가 있으며 연결 문자열의 비밀번호 표식·호스트 뒤 경로가 없다(`ssl`이 빠진 설정을 돌려주지 않음)
  - `DATABASE_POOL_MAX`가 `3`·`20`이면 그 값, `2`·`21`·`abc`이면 설정 오류(원격·루프백 모두)
  - 루프백 주소 + `DATABASE_POOL_MAX` 없음: 결과가 지금의 연결 설정(연결 문자열만)과 같다. 루프백 + `DATABASE_POOL_MAX=3`: `max`가 3
- **And** 저장소 규칙 테스트가 `src/`, `node_modules/@payloadcms/drizzle/dist`, `node_modules/@payloadcms/db-postgres/dist`(실제 설치 경로)에서 `.prepare(` 호출이 0건임을 확인한다(경로마다 검사한 파일이 1개 이상임을 먼저 단언)
- **And** 통합 테스트가 `DATABASE_POOL_MAX=3`(최소값)으로 루프백 DB에 붙은 Payload(별도 자식 프로세스 또는 전용 시험 파일 — 방식은 run 단계가 정함)로 같은 표식 회차(정원 2 이상)에 신청 2건을 동시에 넣어, 두 건 모두 30초 안에 접수 완료되고 `lock_timeout`·연결 대기 시간 초과 오류가 없음을 확인한다
- **And** 기존 정원 확인 구간 테스트(SPEC-APPLY-001 동시 신청, SPEC-ADMIN-001 상태 변경 잠금)가 계속 통과한다
- **And** (수동) 실제 배포의 트랜잭션 풀러 동작은 AC-DEPLOY-014가 확인한다

## 2. 운영 신뢰 경계

### AC-DEPLOY-005 — 사이트 주소·CSRF·접속 IP

- **Given** 소스가 준비되어 있다
- **When** `pnpm test`를 실행한다
- **Then** 통합 테스트가 `NEXT_PUBLIC_SERVER_URL`을 `https://test-csrf.example.invalid`로 준 설정을 불러와 Payload 설정의 `serverURL`이 그 값이고 CSRF 허용 목록에 그 값이 있음을 확인한다
- **And** 기존 `clientIpFromHeaders` 단위 테스트(첫 값 사용, `x-real-ip` 대체, `unknown`)가 계속 통과하고, 저장소 규칙 테스트가 `src/lib/rate-limit.ts`에 Vercel 머리글 근거 주석(`x-forwarded-for`를 Vercel이 덮어쓴다는 내용과 문서 주소)이 있음을 확인한다
- **And** 횟수 제한 키 함수의 기존 단위 테스트(같은 IP·같은 비밀값 → 같은 키, `PAYLOAD_SECRET` 없음 → 오류)가 계속 통과한다

## 3. 업로드 저장소

### AC-DEPLOY-006 — 저장소 어댑터 설정과 공개 범위

- **Given** `@payloadcms/storage-s3`가 정확히 `3.93.0`으로 설치되어 있다
- **When** `pnpm test`를 실행한다
- **Then** 저장소 규칙 테스트가 `package.json`의 의존성 값이 정확히 `3.93.0`(범위 기호 없음)이고 `payload` 버전과 같음을 확인한다
- **And** 단위 테스트가 저장소 설정 판정에 대해 다섯 변수 모두 → 설정 객체(`forcePathStyle: true`), 모두 없음 → `null`, 일부만 → 빠진 이름만 담은 오류임을 확인한다
- **And** 통합 테스트가 가짜 S3 값 다섯 개로 만든 설정에서 `media` 컬렉션의 `upload.disableLocalStorage`가 `true`이고 업로드 처리기가 1개 이상이며, 저장소 플러그인 옵션에 `disablePayloadAccessControl`·`signedDownloads`·`clientUploads`가 켜져 있지 않음을 확인한다. S3 값이 없는 설정에서는 `media`의 `staticDir`가 저장소 루트의 `media` 디렉터리 그대로이고 `disableLocalStorage`가 `true`가 아니다
- **And** 같은 통합 테스트가 두 설정(가짜 S3 값 있음·없음)의 `media` 컬렉션 필드 이름 목록이 같고, 두 목록 모두 `prefix`와 `_objectKey`를 포함함을 확인한다(플러그인이 언제나 등록되고 `alwaysInsertFields: true` — 스키마 일관성, REQ-DEPLOY-003)
- **And** 저장소 규칙 테스트가 `src/payload.config.ts`에서 `s3Storage(`가 조건문 없이 `plugins`에 들어 있고 옵션에 `enabled`와 `alwaysInsertFields: true`가 있음을 확인한다
- **And** 단위 테스트(또는 저장소 규칙 테스트)가 `media` 컬렉션 설정의 관리자 안내 문구(`admin.description` 등 업로드 화면에 보이는 설명 — 위치는 run 단계가 정해 `progress.md` §E.2에 기록)에 `4MB 이하`가 들어 있음을, 그리고 5MB 판정(`exceedsUploadLimit`, 오류 문구 `File size exceeds the 5 MB limit.`)이 그대로임을 확인한다(사용자 결정 D7)
- **And** 기존 SPEC-TOUR-001 AC-TOUR-006과 SPEC-LANDING-001 AC-LANDING-003(로컬 저장소 기준 익명 미디어 읽기 범위)이 계속 통과한다
- **And** (수동) 실제 배포의 저장·공개 범위는 AC-DEPLOY-014가 확인한다

## 4. 예약 정리

### AC-DEPLOY-007 — 정리 엔드포인트 인증

- **Given** E2E 서버가 테스트가 만든 무작위 `CRON_SECRET`(영문·숫자 32자)으로 떠 있다
- **When** `pnpm test`와 `pnpm e2e`를 실행한다
- **Then** 단위 테스트가 비밀값 비교 함수에 대해 같은 값 → 참, 한 글자 다른 값·길이가 다른 값·빈 값·`Bearer` 없는 값 → 거짓, 서버 비밀값이 없거나 16자 미만 → 항상 거짓임을 확인하고, 구현이 `timingSafeEqual`을 쓰는지 저장소 규칙 테스트가 확인한다
- **And** E2E가 Playwright 요청 API로 다음을 확인한다
  - `GET /api/cron/cleanup` 머리글 없음 → 정확히 401, 본문에 비밀값 없음, 응답이 Payload의 JSON 오류 형식(`errors` 키)이 아님
  - `Authorization: Bearer <틀린 값>` → 401
  - `POST`(맞는 머리글) → 405
  - `GET`(맞는 머리글) → 200, 본문 JSON의 키가 정확히 `attemptsDeleted`·`auditLogsDeleted`이고 값이 0 이상 정수, `cache-control`에 `no-store` 포함
- **And** 401 사례 실행 전후로 표식 시도 기록(10분 지난 것) 1건이 그대로 남아 있음을 확인한 뒤 지운다

### AC-DEPLOY-008 — 정리 규칙

- **Given** 실제 현재 시각 `now` 기준으로 표식 행이 준비되어 있다: 시도 기록 `now − 10분 − 1초`(a1), `now − 9분`(a2) / 작업 기록 `now − 2년 − 1일`(l1), `now − 2년 + 1일`(l2)
- **When** `pnpm test`를 실행한다
- **Then** 단위 테스트가 기준 시각 함수에 대해 `2026-11-17T09:00:00.000Z` → 시도 기준 `2026-11-17T08:50:00.000Z`, 작업 기록 기준 `2024-11-17T09:00:00.000Z`, 그리고 `2028-02-29T00:00:00.000Z` → 작업 기록 기준이 `setUTCFullYear` 규칙의 값(`2026-03-01T00:00:00.000Z`)임을 확인한다
- **And** 통합 테스트가 정리를 실제 현재 시각으로 실행한 뒤 a1·l1은 없고 a2·l2는 있음을, 표식 회차·신청·투어·미디어·사용자 수가 실행 전과 같음을 확인한다
- **And** 같은 기준 시각으로 한 번 더 실행하면 두 결과 값이 모두 0이다
- **And** SPEC-ADMIN-001 AC-ADMIN-012 방식으로 잰 정리 실행의 질의 수가 지울 표식 행 2개일 때와 20개일 때 같다
- **And** 기존 SPEC-APPLY-001 횟수 제한 테스트(신청마다 오래된 시도 정리)가 계속 통과한다

### AC-DEPLOY-009 — 배포 설정 파일

- **Given** 소스가 준비되어 있다
- **When** `pnpm test`를 실행한다
- **Then** 저장소 규칙 테스트가 `vercel.json`을 JSON으로 읽어 다음을 확인한다
  - `crons`가 정확히 1개, `path`가 정확히 `/api/cron/cleanup`(끝 빗금 없음), `schedule`이 정확히 `0 18 * * *`
  - `regions`가 정확히 `["icn1"]`
  - `buildCommand`가 빌드 스크립트를 가리키고 그 파일이 존재한다
  - 파일 어디에도 `CRON_SECRET`의 값이 될 수 있는 `x-vercel-protection-bypass`·`Bearer` 문자열이 없다
- **And** 정리 엔드포인트 경로 파일이 `vercel.json`의 `path`와 같은 경로를 처리한다(AC-DEPLOY-007 E2E의 200이 그 증거)

### AC-DEPLOY-010 — IP 변환값 보관 고지와 문구 버전

- **Given** 소스가 준비되어 있다
- **When** `pnpm test`와 `pnpm e2e`를 실행한다
- **Then** 단위 테스트가 필수 동의 고지의 "수집 항목" 글에 `비밀키로 변환한`, `원래 IP 주소는 저장하지 않음`, `매일 한 번 자동으로 지워`, `늦어도 72시간 안에 삭제`가 들어 있고 `다음 신청 처리 때`가 없음을 확인한다
- **And** `PRIVACY_POLICY_VERSION`이 `2026-11-12.99052510`이 아니고, 해시 부분이 새 `consentDocument()`의 SHA-256 앞 8자리와 같으며, 날짜 부분이 `YYYY-MM-DD` 형식이다(기존 `tests/unit/consent.spec.ts` 규칙)
- **And** 저장소 규칙 테스트가 `src/`(생성 파일 `payload-types.ts` 제외)에서 신청 문서의 `privacyPolicyVersion`에 값을 넣는 곳이 신청 생성 경로(`src/lib/submit-application.ts`) 한 곳뿐임을 확인한다(이미 접수된 신청의 버전 값을 다시 쓰는 코드 경로 없음 — 대상 1건 이상 존재를 먼저 단언)
- **And** E2E가 `/apply?session=<모집 중 회차>` 화면에 새 "수집 항목" 문구가 그대로 보이고, 신청을 마치면 저장된 신청의 동의 버전이 새 `PRIVACY_POLICY_VERSION`과 같음을 확인한다

## 5. 로그와 검색 제외

### AC-DEPLOY-011 — 로그의 질의 바인딩 값 가림

- **Given** 표식 문자열 `test-<무작위 값>@example.test`가 있다
- **When** `pnpm test`를 실행한다
- **Then** 단위 테스트가 표식을 `params` 배열, 오류 문구의 `params:` 뒷부분, `detail`, 그리고 `cause` 안의 같은 위치에 넣은 가짜 오류를 가림 직렬화한 결과(JSON 문자열)에 표식이 없고, 오류 이름·`code`·SQL 문(`Failed query:` 다음 부분)은 남아 있음을 확인한다
- **And** 단위 테스트가 로그 메시지 문자열 가림(pino `hooks.logMethod` 등 — 방식은 run 단계가 정함)에 대해, `Error: Failed query: select 1\nparams: <표식>` 형태의 문자열 인자를 넘긴 기록의 `msg`에 표식이 없고 `Failed query: select 1`은 남아 있음을 확인한다
- **And** 통합 테스트가 Payload 설정의 로거 옵션으로 메모리 출력 스트림 로거를 만들어 실제 PostgreSQL 질의 오류(표식 값을 바인딩한 질의가 제약 위반으로 실패)를 Payload의 `logError`에 넘기면, 출력 전체에 표식이 0회이고 출력이 비어 있지 않음을 확인한다
- **And** 저장소 규칙 테스트가 `src/payload.config.ts`가 가림 직렬화를 로거 설정에 넣었음을 확인한다

### AC-DEPLOY-012 — 검색 제외 표시

- **Given** E2E 서버가 떠 있다
- **When** `pnpm e2e`를 실행한다
- **Then** `GET /robots.txt`가 200이고 본문에 `User-Agent: *`와 `Disallow: /`가 있으며 `Sitemap:`이 없다
- **And** `/`, `/tours`, `/admin`(로그인 화면), `/api/tours`, 공개 투어 대표 이미지 파일 주소, `/no-such-page`(404) 응답의 `x-robots-tag` 머리글이 모두 `noindex, nofollow`를 포함한다
- **And** `/`와 `/tours` HTML에 `name="robots"`이고 `content`에 `noindex`·`nofollow`가 든 메타 태그가 정확히 1개 있다
- **And** 기존 SPEC-LANDING-001 E2E(머리글·바닥글·404·글꼴)가 계속 통과한다

## 6. 실제 배포 확인

### AC-DEPLOY-013 — 비공개 미리보기 (수동)

- **Given** 사용자가 `plan.md` §I.1~I.3을 마쳤다
- **When** 사용자가 Vercel에 로그인하지 않은 브라우저(시크릿 창)와 PowerShell `Invoke-WebRequest -Uri https://<프로젝트>.vercel.app/ -MaximumRedirection 0`(오류가 나도 상태 코드만 확인)으로 `/`, `/tours`, `/admin`, `/api/tours`, `/robots.txt`에 접속한다
- **Then** 어느 경우에도 숨비투어 화면·JSON이 아니라 Vercel 로그인 화면 또는 401·리디렉트 상태가 나온다
- **And** Vercel에 로그인한 브라우저에서는 같은 주소들이 개발 환경과 같은 화면을 보인다
- **And** Deployment Protection 화면의 설정이 "Vercel Authentication: 켜짐, All Deployments"이다(사용자가 화면을 확인해 알려 줌)

### AC-DEPLOY-014 — 실제 배포 동작 (수동)

- **Given** AC-DEPLOY-013이 통과했고, 마지막 운영 배포의 빌드 로그에 pnpm `11.28.9`, 마이그레이션 적용 단계, 성공이 있다
- **When** 사용자가 `plan.md` §I.4의 0~9를 수행한다(7번 Cron이 막히면 8번 대신 §I.5)
- **Then** 다음이 모두 성립한다
  - 함수 리전이 `icn1`이다. 판정 기준은 둘 중 하나: 배포 상세(Deployments → 해당 배포 → Functions 또는 Resources)에 표시된 함수 리전이 `icn1`, 또는 동적 응답(예: `/api/tours`)의 `x-vercel-id` 머리글을 `::`로 나눴을 때 **마지막 칸(요청 ID) 바로 앞 칸**이 `icn1`. 머리글 앞쪽 칸은 요청을 받은 엣지 리전이라 서울에서 보면 함수가 다른 리전에 있어도 `icn1`이 나오므로, "`icn1` 포함"만으로는 통과로 보지 않는다
  - 관리자 첫 계정 생성·로그인이 된다
  - 사진 두 장이 업로드되고, Supabase 대시보드의 `media` 버킷에 두 파일이 보인다
  - 관리자 로그아웃(Vercel 로그인 유지) 상태에서 공개 투어의 대표 이미지는 보이고, 어디에도 쓰이지 않은 사진의 파일 주소는 오류다
  - 홈 대표 사진으로 고른 사진은 보이고, 대표 사진을 비운 뒤에는 그 주소가 다시 오류다
  - 신청 1건이 접수 완료 화면까지 가고(정원 잠금 구간 통과), 관리자 상태 변경(확정)이 저장되며, 참가자 CSV가 내려받아진다
  - Supabase Data API가 꺼져 있다: Supabase 대시보드의 Data API 화면에서 "Enable Data API"가 꺼져 있고, PowerShell `Invoke-WebRequest -Uri 'https://<프로젝트 ref>.supabase.co/rest/v1/applications?select=id&limit=1' -Headers @{ apikey = '<공개 키>' }`(공개 키는 publishable/anon 키 — 비밀 키 `service_role`·secret 키는 쓰지 않음)가 오류 상태 코드로 끝나 신청 행을 돌려주지 않는다(사용자는 상태 코드만 알려 줌, 키는 채팅에 붙이지 않음)
  - 예약 정리는 아래 (가) 또는 (나) 중 하나가 성립한다(사용자 결정 D7)
    - (가) 자동 정리 동작: Cron Jobs 화면의 수동 실행(Run, `plan.md` §I.4 7번) 응답이 HTTP 200이고, **그 응답을 확인한 뒤에** 사용자가 확인용 신청 1건(§I.4 8번 — 증거 행)을 하고 그 시각을 적어 두며, 그 뒤로 **다른 신청·Cron 수동 실행·§I.5 수동 정리를 하지 않고** 증거 신청 후 26시간 이상 지나 Supabase SQL 편집기에서 `select count(*) from application_attempts where attempted_at < now() - interval '26 hours';`를 실행한 결과가 `0`이다. 판별 근거: 증거 행은 수동 실행 뒤에 생겼으므로 수동 실행이 지울 수 없고, 신청마다 오래된 시도를 지우는 기존 동작도 그 뒤 신청이 없으니 돌지 않으며, 정리 엔드포인트는 10분 지난 행만 지우므로 26시간 시점까지 이 행을 지울 수 있는 것은 예약 실행뿐이다 — 예약 실행이 한 번도 돌지 않았다면 증거 행이 남아 결과가 `1` 이상이 된다(정상 최대 보관 약 25시간 10분 — `plan.md` §B.5. 열·테이블 이름은 M2가 확인한 실제 이름)
    - (나) 보호에 막힘: 수동 실행 응답이 200이 아니거나 (가)의 결과가 `1` 이상이라 막힘이 확인되면, 이 줄을 "막힘(Q6)"으로 기록하고, 사용자가 `plan.md` §I.5의 수동 정리 SQL을 실행해 받은 결과 한 줄의 두 값(`attempts_deleted`, `audit_logs_deleted`)을 기록하며, 자동 삭제 확인을 2단계 출시 조건으로 `progress.md`에 옮겨 적는다. 이 경우 "자동 정리 동작"을 통과로 적지 않는다
- **And** 오케스트레이터가 각 줄의 결과와 사용자가 전한 화면 문구를 `progress.md` §E.2에 기록한다. 업로드가 실패하면 원인 후보(Vercel 4.5MB 본문 한도, `@aws-sdk/client-s3`의 기본 체크섬 동작과 Supabase S3 호환성 — 미확인, `plan.md` §G R21)를 함께 적고 차단자로 보고한다

## 7. 문서와 테스트

### AC-DEPLOY-015 — 문서와 비밀값 미포함

- **Given** 소스가 준비되어 있다
- **When** `pnpm test`를 실행하고 아래 명령을 실행한다
- **Then** 저장소 규칙 테스트가 `.env.example`에 `NEXT_PUBLIC_SERVER_URL`, `CRON_SECRET`, `DATABASE_CA_CERT`, `DATABASE_POOL_MAX`, `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` 이름이 모두 있고 각 줄의 `=` 뒤가 비어 있음을, README에 "배포" 절과 같은 변수 이름 목록이 있음을 확인한다
- **And** 다음 명령의 출력이 비어 있다(추적 파일에 실제 비밀값 모양 없음). git grep의 `[^ ]`는 줄바꿈과도 맞아 빈 `NAME=` 줄을 잘못 잡으므로 공백 판정은 `[^[:space:]]`로 한다
  - ① Supabase 연결 문자열(비밀번호 포함): `git grep -n -I -E 'postgres(ql)?://[^[:space:]:@/]+:[^[:space:]@<[]+@[^[:space:]/:]*supabase\.(co|com)' -- . ':!*.md'`
  - ② 비밀 변수에 값이 들어간 줄: `git grep -n -I -E '(CRON_SECRET|PAYLOAD_SECRET|S3_SECRET_ACCESS_KEY|S3_ACCESS_KEY_ID|DATABASE_CA_CERT)=[^[:space:]]' -- . ':!*.md'`
  - ③ 개인 키: `git grep -n -I -E -e '-----BEGIN [A-Z ]*PRIVATE KEY' -- . ':!*.md'`
  - 범위 설명: ①은 Supabase 호스트(`*.supabase.co`, `*.pooler.supabase.com`)를 가리키고 비밀번호 자리에 실제 값이 든 주소만 잡는다. 예시·시험 값 — 호스트 `127.0.0.1`·`localhost`·`[::1]`·`HOST`·`db.example.invalid`, 사용자 `USER`·`u`, 비밀번호 자리 `[YOUR-PASSWORD]`·`<…>` — 은 잡지 않는다. 그래서 `.env.example` 주석의 형식 예시, 시작 전 점검의 형식 안내 문구(`src/lib/preflight.ts`), 시험 고정 값(`tests/unit/*`), AC-DEPLOY-002의 `db.example.invalid` 주소 시험은 걸리지 않는다. 시험 코드가 Supabase 모양 호스트를 쓸 때는 비밀번호 없는 호스트 이름만 쓴다(AC-DEPLOY-002 루프백 판정). ②는 `=` 바로 뒤에 공백이 아닌 글자가 있을 때만 잡으므로 `.env.example`의 빈 `CRON_SECRET=`·`S3_*=` 줄은 걸리지 않는다. 시험 코드는 이 변수들을 `NAME=값` 문자열이 아니라 객체 키(`CRON_SECRET: …`)로 넘긴다
  - 계획 시점 실측(2026-11-17, HEAD `0057e9d`, 위 세 명령에 `0057e9d`를 넣어 실행): ①②③ 모두 출력 없음, 종료 코드 1(일치 없음). 고치기 전 명령은 같은 HEAD에서 ① 8줄(`.env.example:4`, `src/lib/preflight.ts:166`, `tests/unit/preflight-cli.spec.ts:34`, `tests/unit/preflight.spec.ts:24·97·105`, `tests/unit/seed-guard.spec.ts:9·28`), ② 1줄(`.env.example:8:PAYLOAD_SECRET=`)을 출력했다
- **And** `git ls-files .vercel`의 출력이 비어 있다
- **And** 저장소 규칙 테스트가 README "배포" 절에 수동 정리 SQL(`plan.md` §I.5와 같은 형태 — 두 `delete`를 묶어 `attempts_deleted`·`audit_logs_deleted` 두 행 수를 한 번에 돌려주는 한 문장)이 있음을 확인하고, 그 SQL에서 뽑은 테이블·열 이름(시도 기록 테이블·시각 열, 작업 기록 테이블·시각 열)이 정리 구현(`src/lib/scheduled-cleanup.ts` — 이름은 예시, run 단계가 정한 실제 파일)의 `DELETE` 질의가 쓰는 테이블·열 이름과 같음을 확인한다(양쪽에서 이름을 2개 이상 뽑았음을 먼저 단언)

### AC-DEPLOY-016 — 테스트 체계, 의존성, 정리

- **Given** PostgreSQL이 `healthy`이고 E2E 전용 포트가 비어 있다
- **When** `pnpm test`를 실행한 뒤 `pnpm e2e`를 실행한다
- **Then** 둘 다 종료 코드 0이고, 기존 테스트와 이 SPEC의 테스트를 모두 통과로 보고한다
- **And** 커버리지 보고서의 `src/lib/` 합산 라인 커버리지가 85% 이상이다
- **And** `git diff 0057e9d -- package.json`의 의존성 변경이 `@payloadcms/storage-s3`의 `3.93.0` 추가 한 줄과 새 스크립트뿐이다
- **And** `pnpm audit --json` 결과의 권고마다 패키지·심각도·도달 경로·판단(실행 경로 도달 여부)이 `progress.md` §E.2에 있고, 실행 경로에 도달하는 high 이상 권고가 있으면 차단자로 보고되어 있다
- **And** 두 명령이 끝난 뒤 다음 명령의 출력이 각각 `0`이다(테이블·열 이름은 M1·M2에서 확인한 실제 이름)
  - `docker compose exec -T postgres psql -U <POSTGRES_USER 값> -d <POSTGRES_DB 값> -tAc 'SELECT count(*) FROM application_attempts WHERE key_hash LIKE ''test-%'';'`
  - `docker compose exec -T postgres psql -U <POSTGRES_USER 값> -d <POSTGRES_DB 값> -tAc 'SELECT count(*) FROM tours WHERE slug LIKE ''test-%'';'`
  - `docker compose exec -T postgres psql -U <POSTGRES_USER 값> -d <POSTGRES_DB 값> -tAc 'SELECT count(*) FROM users WHERE email LIKE ''%@example.test'';'`
  - `docker compose exec -T postgres psql -U <POSTGRES_USER 값> -d <POSTGRES_DB 값> -tAc 'SELECT count(*) FROM pg_database WHERE datname LIKE ''sumbi_migration_check%'';'`
- **And** 기존 SPEC-APPLY-001(AC-APPLY-016)·SPEC-ADMIN-001·SPEC-LANDING-001(AC-LANDING-016)의 정리 기준이 계속 통과한다(기존 개발 신청 ID 2033은 기준값 — SPEC-LANDING-001과 같은 해석)

## 8. 품질 게이트

| 항목 | 기준 | 검증 명령 |
|---|---|---|
| 타입 | 오류 0건 | `pnpm typecheck` |
| 마이그레이션 | 새 마이그레이션 없음(S3 변수 있음·없음 두 설정) — 스크립트가 실행 전후 `src/migrations/` 목록을 비교해 새 파일이 생기면 새 파일을 지우고 `index.ts`를 실행 전 내용으로 되돌린 뒤 종료 코드 ≠ 0. 종료 코드 0이고 실행 뒤 `git status --short src/migrations` 출력이 비어 있으면 통과 | `pnpm migrate:check`(이름 확정 후) → `git status --short src/migrations` |
| 빌드 | 종료 코드 0(로컬 빌드, 운영 점검 안 함) | `pnpm build` |
| 단위·통합·저장소 규칙 테스트 | 전부 통과 | `pnpm test` |
| 커버리지 | `src/lib/` 합산 라인 85% 이상 | `pnpm test`(임계값 내장) |
| E2E | 기존 + 이 SPEC 전부 통과 | `pnpm e2e` |
| 린트 | 오류 0건, 새 경고 0건 | `pnpm lint` |
| 포맷 | 차이 0건 | `pnpm format:check` |
| 의존성 | 새 직접 의존성은 `@payloadcms/storage-s3@3.93.0` 하나 | AC-DEPLOY-016 |
| 보안 권고 | 재측정·도달 경로 기록, 실행 경로 high 없음 | `pnpm audit` |
| 보존 | 잠금 구간·점유·정렬·접수·상태 변경·요청 사항 삭제·미디어 읽기 규칙 불변 | `plan.md` §E-2 마지막 명령 출력 없음 |
| 비밀값 | 추적 파일에 없음 | AC-DEPLOY-015 |
| 실제 배포 | 수동 확인 기록 | AC-DEPLOY-013·014 |

TRUST 5 대응: Tested(AC-DEPLOY-001~016, 실제 DB 통합 테스트, 빈 DB 마이그레이션 비교, 실제 배포 확인), Readable(린트), Unified(포맷·생성 파일), Secured(AC-DEPLOY-001·002·004·006·007·011·013·015 — 운영 설정 점검, 원격 DB 차단, 인증서 검증, 이미지 공개 범위 유지, Cron 비밀값, 로그 가림, 비공개 보호, 비밀값 미포함), Trackable(Conventional Commits, 커밋 메시지에 `SPEC-DEPLOY-001`).

## 9. 완료 정의 (Definition of Done)

- [ ] AC-DEPLOY-001 ~ AC-DEPLOY-016이 모두 통과했고, 각 명령과 출력 요약이 `progress.md` §E.2에 기록되었다
- [ ] 수동 확인 2건(AC-DEPLOY-013 비공개 확인, AC-DEPLOY-014 실제 배포 동작)이 사용자가 전한 결과와 함께 기록되었다
- [ ] 품질 게이트 표의 로컬 명령이 같은 커밋에서 통과했다
- [ ] 첫 마이그레이션 파일 이름, 스키마 비교 항목 수, 정리 대상 테이블·열 이름, 새 동의 문구 버전 값이 `progress.md` §E.2에 기록되었다
- [ ] Claude가 비밀값을 보거나 입력하지 않았고, 추적 파일에 비밀값이 없다(AC-DEPLOY-015)
- [ ] 실제 관리자 계정이 테스트에 쓰이지 않았다
- [ ] `spec.md` §5 제외 범위 항목(처리방침·운영자 정보·보호 해제·법률 최종 확인·요금제 결정·자체 도메인·CI 등)이 구현에 섞이지 않았다
- [ ] 정리 엔드포인트 `@MX:WARN`, 정리 규칙·로그 가림·풀 설정·접속 IP 근거 `@MX:NOTE`가 있다
- [ ] 2단계로 넘길 항목(`plan.md` §A.3의 "2단계" 행, Cron 보호 통과 결과, 72시간·2년 문구 변호사 확인)이 `progress.md`에 옮겨 적혔다
