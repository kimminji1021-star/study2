# SPEC-INFRA-001 수용 기준

> **검증 셸**: Windows PowerShell 5.1과 PowerShell 7 모두에서 그대로 실행되어야 한다. 이를 위해 명령 인자 안에 큰따옴표를 겹쳐 쓰지 않는다. 문자열 검색은 셸 인용에 기대지 않고 **저장소 규칙 테스트**(`tests/unit/repo-rules.spec.ts`, `pnpm test`의 일부)나 `Select-String -SimpleMatch '<고정 문자열>'`로 한다.
> **판정**: 별도 표시가 없으면 "통과"는 해당 명령의 종료 코드가 0(`$LASTEXITCODE -eq 0`)임을 뜻한다.
> **빈 결과 방지**: "0건" 조건을 검사하는 저장소 규칙 테스트는 같은 검사 안에서 대상이 1건 이상 존재함을 먼저 단언한다(대상 파일이 하나도 없어서 통과하는 경우를 막는다).
> **전제**: `spec.md` §2.3 사용자 사전 작업(P1~P4) 완료, `.env.example`을 복사해 값을 채운 `.env` 존재. 별도 표시가 없으면 **PostgreSQL 컨테이너가 `healthy` 상태(AC-INFRA-001)**다. `pnpm test`는 통합 테스트와 시작 전 DB 점검을 포함하므로, `pnpm test`로 판정하는 모든 기준은 이 상태를 전제로 한다. 상태를 바꾸는 시나리오(AC-INFRA-012~015)는 끝난 뒤 원래 상태로 되돌린다.
> **시간 측정**: 소요 시간 조건이 있는 기준은 `Measure-Command { <명령> *> <로그 파일> }`로 측정하고, 결과의 `TotalSeconds`를 판정에 쓴다. 종료 코드는 바로 다음 줄에서 `$LASTEXITCODE`로 읽는다.

## 1. 정상 흐름 시나리오

### AC-INFRA-001 — 로컬 PostgreSQL 기동과 데이터 영속성

- **Given** Docker Desktop이 실행 중이고 `.env`에 Compose용 PostgreSQL 변수가 채워져 있다
- **When** `docker compose up -d`를 실행한다
- **Then** 60초 안에 `docker compose ps --format '{{.Service}} {{.Health}}'` 출력에 `postgres healthy`가 나타난다
- **And** 저장소 규칙 테스트가 `docker-compose.yml`에서 다음을 확인한다: PostgreSQL 이미지 태그에 메이저 버전이 있고 `latest`가 아님, 이름 있는 볼륨이 데이터 디렉터리에 연결됨, `healthcheck` 존재, `POSTGRES_HOST_AUTH_METHOD`가 `trust`가 아님, 호스트 포트가 기본값 5432를 가진 환경 변수 치환으로 정의됨
- **And** 영속성 확인 — 다음을 차례로 실행하면 마지막 명령 출력이 `infra_persist_check`이다
  1. `docker compose exec -T postgres psql -U <POSTGRES_USER 값> -d <POSTGRES_DB 값> -c 'CREATE TABLE infra_persist_check (id int);'`
  2. `docker compose down` (`-v` 없이)
  3. `docker compose up -d` 후 `postgres healthy` 대기
  4. `docker compose exec -T postgres psql -U <POSTGRES_USER 값> -d <POSTGRES_DB 값> -tAc 'SELECT to_regclass(''public.infra_persist_check'');'`
- 정리: `... -c 'DROP TABLE infra_persist_check;'`

### AC-INFRA-002 — 설치 재현과 Node.js 버전 범위

- **Given** 지원 범위 안의 Node.js와 `packageManager`에 적힌 pnpm이 설치되어 있고, PostgreSQL 컨테이너가 `healthy` 상태다(AC-INFRA-001 — 아래 저장소 규칙 테스트를 `pnpm test`로 실행하기 위함)
- **When** `pnpm install --frozen-lockfile`을 실행한다
- **Then** 종료 코드 0으로 끝나고, 출력에 `payload`, `@payloadcms/*`, `next`에 대한 peer dependency 경고가 없다
- **And** 저장소 규칙 테스트가 `package.json`에서 다음을 확인한다: `packageManager`가 `pnpm@<정확한 버전>` 형식, `engines.node`가 `^22.23.4 || ^24.22.1 || >=26.0.0`과 같거나 그보다 좁은 범위(22.23.4·24.22.1·26.0.0은 포함, 22.23.3·24.22.0·25.0.0은 제외 — 테스트가 이 6개 버전을 직접 대입해 판정)
- **And** 범위 밖 Node.js 거부 동작 — pnpm의 `nodeVersion` 설정을 명령줄에서 `25.0.0`으로 덮어써 설치하면(예: `pnpm install --frozen-lockfile --node-version=25.0.0`. 실제 플래그 형식은 선택한 pnpm 버전 문서대로 쓰고 `progress.md` §E.2에 기록) 0이 아닌 종료 코드로 끝나고, 출력에 엔진(Node.js 버전) 불일치 안내가 나타난다

### AC-INFRA-003 — 스크립트 제공과 Windows 호환

- **Given** 의존성 설치가 끝났고 PostgreSQL 컨테이너가 `healthy` 상태다(AC-INFRA-001)
- **When** `pnpm test`를 실행한다
- **Then** 저장소 규칙 테스트가 통과하며, 이 테스트는 다음을 확인한다
  - `package.json`의 `scripts`에 `dev`, `build`, `start`, `test`, `e2e`, `lint`, `format`, `format:check`, `typecheck` 9개 키가 모두 있다(먼저 9개 존재를 단언)
  - 어떤 스크립트 값에도 `rm -rf`가 없다
  - 어떤 스크립트 값에도 명령 앞 인라인 환경 변수 대입(정규식 `(^|&&|;)\s*[A-Z][A-Z0-9_]*=\S*\s`)이 없다(`cross-env` 뒤의 대입은 허용)
- **And** 이 문서의 나머지 수용 기준 명령이 Windows PowerShell 5.1과 PowerShell 7에서 같은 결과를 낸다(run-phase 실행자가 셸 종류와 버전을 `$PSVersionTable.PSVersion`으로 기록)

### AC-INFRA-004 — 단일 앱 구조와 운영 빌드

- **Given** 의존성 설치가 끝났고, 필수 환경 변수가 채워져 있으며, PostgreSQL 컨테이너가 `healthy` 상태다(AC-INFRA-001)
- **When** `pnpm typecheck`를 실행한 뒤 `pnpm build`를 실행한다
- **Then** 두 명령 모두 종료 코드 0으로 끝난다
- **And** 저장소 규칙 테스트가 다음을 확인한다: `src/app/(frontend)/` 아래에 페이지 파일이 1개 이상 있고 `admin` 또는 `api` 경로 구간이 0건이다. `src/app/(payload)/` 아래에 `admin` 경로와 `api` 경로가 각각 1개 이상 있다. `src/app/` 바로 아래에는 이 두 라우트 그룹 외의 라우트 디렉터리가 없다

### AC-INFRA-005 — 의존성 버전 정책

- **Given** 의존성 설치가 끝났고 PostgreSQL 컨테이너가 `healthy` 상태다(AC-INFRA-001)
- **When** `pnpm test`를 실행한다
- **Then** 저장소 규칙 테스트가 `package.json`의 `dependencies`·`devDependencies`에 적힌 각 패키지(먼저 1개 이상 존재를 단언)의 설치된 버전을 `node_modules/<패키지>/package.json`에서 읽어 다음을 확인한다
  - 사전 배포 식별자가 없고 메이저 버전이 1 이상이다(`spec.md` §2.5)
  - `payload`와 이름이 `@payloadcms/`로 시작하는 모든 패키지는 `package.json`에 범위 기호(`^`, `~`) 없이 적혀 있고 설치된 버전이 서로 같다
  - 설치된 `next` 버전이 `@payloadcms/next`의 `peerDependencies.next` 범위를 만족한다

### AC-INFRA-006 — 단위·통합 테스트와 커버리지

- **Given** AC-INFRA-001에 따라 PostgreSQL이 `healthy` 상태다
- **When** `pnpm test`를 실행한다
- **Then** 종료 코드 0으로 끝나고, 단위 테스트 1개 이상과 통합 테스트 1개 이상이 통과로 보고된다
- **And** 통합 테스트는 `DATABASE_URL`의 데이터베이스에 연결해 `Users` 레코드를 만들고, 올바른 비밀번호로 로그인해 토큰을 받고, 틀린 비밀번호로는 인증 오류가 나며 토큰이 없음을 확인한 뒤, 만든 레코드를 지운다
- **And** 통합 테스트는 Payload 설정에 등록된 컬렉션의 slug 목록에서 `payload-`로 시작하는 slug(Payload가 내부적으로 추가하는 시스템 컬렉션 — 예: `payload-preferences`, `payload-migrations`, `payload-locked-documents`)를 뺀 결과가 정확히 `['users']`임을 단언한다. 이 필터 기준(slug 접두어 `payload-`)은 테스트 코드에 주석으로 남긴다
- **And** 커버리지 보고서에서 `src/lib/` 아래 파일을 합산한 라인 커버리지가 85% 이상이다(임계값 미달 시 `pnpm test` 자체가 0이 아닌 코드로 끝나도록 설정되어 있음)

### AC-INFRA-007 — 첫 관리자 계정 생성 안내 (수동 검증)

- **Given** `docker compose down -v` 후 `docker compose up -d`로 빈 데이터베이스를 준비하고 `pnpm dev`를 실행했다
- **When** 브라우저로 `http://localhost:3000/admin`을 연다
- **Then** 주소 표시줄의 경로가 `/admin/create-first-user`가 된다
- **And** 이메일·비밀번호를 입력해 계정을 만들면 경로가 `/admin`이 되고 대시보드가 열린다
- 검증 방식: 수동. 실행자는 두 경로 값을 `progress.md` §E.2에 기록한다.

### AC-INFRA-008 — E2E 스모크

- **Given** PostgreSQL이 `healthy` 상태이고 E2E 전용 포트가 비어 있으며 Chromium이 설치되어 있다
- **When** `pnpm e2e`를 실행한다
- **Then** 종료 코드 0으로 끝나고 다음 테스트가 모두 통과한다
  - `/`가 HTTP 200으로 응답한다
  - 주 제목(`h1`) 텍스트에 `숨비투어`가 들어 있고, 페이지에 `준비 중`이 들어간 문구가 보인다
  - 주 제목의 계산된 스타일 중 Tailwind 유틸리티 클래스로 지정한 속성 1개 이상이 브라우저 기본값과 다른 기대값과 같다
  - `/admin/login`에서 이메일·비밀번호 입력란과 로그인 버튼이 보인다
  - 테스트 시작 전에 만든 테스트 관리자 계정으로 로그인하면 경로가 `/admin`이 되고 대시보드가 보인다(테스트가 끝나면 계정 삭제)
- **And** E2E 테스트가 각 페이지 방문 후 `new URL(page.url()).port`가 설정된 E2E 전용 포트 값과 같고 `'3000'`이 아님을 단언한다(단언 실패 시 테스트 실패)

### AC-INFRA-009 — Tailwind 적용 범위

- **Given** 소스가 준비되어 있고 PostgreSQL 컨테이너가 `healthy` 상태다(AC-INFRA-001)
- **When** `pnpm test`를 실행한다
- **Then** 저장소 규칙 테스트가 `src/` 아래 파일을 읽어 다음을 확인한다(셸 검색 미사용)
  - 고정 문자열 `@import "tailwindcss"`를 포함한 파일이 1개 이상 있고, 모두 `src/app/(frontend)/` 아래에 있다
  - 그 스타일시트를 import하는 파일이 1개 이상 있고, 모두 `src/app/(frontend)/` 아래에 있다
  - `src/app/(payload)/` 아래 파일 중 그 스타일시트 파일명이나 `tailwindcss`를 참조하는 파일이 0건이다

### AC-INFRA-010 — 린트·포맷 범위와 줄바꿈

- **Given** 의존성 설치가 끝났고 PostgreSQL 컨테이너가 `healthy` 상태다(AC-INFRA-001)
- **When** `pnpm lint`와 `pnpm format:check`를 실행한다
- **Then** 두 명령 모두 종료 코드 0으로 끝난다
- **And** 저장소 규칙 테스트가 `spec.md` §2.5 **검사 제외 목록**의 모든 항목(MoAI 소유 경로 `.claude/`, `.moai/`, `.github/`, `.git_hooks/`, `CLAUDE.md`, `.mcp.json`, `.claudeignore`, `.worktreeinclude` / `*.md` / 생성 파일 / 산출물 디렉터리)이 `.prettierignore`와 ESLint 설정의 `globalIgnores` 양쪽에 똑같이 들어 있음을 확인한다(목록은 테스트 안에 한 번만 정의하고 두 파일에 같은 목록을 대조). ESLint 설정에 Prettier 충돌 방지 설정(`eslint-config-prettier`)이 포함되어 있다
- **And** 범위 밖 확인 — `.moai/` 아래에 형식과 린트 규칙을 모두 어기는 임시 파일 `.moai/__lint_probe.ts`(내용 `const  a=1`)를 만든 뒤 `pnpm format:check`와 `pnpm lint`를 실행해도 둘 다 종료 코드 0이다. 같은 내용을 `src/__lint_probe.ts`에 두면 `pnpm format:check`가 0이 아닌 종료 코드로 끝난다(검사가 실제로 동작함을 대조 확인). 또 `scripts/__lint_probe.mjs`(내용 `var a = ;` — 두 도구가 모두 거부하는 구문 오류)를 두면 `pnpm lint`와 `pnpm format:check`가 모두 0이 아닌 종료 코드로 끝난다(`scripts/`가 두 검사 모두에 포함됨을 확인). 확인 후 임시 파일을 모두 지운다
- **And** `.gitattributes`가 텍스트 파일을 LF로 정규화하고, `git ls-files --eol | Select-String -SimpleMatch 'i/crlf'` 결과가 0건이다(같은 명령에서 `Select-String -SimpleMatch 'i/lf'` 결과는 1건 이상)

### AC-INFRA-011 — 환경 변수 예시 파일과 비밀 값 제외

- **Given** 저장소가 준비되어 있고 PostgreSQL 컨테이너가 `healthy` 상태다(AC-INFRA-001)
- **When** `pnpm test`를 실행하고, `git check-ignore -q .env`와 `git check-ignore -q .env.example`을 각각 실행한다
- **Then** 저장소 규칙 테스트가 `.env.example`에서 주석이 아닌 줄이 1개 이상이고 모두 정규식 `^[A-Z][A-Z0-9_]*=$`에 맞음(값 없음)을 확인하며, `DATABASE_URL`, `PAYLOAD_SECRET`, `NEXT_PUBLIC_SERVER_URL`과 Compose용 PostgreSQL 변수 이름(사용자·비밀번호·DB 이름·호스트 포트)이 모두 있음을 확인한다
- **And** `git check-ignore -q .env`는 종료 코드 0(무시됨), `git check-ignore -q .env.example`은 종료 코드 1(추적됨)이다

## 2. 예외·경계 시나리오

### AC-INFRA-012 — 필수 환경 변수 누락 시 시작 전 종료

- **Given** `.env`를 `.env.bak`으로 복사해 두고, `.env`에서 `PAYLOAD_SECRET` 줄을 지웠다
- **When** `Measure-Command { pnpm dev *> missing-env-dev.log }`와 `Measure-Command { pnpm test *> missing-env-test.log }`를 각각 실행한다
- **Then** 두 명령 모두 스스로 끝나고, 각 `TotalSeconds`가 30 미만이며, 각 `$LASTEXITCODE`가 0이 아니다
- **And** 두 로그 모두 `Select-String -SimpleMatch 'PAYLOAD_SECRET'`과 `Select-String -SimpleMatch '.env.example'`이 1건 이상 일치한다
- **And** `missing-env-dev.log`에 Next.js 서버 준비 표시(`Ready`, `Local:`)가 0건이다(서버가 포트를 열기 전에 끝났음)
- **And** 두 로그 모두 `.env.bak`에 적힌 PostgreSQL 비밀번호 값이 0건이다
- **And** 환경 변수 검증 로직의 단위 테스트가 `DATABASE_URL`만 없는 경우, `PAYLOAD_SECRET`만 없는 경우, 둘 다 없는 경우, 빈 문자열인 경우에 각각 누락된 변수 이름 전부를 오류에 담는지 확인한다
- 정리: `.env.bak`을 `.env`로 되돌리고 로그 파일을 지운다

### AC-INFRA-013 — 호스트 포트 환경 변수 재정의

- **Given** 데이터베이스를 `docker compose down`으로 내렸고, `.env`의 호스트 포트 변수를 `5433`으로, `DATABASE_URL`의 포트도 `5433`으로 바꿨다
- **When** `docker compose up -d`를 실행하고 `docker compose port postgres 5432`를 실행한다
- **Then** 두 번째 명령 출력이 `:5433`으로 끝난다
- **And** `git diff --exit-code -- docker-compose.yml`이 종료 코드 0이다(Compose 파일은 수정하지 않음)
- **And** 이 상태에서 AC-INFRA-006이 통과한다
- 정리: 포트 값을 원래대로 되돌리고 `docker compose up -d`를 다시 실행한다
- 참고: 다른 프로그램이 5432를 점유해 Docker가 실패하는 상황은 Windows·Docker Desktop의 바인딩 방식에 따라 재현이 일정하지 않으므로, 이 기준은 재정의 동작 자체를 검증한다. 충돌 상황의 해결 절차는 README 문제 해결 절에 둔다(AC-INFRA-016).

### AC-INFRA-014 — 데이터베이스 미실행

- **Given** `docker compose stop postgres`로 DB를 멈췄다
- **When** `Measure-Command { pnpm test *> db-down-test.log }`와 `Measure-Command { pnpm dev *> db-down-dev.log }`를 각각 실행한다
- **Then** 각 `TotalSeconds`가 60 미만이고 각 `$LASTEXITCODE`가 0이 아니다
- **And** 두 로그 모두 데이터베이스 연결 실패 안내, 접속 대상 호스트·포트·DB 이름, `docker compose up -d`가 나타난다(`Select-String -SimpleMatch 'docker compose up -d'` 1건 이상)
- **And** `db-down-dev.log`에 Next.js 서버 준비 표시(`Ready`, `Local:`)가 0건이다
- **And** 두 로그 모두 `.env`의 PostgreSQL 비밀번호 값과 `PAYLOAD_SECRET` 값이 0건이다(`Select-String -SimpleMatch '<값>'`)
- 정리: `docker compose start postgres`, 로그 파일 삭제

### AC-INFRA-015 — E2E 포트 충돌

- **Given** 다른 터미널에서 `node -e "require('net').createServer().listen(<E2E 전용 포트>)"`로 E2E 전용 포트를 점유했다
- **When** `Measure-Command { pnpm e2e *> e2e-port.log }`를 실행한다
- **Then** `TotalSeconds`가 30 미만이고 `$LASTEXITCODE`가 0이 아니다
- **And** 로그에 E2E 전용 포트 번호와 포트가 이미 사용 중이라는 안내가 나타난다
- **And** 로그에 Playwright 테스트 통과 보고(`passed`)가 0건이다
- 정리: 점유 프로세스를 종료하고 로그 파일을 지운다

### AC-INFRA-016 — README 개발 환경 안내

- **Given** `README.md`가 갱신되었다
- **When** 내용을 확인한다
- **Then** 한국어로 다음 항목이 이 순서대로 있다: 사전 준비(Node.js LTS 설치와 `node -v` 확인, pnpm 활성화와 `pnpm -v` 확인, Docker Desktop), 환경 변수 설정(`.env.example` 복사), DB 실행, 의존성 설치, Playwright 브라우저 설치, 개발 서버 실행, 첫 관리자 계정 생성, 테스트 실행(`pnpm test`, `pnpm e2e`), 문제 해결(5432·E2E 포트 충돌, DB 미실행, OneDrive 동기화, Corepack 권한 오류)
- **And** `Select-String -Path README.md -SimpleMatch '사전 준비'`, `'환경 변수'`, `'문제 해결'`이 각각 1건 이상 일치한다
- **And** README에 적힌 명령을 위에서부터 그대로 따라 했을 때 AC-INFRA-001, 002, 004, 006, 008이 통과한다(run-phase 실행자가 1회 확인하고 결과를 기록)

## 3. 품질 게이트

| 항목 | 기준 | 검증 명령 |
|---|---|---|
| 타입 | 오류 0건 | `pnpm typecheck` |
| 빌드 | 종료 코드 0 | `pnpm build` |
| 단위·통합·저장소 규칙 테스트 | 전부 통과 | `pnpm test` |
| 커버리지 | `src/lib/` 합산 라인 85% 이상 | `pnpm test`(임계값 내장) |
| E2E | 스모크 전부 통과 | `pnpm e2e` |
| 린트 | 오류 0건(검사 대상 코드) | `pnpm lint` |
| 포맷 | 차이 0건(검사 대상 코드) | `pnpm format:check` |
| 비밀 값 | 추적 파일에 비밀 값 0건 | AC-INFRA-011 |

TRUST 5 대응: Tested(AC-INFRA-006·008), Readable(AC-INFRA-010 린트), Unified(AC-INFRA-010 포맷·줄바꿈), Secured(AC-INFRA-011·012·014), Trackable(Conventional Commits, 커밋 메시지에 `SPEC-INFRA-001` 표기).

## 4. 완료 정의 (Definition of Done)

- [ ] AC-INFRA-001 ~ AC-INFRA-016이 모두 통과했고, 각 명령과 출력 요약이 `progress.md` §E.2에 기록되었다
- [ ] AC-INFRA-007(수동 검증) 결과가 기록되었다
- [ ] 품질 게이트 표의 모든 명령이 같은 커밋에서 통과했다
- [ ] `.env`, `.env.bak`, 비밀 값, 검증용 로그 파일, 임시 검사 파일이 커밋에 포함되지 않았다
- [ ] `spec.md` §5 제외 범위 항목이 구현에 섞이지 않았다(`src/collections/`에 `Users` 외 컬렉션 파일 없음)
