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

### M3 — 관리자 인증 컬렉션 `Users`

긴 출력은 `.moai/state/verify/a08890a8/m3/`(로컬 전용). 기준 트리: M2 커밋 `27cae41` + 아래 변경. 실행 셸: Git Bash. 시간은 Node `performance.now()`(시나리오 스크립트)로 측정. Node 24.22.1, pnpm 11.28.9.

**만든·바꾼 파일**

| 파일 | 내용 |
|---|---|
| `src/collections/Users.ts` (신규) | slug `users`, `auth: true`(이메일·비밀번호), `admin.useAsTitle: 'email'`, 추가 필드 없음 |
| `src/payload.config.ts` (신규) | 템플릿 기반. 컬렉션은 `Users`만, `@payloadcms/db-postgres`(`DATABASE_URL`), `secret: PAYLOAD_SECRET`, `serverURL: NEXT_PUBLIC_SERVER_URL ?? ''`, `lexicalEditor()`, 타입 출력 경로. Media·sharp·localization·email 없음. 모듈 최상단에서 M2의 `assertRequiredEnv(process.env)` 호출 |
| `next.config.ts` (신규) | 템플릿에서 Media용 `images.localPatterns`만 뺌. `withPayload(..., { devBundleServerPackages: false })`, `turbopack.root`, webpack `extensionAlias` 유지 |
| `src/app/(payload)/**` (템플릿 그대로 8개) | `layout.tsx`, `custom.scss`(빈 파일), `admin/[[...segments]]/{page,not-found}.tsx`, `api/[...slug]/route.ts`, `api/graphql/route.ts`, `api/graphql-playground/route.ts`, `admin/importMap.js`(생성 명령으로 다시 씀 — 내용은 템플릿과 같음) |
| `src/payload-types.ts` (생성물) | `pnpm generate:types` 결과 296줄 |
| `vitest.config.mts` | `projects`로 `unit`(tests/unit) / `integration`(tests/integration, `setupFiles`, `fileParallelism: false`, 제한 시간 60초) 분리. 둘 다 Node 환경. 커버리지는 M5 |
| `tests/integration/setup-env.ts` (신규) | 저장소 루트 `.env`를 `process.loadEnvFile`로 읽음(시작 전 점검 프로세스의 환경은 Vitest로 이어지지 않음) |
| `tests/integration/users-auth.spec.ts` (신규) | 컬렉션 slug 검사(접두어 `payload-` 필터 주석 포함), 생성 → 올바른 비밀번호 로그인(토큰) → 틀린 비밀번호(`AuthenticationError`, 토큰 없음) → 삭제·재조회 0건. 실행마다 `integration-<UUID>@example.test` 고유 주소, `afterAll`에서 실패와 상관없이 삭제 후 `payload.destroy()` |
| `tests/integration/config-env.spec.ts` (신규) | 설정 로드 시 재검증: `PAYLOAD_SECRET`만 빈 경우, 두 변수 모두 빈(공백) 경우 이름과 `.env.example` 안내를 담은 오류 |
| `package.json` | 스크립트 `dev`·`build`·`start`(앞에 `node scripts/preflight.mjs <명령> &&`), `generate:types`·`generate:importmap`(`cross-env NODE_OPTIONS=--no-deprecation payload …`). devDependency `@types/react`·`@types/react-dom` 19.3.0(정확 고정) |
| `pnpm-lock.yaml` | 위 두 타입 패키지 추가분만 |
| `.gitignore` | 끝에 `next-env.d.ts` 1줄과 구역 주석만 추가 |

**결정과 근거**

- `serverURL`은 값이 없을 때 `undefined`가 아니라 빈 문자열: Payload 3.93.0 `config/sanitize.js`가 `if (config.serverURL !== '') config.csrf.push(config.serverURL)`로 처리해, `undefined`면 CSRF 허용 목록에 `undefined`가 들어간다(소스 확인). 반대로 값이 있으면 CSRF 허용 목록에 자동으로 들어가므로 `csrf`를 따로 적지 않았다(R14 확인은 M5)
- `lexicalEditor()` 유지: M1에서 `@payloadcms/richtext-lexical`을 의존성으로 고정했고 템플릿 기본 편집기다. 리치 텍스트 필드가 아직 없어 import map에는 lexical 항목이 생기지 않았다(`CollectionCards` 1개뿐)
- `@types/react`·`@types/react-dom` 추가: `.tsx` 라우트 파일 타입 검사에 필요(템플릿도 devDependency로 둠). 설치 시점 최신 19.3.0, react 19.3.1과 같은 메이저·마이너
- `next-env.d.ts`를 무시 목록에 추가(B.5의 "필요할 때만"): `next build`는 `./.next/types/…`, `next dev`는 `./.next/dev/types/…`를 가리키도록 실행할 때마다 다시 쓴다(두 경우 모두 실측). 커밋하면 실행 방식에 따라 계속 변경이 생긴다. 공식 템플릿 `.gitignore`도 무시한다. 참고: `.next`를 치운 상태에서도 `pnpm typecheck`는 종료 코드 0이라(실측), 무시해도 타입 검사가 깨지지 않는다
- 스크립트의 `cross-env NODE_OPTIONS=--no-deprecation`: 템플릿 형식을 따름(M6의 "모두 `cross-env` 사용"과 일치). `rm -rf`·인라인 대입 없음
- 통합 테스트 `.env` 로드: `dotenv`(템플릿) 대신 M2와 같은 Node 내장 `process.loadEnvFile`

**TDD 기록**

- RED: 테스트·Vitest 설정만 추가한 상태(설정 파일 없음)에서 `pnpm test` → 종료 코드 1, `Test Files  2 failed | 3 passed (5)`, `Tests  2 failed | 65 passed (67)`. `users-auth.spec.ts`는 파일 단위 실패 `import config from '../../src/payload.config'`(모듈 없음), `config-env.spec.ts` 2건은 `expected [Function] to throw error matching /Missing required environment variable…/ but got 'Cannot find module \'/src/payload.con…'`(`red-verbatim.log`)
- GREEN: `Users.ts`·`payload.config.ts` 추가 후 `pnpm test` 종료 코드 0, `Tests  72 passed (72)`(단위 65 + 통합 7). 첫 실행에서 Payload 개발 모드 스키마 반영이 동작(`Pulling schema from database...`). 실행 전 `public` 스키마 테이블 0개 → 실행 후 `users`, `users_sessions`, `payload_kv`, `payload_locked_documents(_rels)`, `payload_migrations`, `payload_preferences(_rels)` 생성(R9 — 문제 없음)
- 변이 확인: `payload.config.ts`의 `assertRequiredEnv(process.env)` 줄을 지우면 `config-env.spec.ts` `Tests  2 failed (2)`(`mutation-config-env.log`). 원본 복원 후 `diff` 동일 확인
- REFACTOR: 구조 변경 없음(파일 3개, 중복 없음)

**AC 검증** (모두 이 작업 트리, HEAD `27cae41` + 위 변경)

| AC | 명령 | 종료 코드 | 시간 | 결과 끝부분 |
|---|---|---|---|---|
| AC-INFRA-006 (통합 부분) | `pnpm test --reporter=verbose` | 0 | 5~8초 | `✓ \|integration\|` 7건(컬렉션 slug, 생성, 올바른 로그인, 틀린 로그인, 삭제, 설정 재검증 2건), `Tests  72 passed (72)`(`green-verbose.log`, `final-test.log`). 실행 뒤 `select count(*) from users` = 0, `users_sessions` 0, `payload_preferences` 0 |
| AC-INFRA-007 (빈 DB) | `users` 0건 확인 후 `pnpm dev`를 스크립트로 띄우고 `fetch(…, { redirect: 'manual' })`로 요청 | — | 준비까지 11.5초 | `/admin` → HTTP 200 + 본문의 Next 리디렉션 표식 `NEXT_REDIRECT;replace;/admin/login;307;` → `/admin/login` → HTTP 200 + `NEXT_REDIRECT;replace;/admin/create-first-user;307;` → `/admin/create-first-user` → HTTP 200, `<title>Create first user - Payload</title>`. HTTP `Location` 헤더는 세 단계 모두 없음(스트리밍 중 클라이언트 쪽 이동). 종료: 직접 띄운 PID만 `taskkill /T /F`, 이후 3000 포트 바인딩 성공(비어 있음), `netstat` 3000 0건 |
| AC-INFRA-012 (dev) | `.env` → `.env.bak` 복사, `PAYLOAD_SECRET` 줄 삭제 후 `pnpm dev`(출력 → `missing-env-dev.log`) | 1 | 0.77초 | `[preflight] Missing required environment variables: PAYLOAD_SECRET.` / `Copy .env.example to .env …`. `PAYLOAD_SECRET` 1건, `.env.example` 1건, `Ready`·`Local:` 0건, 비밀번호·`PAYLOAD_SECRET` 값 0건. 정리: `.env.bak` → `.env`, SHA-256 전후 동일(`ad04bc24…`), `.env.bak` 없음 |
| AC-INFRA-014 (dev) | `docker compose stop postgres` 후 `pnpm dev`(출력 → `db-down-dev.log`) | 1 | 0.57초 | `[preflight] Database connection failed: cannot reach PostgreSQL at 127.0.0.1:5432 (database: sumbi_tour) - ECONNREFUSED.` / `Start the local database with: docker compose up -d`. `docker compose up -d` 1건, `Ready`·`Local:` 0건, 비밀번호·`PAYLOAD_SECRET` 값 0건. 정리: `docker compose start postgres` → `postgres healthy` |
| AC-INFRA-004 (typecheck) | `pnpm typecheck` | 0 | — | `tsc --noEmit` 오류 0(`final-typecheck.log`) |
| AC-INFRA-004 (build) | `pnpm build` | 0 | 48초 | `✓ Compiled successfully in 26.3s`, 경로 `/_not-found`, `ƒ /admin/[[...segments]]`, `ƒ /api/[...slug]`, `ƒ /api/graphql`, `ƒ /api/graphql-playground`(`build-1.log`). `/` 페이지 없이도 빌드 성공(홈은 M4) |
| 생성 명령 | `pnpm generate:types` / `pnpm generate:importmap` | 0 / 0 | — | `Types written to …\src\payload-types.ts` / `Writing import map to …\src\app\(payload)\admin\importMap.js` |
| R17 | `git check-ignore -v --no-index <신규 15개 경로>` | 1 | — | 출력 없음(무시되는 신규 파일 0개) |

**계획과 다른 점**

- `@types/react`·`@types/react-dom` devDependency 추가(계획 §F 예상 파일 목록에 패키지 단위로는 없었음)
- `.gitignore`에 `next-env.d.ts` 추가(B.5가 조건부로 허용한 항목)
- 통합 테스트에 설정 로드 시 재검증 테스트(`config-env.spec.ts`)를 더함(REQ-INFRA-008 두 번째 확인 지점)

**미검증 항목**

- AC-INFRA-007은 브라우저 주소 표시줄이 아니라 HTTP 응답 본문의 Next.js 리디렉션 표식과 이동 대상 페이지 제목으로 확인했다. 실제 브라우저 이동과 "계정 생성 후 `/admin` 대시보드" 단계는 실행하지 않았다(실제 관리자 계정을 만들지 않는다는 지시). 또 `docker compose down -v`로 DB를 비우지 않고, 공유 볼륨을 유지한 채 `users` 0건 상태에서 확인했다
- AC-INFRA-006의 커버리지(`src/lib/` 85%)와 단위·통합 "1개 이상" 보고 형식의 최종 정리: M5
- PowerShell `Measure-Command` 미사용(Git Bash와 Node 측정)
- `next start`(운영 서버 기동)는 실행하지 않음
- 관리자 화면 실제 렌더링(브라우저), `/admin/login` 폼 제출: M5 E2E 범위

**남은 위험**

- `next dev`가 AI 코딩 에이전트를 감지하면 저장소 루트에 `AGENTS.md`(Next.js 관리 블록)를 만든다(`node_modules/next/dist/server/lib/app-info-log.js` `syncAgentRulesForDev`, 끄려면 `next.config`의 `agentRules: false`). 이번 실행에서 생긴 파일은 커밋하지 않고 지웠다(내용은 `m3/AGENTS.md.generated-by-next-dev`에 보관). 커밋·무시·비활성 중 어느 쪽으로 할지는 결정이 필요하다
- Payload가 `No email adapter provided. Email will be written to console.` 경고를 매번 출력한다(이메일은 범위 밖이라 의도된 상태)
- 개발 모드 스키마 반영이 공유 DB의 `payload_migrations`에 개발용 행 1개를 남긴다(Payload 기본 동작). 배포 SPEC에서 마이그레이션 절차를 정할 때 확인이 필요하다
- `pnpm peers check`가 `vite@8.3.6`의 `esbuild` peer(`^0.27.0 || ^0.28.0`, 설치 0.25.12) 불일치를 보고한다. 이번 변경 전 잠금 파일에 이미 있던 조합이다(`@types/*` 추가 diff에 vite·esbuild 변경 없음)
- 직접 작성 분량(M1~M3 누적): 물리 줄 1160줄(주석·빈 줄 포함; 소스·설정·테스트 합계), 주석·빈 줄 제외 867줄(소스 235, 테스트 560, 설정 72). 계획 §A의 "직접 작성 LOC 1000 초과 시 차단자 보고" 기준에 측정 방식에 따라 걸린다

### M4 — 임시 홈 페이지와 Tailwind

긴 출력은 `.moai/state/verify/a08890a8/m4/`(로컬 전용). 기준 트리: M3 커밋 `f17ae5d` + 아래 변경. 실행 셸: Git Bash. 시간은 `date +%s` 차이(초 단위). Node 24.22.1, pnpm 11.28.9. 기준선: 변경 전 `pnpm test` 종료 코드 0, `Tests  72 passed (72)`(`baseline-test.txt`).

**만든·바꾼 파일**

| 파일 | 내용 |
|---|---|
| `src/app/(frontend)/globals.css` (신규) | `@import "tailwindcss";` 한 줄 + 사용 범위 주석 |
| `src/app/(frontend)/layout.tsx` (신규) | 사용자 화면 루트 레이아웃. `<html lang="ko">`, `metadata`(제목 `숨비투어`), `./globals.css`를 여기서만 import |
| `src/app/(frontend)/page.tsx` (신규) | 임시 홈. `h1`(`text-4xl font-bold`) "숨비투어", 문구 "서비스를 준비 중입니다." — Tailwind 유틸리티만 사용 |
| `postcss.config.mjs` (신규) | `@tailwindcss/postcss` 플러그인 1개(Tailwind Next.js 가이드 방식) |
| `playwright.config.ts` (신규) | `testDir: tests/e2e`, `workers: 1`, `reporter: list`, 테스트 제한 120초, `baseURL`·`webServer`는 `tests/helpers/e2e-env.ts`의 포트 사용. `webServer.command` = `pnpm exec next dev --port <E2E_PORT>`, `port: <E2E_PORT>`, `reuseExistingServer: false`, `timeout: 180_000`, `env.NEXT_PUBLIC_SERVER_URL = http://localhost:<E2E_PORT>` |
| `tests/helpers/e2e-env.ts` (신규) | `.env`를 `process.loadEnvFile`로 읽고 M2의 `resolveE2ePort`(기본 3100)로 `E2E_PORT`·`E2E_BASE_URL`을 정함. 시작 전 점검과 같은 함수·같은 `.env`를 써서 점검한 포트와 서버 포트가 어긋나지 않게 함 |
| `tests/e2e/home.spec.ts` (신규) | E2E 2건: `/` 200 + `h1`에 `숨비투어` + `준비 중` 문구 보임 / 빈 페이지에서 잰 `h1` 브라우저 기본 글자 크기가 `36px`이 아님을 단언한 뒤 홈 `h1`이 `36px`(`text-4xl`)임을 단언. 페이지 방문마다 `new URL(page.url()).port` = `String(E2E_PORT)`이고 `'3000'`이 아님을 단언 |
| `tests/unit/repo-rules.spec.ts` | AC-INFRA-009 3건, AC-INFRA-004 라우트 구조 3건 추가(`readdirSync` 재귀 읽기, 셸 검색 없음, 대상 1건 이상 먼저 단언) |
| `next.config.ts` | `agentRules: false` + 이유 주석(AI 규칙은 MoAI의 CLAUDE.md로 관리) |
| `package.json` | 스크립트 `e2e` = `node scripts/preflight.mjs e2e && playwright test`. dependencies `tailwindcss` 4.3.5, `@tailwindcss/postcss` 4.3.5, `postcss` 8.5.32(설치 시점 `latest`, `npm view postcss dist-tags` → `{"latest": "8.5.32"}`), devDependency `@playwright/test` 1.65.0 — 모두 범위 기호 없음 |
| `pnpm-lock.yaml` | 위 4개 패키지 추가분 |

Chromium: `pnpm exec playwright install chromium` 종료 코드 0(`pw-install.log`).

**결정과 근거**

- 오케스트레이터 결정: `next dev`의 `AGENTS.md` 자동 생성을 `agentRules: false`로 끔. Next 16.4.5 `config-shared.d.ts`: "When `next dev` detects an AI coding agent … auto-generates `AGENTS.md` … Set to `false` to disable this behavior." 비활성 시 `removeAgentRulesFiles`는 루트 `AGENTS.md`의 Next 관리 블록만 다루고 `CLAUDE.md`는 건드리지 않음(소스 `generate-agent-files.js` 확인)
- 오케스트레이터 결정: Tier는 M 유지. M3 이후 직접 작성 분량(주석·빈 줄 제외) 약 867줄(대부분 테스트)이었고, M4에서 약 200줄(신규 파일 약 100줄 + 저장소 규칙 테스트 약 100줄, 근사치)이 더해졌다. 이 결정은 오케스트레이터가 내렸으며 여기에 기록만 한다
- Playwright 서버 준비 확인을 `url`이 아니라 `port`로 함(계획과 다른 점): Playwright 1.65.0 `types/test.d.ts` — "If the url is specified, Playwright Test will wait for the URL to return a 2xx, 3xx, 400, 401, 402, or 403 status code". 첫 RED 실행에서 `/`가 404라 `Error: Timed out waiting 180000ms from config.webServer.`로 끝나 테스트 자체가 돌지 않았다(종료 코드 1). 포트 열림으로 바꾸자 RED가 테스트 단언(404, 24px)에서 실패했다. `reuseExistingServer: false`의 점유 포트 거부는 `port`에도 적용된다
- `webServer.command`는 `pnpm dev`가 아니라 `pnpm exec next dev --port <포트>`: `dev` 스크립트는 포트를 받지 않고 시작 전 점검(`dev` 모드)을 한 번 더 돌린다. `e2e` 스크립트가 이미 `e2e` 모드 점검(환경 변수·DB·포트)을 마친 뒤다
- 글자 크기 단언 값 `36px`: Tailwind v4 `text-4xl` = `2.25rem`. 비교 기준인 브라우저 기본값은 하드코딩하지 않고 같은 브라우저의 빈 페이지에서 잰다(Tailwind preflight가 `h1` 크기를 초기화하므로 홈 페이지 안에서는 기본값을 잴 수 없다)
- Tailwind 패키지를 `dependencies`에 둠: 운영 빌드(`next build`)에 필요하며 Tailwind 가이드도 일반 설치(`npm install tailwindcss @tailwindcss/postcss postcss`)

**TDD 기록**

- RED(저장소 규칙): 테스트만 추가한 상태에서 `pnpm exec vitest run --project unit tests/unit/repo-rules.spec.ts` → 종료 코드 1, `Tests  5 failed | 20 passed (25)`(`red-vitest.log`). `(payload)`의 admin·api 존재 검사 1건은 기존 구조로 처음부터 통과(검사 대상이 M3에서 이미 존재)
- RED(E2E): Playwright 설정·테스트만 있고 페이지가 없는 상태에서 `pnpm e2e` → 종료 코드 1, `2 failed`(`red-e2e.log`): `Expected: 200 / Received: 404`, `Expected: "36px" / Received: "24px"`(`<h1 class="next-error-h1">404</h1>`)
- GREEN: Tailwind 설치·파일 추가 후 저장소 규칙 `Tests  25 passed (25)`(`green-repo-rules.log`), `pnpm e2e` `2 passed`(`green-e2e.log`)
- 변이 확인: `src/app/(payload)/custom.scss`(빈 파일)에 `@import "tailwindcss";`를 넣으면 AC-INFRA-009 `Tests  3 failed | 22 passed (25)`(`mutation-payload-tailwind.log`). 복원 후 `git hash-object` = `e69de29…`(빈 파일, 변이 전과 같음)
- REFACTOR: 저장소 규칙 테스트의 "스타일시트 1개 이상" 단언을 보조 함수(`tailwindStylesheetNames`)로 모음. 그 밖의 구조 변경 없음

**AC 검증** (모두 이 작업 트리, HEAD `f17ae5d` + 위 변경, 순차 실행)

| AC | 명령 | 종료 코드 | 시간 | 결과 끝부분 |
|---|---|---|---|---|
| AC-INFRA-004 (typecheck) | `pnpm typecheck` | 0 | 6초 | `tsc --noEmit` 오류 0(`typecheck.log`) |
| AC-INFRA-004 (build) | `pnpm build` | 0 | 19초 | `✓ Compiled successfully in 9.3s`, `○ /`, `○ /_not-found`, `ƒ /admin/[[...segments]]`, `ƒ /api/[...slug]`, `ƒ /api/graphql`, `ƒ /api/graphql-playground`, `warn` 0줄(`build.log`) |
| AC-INFRA-004 (라우트 구조) | `pnpm test` | 0 | 7초 | `Test Files  5 passed (5)`, `Tests  78 passed (78)`(`test.log`) — 저장소 규칙 6건 추가분 포함 |
| AC-INFRA-009 | 위와 같은 `pnpm test` | 0 | — | Tailwind 범위 3건 통과 |
| AC-INFRA-008 (홈 부분 + 포트 단언) | `pnpm e2e` | 0 | 6초 | `ok 1 … /는 200으로 응답하고 숨비투어 제목과 준비 중 문구를 보여 준다`, `ok 2 … 제목의 글자 크기는 Tailwind 유틸리티 값이며 브라우저 기본값과 다르다`, `2 passed (4.6s)`(`e2e.log`) |
| R11 (브라우저 확인, 일회성) | 임시 테스트 `tests/e2e/r11-tmp.spec.ts`(실행 후 삭제, 커밋 안 함)로 `pnpm e2e r11-tmp` | 0 | 36초 | 홈: 스타일시트 `src_app_(frontend)_globals_….css`, `--tw-` 있음, `--color-gray-600` 있음, `body` margin `0px`(preflight 적용). 관리자(`/admin/login` → 빈 DB라 `/admin/create-first-user`로 이동): 스타일시트 `_12mkzr0djnql2._.css` 1개, `--tw-`·`--color-gray-600`·`tailwindcss` 모두 없음, 관리자 문서에 넣은 `h1`의 글자 크기 `32px`(preflight가 있었다면 `inherit`로 초기화됨) (`r11-browser.log`) |
| AGENTS.md | `pnpm dev`(3000 포트)로 띄워 `/` 요청 200 확인 후 `ls AGENTS.md`. E2E 실행(RED·GREEN·R11·최종) 뒤에도 매번 같은 확인 | — | 3초 | `No such file or directory`(매번). 실행 환경에 `CLAUDECODE` 변수가 있어 에이전트 감지 조건은 갖춘 상태(값은 출력하지 않음) |
| 포트 정리 | 각 실행 뒤 `netstat -ano` 3000·3100 LISTENING 확인 | — | — | 0건. `pnpm dev`는 직접 띄운 프로세스 트리(PID 26556 아래 4개)만 `taskkill /T /F`로 종료. Playwright가 띄운 서버는 Playwright가 스스로 종료 |
| R17 | `git check-ignore -v --no-index <신규 7개 경로>` | 1 | — | 출력 없음(무시되는 신규 파일 0개) |

**계획과 다른 점**

- Playwright `webServer` 준비 확인을 `url` 대신 `port`로 함(위 근거). R15의 "TCP만 받는 점유 프로세스" 시나리오는 이 선택과 함께 M5에서 다시 확인한다
- M5 범위 일부를 미리 함: `playwright.config.ts`의 전용 포트·`reuseExistingServer: false`·`webServer.env`·`timeout`, `e2e` 스크립트(위임 지시에 따름). 관리자 로그인 E2E·테스트 관리자 계정 준비·정리는 하지 않음

**미검증 항목**

- `agentRules: false`를 빼면 실제로 `AGENTS.md`가 생기는지(대조 실험): 하지 않음. M3에서 같은 환경으로 생성된 기록(M3 남은 위험)이 있어 추정만 함
- R11은 관리자 로그인 화면이 아니라 빈 DB에서 이동한 `/admin/create-first-user`에서 확인했다(같은 `(payload)` 레이아웃). 로그인 화면 자체 확인은 M5 E2E
- E2E는 개발 서버(`next dev`)로만 확인. 운영 서버(`next start`)에서 Tailwind 적용은 확인하지 않음(빌드 산출물 `○ /`는 확인)
- `E2E_PORT`를 3100이 아닌 값으로 바꿔 실행하는 경우: 단위 테스트(M2의 `resolveE2ePort`)로만 확인
- PowerShell 실행 미확인(Git Bash만)

**남은 위험**

- `next dev`가 Payload 타입 파일 `src/payload-types.ts`를 같은 내용으로 다시 쓴다. `git status`에 `M`으로 보이지만 `git hash-object` = `HEAD:src/payload-types.ts` = `0e09ed7…`로 내용 변경 없음(커밋에 넣지 않음). 줄바꿈 설정(M6 `.gitattributes`) 전까지 같은 표시가 반복될 수 있다
- Playwright `port` 준비 확인은 서버가 포트를 연 순간 테스트를 시작하므로, 첫 페이지 컴파일 시간은 각 테스트 제한 시간(120초) 안에서 기다린다. 느린 PC에서는 첫 테스트가 이 시간에 걸릴 수 있다
- `pnpm peers check`의 `vite@8.3.6` `esbuild` peer 불일치는 그대로(M1부터 있던 항목, 이번 추가와 무관)

### M5 — 테스트 하니스 정리

긴 출력은 `.moai/state/verify/a08890a8/m5/`(로컬 전용). 기준 트리: M4 커밋 `00ec300` + 아래 변경. 실행 셸: Git Bash. Node 24.22.1, pnpm 11.28.9. 기준선: 변경 전 `pnpm test` 종료 코드 0 `Tests  78 passed (78)`(`baseline-test.log`), `pnpm e2e` 종료 코드 0 `2 passed (7.4s)`(`baseline-e2e.log`), `users` 행 수 0(컨테이너 안 `psql`, 접속 정보는 출력하지 않음).

**만든·바꾼 파일**

| 파일 | 내용 |
|---|---|
| `package.json`, `pnpm-lock.yaml` | devDependency `@vitest/coverage-v8` `5.1.0`(범위 기호 없음, 설치된 `vitest` 5.1.0과 같은 버전) |
| `vitest.config.mts` | `coverage`: `enabled: true`, `provider: 'v8'`, `include: ['src/lib/**']`, `reporter: ['text', 'json-summary']`, `reportsDirectory: 'coverage'`(이미 `.gitignore`), `thresholds.lines: 85` |
| `src/lib/preflight.ts` | `probePortFree`: 모든 주소 바인딩 시도(기존) 뒤 `127.0.0.1`·`::1` 접속 시도를 추가. 접속되면 `accepting connections on <주소>`로 사용 중 판정(R15, M2 잔여 위험 해소) |
| `tests/unit/preflight.spec.ts` | `127.0.0.1` 전용 점유, `::1` 전용 점유를 사용 중으로 보는지 2건 추가 |
| `tests/unit/repo-rules.spec.ts` | AC-INFRA-006 커버리지 설정 2건 추가(`@vitest/coverage-v8` 고정·버전 일치, `vitest.config.mts`를 실제로 불러와 `enabled`·`provider`·`include`·`thresholds.lines` 단언) |
| `tests/e2e/admin.spec.ts` (신규) | `/admin/login`에 `#field-email`·`#field-password`·Login 버튼이 보이고 경로가 `/admin/login`에 머무름 / 테스트 관리자로 로그인 → 경로 `/admin` + `.dashboard` 보임. 방문마다 E2E 포트 단언 |
| `tests/e2e/global-setup.ts` (신규) | Payload 로컬 API로 `e2e-admin-<UUID>@example.test` 계정을 만들고(비밀번호는 `randomBytes(24)`로 실행 중 생성, 출력 안 함) 환경 변수로 넘김. 돌려준 정리 함수가 `delete` 후 `destroy` |
| `tests/helpers/test-admin.ts` (신규) | 계정 전달 변수 이름(`E2E_TEST_ADMIN_EMAIL`·`E2E_TEST_ADMIN_PASSWORD`)과 읽기 함수. 값이 없으면 변수 이름만 담은 오류 |
| `tests/helpers/e2e-assert.ts` (신규) | `expectE2ePort` — `home.spec.ts`에 있던 단언을 옮겨 두 E2E 파일이 함께 씀(단언 내용은 그대로) |
| `tests/e2e/home.spec.ts` | 지역 `expectE2ePort` 대신 위 공통 함수 import(REFACTOR, 단언 변경 없음) |
| `playwright.config.ts` | `globalSetup: './tests/e2e/global-setup.ts'` |

**TDD 기록**

- RED(단위·저장소 규칙): 테스트만 추가한 상태에서 `pnpm exec vitest run --project unit` → 종료 코드 1, `Tests  4 failed | 71 passed (75)`(`red-unit.log`). 실패 내용: `127.0.0.1에만 묶인 점유도 사용 중으로 본다` `AssertionError: expected true to be false`, `::1(IPv6 루프백)에만 묶인 점유도 사용 중으로 본다` 같은 오류, `@vitest/coverage-v8가 직접 의존성에 있어야 한다: expected undefined to be type of 'string'`, 커버리지 설정 `expected undefined to be true`. 루프백 전용 점유를 놓치는 문제(M2 잔여 위험)가 Windows에서 실제로 재현됨
- RED(E2E): `admin.spec.ts`만 있고 준비 단계가 없는 상태에서 `pnpm e2e` → 종료 코드 1, `2 failed`, `2 passed`(`red-e2e.log`). 1번: `getByRole('button', { name: /login/i })` `element(s) not found` — 화면 접근성 트리가 `heading "Welcome"`, `To begin, create your first user.`, `button "Create"`(빈 `users` 테이블이라 첫 사용자 생성 화면). 2번: `Test admin account is not prepared: E2E_TEST_ADMIN_EMAIL and E2E_TEST_ADMIN_PASSWORD must be set by tests/e2e/global-setup.ts.`
- GREEN: 커버리지 설정·`probePortFree` 수정 후 `pnpm test` `Tests  82 passed (82)`(`green-test.log`). 준비 단계 추가 후 `pnpm e2e` `4 passed (29.9s)`(`green-e2e.log`), 실행 뒤 `users` 0
- REFACTOR: 포트 단언 공통화(`e2e-assert.ts`), 경로 단언을 입력란 확인 뒤로 옮김(클라이언트 이동이 끝난 뒤 판정)

**AC 검증** (모두 이 작업 트리, HEAD `00ec300` + 위 변경, 순차 실행)

| AC | 명령 | 종료 코드 | 시간 | 결과 끝부분 |
|---|---|---|---|---|
| AC-INFRA-004 (typecheck) | `pnpm typecheck` | 0 | — | `tsc --noEmit` 오류 0(`final-typecheck.log`) |
| AC-INFRA-004 (build) | `pnpm build` | 0 | — | `✓ Compiled successfully in 20.0s`, `○ /`, `ƒ /admin/[[...segments]]`, `ƒ /api/[...slug]` 등(`final-build.log`) |
| AC-INFRA-006 (커버리지 포함) | `pnpm test` | 0 | 5.75초(Vitest `Duration`) | `Test Files  5 passed (5)`, `Tests  82 passed (82)`(단위 75 + 통합 7), `preflight.ts  100 \| 93.75 \| 100 \| 100`(Stmts·Branch·Funcs·Lines), `coverage-summary.json` `lines {"total":67,"covered":67,"pct":100}`(`final-test.log`) |
| AC-INFRA-006 (임계값이 실제로 막는지) | `pnpm test --project integration`(단위 테스트를 빼 커버리지를 일부러 낮춤, 파일 수정 없음) | 1 | — | `Tests  7 passed (7)` 인데 `ERROR: Coverage for lines (22.38%) does not meet global threshold (85%)`(`threshold-bite.log`) |
| AC-INFRA-008 (전체) | `pnpm e2e` | 0 | 26.5초(Playwright 보고) | `ok 1 … /admin/login은 이메일·비밀번호 입력란과 로그인 버튼을 보여 준다 (11.9s)`, `ok 2 … 테스트 관리자 계정으로 로그인하면 /admin으로 이동하고 대시보드가 보인다 (3.6s)`, `ok 3`·`ok 4`(홈), `4 passed (26.5s)`(`final-e2e.log`) |
| AC-INFRA-008 (실패 시 계정 정리) | `pnpm exec playwright test --timeout=1`(모든 테스트를 일부러 시간 초과시킴) | 1 | — | `4 failed`, 실행 뒤 `users` 0(`cleanup-on-failure.log`) |
| AC-INFRA-015 (모든 주소 바인딩) | 점유 `node -e "require('net').createServer().listen(3100, …)"` 후 `pnpm e2e` | 1 | 0.56초 | `[preflight] E2E port 3100 is already in use by another process (EADDRINUSE).`, `passed` 0건. 점유 프로세스(PID 16100)만 종료, 이후 3100 바인딩 가능·접속 불가(`ac015-wildcard.log`) |
| AC-INFRA-015 (`127.0.0.1` 전용 바인딩) | 점유 `…listen(3100, '127.0.0.1', …)` 후 `pnpm e2e` | 1 | 0.60초 | `[preflight] E2E port 3100 is already in use by another process (accepting connections on 127.0.0.1).`, `passed` 0건. 점유 프로세스(PID 17420)만 종료, 이후 포트 비어 있음(`ac015-loopback.log`) |
| R10 (테스트 데이터) | 컨테이너 안 `psql … select count(*) from users`(접속 정보는 `.env`에서 읽어 넘기고 출력 안 함) | 0 | — | 시작 전 0 → `pnpm test` 뒤 0 → `pnpm e2e` 뒤 0 → 실패 강제 실행 뒤 0 |
| 포트·AGENTS.md | `netstat -ano` 3000·3100 LISTENING, `ls AGENTS.md` | — | — | LISTENING 0건, `No such file or directory` |

AC-INFRA-015 시간은 점유 프로세스가 `listening`을 알린 직후부터 `pnpm e2e`가 끝날 때까지 Node `process.hrtime`으로 잼(PowerShell `Measure-Command` 아님).

**R14 결과**

- `.env`의 `NEXT_PUBLIC_SERVER_URL`은 포트 3000을 가리킨다(값 자체는 출력하지 않고 포트만 확인). E2E는 `webServer.env`로 `http://localhost:3100`을 넘긴다. Next의 `.env` 로드가 이미 설정된 변수를 덮어쓰지 않는다면 Payload `serverURL`은 3100이 된다(이 동작은 서버 안에서 값을 직접 찍어 확인하지 않았다 — 추론)
- 이 상태에서 3100 포트 로그인이 성공(위 `ok 2`). 따라서 R14 가설의 실패는 일어나지 않았고 Payload `csrf`·`cors` 설정을 바꿀 필요가 없었다. 덮어쓰기를 빼고 3000을 가리키게 한 대조 실험은 하지 않음(미검증 항목)

**계획과 다른 점**

- 커버리지는 `src/lib/` 아래 파일이 현재 `preflight.ts` 하나라 "합산"이 이 파일 하나의 값과 같다
- AC-INFRA-015는 PowerShell `Measure-Command` 대신 Node 스크립트(작업 트리 밖 임시 디렉터리)로 시간·종료 코드를 잼

**미검증 항목**

- R14 대조 실험(`NEXT_PUBLIC_SERVER_URL`을 덮어쓰지 않았을 때 로그인이 실제로 실패하는지)
- PowerShell 실행(Git Bash만)
- `pnpm e2e` 실행 중 강제 종료(Ctrl+C) 시 정리 단계 실행 여부 — 테스트 실패 시 정리는 확인함
- `::1` 전용 점유로 `pnpm e2e`를 돌린 경우(단위 테스트로만 확인)

**남은 위험**

- 준비 단계는 Playwright 실행 프로세스 안에서 Payload를 초기화하므로, 개발 모드 스키마 반영(push)이 E2E 서버의 첫 Payload 초기화와 겹치지 않는다는 가정에 기대고 있다. 현재는 준비 단계가 끝난 뒤 첫 요청이 가므로 겹치지 않는다
- `probePortFree`는 루프백 접속 확인마다 최대 1초를 쓴다(빈 포트는 즉시 거부되어 실제로는 수 ms)
- `src/payload-types.ts`가 `next dev`·`build` 뒤 `M`으로 보이지만 `git hash-object` = `HEAD:src/payload-types.ts` = `0e09ed7…`로 내용 변경 없음(커밋에 넣지 않음, M6 `.gitattributes` 대상)

### M6 — 린트·포맷 범위·줄바꿈·스크립트

긴 출력은 `.moai/state/verify/a08890a8/m6/`(로컬 전용). 기준 트리: M5 커밋 `fc94857`. 실행 셸: Git Bash. Node 24.22.1, pnpm 11.28.9. 기준선: 변경 전 `pnpm test` 종료 코드 0 `Tests  82 passed (82)`(`baseline-test.log`), `git ls-files --eol`에서 `i/crlf` 0건·`i/lf` 506건·`i/none` 10건(빈 `.gitkeep` 9개와 빈 `custom.scss`). 작업 트리는 `core.autocrlf=true`로 체크아웃되어 `w/crlf` 506건.

**커밋**

| SHA | 내용 |
|---|---|
| `d8e7013` | 설정·의존성·저장소 규칙 테스트 |
| `ed481ea` | `pnpm format` 첫 적용(줄 나눔만 바뀐 5개 파일) + `git add --renormalize`(명시 경로) — 인덱스가 이미 모두 LF라 줄바꿈 변경은 0건 |

**만든·바꾼 파일**

| 파일 | 내용 |
|---|---|
| `package.json`, `pnpm-lock.yaml` | devDependency `eslint` `9.39.5`, `eslint-config-next` `16.4.5`, `eslint-config-prettier` `10.1.8`, `prettier` `3.9.10`(모두 범위 기호 없음). `@eslint/eslintrc`(FlatCompat)는 필요 없었음 — `eslint-config-next` 16이 `./core-web-vitals`·`./typescript` flat 배열을 직접 내보냄. 스크립트 `lint`(`eslint src tests scripts *.ts *.mjs *.mts`), `format`(`prettier --write .`), `format:check`(`prettier --check .`) 추가 |
| `eslint.config.mjs` (신규) | `defineConfig([...nextVitals, ...nextTs, globalIgnores([...], 'sumbi-tour/check-exclusions'), prettier])`. 제외 목록은 spec.md §2.5 그대로(`dir/**`, `**/*.md` 표기) |
| `.prettierignore` (신규) | 같은 목록(`dir/`, `*.md` 표기) |
| `prettier.config.mjs` (신규) | `endOfLine: 'lf'`, `semi: false`, `singleQuote: true`, `printWidth: 120`, `*.css`는 `singleQuote: false` |
| `.gitattributes` (신규) | `* text=auto eol=lf` |
| `tests/unit/repo-rules.spec.ts` | AC-INFRA-003 3건, AC-INFRA-010 6건 추가(아래 TDD 기록) + 포맷으로 기존 줄 2곳 합침 |
| 포맷 변경만(`ed481ea`) | `src/app/(payload)/admin/[[...segments]]/not-found.tsx`·`page.tsx`, `src/app/(payload)/api/[...slug]/route.ts`(Payload 템플릿 파일, 여러 줄 → 한 줄), `tests/unit/preflight.spec.ts`(배열 한 줄로), `tsconfig.json`(`include` 한 줄로). 내용 변경 없음 |

**결정**

- `printWidth: 120`: 기존 코드를 Prettier API로 미리 포맷해 바뀌는 줄 수를 셈 — 80: 15개 파일 398줄, 100: 7개 파일 71줄, 110: 6개 파일 29줄, 120: 7개 파일 8줄. M1~M5 코드가 120자 기준으로 쓰여 있어 120을 씀. `semi`·`singleQuote`도 기존 코드(세미콜론 0건, 작은따옴표)에 맞춤
- `*.css` 큰따옴표 예외: 첫 `pnpm format`이 `globals.css`의 `@import "tailwindcss"`를 `'tailwindcss'`로 바꿨고, AC-INFRA-009 저장소 규칙 테스트 3건이 실패함(`css-quote-regression.log`, `Tests  3 failed | 33 passed (36)`). acceptance.md AC-INFRA-009가 고정 문자열 `@import "tailwindcss"`를 요구하므로 CSS만 큰따옴표를 유지하도록 override를 추가하고 다시 포맷 → 36 통과
- 린트 규칙 예외·비활성화: 없음. `pnpm lint` 첫 실행에서 문제 0건. ESLint가 실제로 검사한 파일은 30개(`-f json`으로 확인, `importMap.js`·`payload-types.ts`는 제외됨, `scripts/preflight.mjs`·루트 설정 파일 포함)
- ESLint 제외 항목은 이름(`sumbi-tour/check-exclusions`)으로 찾는다. `eslint-config-next`도 자체 전역 무시(`.next/**`, `out/**`, `build/**`, `next-env.d.ts`)를 넣지만 우리 목록의 부분집합이라 충돌 없음

**TDD 기록**

- RED: 테스트만 추가한 상태에서 `pnpm exec vitest run --project unit tests/unit/repo-rules.spec.ts --coverage.enabled=false` → 종료 코드 1, `Tests  9 failed | 27 passed (36)`(`red-unit.log`). 실패: `scripts에 필수 키 9개가 모두 있다` `AssertionError: expected [ 'dev', 'build', 'start', …(3) ] to deeply equal [ 'dev', 'build', 'start', …(6) ]`, `rm -rf`·인라인 대입 검사 `expected 8 to be greater than or equal to 9`, `.prettierignore` `ENOENT`, ESLint 2건 `Cannot find module '…/eslint.config.mjs'`, lint 스크립트 `expected '' to be 'eslint'`, Prettier `Cannot find package 'prettier'`, `.gitattributes` `ENOENT`
- GREEN: 의존성·설정·스크립트 추가 후 같은 명령 `Tests  36 passed (36)`(`green-unit.log`)
- REFACTOR: 없음(테스트 코드는 포맷만 적용)

**AC 검증** (최종 순차 실행, HEAD `ed481ea`, 이 작업 트리)

| AC | 명령 | 종료 코드 | 결과 끝부분 |
|---|---|---|---|
| AC-INFRA-004 (typecheck) | `pnpm typecheck` | 0 | `tsc --noEmit` 오류 0(`final-typecheck.log`) |
| AC-INFRA-004 (build) | `pnpm build` | 0 | `✓ Compiled successfully in 10.5s`, `○ /`, `ƒ /admin/[[...segments]]`, `ƒ /api/[...slug]`, `ƒ /api/graphql`, `ƒ /api/graphql-playground`(`final-build.log`). 빌드 뒤 `git status --short` 0줄 |
| AC-INFRA-003·010 저장소 규칙 + 전체 | `pnpm test` | 0 | `Test Files  5 passed (5)`, `Tests  91 passed (91)`(82 + 9), `preflight.ts  100 \| 93.75 \| 100 \| 100`(`final-test.log`) |
| AC-INFRA-008 | `pnpm e2e` | 0 | `ok 1`~`ok 4`, `4 passed (43.1s)`(`final-e2e.log`) |
| AC-INFRA-010 lint | `pnpm lint` | 0 | 출력은 명령 줄뿐(문제 0건)(`final-lint.log`) |
| AC-INFRA-010 format | `pnpm format:check` | 0 | `All matched files use Prettier code style!`(`final-format-check.log`) |
| AC-INFRA-010 범위 밖 1 | `.moai/__lint_probe.ts`(`const  a=1`) 두고 `pnpm format:check`, `pnpm lint` | 0, 0 | `All matched files use Prettier code style!` / 문제 0건(`probe1-*.log`). 바로 삭제 |
| AC-INFRA-010 대조 2 | `src/__lint_probe.ts`(같은 내용) 두고 `pnpm format:check` | 1 | `[warn] src/__lint_probe.ts`, `Code style issues found in the above file.`(`probe2-format.log`). 바로 삭제 |
| AC-INFRA-010 scripts/ 포함 3 | `scripts/__lint_probe.mjs`(`var a = ;`) 두고 `pnpm lint`, `pnpm format:check` | 1, 2 | `1:8  error  Parsing error: Expression expected` / `[error] > 1 \| var a = ;`, `Error occurred when checking code style in the above file.`(`probe3-*.log`). 바로 삭제 |
| AC-INFRA-010 줄바꿈 | `git ls-files --eol` | — | `i/crlf` 0건, `i/lf` 510건, `i/none` 10건, 추적 파일 520개 모두 `attr/text=auto eol=lf`(`eol-final.txt`) |
| REQ-INFRA-015 Windows 체크아웃 | `git -c core.autocrlf=true clone`(작업 트리 밖 임시 폴더) 후 `git ls-files --eol` | 0 | `w/crlf` 0건, `w/lf` 510건 — `.gitattributes`가 `core.autocrlf=true`보다 우선해 LF로 풀림 |
| `payload-types.ts` | `pnpm build` 뒤, `pnpm generate:types` 뒤 `git status --short` | — | 둘 다 0줄. 단, 이 파일의 인덱스 정보가 예전 CRLF 체크아웃 기준이라 `generate:types` 첫 실행 뒤에는 `M`(`git diff` 0줄, `hash-object` = `HEAD` blob `0e09ed7…`)이 보였고, 같은 blob을 `git add`해 인덱스 정보만 갱신한 뒤 다시 실행하자 0줄 |
| 탐침 정리·포트 | `ls` 세 탐침, `netstat -ano` 3000·3100, `ls AGENTS.md` | — | 세 탐침 모두 `No such file or directory`, LISTENING 0건, `AGENTS.md` 없음 |

**계획과 다른 점**

- `git add --renormalize`는 인덱스에 이미 CRLF가 없어 아무것도 바꾸지 않음(별도 줄바꿈 커밋 없음)
- `prettier.config.mjs`에 지시된 `endOfLine` 외에 `semi`·`singleQuote`·`printWidth`·CSS override를 둠(이유는 위 결정)

**미검증 항목**

- PowerShell 실행(Git Bash만). `pnpm lint`의 `*.ts` 같은 글롭은 셸이 아니라 ESLint가 펼치므로 셸 차이는 없을 것으로 봄(추론)
- 기존 체크아웃(주 작업 트리)에서의 `pnpm format:check` — 아래 남은 위험 참고

**남은 위험**

- `.gitattributes`는 새로 쓰는 파일에만 적용된다. `core.autocrlf=true`로 이미 체크아웃된 작업 트리를 `ed481ea`로 빨리 감기하면, 이번에 바뀌지 않은 파일은 CRLF로 남아 `pnpm format:check`가 실패한다. 임시 클론에서 재현: `fc94857` CRLF 상태 → `ed481ea` 체크아웃 뒤 `w/crlf` 498건, `prettier --check .` 종료 코드 1, 26개 파일 경고. 해결 확인: `pnpm format`(`prettier --write .`) → `--check` 종료 코드 0, `git diff` 0줄. 이때 `git status`에 내용 변경 없는 `M` 26건이 남고, 그 경로를 `git add`하면 상태 0줄·스테이징 0건
- Payload 템플릿 라우트 3개 파일(“DO NOT MODIFY”)을 포맷이 한 줄로 합쳤다. Payload가 이 파일들을 다시 생성하면 여러 줄로 돌아와 `format:check`가 실패할 수 있다(`importMap.js`만 생성 대상이고 이 3개는 `generate:importmap` 대상이 아님 — 미검증)
- `pnpm add` 뒤 `pnpm peers check`: `vite@8.3.6`이 `esbuild` `^0.27.0 || ^0.28.0`을 원하나 `0.25.12` 설치(경고, 테스트·빌드는 통과). M5 잠금 파일(`fc94857`)에도 `vite@8.3.6(…)(esbuild@0.25.12)`로 이미 있던 상태라 M6에서 생긴 문제가 아님

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
