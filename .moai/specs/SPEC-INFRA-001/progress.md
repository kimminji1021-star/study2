# SPEC-INFRA-001 진행 기록

## §E.1 Plan-phase Audit-Ready Signal

```yaml
plan_status: audit-ready
plan_complete_at: 2026-11-08
tier: M
artifacts: [spec.md, plan.md, acceptance.md, spec-compact.md]
author: manager-spec
```

## §E.2 Run-phase Evidence

긴 명령 출력은 `.moai/state/verify/a08890a8/m1/` 아래 파일로 남겼다(로컬 전용, gitignore 대상). 아래 표는 종료 코드와 짧은 끝부분만 적는다. 기준 트리: M1 커밋 직전 HEAD `4c3d031`.

### M1 — 부트스트랩 방식과 버전 고정

**실행 환경**

| 항목 | 값 | 근거 |
|---|---|---|
| OS | Windows 11 Pro 10.0.26300 | 세션 환경 |
| Node.js | v24.22.1 | `node -v` |
| 전역 pnpm | 12.18.0 (Corepack) | `pnpm -v` (저장소 밖) |
| 프로젝트 pnpm | 11.28.9 | `packageManager` 지정 후 Corepack이 자동 전환, 설치 로그 `Done in … using pnpm v11.28.9` |
| PowerShell | 5.1 (오케스트레이터 측정값) | 실행 에이전트의 셸은 Git Bash. PowerShell 직접 실행은 작업 트리 격리 가드가 막아 이번 M1에서 재측정하지 못함(아래 미검증 항목) |

**템플릿 확보 방식**

- 1차: `pnpm dlx create-payload-app@3.93.0 --help` → 비대화형 플래그 `-n`, `-t`, `--no-deps`, `--no-agent` 확인. `-t with-postgres` 실행 결과 `'with-postgres' is not a valid template.`(허용 목록: blank, website, ecommerce, with-cloudflare-d1, plugin), 종료 코드 1. 로그 `cpa-run.log`
- 2차(채택): 공식 저장소 `https://github.com/payloadcms/payload` 태그 `v3.93.0`(커밋 `77425c50f7f2074e728d13c577eb37c246f1e0c5`)을 `git clone --depth 1 --filter=blob:none --sparse --branch v3.93.0` 후 `sparse-checkout set templates/with-postgres`로 받아 저장소 밖 임시 디렉터리에 복사. clone·sparse 종료 코드 0. 로그 `clone.log`
- 태그 시점 템플릿 상태(plan.md §B.4는 main 브랜치 기준이라 일부 다름): `payload`·`@payloadcms/*` 3.92.1, `next` 16.3.3, `typescript` 5.7.3, `vitest` 4.0.18, 포매터는 Prettier(oxfmt 없음), `@payloadcms/transformer-sharp` 없음, `sharp` 0.35.4와 `Media` 컬렉션 있음

**루트로 가져온 파일과 미룬 파일**

- M1에서 만든 파일: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.json`(템플릿 기반, `baseUrl` 제거·`**/*.mts` 포함), `vitest.config.mts`(M1 최소 설정), `tests/unit/repo-rules.spec.ts`
- 가져오지 않은 것: `Media`, `sharp`, `Dockerfile`, `.yarnrc`, `.vscode/`, `devsafe`·`ci` 스크립트, 템플릿 `docker-compose.yml`·`.env.example`(M2에서 새로 작성), `.gitignore`·`README.md`(덮어쓰지 않음)
- 다음 마일스톤으로 미룬 템플릿 파일: `next.config.ts`, `src/payload.config.ts`, `src/collections/Users.ts`, `src/app/(payload)/**`, `src/app/(frontend)/**`, `eslint.config.mjs`, `playwright.config.ts`, 템플릿 테스트. M3(`Users`)와 M4(홈 페이지)는 실패하는 테스트를 먼저 쓰는 순서이므로, 지금 가져오면 해당 테스트가 처음부터 통과해 RED 단계가 사라진다. 템플릿 원본은 위 태그·커밋으로 다시 받을 수 있다

**버전 결정**

| 항목 | 채택 | 근거 |
|---|---|---|
| pnpm | 11.28.9 | `npm view pnpm dist-tags` → `latest-11: 11.28.9`, `next-11: 11.28.11`, `latest: 12.18.0`. R5에 따라 템플릿 engines(`^9 \|\| ^10 \|\| ^11`) 안의 11 계열 중 pnpm 팀이 안정판으로 지정한 `latest-11`을 골랐다. 11.28.10·11.28.11은 `next-11` 태그라 쓰지 않음 |
| TypeScript | 6.0.3 (7.0.2 대신) | R6. 7.0.2에서 `pnpm typecheck`(`tsc --noEmit`)는 종료 코드 0(`typecheck-ts7.log`). Next 16.4.5는 기본값 `experimental.useTypeScriptCli: true`로 TS CLI를 쓰므로 빌드는 7도 가능해 보임. 그러나 M6의 `eslint-config-next`가 쓰는 `typescript-eslint` 8.72.1의 peer가 `typescript >=4.8.4 <6.1.0`이고, 7.0.2 패키지의 `require('typescript')`는 `version`·`versionMajorMinor`만 내보낸다(`createSourceFile: undefined`). 임시 디렉터리에서 TS 7.0.2 + `@typescript-eslint/parser@8.72.1`로 파싱을 시도한 결과 `Error: typescript-eslint does not support TS 7.0.`로 실패(`ts7-parser-probe.log`). plan.md §B.3의 린트 구성이 동작하지 않으므로 6.x 최신 안정판 6.0.3으로 내렸고, 6.0.3에서 `pnpm typecheck` 종료 코드 0(`typecheck-ts6.log`) |
| payload, @payloadcms/{db-postgres,next,richtext-lexical,ui} | 3.93.0 (범위 기호 없음) | plan.md §B.1 |
| next / react / react-dom | 16.4.5 / 19.3.1 / 19.3.1 | plan.md §B.1. `@payloadcms/ui` peer react `^19.0.1 \|\| ^19.1.2 \|\| ^19.2.1`을 만족 |
| graphql | 16.15.0 | payload peer `^16.8.1`. `latest`인 17.1.0은 peer 범위 밖이라 16 계열 최신을 씀 |
| cross-env | 10.1.0 | 템플릿 의존성, 최신 안정판 |
| vitest / semver / @types/semver / @types/node | 5.1.0 / 7.8.6 / 7.8.0 / 24.19.2 | 테스트 실행용, 설치 시점 안정판 |

**pnpm 설정 (R18)**

- 설정 위치: `pnpm-workspace.yaml`. pnpm 문서(https://pnpm.io/settings)는 "Only auth, registry, TLS, proxy, and `local-address` settings are read from `.npmrc` files"라고 적는다. `.npmrc`는 만들지 않았다
- 빌드 스크립트 허용 설정 이름: `allowBuilds`(맵). https://pnpm.io/11.x/settings/build 주소는 최신(12.x) 문서로 연결되어(canonical `https://pnpm.io/settings/build`) 11.x 전용 문서를 따로 확인하지 못했다. 같은 문서의 이전 설정 안내에 따르면 `onlyBuiltDependencies` 등은 `allowBuilds`로 바뀌었다. 11.28.9 실측: 설정 없이 설치하면 `[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild@0.18.20, esbuild@0.25.12, esbuild@0.28.2`로 종료 코드 1(`install1.log`), `allowBuilds: { esbuild: true }`를 넣으면 esbuild postinstall 3건 실행 후 종료 코드 0(`install2.log`). `sharp`는 의존성 트리에 없고 허용 목록에도 넣지 않음
- `engineStrict: true` 추가(계획에 없던 설정, 아래 nodeVersion 실측 참고)

**AC 검증**

| AC | 명령 | 종료 코드 | 결과 끝부분 | 로그 |
|---|---|---|---|---|
| AC-INFRA-002 설치 재현 | `pnpm install --frozen-lockfile` (node_modules 삭제 후) | 0 | `Done in 11.1s using pnpm v11.28.9`, `WARN` 0줄 | `frozen-clean.log`, `ac002-frozen-final.log` |
| AC-INFRA-002 peer 경고 | `pnpm peers check` | — | 남은 항목 1건: `✕ unmet peer esbuild` (설치 0.25.12, `vite@8.3.6`가 `^0.27.0 \|\| ^0.28.0` 요구). payload·`@payloadcms/*`·next 관련 항목 없음 | — |
| AC-INFRA-002 범위 밖 Node 거부 | `pnpm install --frozen-lockfile --config.node-version=25.0.0` | 1 | `Your Node version is incompatible with "…". Expected version: ^22.23.4 \|\| ^24.22.1 \|\| >=26.0.0 Got: 25.0.0` | `ac002-node25.log` |
| AC-INFRA-002 경계값 | 같은 명령, `--config.node-version=` 22.23.4 / 24.22.1 / 26.0.0 / 22.23.3 / 24.22.0 | 0 / 0 / 0 / 1 / 1 | node_modules 삭제 후 22.23.4로 설치 시 종료 코드 0, `WARN` 0줄 | `ac002-node-*.log`, `ac002-clean-22.23.4.log` |
| AC-INFRA-002·005 저장소 규칙 | `pnpm test --reporter=verbose` | 0 | `Tests  11 passed (11)` | `green-final.log` |

**nodeVersion 덮어쓰기 형식 (pnpm 11.28.9 실측)**

- `--node-version=25.0.0` → `[ERROR] Unknown option: 'node-version'`, 종료 코드 1(엔진 검사가 아니라 옵션 오류). 사용 불가
- `--config.node-version=25.0.0` → 값은 적용되지만 `engineStrict`가 없으면 `[WARN] Unsupported engine … (current: {"node":"25.0.0","pnpm":"11.28.9"})`만 출력하고 종료 코드 0(`node25b.log`, node_modules 삭제 후에도 0 — `node25c.log`)
- 채택 형식: `pnpm install --frozen-lockfile --config.node-version=25.0.0` + `pnpm-workspace.yaml`의 `engineStrict: true` → 종료 코드 1. pnpm 문서 문구("installation will always fail if a project … specifies an incompatible version")는 11.28.9 동작과 다르다

**TDD 기록**

- RED: 1단계로 테스트 도구만 있는 `package.json`(vitest·semver·타입)을 설치한 뒤 테스트를 먼저 작성해 실행. `pnpm exec vitest run --reporter=verbose` 종료 코드 1, `Tests  10 failed | 1 passed (11)`. 실패 메시지 예: `package.json에 packageManager가 있어야 한다: expected undefined to be type of 'string'`, `payload가 직접 의존성에 있어야 한다: expected [] to include 'payload'`(`red-verbatim.log`). 통과한 1건은 "직접 의존성이 정식 안정 버전" 검사로, 1단계 의존성도 이미 조건을 만족했다
- GREEN: `package.json` 확정, `pnpm-workspace.yaml` 작성, pnpm 11.28.9로 재설치 → `Tests  11 passed (11)`
- 변이 확인: `engines.node`를 템플릿 값 `^22.23.4 || >=24.22.1`로 잠시 바꾸면 `Tests  2 failed | 9 passed (11)`(지원 범위 부분집합 검사, 25.0.0 제외 검사 실패). 되돌린 뒤 11건 통과(`mutation-engines.log`, `green-after-mutation-revert.log`)

**계획과 다른 점**

1. 템플릿을 `create-payload-app`이 아니라 공식 저장소 태그의 sparse clone으로 받음(CLI가 `with-postgres`를 지원하지 않음)
2. TypeScript 7.0.2 대신 6.0.3(R6, 근거는 위 표)
3. `pnpm-workspace.yaml`에 `engineStrict: true` 추가(REQ-INFRA-001의 실패 조건을 pnpm 11.28.9에서 만족시키기 위함)
4. M1에서 가져오지 않은 템플릿 파일은 해당 마일스톤으로 미룸(위 목록)
5. `graphql`은 17이 아닌 16.15.0(payload peer 범위)
6. M1용 스크립트는 `test`(`vitest run`), `typecheck`(`tsc --noEmit`) 2개뿐. 나머지와 시작 전 점검 연결은 M2·M6

**미검증 항목**

- PowerShell 5.1·7에서 같은 명령 재실행: 실행 에이전트의 `powershell.exe` 호출이 작업 트리 격리 가드에 막혀 못 함. Git Bash에서만 실행
- `pnpm build`·`next build`와 TypeScript 6.0.3 조합: 앱 소스가 아직 없어 M3·M4에서 확인
- 린트: 아직 구성 전(M6)
- AC-INFRA-002·005의 Given에 있는 "PostgreSQL `healthy`"와 `pnpm test`의 DB 시작 전 점검: M2 범위. 이번 테스트는 DB 없이 실행
- `vite`의 선택적 peer `esbuild` 불일치(0.25.12 vs `^0.27 || ^0.28`): AC 대상(payload·`@payloadcms/*`·next) 밖이라 손대지 않음. `pnpm install` 출력 끝에 `Issues with peer dependencies found` 요약 줄이 남는다(재해석이 일어나는 설치에서만, 잠금 파일 그대로 설치하는 `--frozen-lockfile`에서는 출력 없음)

### M2 — 환경 변수 계약, 시작 전 점검, 로컬 DB

긴 출력은 `.moai/state/verify/a08890a8/m2/`(로컬 전용). 기준 트리: M2 커밋 직전 HEAD `65917e9`. 실행 셸: Git Bash(PowerShell은 작업 트리 격리 가드가 막아 실행하지 못함 — `Measure-Command` 대신 Node `performance.now()`로 시간 측정). Docker Engine 29.9.2, Compose v5.6.1.

**만든·바꾼 파일**

| 파일 | 내용 |
|---|---|
| `docker-compose.yml` (신규) | `postgres:17-alpine` 서비스 1개, 이름 있는 볼륨 `postgres-data` → `/var/lib/postgresql/data`, `pg_isready` healthcheck, 사용자·비밀번호·DB 이름은 `${VAR:?…}`로 `.env`에서 필수 치환(`POSTGRES_HOST_AUTH_METHOD` 없음 → 이미지 기본 `scram-sha-256`), 포트 `'127.0.0.1:${POSTGRES_PORT:-5432}:5432'`, 최상위 `name: sumbi-tour` |
| `.env.example` (신규) | 이름만 8개(`DATABASE_URL`, `PAYLOAD_SECRET`, `NEXT_PUBLIC_SERVER_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `E2E_PORT`). 설명은 `#` 주석으로만, 빈 줄 없음 |
| `.gitignore` | 끝에 `coverage/`, `playwright-report/`, `test-results/`, `blob-report/` 4줄과 구역 주석만 추가. 기존 줄 변경 없음 |
| `src/lib/preflight.ts` (신규) | 필수 변수 검사(`findMissingEnv`·`assertRequiredEnv`), `DATABASE_URL` 접속 대상 해석(비밀번호 제외), TCP 접속 확인(5초 제한), 포트 점유 확인, 명령별 점검 순서(`runPreflight`) |
| `scripts/preflight.mjs` (신규) | `.env` 로드 후 `runPreflight` 실행. 종료 코드 0/1/2 |
| `package.json` | `test` = `node scripts/preflight.mjs test && vitest run`, devDependency `yaml` 2.9.1 추가 |
| `pnpm-lock.yaml` | `yaml@2.9.1` 추가에 따른 갱신만 |
| `tests/unit/repo-rules.spec.ts` | Compose 6건(AC-INFRA-001), `.env.example` 2건(AC-INFRA-011) 추가. 각 검사는 대상 1건 이상을 먼저 단언 |
| `tests/unit/preflight.spec.ts`, `tests/unit/preflight-cli.spec.ts` (신규) | 점검 로직 단위 테스트 51건, 진입점 실행 테스트 3건 |

로컬 `.env`는 작업 트리에만 만들었다(무작위 비밀번호·`PAYLOAD_SECRET`, git 무시 대상, 커밋 안 함). 값은 어떤 로그에도 출력하지 않았다.

**결정과 근거**

- `name: sumbi-tour`: 이름이 없으면 Compose 프로젝트 이름이 체크아웃 디렉터리 이름(작업 트리 `agent-…` vs `study2`)이 되어, 같은 저장소의 다른 작업 트리에서 실행할 때 컨테이너와 볼륨이 따로 생기고 같은 5432 포트를 두고 충돌한다. 실측 볼륨 이름 `sumbi-tour_postgres-data`. 대가: 여러 체크아웃이 하나의 DB를 함께 쓴다(로컬 개발 DB는 하나라는 전제와 맞음)
- 포트를 `127.0.0.1`에 묶음: 같은 PC 밖(LAN)에 DB를 열지 않기 위함. `docker compose port postgres 5432` 출력은 `127.0.0.1:<포트>`이며 AC-INFRA-013의 "`:5433`으로 끝남" 조건과 맞는다. `DATABASE_URL`도 `localhost` 대신 `127.0.0.1`을 써서 IPv6 우선 해석 차이를 피했다
- `.env` 로드는 `dotenv` 대신 Node 내장 `process.loadEnvFile()`: 지원 범위(22.23.4 이상)에 모두 있고 의존성이 늘지 않는다. 이미 설정된 변수를 덮어쓰지 않음을 실측(스크래치 디렉터리에서 `A=keep` 유지 확인) — 나중에 `cross-env`로 넘기는 값이 `.env`보다 우선한다
- 점검 로직은 `src/lib/preflight.ts` 한 파일: `scripts/preflight.mjs`가 Node의 타입 제거 기능으로 직접 불러온다(Node 24.22.1에서 경고 없이 동작 확인). 다른 `.ts` 파일을 import하면 `.ts` 확장자 import와 `allowImportingTsExtensions` 설정이 필요해지므로 한 파일로 두었다. 그래서 계획의 예시 이름 `config-check.ts` 대신 `preflight.ts`(B.5 무시 규칙에 걸리지 않음 — `git check-ignore -v` 결과 없음)
- 오류 메시지는 영어(`language.yaml` `error_messages: en`)
- Compose 원문 YAML 검사를 위해 devDependency `yaml` 2.9.1(설치 시점 `latest`) 추가. `docker compose config`는 `${…}` 치환을 풀어 버려 포트 치환 형태를 검사할 수 없다
- 시작 전 점검은 현재 존재하는 `test` 스크립트에만 연결. `dev`·`build`·`start`·`e2e`는 아직 스크립트가 없어(M3·M4·M5에서 생김) 연결하지 않았다. `assertRequiredEnv`는 Payload 설정 로드 시 재검증용으로 만들어 두었고, 설정 파일이 생기는 M3에서 연결한다

**TDD 기록**

- RED: 테스트와 `yaml` 의존성만 추가한 상태에서 `pnpm exec vitest run` → 종료 코드 1, `Test Files  3 failed (3)`, `Tests  11 failed | 11 passed (22)`. `preflight.spec.ts`는 `Error: Cannot find module '../../src/lib/preflight'`, Compose·`.env.example` 검사는 `ENOENT: no such file or directory, open '…docker-compose.yml'` / `'….env.example'`, CLI 검사는 `Cannot find module '…scripts\preflight.mjs'`(`red-verbatim.log`)
- GREEN: 구현 후 `Tests  65 passed (65)`(`green-vitest.log`). `pnpm typecheck`가 테스트 쪽 유니온 좁히기 누락으로 14건 실패 → 테스트에 `messageOf()` 보조 함수를 두는 정리(REFACTOR) 후 종료 코드 0
- 변이 확인: Compose 이미지를 `postgres:latest`, 포트를 `'5432:5432'`로 바꾸면 `Tests  2 failed | 17 passed (19)`(이미지 태그·포트 치환 검사 실패, `mutation-compose.log`). 원본 복원 후 `git hash-object docker-compose.yml` = `73ab9ec…`(변이 전과 같음)

**AC 검증** (모두 이 작업 트리, HEAD `65917e9` + 위 변경)

| AC | 명령 | 종료 코드 | 시간 | 결과 끝부분 |
|---|---|---|---|---|
| AC-INFRA-001 기동 | `docker compose pull` 후 `docker compose up -d` → `docker compose ps --format '{{.Service}} {{.Health}}'` 반복 확인 | 0 | 6.8초(새 볼륨 초기화 포함) | `postgres healthy` |
| AC-INFRA-001 저장소 규칙 | `pnpm test --reporter=verbose` | 0 | — | Compose 6건 통과(`green-final.log`) |
| AC-INFRA-001 영속성 | `docker compose exec -T postgres psql -U sumbi -d sumbi_tour -c 'CREATE TABLE infra_persist_check (id int);'` → `docker compose down`(볼륨 유지, `docker volume ls` = `sumbi-tour_postgres-data`) → `up -d` + healthy 6.5초 → `-tAc "SELECT to_regclass('public.infra_persist_check');"` | 0 | — | `infra_persist_check`. 정리: `DROP TABLE` 완료 |
| AC-INFRA-001 비밀번호 인증(추가 확인) | `docker run --rm --network sumbi-tour_default -e PGPASSWORD=wrong-password postgres:17-alpine psql -h postgres -U sumbi -d sumbi_tour -c 'select 1'` | 2 | — | `FATAL:  password authentication failed for user "sumbi"`. 참고: 컨테이너 안 루프백(`-h 127.0.0.1`)은 이미지 기본 `pg_hba.conf`가 trust라 틀린 비밀번호로도 접속됨 — 컨테이너 밖 접속은 비밀번호 필요 |
| AC-INFRA-011 저장소 규칙 | `pnpm test` | 0 | — | `.env.example` 2건 통과 |
| AC-INFRA-011 ignore | `git check-ignore -q .env` / `git check-ignore -q .env.example` | 0 / 1 | — | `.env` 무시, `.env.example` 추적(`.gitignore:128:!.env.example`) |
| AC-INFRA-012 (test) | `.env`→`.env.bak` 복사, `PAYLOAD_SECRET` 줄 삭제 후 `pnpm test`(출력 → `missing-env-test.log`) | 1 | 0.66초 | `[preflight] Missing required environment variables: PAYLOAD_SECRET.` / `Copy .env.example to .env …`. `PAYLOAD_SECRET` 1건, `.env.example` 1건, `Ready`·`Local:` 0건, `.env.bak`의 비밀번호·`PAYLOAD_SECRET` 값 0건. 정리: `.env.bak` → `.env` 복원 후 `pnpm test` 65건 통과 |
| AC-INFRA-012 단위 | `pnpm test` | 0 | — | `DATABASE_URL`만·`PAYLOAD_SECRET`만·둘 다·빈 문자열(공백 포함) 4가지 + 메시지 값 미노출 검사 통과 |
| AC-INFRA-013 | `docker compose down` → `.env`의 `POSTGRES_PORT=5433`, `DATABASE_URL` 포트 5433 → `up -d`(healthy 6.5초) → `docker compose port postgres 5432` | 0 | — | `127.0.0.1:5433`. `git hash-object docker-compose.yml` 전후 모두 `73ab9ec330afe71c9d05b0169c818177f444b83b`(파일이 아직 미커밋이라 `git diff --exit-code` 대신 해시로 비교). 이 상태에서 `pnpm test` 종료 코드 0(시작 전 점검이 5433으로 접속). 정리: 포트 복원 → `127.0.0.1:5432` 확인 |
| AC-INFRA-014 (test) | `docker compose stop postgres` 후 `pnpm test`(출력 → `db-down-test.log`) | 1 | 0.58초 | `[preflight] Database connection failed: cannot reach PostgreSQL at 127.0.0.1:5432 (database: sumbi_tour) - ECONNREFUSED.` / `Start the local database with: docker compose up -d`. `docker compose up -d` 1건, 비밀번호·`PAYLOAD_SECRET` 값 0건. 정리: `docker compose start postgres` → healthy 5.0초 |
| E2E 포트 점검(M5 선행) | AC-INFRA-015 방식(`net.createServer().listen(3100)`)으로 점유 후 `node scripts/preflight.mjs e2e` | 1 | 0.09초 | `[preflight] E2E port 3100 is already in use by another process (EADDRINUSE).` 점유 해제 후 같은 명령 종료 코드 0 |
| 타입 | `pnpm typecheck` | 0 | — | `tsc --noEmit` 오류 0 |

**미검증 항목**

- AC-INFRA-012·014의 `pnpm dev` 부분: `dev` 스크립트가 아직 없음(M3·M4). 연결은 그때 같은 `node scripts/preflight.mjs dev && …` 형태로 한다
- PowerShell 5.1·7과 `Measure-Command`: 실행하지 못함(Git Bash만). 시간은 Node `performance.now()`로 측정
- `src/lib/` 커버리지 수치: 커버리지 공급자(`@vitest/coverage-v8`)가 M5 범위라 측정하지 않음
- Payload 설정 로드 시 재검증 연결: 설정 파일이 없어 M3으로 미룸(함수와 테스트는 있음)
- AC-INFRA-013의 "이 상태에서 AC-INFRA-006 통과": AC-INFRA-006(통합 테스트·커버리지)이 M3·M5 범위라, 이번에는 시작 전 점검이 5433으로 접속해 `pnpm test`가 통과하는 것까지만 확인
- 실행 도중 정리: 시나리오 로그는 `.moai/state/verify/a08890a8/m2/`에 남겼고(비밀 값 0건 확인), `.env.bak`은 모두 `.env`로 되돌려 남아 있지 않음

**남은 위험**

- E2E 포트 점검은 모든 주소(`::` 이중 스택)에 바인딩해 본다. 점유 프로세스가 `127.0.0.1`에만 바인딩하면 Windows에서 충돌을 못 잡을 수 있다(M5에서 Next 개발 서버의 실제 바인딩 주소와 함께 확인)
- `docker compose` 하위 명령은 `ps`까지 포함해 `.env`에 `POSTGRES_USER`·`POSTGRES_PASSWORD`·`POSTGRES_DB` 값이 없으면 `${VAR:?…}` 때문에 실패한다. 실측: `docker compose --env-file .env.example ps` → 종료 코드 1, `required variable POSTGRES_DB is missing a value: set POSTGRES_DB in .env (see .env.example)`(USER·PASSWORD도 같은 형식). README(M7)에 `.env` 준비를 DB 실행보다 먼저 안내해야 한다

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_

## §F Phase 4 Mode Selection

| 모드 | 선택 | 이유 |
|---|---|---|
| direct | 아니오 | 다중 파일 구현 작업 |
| serial | 예 | 코딩 위주 작업, 마일스톤별 순차 위임 |
| fanout | 아니오 | 연구형 다중 도메인 작업이 아님 |
| sweep | 아니오 | 단일 규칙의 대량 기계적 변환이 아님 |

Decision: serial

Kickoff: Implementation Kickoff Approval given by the user in session a08890a8 on 2026-11-09. Progression mode: semi-autonomous (per-milestone checkpoint). Commits to main allowed; push held for separate user approval.
