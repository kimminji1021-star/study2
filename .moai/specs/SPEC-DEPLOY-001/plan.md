# SPEC-DEPLOY-001 구현 계획

> 요구사항은 `spec.md`, 수용 기준은 `acceptance.md`가 기준이다. 이 문서는 결정의 근거, 앞선 SPEC 이월 항목의 처리, 작업 순서, 위험, 사용자 전용 단계 안내를 다룬다.
> 개발 방식: TDD(`quality.yaml` `constitution.development_mode: tdd`). 검증 셸: Windows PowerShell 5.1(앞선 SPEC들과 같음).
> 마일스톤은 되돌리기 가장 어려운 결정(운영 DB 스키마를 만드는 첫 마이그레이션과 연결 방식 — 스키마에 열을 더하는 저장소 플러그인 등록과 새 의존성 포함)을 맨 앞에, 데이터를 지우는 예약 정리와 법률 문구를 그다음에, 저장소 켜짐 동작과 업로드 안내, 설정 점검, 실제 배포 확인, 정리 작업 순으로 놓았다.

## §A. 맥락

### A.1 현재 상태 (계획 시점 HEAD `0057e9d` = `origin/main`)

- SPEC-INFRA-001·TOUR-001·APPLY-001·ADMIN-001·LANDING-001 모두 `status: completed`. 배포한 적 없음. 저장소에 `vercel.json`, `src/migrations/`, `robots` 설정이 없다(`ls` 확인).
- `src/payload.config.ts`: `db: postgresAdapter({ pool: { connectionString: process.env.DATABASE_URL } })` — 풀 크기·SSL·`push` 지정 없음. `serverURL: process.env.NEXT_PUBLIC_SERVER_URL ?? ''`(빈 문자열이면 CSRF 허용 목록에 아무것도 안 들어감). `logger` 지정 없음(Payload 기본 pino 로거). `upload.limits.fileSize`는 5MB.
- `src/lib/preflight.ts`: 필수 변수는 `DATABASE_URL`, `PAYLOAD_SECRET` 둘뿐. 운영 전용 변수 점검과 원격 DB 차단이 없다. `scripts/preflight.mjs`가 `dev`·`build`·`start`·`test`·`e2e` 단계에서 부른다(`package.json` scripts). `seed`는 preflight를 거치지 않는다.
- `src/lib/rate-limit.ts`: 접속 IP는 `x-forwarded-for` 첫 값 → `x-real-ip` → `'unknown'`(20~25행). 키는 `HMAC-SHA256(PAYLOAD_SECRET, 'apply-rate-limit:' + ip)`(32~37행). 신청마다 10분 지난 시도를 지운다(53행, `@MX:DEBT`의 `@MX:UPGRADE`가 "배포 SPEC에서 예약 정리"를 가리킴).
- `src/collections/ApplicationAttempts.ts`·`AdminAuditLogs.ts`: 두 컬렉션 모두 삭제는 관리자 포함 거부(`denyAll`). 서버 코드만 로컬 API(`overrideAccess: true`)나 원시 SQL로 지울 수 있다.
- `src/lib/consent.ts`: IP 변환값 설명이 "10분간 신청 횟수를 세는 데만 쓰고 그 뒤 다음 신청 처리 때 삭제"(16행). 버전 `2026-11-12.99052510`(48행). 문구를 바꾸면 버전 리터럴도 바꿔야 하며 `tests/unit/consent.spec.ts`가 강제한다.
- `src/lib/submit-application.ts` 80~82행·`src/lib/application-status.ts` 163~179행: 명시적 트랜잭션 안에서 `set_config('lock_timeout', …, true)`와 `SELECT … FOR UPDATE`. `src/lib/transaction-db.ts`: 잠금 구간의 원시 SQL은 트랜잭션 연결로만(풀 고갈 시 서로 기다리며 멈추는 문제 R2).
- `src/collections/Media.ts`: `upload.staticDir`가 저장소 루트 `media/`(43행), 읽기 규칙 `mediaReadAccess`.
- 개발 DB는 Payload push 모드로 스키마가 만들어졌고, `payload_migrations`에 개발용 행(batch −1)이 있다(SPEC-INFRA-001 잔여 위험).
- `pnpm audit`(2026-11-17 실행): 권고 4건 — happy-dom high 2건(`@payloadcms/richtext-lexical>@lexical/headless>happy-dom`, `@vitest/coverage-v8>vitest>happy-dom`), esbuild moderate(`@payloadcms/db-postgres>drizzle-kit>…>esbuild`), minimatch moderate(`eslint-config-next>…`). 이 프로젝트에는 `richText` 필드가 없다(`grep` 0건).
- 작업 트리: `git status`의 미추적 파일(`.claude/launch.json`, `.moai/design/`, `.moai/logs/…`, `.moai/reports/legal/`, `.moai/reports/sync-audit/`)은 이 SPEC과 무관하며 건드리지 않는다.

### A.2 확인한 근거 (설치본·공식 문서)

설치본 기준: Payload 3.93.0, `@payloadcms/drizzle` 3.93.0, `drizzle-orm` 0.45.2, `pg` 8.20.0, `pg-connection-string` 2.14.1, `pino` 9.14.0. 경로는 저장소 루트 기준(`.pnpm` 경로는 줄여 적음). 공식 문서는 2026-11-17 WebFetch로 확인했다.

| 항목 | 확인 내용 | 근거 |
|---|---|---|
| 개발용 push 조건 | `NODE_ENV !== 'production'`이고 `PAYLOAD_MIGRATING !== 'true'`이고 `push !== false`일 때만 push. `NODE_ENV === 'production'`이고 `prodMigrations`가 있으면 시작 때 마이그레이션 | `node_modules/@payloadcms/db-postgres/dist/connect.js` 109~120 |
| 어댑터 옵션 | `pool: PoolConfig`, `push?`, `prodMigrations?`, `migrationDir?` | `node_modules/@payloadcms/db-postgres/dist/types.d.ts` 30~70 |
| 마이그레이션 명령 | `migrate`, `migrate:create`, `migrate:status` 등. `migrate:create`는 DB에 연결하지 않음. `--skip-empty`·`--force-accept-warning` 인자 | `node_modules/payload/dist/bin/migrate.js` 10~18·21~40 |
| 새 마이그레이션 판정 | 마이그레이션 디렉터리의 마지막 스냅숏 JSON과 현재 스키마를 비교. 바뀐 점이 없고 `skipEmpty`면 파일 없이 종료 코드 0. **바뀐 점이 있으면 새 파일을 써 넣고 역시 0** → 검사는 종료 코드가 아니라 파일 목록 비교로 해야 함(§B.3). 새 파일을 쓴 뒤 `writeMigrationIndex`가 디렉터리의 모든 마이그레이션 파일 기준으로 **`index.ts`를 다시 씀** → 새 파일만 지우면 `index.ts`가 지운 파일을 import한 채 남으므로 `index.ts`도 되돌려야 함(plan-audit 2회차 N2) | `@payloadcms/drizzle/dist/utilities/buildCreateMigration.js` 55~90(빈 경우 종료는 82~85, 파일 쓰기 101·110~111, `writeMigrationIndex` 호출 112~114), `payload/dist/database/migrations/writeMigrationIndex.js` 26~30 (2026-11-17 설치본 재확인) |
| push와 마이그레이션 섞기 | DB에 batch −1(개발 push 표시) 행이 있으면 `migrate`가 "데이터 손실" 확인을 묻는다 → 개발 DB에는 마이그레이션을 적용하지 않고, 운영 DB에는 push하지 않는다 | `@payloadcms/drizzle/dist/migrate.js` 30~45, Payload 문서 "do not mix push and migrations" |
| 운영 마이그레이션 실행 | 빌드 전에 `payload migrate && pnpm build` 권장, 실패하면 배포가 거부됨. `prodMigrations`는 Vercel 같은 서버리스의 첫 실행을 느리게 할 수 있음 | https://payloadcms.com/docs/database/migrations |
| 이름 붙은 준비된 문장 | `@payloadcms/drizzle` 배포본에 `.prepare(` 호출 없음 → Payload는 이름 붙은 준비된 문장을 만들지 않음. `@payloadcms/db-postgres/dist`도 같은 이유로 검사 대상(AC-DEPLOY-004) | `grep -rln "\.prepare(" @payloadcms/drizzle/dist` 0건 |
| 연결 문자열과 SSL | `connectionString`을 해석한 값이 다른 설정을 덮어쓴다 → 연결 문자열에 `sslmode`가 있으면 코드의 `ssl` 설정이 무시됨 | `node_modules/.pnpm/pg@8.20.0/…/pg/lib/connection-parameters.js` 57~60·85 |
| `sslmode=require`의 뜻 | 이 버전에서 `require`는 `verify-full`의 별칭으로 처리되고 경고를 낸다(CA를 주지 않으면 Supabase 인증서 검증에 실패할 수 있음). `sslmode`가 없으면 `parse`가 `ssl` 키를 만들지 않아 코드의 `ssl`이 유지된다 | `pg-connection-string@2.14.1/index.js` 77~78·137~150(별칭 처리), 222~227(경고 문구) |
| 인증서 없는 원격 연결 | 풀 설정에 `ssl`이 없으면 `pg`는 `PGSSLMODE` 환경 변수만 보고, 기본은 암호화 없는 연결이다 → 원격인데 인증서가 없으면 연결 자체를 거부해야 한다(REQ-DEPLOY-004) | `pg@8.20.0/lib/connection-parameters.js` `readSSLConfigFromEnvironment` |
| Payload가 붙잡는 연결 | `connectWithReconnect`가 시작 때 `pool.connect()`로 받은 클라이언트에 오류 감시 수신기를 달고 돌려주지 않는다 → 풀에서 실제로 쓸 수 있는 연결은 `max − 1` | `node_modules/@payloadcms/db-postgres/dist/connect.js` 4~38·45~49 (2026-11-17 재확인) |
| 저장소 플러그인의 스키마 영향 | 켜진 컬렉션에 `_objectKey` 텍스트 필드를 **무조건** 더하고, `alwaysInsertFields`이거나 `prefix`가 있으면 `prefix` 필드도 더한다(둘 다 DB 열). `s3Storage({ enabled: false, alwaysInsertFields: true })`면 어댑터 없이 같은 필드만 넣고 나머지 설정(로컬 `staticDir` 등)은 그대로 둔다. `enabled: false`이고 `alwaysInsertFields`가 없으면 설정을 그대로 돌려준다(필드 없음). S3 어댑터 자체는 필드를 더하지 않는다. 타입 설명: "ensures a consistent schema across all environments" | npm 배포본 `@payloadcms/storage-s3@3.93.0/dist/index.js` 29·45~63, `@payloadcms/plugin-cloud-storage@3.93.0/dist/plugin.js` 12~48, `dist/fields/getFields.js` 153~175·182~187, `dist/types.d.ts` 115~130 (2026-11-17 `npm pack`으로 받아 압축만 풀어 확인) |
| 관리자 import map | 꺼진 `s3Storage`도 `initClientUploads`를 부르고, 이 함수는 `enabled`와 관계없이 `@payloadcms/storage-s3/client#S3ClientUploadHandler`를 관리자 의존성에 넣는다("Ensure client handler is always part of the import map") → 플러그인 등록 뒤 `importMap.js` 재생성은 조건이 아니라 확정(M1) | `@payloadcms/storage-s3@3.93.0/dist/index.js` 30~44, `@payloadcms/plugin-cloud-storage@3.93.0/dist/utilities/initClientUploads.js` 26~37 (plan-audit 2회차 N6, 배포본 확인) |
| Supabase Data API | RLS 없는 노출 스키마(`public`)의 테이블은 권한 있는 역할이 읽고 쓸 수 있다. 대시보드 Data API 개요에서 **Enable Data API**를 끄면 자동 REST 엔드포인트가 권한·RLS와 관계없이 응답하지 않는다. 설정 화면의 **Automatically expose new tables**만 끄면 일부 권한이 남는다 | https://supabase.com/docs/guides/api/securing-your-api (2026-11-17 확인), …/database/postgres/row-level-security |
| Vercel 본문 한도 | 함수의 요청 본문**과 응답 본문**(스트리밍 아님) 한도 4.5MB | https://vercel.com/docs/functions/limitations |
| `x-vercel-id` | 요청이 거친 리전들을 `::`로 이어 적고 마지막에 요청 ID를 둔다. 앞쪽은 요청을 받은 엣지 리전, 요청 ID 바로 앞이 함수가 실행된 리전 → 리전 확인은 마지막 리전 칸이나 배포 상세의 함수 리전으로 한다 | plan-audit 1회차 D8, run 단계 M5에서 실제 머리글로 확인 |
| Payload 로거 | `logger`에 pino 옵션(+출력 스트림) 또는 인스턴스를 줄 수 있다. 오류는 `logError`가 `{ err }` 객체로 `error` 수준에 기록 | `node_modules/payload/dist/config/types.d.ts` 1115~1140, `node_modules/payload/dist/utilities/logError.js` 1~15, `…/utilities/logger.js` 14~33 |
| Drizzle 오류 문구 | `DrizzleQueryError`는 문구에 `Failed query: <SQL>\nparams: <값들>`을 넣고 `params` 속성도 가진다 → 기본 로거가 신청자 정보를 기록할 수 있음(SPEC-ADMIN-001 R23의 원인) | `drizzle-orm@0.45.2/errors.js` 10~20 |
| 파일 요청의 접근 규칙 | 파일 요청은 `checkFileAccess`를 먼저 실행한 뒤 저장소 어댑터의 처리기(handlers)로 넘긴다 → 저장소를 바꿔도 `media` 읽기 규칙이 그대로 적용됨 | `node_modules/payload/dist/uploads/endpoints/getFile.js` 21·30~33 |
| 저장소 어댑터 버전 | `@payloadcms/storage-s3@3.93.0` 존재, `peerDependencies: { payload: "3.93.0" }`, 의존: `@aws-sdk/client-s3`·`lib-storage`·`s3-request-presigner` ^3.614.0, `@payloadcms/plugin-cloud-storage` 3.93.0 | `npm view @payloadcms/storage-s3@3.93.0 version peerDependencies dependencies --json` |
| 어댑터 동작 | 기본값은 파일 주소를 그대로 두고 Payload 접근 규칙 유지(`disablePayloadAccessControl`을 켜면 해제). 켜면 해당 컬렉션의 `disableLocalStorage`가 자동으로 `true`. `clientUploads`는 Vercel의 서버 업로드 4.5MB 한도를 피하는 옵션 | https://payloadcms.com/docs/upload/storage-adapters |
| Supabase S3 | 엔드포인트 `https://<project_ref>.storage.supabase.co/storage/v1/s3`, 리전은 프로젝트 리전, 대시보드 저장소 설정에서 접근 키 발급, "S3 키는 모든 버킷 전체 권한·RLS 우회, 서버에서만" | https://supabase.com/docs/guides/storage/s3/authentication |
| Supabase 연결 | 직접 연결은 IPv6(IPv4는 유료 추가 기능). 세션 모드 5432, 트랜잭션 모드 6543은 준비된 문장 미지원. 서버리스에는 트랜잭션 모드 권장. 사용자 이름 `postgres.<PROJECT-REF>`, 호스트는 대시보드 Connect 창에서 복사 | https://supabase.com/docs/guides/database/connecting-to-postgres |
| Supabase SSL | CA 인증서는 Database Settings의 SSL Configuration에서 내려받음. SSL 강제는 켜야 하는 설정이며 공유 풀러에도 적용. `verify-full`로 서버 인증서·호스트 이름 검증 | https://supabase.com/docs/guides/platform/ssl-enforcement |
| Supabase 무료 한도 | 무료는 Nano: DB 최대 연결 60, 풀러 최대 클라이언트 200. 7일 동안 활동이 적으면 일시 중지, 1년 안에 대시보드에서 재개 | https://supabase.com/docs/guides/platform/compute-and-disk, …/free-plan-pausing |
| Cron 보호 | `CRON_SECRET`을 두면 Vercel이 `Authorization: Bearer <값>`으로 보냄(16자 이상, 머리글에 쓸 수 있는 글자만). 값은 배포를 만들 때 고정 | https://vercel.com/docs/cron-jobs/manage-cron-jobs |
| Cron 실행 | 운영 배포에서만 실행, HTTP GET, 사용자 에이전트 `vercel-cron/1.0`, 시간대 UTC, 실패해도 재시도 없음, 전달은 최선 노력(빠지거나 두 번 올 수 있음 → 중복에 안전하게), 리디렉트를 따라가지 않음 | 같은 문서, https://vercel.com/docs/cron-jobs |
| Cron Hobby 한도 | 하루 한 번까지(더 잦은 식은 배포 실패), 지정한 시(hour) 안의 아무 때나 실행(±59분), 프로젝트당 100개 | https://vercel.com/docs/cron-jobs/usage-and-pricing |
| Cron과 배포 보호 | Cron 호출이 Deployment Protection을 통과하는지는 Cron 문서·배포 보호 문서·우회 문서 어디에도 적혀 있지 않음 → **미확인**, 실제 배포에서 확인(§G R1) | 위 세 문서 + https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection |
| 배포 보호 | Vercel Authentication은 모든 요금제. 범위 "All Deployments"(운영 주소 포함)도 모든 요금제. "Standard Protection"은 운영 주소를 보호하지 않음. Password Protection은 Hobby 불가. Hobby는 외부 사용자 1명까지 접근 승인 | https://vercel.com/docs/deployment-protection, …/vercel-authentication, https://vercel.com/docs/plans/hobby |
| Hobby 약관·한도 | "Hobby 요금제는 개인 또는 비상업 용도로만" (약관 4절). 함수 최대 실행 300초, 런타임 로그 1시간 보관 | https://vercel.com/legal/terms, https://vercel.com/docs/plans/hobby |
| 함수 리전 | 새 프로젝트 기본 `iad1`. 대시보드 또는 `vercel.json` `regions`로 지정. Hobby는 리전 하나 | https://vercel.com/docs/functions/configuring-functions/region |
| 접속 IP 머리글 | `x-forwarded-for`는 클라이언트 공개 IP이며 Vercel이 덮어써 외부 값을 전달하지 않음(위조 방지). `x-real-ip`·`x-vercel-forwarded-for`는 같은 값 | https://vercel.com/docs/headers/request-headers |
| 패키지 관리자 | pnpm 6~12 지원. 잠금 파일 `lockfileVersion: 9.0`이면 pnpm 9 또는 10이 쓰임. Corepack을 켜면 `packageManager` 필드 버전 사용 | https://vercel.com/docs/package-managers, 저장소 `pnpm-lock.yaml` 1행 |

**확인하지 못한 것(run 단계 M1~M5에서 확인)**: `vercel.json`의 `git.deploymentEnabled` 정확한 문법, Corepack 환경 변수 이름(`ENABLE_EXPERIMENTAL_COREPACK=1`)의 현행 여부, Vercel이 `engines.node` 범위에서 고르는 Node 주 버전, Supavisor 트랜잭션 모드에서 이름 없는 확장 질의 프로토콜의 동작(실제 배포 확인 AC-DEPLOY-014), Vercel의 여러 줄 환경 변수 값 보존.

### A.3 앞선 SPEC 배포 이월 항목의 처리

"1단계" = 이 SPEC, "2단계" = 공개 출시 SPEC(예: SPEC-LAUNCH-001), "나중" = 별도 후속.

| # | 항목 | 출처 | 처리 | 이 SPEC의 위치 |
|---|---|---|---|---|
| 1 | `NEXT_PUBLIC_SERVER_URL` 운영 필수 — 빈 값이면 Payload CSRF 허용 목록이 비고, 요청 사항 삭제 POST의 출처 검사(R30)가 꺼짐 | INFRA F8, ADMIN R30, TOUR 잔여 위험, LANDING A4 | **1단계** | REQ-DEPLOY-001·005 |
| 2 | 개발 push 대신 마이그레이션, 현재 스키마 전체를 담은 첫 마이그레이션 | INFRA deferred, `tech.md` §5 | **1단계** | REQ-DEPLOY-003 |
| 3 | 개발 DB의 `payload_migrations` 개발용 행 정리 | INFRA deferred | **나중(하지 않음)** — 개발 DB는 계속 push 모드로 쓰고 마이그레이션을 적용하지 않으므로 그 행은 정상 표시다(§B.3) | §B.3 |
| 4 | Supabase 풀러에서 명시적 트랜잭션·`FOR UPDATE`·`set_config(…, true)` 호환, 연결 방식 선택 | 오케스트레이터 메모, APPLY·ADMIN 잠금 구간 | **1단계** | REQ-DEPLOY-004·014 |
| 5 | 업로드를 Supabase Storage로(S3 어댑터), 버전 호환, 공개 범위 유지 | TOUR 잔여 위험, LANDING R7·A4 | **1단계** | REQ-DEPLOY-006·014 |
| 6 | 저장소 전환 뒤 대표 사진 파일 주소·익명 접근 재확인 | LANDING "출시 전 점검" 3번 | **1단계** | AC-DEPLOY-014 |
| 7 | Vercel에서 `x-forwarded-for` 신뢰 | APPLY F5 | **1단계(코드 변경 없음, 근거 기록)** | REQ-DEPLOY-005, §B.7 |
| 8 | 횟수 제한 HMAC 비밀값 분리 | APPLY F4 | **1단계 결정: 분리하지 않음** — 근거 §B.7. 사용자가 원하면 나중 | §B.7 |
| 9 | 신청 시도 기록 예약 정리 + 최대 보관 시간 고지 | APPLY F3, 법률 보고서 §3·"출시 전 보완" 1번, 사용자 결정 D6 | **1단계** | REQ-DEPLOY-007~010 |
| 10 | 작업 기록 2년 지난 행 자동 삭제 | ADMIN R20 | **1단계(구현)** / 2년 기준의 법률 확인은 **2단계** | REQ-DEPLOY-008 |
| 11 | Payload 기본 오류 로그의 질의 바인딩 값(개인정보) | ADMIN R23 | **1단계** | REQ-DEPLOY-011 |
| 12 | 남은 `pnpm audit` 권고 | INFRA deferred, TOUR | **1단계(다시 재고 도달 경로 기록)** / 상향은 **나중** | REQ-DEPLOY-016, §B.10 |
| 13 | 인스턴스 수와 DB 연결 풀 크기 | 오케스트레이터 메모 | **1단계** | REQ-DEPLOY-004, §B.2 |
| 14 | 운영 대표 사진 크기·형식 확인 | LANDING "출시 전 점검" 2번, R6 | **2단계**(실제 사진을 올릴 때) | `spec.md` §5 |
| 15 | 바닥글 처리방침 링크 | LANDING R17 | **2단계** | `spec.md` §5 |
| 16 | 파비콘 | LANDING F4 | **2단계** | `spec.md` §5 |
| 17 | PowerShell 7 확인 | INFRA accepted_debt("CI 도입 때") | **나중** — 이 SPEC은 CI를 도입하지 않음 | `spec.md` §5 |
| 18 | 처리방침 게시, 처리 위탁 공개, 국외 이전 공개, 보호책임자, 민감정보 삭제 절차, 시행 예정 개정 확인, 변호사 최종 확인 | APPLY "출시 전 보완" 2~8번, 법률 보고서 §5 | **2단계** | `spec.md` §5 |
| 19 | Vercel Hobby 비상업 용도 한정, Supabase 무료 일시 중지 | `tech.md` §5, 공식 문서 | **2단계 결정**(1단계는 비공개 확인용이라 기록만) | 가정 A3·A4 |
| 20 | 관리자 화면 수동 확인 AC-ADMIN-003·015 | ADMIN carry_over.manual_check | **나중(배포와 무관)** | — |
| 21 | 회차 삭제 경합 F1, 잠금 구간 `depth: 0` F2, 자동 마감 교착 R26 ② | APPLY F1·F2, ADMIN follow_up_spec | **나중(후속 SPEC)** | `spec.md` §5 |
| 22 | 익명 이미지 요청 하나에 질의 3회 | LANDING F1 | **나중(관측 뒤)** | — |
| 23 | 업로드 5MB 한도와 Vercel 요청 본문 4.5MB 한도 | Payload 문서(이번 조사) | **1단계 결정(사용자 확정 D7/Q5): 코드 한도 5MB 유지 + 업로드 화면에 "실제 사이트에서는 4MB 이하" 안내** — 근거 §B.4 | REQ-DEPLOY-006, AC-DEPLOY-006, §B.4 |
| 24 | 함수 실행 시간 한도와 관리자 CSV | `tech.md` §5 | **1단계(기록)** — Hobby 300초, 지금 CSV는 회차 하나 단위라 충분. 실제 배포 확인에 CSV 1회 포함 | AC-DEPLOY-014 |
| 25 | 이메일 어댑터 경고, E2E 로그의 pg 경고 | INFRA·TOUR 잔여 위험 | **나중** | — |
| 26 | Supabase Data API로 Payload 테이블(신청자 정보)이 노출되는 경로 | plan-audit 1회차 D5, Supabase 문서 | **1단계** — 사용자가 Data API를 끔 | REQ-DEPLOY-013, AC-DEPLOY-014, §I.1 |

### A.4 Tier M 판단

- 예상 변경: 생성 — `vercel.json`, `scripts/vercel-build.mjs`, `src/app/api/cron/cleanup/route.ts`, `src/lib/scheduled-cleanup.ts`, `src/lib/cron-auth.ts`(또는 정리 모듈 안), `src/lib/log-redaction.ts`, `src/lib/storage.ts`(저장소 설정 판정), `src/lib/db-connection.ts`(풀·SSL·루프백 판정), `src/app/robots.ts`, `src/migrations/`(생성 파일 3개 안팎). 수정 — `src/payload.config.ts`, `src/lib/preflight.ts`, `scripts/preflight.mjs`, `scripts/seed.ts`(또는 `src/lib/seed.ts`), `src/lib/consent.ts`, `src/lib/rate-limit.ts`(주석만), `next.config.ts`(머리글), `src/app/(frontend)/layout.tsx`(로봇 메타), `.env.example`, `README.md`, `package.json`·`pnpm-lock.yaml`(의존성 1개·스크립트). 테스트 생성 6~8개.
- 파일 수 약 30개로 Tier M 파일 지침(5~15개)을 넘지만, 넘는 몫은 테스트와 생성 파일(마이그레이션·잠금 파일)이다. 직접 작성 제품 코드는 약 450~650줄, 테스트 약 800~1,100줄로 Tier M 범위(300~1,000줄) 안이다.
- M으로 두는 이유: "운영 배포 기반"이라는 한 목적이고, 동시성 설계를 새로 하지 않으며(기존 잠금 구간 유지), 요구사항 16개·수용 기준 16개로 예산 안이다. Tier L(설계·조사 문서 별도)이 필요할 만큼 구조를 바꾸지 않는다.
- 넘칠 경우: run 단계 중 제품 코드가 900줄을 넘거나 마일스톤이 6개를 넘으면 차단자 보고 후 분할을 검토한다(1순위: 업로드 저장소 M3를 별도 SPEC으로).

## §B. 결정과 근거

### B.1 비공개 방식 — Vercel Authentication + All Deployments

| 선택지 | Hobby 가능 | 운영 주소 보호 | Cron | 판단 |
|---|---|---|---|---|
| **Vercel Authentication + "All Deployments"(채택)** | 가능(공식 문서) | 보호 | 통과 여부 미확인(§G R1) | 채택 — 로그인한 본인(과 승인한 외부 사용자 1명)만 봄 |
| Vercel Authentication + "Standard Protection" | 가능 | **보호하지 않음** — `<프로젝트>.vercel.app`이 누구에게나 열림 | 영향 없음 | 대안(R1이 막힐 때만, 사용자 결정) |
| Password Protection | **불가**(Pro 유료 부가 기능) | — | — | 기각 |
| 앱 안에서 직접 만드는 기본 인증(Basic) 관문 | 가능 | 보호 | 경로 예외 필요 | 기각 — Payload의 `Authorization` 머리글 인증(JWT)과 겹치고 직접 만든 보안 코드가 늘어남 |
| Vercel Preview 배포만 쓰기 | 가능 | 해당 없음 | **Cron이 실행되지 않음**(운영 배포에서만) | 기각 — 사용자 결정 D6의 Cron을 확인할 수 없음 |

- 1단계의 비공개 미리보기는 `main` 가지의 운영 배포에 "All Deployments" 보호를 건 것이다. 다른 가지의 Preview 배포는 쓰지 않는다(`vercel.json`으로 끔 — 문법은 run 단계 확인).
- 첫 배포가 보호 없이 열리는 틈을 막는 순서: 저장소를 가져올 때 환경 변수를 넣지 않아 첫 빌드가 시작 전 점검에서 실패하게 두고(REQ-DEPLOY-001), 보호를 켠 다음 환경 변수를 넣고 다시 배포한다(§I.2).
- 검색 제외 표시(REQ-DEPLOY-012)는 보호가 실수로 꺼졌을 때를 대비한 이중 장치다. 보호가 켜져 있으면 검색 로봇은 내용에 닿지 못한다.
- `NEXT_PUBLIC_SERVER_URL`은 운영 주소(`https://<프로젝트>.vercel.app`)다. 배포마다 생기는 고유 주소(`<프로젝트>-<임의값>-….vercel.app`)로 관리자 화면을 쓰면 CSRF 허용 목록과 출처가 달라 관리자 쿠키 요청이 거부될 수 있으므로 늘 운영 주소로 접속한다(§I 안내에 적음).

### B.2 DB 연결 — 트랜잭션 풀러, 인증서 검증, 풀 크기

| 선택지 | 판단 |
|---|---|
| **공유 풀러 트랜잭션 모드 6543(채택)** | Supabase가 서버리스에 권하는 방식. 트랜잭션 동안 서버 연결 하나를 붙잡으므로 `BEGIN … FOR UPDATE … COMMIT`과 트랜잭션 한정 `set_config(…, true)`는 한 서버 연결에서 실행된다. 세션 단위 상태(`SET` 세션 값, `LISTEN`, 이름 붙은 준비된 문장)는 쓰면 안 되며, 이 프로젝트는 쓰지 않는다(§A.2: Payload에 `.prepare(` 없음, 잠금 시간은 `set_config(…, true)`만 사용) |
| 공유 풀러 세션 모드 5432 | 호환성은 더 넓지만 클라이언트 연결마다 서버 연결을 계속 붙잡아 서버리스에서 연결이 빨리 바닥남. **대안** — 트랜잭션 모드 실제 확인(AC-DEPLOY-014)이 실패할 때 포트만 바꿔 씀 |
| 직접 연결 5432 | IPv6 전용(IPv4는 유료) — Vercel 함수에서 쓰기 어려움. 기각 |

- 인증서: Supabase CA를 사용자가 대시보드에서 내려받아 PEM 내용을 Vercel 환경 변수 `DATABASE_CA_CERT`에 넣는다(공개 인증서라 비밀값은 아니지만 계정 로그인이 필요해 사용자 단계). 원격 DB면 풀 설정에 `ssl: { ca, rejectUnauthorized: true }`를 주고, 연결 문자열에는 `sslmode`·`sslrootcert`를 넣지 않는다(넣으면 코드 설정이 덮어써짐 — §A.2). 시작 전 점검이 운영 빌드에서 연결 문자열의 `sslmode`를 거부한다. 여러 줄 값이 한 줄로 들어오는 경우(`\n` 글자)를 받아 줄바꿈으로 바꾸는 처리는 run 단계에서 실제 값 형태를 보고 정한다.
- 인증서 없는 원격 연결 거부: 풀 설정 함수는 원격 주소인데 `DATABASE_CA_CERT`가 없거나 PEM 인증서가 아니면 설정 객체를 돌려주지 않고 변수 이름만 담은 영문 오류를 던진다. `ssl`이 빠진 설정을 돌려주면 `pg`가 `PGSSLMODE`만 보고 암호화 없이 연결할 수 있기 때문이다(§A.2). 운영 빌드의 시작 전 점검만으로는 로컬 `pnpm build`·`payload migrate`처럼 운영 빌드가 아닌 경로를 막지 못하므로, 판정을 `payload.config.ts`가 부르는 풀 설정 함수 안에 둔다(REQ-DEPLOY-004).
- 풀 크기: `DATABASE_POOL_MAX`(정수 3~20). 값이 있으면 원격·루프백 모두에 적용하고(최소값 동시 신청 시험을 루프백에서 하기 위함), 없으면 원격은 5, 루프백은 `pg` 기본값 그대로(지금 동작). 최소 3인 이유: ① Payload의 `connectWithReconnect`가 시작 때 연결 1개를 오류 감시용으로 계속 붙잡는다(§A.2) → 쓸 수 있는 연결은 `max − 1` ② 정원 확인 트랜잭션이 연결 1개를 쥔 동안 같은 요청이나 다른 요청의 트랜잭션 밖 질의(Payload의 일반 조회 등)가 연결 1개를 더 얻을 수 있어야 한다. 최소 2(실사용 1)면 R2의 "서로 기다리며 멈춤"이 그대로 생긴다. 잠금 구간 안의 원시 SQL은 계속 트랜잭션 연결로만 실행한다(`transaction-db.ts` R2 규칙 유지). Supabase는 서버리스 함수 하나에 연결 1개를 권하지만 이 프로젝트에는 맞지 않는다. 최소값에서 동시 신청 2건이 끝까지 처리되는지 통합 시험한다(AC-DEPLOY-004).
- 연결 예산: Supabase 무료 풀러의 클라이언트 한도 200 ÷ 인스턴스당 5 = 동시 인스턴스 40개까지. 이 계산은 "인스턴스 하나가 풀 하나"라는 전제이며, 요청이 몇 개든 한 인스턴스의 풀은 5를 넘지 않는다. Vercel **Fluid compute**(최근 새 프로젝트 기본값이라고 알려짐 — 미확인)가 켜져 있으면 인스턴스 하나가 여러 요청을 동시에 처리하므로 인스턴스 수는 줄고(예산에 유리), 대신 한 인스턴스의 요청들이 실사용 4개 연결을 나눠 쓰며 넘치면 풀에서 기다린다(교착이 아니라 대기 — 잠금 구간은 트랜잭션 연결 하나만 씀). Fluid compute가 꺼져 있으면 요청마다 인스턴스가 생길 수 있으나 1단계 사용량(사용자 혼자 확인)에서는 몇 개를 넘지 않는다. run 단계 M5에서 Settings → Functions의 Fluid compute 상태를 사용자에게 확인받아 연결 예산을 `progress.md` §E.2에 다시 적고, 2단계 공개 전 트래픽 예상과 함께 다시 본다.
- 이 결정을 코드 한 곳에 모은다(예: `src/lib/db-connection.ts`의 순수 함수 `isLoopbackDatabaseUrl(url)`, `buildPoolConfig(env)`). 단위 시험으로 고정한다.

### B.3 스키마 반영 — 첫 마이그레이션과 빌드 단계 적용

- 첫 마이그레이션: run 단계 M1에서 **저장소 플러그인을 먼저 등록한 뒤**(`s3Storage({ enabled, alwaysInsertFields: true, … })` — §B.4) `payload migrate:create initial`(DB 연결 없음)로 `src/migrations/<시각>_initial.{ts,json}`와 `index.ts`를 만든다. 플러그인 등록 전에 만들면 `media`의 플러그인 열(`prefix`, `_objectKey`)이 빠진 마이그레이션이 되어, 운영(플러그인 켜짐)에서 업로드·조회 질의가 "column does not exist"로 실패한다(plan-audit 1회차 D1). 이름과 디렉터리는 Payload 기본값(run 단계에서 실제 위치 확인).
- 같음 확인(REQ-DEPLOY-003): 로컬 Docker PostgreSQL에 임시 데이터베이스(예: `sumbi_migration_check`)를 만들고, `DATABASE_URL`을 그 DB로 바꿔 `payload migrate`를 실행한 뒤, `information_schema`·`pg_catalog`에서 테이블·열·형식·널 허용·기본값·인덱스·외래 키·열거형 목록을 뽑아 개발 DB(push)와 비교한다. `payload_migrations` 행 내용은 비교에서 뺀다. 끝나면 임시 DB를 지운다. 이 시험은 루프백 DB만 쓴다.
- 바뀐 점 없음 확인 — `migrate:check` 스크립트(예: `scripts/migrate-check.mjs`, `pnpm migrate:check`): `payload migrate:create … --skip-empty`는 바뀐 점이 없으면 파일 없이 0으로 끝나지만, 바뀐 점이 **있어도 새 마이그레이션 파일을 써 넣고 0으로 끝난다**(`@payloadcms/drizzle/dist/utilities/buildCreateMigration.js` 83~86 — 빈 경우에만 일찍 종료). 그래서 종료 코드로 판정하지 않는다. 스크립트는 ① 실행 전 `src/migrations/` 파일 목록을 기록 ② S3 변수 없는 환경으로 `payload migrate:create drift-check --skip-empty` 실행 ③ 가짜 S3 값 다섯 개(`test-` 접두어, 연결하지 않음 — `migrate:create`는 DB에 연결하지 않고 S3 클라이언트도 업로드 때에만 만든다)를 준 환경으로 한 번 더 실행 ④ 실행 뒤 목록과 비교해 새 파일이 있으면 그 파일(`.ts`·`.json`)을 지우고 `index.ts`를 ①에서 저장한 내용으로 되돌린 뒤 이름을 출력하고 0이 아닌 종료 코드로 끝난다. ①에서는 목록과 함께 **`index.ts`의 내용(바이트)도 저장**한다 — Payload는 새 파일을 쓸 때 `writeMigrationIndex`로 `index.ts`를 디렉터리 전체 기준으로 다시 쓰므로(§A.2), 새 파일만 지우면 `index.ts`가 지운 파일을 import한 채 남아 `pnpm typecheck`·`pnpm build`가 깨진다(plan-audit 2회차 N2). 복원은 `finally`에 두어 ②·③이 예외로 끝나도 실행되게 하고, 새 파일이 없어도 `index.ts` 내용이 달라졌으면 되돌린다. (대안: `src/migrations/`를 임시 디렉터리에 복사하고 그곳을 `migrationDir`로 써서 생성하면 추적 디렉터리에 아예 쓰지 않는다 — 설정 방법은 run 단계가 정하되, 어느 쪽이든 판정은 아래와 같다.) 품질 게이트는 이 스크립트의 종료 코드와, 실행 뒤 `git status --short src/migrations`의 빈 출력으로 판정한다(AC-DEPLOY-003). 앞으로 컬렉션을 바꾸는 SPEC은 마이그레이션도 함께 만들어야 이 검사를 통과한다(새 규칙 — `tech.md` 갱신은 sync 단계).
- 운영 적용: `vercel.json`의 `buildCommand`를 빌드 스크립트(예: `scripts/vercel-build.mjs`)로 바꾸고, 이 스크립트는 `VERCEL_ENV === 'production'`일 때만 시작 전 점검 → `payload migrate` → `pnpm build`를 차례로 실행한다. 운영이 아니면 아무 명령도 실행하지 않고 영문 문구와 함께 0이 아닌 종료 코드로 끝낸다(Preview 배포는 쓰지 않으므로 실행될 일이 없고, 실행되면 설정 실수다 — 로컬 `pnpm build`는 이 스크립트를 쓰지 않는다).
- 마이그레이션 → 빌드 순서의 대가: 마이그레이션은 적용됐는데 그 뒤 `next build`가 실패하면, 이전 배포가 새 스키마의 DB를 계속 쓴다. 그래서 이 SPEC 이후 마이그레이션은 이전 코드와 함께 돌 수 있는 형태(열 추가·널 허용 우선, 삭제·이름 바꾸기는 두 번에 나눔)여야 한다(R6에 기록, `tech.md` 규칙 추가는 sync 단계). 첫 마이그레이션은 빈 DB에 적용되므로 이 문제가 없다. `prodMigrations`(첫 실행 때 적용)는 서버리스 첫 응답이 느려지고 여러 인스턴스가 동시에 시작할 때의 동작을 이 SPEC에서 확인하지 않으므로 쓰지 않는다.
- 개발 DB: 지금처럼 push 모드. 마이그레이션을 적용하지 않는다(batch −1 행이 있어 `migrate`가 데이터 손실 확인을 묻는다). 원격 DB에 push가 일어나지 않게 어댑터에 `push: isLoopback`을 준다(REQ-DEPLOY-002의 두 번째 문장, Vercel에서는 `NODE_ENV=production`이라 원래도 push하지 않음 — 이중 장치).
- 운영 DB는 처음부터 마이그레이션으로만 만든다. 사용자가 로컬에서 운영 DB에 `pnpm dev`를 띄우는 실수는 REQ-DEPLOY-002가 막는다.

### B.4 업로드 저장소 — `@payloadcms/storage-s3` 3.93.0

- 새 직접 의존성 1개. 정확한 버전 `3.93.0`(Payload와 같은 버전, 피어 의존성이 `payload: 3.93.0` 고정). 사용자 결정 D3와 TOUR·LANDING 이월 항목이 요구하므로 "새 npm 패키지 금지" 원칙의 예외로 기록한다. 설치 뒤 `pnpm-workspace.yaml`의 `allowBuilds`에 새 항목이 필요한지(빌드 스크립트 있는 간접 의존성) 확인하고, 필요하면 차단자로 보고한다.
- 등록과 켜는 조건: 플러그인은 **언제나** `plugins`에 넣고, 켜고 끄는 것만 바꾼다 — `s3Storage({ enabled: <다섯 변수 모두 있음>, alwaysInsertFields: true, collections: { media: true }, bucket, config: { endpoint, region, forcePathStyle: true, credentials } })`. 다섯 변수(`S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`)가 모두 있으면 켜지고, 하나도 없으면 꺼져 개발·테스트는 지금처럼 로컬 `media/`를 쓴다. 일부만 있으면 설정 오류로 시작을 멈춘다. 꺼진 경우의 `bucket`·`config` 값은 쓰이지 않으므로 빈 값이어도 된다(run 단계에서 타입이 요구하는 형태 확인).
- 왜 언제나 등록하나(plan-audit 1회차 D1): 플러그인은 켜진 컬렉션에 `_objectKey` 필드를 무조건 더하고, `alwaysInsertFields`면 `prefix` 필드도 더한다(둘 다 DB 열 — §A.2). 처음 계획처럼 S3 변수가 있을 때만 플러그인을 넣으면, 운영(켜짐)의 `media` 스키마가 S3 변수 없는 로컬에서 만든 마이그레이션에 없는 열을 기대해 업로드·조회가 실패한다. `enabled: false` + `alwaysInsertFields: true`는 어댑터 없이 같은 필드만 넣으므로 두 환경의 스키마가 같아진다(타입 설명 "ensures a consistent schema across all environments"). 첫 마이그레이션은 이 설정으로 만들고(§B.3), `migrate:check`는 두 환경 모두로 검사한다.
- 영향: 개발 DB에는 push로 두 열이 더해지고(로컬 업로드에서는 `prefix`가 빈 문자열), `src/payload-types.ts`의 `Media` 타입에 두 필드가 생긴다(M1에서 다시 생성). 두 필드는 관리자 화면에서 숨김·읽기 전용이다.
- 쓰지 않는 옵션: `disablePayloadAccessControl`(켜면 파일 주소가 저장소 직접 주소가 되어 공개 범위 규칙이 사라짐), `signedDownloads`, `clientUploads`(브라우저가 저장소에 직접 올리면 `media` 컬렉션의 5MB·형식 검사 훅을 거치는지 이 SPEC에서 확인하지 않았음).
- 버킷: 비공개(Public 끔). 파일은 항상 Payload 함수를 거쳐 나가며 `getFile.js`가 `checkFileAccess` → 어댑터 처리기 순서로 실행한다(§A.2). 그래서 익명에게는 공개 투어 대표 이미지와 홈 대표 사진만 보인다. 대가: 이미지 바이트가 함수를 거쳐 전송되어 Vercel 함수 사용량에 잡힌다(1단계 규모에서는 작음).
- 판정 함수(예: `src/lib/storage.ts`의 `resolveStorageConfig(env)` → `null | 설정`, 일부만 있으면 오류)를 단위 시험하고, 설정 객체에 플러그인이 들어갔을 때 `media`의 `upload.disableLocalStorage`가 `true`이고 `disablePayloadAccessControl`이 참이 아님을 통합 시험한다. 실제 Supabase 저장소 입출력은 로컬에서 재현하지 않고 실제 배포 확인(AC-DEPLOY-014)으로 본다.
- 5MB 한도와 Vercel 4.5MB: Vercel 함수의 요청 본문 한도 때문에 운영에서는 약 4.4MB를 넘는 파일이 Payload에 닿기 전에 HTTP 413으로 끝날 수 있다. REQ-TOUR-001은 이미 "REST 요청은 앞선 요청 본문 한도에 먼저 걸려 HTTP 413으로 끝날 수 있다"를 허용하므로 요구사항 충돌은 없다. **사용자 결정(D7/Q5)**: 코드 한도(5MB)는 그대로 두고, `src/collections/Media.ts`의 관리자 안내 문구(업로드 화면에 보이는 컬렉션 설명 `admin.description` 등 — 정확한 위치는 run 단계가 Payload 3.93.0 관리자 화면에서 보이는 곳으로 정함)에 한국어 안내를 더한다. 문구 초안: `사진은 5MB까지 올릴 수 있지만, 실제 사이트에서는 4MB 이하 파일을 올려 주세요.` 5MB 판정 훅과 오류 문구는 바꾸지 않는다. 대표 사진 권장 크기(1MB 안팎)는 이미 안내되어 있다.
- 4.5MB 한도는 스트리밍이 아닌 **응답** 본문에도 적용된다(§A.2). 파일은 Payload 함수를 거쳐 나가므로, 4.5MB 넘는 이미지는 내려받기도 막힐 수 있다. 업로드가 이미 약 4.4MB에서 막히므로 실제 문제는 작지만, 위 안내 문구가 이 경우도 함께 막는다.

### B.5 예약 정리와 IP 변환값 보관 고지

- 경로와 위치: `GET /api/cron/cleanup`. 후보 위치는 라우트 그룹 밖의 `src/app/api/cron/cleanup/route.ts`(Next.js는 정적 경로를 모든 경로 받기보다 먼저 고르므로 `(payload)/api/[...slug]`보다 우선 — run 단계 M2의 첫 E2E로 확인: 인증 없는 요청이 Payload의 404 JSON이 아니라 이 처리기의 401이어야 함). 우선순위가 어긋나면 Payload `endpoints` 설정의 사용자 정의 엔드포인트로 옮긴다. `export const dynamic = 'force-dynamic'`, 리디렉트 없음, 끝 빗금 없음.
- 인증: `Authorization`이 정확히 `Bearer ${CRON_SECRET}`이면 통과. 비교는 `crypto.timingSafeEqual`로 하되 길이가 다르면 같은 길이의 해시(예: 두 값의 SHA-256)를 비교해 길이 차이로 시간이 갈리지 않게 한다. `CRON_SECRET`이 없거나 16자 미만이면 항상 401.
- 정리 규칙(예: `src/lib/scheduled-cleanup.ts`의 `runScheduledCleanup(payload, now)`):
  - 신청 시도 기록: `attemptedAt < now − 10분`인 행 삭제(기존 `recordAttempt`의 기준과 같음)
  - 작업 기록: `occurredAt < (now의 UTC 연도 − 2, 같은 월·일·시각)`인 행 삭제. 2월 29일 기준은 JS `Date`의 `setUTCFullYear` 동작(3월 1일로 넘어감)을 따르고 단위 시험으로 고정
  - 두 삭제는 각각 한 번의 `DELETE … WHERE …` 질의(원시 SQL, 트랜잭션 밖 연결 풀)로 하고 지운 행 수를 받는다. 테이블·열 이름(`application_attempts.attempted_at`, `admin_audit_logs.occurred_at`로 예상)은 M2에서 실제 이름을 확인해 §E.2에 적는다. 로컬 API `payload.delete({ where })`는 지울 문서를 모두 읽어 와 행 수에 따라 무거워지므로 쓰지 않는다
  - 다른 테이블·컬렉션은 건드리지 않는다. 같은 시각으로 두 번 돌리면 두 번째는 0행(중복 전달에 안전)
- 응답: `{"attemptsDeleted": n, "auditLogsDeleted": m}`, `Cache-Control: no-store`. 오류는 원인 없는 고정 문구로 500(질의 값이 응답에 실리지 않게).
- 일정: `0 18 * * *`(UTC, Hobby는 18:00~18:59 사이 아무 때나 — 한국 시각 오전 3:00~3:59). 사람이 적은 새벽이라 정리와 신청이 겹칠 일이 적다.
- **IP 변환값의 실제 최대 보관 시간 계산**:
  - 정리는 하루 한 번, 지정한 시 안의 아무 때나 → 이어지는 두 실행의 간격은 최대 24시간 59분 59초
  - 시도가 어떤 실행 직전 10분 안에 생기면 그 실행에서는 지워지지 않고 다음 실행에서 지워진다 → 정상 운영 최대 약 25시간 10분
  - Cron 전달은 최선 노력이라 한 번 빠질 수 있다 → 한 번 빠지면 최대 약 49시간 10분
  - 그래서 고지는 **"만든 때부터 늦어도 72시간 안에 삭제"**로 적는다(한 번 빠져도 지켜짐). 연속 두 번 빠지면 약 73시간 10분으로 고지를 넘는다 — 잔여 위험(§G R4). 신청이 들어오면 그때마다 오래된 시도를 지우는 기존 동작이 더해져 실제 보관 시간은 대개 이보다 짧다
  - 법률 보고서가 제안한 "24시간"은 Hobby의 하루 한 번·시 단위 정밀도로는 지킬 수 없다(Pro는 분 단위로 더 자주 실행 가능 — 2단계 요금제 결정과 함께 다시 볼 수 있음)
- Cron이 보호에 막힐 때(사용자 결정 D7/Q6): 미리보기 동안은 사용자가 Supabase SQL 편집기에서 수동 정리 SQL(§I.5)을 실행해 같은 두 삭제를 한다. 미리보기 동안 신청은 사용자의 확인용 신청뿐이므로, 확인 신청을 한 날마다 한 번 실행하면 72시간 고지가 지켜진다(신청마다 오래된 시도를 지우는 기존 동작도 그대로 돈다). 자동 삭제 확인은 2단계 출시 조건으로 넘긴다(§G R1). 수동 정리 SQL은 지운 행 수만 돌려주고 비밀값을 다루지 않는다.
- 새 필수 동의 "수집 항목" 문구(사용자 확정 D7 — Q1 72시간, Q2 두 설명 추가):
  `이름, 이메일, 연락처, 신청 인원, 선택한 회차. 부정 신청 방지를 위해 접속 IP를 비밀키로 변환한 값(원래 IP 주소는 저장하지 않음. 10분 동안 신청 횟수를 세는 데만 쓰고, 매일 한 번 자동으로 지워 만든 때부터 늦어도 72시간 안에 삭제)`
  - "원래 IP 주소는 저장하지 않음"과 "비밀키로 변환한"은 법률 보고서 §3·§6 제안을 따른 것으로, 실제 동작(`rate-limit.ts` 32~37행)과 같다
  - 문구를 바꾸면 `PRIVACY_POLICY_VERSION`을 `<확정일>.<새 해시 앞 8자리>`로 바꾸고 `tests/unit/consent.spec.ts`가 일치를 확인한다. 이미 접수된 신청의 버전 문자열은 그대로다
  - 동의 처리 근거를 제15조 제1항 제6호(정당한 이익)로 바꾸는 권장안은 이 SPEC에서 하지 않는다(2단계 변호사 확인)
- `rate-limit.ts`의 `@MX:DEBT`/`@MX:UPGRADE` 주석을 "예약 정리 구현됨(SPEC-DEPLOY-001), 남은 것은 원자적 카운터"로 갱신한다. 신청마다 지우는 동작은 그대로 둔다.

### B.6 로그 가림

- Payload 설정의 `logger: { options: { …pino 옵션, serializers: { err: redactingErrSerializer }, hooks: { logMethod: <문자열 인자의 params: 뒤 가림> } } }`로 기본 로거를 대신한다(출력 형식은 지금과 같은 pretty 출력을 유지할 수 있는지 run 단계에서 확인 — 형식보다 가림이 우선).
- 메시지 문자열 경로: Drizzle 쪽에는 오류 객체가 아니라 `err.message`를 메시지 문자열에 이어 붙여 기록하는 경로가 있다(`@payloadcms/drizzle/dist/utilities/parseError.js` 3~12, `migrate.js` 88~93, `transactions/beginTransaction.js` 52). 그래서 `err` 직렬화만으로는 부족하고, pino `hooks.logMethod`로 문자열 인자(`msg`)의 `\nparams:` 이후도 `\nparams: [REDACTED]`로 바꾼다(REQ-DEPLOY-011).
- 가림 함수(예: `src/lib/log-redaction.ts`): pino 기본 오류 직렬화 결과에서 ① `params` 속성 삭제 ② `detail` 속성 삭제 ③ `message`·`stack`의 `\nparams:` 이후를 `\nparams: [REDACTED]`로 바꿈 ④ `cause`에도 재귀 적용(깊이 제한). 오류 이름, SQLSTATE 코드(`code`), SQL 문(`query`)은 남긴다.
- 확인: 단위 — 표식 이메일을 `params`·문구·`detail`·`cause`에 넣은 가짜 `DrizzleQueryError`를 직렬화하면 표식이 나오지 않음. 통합 — 실제 PostgreSQL에서 제약 위반을 일으켜(예: 표식 데이터로 고유 값 충돌) Payload 로거(메모리 출력 스트림)로 `logError`를 거친 출력에 표식이 없음.
- 범위의 한계(Gap으로 기록): ① Next.js가 잡지 못한 서버 오류를 `console.error`로 직접 찍는 경로는 Payload 로거를 거치지 않는다. ② `payload migrate` 같은 명령줄 도구는 설정의 로거 대신 자체 pretty 로거로 시작한다(`payload/dist/bin/migrate.js` 6~9·37~42) — 운영 빌드의 마이그레이션 실패 로그에는 이 SPEC의 가림이 적용되지 않는다. 다만 첫 마이그레이션은 빈 DB에 스키마만 만들며 신청자 값을 바인딩하지 않으므로 실제 노출 위험은 작다. 이 SPEC은 Payload 설정의 로거만 다룬다. Hobby 런타임 로그 보관은 1시간이다.

### B.7 운영 신뢰 경계 — 사이트 주소, 접속 IP, HMAC 비밀값

- `serverURL`: 운영 빌드에서 `NEXT_PUBLIC_SERVER_URL`이 없으면 빌드가 멈춘다(REQ-DEPLOY-001). 값이 있으면 Payload가 CSRF 허용 목록에 자동으로 넣는다(`payload.config.ts` 주석, SPEC-INFRA-001 확인). 통합 시험이 "값을 주면 허용 목록에 그 값이 있음"을 확인한다.
- 접속 IP: Vercel은 `x-forwarded-for`를 덮어써 외부 값을 전달하지 않는다(§A.2). 지금 코드(첫 값 사용)는 Vercel에서 클라이언트 IP를 정확히 얻으므로 바꾸지 않고, `clientIpFromHeaders`에 근거 주석(`@MX:NOTE`)만 더한다. Vercel 앞에 다른 프록시를 두면 이 전제가 깨진다(2단계 자체 도메인·CDN 결정 때 다시 봄).
- HMAC 비밀값: 분리하지 않는다. 이유 — ① 이미 용도 접두어(`apply-rate-limit:`)로 다른 서명과 섞이지 않음 ② 키 해시는 최대 72시간만 남음 ③ 초보 사용자가 관리할 비밀값을 하나 줄임. 대가 — `PAYLOAD_SECRET`을 바꾸면 그 시점의 시도 기록 키가 달라져 10분 동안 횟수가 새로 시작된다(영향 작음). 사용자가 분리를 원하면 나중에 `RATE_LIMIT_SECRET`을 더하는 작은 변경이다.

### B.8 운영 설정 점검과 원격 DB 차단

- `src/lib/preflight.ts`(타입 제거로 직접 불러오는 파일이라 다른 `.ts` import 금지 규칙 유지)에 순수 함수를 더한다: `findInvalidProductionEnv(env)`(REQ-DEPLOY-001의 변수 목록과 형식), `isLoopbackHost(host)`. 오류 문구는 영문, 변수 이름·호스트 이름만 담는다(REQ-INFRA-010).
- 적용 지점: `scripts/preflight.mjs`의 `build`·`start`는 `VERCEL_ENV === 'production'`일 때 운영 점검을, `dev`·`test`·`e2e`는 루프백 점검을 한다. `seed`는 **이미 루프백 판정이 있다** — `src/lib/seed.ts`의 `assertSeedAllowed`(SPEC-TOUR-001 REQ-TOUR-015, `scripts/seed.ts` 61행에서 `getPayload()`보다 먼저 호출)가 `localhost`·`127.0.0.1`·`::1`만 허용하고 기존 영문 문구(`Refusing to seed: database host "<호스트>" is not local …`)로 거부한다. 이 SPEC은 새 점검을 더하지 않고 이 판정을 그대로 쓰며, 다른 지점과 같은 호스트 목록을 쓰도록 공통 판정 함수(`isLoopbackHost`)로 묶는 것은 동작이 바뀌지 않을 때만 한다. `payload.config.ts`의 `push`도 루프백일 때만 켬(§B.3).
- 시험 환경 준비 파일(plan-audit 1회차 D10): 원격 DB 차단이 `package.json` 스크립트의 시작 전 점검에만 있으면, `pnpm exec vitest run`이나 편집기의 테스트 실행기, `pnpm exec playwright test`처럼 점검을 거치지 않는 실행이 `.env`의 DB에 그대로 닿는다(통합 시험에는 정리·삭제가 들어 있다). 그래서 `tests/integration/setup-env.ts`(Vitest 통합 프로젝트의 `setupFiles`)와 `tests/helpers/e2e-env.ts`(Playwright 설정과 E2E가 공유)가 모듈 최상위에서 `.env`를 읽은 바로 다음 같은 루프백 판정을 실행해, 원격이면 호스트 이름이 든 영문 문구로 바로 예외를 던진다. ESM에서는 정적 `import`가 모듈 본문보다 먼저 평가되므로 "다른 import보다 먼저"는 문자 그대로 지킬 수 없다 — 대신 확인 가능한 조건으로 둔다(plan-audit 2회차 N3): ① 두 파일은 Node 내장 모듈(`node:` 접두어, 지금도 그렇다)과 타입 제거로 불러올 수 있는 `src/lib/preflight.ts`만 import하고, DB에 연결하는 모듈(`payload`, `@payload-config`, `pg`, 시험 도우미)은 import하지 않는다 ② `setup-env.ts`는 Vitest 통합 프로젝트의 `setupFiles`(`vitest.config.mts` 33~35)라 시험 파일과 그것이 불러오는 모듈보다 먼저 평가된다 ③ `e2e-env.ts`는 Playwright 설정이 불러오므로(`playwright.config.ts` 5) 웹 서버·시험보다 먼저 판정된다. ①은 저장소 규칙 시험이 import 목록으로 확인한다(AC-DEPLOY-002).
- 형식 규칙: `NEXT_PUBLIC_SERVER_URL` — `https:` 주소, 경로 `/`만, 끝 빗금·질의·조각 없음. `CRON_SECRET` — `^[A-Za-z0-9]{16,}$`(Vercel 문서: 머리글에 쓸 수 있는 글자, 16자 이상 권장). `DATABASE_CA_CERT` — `-----BEGIN CERTIFICATE-----` 포함. `DATABASE_URL` — 운영에서 `sslmode`·`sslrootcert` 인자 금지(REQ-DEPLOY-001). S3 다섯 변수는 운영에서 모두 필수(운영 업로드가 로컬 디스크로 가면 함수 재시작 때 사라지므로). 원격 DB의 `DATABASE_CA_CERT` 필수 판정은 운영 빌드 점검과 별도로 풀 설정 함수에도 있다(§B.2 — 운영이 아닌 경로도 막음).

### B.9 Vercel 빌드 환경

- `vercel.json`(예시 — 정확한 키는 run 단계에서 공식 스키마로 확인):
  - `regions: ["icn1"]`, `crons: [{ path: "/api/cron/cleanup", schedule: "0 18 * * *" }]`, `buildCommand: "node scripts/vercel-build.mjs"`, Preview 배포 끄기(`git.deploymentEnabled`)
- pnpm: 잠금 파일이 `lockfileVersion: 9.0`이라 그대로 두면 Vercel이 pnpm 9나 10을 쓸 수 있는데, 이 저장소는 pnpm 11 설정(`pnpm-workspace.yaml`의 `allowBuilds`, `engineStrict`)을 쓴다. Corepack을 켜는 환경 변수를 사용자가 넣어 `packageManager`의 `pnpm@11.28.9`를 쓰게 하고, 빌드 로그의 pnpm 버전을 확인한다(§I.2).
- Node: `engines`가 `^22.23.4 || ^24.22.1 || >=26.0.0`. 프로젝트 설정의 Node 버전을 24.x로 두고 빌드 로그로 확인한다.
- 빌드 단계의 DB 접속: 시작 전 점검은 `build`·`start`에서 환경 변수만 확인하고 DB에 연결하지 않는다(`src/lib/preflight.ts` 139~140 — DB 연결 확인은 `dev`·`test`·`e2e`만). 빌드 머신에서 Supabase 풀러로 처음 연결하는 것은 `payload migrate`이며(풀러는 IPv4 지원), 인증서·연결 문자열 문제는 이 단계에서 드러나 배포가 실패한다.

### B.10 `pnpm audit` 처리

- 의존성을 더한 뒤 `pnpm audit --json`을 다시 실행해 권고마다 패키지·심각도·도달 경로를 §E.2에 적는다.
- 지금 권고의 판단: happy-dom 2건은 `@lexical/headless` 경유인데 이 프로젝트에 `richText` 필드가 없어 신청자·관리자 입력이 그 경로를 지나지 않음(실행 경로 미도달, 테스트 도구 경로는 개발용). esbuild는 `drizzle-kit`(개발·마이그레이션 생성 도구) 경유의 개발 서버 취약점, minimatch는 린트 도구 경유. 실행 중인 서버에서 도달하는 경로가 새로 확인되면 차단자로 보고한다(강제 상향은 Payload 판올림과 엮여 있어 이 SPEC 범위 밖).
- `@aws-sdk/*` 추가로 새 권고가 생기면 같은 방식으로 기록하고, high 이상이 실행 경로에 있으면 차단자로 보고한다.

### B.11 테스트 방법

| 대상 | 단위(Vitest) | 통합(Vitest, 실제 PostgreSQL) | E2E(Playwright, `next dev`) | 실제 배포(사용자 수동) |
|---|---|---|---|---|
| 운영 설정 점검·루프백 차단 | 변수 목록·형식, 호스트 판정 | `pnpm dev`/`test` 시작 거부(자식 프로세스, 원격 주소 예시 `db.example.invalid`), 점검을 거치지 않은 Vitest·E2E 환경 해석도 거부 | — | 첫 빌드 실패 확인(§I.2) |
| 마이그레이션 | 저장소 규칙(파일 존재·`index.ts`), 빌드 스크립트 명령 목록·운영 외 거부 | 빈 DB 적용 결과와 개발 스키마 비교(플러그인 열 포함), `migrate:check` 두 설정·새 파일 생기면 실패와 디렉터리 복원(새 파일 삭제·`index.ts` 원래 내용, `git status --short src/migrations` 빈 출력) | — | 빌드 로그의 migrate 단계 |
| DB 연결 설정 | 풀 크기(3~20)·SSL·인증서 없는 원격 거부 | 최소 풀 3에서 동시 신청 2건 완료 | — | 신청·상태 변경 성공 |
| 저장소 | 설정 판정(전부/일부/없음), 업로드 안내 문구 | 플러그인 적용 뒤 `media` 설정 값, 두 설정의 필드 목록 같음 | — | 업로드·익명 공개 범위 |
| 정리 | 기준 시각 계산, 비밀값 비교 | 경계 행 삭제·보존, 중복 실행 0행, 질의 수 고정 | 401·405·200, 응답 머리글 | Cron 수동 실행 200 |
| 동의 문구 | 버전 해시 일치, 문구 포함 | — | 신청 화면에 새 문구 | — |
| 로그 가림 | 직렬화 결과에 표식 없음 | 실제 DB 오류 로그에 표식 없음 | — | — |
| 검색 제외 | — | — | `robots.txt`, `X-Robots-Tag`, 메타 태그 | 보호 화면 확인 |

- 정리 통합 시험은 **실제 현재 시각**으로만 실행한다. 미래 시각을 넘기면 개발 DB의 실제 작업 기록·시도 기록을 지울 수 있다. 시험은 기준 시각 앞뒤로 표식 행(시도 기록은 `keyHash`에 표식, 작업 기록은 표식 회차 ID)을 만들어 그 행들만 단언하고 끝나면 지운다. 실행하면서 개발 DB의 이미 만료된 실제 시도 기록이 지워지는 것은 원래 지워질 행이라 허용한다. 개발 DB에 2년 지난 실제 작업 기록은 없다(2026-11-16 첫 기록).
- E2E 서버의 `CRON_SECRET`: Playwright 설정이 E2E 서버를 띄울 때 시험용 무작위 값을 환경 변수로 넘긴다(저장소에 고정 값을 두지 않음). Playwright 설정 파일은 작업자(worker) 프로세스마다 다시 읽히므로, 설정 파일 안에서 무작위 값을 그때그때 만들면 서버와 시험이 서로 다른 값을 갖게 된다. 그래서 값이 이미 `process.env.CRON_SECRET`에 없을 때만 한 번 만들어 러너 프로세스의 `process.env`에 넣고(작업자는 이를 물려받음), 서버 `env`와 시험이 같은 `process.env` 값을 읽게 한다.
- 질의 수: SPEC-ADMIN-001 AC-ADMIN-012 방식(`payload.db.pool.query`·`connect` 감시). 지울 표식 행 2개와 20개에서 같은 수.
- 원격 DB 차단 시험은 실제로 연결하지 않는 주소(`.invalid` 최상위 도메인)를 쓴다.

## §C. 사전 점검 (run 단계 시작 전, 순차)

```powershell
git branch --show-current          # main
git rev-parse --short HEAD         # 기준 HEAD 기록 (계획 시점 0057e9d)
git diff --stat 0057e9d -- src tests scripts pnpm-lock.yaml package.json   # 계획 뒤 범위 파일 변경 확인
git status --short                 # 미추적 파일이 §A.1 목록과 같은지
docker compose ps --format '{{.Service}} {{.Health}}'   # postgres healthy
pnpm install --frozen-lockfile
pnpm test                          # 기준선 통과 수 기록
pnpm e2e                           # 기준선 통과 수 기록
pnpm lint
pnpm format:check
pnpm typecheck
pnpm audit                         # 기준선(4건) 기록
```

- 기준선 결과(종료 코드와 통과 수)를 `progress.md` §E.2 첫머리에 적는다. 긴 출력은 `.moai/state/verify/<세션>/`에 파일로 남긴다.
- `.env` 내용은 출력하지 않는다. `.env`의 `DATABASE_URL`이 루프백인지는 호스트 이름만 확인한다.
- 사용자 전용 단계(§I)는 run 단계 M5 전에 끝나 있을 필요가 없다. M1~M4는 로컬에서만 진행한다. 특히 §I.2(Vercel에 저장소 연결)는 **M4까지의 커밋이 `main`에 올라간 뒤**에 시작한다 — 먼저 연결하면 Hybrid Trunk로 마일스톤마다 `main`에 푸시할 때마다 중간 상태(예: 정리 엔드포인트만 있고 운영 점검은 없는 상태)가 운영 배포로 만들어진다. §I.1(Supabase)은 언제 해도 된다.

## §D. 제약 (지킬 것)

- **Claude는 비밀값을 입력·출력·저장하지 않는다.** Supabase·Vercel 계정 작업과 환경 변수 입력은 사용자가 한다(§I). Claude가 `vercel` CLI로 환경 변수를 만들거나 로그인하지 않는다.
- **실제 관리자 계정을 건드리지 않는다.** 테스트는 개발 DB에서 `@example.test` 계정만 만들고 지운다. 운영 DB의 관리자는 사용자가 만든다.
- **테스트·개발 명령은 루프백 DB만 쓴다.** 원격 DB 차단 시험도 실제 원격에 연결하지 않는다.
- 정리 통합 시험은 실제 현재 시각으로만(§B.11).
- 새 의존성은 `@payloadcms/storage-s3` 3.93.0 하나(정확한 버전). 그 밖의 직접·간접 추가는 금지. `pnpm-workspace.yaml`의 `allowBuilds`·`overrides` 변경이 필요하면 차단자 보고.
- 유지: `occupancy.ts`·`session-availability.ts`·`catalog-order.ts`·`submit-application.ts`·`application-status.ts`·`clear-requests.ts`의 동작, `rate-limit.ts`의 동작(주석만 수정), `access.ts`의 `mediaReadAccess`, `(payload)/` 템플릿 파일, 공개 화면의 내용(로봇 메타 태그만 더함).
- 개발 DB에 `payload migrate`를 실행하지 않는다(push 모드 유지). 임시 확인 DB만 만들고 지운다.
- `.prettierignore`, `eslint.config.mjs` 검사 제외 목록, `.gitattributes`는 바꾸지 않는다. 생성 파일(마이그레이션, `payload-types.ts`, `importMap.js`)은 Payload 명령으로만 만든다.
- 검증 셸은 Windows PowerShell 5.1. 명령 인자 안에 큰따옴표를 겹쳐 쓰지 않는다.
- 커밋은 경로를 명시해 스테이징(`git add -A` 금지). `.env`, `media/`, 검증 로그, `.vercel/`은 커밋하지 않는다. Conventional Commits, 메시지에 `SPEC-DEPLOY-001`, 마지막 줄 `🗿 MoAI`, `--no-verify` 금지.
- **`main`에 푸시하면 1단계 이후로는 운영 배포가 일어난다**(Vercel 저장소 연결 뒤). M5 이후의 푸시는 사용자 확인을 거친다.

## §E. 자체 검증 순서

### E-1. 순차 실행 (상태를 쓰는 명령)

1. `docker compose up -d` → `postgres healthy`
2. `pnpm generate:types`, `pnpm generate:importmap` → 생성 파일 차이 확인(M1 이후에는 둘 다 차이 없음이 정상)
3. `pnpm typecheck`
4. `pnpm migrate:check`(이름은 run 단계에서 확정) → 새 파일 없음, 이어서 `git status --short src/migrations` → 출력 없음
5. `pnpm build` → 종료 코드 0(로컬 빌드는 운영 점검을 하지 않음)
6. `pnpm test`
7. `pnpm e2e`
8. 표식 데이터 잔여 확인(AC-DEPLOY-016 SQL), 임시 확인 DB 없음 확인

### E-2. 병렬 실행 (읽기 전용 — E-1이 끝난 뒤 한 턴에)

```powershell
pnpm lint
pnpm format:check
pnpm audit
git status --short
git diff --stat 0057e9d -- .prettierignore eslint.config.mjs .gitattributes src/lib/occupancy.ts src/lib/session-availability.ts src/lib/catalog-order.ts src/lib/submit-application.ts src/lib/application-status.ts src/lib/clear-requests.ts src/lib/access.ts
```

마지막 명령의 출력은 비어 있어야 한다(§D).

## §F. 마일스톤

각 마일스톤은 RED(실패하는 테스트) → GREEN(최소 구현) → REFACTOR 순서다. RED 단계의 실패 출력은 `progress.md` §E.2에 그대로 남긴다. 사용자 전용 단계가 필요한 M5는 오케스트레이터가 사용자에게 안내하고 결과를 받아 기록한다.

### M1 — DB 연결과 마이그레이션, 원격 DB 차단 (우선순위: High — 운영 스키마를 만드는 결정, 되돌리기 가장 어려움)

- 첫 작업(스키마에 영향을 주므로 첫 마이그레이션보다 먼저 — plan-audit 1회차 D1): `pnpm add -E @payloadcms/storage-s3@3.93.0`, 잠금 파일 차이와 `allowBuilds` 필요 여부 확인(§B.4), `pnpm audit` 재측정(§B.10). 저장소 설정 판정 함수와 `payload.config.ts` `plugins`의 `s3Storage({ enabled, alwaysInsertFields: true, … })` 등록까지 이 마일스톤에서 한다(켜진 경우의 동작 확인은 M3)
- RED: 단위 — `isLoopbackHost`(`localhost`·`127.0.0.1`·`::1`·`[::1]` 참, `db.example.invalid`·Supabase 형식 호스트 거짓), 풀 설정 함수(원격이면 `ssl.ca`·`rejectUnauthorized: true`·`max` 5 기본·3~20 범위, 원격 + 인증서 없음 → 오류, 루프백이면 지금 설정과 같고 `DATABASE_POOL_MAX`가 있으면 그 값), 저장소 설정 판정(다섯 개 모두 → 켜짐, 하나도 없음 → 꺼짐, 일부 → 오류 이름만), 빌드 스크립트 명령 목록(운영 → 점검·migrate·build, 그 밖 → 거부), 저장소 규칙(마이그레이션 디렉터리와 `index.ts` 존재, `s3Storage(` 무조건 등록·`alwaysInsertFields: true`, 두 시험 환경 파일의 루프백 판정 호출). 통합 — 원격 주소로 `dev`·`test`·`e2e`·`seed` 시작 거부(종료 코드≠0, 문구와 호스트만), 점검을 거치지 않은 Vitest 직접 실행과 `e2e-env.ts` 로딩도 거부, 빈 DB 마이그레이션 적용 결과 = 개발 스키마(플러그인 열 포함), `migrate:check`가 두 설정에서 새 파일 없음·새 파일이 생기면 지우고 `index.ts`를 되돌린 뒤 실패(실행 뒤 `git status --short src/migrations` 빈 출력), 최소 풀 3에서 동시 신청 2건 완료
- GREEN: `src/lib/db-connection.ts`(또는 `preflight.ts` 확장), `src/lib/storage.ts`(설정 판정), `payload.config.ts`의 `pool`·`push`·`plugins`, `scripts/preflight.mjs` 루프백 점검, `tests/integration/setup-env.ts`·`tests/helpers/e2e-env.ts` 루프백 판정, `seed`는 기존 `assertSeedAllowed` 유지, `scripts/vercel-build.mjs`(명령 목록 함수와 운영 외 거부), `scripts/migrate-check.mjs`(새 파일 삭제 + `index.ts` 복원), `pnpm generate:types`, `pnpm generate:importmap`(저장소 플러그인이 꺼진 상태에서도 `S3ClientUploadHandler`를 import map에 넣으므로 `src/app/(payload)/admin/importMap.js` 변경은 예상된 결과 — §A.2), `payload migrate:create initial`, `package.json` 스크립트(`migrate:check` 등)
- 기록: 마이그레이션 파일 이름, 비교한 스키마 항목 수, 플러그인 열의 실제 이름, 테이블·열 이름 확인(§B.5·§I.5에 쓸 이름 포함), 의존성 추가 뒤 `pnpm audit` 결과
- 검증: AC-DEPLOY-002, AC-DEPLOY-003, AC-DEPLOY-004(로컬 부분), AC-DEPLOY-006의 스키마 일관성 줄, AC-DEPLOY-016의 의존성·audit 부분
- 관련 REQ: 002, 003, 004, 006(등록·스키마 부분), 016(의존성 부분)

### M2 — 예약 정리와 동의 문구 (우선순위: High — 데이터를 지우는 동작과 법률 문구)

- RED: 단위 — 기준 시각 계산(10분 경계 `now − 600000`과 그 ±1ms, 2년 경계와 2월 29일), 비밀값 비교(같음/다름/길이 다름/빈 값/`CRON_SECRET` 없음·짧음), 동의 문구에 "72시간"·"원래 IP 주소는 저장하지 않음" 포함과 "다음 신청 처리 때" 없음, 버전 해시 일치. 통합 — 경계 표식 행 삭제·보존, 다른 컬렉션 불변, 두 번째 실행 0행, 질의 수 고정. E2E — 정리 엔드포인트 401(머리글 없음·틀림)·405(`POST`)·200(맞음, JSON 키 두 개, `Cache-Control: no-store`), 인증 없는 응답이 Payload 404가 아님
- GREEN: `src/lib/scheduled-cleanup.ts`, 비밀값 비교 함수, `src/app/api/cron/cleanup/route.ts`, `vercel.json`(Cron·리전), `consent.ts` 문구·버전, `rate-limit.ts` 주석, Playwright 설정의 시험용 `CRON_SECRET`
- 검증: AC-DEPLOY-007, AC-DEPLOY-008, AC-DEPLOY-009, AC-DEPLOY-010
- 관련 REQ: 007, 008, 009, 010

### M3 — 업로드 저장소 켜짐 동작과 업로드 안내 (우선순위: Medium — 의존성·등록은 M1에서 끝남)

- RED: 통합 — 다섯 변수를 가짜 값으로 준 설정에서 `media`의 `upload.disableLocalStorage === true`, 어댑터 처리기 존재, `disablePayloadAccessControl`이 참 아님, `signedDownloads`·`clientUploads` 꺼짐, 두 설정(있음·없음)의 `media` 필드 목록이 같음. 변수가 없으면 `staticDir`가 저장소 루트 `media/` 그대로이고 로컬 저장 유지. 단위·저장소 규칙 — `media` 관리자 안내 문구에 `4MB 이하`, 5MB 판정 불변
- GREEN: 플러그인 옵션 마무리(켜진 경우), `src/collections/Media.ts` 관리자 안내 문구(사용자 결정 D7/Q5 — §B.4 문구 초안)
- 검증: AC-DEPLOY-006(로컬 부분)
- 관련 REQ: 006

### M4 — 운영 설정 점검, 신뢰 경계, 로그 가림, 검색 제외 (우선순위: Medium)

- RED: 단위 — 운영 변수 점검(빠짐·형식 오류마다 이름만, 값 미포함, `sslmode` 거부), 로그 가림 직렬화와 메시지 문자열(`msg`) 가림. 통합 — 운영 점검이 `VERCEL_ENV=production`에서만 동작(자식 프로세스, 가짜 값), `serverURL`을 준 설정의 CSRF 허용 목록, 실제 DB 오류를 거친 Payload 로그에 표식 없음. E2E — `/robots.txt` 내용, 공개 화면·`/admin`·`/api/tours`·이미지 응답의 `X-Robots-Tag`, 공개 화면 로봇 메타 태그
- GREEN: `preflight.ts` 운영 점검, `scripts/preflight.mjs`, `scripts/vercel-build.mjs`(운영 점검 연결), `src/lib/log-redaction.ts` + `payload.config.ts` `logger`, `next.config.ts` `headers()`, `src/app/robots.ts`, `(frontend)/layout.tsx` 메타, `rate-limit.ts` IP 근거 주석
- 검증: AC-DEPLOY-001, AC-DEPLOY-005, AC-DEPLOY-011, AC-DEPLOY-012
- 관련 REQ: 001, 005, 011, 012

### M5 — 문서, 사용자 단계, 비공개 미리보기 확인 (우선순위: Medium — 사용자 전용 단계 포함)

- `.env.example`(새 변수 이름·용도, 값 없음), README "배포" 절(변수 이름, 빌드 명령, 마이그레이션 규칙, 사용자 안내는 이 `plan.md` §I를 가리킴), 비밀값 미포함 확인(AC-DEPLOY-015)
- M4까지의 커밋이 `main`에 올라간 것을 확인한 뒤, 오케스트레이터가 §I 안내를 사용자에게 단계별로 전달 → 사용자가 Supabase(Data API 끄기 포함)·Vercel 작업 수행 → M5 문서 커밋의 `main` 푸시(사용자 확인 뒤) → 사용자가 §I.4 확인 절차(0~9, Cron이 막히면 §I.5) 수행 → 결과를 `progress.md` §E.2에 기록
- 확인 실패 시: 트랜잭션 모드 문제면 세션 모드(포트 5432)로 바꿔 다시 확인(§B.2). Cron이 보호에 막히면 차단자 보고 없이 사용자 결정 D7/Q6대로 "막힘"으로 기록하고 사용자에게 §I.5 수동 정리를 안내하며, 자동 삭제 확인을 2단계 출시 조건으로 옮긴다(§G R1). Fluid compute 상태를 사용자에게 확인받아 연결 예산을 다시 적는다(§B.2)
- 검증: AC-DEPLOY-013, AC-DEPLOY-014, AC-DEPLOY-015
- 관련 REQ: 013, 014, 015

### M6 — 품질 게이트, MX, 이월 정리 (우선순위: Low)

- 전체 품질 게이트(`acceptance.md` §8), 커버리지 85% 이상, 표식 데이터 잔여 0, 임시 확인 DB 없음
- MX 태그: 정리 엔드포인트 `@MX:WARN`(데이터 삭제, 인증 필수), `runScheduledCleanup` `@MX:NOTE`(72시간 계산 근거·실제 시각만), 로그 가림 `@MX:NOTE`, 풀 설정 `@MX:NOTE`(최소 3 이유 — Payload 상시 점유 연결 1개, 인증서 없는 원격 거부), 루프백 점검 `@MX:ANCHOR` 검토(호출자 3곳 이상이면), `clientIpFromHeaders` `@MX:NOTE`(Vercel 덮어쓰기)
- 2단계로 넘길 항목(§A.3의 "2단계" 행, Cron 보호 통과 여부 결과, 72시간 문구 변호사 확인)을 §E.2에 적어 sync 단계가 옮기게 한다
- `progress.md` §E.2·§E.3 작성
- 검증: AC-DEPLOY-016
- 관련 REQ: 016

### 예상 생성·수정 파일

- 생성: `vercel.json`, `scripts/vercel-build.mjs`, `scripts/migrate-check.mjs`(이름은 예시), `src/app/api/cron/cleanup/route.ts`, `src/app/robots.ts`, `src/lib/{scheduled-cleanup,log-redaction,storage,db-connection}.ts`(이름은 예시, 합치거나 나눌 수 있음), `src/migrations/*`(생성 파일), `tests/unit/{deploy-config,scheduled-cleanup,log-redaction}.spec.ts`, `tests/integration/{scheduled-cleanup,migrations,log-redaction,storage-config}.spec.ts`, `tests/e2e/deploy.spec.ts`(예시)
- 수정: `src/payload.config.ts`, `src/lib/preflight.ts`, `scripts/preflight.mjs`, `src/collections/Media.ts`(업로드 안내 문구 — D7/Q5), `tests/integration/setup-env.ts`·`tests/helpers/e2e-env.ts`(루프백 판정), `src/lib/seed.ts`(공통 판정 함수로 묶을 때만, 동작·문구 불변), `src/lib/consent.ts`, `src/lib/rate-limit.ts`(주석만), `next.config.ts`, `src/app/(frontend)/layout.tsx`, `playwright.config.ts`(시험용 비밀값), `.env.example`, `README.md`, `package.json`, `pnpm-lock.yaml`, `tests/unit/consent.spec.ts`, `tests/unit/repo-rules.spec.ts`
- 생성 파일 갱신: `src/payload-types.ts`(`Media`에 플러그인 필드가 생김), `src/app/(payload)/admin/importMap.js`(M1에서 `pnpm generate:importmap`으로 재생성 — 저장소 플러그인이 `S3ClientUploadHandler` 항목을 언제나 더함, §A.2)

## §G. 위험과 대응

| ID | 위험 | 대응 |
|---|---|---|
| R1 | Vercel Cron 호출이 "All Deployments" 보호에 막혀 정리가 실행되지 않음(공식 문서에 동작이 적혀 있지 않음) | M5에서 Cron 수동 실행 응답과, **수동 실행 뒤에** 만든 확인용 신청의 시도 기록이 26시간 뒤 0행인지(§I.4 8번 — 그 사이 다른 신청·수동 실행·수동 정리 없음, AC-DEPLOY-014 (가))로 확인. **막히면 사용자가 이미 정한 대로(D7/Q6)**: 보호는 유지하고, 미리보기 동안은 사용자가 확인 신청을 한 날마다 §I.5의 수동 정리 SQL을 Supabase SQL 편집기에서 실행하며, 결과를 "막힘(Q6)"과 지운 행 수로 기록한다(AC-DEPLOY-014 (나)). 대시보드의 Cron "Run"도 같은 보호에 막힐 가능성이 크므로 수동 정리는 Vercel을 거치지 않는 SQL로 한다. 자동 삭제가 실제로 도는지("72시간" 고지 준수)는 2단계 출시 조건으로 넘긴다(2단계에서 보호를 풀거나 다른 방식을 정함) |
| R2 | 첫 배포가 보호를 켜기 전에 잠깐 공개됨 | 가져오기 때 환경 변수를 넣지 않아 첫 빌드가 시작 전 점검에서 실패하게 하고, 보호를 켠 뒤 변수를 넣는 순서(§I.2). 안내에 "변수 입력 화면은 건너뛰세요"를 굵게 적음 |
| R3 | 트랜잭션 풀러에서 명시적 트랜잭션·잠금 구간이 다르게 동작 | 근거상 호환(§B.2). AC-DEPLOY-014의 신청·상태 변경으로 실제 확인. 실패하면 세션 모드로 바꿔 재확인, 그래도 실패하면 차단자 |
| R4 | Cron이 연속 두 번 빠지면 72시간 고지를 넘음 | 잔여 위험으로 기록. 신청 때마다 지우는 기존 동작이 남은 행 대부분을 지움. 2단계 요금제 결정(Pro는 더 잦은 실행 가능) 때 문구를 다시 볼 수 있음 |
| R5 | 첫 마이그레이션이 개발 스키마와 다름(push와 생성 SQL의 차이) | 빈 DB 적용 결과를 개발 스키마와 항목별로 비교(AC-DEPLOY-003). 다르면 원인 기록 후 차단자 |
| R6 | 앞으로의 SPEC이 컬렉션을 바꾸고 마이그레이션을 빼먹어 운영 배포가 실패하거나 스키마가 어긋남. 또 마이그레이션 적용 뒤 `next build`가 실패하면 이전 배포가 새 스키마의 DB로 계속 돈다 | `migrate:check`(새 파일이 생기면 실패 — §B.3)를 품질 게이트에 넣음. 운영 빌드는 마이그레이션이 실패하면 배포를 거부. 이후 마이그레이션은 이전 코드와 함께 돌 수 있는 형태로(열 추가·널 허용 우선, 삭제·이름 바꾸기는 나눠서) — §B.3. `tech.md` 규칙 추가는 sync 단계 |
| R7 | 개발자가 원격 DB로 `pnpm dev`·`pnpm test`를 실행해 운영 데이터를 지우거나 push로 스키마를 바꿈 | REQ-DEPLOY-002 차단 + `push`는 루프백일 때만 |
| R8 | 정리 시험이 개발 DB의 실제 기록을 지움 | 실제 현재 시각만 사용, 표식 행만 단언(§B.11) |
| R9 | 연결 문자열에 `sslmode`가 들어가 코드의 인증서 설정이 무시되거나 검증 실패 | 운영 점검이 `sslmode`를 거부(§B.8). 안내에 "주소 끝에 `?sslmode=…`가 있으면 지우세요" |
| R10 | Vercel 환경 변수에 여러 줄 PEM이 한 줄로 들어감 | run 단계에서 실제 형태를 보고 `\n` 글자를 줄바꿈으로 바꾸는 처리 여부 결정(§B.2). 인증서 검증 실패는 빌드 단계 DB 접속 확인에서 바로 드러남 |
| R11 | Vercel이 pnpm 9/10이나 다른 Node 주 버전을 써서 설치·빌드 실패 | Corepack 환경 변수와 Node 24.x 설정(§B.9), 빌드 로그 확인 |
| R12 | 새 저장소 어댑터의 간접 의존성에 보안 권고·빌드 스크립트 | §B.10 재측정, `allowBuilds` 변경 필요 시 차단자 |
| R13 | 운영에서 4.4MB 넘는 업로드가 Vercel 413으로 끝나 관리자가 영문 오류를 봄 | REQ-TOUR-001이 허용하는 동작. 업로드 화면에 "실제 사이트에서는 4MB 이하" 안내(사용자 결정 D7/Q5, REQ-DEPLOY-006, §B.4) |
| R14 | 이미지가 함수를 거쳐 전송되어 Vercel 사용량이 늚 | 1단계 규모에서는 작음. 공개 출시 뒤 관측해 2단계 이후 판단(LANDING F1과 함께) |
| R15 | 배포마다 생기는 고유 주소로 관리자 화면을 쓰면 CSRF 출처가 달라 저장이 거부됨 | 안내에 "항상 `<프로젝트>.vercel.app` 주소로 접속"(§B.1) |
| R16 | Supabase 무료 프로젝트가 활동이 적어 일시 중지됨 | 가정 A4. 매일 정리 작업의 질의가 활동으로 잡히는지 공식 문서가 정하지 않음 → 중지되면 대시보드에서 재개. 2단계 요금제 결정 항목 |
| R17 | Hobby 약관(개인·비상업 용도) | 1단계는 비공개 확인용. 공개 출시 전 요금제 결정은 2단계 출시 조건(가정 A3) |
| R18 | 로그 가림이 Payload 로거 밖의 `console.error` 경로를 덮지 못함 | 범위의 한계로 기록(§B.6). Hobby 로그 보관 1시간 |
| R19 | `main`에 푸시할 때마다 운영 배포와 마이그레이션이 일어남 | §D 마지막 항목. M5 이후 푸시는 사용자 확인. 마이그레이션 실패 시 배포 거부 |
| R20 | Vercel Cron Jobs는 "Schedules"로 옮겨질 예정인 기존 기능 | 지금은 모든 요금제에서 지원. 이전은 범위 밖, 공지가 나오면 후속 SPEC |
| R21 | `@aws-sdk/client-s3` 최신판의 기본 체크섬 동작이 Supabase S3 호환 API와 맞지 않아 업로드가 실패할 수 있음(미확인) | 로컬에서 재현하지 않음. AC-DEPLOY-014 업로드에서 드러나면 원인 후보로 기록하고 차단자 보고(설정으로 끌 수 있는지는 그때 공식 문서로 확인) |
| R22 | Supabase Data API가 켜져 있으면 RLS 없는 `public` 테이블(신청자 정보)이 공개 키로 읽히고 쓰임 — Vercel 보호와 무관한 경로 | 사용자가 §I.1에서 Data API를 끔(REQ-DEPLOY-013), AC-DEPLOY-014에서 공개 키 요청이 거부되는지 확인 |
| R23 | 사용자가 M4 전에 Vercel을 저장소에 연결하면 마일스톤 푸시마다 중간 상태가 운영 배포됨 | §C에 "§I.2는 M4 푸시 뒤"를 적고 오케스트레이터가 그때 안내 |
| R24 | 시험을 `pnpm` 스크립트 없이 직접 실행해 원격 DB에 닿음 | 시험 환경 준비 파일 두 곳의 루프백 판정(§B.8, REQ-DEPLOY-002) |

안티 패턴(하지 말 것):

- 비밀값을 채팅·커밋·로그·테스트 고정 값에 넣기, Claude가 `vercel env add` 같은 명령으로 비밀값을 다루기
- 개발 DB에 `payload migrate` 실행, 운영 DB에 push
- 정리 시험에 미래 시각을 넘기기
- 연결 문자열에 `sslmode=require`를 넣고 인증서 검증을 끄기(`rejectUnauthorized: false`)
- 저장소 어댑터에 `disablePayloadAccessControl: true`나 공개 버킷을 써서 이미지 공개 범위 규칙을 없애기
- `CRON_SECRET`을 `vercel.json`이나 Cron 경로 질의 문자열에 넣기
- Preview 배포로 확인하고 "Cron 동작 확인"으로 기록하기(Preview에서는 Cron이 실행되지 않음)
- 실제 배포 확인을 하지 않고 통과로 기록하기

## §H. 상호 참조

- `spec.md` — REQ-DEPLOY-001~016, 용어(§2.5), 가정(§2.4), 제외 범위
- `acceptance.md` — AC-DEPLOY-001~016, 품질 게이트, 완료 정의
- `interview.md` — 사용자 결정 D1~D6과 확인 질문
- 앞선 SPEC: SPEC-INFRA-001(시작 전 점검 REQ-INFRA-008~010), SPEC-TOUR-001(REQ-TOUR-001 업로드, REQ-TOUR-005 익명 읽기), SPEC-APPLY-001(REQ-APPLY-013 횟수 제한, REQ-APPLY-014 동의 고지, "출시 전 보완"), SPEC-ADMIN-001(작업 기록, R20·R23·R30, 질의 수 측정 AC-ADMIN-012), SPEC-LANDING-001(REQ-LANDING-003 미디어 공개 범위, "배포 SPEC로 넘기는 출시 전 점검")
- `.moai/project/tech.md` §4·§5, `.moai/reports/legal/consent-review-2026-11-12.md`(미추적)
- 근거 소스: §A.2 표의 경로와 URL

## §I. 사용자 전용 단계 안내 (초보자용)

> 이 절은 사용자가 직접 하는 일입니다. **비밀번호·키·비밀값은 채팅창에 붙여 넣지 마세요.** Claude는 값이 아니라 "넣었다/안 넣었다"만 알면 됩니다. 값은 본인만 보는 곳(비밀번호 관리자 등)에 보관하세요.
> 화면의 메뉴 이름은 서비스가 바뀌면 조금 다를 수 있습니다. 다르면 비슷한 이름을 찾고, 막히면 화면 이름을 알려 주세요.

### I.1 Supabase (데이터베이스와 사진 저장소)

1. https://supabase.com 에 로그인 → **New project**.
2. 이름은 예: `sumbi-tour`. **Region은 Northeast Asia (Seoul)** 을 고릅니다.
3. **Database password**: "Generate a password"로 만들고 비밀번호 관리자에 저장합니다(다시 보기 어렵습니다).
4. 프로젝트가 만들어지면 위쪽 **Connect** 버튼 → **Transaction pooler** 항목의 연결 주소를 복사합니다.
   - 모양: `postgresql://postgres.<영문숫자>:[YOUR-PASSWORD]@<호스트>.pooler.supabase.com:6543/postgres`
   - `[YOUR-PASSWORD]` 자리에 3번 비밀번호를 넣은 전체 주소가 `DATABASE_URL` 값입니다. 끝에 `?sslmode=…`가 붙어 있으면 그 부분은 지웁니다.
5. **Project Settings → Database → SSL Configuration**
   - **Enforce SSL**(SSL 강제)을 켭니다.
   - **Download certificate**로 인증서 파일을 받습니다. 메모장으로 열면 `-----BEGIN CERTIFICATE-----`로 시작하는 글이 보입니다. 이 글 전체가 `DATABASE_CA_CERT` 값입니다(공개 인증서라 비밀은 아니지만 채팅에 붙일 필요는 없습니다).
6. 왼쪽 **Storage → New bucket**: 이름 `media`, **Public bucket은 끈 채로** 만듭니다.
7. **Storage → Settings(S3 Connection)**
   - 화면의 **Endpoint**(`https://<영문숫자>.storage.supabase.co/storage/v1/s3`)가 `S3_ENDPOINT`, **Region**이 `S3_REGION`, 버킷 이름 `media`가 `S3_BUCKET`입니다.
   - **New access key**로 키를 만듭니다. **Access key ID**가 `S3_ACCESS_KEY_ID`, **Secret access key**가 `S3_SECRET_ACCESS_KEY`입니다. 비밀 키는 이때 한 번만 보이니 바로 저장하세요. 이 키는 모든 버킷을 다룰 수 있는 강한 키라 Vercel 환경 변수 말고는 어디에도 두지 않습니다.
8. **Data API 끄기(중요)** — 왼쪽 **Integrations → Data API** 화면(주소 끝이 `integrations/data_api/overview`)에서 **Enable Data API**를 끄고 저장합니다.
   - 왜 끄나요: Supabase는 데이터베이스 표를 인터넷 주소(`https://<영문숫자>.supabase.co/rest/v1/…`)로 바로 읽고 쓸 수 있게 해 주는 기능(Data API)을 켜 둔 채 시작합니다. 숨비투어의 표(신청자 이름·이메일·연락처가 든 표 포함)는 이 기능을 막는 설정(RLS) 없이 만들어지기 때문에, 이 기능이 켜져 있으면 Vercel에서 사이트를 잠가 두어도 **Supabase 쪽 문으로 신청자 정보를 읽을 수 있는 길**이 생깁니다. 숨비투어는 이 기능을 쓰지 않으므로 꺼도 사이트는 똑같이 동작합니다.
   - 화면 이름이 다르면 **Project Settings → Data API**를 찾아 보세요. 끄는 칸을 못 찾으면 그 화면 이름을 알려 주세요.
   - 이 단계는 §I.2(사이트 올리기)보다 먼저 끝냅니다. 첫 배포가 표를 만들기 때문입니다.

### I.2 Vercel (사이트 올리기와 보호)

**이 단계는 Claude가 "M4까지 올렸으니 Vercel 연결을 시작하세요"라고 알려 드린 뒤에 시작합니다.** 그 전에 연결하면 작업 중간 상태가 사이트로 올라갑니다.

순서가 중요합니다. **환경 변수를 넣기 전에 보호를 먼저 켭니다.** 그래야 사이트가 한순간도 공개되지 않습니다.

1. https://vercel.com 에 로그인 → **Add New… → Project** → GitHub 저장소(숨비투어 저장소)를 **Import**. 처음이면 GitHub 연결 허용 창이 뜹니다.
2. **Project Name**을 정합니다. 사이트 주소는 `https://<이 이름>.vercel.app`이 됩니다. 이 주소를 메모하세요.
3. 가져오기 화면의 **Environment Variables 칸은 비워 둔 채 Deploy**를 누릅니다. **첫 배포는 실패하는 것이 정상입니다**(필요한 값이 없어서 일부러 멈추게 해 두었습니다).
4. 프로젝트 **Settings → Deployment Protection**
   - **Vercel Authentication**을 켜고, 보호 범위에서 **All Deployments**를 고른 뒤 **Save**.
5. **Settings → Environment Variables**에서 아래 값을 하나씩 넣습니다. 각 변수의 환경 체크는 **Production만** 켜고, 가능하면 **Sensitive**로 표시합니다.
   - `DATABASE_URL` — I.1의 4번
   - `DATABASE_CA_CERT` — I.1의 5번 인증서 글 전체
   - `DATABASE_POOL_MAX` — `5`
   - `PAYLOAD_SECRET` — 새로 만든 긴 무작위 문자열(로컬 `.env`와 **다른** 값). 비밀번호 관리자의 생성 기능으로 40자 이상 영문·숫자를 만드세요
   - `NEXT_PUBLIC_SERVER_URL` — `https://<2번 이름>.vercel.app` (끝에 `/` 없이)
   - `CRON_SECRET` — 새로 만든 무작위 영문·숫자 32자(특수문자·띄어쓰기 없이)
   - `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` — I.1의 6·7번
   - `ENABLE_EXPERIMENTAL_COREPACK` — `1` (이 저장소가 쓰는 pnpm 11을 쓰게 함 — 이름은 run 단계에서 공식 문서로 다시 확인해 알려 드립니다)
6. **Settings → Build and Deployment → Node.js Version**: **24.x**.
7. **Settings → Functions → Function Region**: **Seoul, South Korea (icn1)** 인지 확인합니다(저장소의 `vercel.json`이 이미 지정하므로 보통 맞게 나옵니다). 같은 화면에 **Fluid compute** 켜짐/꺼짐 표시가 있으면 어느 쪽인지 알려 주세요(연결 수 계산에 씁니다).
8. Claude가 이 SPEC의 코드를 `main`에 올리겠다고 확인을 구하면 승인합니다. 올라가면 자동으로 다시 배포됩니다. 이미 올라가 있다면 **Deployments → 가장 위 배포 → ⋯ → Redeploy**.
9. 빌드 로그(**Deployments → 해당 배포 → Building**)에서 다음을 봅니다: pnpm 버전 11.28.9, 마이그레이션 적용 줄, 마지막 "Ready". 화면을 캡처하거나 보이는 줄을 그대로 알려 주세요(비밀값은 로그에 나오지 않게 되어 있습니다).

### I.3 처음 들어가기

1. 로그인하지 않은 다른 브라우저(또는 시크릿 창)로 사이트 주소를 엽니다 → **Vercel 로그인 화면**이 나와야 정상입니다(내용이 보이면 바로 알려 주세요).
2. 평소 브라우저에서 Vercel에 로그인한 채 사이트 주소를 엽니다 → 홈 화면이 보입니다.
3. `https://<이름>.vercel.app/admin` → 첫 관리자 만들기 화면에서 **본인 이메일과 강한 비밀번호**로 관리자 계정을 만듭니다(Claude는 이 계정을 쓰지 않습니다).
4. 관리자 화면에 들어갈 때는 늘 `<이름>.vercel.app` 주소를 씁니다(배포마다 생기는 긴 주소로 들어가면 저장이 거부될 수 있습니다).

### I.4 확인 절차 (결과를 알려 주세요)

각 줄에 "됨/안 됨"과 보이는 문구를 알려 주시면 Claude가 기록합니다. 확인용 데이터는 이름 앞에 `test-`를 붙이고, 끝나면 관리자 화면에서 지웁니다.

0. 함수 리전 확인: **Deployments → 가장 위 배포 → Functions(또는 Resources)** 에 보이는 함수 리전이 `icn1`인지 봅니다. 찾기 어려우면 Vercel에 로그인한 브라우저의 개발자 도구(F12) → Network → `/api/tours` 요청 → 응답 머리글 `x-vercel-id` 값을 알려 주세요. 값은 `icn1::xxx1::요청번호` 모양이며, **맨 끝 요청번호 바로 앞 칸**이 `icn1`이어야 합니다(맨 앞 칸은 요청을 받은 가까운 곳이라 서울에서는 늘 `icn1`이 나와 판정에 쓰지 않습니다).
1. 관리자 화면에서 사진 2장을 올립니다: `test-공개.jpg`(4MB 이하), `test-숨김.jpg`. 업로드 화면에 "실제 사이트에서는 4MB 이하" 안내가 보이는지도 봅니다.
2. 투어 `test-확인투어`를 만들어 대표 이미지로 `test-공개.jpg`를 고르고 **공개**로 저장, 다가오는 회차 하나(정원 2) 추가.
3. 먼저 관리자 화면에서 `test-숨김.jpg`의 파일 주소를 복사해 둡니다(미디어 상세 화면). 그다음 **관리자 화면에서만 로그아웃**합니다(Vercel 로그인은 그대로 둡니다 — 그래야 "관리자가 아닌 방문자"로 사이트를 볼 수 있습니다). 이 상태에서 `/tours`에 투어와 사진이 보이는지, 복사해 둔 `test-숨김.jpg` 주소를 열면 사진 대신 오류가 나오는지 확인합니다.
   - 이어서 관리자로 다시 로그인해 **홈 화면 설정**의 대표 사진을 `test-숨김.jpg`로 저장 → 관리자 로그아웃 상태에서 홈에 그 사진이 보이고 복사해 둔 주소도 열리는지 확인 → 다시 관리자로 대표 사진을 비우고 저장 → 로그아웃 상태에서 그 주소가 다시 오류인지 확인합니다.
4. 그 투어 회차로 신청을 1건 합니다(이메일은 본인 이메일, 이름 `test-신청자`). 접수 완료 화면이 나오면 됨. (자동 정리 확인에 쓰는 신청은 이것이 아니라 7번 다음에 따로 합니다 — 8번)
5. 관리자 화면에서 그 신청을 **확정**으로 바꿉니다. 저장되면 됨.
6. 그 회차의 참가자 CSV 내려받기를 한 번 합니다. 파일이 받아지면 됨.
7. **Settings → Cron Jobs**(또는 **Schedules → Cron Jobs**)에서 `/api/cron/cleanup` 작업의 **Run**을 누르고, **View Logs**에서 응답 상태를 확인합니다(Hobby는 로그가 1시간만 남으니 바로 봐 주세요). 200이면 됨. 200이 아니면(예: 401·로그인 화면) "막힘"으로 알려 주시고 8번 대신 §I.5 수동 정리를 합니다.
8. 자동 정리 확인(7번이 200일 때만 — 200이 아니면 이 번호 전체를 건너뛰고 §I.5로 갑니다). 순서가 중요합니다(plan-audit 2회차 N1):
   - **8-가. 확인용 신청(증거)**: 7번의 200 응답을 **확인한 뒤에**, 같은 회차로 신청을 1건 더 합니다(이름 `test-정리확인`, 이메일은 4번과 다른 본인 이메일 주소). 접수 완료 화면이 나오면 **그 시각을 적어 둡니다**. 접수가 되지 않으면 화면 문구를 알려 주세요.
   - **8-나. 기다리기**: 8-가 뒤로 **26시간 이상**, 이 사이트에서 **다른 신청을 하지 않고, Cron Jobs의 Run을 다시 누르지 않고, §I.5 수동 정리 SQL도 실행하지 않습니다.** (신청이 들어오면 그때마다 오래된 기록이 지워지고, Run이나 수동 정리도 기록을 지우므로, 그중 하나라도 하면 새벽 자동 정리가 돌았는지 알 수 없게 됩니다.)
   - **8-다. 확인**: 8-가 시각에서 26시간 이상 지난 뒤, Supabase 왼쪽 **SQL Editor**에서 아래 한 줄을 실행하고 나온 숫자를 알려 주세요. `0`이면 새벽 자동 정리가 돈 것이고, `1` 이상이면 자동 정리가 막힌 것이라 §I.5 수동 정리를 합니다.
   ```sql
   select count(*) from application_attempts where attempted_at < now() - interval '26 hours';
   ```
   (왜 이 순서인가: 7번의 수동 Run도 10분 지난 기록을 지우므로, 4번 신청 기록으로 확인하면 Run이 그 기록을 지워 자동 정리가 한 번도 돌지 않아도 `0`이 나올 수 있습니다. 8-가 기록은 Run 뒤에 생겼고 그 뒤로 기록을 지우는 다른 일이 없으므로, 26시간 시점에 사라졌다면 새벽 자동 정리만이 지운 것입니다. 표·칸 이름은 Claude가 M2에서 실제 이름을 확인해 다르면 고쳐 드립니다. 이 명령은 숫자 하나만 보여 주고 아무것도 바꾸지 않습니다.)
9. Supabase Data API 차단 확인: Supabase **Project Settings → API Keys**에서 **공개 키**(publishable 또는 anon 키 — `secret`·`service_role` 키는 쓰지 않습니다)를 복사해, 본인 PC의 PowerShell에서 아래를 실행합니다. 결과가 오류(빨간 글씨, 상태 코드 4xx)면 됨이고, 표 내용(JSON)이 나오면 바로 알려 주세요. 키 값은 채팅에 붙이지 말고 상태 코드만 알려 주세요.
   ```powershell
   Invoke-WebRequest -Uri 'https://<영문숫자>.supabase.co/rest/v1/applications?select=id&limit=1' -Headers @{ apikey = '<공개 키>' }
   ```
10. 끝나면 `test-` 신청 → 회차 → 투어 → 사진 순으로 지웁니다(신청은 관리자 화면에서 지울 수 없게 되어 있으므로, 신청 1건은 확인 기록으로 남기거나 Claude에게 정리 방법을 물어보세요 — 2단계에서 운영 데이터 정리 방침과 함께 정합니다).

### I.5 수동 정리 (Cron이 Vercel 보호에 막혔을 때 — 사용자 결정 D7/Q6)

자동 정리가 막히면, 미리보기 기간 동안은 아래 SQL을 직접 실행해 같은 정리를 합니다. Vercel을 거치지 않으므로 보호와 상관없이 동작합니다.

- **언제**: 확인용 신청을 한 날마다 한 번(신청 뒤 10분 이상 지나서). 그러면 "만든 때부터 늦어도 72시간 안에 삭제" 안내가 지켜집니다.
- **어디서**: Supabase 왼쪽 **SQL Editor → New query**에 아래 SQL을 그대로 붙여 넣고 **Run**.
- **무엇이 보이나**: 결과 표 한 줄에 숫자 두 개 — `attempts_deleted`(지운 신청 시도 기록 수), `audit_logs_deleted`(지운 관리자 작업 기록 수) — 만 보입니다(비밀번호·키·신청자 정보는 나오지 않습니다). 두 숫자를 알려 주시면 Claude가 기록합니다. 두 삭제를 한 문장으로 묶은 이유: 여러 문장을 한 번에 실행하면 편집기에 마지막 문장의 결과만 보일 수 있어서, 한 문장이 두 행 수를 함께 돌려주게 했습니다(plan-audit 2회차 N4).

```sql
with a as (
  delete from application_attempts where attempted_at < now() - interval '10 minutes' returning 1
), l as (
  delete from admin_audit_logs where occurred_at < now() - interval '2 years' returning 1
)
select (select count(*) from a) as attempts_deleted,
       (select count(*) from l) as audit_logs_deleted;
```

- `a`는 10분 지난 신청 시도 기록(접속 IP를 비밀키로 변환한 값), `l`은 2년 지난 관리자 작업 기록을 지웁니다. 다른 표는 직접 지우지 않으며, 여러 번 실행해도 안전합니다(지울 것이 없으면 두 값 모두 0).
- 정리 엔드포인트와의 차이 하나: 2월 29일에 실행하면 PostgreSQL의 `now() - interval '2 years'`는 2년 전 2월 28일(월말에 맞춤)이 기준이고, 엔드포인트(`setUTCFullYear`, §B.5)는 3월 1일이 기준입니다. 그래서 그날에는 SQL이 엔드포인트보다 하루치 덜 지웁니다(기록을 남기는 쪽이라 안전한 방향). 그 밖의 날에는 같은 기준이고, 10분 기준은 양쪽이 같습니다.
- 표·칸 이름(`application_attempts.attempted_at`, `admin_audit_logs.occurred_at`)은 Payload 이름 규칙으로 예상한 것이며, run 단계 M2가 실제 이름을 확인합니다. M2는 README "배포" 절에 실제 이름으로 이 SQL을 적고, AC-DEPLOY-015의 저장소 규칙 시험이 README SQL의 표·칸 이름을 정리 구현(`src/lib/scheduled-cleanup.ts` — 예시 이름)의 `DELETE` 질의가 쓰는 이름과 비교합니다. 이름이 예상과 다르면 오케스트레이터가 이 절을 고치도록 다시 맡깁니다.
- Claude는 운영 DB에 직접 연결하지 않습니다. 이 SQL은 사용자가 실행합니다.
- 자동 정리가 실제로 도는지 확인하는 일은 2단계(정식 공개) 출시 조건입니다.
