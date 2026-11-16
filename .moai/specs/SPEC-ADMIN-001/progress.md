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

### M3 — 관리자 상세 화면과 요청 사항 삭제

실행 위치: 격리 작업 트리(기준 HEAD `5482520` = M2 병합), 셸 Git Bash, DB는 같은 공유 PostgreSQL. 로그·스크린숏은 `.moai/state/verify/admin-m3/`(gitignore 대상). `moai-domain-frontend` 스킬은 이 환경에 없어 불러오지 못했다(Payload `@payloadcms/ui` 3.93.0 설치본을 직접 읽어 구성 요소를 정함).

RED 1 — 통합(처리 함수 자리표시만 둔 상태, `pnpm exec vitest run tests/integration/clear-requests.spec.ts --coverage.enabled=false`, 종료 코드 1, `m3-red.log`):

```
       × 익명 FORBIDDEN, 없는 ID·형식 오류 NOT_FOUND, 빈 요청 사항 REQUESTS_EMPTY — 아무것도 바뀌지 않고 기록도 없다
       × 관리자 삭제는 cleared이고 요청 사항만 비우며 삭제 일시를 남긴다. 두 번째는 REQUESTS_EMPTY이고 아무것도 바뀌지 않는다
       × 원자성: 작업 기록 생성이 실패하면 INTERNAL_ERROR이고 요청 사항·삭제 일시가 그대로다
       × 잠금 대기 초과: 회차 행이 잡혀 있으면 7초 안에 SESSION_BUSY이고 아무것도 바뀌지 않는다
       × 같은 상태 저장이 삭제 전 문서로 진행돼도 요청 사항이 되살아나지 않는다(G) 60014ms
       × 상태 없는 수정(이름)이 삭제 전 문서로 진행돼도 요청 사항이 되살아나지 않고 이름·상태가 그대로다(H) 60012ms
     × AC-ADMIN-005: 회차 없는 신청의 요청 사항 삭제는 SESSION_MISSING이고 아무것도 바뀌지 않으며 기록이 없다(O2)
       × 결정적 사례: 회차 행이 잡힌 동안 둘 다 잠금을 기다리고, 풀리면 교착 없이 둘 다 성공한다(K)
         × 취소와 요청 사항 삭제를 함께 시작하면 … (반복 1·2·3)
Error: Not implemented.
Error: Test timed out in 60000ms.
 Test Files  1 failed (1)
      Tests  11 failed | 1 passed (12)
```

(G·H의 60초 시간 초과는 자리표시가 주입 지점에 닿기 전에 던졌기 때문이다. 이후 시험이 "삭제가 주입 지점 전에 끝나면 바로 실패"하도록 고쳤다. 통과한 1건은 "관리자 일반 수정으로는 글이 안 바뀜" — M1·M2 동작이다.)

GREEN 1 — 같은 명령, 종료 코드 0(`m3-green-1.log`): `Tests 12 passed (12)`.

RED 2 — 저장소 규칙(`type: 'ui'` 필드를 더한 뒤): `AssertionError: expected [ 'clearRequests', 'status' ] to deeply equal [ 'status' ]`. 규칙 테스트를 "이름 있는 **데이터** 필드"로 좁히고 화면 전용 필드가 정확히 `clearRequests` 하나임을 함께 단언했다(값을 저장하지 않아 수정 잠금 대상이 아님). 재실행 `Tests 2 passed`.

RED 3 — E2E(엔드포인트·화면 필드 등록을 잠시 뺀 코드, `pnpm exec playwright test tests/e2e/admin-ops.spec.ts`, 종료 코드 1, `m3-e2e-red.log`):

```
  x   4 … 요청 사항 삭제 API(AC-ADMIN-008) › 익명 403 FORBIDDEN, 관리자 200 cleared, …
    Error: expect(received).toBe(expected) // Object.is equality
    Expected: 403
    Received: 404
  x   9 … 관리자 신청 화면 › 요청 사항 삭제: 확인 단계에서 취소하면 그대로, …
    Error: expect(locator).toBeVisible() failed
    Error: element(s) not found
  2 failed
  8 passed (1.3m)
```

(통과한 8건은 M1·M2가 이미 만든 동작 — GraphQL 수정, REST 409 두 종류, 작업 기록 403, 상세·목록 화면, 정원 초과 알림, 요청 사항 없는 신청의 버튼 없음 — 을 처음 E2E로 확인한 것이다.) 등록을 되돌린 뒤 같은 명령: 종료 코드 0, `10 passed (45.4s)`(`m3-e2e-green.log`).

M3 완료 검증(HEAD `5482520` + M3 작업 트리 변경, 아래 순서대로 실행):

| 명령 | 종료 코드 | 결과 | 로그 |
|---|---|---|---|
| `pnpm generate:importmap` | 0 | `importMap.js`에 `/components/admin/ClearRequestsField#ClearRequestsField` 추가 | `m3-importmap.log` |
| `pnpm generate:types` | 0 | `payload-types.ts` 변경 없음(`ui` 필드는 타입을 만들지 않음) | `m3-gentypes.log` |
| `pnpm lint` | 0 | 출력 없음(`eslint src tests scripts …`) | `m3-lint.log` |
| `pnpm typecheck` | 0 | 출력 없음(`tsc --noEmit`) | `m3-typecheck.log` |
| `pnpm format:check` | 0 | `All matched files use Prettier code style!` | `m3-format.log` |
| `pnpm test` | 0 | `Test Files 35 passed (35)`, `Tests 565 passed (565)` (M2 552 → +13), 라인 커버리지 99.27%, `src/lib/clear-requests.ts` 라인 100%·분기 85.36% | `m3-test-final.log` |
| `pnpm build` | 0 | 경로 목록 출력, 오류 없음 | `m3-build.log` |
| `pnpm e2e` | 0 | `53 passed (54.1s)` (M2 43 → +10) | `m3-e2e-final.log` |
| `pnpm generate:types` · `pnpm generate:importmap` 재실행 뒤 `git status --short` | 0 | 생성 파일 추가 변경 없음 | `m3-gentypes-final.log`, `m3-importmap-final.log` |
| `git diff --stat a8cf60b -- pnpm-lock.yaml .prettierignore eslint.config.mjs pnpm-workspace.yaml src/lib/submit-application.ts src/lib/occupancy.ts src/collections/TourSessions.ts` | 0 | 출력 없음(보존 파일 불변) | — |

AC 상태(M3 범위):

| AC | 상태 | 근거 |
|---|---|---|
| AC-ADMIN-002 (E2E GraphQL) | PASS | `tests/e2e/admin-ops.spec.ts`: 익명 `updateApplication` → `errors`에 `You are not allowed to perform this action.`, 상태 `pending` 그대로. 관리자 → 200, `errors` 없음, 돌려받은 상태 `confirmed`, 로컬 API로도 `confirmed`. AC-ADMIN-002 전체가 이제 통과(M1 REST 부분 + 이번 GraphQL) |
| AC-ADMIN-003 (E2E) | PASS | 상세: 이름·이메일·연락처·인원·접수 번호 `not.toBeEditable`, 상태 선택지 정확히 `대기`·`확정`·`취소`, `확정` 저장 → 성공 알림, 로컬 API `confirmed`, `/apply/complete/<접수 번호>`의 `상태` `dd` 텍스트가 정확히 `확정`이고 페이지에 `대기 — 관리자 확인 후 확정` 없음. 목록: `Create New` 링크 0개, 행 선택 상자 선택 뒤 `Edit`·`Delete` 버튼 0개 |
| AC-ADMIN-003 (수동) | 미검증 — 사람 확인 필요 | 사용자가 관리자 화면에서 직접 확인할 항목 |
| AC-ADMIN-005 (O2 요청 사항 삭제) | PASS | `clear-requests.spec.ts`: 테스트 트랜잭션 안에서 `ALTER … DROP NOT NULL` → `session_id = NULL` → 같은 트랜잭션의 req로 삭제 → `{ status: 'error', code: 'SESSION_MISSING' }`, 되돌린 뒤 요청 사항 `<표식>-고아` 그대로, `requestsDeletedAt` 비어 있음, 회차 관계 원래 값, 기록 0건. 시험 뒤 `is_nullable = NO` 그대로(아래 정리 점검) |
| AC-ADMIN-005 (REST 409·화면 알림) | PASS | REST: 관리자 `PATCH {"status":"pending"}`(정원 3, 대기 2 + 취소 2) → 정확히 409, `errors[0].message`가 `RESTORE_CAPACITY_EXCEEDED:`로 시작, 신청 `cancelled` 그대로. 화면: `대기` 선택 후 저장 → 오류 알림(`[data-sonner-toast][data-type="error"]`)에 `RESTORE_CAPACITY_EXCEEDED`, 신청 `cancelled` 그대로 |
| AC-ADMIN-006 (요청 사항 삭제 ↔ 상태 변경) | PASS | 결정적 사례 K: 테스트 트랜잭션이 회차 행을 쥔 채 취소 저장 시작 → 잠금 대기 1개 이상 → 삭제 시작 → 잠금 대기 2개 이상 → 되돌려 풀어 줌 → 취소 오류 없음, 삭제 `cleared`, 최종 `cancelled`·취소일 있음·요청 사항 비어 있음·삭제 일시 있음, 기록 `status_change`(`confirmed`→`cancelled`) 1건 + `requests_delete` 1건. 병렬 3회 모두 같은 결과(`SESSION_BUSY`·`40P01` 없음). 전제(O2): 만든 직후 K를 가리키는 `payload_locked_documents_rels` 행 0(`lockedDocumentRows`) |
| AC-ADMIN-006 (REST 409) | PASS | E2E가 `payload.db.pool.connect()` 연결로 `BEGIN` → 회차 행 `FOR UPDATE` → 관리자 `PATCH {"status":"pending"}` → 정확히 409, `SESSION_BUSY:`, 7초 안(약 5.0초), 신청 `cancelled` 그대로 → `ROLLBACK`·연결 반환 |
| AC-ADMIN-008 (통합) | PASS | 익명 `FORBIDDEN`(요청 사항 그대로), 없는 ID `2147483000`·`abc`·`0`·`-1`·`2147483648`·`1.5`·빈 값 → `NOT_FOUND`, 빈 요청 사항 → `REQUESTS_EMPTY`, 세 경우 기록 0건. 관리자 삭제(고정 `now`) → `cleared`, 요청 사항 비어 있음, `requestsDeletedAt = now`, 동의 일시·이름·이메일·연락처·인원·상태·접수 번호 불변, 기록 1건(`application.requests_delete`, 관리자 ID, 신청·접수 번호·회차). 두 번째 → `REQUESTS_EMPTY`, 삭제 일시·기록 수 불변. 원자성(기록 생성 1회 실패) → `INTERNAL_ERROR`, 요청 사항·삭제 일시 그대로. 관리자 일반 수정 `requests: '바뀐 글'` → 오류 없음, 글 그대로. 잠금 대기 초과 → `SESSION_BUSY`, 7초 안, 값·기록 불변. 되살림 G(같은 상태 저장)·H(이름 수정): 삭제를 `beforeCommit`에서 멈춘 채 저장 시작 → 잠금 대기 1개 이상 → 풀어 줌 → 삭제 `cleared`, 저장 오류 없음, 요청 사항 비어 있음, 삭제 일시 = `now`, G 상태 `pending`·기록은 `requests_delete` 1건뿐, H 이름·상태 원래 값. 엔드포인트 처리 함수: 익명 403 `{"code":"FORBIDDEN"}`, `abc` 404, 관리자 200 `cleared`(본문에 표식 없음, `Cache-Control`에 `no-store`), 두 번째 409 `{"code":"REQUESTS_EMPTY"}` |
| AC-ADMIN-008 (E2E) | PASS | 익명 `POST …/clear-requests` → 403 `FORBIDDEN`, 요청 사항 그대로. 관리자 → 200 `cleared`, 본문에 표식 없음. 두 번째 → 409 `REQUESTS_EMPTY`. `2147483000`·`abc` → 404 `NOT_FOUND` |
| AC-ADMIN-008 (변이 확인) | PASS | 아래 "변이 확인" |
| AC-ADMIN-009 | PASS | 요청 사항 입력란 `not.toBeEditable`, `요청 사항 삭제` 버튼 보임 → 누르면 확인 대화 상자(Payload `ConfirmationModal`) → `취소` → 요청 사항 그대로 → 다시 눌러 `삭제` → 버튼 사라짐, 로컬 API 요청 사항 비어 있음 → 상세 다시 열면 요청 사항 입력란 값 `''`, `요청 사항 삭제 일시` 입력란 값 있음, 버튼 없음, 페이지 HTML에 `<표식>-민감` 없음. 요청 사항 없는 신청 상세에는 버튼 없음 |
| AC-ADMIN-015 (E2E 작업 기록 REST) | PASS | 익명·관리자 `POST`·`PATCH`·`DELETE /api/admin-audit-logs…` 각각 정확히 403, `PATCH` 뒤 값 불변, 익명 `GET` 403 또는 빈 `docs` |
| AC-ADMIN-015 (관리자 화면 작업 기록 목록·상세 E2E, 수동, 로그 개인정보) | 미검증(M6 범위) | — |

스크린숏(테스트 관리자 로그인, E2E가 찍음, gitignore 대상):

- `.moai/state/verify/admin-m3/admin-detail-status-editable.png` — 상세: 다른 필드는 회색 읽기 전용, 상태 입력란만 편집 가능(`확정` 선택 상태)
- `.moai/state/verify/admin-m3/admin-detail-clear-button.png` — 요청 사항 아래 `요청 사항 삭제` 버튼
- `.moai/state/verify/admin-m3/admin-detail-clear-confirm.png` — 확인 대화 상자(`요청 사항을 삭제할까요?`, `취소`·`삭제`)
- `.moai/state/verify/admin-m3/admin-detail-after-clear.png` — 삭제 뒤: 요청 사항 비어 있음, 삭제 일시 표시, 버튼 없음

변이 확인(plan.md §E-1 8번, AC-ADMIN-008):

- 변이: `src/lib/application-status.ts` §B.2 5번 덮어쓰기(`data.requests`·`data.requestsDeletedAt`·`data.cancelledAt`)를 `state.statusRequested === true && data.status !== previous`(상태가 바뀌는 분기)일 때만 하도록 좁힘 → `pnpm exec vitest run tests/integration/clear-requests.spec.ts --coverage.enabled=false` **1회차**에 종료 코드 1(`m3-mutation-overwrite.log`):
  ```
  × 같은 상태 저장이 삭제 전 문서로 진행돼도 요청 사항이 되살아나지 않는다(G)
  × 상태 없는 수정(이름)이 삭제 전 문서로 진행돼도 요청 사항이 되살아나지 않고 이름·상태가 그대로다(H)
  × 결정적 사례 … (K), × 병렬 사례 반복 1·2·3
  FAIL … (G)
  AssertionError: expected false to be true // Object.is equality
   ❯ tests/integration/clear-requests.spec.ts:266:39
      266|       expect(isEmpty(after.requests)).toBe(true)          (요청 사항이 되살아남)
  AssertionError: expected null not to be null                       (K — 삭제 일시가 비워짐)
  Tests  6 failed | 6 passed (12)
  ```
- 되돌린 뒤 같은 명령: 종료 코드 0, `Tests 12 passed (12)`(`m3-mutation-restored.log`). (한국어 테스트 이름으로 거르는 `-t` 인자는 작업 트리 보호 장치가 거부해 파일 전체를 실행했다.)

데이터 정리(`pnpm test`·`pnpm e2e` 뒤, Node `pg`로 AC-ADMIN-016 SQL 실행, `.env` 값 출력 없음):

```
audit_orphans=0  audit_total=0  applications_example_test=1  tours_test_slug=0  users_example_test=0  session_id_not_null=NO
```

- `applications_example_test=1`은 M1 기준값과 같은 개발 신청 `SB-4KJFS-26FAM`(id 2033)이다. `applications.session_id`의 `NOT NULL`은 그대로다(회차 없는 신청 재현이 되돌려짐).

M3 구현 메모:

- 생성: `src/lib/clear-requests.ts`(`clearApplicationRequests` — 관리자 확인 → ID 확인(1~2147483647, 앞자리 0·부호·소수점 거부) → `initTransaction` → 잠금 없는 존재 확인 → 요청 사항 삭제 표시 → `payload.update(overrideAccess: true)` → 작업 기록 → `beforeCommit` → 커밋, 예외면 되돌림; `clearRequestsEndpoint` `POST /:id/clear-requests`), `src/components/admin/ClearRequestsField.tsx`(클라이언트 구성 요소: 요청 사항이 있을 때만 버튼, `ConfirmationModal`, 같은 출처 `fetch` POST 뒤 새로 고침), `tests/integration/clear-requests.spec.ts`(13건), `tests/e2e/admin-ops.spec.ts`(10건)
- 수정: `src/lib/application-status.ts`(§B.2 6번 — 5번 상태 덮어쓰기 뒤, 표시가 있으면 잠근 뒤 요청 사항으로 `REQUESTS_EMPTY` 판단·비움·삭제 일시, 표시는 읽는 즉시 지움; `markRequestsClear`·`unmarkRequestsClear`·`applicationUpdateErrorCode` 내보냄), `src/lib/admin-messages.ts`(`REQUESTS_EMPTY` 문구, 화면 문구 `CLEAR_REQUESTS_UI`), `src/collections/Applications.ts`(`endpoints`, `type: 'ui'` 필드 `clearRequests` — 요청 사항 바로 아래), `src/app/(payload)/admin/importMap.js`(생성), `tests/unit/repo-rules.spec.ts`(데이터 필드로 범위 좁힘)
- 요청 사항 삭제 함수는 신청 행을 먼저 잠그지 않는다. 잠금은 모두 보호 구간의 회차 → 신청 순서다(K 결정적 사례가 교착 없이 통과).
- 확인 단계는 Payload `ConfirmationModal`을 썼다(브라우저 `confirm`보다 화면 시험이 쉬움).
- 엔드포인트 응답에 `Cache-Control: no-store, private`를 붙였다.
- AC-ADMIN-015 E2E의 작업 기록 REST 403은 M3 범위가 아니지만 같은 E2E 파일에 값싸게 더했다.
- 남은 M3 항목 없음. 수동 확인(AC-ADMIN-003)은 사용자 몫이다.

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_

## plan-audit 3회차 결과 (2026-11-16)

PASS 0.99 (0.78 → 0.82 → 0.99). 반드시 고칠 항목 없음. 선택 지적 3건은 run 단계에서 반영한다.

- O1: REQ-ADMIN-002에 "회차 없는 신청은 REQ-ADMIN-005에 따라 거부" 교차 참조 한 구절 추가
- O2: AC-ADMIN-006 동시성 사례의 전제(K의 `payload_locked_documents` 행 없음)를 테스트가 단언
- O3: plan §B.2 3단계에 회차 `FOR UPDATE`가 0행이면 4단계 재조회에서 `SESSION_MISSING`으로 끝난다는 한 구절 추가
