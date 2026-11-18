# SPEC-DEPLOY-001 진행 기록

## §E.1 Plan-phase Audit-Ready Signal

```yaml
plan_status: audit-ready
plan_complete_at: 2026-11-17
tier: M
artifacts: [interview.md, spec.md, plan.md, acceptance.md, spec-compact.md]
req_count: 16
ac_count: 16
depends_on: [SPEC-INFRA-001, SPEC-TOUR-001, SPEC-APPLY-001, SPEC-ADMIN-001, SPEC-LANDING-001]   # 모두 status: completed
stage: "1 of 2 (배포 기반 — 비공개 미리보기). 2단계 공개 출시는 별도 SPEC(예: SPEC-LAUNCH-001)"
base_head: 0057e9d   # = origin/main (계획 시점)
author: manager-spec
spec_version: "0.1.2"   # 0.1.1 → 0.1.2: plan-audit 2회차(FAIL 0.84) N1·N2 필수 + N3~N7 선택 모두 반영, REQ 16·AC 16 유지
plan_audit_history:
  - "iteration 1 (2026-11-17): FAIL 0.69 — .moai/reports/plan-audit/SPEC-DEPLOY-001-review-1.md. 0.1.1에서 D1~D20 반영"
  - "iteration 2 (2026-11-17): FAIL 0.84 — .moai/reports/plan-audit/SPEC-DEPLOY-001-review-2.md. 0.1.2에서 N1~N7 반영, 3회차(마지막) 재감사 대기"
spec_id_check: "SPEC-DEPLOY-001 → PASS (^SPEC(-[A-Z][A-Z0-9]*)+-[0-9]{3}$), .moai/specs/ 충돌 없음"
tier_rationale: "M — 제품 코드 약 450~650줄(M 범위), 파일 약 30개 중 초과분은 테스트·생성 파일(마이그레이션·잠금 파일), 분할 기준 plan.md §A.4"
needs_clarification: 0   # [NEEDS CLARIFICATION] 표식 없음. interview.md Q1~Q7 모두 결정됨(2026-11-17 "추가 확인")
user_questions:   # 모두 resolved — spec.md §2.2 D7
  - "Q1 IP 변환값 최대 보관 고지 시간 — RESOLVED: 72시간 (사용자 답)"
  - "Q2 '비밀키로 변환한'·'원래 IP 주소는 저장하지 않음' 추가 — RESOLVED: 추가 (사용자 답)"
  - "Q3 Cron 시각 — RESOLVED: 초안 기본값 UTC 0 18 * * *(한국 3시대), 묻지 않음"
  - "Q4 HMAC 비밀값 분리 — RESOLVED: 초안 기본값 유지(PAYLOAD_SECRET), 묻지 않음"
  - "Q5 업로드 크기 — RESOLVED: 코드 한도 5MB 유지 + '실제 사이트는 4MB 이하' 안내 문구 (사용자 답) → REQ-DEPLOY-006·AC-DEPLOY-006, src/collections/Media.ts"
  - "Q6 Cron이 보호에 막히면 — RESOLVED: 미리보기 동안 수동 정리(plan.md §I.5 SQL), 자동 삭제 확인은 정식 공개 때 (사용자 답) → REQ-DEPLOY-014·AC-DEPLOY-014 (나)·R1"
  - "Q7 Hobby 비상업 약관·Supabase 무료 일시 중지 — RESOLVED: 안내 완료, 요금제는 2단계 결정"
user_only_steps: "plan.md §I.1(Supabase, Data API 끄기 포함) · §I.2(Vercel — M4 푸시 뒤 시작, 보호를 변수보다 먼저) · §I.3(첫 관리자) · §I.4(확인 절차 0~9) · §I.5(Cron이 막혔을 때 수동 정리 SQL)"
audit_fix_evidence_2026_11_17:
  storage_plugin_schema: "npm pack @payloadcms/storage-s3@3.93.0·@payloadcms/plugin-cloud-storage@3.93.0(압축만 해제): storage-s3 dist/index.js 29·45~63(enabled:false + alwaysInsertFields → 어댑터 없이 필드만), plugin-cloud-storage dist/plugin.js 12~48, dist/fields/getFields.js 153~175(prefix — alwaysInsertFields 또는 prefix일 때)·182~187(_objectKey 무조건), dist/types.d.ts 115~130"
  pool_hold: "node_modules/@payloadcms/db-postgres/dist/connect.js 4~38·45~49 connectWithReconnect가 pool.connect() 클라이언트를 돌려주지 않음 → 실사용 max-1"
  migrate_check: "@payloadcms/drizzle/dist/utilities/buildCreateMigration.js 82~85 — skipEmpty는 빈 경우에만 exit(0), 바뀐 점이 있으면 파일을 씀"
  seed_guard: "src/lib/seed.ts assertSeedAllowed(37~59), scripts/seed.ts:61 호출 — 재사용"
  test_setup_files: "tests/integration/setup-env.ts(9~11 .env 로드만, 루프백 판정 없음), tests/helpers/e2e-env.ts(.env 로드 + 포트만) — 판정 추가 대상"
  supabase_data_api: "https://supabase.com/docs/guides/api/securing-your-api (2026-11-17 WebFetch): Enable Data API 끄기 / Automatically expose new tables"
  migrate_check_index_rewrite_iter2: "@payloadcms/drizzle 3.93.0 dist/utilities/buildCreateMigration.js 101(.json)·110~111(.ts) 쓰기 뒤 112~114 writeMigrationIndex 호출, payload dist/database/migrations/writeMigrationIndex.js 26~30이 디렉터리 전체 기준으로 index.ts를 다시 씀 (2026-11-17 설치본 재확인) → migrate:check가 index.ts도 복원"
  test_setup_imports_iter2: "tests/integration/setup-env.ts import = node:fs·node:path, tests/helpers/e2e-env.ts import = node:fs·node:path·node:url·../../src/lib/preflight, vitest.config.mts:35 setupFiles (2026-11-17 grep) → AC-002 판정 시점 문장 근거"
  importmap_iter2: "plugin-cloud-storage dist/utilities/initClientUploads.js 26~37이 enabled와 무관하게 S3ClientUploadHandler를 import map에 넣음 (plan-audit 2회차 N6 배포본 확인 인용 — 이번 수정에서 재확인하지 않음) → M1 GREEN에 pnpm generate:importmap 확정"
  ac015_grep_on_head_0057e9d: "①②③ 새 명령 모두 출력 없음 exit 1(일치 없음), git ls-files .vercel 출력 없음. 고치기 전 명령은 ① 8줄·② 1줄 출력(감사 지적 재현)"
new_dependency: "@payloadcms/storage-s3 3.93.0 (peer payload 3.93.0) — npm view 확인"
supersedes_clauses:
  - "SPEC-TOUR-001 REQ-TOUR-001 중 '로컬 디렉터리에 원본 그대로 저장' — S3 변수가 모두 설정된 운영에서만 REQ-DEPLOY-006이 대체(개발·테스트는 그대로)"
  - "SPEC-INFRA-001 REQ-INFRA-008의 필수 변수 목록 — 운영 빌드에 한해 REQ-DEPLOY-001이 넓힘"
  - "SPEC-APPLY-001 REQ-APPLY-014 고지 중 IP 변환값 보관 설명 — REQ-DEPLOY-010이 바꿈(버전 규칙 유지)"
research_evidence:   # plan.md §A.2 요약
  payload: "3.93.0 — db-postgres connect.js 109~120(push 조건·prodMigrations), bin/migrate.js 10~40(명령·skipEmpty), drizzle buildCreateMigration.js 55~90(스냅숏 비교·skipEmpty 종료), drizzle migrate.js 30~45(batch -1 확인), uploads/endpoints/getFile.js 21·30~33(접근 확인 → 어댑터), utilities/logError.js·logger.js(pino 옵션), drizzle 배포본 .prepare( 0건"
  pg: "pg 8.20.0 connection-parameters.js 57~60(연결 문자열이 덮어씀), pg-connection-string 2.14.1 index.js 222~227(require = verify-full 별칭), drizzle-orm 0.45.2 errors.js(DrizzleQueryError 문구에 params)"
  vercel_docs_2026_11_17: "cron manage(CRON_SECRET Bearer·운영만·재시도 없음·최선 노력·Hobby ±59분), cron usage(Hobby 하루 1회), deployment-protection(All Deployments 모든 요금제·Password Hobby 불가·Standard는 운영 주소 미보호), vercel-authentication(모든 요금제·Hobby 외부 사용자 1명), Cron↔보호 통과 여부 문서에 없음, plans/hobby(300초·로그 1시간), legal/terms §4(개인·비상업), request-headers(x-forwarded-for 덮어씀), regions(Hobby 1개·vercel.json regions), package-managers(pnpm 6~12, lockfile 9.0 → 9/10, Corepack)"
  supabase_docs_2026_11_17: "connecting(트랜잭션 6543 준비된 문장 미지원·서버리스 권장·직접 연결 IPv6), s3 authentication(엔드포인트 형식·키는 서버 전용·RLS 우회), ssl-enforcement(CA 다운로드·verify-full), compute(Nano DB 60·풀러 200), free-plan-pausing(7일)"
  payload_docs_2026_11_17: "storage-adapters(기본 접근 규칙 유지·disableLocalStorage 자동·clientUploads·Vercel 4.5MB), migrations(payload migrate && build 권장·prodMigrations 첫 실행 지연·push와 섞지 말 것)"
  local_runs_2026_11_17: "pnpm audit 4건(happy-dom high 2 — @lexical/headless·vitest 경유, esbuild moderate — drizzle-kit 경유, minimatch moderate — eslint 경유), richText 필드 0건"
unverified_carried_to_run:
  - "Cron 호출이 All Deployments 보호를 통과하는지(R1) — 막히면 사용자 결정 Q6대로 수동 정리, 2단계로 이월"
  - "Vercel Fluid compute 켜짐 여부와 연결 예산(plan.md §B.2, M5)"
  - "x-vercel-id 형식(마지막 리전 칸 = 함수 리전) 실제 확인(M5)"
  - "@aws-sdk/client-s3 기본 체크섬과 Supabase S3 호환(R21)"
  - "정리 대상 실제 테이블·열 이름(application_attempts.attempted_at, admin_audit_logs.occurred_at 예상 — M2), 플러그인 열 실제 이름(M1)"
  - "vercel.json git.deploymentEnabled 문법, Corepack 환경 변수 이름, Vercel의 Node 주 버전 선택"
  - "Supavisor 트랜잭션 모드에서 이름 없는 확장 질의 동작(실제 배포 AC-DEPLOY-014)"
  - "Vercel 여러 줄 환경 변수(PEM) 보존"
  - "정적 경로 /api/cron/cleanup이 (payload)/api/[...slug]보다 우선하는지(M2 첫 E2E)"
legal_review_required: true   # 72시간·2년 보관 문구와 바뀐 동의 문구 전체 — 2단계 변호사 확인 목록
```

## §E.2 Run-phase Evidence

### 기준선 (plan.md §C, 2026-11-17, HEAD `5b6c32a`, 작업 트리 `.claude/worktrees/agent-ac4407bc74cb69987`)

| 명령 | 결과 |
|---|---|
| `docker compose ps` | `postgres healthy` |
| `pnpm test` | 종료 0, `Test Files 43 passed (43)`, `Tests 659 passed (659)` |
| `pnpm e2e` | 종료 0, `94 passed (2.8m)` |
| `pnpm lint` / `pnpm format:check` / `pnpm typecheck` | 각각 종료 0 |
| `pnpm audit` | 종료 1, `4 vulnerabilities found — Severity: 2 moderate \| 2 high` (계획 시점과 같음) |
| `.env`의 DB 호스트(값 미출력, 호스트만) | `127.0.0.1:5432` (루프백) |

로그: `.moai/state/verify/deploy-m1/baseline-*.log`

### M1 — DB 연결과 마이그레이션, 원격 DB 차단

**의존성**: `pnpm add -E @payloadcms/storage-s3@3.93.0` 종료 0. `package.json` 변경은 이 한 줄과 `migrate:check` 스크립트뿐. `pnpm-workspace.yaml`의 `allowBuilds`·`overrides` 변경 불필요(설치가 빌드 스크립트 차단 없이 끝남). 잠금 파일에 `esbuild` 변경 없음 — `pnpm peers check`의 `unmet peer esbuild`(vite@8.3.6)는 이번 추가와 무관한 기존 상태.

**`pnpm audit --json` 재측정(의존성 추가 뒤)**: `{"moderate":2,"high":2}` — 새 권고 없음(`@aws-sdk/*` 경유 0건).

| 권고 | 심각도 | 도달 경로 | 판단 |
|---|---|---|---|
| happy-dom GHSA-834v-8h66-3h79 | high | `@payloadcms/richtext-lexical>@lexical/headless>happy-dom`, `vitest>happy-dom`(2) | 실행 경로 미도달 — `richText` 필드 없음, 나머지는 시험 도구 |
| happy-dom GHSA-c8p4-j97h-3vg8 | high | 위와 같음 | 위와 같음 |
| esbuild GHSA-67mh-4wv8-2f99 | moderate | `@payloadcms/db-postgres>drizzle-kit>@esbuild-kit/esm-loader>@esbuild-kit/core-utils>esbuild` | 마이그레이션 생성 도구 경유, 개발 서버 취약점 — 실행 경로 미도달 |
| minimatch GHSA-g3hv-75wg-m249 | moderate | `eslint-config-next>…>minimatch`(11개 경로) | 린트 도구 — 실행 경로 미도달 |

**RED (구현 전, 원문 발췌 — 전체 로그 `.moai/state/verify/deploy-m1/red-unit-1.log`, `red-integration-1.log`)**:

```
$ pnpm exec vitest run --project unit tests/unit/deploy-config.spec.ts --coverage.enabled=false
 FAIL  |unit| tests/unit/deploy-config.spec.ts [ tests/unit/deploy-config.spec.ts ]
Error: Cannot find module '../../scripts/migrate-check.mjs' imported from …/tests/unit/deploy-config.spec.ts
 Test Files  1 failed (1)
      Tests  no tests

$ pnpm exec vitest run tests/unit/repo-rules.spec.ts tests/integration/remote-db-guard.spec.ts tests/integration/db-pool-min.spec.ts tests/integration/migrations.spec.ts --coverage.enabled=false
Error: ENOENT: no such file or directory, scandir '…\src\migrations'
AssertionError: plugins 배열이 있어야 한다: expected -1 to be greater than or equal to 0
AssertionError: expected '// Payload 설정 — 공식 with-postgres 템플릿(…' to match /push:\s*isLoopbackDatabaseUrl\(proces…/
AssertionError: expected '// 통합 테스트 준비: …' to match /^assertLoopbackDatabase\(process\.en…/m
AssertionError: expected undefined to be 'node scripts/migrate-check.mjs' // Object.is equality
AssertionError: expected 10 to be 3 // Object.is equality        (db-pool-min: 풀 최대 연결 수)
AssertionError: expected [] to deeply equal [ '["admin_audit_logs"]', …(14) ]   (빈 DB 마이그레이션 = 개발 스키마)
AssertionError: expected [] to include '["prefix"]'
AssertionError: expected '\n[preflight] Database connection fai…' to contain 'Only a loopback database is allowed f…'
 Test Files  4 failed (4)
      Tests  16 failed | 76 passed (92)
```

**GREEN**: 같은 5개 파일 `Test Files 5 passed (5)`, `Tests 137 passed (137)` (`green-1.log`).

**기록 항목 (plan.md §F M1 "기록")**

| 항목 | 값 |
|---|---|
| 첫 마이그레이션 | `src/migrations/20261117_083422_initial.ts` + `.json`, `index.ts` (`payload migrate:create initial`, S3 변수 없는 설정, DB 연결 없음) — 생성 뒤 `prettier --write src/migrations`만 적용(형식만, 내용 불변) |
| 스키마 비교 항목 | 테이블 15개(`CREATE TABLE` 15), 비교 범주 5개(테이블·열[형식·널·기본값·길이·정밀도]·인덱스 정의·제약[p/u/c/f] 정의·열거형 값) 모두 일치 — `tests/integration/migrations.spec.ts` |
| 저장소 플러그인 열 실제 이름 | `media.prefix`(`varchar DEFAULT ''`), `media._objectkey`(`varchar`, 소문자) |
| 정리 대상 테이블·열 (M2·§I.5용) | `application_attempts.attempted_at`(`key_hash`), `admin_audit_logs.occurred_at` |
| `migrate:check` 이름 | `pnpm migrate:check` = `node scripts/migrate-check.mjs` |
| 원격 DB 거부 문구 | `[preflight] Only a loopback database is allowed for this command (host: <호스트>).` |
| 인증서 없는 원격 문구 | `[db] DATABASE_CA_CERT must contain the database CA certificate (PEM, -----BEGIN CERTIFICATE-----) to connect to a non-loopback database.` |
| 풀 크기 오류 문구 | `[db] DATABASE_POOL_MAX must be an integer between 3 and 20.` |
| S3 일부 설정 문구 | `[storage] Missing S3 storage environment variables: <이름, …>. Set all five S3_* variables, or none to use local storage.` |
| Vercel 빌드 거부 문구 | `[vercel-build] Refusing to run: VERCEL_ENV is "<값>", expected "production". No migration was run.` |
| `DATABASE_CA_CERT` 한 줄 값 | 실제 줄바꿈이 없고 `\n` 글자가 있으면 줄바꿈으로 바꿈(단위 시험 고정) — 실제 Vercel 값 형태는 M5에서 확인 |

**audit O1 반영**: `git status --short src/migrations`는 실행 전후 출력 비교로 판정 — 전 `?? src/migrations/`, `pnpm migrate:check`(종료 0) 뒤 같은 출력(`SAME`). 커밋 뒤에는 빈 출력이 기준.

**열린 항목(M1)**: 생성된 마이그레이션 파일의 `pnpm lint` 경고 4건(`'payload'`·`'req' is defined but never used`, up·down 각 2) — §D가 `eslint.config.mjs` 검사 제외 목록 변경과 생성 파일 손편집을 막아 그대로 둠. M6 품질 게이트("새 경고 0건") 전에 처리 방식 결정 필요(오케스트레이터 차단자 보고).

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_

## plan-audit 3회차 결과 (2026-11-17)

PASS 0.91 (0.69 → 0.84 → 0.91). 반드시 고칠 항목 없음. 선택 지적은 run 단계에서 반영한다.

- O1 (M1 전에 반영): `git status --short src/migrations` 빈 출력 조건은 `src/migrations/`가 커밋된 뒤에만 성립한다. 실행 전후 출력을 비교하는 방식으로 판정하거나, 최초 마이그레이션 커밋 이후에만 이 조건을 적용한다
- O2: `buildCreateMigration.js` 인용 범위는 82~85가 맞다(plan L141의 83~86 수정)
- O3: N6 인용(`initClientUploads.js` 26~37)은 3회차 감사에서 tarball로 확인됨
