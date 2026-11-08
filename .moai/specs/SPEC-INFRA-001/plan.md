# SPEC-INFRA-001 구현 계획

> 개발 방식: TDD (`.moai/config/sections/quality.yaml` `development_mode: tdd`). 설정 파일 위주의 작업이지만, 검증 로직·통합 연결·화면·저장소 규칙은 실패하는 테스트를 먼저 쓰고 통과시키는 순서로 진행한다.
> 진행 경로: Tier M — main 직접 커밋(Hybrid Trunk). PR 없음.

## §A. 맥락

- 로드맵 1번 항목. 독립 SPEC이며 선행 SPEC은 없다. 이후 2~8번 SPEC 전부가 이 SPEC에 의존한다.
- 저장소 현재 상태: 소스 코드 없음. 루트에 MoAI 설정(`.claude/`, `.moai/`, `CLAUDE.md`, `.mcp.json`, `.claudeignore`, `.worktreeinclude`), Git 훅(`.git_hooks/`), `.github/`(라벨 동기화 워크플로만 있음, CI 없음), 한 줄짜리 `README.md`, MoAI 기본 `.gitignore`(241줄)가 있다.
- 개발 PC: Windows 11, Docker 설치됨(`docker` 실행 파일 확인), Node.js·pnpm 미설치(2026-11-08 `which node pnpm`로 확인). 프로젝트 경로가 OneDrive 동기화 폴더(`C:\Users\kimmi\OneDrive\Desktop\study2`) 안에 있다.
- **Tier M 유지 근거**: 예상 파일은 30개가 넘어 Tier M 기준(5~15개)을 웃돈다. 그러나 절반 이상이 `create-payload-app` 템플릿이 만드는 파일(`src/app/(payload)/**`, 타입 생성물, import map)과 짧은 설정 파일이고, 직접 작성하는 코드는 환경 변수·DB 확인 로직, `Users` 컬렉션, 임시 홈 페이지, 테스트(단위·통합·E2E·저장소 규칙)로 1000 LOC 미만으로 예상한다. 구조적·헌법적 변경도 없으므로 Tier L의 design.md·research.md가 더할 정보가 적다. 실제 직접 작성 LOC가 1000을 넘으면 run 단계에서 차단자로 보고하고 Tier 상향을 검토한다.
- Tier M 예산: 요구사항 16개, 수용 기준 16개(상한 각 16개).

## §B. 확인된 사실과 알려진 문제

### B.1 검증한 버전 (2026-11-08 조회)

모든 버전은 npm 레지스트리 `latest`(또는 명시한 dist-tag) 기준이며, `spec.md` §2.5의 "정식 안정 버전"(사전 배포 식별자 없음, 메이저 1 이상) 정의를 만족한다.

| 패키지 | 채택 버전 | 출처 | 비고 |
|---|---|---|---|
| `payload` | 3.93.0 | https://registry.npmjs.org/payload/latest | engines.node `^22.23.4 \|\| >=24.22.1` |
| `@payloadcms/next` | 3.93.0 | https://registry.npmjs.org/@payloadcms/next/latest | peer `next`: `>=15.2.9 <15.3.0 \|\| >=15.3.9 <15.4.0 \|\| >=15.4.11 <15.5.0 \|\| >=16.3.3 <17.0.0` |
| `@payloadcms/db-postgres` | 3.93.0 | https://registry.npmjs.org/@payloadcms/db-postgres/latest | peer `payload: 3.93.0`(정확히 일치 필요). dist-tags `latest 3.93.0`, `beta 4.0.0-beta.7`(사용 안 함) — https://registry.npmjs.org/-/package/@payloadcms/db-postgres/dist-tags |
| `create-payload-app` | 3.93.0 | https://registry.npmjs.org/create-payload-app/latest | 부트스트랩 CLI |
| `next` | 16.4.5 | https://registry.npmjs.org/next/latest | engines.node `>=20.9.0`. dist-tags — https://registry.npmjs.org/-/package/next/dist-tags |
| `react` / `react-dom` | 19.3.1 | https://registry.npmjs.org/react/latest | Next 16 peer `^19.0.0` 만족 |
| `tailwindcss` | 4.3.5 | https://registry.npmjs.org/tailwindcss/latest | |
| `@tailwindcss/postcss` | 4.3.5 | https://registry.npmjs.org/@tailwindcss/postcss/latest | Next.js 설치 가이드 방식 — https://tailwindcss.com/docs/installation/framework-guides/nextjs |
| `vitest` | 5.1.0 | https://registry.npmjs.org/vitest/latest | engines.node `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0` |
| `@playwright/test` | 1.65.0 | https://registry.npmjs.org/@playwright/test/latest | engines.node `>=20` |
| `eslint` | 9.39.5 | https://registry.npmjs.org/-/package/eslint/dist-tags (`maintenance` 태그), https://registry.npmjs.org/eslint/9.39.5 | engines.node `^18.18.0 \|\| ^20.9.0 \|\| >=21.1.0`. `latest`는 10.14.0. 선택 이유는 B.3 |
| `eslint-config-next` | 16.4.5 | https://registry.npmjs.org/eslint-config-next/latest | peer `eslint >=9.0.0` |
| `eslint-config-prettier` | 10.1.8 | https://registry.npmjs.org/eslint-config-prettier/latest | |
| `prettier` | 3.9.10 | https://registry.npmjs.org/prettier/latest | |
| `typescript` | 7.0.2 (조건부) | https://registry.npmjs.org/typescript/latest | Payload 템플릿은 6.0.3을 씀. R6 참고 |
| `pnpm` | 12.18.0 (참고) | https://registry.npmjs.org/pnpm/latest | Payload 템플릿 engines는 `pnpm ^9 \|\| ^10 \|\| ^11`. R5 참고 |
| PostgreSQL (Docker 이미지) | `postgres:17-alpine` | https://www.postgresql.org/support/versioning/ (17.11 지원, EOL 2029-11-08) | 지원 중 메이저: 18·17·16·15·14 |

보조 개발 의존성(`@vitejs/plugin-react`, `vite-tsconfig-paths`, `jsdom`, `tsx`, `cross-env`, `dotenv`, `semver`, `@types/*`, `@vitest/coverage-v8` 등)은 요청 대상 목록 밖이므로 설치 시점의 `latest` 안정 버전으로 정하고 잠금 파일로 고정한다. 직접 의존성에 사전 배포 버전이나 0.x가 섞이면 저장소 규칙 테스트(AC-INFRA-005)가 실패한다. 간접 의존성은 이 정책의 대상이 아니다.

### B.2 Payload·pnpm 공식 요구사항

- Payload(https://payloadcms.com/docs/getting-started/installation)
  - Node.js: `^22.23.4 || >=24.22.1`
  - Next.js: 문서 본문은 "15.2.9~15.2.x, 15.3.9~15.3.x, 15.4.11~15.4.x, 16.2.6 이상"이라고 적지만, `@payloadcms/next@3.93.0`의 peer 범위는 `>=16.3.3 <17.0.0`이다. **더 좁은 패키지 peer 범위를 따른다.** `next@16.4.5`는 두 기준을 모두 만족한다.
  - 패키지 매니저: "pnpm is preferred", yarn 1.x 미지원
  - ESM 전용 — `package.json`에 `"type": "module"` 필요
  - 설치 구조: Payload 파일은 `app/(payload)`에, 프론트엔드는 별도 라우트 그룹에 둔다. Next 설정을 `withPayload`로 감싼다.
- pnpm
  - 설정 위치(https://pnpm.io/settings, https://pnpm.io/11.x/settings): "Only auth, registry, TLS, proxy, and `local-address` settings are read from `.npmrc` files." 나머지 설정은 `pnpm-workspace.yaml`(또는 전역 `config.yaml`)에 둔다. **따라서 `.npmrc`에 `engine-strict`를 쓰지 않는다.**
  - 엔진 검사(https://pnpm.io/settings/cli): `engineStrict` 기본값은 `false`지만, 프로젝트 자신이 `engines`에 선언한 Node.js 버전과 맞지 않으면 설치는 항상 실패한다. 범위 밖 버전 흉내는 `nodeVersion` 설정("The Node.js version to use when checking a package's `engines` setting")을 명령줄에서 덮어써 확인한다(AC-INFRA-002).
  - `packageManager` 필드(https://pnpm.io/package_json): "When a command runs with a different pnpm version, pnpm switches to the pinned one"

### B.3 결정과 근거

- **Node.js 지원 범위 = Payload ∩ Vitest = `^22.23.4 || ^24.22.1 || >=26.0.0`.** Payload는 `^22.23.4 || >=24.22.1`, Vitest 5.1.0은 `^22.12.0 || ^24.0.0 || >=26.0.0`이므로 교집합에서 Node.js 25가 빠진다. Next(`>=20.9.0`), Playwright(`>=20`), ESLint 9.39.5(`^18.18.0 || ^20.9.0 || >=21.1.0`)는 이 범위를 모두 포함한다. `package.json` `engines.node`에 이 교집합을 그대로 적는다.
- **권장 설치 버전: Node.js 24 LTS(24.22.1 이상, 조회 시점 최신 24.22.2).** (1) 공식 `with-postgres` 템플릿이 `engines.node >=24.22.1`, 이미지 `node:24.22.1-alpine`을 쓴다. (2) "Corepack will no longer be distributed starting with Node.js v25"(https://nodejs.org/docs/latest-v24.x/api/corepack.html)이므로 Node 26에서는 Corepack을 따로 설치해야 한다. Node 26 LTS(26.13.0)도 지원 범위 안이다. 릴리스 현황: https://nodejs.org/en/about/previous-releases
- **부트스트랩은 공식 템플릿 `with-postgres` 기반.** 템플릿 목록(https://github.com/payloadcms/payload/tree/main/templates)에 `blank`, `with-postgres` 등이 있고, `with-postgres`에는 `docker-compose.yml`, `vitest.config.mts`, `playwright.config.ts`, `tests/{int,e2e,helpers}`, `eslint.config.mjs`, `.env.example`이 들어 있다. 설치 문서는 `npx create-payload-app`을 권장 경로로 안내한다. 템플릿 그대로 쓰지 않고 B.4의 차이를 정리한다.
- **린트·포맷: ESLint 9 + `eslint-config-next`(core-web-vitals + typescript) + Prettier + `eslint-config-prettier`.** (1) Next.js 16에서 `next lint`가 제거되어 ESLint CLI를 직접 쓴다(https://nextjs.org/docs/app/api-reference/config/eslint). (2) 같은 문서가 Prettier와 함께 쓸 때 `eslint-config-prettier/flat`을 권장한다. (3) 템플릿의 포매터 `oxfmt ^0.73.0`은 메이저 0이라 `spec.md` §2.5 정의에 맞지 않아 Prettier 3으로 바꾼다. (4) ESLint 10도 지원되지만 같은 문서가 "일부 플러그인이 아직 ESLint 10을 peer로 선언하지 않아 경고나 실패가 날 수 있다"고 밝히므로, 템플릿과 같은 ESLint 9 계열의 `maintenance` 최신판(9.39.5)을 쓴다.
- **검증 수단: 저장소 규칙 테스트.** 문자열·구조 검사(스크립트, 라우트 구조, 의존성 버전, Tailwind 범위, `.env.example`, ignore 목록, Compose 설정)는 셸 검색 대신 Vitest 단위 테스트 `tests/unit/repo-rules.spec.ts`로 구현한다. PowerShell 5.1의 인용 처리 차이를 피하고, 각 검사는 대상이 1건 이상 있음을 먼저 단언해 빈 결과로 통과하는 경우를 막는다.
- **시작 전 점검(preflight).** REQ-INFRA-008·009·014의 "서버를 띄우기 전에 끝난다"를 결정적으로 만들기 위해, `dev`·`build`·`start`·`test`·`e2e` 스크립트 앞에 Node 스크립트(예: `scripts/preflight.mjs`)를 `&&`로 연결한다. pnpm의 pre/post 스크립트 훅에는 기대지 않는다. 점검 항목: 필수 환경 변수(전 명령), DB TCP 접속 가능 여부(`dev`·`test`·`e2e`, 시간 제한 있음), E2E 전용 포트 비어 있음(`e2e`). 같은 검증을 Payload 설정 로드 시점에도 한 번 더 수행한다(설정을 직접 불러오는 경로 대비).
- **로컬 PostgreSQL 이미지: `postgres:17-alpine`.** 템플릿의 `postgres:latest`는 메이저 버전이 바뀔 때 기존 볼륨과 호환이 깨질 수 있어 메이저를 고정한다. 운영(Supabase) 메이저와 맞추는 일은 배포 SPEC에서 확인한다(기록된 가정).
- **CI 미도입.** `spec.md` §2.4 A4와 §5 참고. 템플릿의 `ci` 스크립트(`payload migrate && pnpm build`)는 마이그레이션 절차가 배포 SPEC 범위이므로 넣지 않는다.

### B.4 템플릿과 이 SPEC의 차이 (정리 대상)

`with-postgres` 템플릿의 `package.json`(https://raw.githubusercontent.com/payloadcms/payload/main/templates/with-postgres/package.json)과 `docker-compose.yml`을 조회한 결과:

| 템플릿 상태 | 처리 |
|---|---|
| `payload`·`@payloadcms/*`가 3.82.1로 고정 | 전부 3.93.0으로 맞춤(REQ-INFRA-004) |
| `@payloadcms/transformer-sharp`가 `4.0.0-beta.4`(beta) | 제거. 미디어 처리는 범위 밖 |
| `Media` 컬렉션 | 제거. `Users`만 남김(REQ-INFRA-011) |
| `oxfmt`, `oxfmt.config.ts` | Prettier로 교체 |
| `devsafe` 스크립트의 `rm -rf .next` | 제거(REQ-INFRA-002) |
| `test` = 통합 + E2E 묶음 | `test`(Vitest 단위·통합·저장소 규칙)와 `e2e`(Playwright)로 분리(REQ-INFRA-002) |
| `engines`: `node >=24.22.1`, `pnpm ^9 \|\| ^10 \|\| ^11`, `pnpm.onlyBuiltDependencies` | `engines.node`는 B.3 교집합, `packageManager` 추가, 빌드 스크립트 허용 설정은 선택한 pnpm 버전의 위치(`pnpm-workspace.yaml`)로 옮김(R18) |
| Compose의 `payload` 앱 서비스, `Dockerfile`, `.yarnrc`, `.vscode/` | 제거. 앱은 호스트에서 실행 |
| Compose `postgres:latest`, `POSTGRES_HOST_AUTH_METHOD: trust`, 고정 포트 `5432:5432` | 메이저 고정, 비밀번호 인증, healthcheck 추가, 호스트 포트 환경 변수화(기본 5432)(REQ-INFRA-006) |
| `.env.example`에 예시 값(`postgresql://127.0.0.1:5432/your-database-name`, `YOUR_SECRET_HERE`) | 이름만 남김(REQ-INFRA-007) |
| Playwright `webServer`가 `pnpm dev` + 포트 3000 + `reuseExistingServer: true` | 전용 포트, `reuseExistingServer: false`, E2E 서버에 맞춘 `NEXT_PUBLIC_SERVER_URL` 주입(REQ-INFRA-014, R14) |
| Vitest `environment: 'jsdom'` 단일 설정, `tests/int/**/*.int.spec.ts`만 포함 | 단위·통합 분리(통합은 Node 환경), `tests/unit`·`tests/integration`·`tests/e2e` 구조(`structure.md` §2) |

### B.5 저장소 기존 `.gitignore` (2026-11-08 실제 파일 확인)

`grep -n`과 `git check-ignore -v`로 확인한 결과:

- **이미 있는 항목**: `.env`(L126), `.env.*`(L127), `!.env.example`(L128) — `git check-ignore -v .env.example`이 `!.env.example` 규칙으로 추적 대상임을 보고했다. `node_modules/`(L223), `*.tsbuildinfo`(L224), `.next/`(L226), `out/`, `.vercel/`, `build/`(L25), `dist/`(L26), `*.log`, `logs/*`, `.vscode/`(L66), `.coverage`·`coverage.json`(L59~60).
- **추가할 항목**: `coverage/`, `playwright-report/`, `test-results/`, `blob-report/`. `next-env.d.ts`는 템플릿의 `.gitignore`와 Next.js 권장 사항을 비교해 필요할 때만 추가한다. 기존 줄은 지우거나 바꾸지 않는다.
- **주의할 기존 규칙** (`git check-ignore`로 확인):
  - `env/`(L51): 이름이 `env`인 디렉터리를 경로와 상관없이 무시한다. `src/lib/env/x.ts`가 무시됨을 확인했다. 환경 변수 검증 코드를 `env` 디렉터리에 두지 않는다(예: `src/lib/config-check.ts`).
  - `*-secret.*`, `*_secret.*`, `secret-*.*`, `*-key.*`, `*_key.*`, `*.key.*`, `private-key*` 등: 파일 이름에 `secret`·`key`가 이런 형태로 들어가면 무시된다(예: `payload-secret.ts`). 파일 이름을 정할 때 피한다.
  - `out/`, `build/`, `dist/`, `logs/*`: 소스 디렉터리 이름으로 쓰지 않는다.
- 신규 파일은 커밋 전에 `git check-ignore -v <경로>`로 무시 여부를 확인한다.

### B.6 기타 저장소 사항

- **`create-payload-app`은 새 디렉터리에 프로젝트를 만든다.** 루트에 이미 `.claude/`, `.moai/`, `CLAUDE.md`, `.gitignore`, `README.md`가 있으므로 루트에 직접 생성하지 않는다. 저장소 밖 임시 디렉터리에 생성한 뒤 필요한 파일만 루트로 옮기고, `.gitignore`·`README.md`는 덮어쓰지 않고 병합한다.
- **`create-payload-app`의 비대화형 플래그는 미확인.** npm 패키지 페이지 조회가 HTTP 403으로 실패했다. run 단계에서 `pnpm dlx create-payload-app@3.93.0 --help`로 템플릿 지정 플래그를 확인하고, 없으면 대화형으로 `with-postgres`를 고른다. 사용자 결정 사항이 아니므로 확인 마커를 두지 않는다.
- **pre-commit 훅**(`.git_hooks/pre-commit`)은 Go 파일 검사 위주이며 무거운 게이트로 `moai gate`를 언급한다. JS 프로젝트가 생기면 `moai gate`가 pnpm 기반 lint·test를 감지해 커밋 시간이 길어질 수 있다. run 단계 첫 커밋에서 동작을 관찰하고, 문제가 있으면 차단자로 보고한다(이 SPEC에서 훅은 수정하지 않음).

## §C. 사전 점검 (run 단계 시작 전)

사용자 사전 작업(`spec.md` §2.3)이 끝났는지 다음 명령으로 확인한다. 하나라도 실패하면 구현을 시작하지 않고 차단자 보고서를 낸다.

| 확인 | 명령 (PowerShell) | 기대 결과 |
|---|---|---|
| PowerShell | `$PSVersionTable.PSVersion` | 5.1 또는 7.x (기록) |
| Node.js | `node -v` | `^22.23.4`, `^24.22.1`, `>=26.0.0` 중 하나(v25는 불가) |
| pnpm | `pnpm -v` | 버전 출력 |
| Docker | `docker info --format '{{.ServerVersion}}'` | 버전 출력(데몬 실행 중) |
| Compose | `docker compose version` | v2 이상 |

사용자 사전 작업 상세 (README에도 같은 내용을 쓴다):

1. **Node.js 24 LTS 설치** — https://nodejs.org 에서 v24 LTS Windows 설치 프로그램(.msi)을 받아 설치한다. 새 PowerShell 창에서 `node -v`로 확인한다. (`winget install OpenJS.NodeJS.LTS`는 최신 LTS인 v26을 설치할 수 있으며, v26에는 Corepack이 없어 2단계가 달라진다.)
2. **pnpm 활성화** — **관리자 권한** PowerShell에서 `corepack enable pnpm`을 실행한다(Node가 `Program Files`에 설치되어 있으면 일반 권한으로는 바로 가기 생성이 실패할 수 있다). 일반 PowerShell을 새로 열어 `pnpm -v`로 확인한다. `package.json`의 `packageManager` 필드가 사용할 pnpm 버전을 고정한다. 대안: `npm install -g pnpm@<packageManager에 적힌 버전>`.
3. **Docker Desktop 실행** — 트레이 아이콘이 실행 중인지 확인하고 `docker info`로 점검한다.
4. **Playwright 브라우저** — 의존성 설치 뒤 `pnpm exec playwright install chromium`.
5. **(권장) OneDrive 동기화 대응** — `node_modules`, `.next` 같은 대량 파일이 동기화되면 파일 잠금(`EPERM`, `EBUSY`)과 속도 저하가 생길 수 있다. 개발 중 OneDrive 동기화를 일시 중지하거나 저장소를 OneDrive 밖으로 옮기는 방안을 README 문제 해결 절에 안내한다(이동 여부는 사용자가 판단).

Pre-spawn 점검(오케스트레이터): `git fetch origin main`, `git rev-list --count --left-right origin/main...HEAD`, `moai session list --json --filter-spec=SPEC-INFRA-001`.

## §D. 제약

- `.moai/project/*.md` 문서는 이 SPEC 구현 중 수정하지 않는다. 구조가 확정되면 sync 단계에서 `structure.md` 갱신을 검토한다.
- `.claude/`, `.moai/`, `CLAUDE.md`, `.mcp.json`, `.git_hooks/`, `.github/` 내용은 건드리지 않는다(AC-INFRA-010의 임시 검사 파일은 만든 즉시 지운다). `.gitignore`와 `README.md`는 기존 내용을 보존하며 추가·병합만 한다.
- 비밀 값은 어떤 파일에도 커밋하지 않는다. `.env`는 로컬에만 둔다.
- 코드 주석은 한국어(`language.yaml` `code_comments: ko`), 커밋 메시지는 한국어(`git_commit_messages: ko`), 식별자는 영어.
- 모든 스크립트는 Windows PowerShell 5.1·7과 POSIX 셸에서 같은 결과를 내야 한다. 환경 변수 주입은 `cross-env`, 파일 삭제는 Node 기반 명령을 쓴다.
- 제외 범위(`spec.md` §5)의 기능·패키지를 넣지 않는다.

## §E. 자체 검증 (run 단계 완료 시)

명령 결과는 `.moai/state/verify/<session>/` 아래 파일로 남기고, 종료 코드와 마지막 부분만 `progress.md` §E.2에 기록한다. 상태를 바꾸는 명령과 읽기 전용 명령을 나눈다(`verification-batch-pattern.md` § When NOT to Batch).

### E-1. 순차 실행 (상태 변경 — 한 번에 하나씩, 앞 단계가 성공해야 다음 단계 진행)

`pnpm install`은 `node_modules`를, `build`와 `e2e`는 `.next/`를 다시 쓰고, `test`와 `e2e`는 같은 개발 DB의 `Users`를 만들고 지우므로 병렬로 실행하지 않는다.

1. `docker compose up -d` → `postgres healthy` 확인
2. `pnpm install --frozen-lockfile`
3. `pnpm typecheck`
4. `pnpm build`
5. `pnpm test` (단위·통합·저장소 규칙·커버리지)
6. `pnpm e2e`

### E-2. 병렬 실행 (읽기 전용 — E-1이 끝난 뒤 한 턴에 병렬)

```powershell
docker compose ps --format '{{.Service}} {{.Health}}'
pnpm lint
pnpm format:check
pnpm list --depth 0 --json
git ls-files --eol
git check-ignore -q .env; $LASTEXITCODE
git check-ignore -q .env.example; $LASTEXITCODE
git status --short
```

`pnpm lint`와 `pnpm format:check`는 파일을 고치지 않는 검사 모드로만 실행한다(`--fix`, `--write` 금지).

### E-3. 예외 시나리오 (상태 변경 — 순차, 하나 끝날 때마다 원상 복구)

AC-INFRA-012 → AC-INFRA-013 → AC-INFRA-014 → AC-INFRA-015 순서로 실행하고, 각 시나리오가 끝나면 `.env` 복원, `docker compose up -d`, 점유 프로세스 종료, 로그·임시 파일 삭제를 한다. AC-INFRA-001의 영속성 확인과 AC-INFRA-010의 범위 밖 확인도 이 단계에서 순차로 실행한다.

## §F. 마일스톤

결정이 바뀔 가능성이 높은 순서로 배치했다. 각 마일스톤은 TDD 순서(실패하는 테스트 → 최소 구현 → 정리)로 진행한다.

### M1 — 부트스트랩 방식과 버전 고정 (우선순위: High)

- 저장소 밖 임시 디렉터리에 `create-payload-app@3.93.0`으로 `with-postgres` 템플릿 생성 → 필요한 파일만 루트로 이동, B.4 표대로 정리
- `package.json`: `"type": "module"`, `engines.node`: `^22.23.4 || ^24.22.1 || >=26.0.0`(B.3), `packageManager: pnpm@<정확한 버전>`(R5)
- pnpm 설정은 `pnpm-workspace.yaml`에 둔다(B.2). 선택한 pnpm 버전의 공식 문서에서 설정 위치와 빌드 스크립트 허용 설정 이름을 다시 확인하고 근거를 `progress.md` §E.2에 기록한다(R18). `.npmrc`는 인증·레지스트리 용도 외에는 만들지 않는다
- `payload`·`@payloadcms/*` 3.93.0(범위 기호 없음), `next` 16.4.5, `react`·`react-dom` 19.3.1, `pnpm-lock.yaml` 생성
- RED → GREEN: 저장소 규칙 테스트 중 의존성 버전·engines 항목(AC-INFRA-002·005)
- 범위 밖 Node 흉내 설치(`nodeVersion` 덮어쓰기) 실패 확인. 실제로 동작한 플래그 형식을 기록
- 검증: AC-INFRA-002, AC-INFRA-005
- 관련 REQ: 001, 003, 004

### M2 — 환경 변수 계약, 시작 전 점검, 로컬 DB (우선순위: High)

- `docker-compose.yml`: `postgres:17-alpine`, 데이터 디렉터리에 연결한 이름 있는 볼륨, `pg_isready` 기반 healthcheck, 비밀번호 인증, 호스트 포트 `${POSTGRES_PORT:-5432}` 형태 치환
- `.env.example`: `DATABASE_URL`, `PAYLOAD_SECRET`, `NEXT_PUBLIC_SERVER_URL`, Compose용 `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, (선택) `E2E_PORT` — 값 없음. 이름은 `tech.md` §4 제안을 그대로 쓰고 Compose용 이름만 추가한다
- RED: 환경 변수 검증 로직의 단위 테스트(누락 조합 4가지, 메시지에 변수 이름과 `.env.example`, 값 미노출) — 파일 위치는 `env` 디렉터리를 피함(B.5)
- GREEN: 시작 전 점검 스크립트(B.3)를 `dev`·`build`·`start`·`test`·`e2e`에 연결, Payload 설정 로드 시 같은 검증 재수행
- RED → GREEN: DB TCP 접속 점검(시간 제한, 접속 대상 표시, 비밀번호 마스킹, `docker compose up -d` 안내)
- `.gitignore`에 B.5의 "추가할 항목"만 추가
- RED → GREEN: 저장소 규칙 테스트 중 Compose·`.env.example` 항목
- 검증: AC-INFRA-001, 011, 012, 013, 014
- 관련 REQ: 006~010

### M3 — 관리자 인증 컬렉션 `Users` (우선순위: High)

- RED: 통합 테스트 — Payload 로컬 API(`getPayload`)로 사용자 생성, 올바른/틀린 비밀번호 로그인, 삭제, 등록 컬렉션이 `users`뿐인지 확인
- GREEN: `src/collections/Users.ts`(이메일·비밀번호 인증, 관리자 사용자 컬렉션), `payload.config.ts`에 등록, 타입 생성(`payload-types.ts`)과 관리자 import map 생성
- 수동 확인: 빈 DB에서 `/admin` → `/admin/create-first-user`(AC-INFRA-007)
- 검증: AC-INFRA-006, 007
- 관련 REQ: 011, 012

### M4 — 임시 홈 페이지와 Tailwind (우선순위: Medium)

- RED: E2E — `/` 200 응답, 제목에 `숨비투어`, `준비 중` 문구, 제목의 계산된 스타일 단언. 저장소 규칙 테스트 — Tailwind 범위, 라우트 구조
- GREEN: `tailwindcss`·`@tailwindcss/postcss`·`postcss` 설치, `postcss.config.mjs`, `(frontend)` 전용 전역 스타일시트(`@import "tailwindcss";`)를 `(frontend)/layout.tsx`에서만 불러옴, `(frontend)/page.tsx`
- 관리자 화면에 Tailwind 기본 스타일(preflight)이 새지 않는지 브라우저로 한 번 확인
- 검증: AC-INFRA-004(라우트 구조), AC-INFRA-008(홈 부분), AC-INFRA-009
- 관련 REQ: 003, 005

### M5 — 테스트 하니스 정리 (우선순위: Medium)

- Vitest: 단위(`tests/unit`, 저장소 규칙 테스트 포함)와 통합(`tests/integration`, Node 환경, 순차 실행) 분리, 커버리지 공급자 설정, `src/lib/` 합산 라인 85% 임계값(미달 시 실패)
- Playwright: `tests/e2e`, 전용 포트(기본값 예: 3100, `E2E_PORT`로 변경 가능), `reuseExistingServer: false`, `webServer.command`에 포트를 명시(`next dev --port <E2E_PORT>`), `webServer.env`로 `NEXT_PUBLIC_SERVER_URL=http://localhost:<E2E_PORT>` 주입(R14), 개발 서버 첫 컴파일을 고려한 `webServer.timeout`(R13), 테스트 관리자 계정을 시작 전에 만들고 끝나면 지우는 준비·정리 단계
- `e2e` 스크립트의 시작 전 점검이 E2E 포트 점유를 먼저 확인하고 끝낸다(R15)
- RED → GREEN: 관리자 로그인 화면 렌더링, 테스트 계정 로그인 후 `/admin` 이동
- E2E 포트 단언: 각 페이지 방문 후 `new URL(page.url()).port`가 E2E 전용 포트 값과 같고 `'3000'`이 아님을 단언(AC-INFRA-008)
- 통합 테스트의 컬렉션 검사: slug 목록에서 접두어 `payload-`(Payload 시스템 컬렉션)를 뺀 결과가 정확히 `['users']`인지 단언(AC-INFRA-006)
- 검증: AC-INFRA-006(커버리지), 008, 015
- 관련 REQ: 013, 014

### M6 — 린트·포맷 범위·줄바꿈·스크립트 (우선순위: Low)

- `eslint.config.mjs`: `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript` + `eslint-config-prettier/flat`. `globalIgnores`와 `.prettierignore`는 `spec.md` §2.5 **검사 제외 목록**을 하나의 규칙으로 똑같이 담는다(글롭 표기만 도구에 맞게 바꿈 — ESLint는 `dir/**`, Prettier는 `dir/`). 공통 목록: `.claude/`, `.moai/`, `.github/`, `.git_hooks/`, `CLAUDE.md`, `.mcp.json`, `.claudeignore`, `.worktreeinclude`, `*.md`, `src/payload-types.ts`, `src/app/(payload)/admin/importMap.js`, `next-env.d.ts`, `pnpm-lock.yaml`, `.next/`, `out/`, `build/`, `coverage/`, `playwright-report/`, `test-results/`. 저장소 규칙 테스트(AC-INFRA-010)가 두 파일을 같은 목록과 대조한다
- `lint` 스크립트는 검사 대상 경로를 명시한다(예: `eslint src tests *.ts *.mjs *.mts`). `format`·`format:check`는 `prettier --write .` / `prettier --check .`와 `.prettierignore`로 범위를 제한한다
- `.prettierignore`: 위 공통 목록과 같은 항목(별도 목록을 따로 관리하지 않음)
- Prettier 설정(`endOfLine: "lf"`), `.gitattributes`: `* text=auto eol=lf`
- 스크립트 최종 정리: `dev`, `build`, `start`, `test`, `e2e`, `lint`, `format`, `format:check`, `typecheck`, `generate:types`, `generate:importmap`(모두 `cross-env` 사용, `rm -rf`·인라인 대입 없음)
- RED → GREEN: 저장소 규칙 테스트 중 스크립트·ignore 목록 항목
- 검증: AC-INFRA-003, 004, 010
- 관련 REQ: 002, 015

### M7 — README 한국어 안내 (우선순위: Low)

- 기존 한 줄 README를 개발 환경 안내로 확장: 사전 준비 → 환경 변수 → DB 실행 → 설치 → Playwright 브라우저 → 개발 서버 → 첫 관리자 → 테스트 → 문제 해결(5432 포트 충돌과 `POSTGRES_PORT` 변경, E2E 포트 충돌, DB 미실행, OneDrive 동기화, Corepack 권한 오류)
- README 순서대로 처음부터 한 번 따라 해 보고 결과를 기록
- 검증: AC-INFRA-016
- 관련 REQ: 016

### 예상 생성·수정 파일

- 생성: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.gitattributes`, `.env.example`, `docker-compose.yml`, `next.config.*`, `tsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs`, Prettier 설정 파일, `.prettierignore`, `vitest.config.mts`, `playwright.config.ts`, `scripts/preflight.mjs`(이름은 예시), `src/payload.config.ts`, `src/payload-types.ts`(생성물), `src/collections/Users.ts`, `src/app/(frontend)/{layout.tsx,page.tsx,globals.css}`, `src/app/(payload)/**`(템플릿 제공), `src/lib/**`(환경 변수·DB 확인), `tests/unit/**`(저장소 규칙 테스트 포함), `tests/integration/**`, `tests/e2e/**`, `tests/helpers/**`
- 수정: `.gitignore`(추가만), `README.md`(확장)

## §G. 위험과 대응 (안티 패턴 포함)

| ID | 위험 | 대응 |
|---|---|---|
| R1 | 템플릿을 루트에 바로 생성해 `.gitignore`·`README.md`·MoAI 설정을 덮어씀 | 저장소 밖 임시 디렉터리에 생성 후 선별 이동, 병합(B.6) |
| R2 | `payload`와 `@payloadcms/*` 버전 불일치(템플릿 3.82.1 잔존) | 전부 3.93.0 정확 고정, AC-INFRA-005로 확인 |
| R3 | Corepack 권한 오류(`EPERM`) | 관리자 PowerShell 안내, `npm install -g pnpm@<버전>` 대안(§C) |
| R4 | OneDrive 동기화로 인한 파일 잠금·느린 설치·빌드 | 동기화 일시 중지 안내, 문제 발생 시 경로 이동 검토(README) |
| R5 | pnpm 버전 호환 — 최신 pnpm 12.18.0이 Payload 템플릿 engines(`^9 \|\| ^10 \|\| ^11`) 밖 | `packageManager`는 템플릿 범위 안의 최신 안정판(11 계열)을 우선 검토. 12를 쓸 경우 `pnpm install`·`pnpm build`가 경고 없이 통과하는지 확인. 근거를 §E.2에 기록 |
| R6 | TypeScript 7.0.2와 Payload·Next 도구 체인 호환 미확인(템플릿은 6.0.3) | `pnpm typecheck`·`pnpm build`가 7.0.2로 통과하면 채택, 실패하면 6.x 최신 안정판으로 내리고 근거 기록 |
| R7 | 호스트 5432 포트 충돌(Windows에 PostgreSQL 설치된 경우) | `POSTGRES_PORT`로 변경(AC-INFRA-013), README 문제 해결 절 |
| R8 | Playwright가 기존 서버를 재사용해 엉뚱한 프로세스를 테스트 | 전용 포트 + `reuseExistingServer: false`(문서: "it will throw if an existing process is listening on the `port` or `url`" — https://playwright.dev/docs/test-webserver), AC-INFRA-015 |
| R9 | Payload 개발 모드 스키마 자동 반영이 테스트 실행 중 예상과 다르게 동작 | 통합 테스트에서 `users` 테이블 생성 여부를 확인. 문제 시 차단자 보고 |
| R10 | 통합·E2E 테스트가 개발 DB에 데이터를 남기거나 서로 간섭 | 테스트가 만든 레코드는 정리 단계에서 삭제(가정 A3), `test`와 `e2e`는 순차 실행(§E-1) |
| R11 | Tailwind preflight가 Payload 관리자 화면 스타일을 덮어씀 | 스타일시트를 `(frontend)` 레이아웃에서만 불러옴, AC-INFRA-009 |
| R12 | Windows 줄바꿈(CRLF)으로 `format:check` 실패 | `.gitattributes` + Prettier `endOfLine: "lf"` |
| R13 | 개발 서버 첫 요청 컴파일이 느려 E2E 시간 초과 | `webServer.timeout`(기본 60000ms)과 테스트 타임아웃을 넉넉히 설정 |
| R14 | **(미검증 가설)** E2E 포트에서 `NEXT_PUBLIC_SERVER_URL`(Payload `serverURL`)이 3000을 가리키면 Payload의 CSRF·쿠키 허용 목록 때문에 관리자 로그인이 실패할 수 있음 | `webServer.env`로 `NEXT_PUBLIC_SERVER_URL`을 E2E 서버 주소로 덮어쓰고, Payload 설정의 `serverURL`·`csrf`가 이 값을 쓰도록 한다. M5에서 E2E 로그인 테스트로 확인하고, 실패하면 Payload 3.93 문서의 `csrf`·`cors` 설정을 확인해 원인을 §E.2에 기록 |
| R15 | **(미검증 가설)** TCP만 받는 점유 프로세스는 HTTP 응답을 하지 않아, Playwright `url` 검사가 "이미 사용 중" 대신 시간 초과로 끝나거나 Next가 다른 포트로 옮겨 뜰 수 있음 | `e2e` 시작 전 점검이 E2E 포트를 먼저 열어 보고, 점유되어 있으면 포트 번호와 안내를 출력하고 끝낸다(Playwright 실행 전). `webServer.command`에 포트를 명시해 자동 포트 변경을 막는다. AC-INFRA-015가 30초 안에 끝나는지 확인 |
| R16 | **(미검증 가설)** Windows Docker Desktop은 호스트 프로그램과 바인딩 주소가 달라 5432 충돌이 일정하게 재현되지 않을 수 있음 | AC-INFRA-013은 충돌 재현이 아니라 포트 재정의 동작(`docker compose port postgres 5432` → `:5433`)을 검증한다. 충돌 해결 절차는 README로만 안내 |
| R17 | 기존 `.gitignore`의 `env/`, `*-secret.*`, `*-key.*`, `out/`, `build/` 규칙에 걸려 새 소스 파일이 조용히 커밋에서 빠짐 | 디렉터리·파일 이름 규칙 준수(B.5), 커밋 전 `git check-ignore -v`로 신규 경로 확인, `git status --short`로 누락 확인 |
| R18 | pnpm 버전에 따라 설정 위치(`.npmrc` vs `pnpm-workspace.yaml`)와 빌드 스크립트 허용 설정(`onlyBuiltDependencies` 등) 이름이 다름 | M1에서 선택한 pnpm 버전의 공식 문서로 확인하고 `pnpm-workspace.yaml`에 둔다. `sharp`는 범위 밖이므로 허용 목록에서 뺀다 |

안티 패턴 (하지 말 것):

- 템플릿의 beta 패키지(`@payloadcms/transformer-sharp@4.0.0-beta.4`)나 Payload 4 beta를 남겨 두기
- `.env.example`에 예시 값이나 실제 비밀 값을 적기
- 범위 밖 컬렉션(`Media` 등)을 "나중에 쓸 것"이라며 남겨 두기
- `rm -rf`, `VAR=value cmd` 같은 POSIX 전용 스크립트
- `postgres:latest`, `trust` 인증을 그대로 쓰기
- 수용 기준 검사를 셸 인용에 의존하는 `grep`으로 구현하기
- 상태를 바꾸는 검증 명령을 병렬로 실행하기
- 검증 명령을 실행하지 않고 통과라고 기록하기

## §H. 상호 참조

- `spec.md` — 요구사항(REQ-INFRA-001~016), 용어(§2.5), 제외 범위
- `acceptance.md` — AC-INFRA-001~016, 품질 게이트, 완료 정의
- `.moai/project/product.md` §7·§8, `structure.md` §2·§3, `tech.md` §1·§3·§4·§7
- Payload 설치 문서: https://payloadcms.com/docs/getting-started/installation
- Payload 템플릿: https://github.com/payloadcms/payload/tree/main/templates/with-postgres
- Next.js ESLint 문서: https://nextjs.org/docs/app/api-reference/config/eslint
- Tailwind CSS Next.js 가이드: https://tailwindcss.com/docs/installation/framework-guides/nextjs
- Playwright webServer 문서: https://playwright.dev/docs/test-webserver
- pnpm 설정 문서: https://pnpm.io/settings, https://pnpm.io/settings/cli, https://pnpm.io/package_json
- Node.js 릴리스 현황: https://nodejs.org/en/about/previous-releases
- Node.js Corepack 문서: https://nodejs.org/docs/latest-v24.x/api/corepack.html
- pnpm 설치 문서: https://pnpm.io/installation
- PostgreSQL 지원 버전: https://www.postgresql.org/support/versioning/
