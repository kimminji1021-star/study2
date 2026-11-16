# SPEC-ADMIN-001 구현 계획

> 요구사항은 `spec.md`, 수용 기준은 `acceptance.md`가 기준이다. 이 문서는 결정의 근거, 작업 순서, 위험을 다룬다.
> 개발 방식: TDD(`quality.yaml` `constitution.development_mode: tdd`). 검증 셸: Windows PowerShell 5.1(SPEC-INFRA-001·SPEC-TOUR-001·SPEC-APPLY-001과 같음).
> 마일스톤은 바뀔 가능성이 큰 결정(접근 규칙과 데이터 모델, 상태 변경의 잠금 규칙)을 앞에, 화면·정리 작업을 뒤에 놓았다.

## §A. 맥락

### A.1 현재 상태 (최초 계획 HEAD `8a4cdd1`, 2026-11-16 보강 시점 HEAD `a8cf60b`)

- `8a4cdd1` → `a8cf60b` 사이의 커밋은 `a8cf60b`(디자인 토큰 갱신과 화면 재적용) 하나다. 바뀐 파일은 `.moai/project/design/`, `.moai/project/product.md`(§7 진행 순서: 6 관리자 운영 → 9 랜딩 → 8 배포), `src/app/(frontend)/` 화면 파일, `src/components/{SessionList,TourCard}.tsx`뿐이다(`git show --stat a8cf60b`). 이 SPEC이 고치거나 보존해야 하는 파일(`src/collections/`, `src/lib/`, `tests/`, `pnpm-lock.yaml`, 설정 파일)은 바뀌지 않았다. 로드맵 번호(4 회원, 5 이메일, 6 관리자, 8 배포)도 그대로다. 아래 보존 검사와 품질 게이트의 기준 커밋은 `a8cf60b`로 둔다.
- `src/app/(frontend)/apply/complete/[ref]/page.tsx`는 `a8cf60b`에서 모양만 바뀌었고 상태 문구는 여전히 `<dd>`에 `APPLICATION_STATUS_LABELS[summary.status]`(51행)로 그린다(AC-ADMIN-003이 이 값을 본다).

- SPEC-INFRA-001·SPEC-TOUR-001·SPEC-APPLY-001 완료(`status: completed`). 등록 컬렉션은 `users`, `media`, `tours`, `tour-sessions`, `applications`, `application-attempts`.
- `src/collections/Applications.ts`: 접근 규칙 `read: adminOnly`, `create`·`update`·`delete: denyAll`(54~67행). 필드는 회차·이름·이메일·연락처·인원·요청 사항·상태(기본 `pending`)·접수 번호·`privacyConsentAt`·`privacyPolicyVersion`·`requestsConsentAt`·`ageConfirmedAt`·`cancelledAt`. 훅·엔드포인트 없음. `@MX:NOTE`가 "상태 변경·취소는 로드맵 6번 SPEC이 이 규칙을 다시 정한다"고 적어 둠(53~55행).
- `src/lib/occupancy.ts`: `OCCUPYING_STATUSES = ['pending', 'confirmed']`, 화면용 `getOccupiedSeatsBySession`(연결 풀, `GROUP BY` 1회)과 정원 확인 구간용 `getOccupiedSeatsInTransaction`(트랜잭션 연결). `@MX:ANCHOR`.
- `src/lib/submit-application.ts`: 사이트 접수의 정원 확인 구간. `set_config('lock_timeout', $1, true)` → `SELECT id FROM tour_sessions WHERE id = $1 FOR UPDATE` → 잠근 뒤 별도 문장으로 회차·투어·점유 인원 → 판단 → `payload.create` → 꽉 차면 회차 `closed` → 테스트 전용 `beforeCommit` → 커밋(71~104·117~212행). `DEFAULT_LOCK_TIMEOUT_MS = 5000`, `isLockTimeoutError`(55P03, `err.cause.code` 포함)를 내보냄.
- `src/lib/transaction-db.ts`: `poolDb(payload)`·`transactionDb(payload, transactionID)` — 원시 SQL 실행 지점. 트랜잭션이 끝났으면 예외.
- `src/lib/application-summary.ts`: 접수 완료 화면은 상태를 `대기 — 관리자 확인 후 확정`·`확정`·`취소`로 보여 준다(SPEC-APPLY-001 §B.8). 이 SPEC의 상태 변경이 그대로 반영된다.
- `src/lib/consent.ts`: 민감정보 안내 "적힌 경우 확인하는 즉시 삭제합니다"(40~41행)와 `@MX:NOTE`("관리자가 민감정보를 발견하면 지우는 절차가 출시 전에 있어야 한다").
- `src/app/(payload)/`: Payload 템플릿 생성 파일. 관리자 첫 화면은 Payload 기본 대시보드(모듈형 대시보드의 `CollectionCards`가 import map에 있음).
- 테스트: 기준 `pnpm test` 521건, `pnpm e2e` 41건(SPEC-APPLY-001 `progress.md` "출시 전 보완"). 정확한 기준선은 §C에서 다시 잰다. 이 SPEC 때문에 단언이 바뀌는 기존 테스트:
  - `tests/integration/users-auth.spec.ts` 38행 — 등록 컬렉션 목록(REQ-ADMIN-001)
  - `tests/integration/application-access.spec.ts` — 관리자 수정 거부 단언(118·151행 부근의 `payload.update`) → 관리자 단건 상태 수정 허용으로(REQ-ADMIN-002)
  - `tests/e2e/application-api.spec.ts` 115~123행 — 관리자 `PATCH`가 403이라는 단언 → 상태 수정은 200, 일괄 수정과 익명 수정은 403으로
- 정리 도우미: `tests/helpers/application-fixtures.ts` `cleanupMarkerData`(신청 → 회차 → 투어), `tests/helpers/e2e-catalog.ts` `cleanupCatalogFixture`(118행 부근 신청 삭제 → 회차 → 투어). 작업 기록은 회차 ID를 숫자로 담으므로 회차를 지우기 전에 그 회차들의 작업 기록을 지우는 단계를 넣는다.
- `tests/integration/application-concurrency.spec.ts` 99행이 로컬 API로 신청을 `cancelled`로 바꾼다. 이 SPEC 뒤에는 그 변경도 회차 행을 잠그고 작업 기록(관리자 ID 없음)을 남긴다. 정리 도우미가 그 기록도 지워야 한다.
- 작업 트리: `git status`에 `src/app/(payload)/admin/importMap.js`가 `M`으로 보이지만 `git diff`와 `git diff --ignore-cr-at-eol` 모두 비어 있다(파일 상태만 바뀐 것으로 보임, 내용 차이 없음). 이 SPEC의 M3에서 `pnpm generate:importmap`으로 다시 만든다.

### A.2 확인한 근거 (설치본·공식 문서)

새 npm 패키지를 추가하지 않는다. 확인 대상은 설치된 Payload 3.93.0(`node_modules/payload/package.json` 3행)과 `@payloadcms/next`·`@payloadcms/ui` 3.93.0이다. 경로는 저장소 루트 기준.

| 항목 | 확인 내용 | 근거 (파일:행) |
|---|---|---|
| 단건 수정의 트랜잭션 | `updateByIDOperation`은 시작할 때 `initTransaction(req)`로 트랜잭션을 만들고, 성공하면 끝에서 커밋, 예외면 `killTransaction`으로 되돌린다. 컬렉션 훅은 이 사이에서 같은 `req`를 받는다 | `node_modules/payload/dist/collections/operations/updateByID.js` 24(시작)·226(커밋)·240(되돌림) |
| `initTransaction` | `req.transactionID`가 있으면 새로 만들지 않고 `false`(커밋 책임 없음), 없으면 `beginTransaction()` 결과를 `req.transactionID`에 넣는다 | `node_modules/payload/dist/utilities/initTransaction.js` 11~23 |
| 수정 권한 검사 | `overrideAccess`가 아니면 컬렉션 `access.update`를 `{ id, data, req }`로 실행한다 | `updateByID.js` 95~99 |
| 일괄 수정의 권한 인자 | 일괄 수정(`updateOperation`)은 `access.update`를 `id` 없이 `{ data, req }`로 부른다 | `node_modules/payload/dist/collections/operations/update.js` 108~111 |
| 일괄 수정 막기 | `disableBulkEdit`가 켜진 컬렉션은 `overrideAccess`가 아닐 때 `APIError('Collection <slug> has disabled bulk edit', 403)`를 던진다(`beforeOperation` 훅, 74행보다 먼저). 타입 설명은 "in the admin panel and the API" | `update.js` 33~34, `node_modules/payload/dist/collections/config/types.d.ts` 494~498 |
| 원래 문서를 읽는 시점 (수정 공통 로직 순서) | 수정 공통 로직은 트랜잭션 안에서 먼저 `checkDocumentLockStatus`(48행)로 그 문서의 문서 잠금 행을 지우고(아래 "문서 잠금 행 삭제"), 이어서 훅보다 먼저 `originalDoc`을 읽는다(55행, 잠금 없는 일반 조회). 이후 필드 `beforeValidate`(109행) → 컬렉션 `beforeValidate`(137행) → 컬렉션 `beforeChange`(158~160행) → 필드 `beforeChange`(필드 검증 포함) → 저장 → 컬렉션 `afterChange`(391~393행) 순서. 따라서 `originalDoc`은 잠금 전 값이고, 문서 잠금 행 삭제는 이 SPEC 훅이 `lock_timeout`을 걸기(§B.2 2번) 전에 일어난다 | `node_modules/payload/dist/collections/operations/utilities/update.js` 48·55·109·137·158·391 |
| 문서 잠금 행 삭제 | `checkDocumentLockStatus`는 `overrideLock`과 관계없이 끝에서 `payload-locked-documents`의 그 문서 행을 `payload.db.deleteMany({ req, … })`로 지운다(PostgreSQL이면 `req`를 넘김 → 같은 트랜잭션). 모든 단건·일괄 수정(`update.js` 48행)과 삭제가 이 단계를 타고, 생성(`create`)은 타지 않는다. 그 행을 다른 트랜잭션이 이미 지우거나 고쳐 쥐고 있으면 그 트랜잭션이 끝날 때까지 기다린다. 컬렉션 훅보다 먼저라 이 SPEC의 5초 제한 밖이다 | `node_modules/payload/dist/utilities/checkDocumentLockStatus.js` 3·66~71, `update.js` 48, `node_modules/payload/dist/collections/operations/`(`checkDocumentLockStatus`를 부르는 작업은 `utilities/update.js`·`delete.js`·`deleteByID.js`뿐) |
| 회차 필드 필수 검증 | `applications`의 `session`은 `required: true`다. 회차 없는 신청을 수정하면 필드 `beforeValidate`가 `session`을 문서 값 `null`로 채우고(`typeof null !== 'undefined'`라 문서 값 사용), 필드 검증은 접근 거부 필드도 건너뛰지 않으며(이 컬렉션은 `trash`가 없어 제출 필드 한정 검증이 꺼짐), 기본 관계 검증이 `null` + `required`를 거부한다. 이 검증은 컬렉션 `beforeChange` **뒤** 필드 `beforeChange`에서 `ValidationError`로 나 전체가 되돌려진다. 따라서 회차 없는 신청이 있다면 그 수정은 어떤 것도 저장될 수 없다(§B.2 3번 결정의 근거). 단, 실제 DB의 `applications.session_id`는 `NOT NULL`(`information_schema.columns.is_nullable = 'NO'`)이고 외래 키는 `ON DELETE SET NULL`이라, 신청이 있는 회차를 지우면 삭제가 NOT NULL 위반(23502)으로 먼저 실패한다. 회차 없는 신청은 지금 스키마에서 커밋될 수 없으므로 이 근거와 §B.2 3번은 스키마가 바뀔 경우에 대비한 방어다(run 단계 확인, `progress.md` §E.2) | `src/collections/Applications.ts` 70~74, `node_modules/payload/dist/fields/hooks/beforeValidate/getFallbackValue.js` 6~7, `node_modules/payload/dist/fields/hooks/beforeChange/promise.js` 46~47·120~121, `update.js` 69, `node_modules/payload/dist/fields/validations.js` 569~573 |
| **빠진 필드는 잠금 전 문서 값으로 채워짐** | 필드 `beforeValidate`는 들어온 데이터에 없는 필드(`siblingData[field.name] === undefined`)를 `getFallbackValue`로 채운다. 수정 작업이면 `siblingDoc`(= `originalDoc`) 값을 복사한다. 따라서 컬렉션 `beforeChange`가 받는 `data`에는 요청에 없던 `status`·`requests`·`requestsDeletedAt`·`cancelledAt`도 잠금 전 값으로 **항상** 들어 있다. 상태 변경 요청 여부를 `data.status` 유무로 가릴 수 없고, 요청에 없던 잠긴 필드도 잠금 전 값으로 다시 저장된다(§B.2 결정의 근거) | `node_modules/payload/dist/fields/hooks/beforeValidate/promise.js` 179~191(먼저 채움)·238~246(접근 거부 뒤 다시 채움, 239행: 수정 작업이면 문서 값 허용), `node_modules/payload/dist/fields/hooks/beforeValidate/getFallbackValue.js` 3~18(6행: `siblingDoc` 값 복사) |
| 필드 단위 수정 거부 | 필드 `access.update`가 거짓이면 들어온 값을 지우고(`delete siblingData[field.name]`), 수정 작업에서는 저장된 문서 값으로 다시 채운다. 오류를 던지지 않는다. `overrideAccess`면 검사하지 않는다 | `node_modules/payload/dist/fields/hooks/beforeValidate/promise.js` 219~246(231행 삭제, 238~245행 다시 채움) |
| 원본 입력을 보는 훅 | 단건 수정은 컬렉션 `beforeOperation` 훅을 `args`(원본 `args.data`, `args.id`, `args.req`)와 `context: args.req.context`로 부른다. 이 호출은 접근 검사(95~99행)·`originalDoc` 읽기(`updateDocument`, 175행 → `update.js` 55행)·필드 처리보다 먼저다. `updateByID` 작업은 훅에 `operation: 'update'`로 전달된다. 이 저장소의 `src/collections/Media.ts` 26~40행이 같은 훅을 이미 쓴다 | `node_modules/payload/dist/collections/operations/updateByID.js` 59~66, `node_modules/payload/dist/collections/operations/utilities/buildBeforeOperation.js` 3~22, `node_modules/payload/dist/collections/operations/utilities/types.js`(`updateByID: 'update'`) |
| 같은 `req`의 `context` | 로컬 API에 기존 `req`와 `context`를 함께 넘기면 `req.context`는 `{ ...기존, ...새 값 }`으로 합쳐져 같은 `req`에 다시 들어간다. 훅은 모두 `req.context`를 받는다(`update.js` 57·112·141·162·395). 중첩 작업(같은 `req`의 다른 신청 수정, 작업 기록 생성)이 같은 객체를 공유하므로 값은 신청 ID를 키로 담는다(§B.2) | `node_modules/payload/dist/utilities/createLocalReq.js` 4~20·86 |
| 관리자 화면 저장 경로 | 문서 편집 폼은 기존 문서를 REST `PATCH`로 저장한다(상태 입력란을 포함한 폼 값 전송) | `node_modules/@payloadcms/ui/dist/views/Edit/index.js` 462 |
| REST 오류 응답 | 경로 오류 처리는 `err.status`를 응답 상태로 쓰고(37행) 본문은 `formatErrors`의 `errors[]`다. 500이 아닌 `APIError`는 공개 문구라 `errors[0].message`에 그대로 실린다 | `node_modules/payload/dist/utilities/routeError.js` 36~37·51~53, `node_modules/payload/dist/errors/APIError.js` 35~36 |
| Payload 자체 오류 기록 | 경로 오류 처리는 응답을 만들기 전에 `logError({ err, payload })`를 부른다(38~41행). 컬렉션·설정 `afterError` 훅(57~86행)은 그 **뒤**에 실행되므로 기록을 막지 못한다. `logError`는 `loggingLevels[err.name]`으로 수준을 고르고, `info`면 `err.message`를, 그 밖이면 `err` 객체 전체를 기록한다 | `node_modules/payload/dist/utilities/routeError.js` 38~41·57~86, `node_modules/payload/dist/utilities/logError.js` 1~15, `node_modules/payload/dist/config/types.d.ts` 1162 |
| DB 오류에 실리는 값 | `DrizzleQueryError`는 메시지를 `Failed query: <질의>\nparams: <바인딩 값>`으로 만들고 `params`·`cause` 속성도 둔다. `name`을 따로 정하지 않아 이름이 `Error`다 → `loggingLevels`로 이 오류만 골라 끌 수 없다(§B.8 D4 결정 근거) | `node_modules/.pnpm/drizzle-orm@0.45.2_@types+pg@8.20.0_pg@8.20.0/node_modules/drizzle-orm/errors.js` 10~19 |
| 관리자 화면의 읽기 전용 | 필드 권한에 해당 작업 권한이 없으면 `isReadOnly = true`로 그린다 | `node_modules/@payloadcms/ui/dist/forms/RenderFields/index.js` 53~68 |
| 첫 화면 끼워 넣기 | 기본 대시보드는 `admin.components.beforeDashboard`·`afterDashboard`를 서버 컴포넌트로 그리며 `payload`·`user`·`permissions` 등을 넘긴다. 그 사이에 모듈형 대시보드(실험 기능, `admin.dashboard`)가 들어간다 | `node_modules/@payloadcms/next/dist/views/Dashboard/Default/index.js` 17~49, `node_modules/payload/dist/config/types.d.ts` 697·713·777~780 |
| 상세 화면 끼워 넣기 | `type: 'ui'` 필드는 `admin.components.Field`로 사용자 지정 구성 요소를 그린다. 문서 편집 화면에는 `admin.components.edit.beforeDocumentControls`도 있다 | `node_modules/payload/dist/fields/config/types.d.ts` 686~721, `node_modules/payload/dist/collections/config/types.d.ts` 274 |
| 사용자 지정 엔드포인트 | 컬렉션 `endpoints`는 `{ path, method, handler(req) }`. `path`는 Express 형식(`/:id/…`)이고 `req.routeParams`로 값을 받는다. 사용자 지정 엔드포인트가 기본 엔드포인트보다 먼저 등록된다 | `node_modules/payload/dist/config/types.d.ts` 258~283, `node_modules/payload/dist/utilities/handleEndpoints.js` 162~185, `node_modules/payload/dist/collections/config/sanitize.js` 77~98 |
| 엔드포인트의 사용자 | 요청 객체를 만들 때 인증 전략을 실행해 `req.user`를 채운다. 엔드포인트에는 컬렉션 접근 규칙이 자동으로 걸리지 않고 트랜잭션도 없다 → 처리 함수가 관리자 확인과 트랜잭션을 직접 한다 | `node_modules/payload/dist/utilities/createPayloadRequest.js` 80~87, `handleEndpoints.js` 200~207 |
| 엔드포인트 응답 머리글 | 처리 함수가 돌려준 `Response`의 머리글을 그대로 합쳐 내보낸다(`Content-Disposition`·`Cache-Control` 유지) | `handleEndpoints.js` 200~207 |
| 쿠키 인증의 출처 검사 | `Origin`이 있으면 `csrf` 허용 목록과 비교하고, 없으면(목록이 있을 때) `Sec-Fetch-Site`가 `same-origin`·`same-site`·`none`일 때만 쿠키 토큰을 쓴다. 목록이 비어 있으면 검사하지 않는다 | `node_modules/payload/dist/auth/extractJWT.js` 11~38 |
| 트랜잭션 도우미 내보내기 | `payload` 패키지가 `initTransaction`·`commitTransaction`·`killTransaction`·`createLocalReq`·`APIError`·`Forbidden`을 내보낸다 | `node_modules/payload/dist/index.d.ts` 569·635·638·658·663 |
| 공개 오류 문구 | `APIError(message, status, data, isPublic)` — 500이 아닌 상태는 기본으로 공개 문구 | `node_modules/payload/dist/errors/APIError.js` 35~36 |
| 잠금·원시 SQL | `set_config('lock_timeout', $1, true)`, `FOR UPDATE` 뒤 별도 문장으로 읽기, drizzle 오류의 `cause.code`, 메시지에 바인딩 인자가 실리는 문제 | SPEC-APPLY-001 `plan.md` §A.2(실측 포함), `src/lib/submit-application.ts` 49~56·80~89 |
| 테이블·열 이름 | 필드 `partySize` → `party_size`, `session` 관계 → `session_id`처럼 Payload가 snake_case 열을 만든다. 같은 규칙이면 `admin-audit-logs` → `admin_audit_logs`, `sessionId` → `session_id` | SPEC-APPLY-001 `plan.md` §A.2, `src/lib/occupancy.ts` 16~28 |
| CSV 수식 주입 | `=`, `+`, `-`, `@`, 탭, CR로 시작하는 칸 앞에 작은따옴표를 붙이고, 칸을 큰따옴표로 감싸고 안의 큰따옴표를 두 번 쓴다 | OWASP "CSV Injection" (https://owasp.org/www-community/attacks/CSV_Injection) — run 단계 첫 작업에서 WebFetch로 현재 문구를 다시 확인해 `progress.md` §E.2에 남긴다 |

### A.3 Tier M 판단

- 예상 변경: 컬렉션 1개 추가(`AdminAuditLogs`) + `Applications`(접근 규칙·필드 권한·`beforeOperation`·`beforeChange`·`afterChange` 훅·UI 필드·엔드포인트·필드 1개)·`TourSessions`(엔드포인트 1개만) 수정, `payload.config.ts`, `src/lib/` 모듈 4~6개(신청 수정 잠금·상태 변경 규칙, 요청 사항 삭제, 참가자 CSV, 대시보드 데이터, 작업 기록, 문구) + `occupancy.ts` 확장, 관리자 구성 요소 2개(`src/components/admin/`), 테스트 9~11개 + 기존 테스트 3개·저장소 규칙 1개·정리 도우미 2개 수정, 생성 파일(`payload-types.ts`, `importMap.js`).
- 파일 수 재추정(2026-11-16, D1·D2 반영 뒤): 생성 약 21개(제품 9~10, 테스트 11~12 — 요청 사항 삭제 동시성 시험 파일 1개 추가 가능), 수정 약 12개(제품 4, 테스트·도우미 6, 생성 파일 2). 합계 약 33개로 Tier M 파일 지침(5~15개)을 넘는다. 넘는 부분의 대부분은 테스트 파일이다.
- 직접 작성 코드 추정: 제품 코드 약 800~1,000줄(D1·D2 반영으로 약 100줄 증가 — 모든 수정에 같은 잠금 구간 적용, 원본 입력 판별, 회차 없는 신청 처리), 테스트 약 1,100~1,400줄.
- M으로 두는 이유: 신청 운영이라는 한 도메인이고 프로젝트 원칙을 바꾸지 않는다. SPEC-APPLY-001이 같은 규모에서 M을 유지했다. 요구사항 16개·수용 기준 16개로 예산 안이다(D1·D2 수정은 기존 REQ·AC 안에서 처리해 개수가 늘지 않음). D1·D2 수정은 새 마일스톤이나 새 화면을 만들지 않고 M2·M3의 잠금 구간을 하나로 합치는 변경이라, 대시보드·CSV(M4·M5)를 떼어 낼 만큼 범위가 커지지 않았다. 판단: Tier M 유지, 분할하지 않음.
- 넘칠 경우: run 단계 중 제품 코드가 1,200줄을 넘거나 마일스톤이 7개를 넘으면 차단자 보고 후 분할을 검토한다(1순위: 대시보드와 CSV(M4·M5)를 별도 SPEC으로).
- 참고: 동시성과 개인정보가 걸린 SPEC이므로 더 엄격한 감사(Tier L 기준 0.85)를 원하면 Tier L로 올릴 수 있다. 그 경우 `design.md`·`research.md`가 추가되며, 이 문서 §A.2·§B가 그 내용의 대부분이다.

## §B. 결정과 근거

### B.1 편집 범위 — 컬렉션 수정은 관리자 단건, 필드는 `status`만

| 선택지 | 장점 | 단점 | 판단 |
|---|---|---|---|
| **컬렉션 `update`를 관리자·단건으로 열고 `status` 외 모든 필드에 `access.update: () => false`(채택)** | 관리자 화면이 자동으로 다른 필드를 읽기 전용으로 그리고(§A.2 RenderFields), REST·GraphQL·로컬 API가 같은 규칙을 탄다. Payload 기본 저장 흐름을 그대로 쓴다 | 거부된 필드 값이 오류 없이 버려진다(테스트는 값으로 판정해야 함, R4) | 채택 |
| 상태 변경 전용 엔드포인트 + 상세 화면 사용자 지정 버튼 | 판단 흐름이 한곳에 모임 | Payload 저장 버튼·상태 입력란을 다시 만들어야 하고, 컬렉션 수정 규칙은 여전히 거부라 화면이 "읽기 전용 + 별도 버튼"이 됨. 사용자 결정 D1("`status` 필드가 편집 가능")과 어긋남 | 기각 |
| 컬렉션 `beforeChange` 훅이 다른 필드 변경을 오류로 거부 | 거부가 눈에 보임 | 관리자 화면이 문서 전체를 보내므로 날짜·관계 값 비교가 까다롭고, 화면은 여전히 편집 가능하게 그려짐 | 기각 |

- 컬렉션 접근 규칙: `update: ({ req, id }) => isAdmin(req.user) && id !== undefined && id !== null`. 일괄 수정은 `id` 없이 불리므로(§A.2) 권한 함수로도 막히고, `disableBulkEdit: true`가 API·화면 모두에서 403으로 한 번 더 막는다. `create`·`delete`는 `denyAll` 그대로, `read`는 `adminOnly` 그대로.
- 필드 수정 거부 대상: `session`, `name`, `email`, `phone`, `partySize`, `requests`, `referenceCode`, `privacyConsentAt`, `privacyPolicyVersion`, `requestsConsentAt`, `ageConfirmedAt`, `cancelledAt`, 새 필드 `requestsDeletedAt`. 상수 하나(예: `lockedField`)로 묶어 붙이고, 저장소 규칙 테스트가 `Applications`의 이름 있는 필드 중 `access.update`가 없는 필드가 정확히 `status` 하나임을 단언한다(새 필드를 더하며 잠그는 것을 잊는 실수 방지).
- 서버 코드(훅·요청 사항 삭제·사이트 접수)는 `overrideAccess: true`로 저장하므로 필드 거부를 받지 않는다(§A.2 — `overrideAccess`면 검사 생략). `cancelledAt`은 훅이 데이터에 직접 넣는다(컬렉션 `beforeChange`는 필드 `beforeValidate`의 거부 처리 뒤에 실행된다, §A.2 순서).
- `access.create`는 필드에 두지 않는다(컬렉션 생성이 이미 모두 거부).

### B.2 모든 신청 수정 — 회차 행 → 신청 행 한 가지 순서로 잠근 뒤 판단

**배경(1회차 감사 D1·D2)**: Payload는 필드 `beforeValidate`에서 요청에 없던 필드를 잠금 전에 읽은 `originalDoc` 값으로 채운 뒤 컬렉션 `beforeChange`에 넘긴다(§A.2 "빠진 필드는 잠금 전 문서 값으로 채워짐"). 그래서 (1) `beforeChange`의 `data.status`는 모든 수정에 있어 "상태 변경 요청인지"를 가릴 수 없고, (2) 요청에 없던 `requests`·`requestsDeletedAt`·`cancelledAt`·`status`도 잠금 전 값으로 UPDATE에 실린다. 최초 계획의 "상태 값이 들어온 저장만 잠근다"와 "요청 사항 삭제는 신청 행만 잠근다"는 이 동작과 맞지 않았다. 요청 사항 삭제는 실제로 신청 → 회차 순서로 잠그는 교착 가능 경로였고(D1), 같은 상태 저장이 지운 요청 사항을 되살리는 창이 남았다(D2).

**결정**: 두 선택지(원본 입력으로 판별 / 잠금 순서를 하나로)를 **함께** 채택한다.

- **잠금 순서 하나**: `applications`의 **모든** 수정(작업 `update`)은 상태 변경 요청 여부와 관계없이 같은 보호 구간을 거친다. 회차 행 → 신청 행 순서로 잠그고, 잠근 뒤 읽은 값으로 판단·저장한다. 요청 사항 삭제도 이 구간을 지나며, 삭제 함수가 신청 행을 먼저 잠그던 단계는 없앤다(§B.4).
- **원본 입력으로 판별**: 상태 변경 요청인지는 컬렉션 `beforeOperation` 훅이 필드 처리 전의 원본 `args.data`에 `status` 키가 있는지로 정한다(§A.2 "원본 입력을 보는 훅" — 접근 검사·`originalDoc` 읽기·필드 채움보다 먼저 실행). `beforeChange`의 `data.status`는 판별에 쓰지 않는다.

`req.context`에 담는 값은 모두 **신청 ID를 키로** 둔다(예: `req.context.adminOps.applications[<신청 ID>]`). 같은 `req`를 쓰는 중첩 작업(같은 `req`의 다른 신청 수정, 작업 기록 생성)과 값이 섞이지 않게 하기 위해서다(§A.2 "같은 `req`의 `context`", D11). 핵심 로직은 `src/lib/`의 함수(예: `application-status.ts`)에 두고 훅은 호출만 한다.

**`beforeOperation` 훅** (작업 `update`이고 `args.id`가 있을 때 — 일괄 수정은 §B.1에서 이미 403):

0. 원본 `args.data`가 객체이고 자기 키로 `status`를 가지면 `req.context`의 그 신청 ID 항목에 `statusRequested: true`를 적고, 없으면 `false`를 적는다. `args`는 바꾸지 않고 그대로 돌려준다.

**`beforeChange` 훅** (작업 `update`, 모든 수정):

1. `req.transactionID`로 트랜잭션 연결을 얻는다(`transactionDb`). 없으면 내부 오류(안전 쪽 실패 — 단건 수정은 항상 트랜잭션을 만든다, §A.2 `updateByID.js` 24행).
2. `SELECT set_config('lock_timeout', '5000', true)`(SPEC-APPLY-001과 같은 상수 `DEFAULT_LOCK_TIMEOUT_MS`).
3. `SELECT session_id FROM applications WHERE id = $1`로 회차 ID를 얻는다(회차 ID는 잠긴 필드라 API로는 바뀌지 않는다). **회차 없는 신청**이면(`session_id`가 `NULL`) 어떤 잠금도 걸지 않고 바로 `APIError('SESSION_MISSING: …', 409, undefined, true)`를 던진다 — 상태 변경 요청, 같은 상태 저장, 상태 없는 수정, 요청 사항 삭제 모두 같다(2회차 감사 N2 결정 (a)). 이 분기는 방어 처리다: 실제 DB의 `session_id`는 `NOT NULL`이라 지금 스키마에서는 도달하지 않으며(§A.2 "회차 필드 필수 검증"의 단서), 시험은 되돌리는 트랜잭션 안에서 `NOT NULL`을 잠시 풀어 재현한다(AC-ADMIN-005). 그런 수정은 어차피 필드 `beforeChange`의 `session` 필수 검증에서 `ValidationError`로 실패하므로 허용할 길이 없고, 이 훅이 먼저 고정 코드로 끝내 관리자에게 원인을 알린다. 트랜잭션이 되돌려지므로 아무것도 저장되지 않고 작업 기록도 생기지 않는다. 회차 ID가 있으면 `SELECT id, capacity, status FROM tour_sessions WHERE id = $2 FOR UPDATE`. 이 `FOR UPDATE`가 0행을 돌려주면(회차 행이 사라짐) 신청 행을 잠그지 않고 같은 `SESSION_MISSING`(409)으로 끝낸다(O3 — 4번 재조회와 같은 결론).
4. `SELECT id FROM applications WHERE id = $1 FOR UPDATE`로 신청 행을 잠그고, **잠금 뒤의 별도 문장**으로 `session_id, status, party_size, requests, requests_deleted_at, cancelled_at`을 읽는다. 여기서 읽은 값이 "현재 값"이고 그 상태가 "이전 상태"다. 읽은 `session_id`가 3번 값과 다르면(3번과 4번 사이에 회차 값이 바뀐 경우 — 회차 관계가 비울 수 있는 스키마에서의 F1 경합 등. 지금 스키마에서는 회차 삭제가 23502로 실패하므로 생기지 않는다) 3번의 회차 없는 신청 규칙대로 `SESSION_MISSING`(409)으로 끝낸다(N4 — 그 밖의 값으로 바뀌는 경로는 없지만, 생기면 같은 오류로 끝내 이미 잠근 회차가 아닌 회차로 판단하지 않는다). `originalDoc`은 판단에도 저장에도 쓰지 않는다.
5. **잠긴 필드 덮어쓰기 — 모든 분기에서, 아래 어떤 분기보다 먼저**: `data.requests`, `data.requestsDeletedAt`, `data.cancelledAt`을 4번의 현재 값으로 바꾼다. 0번 표시가 `statusRequested: false`(또는 표시 없음)이면 `data.status`도 4번의 현재 상태로 바꾼다. 같은 상태 저장, 상태 없는 수정(`{"name": …}` 같은 REST 수정), 상태 변경 모두 이 단계를 지난다. 그래서 삭제 전에 읽힌 문서로 진행된 저장도 지운 요청 사항과 비워진 `requestsDeletedAt`, 다른 탭이 바꾼 상태를 되돌리지 못한다(D2, R1, R15). 나머지 잠긴 필드(이름·연락처 등)는 어떤 경로로도 생성 뒤 바뀌지 않으므로 잠금 전 값과 같다.
6. **요청 사항 삭제 표시**가 그 신청 ID 항목에 있으면(§B.4가 같은 `req`로 남김): 4번의 요청 사항이 비어 있으면(`null` 또는 빈 문자열) `APIError('REQUESTS_EMPTY: …', 409, undefined, true)`. 아니면 `data.requests = null`, `data.requestsDeletedAt = <표시의 처리 시각>`. 표시는 읽은 뒤 그 신청 ID 항목에서 지운다(N6 — 같은 `req`로 같은 신청을 다시 수정해도 삭제가 다시 적용되지 않게). 상태는 5번 그대로 두고 여기서 끝낸다(상태 변경 기록 없음).
7. `statusRequested`가 거짓이면 끝(기록 없음).
8. 요청한 상태(`data.status`)가 이전 상태와 같으면 끝(기록 없음, `cancelledAt`은 5번의 현재 값 그대로 — REQ-ADMIN-004).
9. 취소 복원이면(회차 없는 신청은 3번에서 이미 끝났다): `getOccupiedSeatsInTransaction`(취소 신청은 세지 않으므로 이 신청은 빠져 있다) + 인원 > 정원이면 `APIError('RESTORE_CAPACITY_EXCEEDED: …', 409, undefined, true)`. = 정원이고 회차가 `open`이면 **트랜잭션 연결(`transactionDb`)의 원시 SQL** `UPDATE tour_sessions SET status = 'closed', updated_at = now() WHERE id = $1`로 회차를 마감한다(상태 값은 바인딩 인자가 아니라 SQL 안의 고정 문자열로 둔다). 이미 `closed`면 그대로. 중첩 `payload.update({ collection: 'tour-sessions', … })`를 쓰지 않는 이유(2회차 감사 N1 결정 (a)): 그 호출도 `updateByID` → `checkDocumentLockStatus`로 `(tour-sessions, 회차 ID)` 문서 잠금 행을 같은 트랜잭션에서 지우는데(§A.2 "문서 잠금 행 삭제"), 이 시점에는 회차·신청 행을 이미 쥐고 있으므로, 관리자 화면에서 같은 회차를 저장하는 요청(문서 잠금 행을 먼저 지운 뒤 회차 행을 기다림)과 반대 순서가 되어 교착할 수 있다. 원시 SQL은 이미 쥔 회차 행만 고치고 문서 잠금 테이블을 건드리지 않는다. `TourSessions.ts`에는 변경 훅이 없어(`beforeDelete`만, 44~58행) 건너뛰는 훅도 없다.
10. `cancelledAt` 처리(§B.3).
11. 이전·이후 상태를 그 신청 ID 항목에 담고, 컬렉션 `afterChange` 훅이 같은 `req`로 작업 기록을 만든 뒤 항목을 지운다(§B.7). 기록이 실패하면 예외가 `updateByID`의 `catch`로 가서 저장·회차 마감이 함께 되돌려진다(§A.2 240행 — 원시 SQL 마감도 같은 트랜잭션이라 함께 되돌려짐). 작업 기록 생성(`create`)은 문서 잠금 행을 건드리지 않는다(§A.2).
12. 오류 변환: 잠금 대기 초과(`isLockTimeoutError`, 55P03)는 `APIError('SESSION_BUSY: …', 409, undefined, true)`. 교착 감지(40P01)는 이 SPEC의 경로끼리는 생기지 않아야 하지만(아래 잠금 순서), 생기면 같은 `SESSION_BUSY`로 바꾼다(트랜잭션은 이미 되돌려졌고 다시 시도해도 안전하다. 변환 사실은 코드·오류 종류 이름·ID만 로그에 남긴다). 그 밖의 원시 오류는 원인(`cause`)·원문 `message`를 붙이지 않은 고정 문구 오류로 바꾼다(바인딩 인자에 개인정보가 실릴 수 있음, REQ-ADMIN-015).

| 선택지 | 판단 |
|---|---|
| **모든 수정을 회차 → 신청 순서로 잠근 뒤 판단, 상태 변경 요청은 `beforeOperation`의 원본 입력으로 판별(채택)** | 잠금 순서가 하나라 `applications` 행과 `tour_sessions` 행 사이에 순환 대기가 없다(문서 잠금 테이블이 끼는 경우의 범위는 아래 잠금 순서 항목과 R26). 잠긴 필드를 모든 분기에서 잠금 뒤 값으로 저장해 되살림 창이 없다. 상태 없는 수정도 상태를 되돌리지 못한다. 대가: 상태와 무관한 수정도 회차 행을 잠근다(관리자 1명, 수정이 드묾 — 사이트 접수 대기 영향은 무시할 수준) |
| `beforeChange`의 `data.status` 유무로 판별(최초 계획) | 모든 수정에 `status`가 있어 판별이 무의미하다(§A.2). 기각 |
| 원본 입력 판별만 하고 요청 사항 삭제는 신청 행만 잠금 | 교착은 피하지만 상태 없는 수정(`{"name": …}`)이 잠금 없이 잠금 전 요청 사항·상태를 다시 저장하는 창이 남는다. 기각 |
| 잠금 없이 `originalDoc`·합계로 판단 | 사이트 접수가 커밋 직전일 때 둘 다 통과해 정원을 넘는다(Read Committed). 기각 |
| 권고 잠금(`pg_advisory_xact_lock`) | 사이트 접수의 행 잠금과 직렬화되지 않는다. 기각 |

- 잠금 순서는 **회차 행 → 신청 행**으로 고정한다. 경로별 실제 순서: 상태 변경 요청·요청 사항 삭제·그 밖의 신청 수정은 (Payload의 그 신청 문서 잠금 행 삭제) → 회차 → 신청(회차 없는 신청은 잠그기 전에 3번에서 거부), 사이트 접수는 회차만 잠그고 새 신청 행을 넣는다(기존 신청 행을 잠그지 않음). 어느 경로도 신청 행을 쥔 채 회차 행을 기다리지 않으므로 `applications` 행과 `tour_sessions` 행 사이에는 순환 대기가 없다(R3).
- 문서 잠금 테이블(`payload-locked-documents`)과의 관계 — 성립하는 범위만 적는다: (1) 이 SPEC의 경로는 회차·신청 행 잠금을 쥔 **뒤**에는 문서 잠금 행을 건드리지 않는다. 복원 마감은 원시 SQL(9번), 작업 기록은 `create`(문서 잠금 행 삭제 없음, §A.2)이기 때문이다. 따라서 행 잠금을 쥔 이 SPEC의 트랜잭션이 문서 잠금 행을 기다리는 일은 없다. (2) 반대로 모든 신청 수정은 시작할 때(`update.js` 48행, 행 잠금을 쥐기 전, 2번의 `lock_timeout` 설정 전) 그 신청의 문서 잠금 행을 지우며, 그 행을 다른 트랜잭션이 쥐고 있으면 5초 제한 없이 기다린다. 이때 이 트랜잭션은 아무 행 잠금도 쥐고 있지 않으므로 그 대기는 순환을 만들지 않고 상대가 끝날 때까지 늦어질 뿐이다(잔여 위험 R26). (3) 사이트 접수의 자동 마감(SPEC-APPLY-001, 범위 밖)은 회차 행을 쥔 채 중첩 `payload.update(tour-sessions)`로 문서 잠금 행을 지우므로 관리자 화면의 회차 저장과 교착할 수 있다(R26, 기록만).
- 상태 변경 요청은 값이 같아 보여도 항상 잠근다. 관리자 화면은 상태를 포함한 폼 값을 보내므로(§A.2 "관리자 화면 저장 경로"), 잠금 없이 "같은 값"을 저장하면 다른 탭이 방금 바꾼 상태를 오래된 값으로 덮어써 정원 확인 없는 복원이 된다(R1).
- 복원으로 정원이 꽉 찰 때 회차를 마감하는 것은 사이트 접수의 자동 마감(`product.md` §4.2 "정원이 차면 자동 마감")과 같은 규칙이며, 사용자가 2026-11-16에 확인했다(`interview.md` "추가 확인").
- 테스트 경로: 통합 테스트는 `payload.update({ collection: 'applications', id, data: { status }, user: <테스트 관리자>, overrideAccess: false })`로 관리자와 같은 경로를 탄다. 사이트 접수와의 동시성 테스트는 사이트 접수의 기존 주입 지점(`beforeCommit`)으로 회차 행 잠금을 쥔 채 멈추게 하고, 그동안 상태 변경이 잠금을 기다리는 것을 `pg_stat_activity`로 확인한다. 요청 사항 삭제와의 동시성 테스트는 (a) 테스트가 별도 트랜잭션으로 회차 행을 쥔 채 두 작업을 차례로 대기시키는 방법과 (b) 요청 사항 삭제 함수의 테스트 전용 주입 지점(§B.4)을 쓴다. 상태 변경 훅 자체에는 테스트 전용 주입 지점을 두지 않는다.

### B.3 `cancelledAt` — 보관 기준일

| 변경 | `cancelledAt` |
|---|---|
| 대기·확정 → 취소 | 처리 시각(서버 현재 시각) |
| 취소 → 대기·확정 | 비움(`null`) |
| 대기 ↔ 확정 | 그대로 |
| 같은 값 저장 | 그대로 |

- 근거: 보관 기준일은 "취소일이 있으면 취소일, 없으면 회차 종료 일시"(SPEC-APPLY-001 가정 A6). 되돌린 신청은 다시 유효한 거래이므로 기준일이 회차 종료 일시로 돌아가야 한다. 회차 종료 일시는 보통 취소일보다 뒤라 보관이 더 길어지는 쪽(안전한 쪽)이다. 취소했던 이력은 작업 기록이 남긴다(가정 A3).
- 다시 취소하면 그때의 시각으로 덮어쓴다. 최근 취소가 실제 거래 종료 시점이기 때문이다.

### B.4 요청 사항 삭제 — 관리자 전용 엔드포인트

- 주소: `POST /api/applications/:id/clear-requests`(컬렉션 엔드포인트, 경로에 개인정보 없음). 핵심 로직은 `src/lib/`의 함수(예: `clearApplicationRequests(payload, { applicationId, user, now })`)에 두고, 엔드포인트는 `req.routeParams.id` 해석·결과를 HTTP 응답으로 바꾸는 일만 한다.
- 순서: 관리자 아님 → `FORBIDDEN`(403) / ID가 1~2147483647 정수가 아님 → `NOT_FOUND`(404) / 트랜잭션 시작(`initTransaction`) → 잠금 없는 존재 확인 `SELECT id FROM applications WHERE id = $1`(없으면 `NOT_FOUND`) → 같은 `req`의 `req.context`에 그 신청 ID를 키로 **요청 사항 삭제 표시**(처리 시각 `now`)를 남김 → `payload.update({ collection: 'applications', id, data: { requests: null, requestsDeletedAt: now }, req, overrideAccess: true })` — 잠금(회차 → 신청)과 "비어 있는지" 판단은 §B.2 6번이 잠근 뒤 값으로 한다 → 작업 기록 생성(같은 `req`) → 테스트 전용 주입 지점 `beforeCommit`(아래) → 커밋. 예외면 되돌린다.
- 오류 변환: §B.2가 던진 `REQUESTS_EMPTY` → 409 `{"code":"REQUESTS_EMPTY"}`, `SESSION_BUSY`(잠금 대기 초과·교착) → 409 `{"code":"SESSION_BUSY"}`, `SESSION_MISSING`(회차 없는 신청, §B.2 3·4번) → 409 `{"code":"SESSION_MISSING"}`, 그 밖 → 500 `{"code":"INTERNAL_ERROR"}`. 회차 없는 신청의 요청 사항은 이 SPEC에서 지울 수 없으며(`session` 필수 검증 때문에 어떤 저장도 불가, §A.2), 그 민감정보 삭제는 F1 해결 때 다룬다(`spec.md` §5, `progress.md` 이월 항목). 어느 경우든 트랜잭션을 되돌리므로 아무것도 바뀌지 않는다(REQ-ADMIN-008).
- 응답 본문은 `{ "status": "cleared", "requestsDeletedAt": "<ISO>" }` 또는 `{ "code": "<오류 코드>" }`. 요청 사항 글을 응답·로그에 담지 않는다.
- `requestsConsentAt`은 남긴다(동의 사실의 기록). 상태와 다른 필드도 그대로(§B.2 5·6번).
- 잠금 순서(1회차 감사 D1 정정): 최초 계획은 "이 저장에는 `status`가 없어 훅이 회차를 잠그지 않는다"고 적었으나 틀렸다(§A.2 — Payload가 `status`를 채워 넣는다). 이제 삭제 함수는 신청 행을 먼저 잠그지 않고, 잠금은 모두 §B.2의 회차 → 신청 순서로만 일어난다. 그래서 상태 변경과 같은 신청에 동시에 와도 순환 대기가 없고(R3), 회차 잠금 대기 초과는 `SESSION_BUSY`로 끝날 수 있다(REQ-ADMIN-008에 반영).
- 테스트 전용 주입 지점: 처리 함수는 선택 인자 `beforeCommit`(테스트만 넘김, SPEC-APPLY-001 `submit-application.ts`와 같은 방식)를 받아 삭제·작업 기록 뒤, 커밋 직전에 기다린다. 이때 회차 행·신청 행 잠금을 쥐고 있으므로, 삭제 전에 읽힌 문서로 진행되는 다른 저장을 결정적으로 겹치게 할 수 있다(AC-ADMIN-008 되살림 사례). 엔드포인트는 이 인자를 넘기지 않는다.
- 화면: `type: 'ui'` 필드(요청 사항 바로 아래)의 클라이언트 구성 요소가 요청 사항이 비어 있지 않을 때만 "요청 사항 삭제" 버튼을 그리고, 확인 단계(확인 대화 상자 — Payload `ConfirmationModal` 또는 브라우저 `confirm`, run 단계가 정함)를 거쳐 위 주소로 POST한 뒤 화면을 새로 고친다. 관리자 화면의 POST는 같은 출처라 `Origin`이 허용 목록과 맞는다(§A.2 extractJWT). `requestsDeletedAt`은 읽기 전용 필드로 "요청 사항 삭제 일시"라는 라벨과 함께 보인다.
- 요청 사항 필드 자체는 §B.1에 따라 수정 거부이므로 관리자가 글을 고치는 경로는 이 동작뿐이다.

### B.5 참가자 CSV

- 주소: `GET /api/tour-sessions/:id/participants-csv`(컬렉션 엔드포인트). 파일 이름 `session-<회차 ID>-participants.csv`. 경로·파일 이름에 회차 ID 말고는 아무 값도 넣지 않는다.
- 순서: 관리자 아님 → 403 / `Sec-Fetch-Site: cross-site` → 403 / ID 형식 오류·회차 없음 → 404 / 그 회차의 신청을 `payload.find({ where: { session: { equals: id } }, sort: ['createdAt', 'id'], pagination: false, depth: 0, overrideAccess: false, user: req.user })`로 읽음(관리자 읽기 규칙을 한 번 더 태움) → 작업 기록 저장 → CSV 응답. 기록이 실패하면 500, 본문 없음.
- GET 링크로 둔 이유: 대시보드 표에서 링크 하나로 받는 것이 사용자 결정 D5의 형태다. GET이 작업 기록을 남기는 부수 효과가 있으므로, 다른 사이트가 관리자 브라우저로 링크를 열게 하는 경우를 `Sec-Fetch-Site: cross-site` 거부로 막는다. Payload도 `csrf` 허용 목록이 있으면 교차 사이트 쿠키를 받지 않는다(§A.2). 허용 목록이 빈 설정(`NEXT_PUBLIC_SERVER_URL` 없음)은 배포 SPEC 확인 항목이다(tech.md §8.1).
- 형식(순수 함수, 예: `src/lib/participants-csv.ts`):
  - 맨 앞 `﻿`(UTF-8 BOM), 줄 끝 `\r\n`, 마지막 행 뒤에도 `\r\n`
  - 머리글: `접수번호,이름,연락처,이메일,인원,상태,요청 사항`(각 칸 큰따옴표)
  - 칸마다: 문자열로 바꿈 → 첫 글자가 `=` `+` `-` `@` `\t` `\r`이면 앞에 `'` → 안의 `"`를 `""`로 → 큰따옴표로 감쌈. 칸 안의 줄바꿈은 그대로 둔다(따옴표 안이라 한 칸으로 읽힘)
  - 상태: `pending` → `대기`, `confirmed` → `확정`, `cancelled` → `취소`. 요청 사항이 없으면 빈 칸
- 머리글: `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="session-<id>-participants.csv"`, `Cache-Control: no-store, private`, `X-Content-Type-Options: nosniff`.
- 연락처 `+82 10-…`도 앞에 `'`가 붙는다. 붙이지 않으면 엑셀이 수식으로 읽어 오류를 보이므로 받아들인다. 하이픈 없는 `01012345678`은 엑셀이 숫자로 읽어 앞자리 0을 떼어 보일 수 있다(R8, 표시 문제 — 파일 값은 그대로).
- 행 순서: 신청 시각(`createdAt`) 오름차순, 같은 시각이면 신청 ID 오름차순(2차 키로 순서를 하나로 정함, D7).
- 취소 신청을 포함하는 이유: 관리자가 연락 이력과 취소 여부를 함께 봐야 한다. 상태 열로 구분한다(사용자 확인 2026-11-16, `interview.md` "추가 확인").

### B.6 회차 현황 대시보드

- 위치: `admin.components.beforeDashboard`에 서버 컴포넌트 하나(예: `src/components/admin/SessionDashboard.tsx`). 기본 대시보드의 컬렉션 카드 위에 표가 놓인다(§A.2). 서버 컴포넌트는 받은 `payload`·`user`로 데이터 함수를 부르고 표만 그린다. 관리자가 아니면 아무것도 그리지 않는다(관리자 화면은 `users`만 들어오지만 한 번 더 확인).
- 데이터 함수(예: `src/lib/admin-dashboard.ts` `getSessionDashboard(payload, { now })`):
  1. 다가오는 회차: `payload.find({ collection: 'tour-sessions', where: { startsAt: { greater_than: now } }, sort: ['startsAt', 'id'], depth: 0, pagination: false })` — 투어 공개 여부와 관계없이 전부(관리자 화면이므로, 사용자 확인 2026-11-16). 질의 1회.
  2. 투어 제목·공개 여부: 회차들의 투어 ID를 모아 `payload.find({ collection: 'tours', where: { id: { in: ids } }, select: { title: true, published: true }, depth: 0, pagination: false })` — 질의 1회(필드 하나를 더 고를 뿐 질의 수는 같다). 행 데이터에 `tourPublished`(불리언)를 담는다.
  3. 상태별 인원: `occupancy.ts`에 새 함수(예: `getSeatsByStatusBySession`)를 더해 `GROUP BY session_id, status` 질의 1회로 `Map<회차 ID, { pending, confirmed }>`를 만든다. 점유 인원은 `OCCUPYING_STATUSES`의 합으로 같은 모듈 안에서 구한다(정의를 다른 곳에 다시 쓰지 않음). 기존 `getOccupiedSeatsBySession`과 같은 상태 목록 상수를 쓰고 `@MX:ANCHOR` 호출자 목록을 갱신한다.
  4. 남은 자리·상태: `getSessionAvailability(doc, { now, occupiedSeats })`.
  - 투어가 없거나 회차가 없으면 질의 1~2회로 끝난다. 회차 수와 관계없이 최대 3회(+Payload 내부 질의)이며, 측정은 SPEC-APPLY-001 AC-APPLY-005와 같은 방식(`pool.query`·`pool.connect` 감시)으로 한다.
- 행: 투어 이름, 시작 일시(`formatSessionDateTime`, 서울), 정원, 대기 인원, 확정 인원, 남은 자리, `모집 중`/`마감`, "CSV 내려받기" 링크(`/api/tour-sessions/<id>/participants-csv`, `download` 속성). 다가오는 회차가 없으면 "다가오는 회차가 없습니다".
- 비공개 표시(사용자 결정 2026-11-16 — "보이고 '비공개' 표시"): 열을 늘리지 않고 투어 이름 칸 안, 투어 이름 뒤에 `비공개` 표식(짧은 글자 배지)을 둔다. `tourPublished`가 거짓인 행에만 그리고, 공개 투어의 행에는 그리지 않는다. 표식은 색만이 아니라 글자로 구분한다(접근성). 열 목록(D5)은 그대로다.
- 행 수 제한은 두지 않는다. 관리자 1명·소규모 운영이라 다가오는 회차가 수백 개를 넘지 않는다고 본다(`@MX:DEBT`, `@MX:CEILING` 다가오는 회차 수백 개, `@MX:UPGRADE` 페이지 나누기·기간 필터).

### B.7 작업 기록 — `admin-audit-logs`

- 필드: `action`(선택: `application.status_change` / `application.requests_delete` / `session.participants_csv`), `actorId`(숫자, 비울 수 있음 — `users` 관계 필드가 아니라 숫자로 저장해 관리자 계정을 지워도 기록이 남게 함), `occurredAt`(날짜, 서버 처리 시각), `applicationId`(숫자), `referenceCode`(문자), `sessionId`(숫자 — 회차 없는 신청의 수정은 모두 거부되어 기록이 생기지 않으므로(§B.2 3번) 상태 변경·요청 사항 삭제·CSV 기록 모두 채워진다), `fromStatus`·`toStatus`(선택, 상태 변경만), `rowCount`(숫자, CSV만). 신청자 개인정보 필드는 없다.
- 접근: `read: adminOnly`, `create`·`update`·`delete: denyAll`, `disableBulkEdit: true`, 모든 필드 `access.update: () => false`(관리자 화면에서 편집 불가로 보이게). 쓰기는 서버 코드가 로컬 API `overrideAccess: true`와 작업의 `req`로만 한다.
- 관리자 화면: 목록 열 `occurredAt`, `action`, `actorId`, `referenceCode`, `sessionId`, `fromStatus`, `toStatus`, `rowCount`, 기본 정렬 `-occurredAt`. "새로 만들기"·저장·삭제 없음.
- 상태 변경 기록은 `afterChange` 훅이 `req.context`의 **그 신청 ID 항목**에 담긴 이전·이후 상태가 다를 때만 만들고, 만든 뒤 그 항목을 지운다(D11 — 같은 `req`의 다른 신청 수정이 값을 잘못 읽지 않게). 요청 사항 삭제 기록은 §B.4 처리 함수가 `payload.update`가 돌아온 뒤 같은 `req`로 만든다. 관리자 ID는 `isAdmin(req.user)`일 때 `req.user.id`, 아니면 비운다(테스트·서버 코드의 로컬 API 변경 — 그래도 기록은 남겨 이력을 잃지 않음).
- 작업 기록 함수(예: `src/lib/admin-audit.ts` `recordAdminAction(req, entry)`)는 입력 타입에 개인정보 필드를 두지 않아 실수로 넣을 수 없게 한다.
- 정리: 테스트 데이터의 작업 기록은 회차 ID로 지운다. 회차를 지우기 전에 그 회차들의 기록을 지운다(정리 도우미 두 곳 수정). 회차 없는 신청을 만드는 사례(AC-ADMIN-005)는 기록을 남기지 않으며, 그 사례가 끝에 자기 신청을 신청 ID로 지운다.

### B.8 오류 코드와 개인정보

- 영문 고정 코드(`acceptance.md` §0). 상태 변경 오류는 Payload 저장 오류로 관리자 화면 알림에 그대로 보이므로 `<코드>: <영문 문장>` 형태로 코드를 앞에 둔다.
- 로그는 SPEC-APPLY-001의 `logFailure`와 같은 모양(코드·오류 종류 이름·신청 ID·회차 ID). 잡은 오류의 `message`·`detail`을 기록하거나 돌려주지 않는다. 이 SPEC 코드가 던지는 `APIError`는 고정 문구만 담고 원인 오류를 붙이지 않는다. 그래서 Payload가 그 오류를 경로 오류 처리에서 기록해도(§A.2 "Payload 자체 오류 기록") 개인정보가 실리지 않는다.
- **Payload 자체 오류 기록 — 결정(1회차 감사 D4): REQ-ADMIN-015를 이 SPEC 코드로 한정하고, Payload 저장 단계의 DB 오류 기록은 잔여 위험(R23)과 출시 전 점검 항목으로 넘긴다.**
  - 위험의 실체: 관리자 화면·REST 저장의 UPDATE는 잠긴 필드까지 문서 값(이름·이메일·연락처·요청 사항)을 바인딩한다(§A.2 "빠진 필드는 … 채워짐"). 그 UPDATE가 이 SPEC의 훅이 끝난 **뒤** DB 단계에서 실패하면(연결 끊김·제약 위반 등) `DrizzleQueryError`의 메시지와 `params`에 그 값이 실리고, Payload `routeError` → `logError`가 `err` 객체 전체를 기록한다. 이 경로는 이 SPEC이 신청 수정을 열면서 새로 생긴다.
  - 완화(a)를 고르지 않은 이유 — 검증할 수 있는 형태로 만들 수 없다: ① `afterError` 훅은 기록 **뒤**에 실행되어 막지 못한다(`routeError.js` 38~41 vs 57~86). ② `loggingLevels`는 오류 이름으로 고르는데 `DrizzleQueryError`의 이름이 `Error`라 이 오류만 끌 수 없고, `info` 수준도 `err.message`(바인딩 값 포함)를 기록한다(`logError.js` 3~9, `errors.js` 10~19). ③ 남는 방법은 Payload 설정 `logger`에 오류 직렬화 함수를 넣어 앱 전체 로그를 바꾸는 것인데, 모든 컬렉션·경로에 영향을 주는 운영 로깅 정책이라 이 SPEC 범위를 넘고(배포 단계의 로그 수집·보관 결정과 함께 정해야 함), 이를 증명하려면 Payload의 UPDATE 단계에서 DB 오류를 결정적으로 일으켜야 하는데 제품 코드에 시험용 분기를 두지 않고는 E2E·통합 어디에서도 그 지점에 닿을 수 없다.
  - 택한 방식(b)이 검증 가능한 이유: 이 SPEC 코드의 로그·오류 문구는 AC-ADMIN-015가 성공·거부·잠금 대기 초과·기록 실패 사례로 붙잡아 판정한다. 범위 밖으로 넘긴 부분은 이름을 붙여 기록하고(R23, `spec.md` §5 "Out of Scope — Payload 기본 오류 기록"), 출시 전 점검 목록(SPEC-APPLY-001 "출시 전 보완")에 "운영 로깅에서 Payload 기본 오류 기록의 질의 바인딩 값 처리(로거 직렬화 또는 로그 접근 통제·보관 기간) — 배포 SPEC(로드맵 8번)에서 결정, 변호사 확인 목록과 연결"을 한 줄 더한다(sync 단계에서 `progress.md`로 옮겨 적음).
- 문구 모음은 한 모듈(예: `src/lib/admin-messages.ts`)에 두어 화면 문구(한국어)와 오류 문구(영문)를 한곳에서 관리한다.

### B.9 테스트가 관리자 전용 경로를 다루는 방법

| 대상 | 통합(Vitest, 실제 PostgreSQL) | E2E(Playwright, `next dev`) |
|---|---|---|
| 관리자 계정 | 파일마다 `admin-<uuid>@example.test` 사용자를 만들고 `afterAll`에서 지운다. 실제 관리자 계정은 조회도 하지 않는다 | `tests/e2e/global-setup.ts`가 만든 테스트 관리자(`E2E_TEST_ADMIN_EMAIL`)만 쓴다 |
| 상태 변경 | `payload.update({ …, user: admin, overrideAccess: false })` — REST·관리자 화면과 같은 `updateByID` 경로. 잡은 오류의 `status`(409)도 단언 | 요청 API: `POST /api/users/login`으로 토큰을 받아 `Authorization: JWT <토큰>`으로 `PATCH /api/applications/<id>` — 응답 상태 코드와 `errors[0].message`를 단언(§A.2 "REST 오류 응답"). 잠금 대기 초과 사례는 E2E 쪽 로컬 Payload의 `payload.db.pool`에서 연결 하나를 빌려 회차 행을 `FOR UPDATE`로 쥔다(E2E 도우미는 이미 `getPayload`로 로컬 API를 씀, `tests/helpers/e2e-catalog.ts` 5·33행). 화면: 로그인 후 상세에서 상태를 바꾸고 저장 |
| 요청 사항 삭제 | `src/lib/` 처리 함수를 직접 호출(관리자·익명·없는 ID). 동시성은 처리 함수의 `beforeCommit` 주입 지점, 또는 테스트가 별도 트랜잭션으로 쥔 회차 행 잠금으로 겹치게 한다 | 요청 API로 `POST …/clear-requests`(익명 403, 관리자 200·409·404). 화면: 버튼·확인 단계 |
| CSV | 형식은 단위 테스트(순수 함수). 엔드포인트 처리 함수는 `createLocalReq({ user }, payload)`로 만든 `req`에 `routeParams`·머리글을 넣어 직접 호출할 수 있다(run 단계가 고름) | 요청 API로 머리글·본문 바이트 확인. 화면: 대시보드 링크 클릭 → `page.waitForEvent('download')` |
| 대시보드 | 데이터 함수 + 질의 수 감시 | 로그인 후 `/admin`에서 표의 테스트 회차 행(표식 투어 제목으로 찾음) 확인 |
| 작업 기록 접근 | `overrideAccess: false`로 익명·관리자 쓰기 거부 | REST `POST`·`PATCH`·`DELETE` 403 |

- 원자성 시험(작업 기록 실패 시 함께 되돌림)은 제품 코드에 시험용 분기를 두지 않고, 테스트가 `vi.spyOn(payload, 'create')`로 `admin-audit-logs` 생성만 한 번 실패시키는 방식으로 한다(훅은 `req.payload`, 즉 같은 인스턴스를 쓴다). run 단계가 더 나은 방법을 찾으면 바꿔도 된다.
- E2E 대시보드는 개발 DB의 실제 회차도 함께 그리므로, 단언은 표식 투어 제목이 든 행만 대상으로 한다.

## §C. 사전 점검 (run 단계 시작 전, 순차)

```powershell
git branch --show-current          # main
git rev-parse --short HEAD         # 기준 HEAD 기록 (보강 시점 a8cf60b, 최초 계획 8a4cdd1)
git diff --stat a8cf60b -- src/collections src/lib tests pnpm-lock.yaml   # a8cf60b 뒤에 이 SPEC 범위 파일이 바뀌었는지 확인(바뀌었으면 §A.1 다시 점검)
git status --short                 # 추적 파일 변경 확인 — importMap.js의 M은 내용 차이 없음(아래 줄로 확인)
git diff --ignore-cr-at-eol --stat -- 'src/app/(payload)/admin/importMap.js'   # 출력 없음 기대
docker compose ps --format '{{.Service}} {{.Health}}'   # postgres healthy
pnpm install --frozen-lockfile
pnpm test                          # 기준선 통과 수 기록 (계획 시점 기록 521)
pnpm e2e                           # 기준선 통과 수 기록 (계획 시점 기록 41)
pnpm lint
pnpm format:check
pnpm typecheck
```

- 기준선 결과(종료 코드와 통과 수)를 `progress.md` §E.2 첫머리에 적는다. 긴 출력은 `.moai/state/verify/<세션>/` 아래 파일로 남긴다.
- OWASP CSV Injection 문서를 WebFetch로 열어 수식 시작 문자 목록이 §B.5와 같은지 확인하고 결과를 §E.2에 적는다. 다르면 차단자 보고.
- 작업 기록 고아 검사(AC-ADMIN-016)의 기준값은 `admin_audit_logs` 테이블이 생긴 **M1 직후**에 재서 §E.2에 적는다(run 시작 시점에는 테이블이 없다).
- `.env` 내용은 출력하지 않는다. 검증에 필요한 값(`POSTGRES_USER`, `POSTGRES_DB`)은 명령 안에서만 읽는다.

## §D. 제약 (지킬 것)

- **실제 관리자 계정을 건드리지 않는다.** 테스트는 `@example.test` 계정만 만들고 쓰고 지운다. 실제 계정으로 로그인하거나 비밀번호·필드를 바꾸지 않는다. 수동 확인(AC-ADMIN-003·015)은 사용자가 직접 한다.
- 테스트 데이터는 표식(투어 slug·제목 `test-<무작위 값>…`, 신청 이메일 `…@example.test`, 접속 IP 문서용 대역)을 붙이고 끝나면 지운다. 작업 기록도 회차 ID로 지운다.
- `.env`를 출력하거나 커밋하지 않는다. 테스트는 비밀 값을 출력하지 않는다.
- 검증 셸은 Windows PowerShell 5.1. 명령 인자 안에 큰따옴표를 겹쳐 쓰지 않는다.
- 새 npm 패키지 추가 금지(직접·간접). `pnpm-lock.yaml`은 바뀌지 않아야 한다. `drizzle-orm`을 직접 import하지 않는다(`@payloadcms/db-postgres`의 `sql`을 쓴다).
- `.prettierignore`, `eslint.config.mjs`의 검사 제외 목록, `pnpm-workspace.yaml`은 바꾸지 않는다.
- 유지: `src/lib/submit-application.ts`의 정원 확인 구간(이 SPEC은 내보낸 상수·함수를 가져다 쓰기만 한다 — F2는 범위 밖), `getSessionAvailability`의 규칙, `occupancy.ts`의 `OCCUPYING_STATUSES`와 기존 두 함수의 동작, `TourSessions.ts`의 필드·접근 규칙·`beforeDelete` 훅(F1은 범위 밖, 엔드포인트 추가만 한다), `application-attempts` 규칙, 사이트 화면(`src/app/(frontend)/`).
- `src/app/(payload)/` 템플릿 파일은 직접 고치지 않는다. 생성 파일은 `pnpm generate:types`·`pnpm generate:importmap`으로만 다시 만든다.
- 개인정보를 `console`·`payload.logger`로 출력하지 않는다. 잡은 오류는 코드·오류 종류 이름·ID만 기록한다.
- 커밋은 경로를 명시해 스테이징한다(`git add -A` 금지). `.env`, `media/` 아래 파일, 검증 로그는 커밋하지 않는다.
- Conventional Commits, 메시지에 `SPEC-ADMIN-001`, 마지막 줄 `🗿 MoAI`. `--no-verify` 금지.

## §E. 자체 검증 순서

### E-1. 순차 실행 (상태를 쓰는 명령)

`pnpm test`와 `pnpm e2e`는 같은 개발 DB를 쓰고, `build`와 `e2e`는 `.next/`를 다시 쓰므로 병렬로 실행하지 않는다.

1. `docker compose up -d` → `postgres healthy`
2. `pnpm generate:types`, `pnpm generate:importmap` → 생성 파일 차이 확인
3. `pnpm typecheck`
4. `pnpm build`
5. `pnpm test`
6. `pnpm e2e`
7. 변이 확인(AC-ADMIN-006): 상태 변경 경로의 회차 행 `FOR UPDATE`를 잠시 뺀 코드로 동시성 테스트 파일만 실행 → 실패 확인 → 되돌림 → 다시 통과 확인
8. 변이 확인(AC-ADMIN-008): §B.2 5번(잠긴 필드 덮어쓰기)을 상태가 바뀌는 분기에서만 하도록 잠시 바꾼 코드로 요청 사항 삭제 동시성 사례만 실행 → 되살림 사례 실패 확인 → 되돌림 → 다시 통과 확인

### E-2. 병렬 실행 (읽기 전용 — E-1이 끝난 뒤 한 턴에)

```powershell
pnpm lint
pnpm format:check
git status --short
git diff --stat a8cf60b -- pnpm-lock.yaml .prettierignore eslint.config.mjs pnpm-workspace.yaml src/lib/submit-application.ts
```

마지막 명령의 출력은 비어 있어야 한다(§D).

## §F. 마일스톤

각 마일스톤은 RED(실패하는 테스트) → GREEN(최소 구현) → REFACTOR 순서다. RED 단계의 실패 출력은 `progress.md` §E.2에 그대로 남긴다.

### M1 — 접근 규칙과 데이터 모델 (우선순위: High — 되돌리기 가장 어려운 결정)

- RED: 통합 — 등록 컬렉션 목록 7개(`users-auth.spec.ts` 단언 갱신), 관리자 단건 상태 수정 성공·다른 필드 값 불변·일괄 수정 403·익명 수정 거부(`application-access.spec.ts` 갱신), `admin-audit-logs` 접근(익명·관리자 쓰기 거부, 관리자만 읽기), 저장소 규칙(`Applications`에서 `access.update` 없는 이름 있는 필드 = `status` 하나)
- GREEN: `Applications.ts` 접근 규칙·`disableBulkEdit`·필드 수정 거부·`requestsDeletedAt` 필드, `src/collections/AdminAuditLogs.ts`, `payload.config.ts` 등록, 작업 기록 함수 `recordAdminAction`(입력 타입에 개인정보 없음)
- 정리 도우미 2곳에 "회차 삭제 전 그 회차들의 작업 기록 삭제" 단계 추가
- `pnpm generate:types`
- M1 직후 작업 기록 고아 검사 기준값(AC-ADMIN-016)을 재서 §E.2에 기록
- 검증: AC-ADMIN-001, AC-ADMIN-002(통합 부분), AC-ADMIN-015(접근 부분)
- 관련 REQ: 001, 002, 014

### M2 — 상태 변경 규칙과 동시성 (우선순위: High — 가장 위험한 결정)

- RED: 통합 — 전환표와 `cancelledAt`(AC-ADMIN-004), 복원 정원 초과 거부(잡은 오류 `status` 409)·정확히 채우면 마감·마감 회차 복원(원시 SQL 마감)·회차 없는 신청의 모든 수정 `SESSION_MISSING`(AC-ADMIN-005), 취소가 마감을 풀지 않음(AC-ADMIN-007), 작업 기록 내용과 원자성(AC-ADMIN-014), 동시성: 사이트 접수를 주입 지점에서 멈춘 채 복원 시작 → 잠금 대기 확인 → 풀어 줌(결정적 시나리오), 병렬 시나리오 3회, 잠금 대기 초과 `SESSION_BUSY`(AC-ADMIN-006), 상태 없는 수정이 잠금 뒤 상태를 유지함(AC-ADMIN-008의 상태 없는 수정 사례 중 삭제와 무관한 부분)
- GREEN: `beforeOperation` 원본 입력 판별 + 모든 수정의 보호 구간(§B.2 0~12번 중 요청 사항 삭제 표시 분기인 6번 제외), `Applications` `beforeOperation`·`beforeChange`·`afterChange` 훅 연결, 오류 문구 모듈
- 변이 확인(§E-1 7번): 상태 변경 경로의 회차 행 잠금을 빼면 결정적 시나리오가 실패해야 한다. 결과를 §E.2에 기록
- 검증: AC-ADMIN-004~007, AC-ADMIN-014
- 관련 REQ: 004~007, 013

### M3 — 관리자 상세 화면과 요청 사항 삭제 (우선순위: Medium)

- RED: 통합 — 요청 사항 삭제 함수(관리자 성공·두 번째 `REQUESTS_EMPTY`·익명 `FORBIDDEN`·없는 ID `NOT_FOUND`·잠금 대기 초과 `SESSION_BUSY`·회차 없는 신청 `SESSION_MISSING`(AC-ADMIN-005)·기록 실패 시 되돌림·관리자 일반 수정으로는 글이 안 바뀜), 되살림 방지 결정적 사례 2개(같은 상태 저장·상태 없는 수정, AC-ADMIN-008), 요청 사항 삭제 ↔ 상태 변경 동시성(결정적 + 병렬 3회, AC-ADMIN-006). E2E — 요청 API 권한(AC-ADMIN-008), 상세 화면의 상태 입력란 편집 가능·다른 필드 편집 불가·상태 저장 후 접수 완료 화면 상태 값이 정확히 `확정`(AC-ADMIN-003), 삭제 버튼·확인 단계·삭제 후 화면(AC-ADMIN-009), 목록에 "새로 만들기"·일괄 편집 없음
- GREEN: 요청 사항 삭제 함수(테스트 전용 `beforeCommit` 포함)와 `POST /:id/clear-requests` 엔드포인트, §B.2 6번 분기, `type: 'ui'` 필드 + 클라이언트 구성 요소(`src/components/admin/`), `pnpm generate:importmap`
- 변이 확인(§E-1 8번): 잠긴 필드 덮어쓰기를 상태가 바뀌는 분기로만 좁히면 되살림 사례가 실패해야 한다. 결과를 §E.2에 기록
- 기존 E2E `tests/e2e/application-api.spec.ts`의 관리자 `PATCH` 단언 갱신(상태 수정 200, 일괄 403), REST `PATCH` 409 단언(AC-ADMIN-005 정원 초과, AC-ADMIN-006 잠금 대기 초과)
- 수동: 관리자 화면에서 상세·목록·작업 기록 화면을 사용자가 확인 → §E.2 기록(AC-ADMIN-003·015)
- 검증: AC-ADMIN-002(E2E 부분), AC-ADMIN-003, AC-ADMIN-005·006(REST 409 부분, 요청 사항 삭제 동시성 부분), AC-ADMIN-008, AC-ADMIN-009
- 관련 REQ: 002, 003, 005, 006, 008

### M4 — 참가자 CSV (우선순위: Medium)

- RED: 단위 — CSV 형식 전체(BOM, CRLF, 따옴표, 수식 주입 사례, 상태 라벨, 빈 요청 사항). E2E 요청 API — 관리자 200·머리글·본문 바이트·행 순서·다른 회차 제외, 익명 403, `cross-site` 403, 404 두 종류, 작업 기록 1건(거부된 요청은 0건)
- GREEN: CSV 순수 함수, `TourSessions`의 `GET /:id/participants-csv` 엔드포인트, 작업 기록 연결
- 검증: AC-ADMIN-010, AC-ADMIN-011
- 관련 REQ: 009, 010, 013

### M5 — 회차 현황 대시보드 (우선순위: Medium)

- RED: 통합 — 데이터 함수(대기·확정·남은 자리·상태·정렬·지난 회차 제외·카탈로그 남은 자리와 일치·비공개 투어 회차 포함과 `tourPublished` 값), 질의 수(회차 1개 대 6개). E2E — 로그인 후 `/admin` 표의 테스트 행 값, 비공개 투어 행의 `비공개` 표시와 공개 투어 행의 표시 없음, CSV 링크 주소, 링크 클릭 내려받기(파일 이름·BOM·머리글)
- GREEN: `occupancy.ts` 상태별 합계 함수(같은 상수), 대시보드 데이터 함수, `beforeDashboard` 서버 컴포넌트, `pnpm generate:importmap`
- `@MX:ANCHOR` 호출자 목록 갱신(`occupancy.ts`·`session-availability.ts`)
- 검증: AC-ADMIN-012, AC-ADMIN-013
- 관련 REQ: 011, 012

### M6 — 개인정보 비노출 점검, 회귀 정리, 품질 게이트 (우선순위: Low)

- 통합: 성공·거부·잠금 대기 초과·기록 실패 사례를 차례로 실행하며 `console`·`payload.logger` 출력을 붙잡아 표식 값 0건(수집 1건 이상 먼저 단언)
- 전체 품질 게이트(`acceptance.md` §8), 커버리지 85% 이상, 정리 잔여 0
- 출시 전 점검 목록 후보 두 줄(R20 작업 기록 보관 기간, R23 Payload 기본 오류 기록)을 §E.2에 적어 sync 단계가 옮기게 한다
- MX 태그: 신청 수정 보호 구간 `@MX:WARN`(트랜잭션·잠금 순서 — 모든 수정이 회차 → 신청, 잠긴 필드는 모든 분기에서 잠금 뒤 값) + `@MX:REASON`, 작업 기록 함수 `@MX:ANCHOR`(호출자 3곳), 대시보드 `@MX:DEBT`(+ `@MX:CEILING`·`@MX:UPGRADE`), `Applications.ts`의 "로드맵 6번이 다시 정한다" `@MX:NOTE` 갱신, `consent.ts`의 "즉시 삭제" `@MX:NOTE` 갱신(동작이 생겼음)
- `progress.md` §E.2·§E.3 작성
- 검증: AC-ADMIN-015(개인정보 부분), AC-ADMIN-016
- 관련 REQ: 015, 016

### 예상 생성·수정 파일

- 생성: `src/collections/AdminAuditLogs.ts`, `src/lib/{application-status,clear-requests,participants-csv,admin-dashboard,admin-audit,admin-messages}.ts`(이름은 예시, 합치거나 나눌 수 있음), `src/components/admin/{SessionDashboard,ClearRequestsField}.tsx`(예시), `tests/unit/participants-csv.spec.ts`, `tests/integration/{application-status,application-status-concurrency,clear-requests,clear-requests-concurrency,admin-dashboard,admin-audit,admin-pii-logging}.spec.ts`(동시성 두 파일은 합칠 수 있음), `tests/e2e/admin-ops.spec.ts`(예시), 필요하면 `tests/helpers/admin-fixtures.ts`
- 수정: `src/collections/Applications.ts`, `src/collections/TourSessions.ts`(엔드포인트 추가만), `src/payload.config.ts`(등록·`beforeDashboard`), `src/lib/occupancy.ts`(상태별 합계 함수 추가만), `tests/integration/{users-auth,application-access}.spec.ts`, `tests/e2e/application-api.spec.ts`, `tests/unit/repo-rules.spec.ts`, `tests/helpers/{application-fixtures,e2e-catalog}.ts`(작업 기록 정리 단계)
- 생성 파일 갱신: `src/payload-types.ts`, `src/app/(payload)/admin/importMap.js`

## §G. 위험과 대응

| ID | 위험 | 대응 |
|---|---|---|
| R1 | 잠금 전에 읽힌 `originalDoc`이나 관리자 화면이 보낸 오래된 상태로 판단 → 다른 탭이 바꾼 취소를 덮어써 정원 확인 없이 복원. 상태 없는 수정도 Payload가 채운 잠금 전 상태를 다시 저장 | 모든 수정을 잠그고, 상태 변경 요청은 잠금 뒤 다시 읽은 값으로만 판단, 상태 변경 요청이 아닌 수정은 잠금 뒤 상태를 저장(§B.2 4·5번). AC-ADMIN-004 같은 값 저장 사례, AC-ADMIN-006, AC-ADMIN-008 상태 없는 수정 사례 |
| R2 | 훅 안의 질의가 `req` 없이 실행되어 트랜잭션 밖 연결로 나감 → 잠금 효과 없음·풀 고갈 | 원시 SQL은 `transactionDb(payload, req.transactionID)`만, 로컬 API는 같은 `req`. `@MX:WARN`. 동시성 테스트 |
| R3 | 잠금 순서가 경로마다 달라 교착(1회차 감사 D1: 최초 계획의 요청 사항 삭제는 실제로 신청 → 회차 순서였음 — Payload가 `status`를 채워 넣어 훅이 회차를 잠갔기 때문) | 모든 신청 수정(상태 변경 요청·요청 사항 삭제·그 밖의 수정): 회차 → 신청, 회차 없는 신청은 잠그기 전에 `SESSION_MISSING`. 사이트 접수: 회차만 + 새 행 삽입. 요청 사항 삭제 함수는 신청 행을 먼저 잠그지 않음. 복원 마감은 원시 SQL이라 행 잠금을 쥔 뒤 문서 잠금 행을 건드리지 않음. 보장 범위는 `applications`·`tour_sessions` 행 사이의 순환 대기 없음이며, 문서 잠금 테이블이 끼는 대기·교착은 R26. 교착(40P01)이 생기면 `SESSION_BUSY`로 바꾸되, AC-ADMIN-006의 요청 사항 삭제 ↔ 상태 변경 결정적 사례가 교착 없이 둘 다 성공함을 확인(옛 순서면 이 사례가 교착으로 실패). §B.2·§B.4 |
| R4 | 필드 수정 거부가 오류 없이 값을 버려 "막혔는지" 테스트가 오류 유무로 판정하면 놓침 | AC-ADMIN-002는 저장 뒤 값을 비교한다. 저장소 규칙이 `status` 외 필드의 `access.update`를 강제 |
| R5 | `disableBulkEdit`·필드 거부는 `overrideAccess: true`인 서버 코드에는 걸리지 않음 | 서버 코드의 일괄 수정을 만들지 않는다(사이트 접수·훅·삭제 함수는 모두 단건). 코드 검토 항목 |
| R6 | 테스트·기존 코드의 로컬 API 상태 변경(예: `application-concurrency.spec.ts` 99행)이 관리자 ID 없는 기록을 남겨 잔여 데이터가 됨 | 정리 도우미가 회차 ID로 기록을 지움. AC-ADMIN-016 잔여 검사 |
| R7 | CSV 수식 주입 목록이 불완전(전각 문자, 셀 중간의 수식 등) | OWASP 목록을 §C에서 다시 확인. 셀 중간의 `=`은 엑셀이 수식으로 읽지 않음. 잔여 위험으로 기록 |
| R8 | 하이픈 없는 연락처를 엑셀이 숫자로 읽어 앞자리 0을 떼어 보임 | 파일 값은 그대로이므로 표시 문제로 받아들인다. 필요하면 후속 SPEC에서 `.xlsx` 검토 |
| R9 | GET 내려받기가 작업 기록을 남기는 부수 효과 — 다른 사이트가 링크를 열게 하는 요청 | `Sec-Fetch-Site: cross-site` 거부 + Payload `csrf` 목록. 목록이 빈 설정은 배포 SPEC 항목 |
| R10 | `importMap.js` 생성 결과가 Payload 업그레이드·포맷 차이로 흔들림 | 생성 명령으로만 갱신, 생성 후 `pnpm format:check`. 계획 시점 `M` 표시는 내용 차이 없음(§A.1) |
| R11 | 대시보드 행 수 제한 없음 → 회차가 매우 많으면 첫 화면이 느려짐 | 질의 수는 고정(REQ-ADMIN-012). `@MX:DEBT`로 상한 기록 |
| R12 | 잠금 대기 초과 시험이 5초 이상 걸림 | 통합 제한 시간 60초 안. 이 사례 하나만 기본 5초를 쓴다 |
| R13 | 결정적 동시성 시험에서 사이트 접수를 너무 오래 멈추면 복원이 5초 제한에 걸려 `SESSION_BUSY` | 잠금 대기 확인 뒤 3초 안에 풀어 준다(AC-ADMIN-006) |
| R14 | 관리자 화면 저장이 문서 전체를 검증 → 옛 신청(`ageConfirmedAt` 없음)이 막힘 | `ageConfirmedAt`은 필수가 아님(SPEC-APPLY-001 출시 전 보완). 기존 검증 함수는 같은 규칙으로 저장된 값이라 통과. E2E가 기존 형태의 신청으로 저장을 시험 |
| R15 | 요청 사항 삭제와 다른 저장(상태 변경, 같은 상태 저장, 상태 없는 수정)이 겹치면 잠금 전 문서의 요청 사항·빈 삭제 일시가 다시 저장됨(1회차 감사 D2: 최초 계획은 상태가 바뀌는 분기만 덮었음) | 모든 수정이 잠근 뒤 읽은 요청 사항·삭제 일시·취소일로 데이터를 덮어쓰며, 이 단계는 같은 상태 분기를 포함한 모든 분기보다 먼저 실행(§B.2 5번). AC-ADMIN-008 되살림 결정적 사례 2개 + §E-1 8번 변이 확인 |
| R16 | 직접 작성 코드가 Tier M 지침을 크게 넘음 | §A.3 분할 기준(2026-11-16 재추정: 제품 약 800~1,000줄, 파일 약 33개 — Tier M 유지) |
| R17 | E2E가 Payload 관리자 화면 구조(선택자)에 기대어 깨지기 쉬움 | 버전 3.93.0 고정. 라벨·역할 기반 선택자를 우선하고, 필드 ID(`#field-status`)는 보조로 |
| R18 | Payload 버전 기록을 나중에 켜면 지운 요청 사항이 이전 버전에 남음 | 가정 A7. 켜는 SPEC이 다시 검토 |
| R19 | 사이트 접수 쪽 주입 지점 `beforeCommit` 동작이 바뀌면 결정적 동시성 시험이 깨짐 | `submit-application.ts`는 이 SPEC에서 바꾸지 않음(§D, §E-2 diff 검사) |
| R20 | 작업 기록 보관 기간 2년(사용자 결정)이 법정 접속 기록 보관 요구와 맞는지 미확인, 자동 삭제 미구현 | 가정 A6. 출시 전 검토 목록(SPEC-APPLY-001 "출시 전 보완")에 한 줄 더함 — sync 단계에서 `progress.md`에 옮겨 적음 |
| R21 | 관리자 쿠키 인증의 POST가 `csrf` 목록과 맞지 않아 E2E에서 거부 | E2E 서버는 `serverURL`을 E2E 주소로 덮어씀(SPEC-INFRA-001 R14). 요청 API는 `Authorization: JWT` 머리글 사용 |
| R22 | 작업 기록이 숫자 ID만 담아 회차·신청을 지우면 고아 기록이 됨 | 신청은 삭제 거부, 신청 있는 회차도 삭제 거부라 운영에서는 드묾. 테스트 정리는 회차 ID로 기록을 먼저 지움. 회차 없는 신청은 모든 수정이 거부되어 기록이 생기지 않음(§B.2 3번) |
| R23 | Payload가 저장 단계 DB 오류를 이 SPEC 코드 밖에서 기록(`routeError` → `logError`)하며 `DrizzleQueryError`의 메시지·`params`에 이름·연락처·요청 사항이 실림. 이 SPEC이 신청 수정을 열면서 새로 생기는 경로 | REQ-ADMIN-015는 이 SPEC 코드로 한정(§B.8 D4 결정). 이 SPEC 훅 안의 오류는 원인 없는 고정 문구로 바꿔 Payload 기록에도 개인정보가 없게 함. Payload 기본 기록은 잔여 위험 — 출시 전 점검 목록에 "운영 로깅의 질의 바인딩 값 처리(로거 직렬화 또는 로그 접근 통제·보관)"를 더하고 배포 SPEC(로드맵 8번)과 변호사 확인 목록으로 넘김. 발생 조건: 훅이 끝난 뒤 UPDATE 자체가 DB에서 실패(연결 끊김·제약 위반) — 드묾 |
| R24 | 회차 없는 신청은 `session` 필수 검증(`Applications.ts` 70~74) 때문에 어떤 수정도 저장할 수 없음(2회차 감사 N2). 단, 실제 DB의 `session_id`는 `NOT NULL`(외래 키 `ON DELETE SET NULL`)이라 신청이 있는 회차의 삭제가 23502로 먼저 실패하며, 회차 없는 신청은 지금 커밋될 수 없음(run 단계 확인 — 계획 당시 가정은 F1 결과로 생긴다는 것이었음) | 방어 처리: 그 신청의 모든 수정(상태 변경·복원·같은 상태 저장·상태 없는 수정·요청 사항 삭제)을 잠그기 전에 `SESSION_MISSING`(409)으로 거부, 아무것도 바뀌지 않고 기록도 없음(§B.2 3·4번). 시험은 되돌리는 트랜잭션 안에서 `NOT NULL`을 잠시 풀어 재현(AC-ADMIN-005, R29). 스키마가 바뀌어 회차 없는 신청이 생기면 그 신청의 요청 사항(민감정보)을 이 SPEC으로는 지울 수 없으므로 F1 해결 때 스키마와 함께 다룸(`spec.md` §5 F1, `progress.md` 이월). 회차 값이 3번과 4번 사이에 바뀌거나 회차 `FOR UPDATE`가 0행이어도 `SESSION_MISSING`으로 끝냄(N4·O3) |
| R25 | `beforeOperation`을 거치지 않는 수정 경로가 생기면 상태 변경 요청이 "요청 없음"으로 처리되어 조용히 무시됨 | Payload 3.93의 단건·일괄 수정은 모두 `beforeOperation`을 부름(§A.2). 표시가 없으면 상태를 잠금 뒤 값으로 유지하는 안전 쪽 기본값이다(정원 확인 없는 복원은 생기지 않음). 단, 일괄 수정은 `args.id`가 없어 0번이 표시를 남기지 않으므로 `overrideAccess: true` 일괄 수정의 상태 값은 조용히 무시된다(5번이 잠금 뒤 상태로 덮어씀). R5에 따라 서버 코드에 일괄 수정을 만들지 않으므로 실제 경로는 없다. Payload 업그레이드 때 §A.2 근거를 다시 확인 |
| R26 | Payload 문서 잠금 테이블(`payload-locked-documents`)이 끼는 대기·교착(2회차 감사 N1). ① 관리자 화면(또는 REST·삭제 함수)의 신청 저장은 `checkDocumentLockStatus`(`update.js` 48행)가 이 SPEC 훅보다 먼저, 행 잠금이 없는 상태로, 5초 제한 밖에서 그 신청의 문서 잠금 행을 지운다. 그 행을 다른 트랜잭션이 쥐고 있을 때만(같은 신청의 다른 수정이 이미 48행을 지나 커밋 전이거나, Payload가 편집 화면의 문서 잠금을 잡거나 고치는 중) 그 트랜잭션이 끝날 때까지 기다린다. 기다리는 쪽은 회차·신청 행을 쥐고 있지 않으므로 순환은 생기지 않고, 상대는 자기 행 잠금 대기가 5초 제한에 묶여 있어 결국 끝난다. 그러나 이 대기 자체는 `SESSION_BUSY`로 바뀌지 않고 상대가 끝날 때까지 늦어진다. ② SPEC-APPLY-001 사이트 접수의 자동 마감은 회차 행을 쥔 채 중첩 `payload.update(tour-sessions)`로 `(tour-sessions, 회차 ID)` 문서 잠금 행을 지우므로, 관리자가 그 회차의 편집 화면을 연 채 저장하면(문서 잠금 행 → 회차 행 순서) 교착(40P01)할 수 있다 | ① 이 SPEC 경로는 행 잠금을 쥔 뒤 문서 잠금 행을 건드리지 않음(복원 마감 원시 SQL, 작업 기록은 `create`, §B.2 9·11번). 남는 늦어짐은 관리자 1명·같은 신청 동시 저장이 드묾을 근거로 받아들임. ② 이 SPEC 범위 밖(`submit-application.ts` 불변, §D) — `progress.md` 이월 항목으로 기록하고 사이트 접수 쪽 원시 SQL 마감은 후속 SPEC에서 다룸. 희생된 쪽이 사이트 접수면 SPEC-APPLY-001의 기존 오류 처리, 회차 저장이면 Payload 기본 오류로 끝남 |
| R27 | (sync-audit 선택 지적 F1-audit, 알려진 한계) 서버 코드가 `overrideAccess: true`로 `where` 일괄 수정을 하면 `beforeOperation`이 신청 ID가 없어 상태 변경 요청 표시를 남기지 않으므로, 상태 변경이 오류 없이 버려진다(잠금 뒤 상태로 되돌림 — R25와 같은 원인) | 지금 그런 호출자는 없다(`applications` 수정 호출자는 요청 사항 삭제 함수 하나, 단건). R5에 따라 서버 코드 일괄 수정을 만들지 않는다. 필요해지면 ID 없는 수정에서 명시적 오류를 던지거나 `@MX:NOTE`로 제약을 남긴다 — 후속 SPEC 점검 항목 |
| R28 | (sync-audit 선택 지적 F2-audit, 알려진 한계) CSV 수식 무력화는 첫 글자만 보므로 앞 공백 뒤에 수식 문자가 오는 값(` =1+1`)은 무력화하지 않는다 | 위험 낮음 — 엑셀·LibreOffice는 앞 공백 칸을 글자로 읽고, REQ-ADMIN-010(첫 글자 기준)은 충족한다. 필요하면 앞 공백을 건너뛴 첫 글자로 판정하도록 후속 SPEC에서 검토(R7과 함께) |
| R29 | (sync-audit 선택 지적 F3-audit, 알려진 한계) 회차 없는 신청 재현 시험(AC-ADMIN-005)이 시험 트랜잭션 안에서 `ALTER TABLE applications ALTER COLUMN session_id DROP NOT NULL`을 실행해, 그 사례 동안 공유 개발 DB의 `applications`에 ACCESS EXCLUSIVE 잠금이 걸린다. 동시에 돌던 개발 서버의 조회가 잠깐 멈출 수 있다 | 트랜잭션을 되돌려 스키마는 그대로(`is_nullable = NO` 확인), `lock_timeout` 3초로 대기를 묶는다. 근본 원인은 DB 스키마(`NOT NULL`)와 이 SPEC 방어 처리의 재현 방식이며, F1 후속 SPEC에서 재현 방식과 SPEC 문구를 함께 정리 |
| R30 | (sync-audit 선택 지적 F4-audit, 알려진 한계) 요청 사항 삭제 POST의 쿠키 인증 출처 검사는 `NEXT_PUBLIC_SERVER_URL`이 설정되어 Payload `csrf` 목록에 들어갈 때만 강제된다. 운영에서 비어 있으면 모든 Origin의 쿠키를 받는다(쿠키 기본 SameSite가 교차 사이트 POST를 대부분 막음) | 지금 `.env`에는 키가 있다. 배포 SPEC(로드맵 8번) 출시 전 점검 목록에 "운영 `serverURL` 설정 확인"을 더한다(R9·R21과 같은 배포 의존) |

안티 패턴 (하지 말 것):

- 상태 변경 판단에 `originalDoc`이나 저장 요청에 담긴 이전 값을 쓰기
- 컬렉션 `beforeChange`의 `data.status` 유무로 상태 변경 요청을 판별하기(Payload가 항상 채워 넣음)
- 어떤 신청 수정 경로에서든(요청 사항 삭제 포함) 회차 행을 건너뛰거나 신청 행을 회차 행보다 먼저 잠그기
- 같은 상태 분기나 상태 없는 수정에서 잠긴 필드 덮어쓰기를 건너뛰기
- `req.context`에 신청 ID 키 없이 상태 변경 값을 담기
- 상태별 인원 합계를 대시보드 코드에서 따로 정의하기(상태 목록을 두 곳에 쓰기)
- 작업 기록을 작업과 다른 트랜잭션에서 남기기(상태 변경·요청 사항 삭제)
- CSV를 문자열 이어 붙이기만 하고 따옴표·수식 주입 처리를 빼먹기
- CSV 파일 이름이나 URL에 투어 이름·신청자 이름을 넣기
- 테스트에서 실제 관리자 계정으로 로그인하기
- 검증 명령을 실행하지 않고 통과로 기록하기

## §H. 상호 참조

- `spec.md` — REQ-ADMIN-001~016, 용어(§2.5), 가정(§2.4), 제외 범위
- `acceptance.md` — 오류 코드 표(§0), AC-ADMIN-001~016, 품질 게이트, 완료 정의
- `interview.md` — 사용자 결정 D1~D7과 초안 작성자 결정
- `.moai/specs/SPEC-APPLY-001/` — 정원 확인 구간(§B.1), 점유 인원(§B.2), 접근 규칙(REQ-APPLY-003), 개인정보 비노출(REQ-APPLY-015), 지적 F1·F2(`progress.md` §E.4)
- `.moai/specs/SPEC-TOUR-001/` — 단일 계산 지점, 테스트 데이터 표식
- `.moai/project/product.md` §4·§5.2·§8.1·§8.3, `structure.md` §2·§3, `tech.md` §5·§8
- 근거 소스: §A.2 표의 경로와 URL
