# SPEC-ADMIN-001 진행 기록

## §E.1 Plan-phase Audit-Ready Signal

```yaml
plan_status: audit-ready
plan_complete_at: 2026-11-12
plan_revised_at: 2026-11-16   # plan-audit 2회차(FAIL 0.82) 결함 N1~N6 반영, 문서 버전 0.1.2
plan_audit_history:
  - iteration: 1
    verdict: FAIL
    score: 0.78
    report: .moai/reports/plan-audit/SPEC-ADMIN-001-review-1.md
    resolved: [D1, D2, D3, D4, D5, D6, D7, D8, D9, D10, D11]
    d12_tier_decision: "Tier M 유지, 분할 없음 (plan.md §A.3 재추정: 제품 약 800~1,000줄, 파일 약 33개)"
  - iteration: 2
    verdict: FAIL
    score: 0.82
    report: .moai/reports/plan-audit/SPEC-ADMIN-001-review-2.md
    resolved: [N1, N2, N3, N4, N5, N6]
    n1_decision: "(a) 복원 자동 마감을 트랜잭션 연결의 원시 SQL로 — 행 잠금을 쥔 뒤 payload-locked-documents를 건드리지 않음. '순환 대기 없음'은 applications·tour_sessions 행 사이로 좁힘 (plan.md §B.2 9번·잠금 순서, R3, R26)"
    n2_decision: "(a) 회차 없는 신청의 모든 수정(상태 변경·복원·요청 사항 삭제)을 SESSION_MISSING(409)으로 거부 (plan.md §B.2 3·4번, R24, AC-ADMIN-005)"
    scope_note: "새 REQ·AC 없음 — 기존 REQ-ADMIN-005·006·008, AC-ADMIN-005·013·016만 수정"
tier: M
artifacts: [interview.md, spec.md, plan.md, acceptance.md, spec-compact.md]
req_count: 16
ac_count: 16
depends_on: [SPEC-APPLY-001]   # status: completed
base_head: a8cf60b   # 최초 계획 8a4cdd1, 사이 커밋 a8cf60b는 화면·디자인만 변경(plan.md §A.1)
author: manager-spec
needs_clarification: 0
user_confirmed_2026_11_16:   # 사용자가 기본값을 그대로 확인함(interview.md "추가 확인")
  - 취소 복원으로 정원이 꽉 차면 회차 자동 마감
  - CSV에 취소 신청 포함, 상태 열로 표시
  - 대시보드에 비공개 투어의 회차도 보이고 "비공개" 표시
  - 관리자 작업 기록 보관 2년
supersedes_clauses:
  - "SPEC-APPLY-001 REQ-APPLY-002 (등록 컬렉션 목록)"
  - "SPEC-APPLY-001 REQ-APPLY-003 중 applications 수정 거부(관리자 포함) 부분"
legal_review_required: true   # 작업 기록 보관 2년(사용자 결정) — 법정 기준 일치 여부 확인(plan.md §G R20)
pre_launch_carry_over:   # sync 단계에서 출시 전 점검 목록으로 옮김
  - "R20 작업 기록 보관 2년의 법정 접속 기록 기준 일치 확인, 2년 지난 기록 자동 삭제(배포 단계)"
  - "R23 Payload 기본 오류 기록(routeError → logError)의 질의 바인딩 값(개인정보) 처리 — 배포 SPEC(로드맵 8번)에서 로거 직렬화 또는 로그 접근 통제·보관 결정, 변호사 확인 목록과 연결"
carry_over_followups:   # 이 SPEC 범위 밖 — 후속 SPEC 후보
  - "F1 해결 때: 회차 없는 신청의 요청 사항(민감정보) 삭제 — 이 SPEC은 그 신청의 모든 수정을 SESSION_MISSING으로 거부만 함(session 필드 required 검증 때문에 저장 불가, plan.md §A.2·R24)"
  - "SPEC-APPLY-001 사이트 접수 자동 마감(submit-application.ts의 중첩 payload.update(tour-sessions))이 회차 행을 쥔 채 payload-locked-documents 행을 지움 → 관리자 화면의 회차 저장과 교착(40P01) 가능. 원시 SQL 마감으로 바꾸는 후속 작업 (plan.md §G R26 ②)"
```

## §E.2 Run-phase Evidence

긴 출력은 `.moai/state/verify/a08890a8/`(gitignore 대상) 아래 파일로 남겼다. 실행 위치는 격리 작업 트리(브랜치 `worktree-agent-aa7a9b1b0d14eff8b`, 기준 HEAD `30d5515`), 셸은 Git Bash, DB는 main 체크아웃과 같은 PostgreSQL 컨테이너다.

### 사전 점검 기준선 (plan.md §C, HEAD `30d5515`)

| 명령 | 종료 코드 | 결과 | 로그 |
|---|---|---|---|
| `git diff --stat a8cf60b -- src/collections src/lib tests pnpm-lock.yaml` | 0 | 출력 없음(범위 파일 변경 없음) | — |
| `git status --short` | 0 | 출력 없음(`importMap.js`의 `M` 표시도 이 작업 트리에는 없음) | — |
| `docker compose ps --format '{{.Service}} {{.Health}}'` | 0 | `postgres healthy` | — |
| `pnpm install --frozen-lockfile` | 0 | `Done in 20.5s using pnpm v11.28.9` | — |
| `pnpm test` | 0 | `Test Files 31 passed (31)`, `Tests 521 passed (521)`, 라인 커버리지 98.99% | `baseline-test.log` |
| `pnpm e2e` | 0 | `41 passed (50.4s)` | `baseline-e2e.log` |
| `pnpm lint` | 0 | 출력 없음 | `baseline-lint.log` |
| `pnpm format:check` | 0 | `All matched files use Prettier code style!` | `baseline-format.log` |
| `pnpm typecheck` | 0 | 출력 없음 | `baseline-typecheck.log` |

- OWASP CSV Injection 문서 재확인(plan.md §C): **미실행** — M1 실행 에이전트에 웹 조회 도구가 없었다. CSV를 다루는 M4 시작 전에 확인해 여기에 적는다(Gap).

### M1 — 접근 규칙과 데이터 모델

RED(구현 전, `pnpm exec vitest run tests/unit/repo-rules.spec.ts tests/integration/users-auth.spec.ts tests/integration/application-access.spec.ts tests/integration/admin-audit.spec.ts --coverage.enabled=false`, 종료 코드 1, `m1-red.log`):

```
 FAIL  |integration| tests/integration/admin-audit.spec.ts [ tests/integration/admin-audit.spec.ts ]
Error: Cannot find module '../../src/lib/admin-audit' imported from .../tests/integration/admin-audit.spec.ts
 FAIL  |unit| tests/unit/repo-rules.spec.ts > AC-ADMIN-002 신청 필드의 수정 잠금 > applications의 이름 있는 필드 중 access.update가 없는 필드는 정확히 status 하나다
AssertionError: expected [ 'session', 'name', 'email', …(10) ] to include 'requestsDeletedAt'
 FAIL  |unit| tests/unit/repo-rules.spec.ts > AC-ADMIN-002 신청 필드의 수정 잠금 > applications는 일괄 수정을 막는다(disableBulkEdit)
AssertionError: expected undefined to be true // Object.is equality
 FAIL  |integration| tests/integration/application-access.spec.ts > … > 관리자가 신청 한 건의 상태를 확정으로 바꾸면 오류 없이 끝나고 다시 읽은 상태가 확정이다
Forbidden: You are not allowed to perform this action.
 FAIL  |integration| tests/integration/application-access.spec.ts > … > 상태와 함께 보낸 다른 필드 열 개는 오류 없이 버려지고 상태만 바뀐다
Forbidden: You are not allowed to perform this action.
 FAIL  |integration| tests/integration/application-access.spec.ts > … > 관리자의 일괄 수정은 bulk edit 거부 오류로 끝나고 상태가 그대로다
AssertionError: expected [Function] to throw error including 'has disabled bulk edit' but got 'You are not allowed to perform this a…'
 FAIL  |integration| tests/integration/users-auth.spec.ts > … > 등록된 컬렉션에서 … admin-audit-logs뿐이다
AssertionError: expected [ 'application-attempts', …(5) ] to deeply equal [ 'admin-audit-logs', …(6) ]
 Test Files  4 failed (4)
      Tests  6 failed | 75 passed (81)
```

GREEN(같은 명령, 종료 코드 0, `m1-green.log`): `Test Files 4 passed (4)`, `Tests 88 passed (88)`.

M1 완료 검증(HEAD `30d5515` + M1 작업 트리 변경):

| 명령 | 종료 코드 | 결과 | 로그 |
|---|---|---|---|
| `pnpm generate:types` | 0 | `Types written to …\src\payload-types.ts` (`AdminAuditLog` 인터페이스, `Application.requestsDeletedAt` 추가) | `m1-gentypes.log` |
| `pnpm test` | 0 | `Test Files 32 passed (32)`, `Tests 534 passed (534)` (기준 521 → +13), 라인 커버리지 99%(398/402), `src/lib/admin-audit.ts` 라인 100%(3/3) | `m1-test.log` |
| `pnpm e2e` | 0 | `43 passed (1.3m)` (기준 41 → +2) | `m1-e2e.log` |
| `pnpm lint` | 0 | 출력 없음 | `m1-lint.log` |
| `pnpm format:check` | 0 | `All matched files use Prettier code style!` | `m1-format.log` |
| `pnpm typecheck` | 0 | 출력 없음 | `m1-typecheck.log` |
| `git diff --stat a8cf60b -- pnpm-lock.yaml .prettierignore eslint.config.mjs pnpm-workspace.yaml src/lib/submit-application.ts src/lib/occupancy.ts src/collections/TourSessions.ts` | 0 | 출력 없음(보존 파일 불변) | — |

AC 상태(M1 범위):

| AC | 상태 | 근거 |
|---|---|---|
| AC-ADMIN-001 | PASS | `tests/integration/users-auth.spec.ts` 등록 컬렉션 7개 단언(필터 전 목록이 더 김을 먼저 단언), 기존 인증 흐름 테스트 통과 — `pnpm test` 534 통과 |
| AC-ADMIN-002 (통합 부분) | PASS | `tests/integration/application-access.spec.ts`: 관리자 단건 상태 확정, 상태 + 다른 필드 열 개 전송 시 열 개 필드별 불변, 익명 수정 `Forbidden`, 관리자 일괄 수정 `has disabled bulk edit`, 익명·관리자 생성·삭제 `Forbidden`. 저장소 규칙(`tests/unit/repo-rules.spec.ts`): `access.update` 없는 이름 있는 필드 = `['status']`, `disableBulkEdit === true` |
| AC-ADMIN-002 (E2E 부분) | 일부 PASS | `tests/e2e/application-api.spec.ts`: 관리자 `PATCH {"status":"confirmed"}` 200 → 다시 읽은 상태 확정, 관리자 `PATCH {"name":…}` 200 → 이름 불변, 익명 `PATCH` 403, 관리자 일괄 `PATCH ?where[id][equals]=` 403, 익명·관리자 `POST`·`DELETE` 403. **남은 부분**: GraphQL `updateApplication`(M3) |
| AC-ADMIN-015 (통합 접근 부분) | PASS | `tests/integration/admin-audit.spec.ts`: 익명·관리자 생성·수정·삭제 `Forbidden`이고 호출 전후 문서 같음(대상 1건 이상 먼저 단언), 관리자 일괄 수정 거부, 익명 조회 `Forbidden`, 관리자 조회에 준비한 기록 있음, 개인정보 필드 없음·모든 필드 `access.update` 함수·`disableBulkEdit`·메뉴에 보임. `recordAdminAction`: 관리자 req → `actorId` = 관리자 ID, 관리자 아닌 req → `actorId` 비움 |
| AC-ADMIN-015 (E2E·수동·개인정보 부분) | 미검증(M3·M6 범위) | 작업 기록 REST 403 E2E, 관리자 화면 확인(수동), 로그 개인정보 비노출 |

AC-ADMIN-016 작업 기록 고아 검사 기준값(M1 직후, `admin_audit_logs` 테이블 생성 뒤 — `pnpm test`·`pnpm e2e` 실행 후 같은 값, 같은 SQL을 Node `pg` 클라이언트로 실행, `.env` 값은 출력하지 않음):

```
audit_orphans=0
audit_total=0
applications_example_test=1
tours_test_slug=0
users_example_test=0
```

- `applications_example_test=1`은 테스트 잔여가 아니라 개발 DB의 기존 신청 `SB-4KJFS-26FAM`(id 2033, 2026-11-12 생성)이다. 사용자 지시로 건드리지 않는다. AC-ADMIN-016의 "0" 판정은 이 행을 기준값 1로 보고 증가 여부로 한다(sync 단계 확인 항목).

M1 구현 메모:

- 생성: `src/collections/AdminAuditLogs.ts`, `src/lib/admin-audit.ts`(`recordAdminAction`, `ADMIN_AUDIT_ACTIONS`), `tests/integration/admin-audit.spec.ts`
- 수정: `src/collections/Applications.ts`(`update: adminSingleDocOnly`, `disableBulkEdit`, status 외 모든 필드 `lockedField`, `requestsDeletedAt` 필드, `APPLICATION_STATUS_OPTIONS` 내보냄), `src/lib/access.ts`(`adminSingleDocOnly`, `lockedField`), `src/payload.config.ts`(등록), `src/payload-types.ts`(생성), 테스트 4개·정리 도우미 2개(회차 삭제 전 작업 기록 삭제)
- 중간 상태(M2 전까지): 관리자 상태 변경이 열렸지만 잠금·정원 확인·`cancelledAt` 처리·작업 기록 연결은 아직 없다(M2 범위). 이 상태로 배포하지 않는다.
- `tests/e2e/application-api.spec.ts`의 관리자 `PATCH` 403 단언은 plan.md에서 M3 항목이지만, M1이 수정 규칙을 열면서 그 단언이 깨지므로 M1에서 새 규칙으로 바꿨다(같은 SPEC 범위의 연쇄 수정).
- 공유 개발 DB 스키마: 통합 테스트의 개발 모드 스키마 반영으로 `admin_audit_logs` 테이블과 `applications.requests_deleted_at` 열이 공유 DB에 생겼다. 이 변경이 없는 main 체크아웃에서 개발 서버를 띄우면 Payload가 이 테이블·열을 지우는 스키마 반영을 제안할 수 있다(확인 질문). 데이터가 없는 상태라 손실은 없지만 사용자 확인이 필요하다.

plan-audit 3회차 선택 지적 처리:

- O1(REQ-ADMIN-002에 "회차 없는 신청은 REQ-ADMIN-005에 따라 거부" 교차 참조 추가): `spec.md` 본문 수정이라 run 단계(manager-develop)가 고칠 수 없다. **manager-spec에 넘김** — 다음 plan 문서 갱신 때 한 구절을 더한다. 동작은 REQ-ADMIN-005·AC-ADMIN-005가 이미 정하므로 구현에는 영향 없음.
- O2(AC-ADMIN-006 전제 단언)·O3(plan §B.2 3단계 한 구절): M2 범위. O3도 `plan.md` 본문이라 manager-spec 몫이다.

### M2 — 상태 변경 규칙과 동시성

실행 위치: 격리 작업 트리(기준 HEAD `6f6020c` = M1 병합), 셸 Git Bash, DB는 같은 공유 PostgreSQL. 로그는 `.moai/state/verify/m2/`(gitignore 대상).

RED(구현 전, `pnpm exec vitest run tests/integration/application-status.spec.ts tests/integration/application-status-concurrency.spec.ts --coverage.enabled=false`, 종료 코드 1, `m2-red.log`):

```
     × AC-ADMIN-004: 전환표대로 상태와 취소일이 바뀌고, 상태가 바뀐 4번만 작업 기록이 남는다
       × 정원을 넘는 복원은 409 RESTORE_CAPACITY_EXCEEDED이고 아무것도 바뀌지 않으며, 자리가 생기면 복원된다(S5)
       × 정원을 정확히 채우는 복원은 같은 저장에서 회차를 마감한다(S4)
         × 복원·취소·같은 상태 저장·상태 없는 수정이 모두 409 SESSION_MISSING이고 아무것도 바뀌지 않는다
     × AC-ADMIN-006 결정적 사례: 사이트 접수가 회차 행을 쥔 동안 복원은 잠금을 기다리고, 풀린 뒤 정원 초과로 거부된다
     × AC-ADMIN-008(상태 없는 수정): 잠금 전에 읽힌 문서로 진행된 이름 수정이 잠금 뒤 상태·요청 사항·취소일을 되돌리지 않는다
AssertionError: expected 0 to be greater than or equal to 1        (결정적 사례 — 잠금 대기 세션 없음)
AssertionError: expected 'open' to be 'closed' // Object.is equality (정확히 채우는 복원 — 마감 없음)
AssertionError: expected NaN to be greater than or equal to 1794811723856 (취소일 없음)
AssertionError: expected 400 to be 409 // Object.is equality       (회차 없는 신청 — Payload ValidationError)
AssertionError: expected [] to have a length of 1 but got +0       (작업 기록 없음)
 Test Files  2 failed (2)
      Tests  16 failed | 2 passed (18)
```

GREEN(같은 명령, 종료 코드 0, `m2-green.log`): `Test Files 2 passed (2)`, `Tests 18 passed (18)`.

M2 완료 검증(HEAD `6f6020c` + M2 작업 트리 변경, 아래 순서대로 실행):

| 명령 | 종료 코드 | 결과 | 로그 |
|---|---|---|---|
| `pnpm test` | 0 | `Test Files 34 passed (34)`, `Tests 552 passed (552)` (M1 534 → +18), 라인 커버리지 99.19%(492/496), `src/lib/application-status.ts` 라인 100% | `m2-test-final.log` |
| `pnpm e2e` | 0 | `43 passed (1.1m)` (M1과 같음) | `m2-e2e-final.log` |
| `pnpm lint` | 0 | 출력 없음 | `m2-lint-final.log` |
| `pnpm typecheck` | 0 | 출력 없음 | `m2-typecheck-final.log` |
| `pnpm format:check` | 0 | `All matched files use Prettier code style!` | `m2-format-final.log` |
| `git diff --stat a8cf60b -- pnpm-lock.yaml .prettierignore eslint.config.mjs pnpm-workspace.yaml src/lib/submit-application.ts src/lib/occupancy.ts src/collections/TourSessions.ts` | 0 | 출력 없음(보존 파일 불변) | — |

AC 상태(M2 범위):

| AC | 상태 | 근거 |
|---|---|---|
| AC-ADMIN-004 | PASS | `application-status.spec.ts`: 대기→확정→취소→취소(같은 값)→대기→확정. 단계별 상태·`cancelledAt`(t0~t1 사이, 같은 값 저장 시 그대로, 복원 시 비움)·점유 인원 2/0/2, 작업 기록 정확히 4건(순서·`action`·`actorId`·`applicationId`·`referenceCode`·`sessionId`) |
| AC-ADMIN-005 (통합 부분) | PASS | S5 초과 거부 409 `RESTORE_CAPACITY_EXCEEDED:`·상태·취소일·회차 그대로·기록 0건 → X 취소 뒤 Y 확정 성공(점유 3, `open`), S4 정확히 채움 → `closed`, U6 마감 회차 복원 성공·`closed` 그대로, V3 초과 409. 회차 없는 신청 O·O2: 복원·취소·같은 상태 저장·이름 수정 모두 409 `SESSION_MISSING:`, `cause` 없음, 값·기록 불변 |
| AC-ADMIN-005 (O2 요청 사항 삭제·REST·화면) | 미검증(M3 범위) | 요청 사항 삭제 함수, REST `PATCH` 409, 관리자 화면 알림 |
| AC-ADMIN-006 (사이트 접수·상태 변경 부분) | PASS | `application-status-concurrency.spec.ts`: 결정적 사례(주입 지점에서 멈춘 사이트 접수 → 복원이 `FOR UPDATE` 대기 1개 이상 확인 → 풀어 줌 → 접수 성공, 복원 409 `RESTORE_CAPACITY_EXCEEDED:`, 점유 2, C 취소 그대로, 기록 0건), 병렬 3회(합 ≤ 4, 점유 = 합, 합 4면 `closed`, 실패 코드 제한), 잠금 대기 초과(409 `SESSION_BUSY:`, 7초 안, `cause` 없음, 값·기록 불변) |
| AC-ADMIN-006 (요청 사항 삭제 ↔ 상태 변경, REST 409) | 미검증(M3 범위) | 요청 사항 삭제 함수가 M3에서 생긴다 |
| AC-ADMIN-007 | PASS | 정원 2에 사이트 접수 인원 1 두 번 → `closed`, 관리자 취소 성공 뒤 `closed` 그대로, `getApplySession` 사유 `closed`, 이어진 접수 `SESSION_CLOSED` |
| AC-ADMIN-008 (상태 없는 수정 — 삭제와 무관한 부분) | PASS | 결정적 사례: 회차 행을 쥔 트랜잭션이 있는 동안 이름 수정이 잠금 전 문서를 읽고 대기 → 그 트랜잭션이 같은 순서로 상태 `cancelled`·취소일·요청 사항 `NULL`·삭제 일시를 바꿔 커밋 → 이름 수정은 오류 없이 끝나고 이름·상태·요청 사항·취소일·삭제 일시 모두 잠금 뒤 값 유지, 기록 0건 |
| AC-ADMIN-014 | PASS | 사용자 없는 로컬 API 상태 변경 → 기록 1건 `actorId` 비어 있음. 기록 생성 1회 실패 → 취소 되돌림(상태·취소일 그대로, 기록 0건, 오류 `cause` 없음·원인 문구 없음), 정확히 채우는 복원 되돌림(회차 `open`, 점유 2). 이 파일의 기록 전체 `JSON.stringify`에 표식·연락처·`@example.test` 없음(기록 4건 이상 먼저 단언), 기록 컬렉션 필드에 `name`·`email`·`phone`·`requests` 없음 |

plan-audit O2 처리: 동시성 시험 파일의 모든 대상 신청에 대해 "그 신청을 가리키는 `payload_locked_documents_rels` 행이 0"을 만든 직후 단언한다(`lockedDocumentRows`). 요청 사항 삭제 ↔ 상태 변경 사례의 K는 M3에서 같은 도우미로 단언한다.

추가 사례(plan §B.2 4번·O3): 회차 행을 쥔 트랜잭션이 기다리는 상태 변경 대상 신청의 회차를 다른 회차로 바꿔 커밋하면 상태 변경은 409 `SESSION_MISSING:`이고 값·기록 불변. 회차 `FOR UPDATE`가 0행이면 같은 `SESSION_MISSING`으로 끝낸다(코드 주석).

변이 확인(plan.md §E-1 7번, AC-ADMIN-006):

- 변이: `src/lib/application-status.ts` 회차 행 질의에서 `FOR UPDATE`를 뺌 → `pnpm exec vitest run tests/integration/application-status-concurrency.spec.ts --coverage.enabled=false` 1회차에 종료 코드 1(`m2-mutation-lock.log`):
  ```
  × AC-ADMIN-006 결정적 사례: … 3102ms
  AssertionError: expected 0 to be greater than or equal to 1      (잠금 대기 세션 0개)
  AssertionError: expected 6 to be less than or equal to 4        (병렬 사례 — 정원 초과)
  Tests  7 failed (7)
  ```
- 되돌린 뒤 같은 명령: 종료 코드 0, `Tests 7 passed (7)`(`m2-mutation-restored.log`).

보조 변이(M2 범위의 상태 없는 수정 사례, plan.md §E-1 8번의 축소판 — 요청 사항 삭제 되살림 사례 2개는 M3에서 다시 한다):

- 변이: §B.2 5번 덮어쓰기를 "상태 변경 요청이면서 상태가 바뀌는 분기"로만 좁히고 상태 없는 수정의 `data.status = previous`를 뺌 → `pnpm exec vitest run tests/integration/application-status-concurrency.spec.ts -t AC-ADMIN-008 --coverage.enabled=false` 1회차에 종료 코드 1(`m2-mutation-overwrite.log`): `AssertionError: expected 'pending' to be 'cancelled'`(잠금 전 상태로 되돌아감)
- 되돌린 뒤 위 전체 파일 실행으로 통과 확인(`m2-mutation-restored.log`).

데이터 정리(`pnpm test`·`pnpm e2e` 뒤, Node `pg`로 AC-ADMIN-016 SQL 실행, `.env` 값 출력 없음):

```
audit_orphans=0  audit_total=0  applications_example_test=1  tours_test_slug=0  users_example_test=0
```

- `applications_example_test=1`은 M1 기준값과 같은 개발 신청 `SB-4KJFS-26FAM`(id 2033)이다.
- 연쇄 수정: M2가 상태 변경마다 작업 기록을 남기게 되면서 `tests/integration/application-access.spec.ts`(M1)의 관리자 상태 변경이 고아 기록 2건을 남겼다(첫 전체 실행 두 번에서 4건 관찰). 그 파일의 정리에 "회차 삭제 전 작업 기록 삭제" 단계를 더했고, 이 작업에서 생긴 고아 기록 4건(id 41·42·95·96, 모두 테스트 관리자의 상태 변경)을 지운 뒤 위 0을 확인했다.

M2 구현 메모:

- 생성: `src/lib/application-status.ts`(`markStatusRequest`·`lockApplicationForUpdate`·`recordStatusChange`, `@MX:WARN` + `@MX:REASON`), `src/lib/admin-messages.ts`(상태 변경 오류 문구), `tests/helpers/admin-fixtures.ts`, `tests/integration/application-status.spec.ts`, `tests/integration/application-status-concurrency.spec.ts`
- 수정: `src/collections/Applications.ts`(훅 연결), `tests/integration/application-access.spec.ts`(정리 단계)
- 오류 객체: Payload `APIError`는 `data`(기본 `null`)를 Error `cause`로 넣으므로, 이 SPEC의 오류 클래스가 생성자에서 `cause` 속성을 지운다(AC-ADMIN-015 "cause 속성 없음").
- 시각 값: 잠금 뒤 읽기는 `round(extract(epoch …) * 1000)::float8`로 밀리초를 받아 ISO 문자열로 바꾼다(pg 형식 해석기에 기대지 않음).
- 남은 M2 계획 항목 중 요청 사항 삭제 표시 분기(§B.2 6번)는 계획대로 M3.

**계획 전제와 다른 점(manager-spec 확인 필요)**: 실제 DB의 `applications.session_id`는 `NOT NULL`이다(`information_schema.columns.is_nullable = 'NO'`, 외래 키는 `ON DELETE SET NULL`). 따라서 SPEC-APPLY-001 F1 경합에서 회차를 지우면 신청의 회차가 비는 것이 아니라 삭제가 NOT NULL 위반(23502)으로 실패할 것으로 보이며, "회차 없는 신청"은 지금 스키마에서 커밋될 수 없다. AC-ADMIN-005의 "원시 SQL로 `session_id`를 `NULL`로 바꾼다"도 그대로는 실행되지 않으므로, 시험은 테스트 트랜잭션 안에서만 `ALTER TABLE applications ALTER COLUMN session_id DROP NOT NULL` → `UPDATE … SET session_id = NULL` → 같은 트랜잭션의 `req`로 수정 시도 → 되돌림으로 재현한다(`lock_timeout` 3초, 시험 뒤 `is_nullable = 'NO'` 그대로 확인). `SESSION_MISSING` 분기는 방어 코드로 유지한다. `spec.md` §2.5·§5, `plan.md` §A.2·§B.2 3번·R24, `acceptance.md` AC-ADMIN-005의 문구와 F1 이월 항목의 설명을 이 사실에 맞게 고칠지 manager-spec이 판단할 일이다(run 단계는 본문을 고치지 않는다).

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_

## plan-audit 3회차 결과 (2026-11-16)

PASS 0.99 (0.78 → 0.82 → 0.99). 반드시 고칠 항목 없음. 선택 지적 3건은 run 단계에서 반영한다.

- O1: REQ-ADMIN-002에 "회차 없는 신청은 REQ-ADMIN-005에 따라 거부" 교차 참조 한 구절 추가
- O2: AC-ADMIN-006 동시성 사례의 전제(K의 `payload_locked_documents` 행 없음)를 테스트가 단언
- O3: plan §B.2 3단계에 회차 `FOR UPDATE`가 0행이면 4단계 재조회에서 `SESSION_MISSING`으로 끝난다는 한 구절 추가
