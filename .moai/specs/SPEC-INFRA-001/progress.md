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
