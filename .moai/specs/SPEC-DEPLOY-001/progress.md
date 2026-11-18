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

**열린 항목(M1)**: 생성된 마이그레이션 파일의 `pnpm lint` 경고 4건(`'payload'`·`'req' is defined but never used`, up·down 각 2) — §D가 `eslint.config.mjs` 검사 제외 목록 변경과 생성 파일 손편집을 막아 그대로 둠. M6 품질 게이트("새 경고 0건") 전에 처리 방식 결정 필요(오케스트레이터 차단자 보고). → **M2에서 해결**(아래 "plan §D 범위 지정 예외").

### M2 — 예약 정리와 동의 문구 (2026-11-18, 기준 HEAD `1dfe7dd`, 작업 트리 `.claude/worktrees/agent-a4ecc1b02ba0fd104`)

**기준선**: `pnpm test` 종료 0, `Test Files 47 passed (47)`, `Tests 725 passed (725)` (`.moai/state/verify/deploy-m2/baseline-test.log`). `pnpm lint` 종료 0, `✖ 4 problems (0 errors, 4 warnings)` — 모두 `src/migrations/20261117_083422_initial.ts`(M1 열린 항목). E2E 기준선 94(오케스트레이터 제공, M1 기록과 같음).

**RED (구현 전, 원문 발췌 — 전체 로그 `.moai/state/verify/deploy-m2/red-*.log`)**:

```
$ pnpm exec vitest run --project unit tests/unit/scheduled-cleanup.spec.ts tests/unit/consent.spec.ts tests/unit/repo-rules.spec.ts --coverage.enabled=false
 FAIL  |unit| tests/unit/scheduled-cleanup.spec.ts [ tests/unit/scheduled-cleanup.spec.ts ]
Error: Cannot find module '../../src/lib/scheduled-cleanup' imported from …/tests/unit/scheduled-cleanup.spec.ts
AssertionError: 비밀키로 변환한: expected '개인정보 수집·이용 동의(필수)\n수집 항목: 이름, 이메일, 연락…' to contain '비밀키로 변환한'
AssertionError: expected '개인정보 수집·이용 동의(필수)\n수집 항목: 이름, 이메일, 연락…' not to contain '다음 신청 처리 때'
AssertionError: expected false to be true // Object.is equality        (버전 날짜 2026-11-17)
AssertionError: expected [ '*.md', '.claude/', …(17) ] to deeply equal [ '*.md', '.claude/', …(18) ]   (.prettierignore·ESLint 제외 목록 — src/migrations/)
Error: ENOENT: no such file or directory, open '…\src\lib\scheduled-cleanup.ts'
Error: ENOENT: no such file or directory, open '…\vercel.json'
AssertionError: src/app/(payload)/api/cron/cleanup/route.ts가 있어야 한다: expected false to be true
AssertionError: "배포"가 들어간 ## 제목이 있어야 한다: expected -1 to be greater than or equal to 0   (×2)
 Test Files  3 failed (3)
      Tests  10 failed | 84 passed (94)

$ pnpm exec vitest run --project integration tests/integration/scheduled-cleanup.spec.ts --coverage.enabled=false
Error: Cannot find module '../../src/lib/scheduled-cleanup' imported from …/tests/integration/scheduled-cleanup.spec.ts
 Test Files  1 failed (1)

$ pnpm exec playwright test tests/e2e/deploy.spec.ts
    Error: CRON_SECRET 시험용 값이 있어야 한다   Expected: >= 16   Received: 0   (×3)
    Expected substring: "늦어도 72시간 안에 삭제"
    Received string:    "이름, 이메일, 연락처, 신청 인원, 선택한 회차. 부정 신청 방지를 위해 접속 IP를 변환한 값(10분간 신청 횟수를 세는 데만 쓰고 그 뒤 다음 신청 처리 때 삭제)"
  4 failed

# 경로 우선순위 RED(Playwright 시험용 CRON_SECRET만 넣고 route 파일 만들기 전)
$ pnpm exec playwright test tests/e2e/deploy.spec.ts -g "401"
    Error: expect(received).toBe(expected) // Object.is equality
    Expected: 401
    Received: 404          ← (payload)/api/[...slug](Payload REST)가 응답
  1 failed
```

`AC-DEPLOY-010` 저장소 규칙(`privacyPolicyVersion` 쓰는 곳 = `submit-application.ts` 하나)은 RED 실행에서 이미 통과 — 지금 상태를 지키는 회귀 방지 시험이다.

**GREEN**: 단위·통합 5개 파일 `Test Files 5 passed (5)`, `Tests 105 passed (105)` (`green-1.log`, 기존 `rate-limit.spec.ts` 포함). E2E `tests/e2e/deploy.spec.ts` `4 passed (14.0s)` (`green-e2e-1.log`).

**기록 항목 (plan.md §F M2)**

| 항목 | 값 |
|---|---|
| 정리 대상 실제 테이블·열 | `application_attempts.attempted_at`, `admin_audit_logs.occurred_at` (M1 확인 이름과 같음 — plan.md §I.4·§I.5 SQL 수정 불필요) |
| 정리 구현 | `src/lib/scheduled-cleanup.ts` — `cleanupCutoffs(now)`, `isAuthorizedCronRequest(header, secret)`(두 값의 SHA-256을 `timingSafeEqual`로 비교, 비밀값 없음·16자 미만 → 거짓), `runScheduledCleanup(payload, now)`(삭제마다 `with d as (delete … returning 1) select count(*)::int` 한 문장, 트랜잭션 밖 풀, 질의 2회 고정) |
| 정리 경로 위치 | `src/app/(payload)/api/cron/cleanup/route.ts` — plan §B.5의 후보(라우트 그룹 밖 `src/app/api/…`)는 기존 저장소 규칙 AC-INFRA-004("`src/app` 바로 아래는 두 라우트 그룹뿐")와 충돌해 `(payload)/api` 아래로 둠. 정적 경로가 같은 그룹의 `[...slug]`보다 먼저 골라짐을 E2E로 확인(위 RED 404 → GREEN 401). `next build` 경로 목록에 `ƒ /api/cron/cleanup` |
| 응답 문구 | 401 `Unauthorized`(text/plain), 405 `Method Not Allowed` + `Allow: GET`(POST·PUT·PATCH·DELETE), 500 `Internal Server Error`(원인 없음, 오류는 `payload.logger.error({ err })`로만), 200 `{"attemptsDeleted":n,"auditLogsDeleted":m}` — 모든 응답 `Cache-Control: no-store` |
| `vercel.json` | `buildCommand: node scripts/vercel-build.mjs`, `regions: ["icn1"]`, `crons: [{ path: /api/cron/cleanup, schedule: 0 18 * * * }]`. `git.deploymentEnabled`(Preview 끄기)는 공식 문법을 이 작업 환경에서 확인하지 못해 넣지 않음 → M5로 이월 |
| 새 동의 문구 버전 | `PRIVACY_POLICY_VERSION = '2026-11-17.da8271e6'` (날짜 = 사용자 결정 D7 확정일, 해시 = 새 `consentDocument()` SHA-256 앞 8자리, `tests/unit/consent.spec.ts` 일치 확인) |
| 새 "수집 항목" 문구 | `이름, 이메일, 연락처, 신청 인원, 선택한 회차. 부정 신청 방지를 위해 접속 IP를 비밀키로 변환한 값(원래 IP 주소는 저장하지 않음. 10분 동안 신청 횟수를 세는 데만 쓰고, 매일 한 번 자동으로 지워 만든 때부터 늦어도 72시간 안에 삭제)` (plan §B.5 초안 그대로) |
| E2E 시험용 `CRON_SECRET` | `playwright.config.ts`가 `process.env.CRON_SECRET`이 없을 때만 `randomBytes(16).toString('hex')`(32자)를 러너에서 한 번 만들고 `webServer.env`로 넘김 |
| README | `## 10. 배포` 절 신설 — 예약 정리 설명 + plan §I.5와 같은 한 문장 수동 정리 SQL. 변수 이름 목록·사용자 안내는 M5 |
| `rate-limit.ts` | `@MX:DEBT` 설명을 "예약 정리 구현됨(scheduled-cleanup.ts)"으로, `@MX:UPGRADE`를 "남용이 관측되면 원자적 카운터"로 갱신(동작 불변) |

**plan §D 범위 지정 예외(오케스트레이터 결정, M2)**: §D는 `.prettierignore`·`eslint.config.mjs` 검사 제외 목록을 바꾸지 않는다고 했으나, M1이 만든 생성 파일 `src/migrations/**`(Payload `migrate:create` 출력 — 손편집 금지)가 `no-unused-vars` 경고 4건과 Prettier 형식 차이를 내므로, 생성 파일로서 두 목록에 `src/migrations/`(ESLint `src/migrations/**`)를 더했다. 저장소 규칙 시험의 단일 목록 `CHECK_EXCLUSIONS`(AC-INFRA-010)에도 같은 항목을 더해 두 파일과 계속 대조한다. 결과 `pnpm lint` 경고 4 → 0. 다른 제외 항목은 그대로다.

**품질 게이트 (2026-11-18, M2 변경 적용 작업 트리, HEAD `1dfe7dd` + 미커밋 변경 — 로그 `.moai/state/verify/deploy-m2/gate-*.log`)**

| 명령 | 결과 |
|---|---|
| `pnpm typecheck` | 종료 0 |
| `pnpm build` | 종료 0, 경로 목록에 `ƒ /api/cron/cleanup` |
| `pnpm migrate:check` | 종료 0, `[migrate:check] OK: no new migration for no-s3 and fake-s3.` 이어서 `git status --short src/migrations` 출력 없음 |
| `pnpm test` | 종료 0, `Test Files 49 passed (49)`, `Tests 742 passed (742)` (기준선 725 + 17), `Lines : 99.41% ( 674/678 )`, `scheduled-cleanup.ts` 라인 100% |
| `pnpm e2e` | 종료 0, `98 passed (1.9m)` (기준선 94 + 4) |
| `pnpm lint` | 종료 0, 경고 0 |
| `pnpm format:check` | 종료 0, `All matched files use Prettier code style!` |
| 표식 잔여(컨테이너 안 psql) | `application_attempts key_hash LIKE 'test-%'` 0 · `tours slug LIKE 'test-%'` 0 · `users email LIKE '%@example.test'` 0 · `applications email LIKE 'test-%'` 0 · `sumbi_migration_check%` DB 0 · 개발 신청 ID 2033 존재 1 |
| 보존 목록 diff(`plan.md` §E-2 마지막 명령) | `.prettierignore`·`eslint.config.mjs` 각 +2줄(위 범위 지정 예외)만, 잠금 구간·점유·정렬·접수·상태 변경·요청 사항 삭제·미디어 읽기 규칙 파일 변경 없음 |

**AC 상태(M2 범위)**

| AC | 상태 | 근거 |
|---|---|---|
| AC-DEPLOY-007 | PASS | 단위 `scheduled-cleanup.spec.ts`(같음 참 / 한 글자·길이·빈 값·Bearer 없음·null 거짓 / 비밀값 없음·빈 값·15자 거짓, 16자 허용), 저장소 규칙 `timingSafeEqual`, E2E 401(머리글 없음 — 본문 `Unauthorized`, JSON 아님)·401(틀림)·405(`Allow: GET`)·200(두 키·0 이상 정수·`no-store`), 401 전후 10분 지난 표식 시도 1건 유지 |
| AC-DEPLOY-008 | PASS | 단위 기준 시각(`2026-11-17T09:00Z` → `08:50Z`·`2024-11-17T09:00Z`, `2028-02-29` → `2026-03-01`, ±1ms), 통합 a1·l1 삭제·a2·l2 보존·다른 컬렉션 수 불변, 같은 now 재실행 `{0, 0}`, 질의 수 2행·20행 모두 `query 2 = connect 2`, 기존 `rate-limit.spec.ts` 통과 |
| AC-DEPLOY-009 | PASS | 저장소 규칙: crons 1개·경로·일정, `regions ["icn1"]`, `buildCommand` 스크립트 존재, `x-vercel-protection-bypass`·`Bearer`·`CRON_SECRET` 문자열 없음, route 파일 존재. E2E 200 |
| AC-DEPLOY-010 | PASS | 단위 문구 포함 4개·`다음 신청 처리 때` 없음, 버전 변경·해시 일치·날짜 형식, 저장소 규칙 `privacyPolicyVersion` 쓰는 곳 1곳, E2E 신청 화면 문구 표시·저장된 신청 버전 = 새 버전 |
| AC-DEPLOY-015 (수동 정리 SQL 부분) | PASS | 저장소 규칙: README 배포 절 SQL 한 문장(`with`, `delete` 2개, `;` 1개, 두 열 이름), README와 구현의 `테이블.열` 목록이 같음(`admin_audit_logs.occurred_at`, `application_attempts.attempted_at`). `.env.example`·README 변수 목록·`git grep` 비밀값 검사는 M5 |

**Gaps(M2)**: Vercel에서의 실제 Cron 호출·보호 통과(R1)는 M5 수동 확인. `git.deploymentEnabled` 문법 미확인(M5). 커밋은 이 작업 트리에서 하지 않음(Windows Smart App Control이 `moai` pre-commit 훅을 막음) — 사용자가 커밋.

### M3·M4 — 저장소 켜짐 동작·업로드 안내, 운영 설정 점검·신뢰 경계·로그 가림·검색 제외 (2026-11-18, 기준 HEAD `b3976bb`, 작업 트리 `.claude/worktrees/agent-ae1c0a316f1df9c6d`)

**기준선**: M2 품질 게이트와 같은 HEAD — `pnpm test` 742, `pnpm e2e` 98(오케스트레이터 제공, M2 기록과 같음). 로그 `.moai/state/verify/deploy-m3m4/`.

**RED (구현 전, 원문 발췌 — `red-unit-1.log`, `red-integration-1.log`, `red-e2e-1.log`, `red-unit-2.log`)**:

```
$ pnpm exec vitest run --project unit tests/unit/production-env.spec.ts tests/unit/log-redaction.spec.ts tests/unit/repo-rules.spec.ts --coverage.enabled=false
 FAIL  |unit| tests/unit/log-redaction.spec.ts
Error: Cannot find module '../../src/lib/log-redaction' imported from …/tests/unit/log-redaction.spec.ts
 FAIL  |unit| tests/unit/production-env.spec.ts
TypeError: PRODUCTION_ENV_NAMES is not iterable
AssertionError: expected 'undefined' to be 'string' // Object.is equality          (media admin.description)
AssertionError: expected [ 'node:path', 'node:url', …(16) ] to include './lib/log-redaction'
AssertionError: expected '// 신청 횟수 제한 — SPEC-APPLY-001 REQ-APPL…' to contain 'https://vercel.com/docs/headers/reque…'
AssertionError: src/app/robots.ts가 있어야 한다: expected false to be true
 Test Files  3 failed (3)
      Tests  4 failed | 86 passed (90)

$ pnpm exec vitest run --project integration tests/integration/deploy-config.spec.ts tests/integration/log-redaction.spec.ts --coverage.enabled=false
     × VERCEL_ENV=production에서 CRON_SECRET이 비면 build 점검이 이름만 출력하고 실패한다
AssertionError: expected +0 not to be +0 // Object.is equality
Error: Cannot find module '../../src/lib/log-redaction' imported from …/tests/integration/log-redaction.spec.ts
 Test Files  2 failed (2)
      Tests  1 failed | 7 passed (8)

$ pnpm exec playwright test tests/e2e/noindex.spec.ts
    Expected: 200  Received: 404                      (/robots.txt)
    Error: /  Expected substring: "noindex, nofollow"  Received string: ""   (X-Robots-Tag)
    Error: /  expect(locator).toHaveCount(expected) failed  Expected: 1  Received: 0   (로봇 메타 태그)
  3 failed

$ pnpm exec vitest run --project unit tests/unit/repo-rules.spec.ts -t "main 가지만" --coverage.enabled=false
AssertionError: expected undefined to deeply equal { '**': false, main: true }
      Tests  1 failed | 90 skipped (91)
```

RED에서 이미 통과한 시험(회귀 방지 시험): M3 통합 4건(가짜 S3 값 → `disableLocalStorage: true`·처리기 1개, S3 없음 → 로컬 `media/`, 두 설정의 필드 목록 같음, 서명 주소 엔드포인트 없음)과 CSRF 2건, 저장소 규칙 "s3Storage 옵션에 접근 규칙 해제·서명 주소·직접 업로드 없음" — M1이 플러그인 등록·옵션을 이미 이 형태로 넣었기 때문이며, 이번 시험은 그 상태를 고정한다.

**GREEN**: 단위 6개 파일 `Test Files 6 passed (6)`, `Tests 236 passed (236)`(`green-unit-1.log`, 기존 `preflight.spec.ts`·`preflight-cli.spec.ts`·`deploy-config.spec.ts` 포함). 통합 5개 파일 `Tests 22 passed (22)`(`green-integration-1.log`, 기존 `pii-logging`·`admin-pii-logging`·`config-env` 포함). E2E `tests/e2e/noindex.spec.ts` `3 passed (29.0s)`(`green-e2e-1.log`).

**기록 항목 (plan.md §F M3·M4)**

| 항목 | 값 |
|---|---|
| 업로드 안내 위치 | `src/collections/Media.ts` `admin.description` — Payload 3.93.0은 컬렉션 설명을 목록 화면과 문서(업로드) 편집 화면 머리에 그린다(`@payloadcms/next/dist/views/Document/renderDocumentSlots.js` 59~69, `@payloadcms/ui/dist/views/Edit/index.js` 470). 문구: `사진은 5MB까지 올릴 수 있지만, 실제 사이트에서는 4MB 이하 파일을 올려 주세요.` 생성 파일 `src/payload-types.ts`의 `Media` JSDoc에도 같은 문구가 들어감(`pnpm generate:types` 결과와 같음). 5MB 판정·`File size exceeds the 5 MB limit.` 불변 |
| 저장소 켜짐 확인 방법 | `tests/integration/deploy-config.spec.ts` — `vi.stubEnv`로 가짜 S3 값(`test-` 접두어, `.invalid` 주소)을 준 뒤 `payload.config.ts`를 새로 불러와 sanitize 결과를 본다. S3 클라이언트는 업로드 때에만 만들어지므로(`@payloadcms/storage-s3/dist/index.js` `getStorageClient`) 네트워크 연결 없음 |
| 익명 미디어 읽기 범위 | 파일 요청은 `checkFileAccess` → 어댑터 처리기 순서(plan §A.2 `getFile.js`), `disablePayloadAccessControl` 미사용(저장소 규칙) → `media` 읽기 규칙 유지. 기존 AC-TOUR-006(`catalog-api.spec.ts`)·AC-LANDING-003 E2E·통합 통과(전체 게이트) |
| 운영 점검 문구 | `[preflight] Missing or invalid production environment variables: <이름, …>.` + `Check them in the Vercel project environment variables (DATABASE_URL must not contain SSL parameters). Values are not shown.` |
| 운영 점검 규칙 | `VERCEL_ENV === 'production'`인 `build`·`start`만. `NEXT_PUBLIC_SERVER_URL`은 `https:`이고 `new URL(값).origin === 값`(경로·끝 빗금·질의·조각·사용자 정보 없음). `CRON_SECRET` `^[A-Za-z0-9]{16,}$`. `DATABASE_CA_CERT`에 `-----BEGIN CERTIFICATE-----`. S3 다섯 개 필수. `DATABASE_URL` 질의 인자 `ssl`·`sslmode`·`sslrootcert`·`sslcert`·`sslkey`(대소문자 무시) 거부 — REQ의 두 인자에 더해, pg-connection-string이 같은 방식으로 코드의 `ssl` 설정을 덮어쓰는 세 인자도 막음 |
| Vercel 빌드 스크립트 연결 | `scripts/vercel-build.mjs` 첫 단계가 이미 `node scripts/preflight.mjs build`이고 Vercel 환경(`VERCEL_ENV=production`)을 물려받으므로 변경 없음(M1 단위 시험이 순서 고정) |
| 로그 가림 | `src/lib/log-redaction.ts` — `redactErrorForLog`(pino `serializers.err`: `params`·`detail` 삭제, 모든 문자열의 줄 머리 `params:`부터 다음 `    at` 줄 전까지 `params: [REDACTED]`, `cause` 재귀 깊이 8, 순환 참조 처리), `hooks.logMethod`(문자열 인자·병합 객체의 `msg`·`err` 외 오류 값·printf 인자 가림, `{ err }`만 있고 메시지가 없으면 pino가 `err.message`를 쓰므로 가린 문구를 `msg`에 넣음, 첫 인자가 오류면 `{ err }` + 가린 메시지로 바꿈). `payload.config.ts` `logger: { options: redactingLoggerOptions(), destination: defaultLoggerOptions }` — 출력은 Payload 기본과 같은 pino-pretty 스트림 |
| 로그 가림 통합 증거 | 실제 PostgreSQL `insert into application_attempts … values (<표식>, null, …)` NOT NULL 위반 → `DrizzleQueryError`(문구·`params`·`cause.detail`에 표식, `cause.code` `23502` — 준비 단언으로 확인) → Payload `logError`·`{ err, msg }` 기록 → 메모리 출력에 표식 0회, `insert into application_attempts`·`23502` 남음. 실행 중 Payload 인스턴스의 pino `serializers.err === redactErrorForLog` |
| 검색 제외 | `src/app/robots.ts`(`User-Agent: *` / `Disallow: /`, 사이트맵 없음 — `next build` 경로 목록 `○ /robots.txt`), `next.config.ts` `headers()` `source: '/:path*'` → `X-Robots-Tag: noindex, nofollow`, `(frontend)/layout.tsx` `metadata.robots: { index: false, follow: false }`. E2E: `/`·`/tours`·`/admin`·`/api/tours`·공개 투어 이미지·`/robots.txt`·`/no-such-page`(404) 머리글, `/`·`/tours` 메타 태그 정확히 1개 |
| 접속 IP 근거 | `rate-limit.ts` `clientIpFromHeaders` 위 `@MX:NOTE` — Vercel이 `x-forwarded-for`를 덮어씀, `https://vercel.com/docs/headers/request-headers`. 동작 불변 |
| `vercel.json` `git.deploymentEnabled` | 공식 문서 https://vercel.com/docs/project-configuration/git-configuration 를 2026-11-18 이 작업 환경에서 `curl`로 받아 확인(작업 도구에 WebFetch 없음): 형식 "Object of key branch identifier String and value Boolean, or Boolean", 가지 이름은 minimatch, "If a branch matches multiple rules and at least one rule is true, a deployment will occur." → `{ "**": false, "main": true }` 적용(`main`만 자동 배포). 실제 동작은 M5 첫 배포에서 확인 |

**`pnpm audit --json` 재측정(2026-11-18, `audit.json`)**: `{"moderate":2,"high":3}` — 의존성 변경 없음(`package.json`·`pnpm-lock.yaml` 차이 없음). M1 대비 새 권고 1건은 새로 공개된 권고다.

| 권고 | 심각도 | 도달 경로 | 판단 |
|---|---|---|---|
| happy-dom GHSA-834v-8h66-3h79 / GHSA-c8p4-j97h-3vg8 | high | `@payloadcms/richtext-lexical>@lexical/headless>happy-dom`, `vitest>happy-dom` | M1과 같음 — 실행 경로 미도달 |
| picomatch GHSA-fc5q-39xc-vjpf (새로 공개, "ReDoS through single-branch repeated extglobs", `<=4.0.7`, 수정 버전 없음) | high | 104개 경로, 설치본 4.0.7·2.3.2. `payload>json-schema-to-typescript>tinyglobby(>fdir)>picomatch`(타입 생성), `sass>chokidar>anymatch·readdirp>picomatch`(관리자 스타일 빌드·감시), `find-node-modules>findup-sync>micromatch>picomatch`, 그 밖 `next`·`vitest`·`eslint-config-next`·`vite` 경유 | 실행 경로 미도달로 판단 — 모두 빌드·타입 생성·파일 감시·린트·시험 도구 경로이고, 요청 입력이 글로브 패턴으로 쓰이는 곳이 없다. 수정 버전이 없어 상향 불가. 차단자 아님(오케스트레이터 확인 권장) |
| esbuild GHSA-67mh-4wv8-2f99 | moderate | `@payloadcms/db-postgres>drizzle-kit>…>esbuild` | M1과 같음 |
| minimatch GHSA-g3hv-75wg-m249 | moderate | `eslint-config-next>…>minimatch`(11) | M1과 같음 |

**품질 게이트 (2026-11-18, HEAD `b3976bb` + 스테이징 변경 — 로그 `.moai/state/verify/deploy-m3m4/gate-*.log`)**

| 명령 | 결과 |
|---|---|
| `pnpm lint` | 종료 0, 경고 0 |
| `pnpm format:check` | 종료 0, `All matched files use Prettier code style!` |
| `pnpm typecheck` | 종료 0 |
| `pnpm migrate:check` | 종료 0, `[migrate:check] OK: no new migration for no-s3 and fake-s3.` 이어서 `git status --short src/migrations` 출력 없음 |
| `pnpm build` | 종료 0, 경로 목록에 `ƒ /api/cron/cleanup`, `○ /robots.txt` |
| `pnpm test` | 종료 0, `Test Files 53 passed (53)`, `Tests 812 passed (812)` (기준선 742 + 70), `Lines : 99.33% ( 745/750 )`, `log-redaction.ts` 라인 97.82%, `preflight.ts` 100% |
| `pnpm e2e` | 종료 0, `101 passed (3.0m)` (기준선 98 + 3) |
| `pnpm generate:types` / `pnpm generate:importmap` | 종료 0, `payload-types.ts`는 `Media` 설명 JSDoc 2줄만 차이(위 기록), `importMap.js` 차이 없음 |
| 표식 잔여(컨테이너 안 psql) | `application_attempts key_hash LIKE 'test-%'` 0 · `tours slug LIKE 'test-%'` 0 · `users email LIKE '%@example.test'` 0 · `applications email LIKE 'test-%'` 0 · `media filename LIKE 'test-%'` 0 · `sumbi_migration_check%` DB 0 · 개발 신청 ID 2033 존재 1 |
| 보존 목록 diff(`git diff --stat b3976bb -- .prettierignore eslint.config.mjs .gitattributes src/lib/occupancy.ts … src/lib/access.ts package.json pnpm-lock.yaml pnpm-workspace.yaml`) | 출력 없음 |
| 비밀값 모양 검사(AC-DEPLOY-015 ①②③ 정규식, 추적·미추적 `src`·`tests`·`scripts`·`vercel.json`·`next.config.ts`) | 일치 없음 |

**AC 상태(M3·M4 범위)**

| AC | 상태 | 근거 |
|---|---|---|
| AC-DEPLOY-001 | PASS | 단위 `production-env.spec.ts`(올바름 → 빈 목록, 8개 변수 하나씩 빠짐·공백 → 그 이름만, 주소 형식 오류 7종, `CRON_SECRET` 15자·특수문자·공백·앞뒤 공백, PEM 아님, SSL 인자 6종, 출력에 값 표식 없음, `build`·`start` 운영 분기, `VERCEL_ENV` 없음·`preview`·`development`·`Production` → 운영 점검 안 함), 통합 자식 프로세스(운영 + `CRON_SECRET` 빔 → 종료 ≠ 0·이름만·표식 없음, `VERCEL_ENV` 비우면 운영 문구 없음·종료 0), 기존 `preflight.spec.ts`·`preflight-cli.spec.ts` 통과 |
| AC-DEPLOY-005 | PASS | 통합 `NEXT_PUBLIC_SERVER_URL=https://test-csrf.example.invalid` → `serverURL` 같음·`csrf` 포함, 빈 값 → 빈 항목 없음. 저장소 규칙 Vercel 근거 주석·문서 주소. 기존 `clientIpFromHeaders`·`rateLimitKey` 단위 시험 통과 |
| AC-DEPLOY-006 | PASS(로컬 부분) | 통합(가짜 S3 → `disableLocalStorage: true`·처리기 ≥ 1·`storage-s3` 엔드포인트 없음, 없음 → `staticDir` = 저장소 루트 `media`·로컬 저장, 두 설정 필드 목록 같음·`prefix`·`_objectKey` 포함), 저장소 규칙(옵션에 `disablePayloadAccessControl`·`signedDownloads`·`clientUploads` 없음, 안내 문구 `4MB 이하`·5MB 판정·오류 문구 불변). 실제 저장소 입출력은 AC-DEPLOY-014(M5) |
| AC-DEPLOY-011 | PASS | 단위 `log-redaction.spec.ts`(문자열·스택 가림, 직렬화에서 `params`·`detail` 없음·SQL·`code`·이름 남음, 중첩 cause, 순환·깊은 중첩, 실제 pino 메모리 로거로 `{ err }`·문자열 msg·`{ err, msg }`·오류 첫 인자·printf 인자 — 출력에 표식 없음), 통합 실제 DB 오류(위), 저장소 규칙 `logger: { options: redactingLoggerOptions(),` |
| AC-DEPLOY-012 | PASS | E2E `noindex.spec.ts` 3건(robots.txt, 7개 응답의 `x-robots-tag`, 메타 태그 1개), 저장소 규칙 robots 파일·사이트맵 없음. 기존 SPEC-LANDING-001 E2E 포함 전체 101 통과 |
| AC-DEPLOY-009 (Preview 끄기 추가) | PASS | 저장소 규칙 `git.deploymentEnabled` = `{ "**": false, "main": true }` + 기존 M2 규칙 통과 |

**@MX 태그 변경**: 추가 — `log-redaction.ts` `@MX:NOTE`(가림 규칙·범위의 한계), `@MX:ANCHOR`(+`@MX:REASON`, `redactingLoggerOptions` — 설정·단위·통합 시험이 같은 옵션 사용), `rate-limit.ts` `@MX:NOTE`(Vercel `x-forwarded-for` 덮어쓰기). 제거·갱신 없음.

**Gaps(M3·M4)**: ① 실제 Supabase Storage 업로드·내려받기와 익명 공개 범위는 로컬에서 재현하지 않음(AC-DEPLOY-014, M5). ② `git.deploymentEnabled`의 `**`가 Vercel에서 `/`가 든 가지 이름까지 막는지, `main`이 그대로 배포되는지는 실제 배포에서만 확인 가능(M5 — `main` 푸시 뒤 운영 배포가 생기는지, 다른 가지 푸시에 배포가 없는지). ③ 로그 가림은 Payload 설정의 로거만 덮음 — `console.error` 직접 출력, `payload migrate` 명령줄 자체 로거는 범위 밖(plan §B.6, R18). ④ pg 오류의 다른 칸(`where`·`hint` 등)과 오류 문구 자체에 값이 들어가는 오류(예: 형식 변환 실패 `invalid input syntax for type integer: "<값>"`)는 REQ-DEPLOY-011 범위(params·detail·`params:` 이후) 밖이라 가리지 않음. ⑤ 커밋은 이 작업 트리에서 하지 않음(Smart App Control) — 사용자가 커밋.

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_

## plan-audit 3회차 결과 (2026-11-17)

PASS 0.91 (0.69 → 0.84 → 0.91). 반드시 고칠 항목 없음. 선택 지적은 run 단계에서 반영한다.

- O1 (M1 전에 반영): `git status --short src/migrations` 빈 출력 조건은 `src/migrations/`가 커밋된 뒤에만 성립한다. 실행 전후 출력을 비교하는 방식으로 판정하거나, 최초 마이그레이션 커밋 이후에만 이 조건을 적용한다
- O2: `buildCreateMigration.js` 인용 범위는 82~85가 맞다(plan L141의 83~86 수정)
- O3: N6 인용(`initClientUploads.js` 26~37)은 3회차 감사에서 tarball로 확인됨
