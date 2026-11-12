# SPEC-APPLY-001 진행 기록

## §E.1 Plan-phase Audit-Ready Signal

```yaml
plan_status: audit-ready
plan_complete_at: 2026-11-10
tier: M
artifacts: [interview.md, spec.md, plan.md, acceptance.md, spec-compact.md]
req_count: 16
ac_count: 16
depends_on: [SPEC-TOUR-001]   # status: completed
base_head: 0cdea2f
author: manager-spec
needs_clarification: 0
legal_review_required: true   # 동의 문구·보유기간 표현 — 출시 전 전문가 확인 필요
```

## §E.2 Run-phase Evidence

### 사전 점검 기준선 (plan.md §C, 2026-11-12)

기준 HEAD `3ca31c2`(main, SPEC v0.1.2 커밋). 실행 위치는 격리 worktree(`.claude/worktrees/agent-af81e5bec8ce8c7c6`, 브랜치 `worktree-agent-af81e5bec8ce8c7c6`), PostgreSQL 컨테이너는 본 checkout과 공유. 긴 출력은 `.moai/state/verify/apply001-m1/`(git 제외)에 남겼다.

| 명령 | 종료 코드 | 결과 | 로그 |
|---|---|---|---|
| `docker compose ps --format '{{.Service}} {{.Health}}'` | 0 | `postgres healthy` | — |
| `pnpm install --frozen-lockfile` | 0 | `Done in 30.7s using pnpm v11.28.9` | `install.log` |
| `pnpm test` | 0 | `Test Files 17 passed (17)` / `Tests 275 passed (275)` / `Lines : 100% ( 201/201 )` | `baseline-test.log` |
| `pnpm e2e` | 0 | `26 passed (44.1s)` | `baseline-e2e.log` |
| `pnpm lint` | 0 | 출력 없음(경고·오류 0) | `baseline-lint.log` |
| `pnpm format:check` | 0 | `All matched files use Prettier code style!` | `baseline-format.log` |
| `pnpm typecheck` | 0 | 출력 없음 | `baseline-typecheck.log` |

### M1 — 데이터 모델과 접근 규칙

**RED** (구현 전, `pnpm exec vitest run --coverage.enabled=false <새·변경 테스트 4개>`, 종료 코드 1, `red.log`):

```text
 FAIL  |unit| tests/unit/application-input.spec.ts [ tests/unit/application-input.spec.ts ]
Error: Cannot find module '../../src/lib/application-input' imported from …/tests/unit/application-input.spec.ts
 FAIL  |integration| tests/integration/application-access.spec.ts > 신청 접근 규칙(실제 DB)
APIError: The collection with slug applications can't be found. Create Operation.
 FAIL  |integration| tests/integration/application-collections.spec.ts [ tests/integration/application-collections.spec.ts ]
Error: Cannot find module '../../src/lib/application-input' imported from …/tests/integration/application-collections.spec.ts
 FAIL  |integration| tests/integration/users-auth.spec.ts > … > 등록된 컬렉션에서 Payload 시스템 컬렉션을 빼면 users·media·tours·tour-sessions·applications·application-attempts뿐이다
AssertionError: expected [ 'media', 'tour-sessions', …(2) ] to deeply equal [ 'application-attempts', …(5) ]
 Test Files  4 failed (4)
      Tests  1 failed | 4 passed | 8 skipped (13)
```

**GREEN** (같은 4개 파일, 종료 코드 0, `green.log`): `Test Files 4 passed (4)` / `Tests 95 passed (95)`.

생성 파일: `pnpm generate:types` 종료 코드 0(`src/payload-types.ts` 갱신), `pnpm generate:importmap` 종료 코드 0(`No new imports found, skipping writing import map` — import map 변경 없음).

**M1 종료 시 전체 검증** (작업 트리 = M1 변경 전부, 커밋 직전):

| 명령 | 종료 코드 | 결과 | 기준선 대비 |
|---|---|---|---|
| `pnpm test` | 0 | `Test Files 20 passed (20)` / `Tests 365 passed (365)` / `Lines : 100% ( 228/228 )` | +3 파일, +90건, 실패 0 |
| `pnpm e2e` | 0 | `26 passed (56.3s)` | 같음(26) |
| `pnpm lint` | 0 | 출력 없음 | 같음 |
| `pnpm format:check` | 0 | `All matched files use Prettier code style!` | 같음 |
| `pnpm typecheck` | 0 | 출력 없음 | 같음 |
| `git diff --stat 3ca31c2 -- pnpm-lock.yaml .prettierignore eslint.config.mjs pnpm-workspace.yaml` | 0 | 출력 없음(§D 불변 파일 그대로) | — |

테스트 데이터 잔여 확인(전체 실행 뒤, `payload run`으로 개수만 조회): `{"testTours":0,"applications":0,"attempts":0,"testUsers":0}`.

| AC | 상태 | 검증 | 실제 결과 |
|---|---|---|---|
| AC-APPLY-001 | PASS | `tests/integration/users-auth.spec.ts` — 시스템 컬렉션 제외 목록 정렬 = `['application-attempts','applications','media','tour-sessions','tours','users']`, 필터 전 목록이 더 김, 기존 인증 흐름 4건 | `pnpm test` 365/365 통과 |
| AC-APPLY-002 | PASS | `tests/integration/application-collections.spec.ts`(필수 값·기본 상태 pending·인원 0/11/1.5 거부·1/10 저장·요청 사항 501 거부/500 저장·필수 필드 8종 누락 각 1건·접수 번호 중복 거부 후 1건만 남음·이메일 받는 표본 3개 저장) + `tests/unit/application-input.spec.ts`(같은 표본: 받는 3개 통과, 거부 5개 `EMAIL_INVALID`, 255자 경계) | `pnpm test` 365/365 통과 |
| AC-APPLY-003 | 부분 PASS (로컬 API) | `tests/integration/application-access.spec.ts` — 익명·관리자 각각 `applications`·`application-attempts` 생성·수정·삭제 `Forbidden` + 전후 스냅숏 동일, 익명 신청 조회 `Forbidden`·관리자 조회에 준비한 신청 1건, 익명·관리자 시도 기록 조회 `Forbidden`(대상 존재 먼저 단언), `application-attempts`의 `admin.hidden === true` | 통과. REST·GraphQL 부분은 M5 E2E 범위 |
| AC-APPLY-003 (수동) | 보류 — 수동 확인 필요 | 관리자 화면에서 신청 목록·상세 열림, 입력란 편집 불가, "새로 만들기"·저장 버튼 없음, 메뉴에 신청 시도 기록 없음 | **run 에이전트가 브라우저로 확인할 수 없어 미실시.** 사람이 `pnpm dev` 후 확인해 이 행을 갱신해야 한다 |
| AC-APPLY-004 | PASS | `application-collections.spec.ts` — 관리자(접근 규칙 적용)의 회차 삭제가 `Cannot delete a session that has applications` 오류, 회차·신청 그대로, 신청 삭제 후 회차 삭제 성공 | `pnpm test` 365/365 통과 |

결정 메모:

- 입력 규칙 순수 함수(`src/lib/application-input.ts`)는 M1에서 필드 단위(`checkName`·`checkEmail`·`checkPhone`·`checkRequests`·`isValidPartySize`)만 만들었다. 회차 식별 값·동의·입력란 묶음 검증은 M2에서 더한다.
- Payload는 이메일 정규식을 내보내지 않아 `application-input.ts`에 복사했다(`@MX:NOTE`). 어긋나면 AC-APPLY-002 일관성 테스트가 잡는다.
- 접수 번호 형식 검증은 컬렉션에 두지 않았다(M1 범위 밖 — M2 접수 번호 모듈과 함께 판단). 테스트는 `tests/helpers/application-fixtures.ts`의 `testReferenceCode()`로 고유 값을 만든다.
- 이 worktree의 테스트가 공유 개발 DB에 새 테이블(`applications`, `application_attempts`)과 `payload_locked_documents_rels`의 열을 개발 모드 스키마 반영으로 추가했다. 이 변경이 없는 checkout(main 등)에서 `pnpm dev`·테스트를 돌리면 Payload가 그 테이블·열을 지우려 할 수 있다(plan.md R15 계열). M1 커밋이 main에 합쳐지기 전까지는 주의가 필요하다.

### M2 — 점유 인원과 정원 확인 구간

기준 HEAD `c1cb912`(main, M1 병합). 실행 위치는 격리 worktree(`.claude/worktrees/agent-a24be99d665f7eb4f`), PostgreSQL 컨테이너는 본 checkout과 공유. 긴 출력은 `.moai/state/verify/apply001-m2/`(git 제외). 시작 시 `git merge --ff-only c1cb912` 후 `git log --oneline -1` = `c1cb912 feat(SPEC-APPLY-001): M1 신청 데이터 모델과 접근 규칙`, `pnpm install --frozen-lockfile` 종료 코드 0.

**RED** (구현 전, `pnpm exec vitest run --coverage.enabled=false <새·변경 테스트 7개>`, 종료 코드 1, `red.log`):

```text
 FAIL  |unit| tests/unit/application-input.spec.ts [ tests/unit/application-input.spec.ts ]
Error: Cannot find module '../../src/lib/reference-code' imported from …/tests/helpers/application-fixtures.ts
 FAIL  |unit| tests/unit/consent.spec.ts [ tests/unit/consent.spec.ts ]
Error: Cannot find module '../../src/lib/consent' imported from …/tests/unit/consent.spec.ts
 FAIL  |unit| tests/unit/reference-code.spec.ts [ tests/unit/reference-code.spec.ts ]
Error: Cannot find module '../../src/lib/reference-code' imported from …/tests/unit/reference-code.spec.ts
 FAIL  |unit| tests/unit/submit-application.spec.ts [ tests/unit/submit-application.spec.ts ]
Error: Cannot find module '../../src/lib/submit-application' imported from …/tests/unit/submit-application.spec.ts
 FAIL  |integration| tests/integration/application-concurrency.spec.ts [ … ]
Error: Cannot find module '../../src/lib/occupancy' imported from …/tests/integration/application-concurrency.spec.ts
 FAIL  |integration| tests/integration/submit-application.spec.ts [ … ]
Error: Cannot find module '../../src/lib/consent' imported from …/tests/integration/submit-application.spec.ts
 FAIL  |unit| tests/unit/repo-rules.spec.ts > AC-APPLY-011 접수 번호 모듈의 난수 출처 > 접수 번호 모듈은 node:crypto를 import하고 Math.random을 담지 않는다
Error: ENOENT: no such file or directory, open '…\src\lib\reference-code.ts'
 Test Files  7 failed (7)
      Tests  1 failed | 58 passed (59)
```

**GREEN** (같은 파일 + `application-collections.spec.ts`, 종료 코드 0, `green.log`): `Test Files 8 passed (8)` / `Tests 238 passed (238)`. 첫 GREEN 시도에서 저장소 규칙 1건이 실패했다 — 접수 번호 모듈의 주석이 `Math.random`이라는 글자를 담고 있었다. 주석 표현을 바꿔 통과.

**변이 확인** (AC-APPLY-010, plan.md §E-1 7번): `src/lib/submit-application.ts`의 잠금 문장에서 `FOR UPDATE`만 지운 코드로 `pnpm exec vitest run --coverage.enabled=false --reporter=verbose tests/integration/application-concurrency.spec.ts`를 3회 실행 — 3회 모두 종료 코드 1, `Tests 7 failed | 1 passed (8)` (`mutation-run1~3.log`). 실패 단언(3회 동일):

```text
AssertionError: expected [ 'SUCCESS', 'SUCCESS', …(7) ] to have a length of 5 but got 9      ← 시나리오 A 3반복 모두
AssertionError: expected 23 to be less than or equal to 10                                   ← 시나리오 B 3반복 모두(정원 초과 저장)
AssertionError: expected 0 to be greater than or equal to 1                                  ← 잠금 대기 세션 0개
```

통과한 1건은 300ms 잠금 대기 제한 사례다. 잠금 문장이 없어도 신청 INSERT의 외래 키 검사(`FOR KEY SHARE`)가 테스트 쪽 `FOR UPDATE` 잠금과 충돌해 `55P03`이 나기 때문이며, 이 사례는 변이 대상이 아니다. `FOR UPDATE`를 되돌린 뒤 같은 명령: 종료 코드 0, `Tests 8 passed (8)` (`mutation-restored.log`). 3회 안에 실패했으므로 커밋 직전 지연 주입(차단자 보고 조건)은 필요 없었다.

**M2 종료 시 전체 검증** (작업 트리 = M2 변경 전부, 커밋 직전):

| 명령 | 종료 코드 | 결과 | M1 대비 |
|---|---|---|---|
| `pnpm typecheck` | 0 | 출력 없음 | 같음 |
| `pnpm generate:types` | 0 | `src/payload-types.ts` 변경 없음(`git status --short` 비어 있음) | — |
| `pnpm test` | 0 | `Test Files 25 passed (25)` / `Tests 463 passed (463)` / `Lines : 98.83% ( 338/342 )` | +5 파일, +98건, 실패 0 |
| `pnpm lint` | 0 | 출력 없음 | 같음 |
| `pnpm format:check` | 0 | `All matched files use Prettier code style!` | 같음 |

테스트 데이터 잔여 확인(전체 실행 뒤, `payload run`으로 개수만 조회): `{"testTours":0,"applications":0,"attempts":0,"testUsers":0}`.

| AC | 상태 | 검증 | 실제 결과 |
|---|---|---|---|
| AC-APPLY-005 (정의 부분) | PASS | `tests/integration/submit-application.spec.ts` — 대기 2·확정 1·취소 2 → 화면용 함수 3, 신청 없는 회차 0, 같은 트랜잭션 연결용 함수도 3/0 | `pnpm test` 463/463. 조회 계층 반영·질의 수는 M3 |
| AC-APPLY-008 (검증 함수 + 통합) | PASS | `tests/unit/application-input.spec.ts` 묶음 검증 표 전체(이름 50/51자 짝, 연락처 8개 표본, 30/31자 짝, 인원, 요청 사항·선택 동의, 필수 동의, 회차 범위, 여러 오류 동시) + 통합 5건 `VALIDATION_FAILED`·신청 수·점유 인원 불변 | 통과. 화면 부분은 M5 |
| AC-APPLY-009 | PASS | 정원 4: 3 성공(open·점유 3) → 2 `CAPACITY_EXCEEDED` → 1 성공(closed·점유 4) → 1 `SESSION_CLOSED`, 저장값 pending·접수 번호 형식·회차, `SESSION_STARTED`·비공개 투어 `SESSION_NOT_FOUND`·없는 ID `SESSION_NOT_FOUND`, 롤백(주입 함수가 같은 req로 읽은 상태 `closed` → `INTERNAL_ERROR` → 신청 0·`open`), 대조군 성공·closed | 통과 |
| AC-APPLY-010 | PASS | `tests/integration/application-concurrency.spec.ts` — 시나리오 A(12건) 3회, 시나리오 B(8건) 3회, `pg_stat_activity` 잠금 대기 세션 ≥ 1, 300ms 제한 `SESSION_BUSY` 2초 안, 취소해도 closed 유지·이어서 `SESSION_CLOSED`. 기본값: 단위 `DEFAULT_LOCK_TIMEOUT_MS === 5000`, 통합 주입 함수로 읽은 `current_setting('lock_timeout')` = `5s` | 통과(verbose: 시나리오 A 395/127/105ms, B 71/103/88ms, 잠금 증거 82ms, 300ms 제한 328ms) + 변이 확인 위 기록 |
| AC-APPLY-011 (단위) | PASS | `tests/unit/reference-code.spec.ts` 1만 개 형식·중복 없음·32자 모두 등장·I/L/O/U 없음 + 저장소 규칙(`node:crypto` import, `Math.random` 없음) | 통과 |
| AC-APPLY-014 | PASS | 통합: 주입한 `now`와 `privacyConsentAt` 일치, 버전 = 현재 상수, 요청 사항·선택 동의 일시·취소일 비어 있음 / 요청 사항 + 선택 동의 → 저장·일시 일치 / 선택 동의만 → 일시 없음. 단위: 고정 문구, 버전 형식, `consentDocument()` SHA-256 앞 8자리 = `8deb2c9f` | 통과 |

결정 메모:

- 신청 처리 함수는 `src/lib/submit-application.ts`의 `submitApplication(payload, input, { now, lockTimeoutMs, beforeCommit })`. 결과는 `{ status: 'success', referenceCode }` 또는 `{ status: 'error', code[, fieldErrors] }`. 횟수 제한·허니팟(M4)은 아직 없다 — M4가 앞단에 붙이고 동시성 테스트의 `submit()` 한 곳에서 제출마다 다른 접속 IP를 넘기면 된다.
- 잠금 뒤 다시 읽기는 회차·투어 공개 여부 1문장 + 점유 인원 1문장(`occupancy.ts`의 같은 정의). 판정은 `getSessionAvailability`를 재사용한다(사유 우선순위 closed → past → full, 그 뒤 인원 > 남은 자리).
- 원시 SQL 연결은 `src/lib/transaction-db.ts` 한 곳에서 꺼낸다(drizzle-orm 직접 import 없음). 커밋 직전에 트랜잭션이 살아 있는지 확인한다 — 안쪽 작업이 이미 롤백했다면 `commitTransaction`이 조용히 끝나 거짓 성공이 될 수 있어서다.
- 로그는 `payload.logger.error({ code, errorName, sessionId, msg })`만 남긴다. 잡은 오류 객체·메시지를 넘기지 않는다(REQ-APPLY-015, 전체 검증은 M6 AC-APPLY-015).
- 컬렉션 `referenceCode` 필드에 형식 검사(`isValidReferenceCode`)를 붙였다(M1이 남긴 항목). `application-collections.spec.ts`에 형식이 틀린 3개 표본 거부 사례를 더했다. 테스트 도우미 `testReferenceCode()`는 이제 접수 번호 모듈을 쓴다.
- 동의 문구 버전은 `2026-11-10.8deb2c9f`. 법률 문구는 초안이며 **출시 전 전문가 확인 필요**(코드 주석 `@MX:NOTE`에도 표시).
- 커버리지: `submit-application.ts`의 미실행 줄 123-124·128-129는 `beginTransaction` 실패·`null` 반환(트랜잭션 꺼짐) 분기다. 실제 DB로 재현할 수 없어 plan.md R4대로 코드 검토 항목으로 둔다.
- `pnpm test` 출력의 pg `DeprecationWarning: Calling client.query() when the client is already executing a query`는 기존 파일(`tests/integration/tour-collections.spec.ts` 단독 실행에서도 1건)에서도 나오는 Payload 내부 동작이다 — M2가 만든 경고가 아니다.

### M3 — 화면 표시에 점유 인원 반영

기준 HEAD `7daa1b6`(main, M2 병합). 실행 위치는 격리 worktree(`.claude/worktrees/agent-ab3bcf9588e763546`), PostgreSQL 컨테이너는 본 checkout과 공유. 긴 출력은 `.moai/state/verify/apply001-m3/`(git 제외). 시작 시 `git merge --ff-only 7daa1b6` 후 `git log --oneline -1` = `7daa1b6 feat(SPEC-APPLY-001): M2 점유 인원과 정원 확인 구간`, `pnpm install --frozen-lockfile` 종료 코드 0, `docker compose ps` = `postgres healthy`.

**RED** (구현 전, `pnpm exec vitest run --coverage.enabled=false tests/integration/catalog-occupancy.spec.ts`, 종료 코드 1, `red.log`):

```text
       × 목록의 가장 가까운 회차(S1)와 상세의 S1: 남은 자리 2 / 정원 5
-   "remainingSeats": 2,
+   "remainingSeats": 5,
       × 정원 3인 S2에 대기 3명을 만들면 남은 자리 0, 선택 불가 사유 full
-   "reason": "full",
-   "remainingSeats": 0,
-   "selectable": false,
+   "reason": null,
+   "remainingSeats": 3,
+   "selectable": true,
 Test Files  1 failed (1)
      Tests  2 failed | 2 passed (4)
```

질의 수 사례는 구현 전에도 통과했다(조회 계층이 점유 인원을 아예 세지 않아 질의 수가 회차 수와 무관했기 때문). 이 사례가 실제로 N+1을 잡는지는 아래 변이 확인으로 보였다.

**GREEN** (`catalog-occupancy` + 기존 `catalog-query` + `session-availability` 단위, 종료 코드 0, `green.log`): `Test Files 3 passed (3)` / `Tests 30 passed (30)`.

**변이 확인 (질의 수)**: `catalog.ts`의 `toSessions`를 회차마다 `getOccupiedSeatsBySession(payload, [doc.id])`를 부르는 코드로 바꿔 같은 파일 실행 → 종료 코드 1, `AssertionError: expected 19 to be 14 // Object.is equality`(목록 조회, 회차 6개 측정이 1개 측정보다 5회 많음, `mutation-n-plus-1.log`). 원래 코드로 되돌린 뒤 GREEN 재확인.

**M3 종료 시 전체 검증** (작업 트리 = M3 변경 전부, 커밋 직전):

| 명령 | 종료 코드 | 결과 | M2 대비 |
|---|---|---|---|
| `pnpm typecheck` | 0 | 출력 없음 | 같음 |
| `pnpm lint` | 0 | 출력 없음 | 같음 |
| `pnpm format:check` | 0 | `All matched files use Prettier code style!` | 같음 |
| `pnpm test` | 0 | `Test Files 26 passed (26)` / `Tests 467 passed (467)` / `Lines : 98.84% ( 341/345 )` | +1 파일, +4건, 실패 0 |
| `pnpm e2e` | 0 | `26 passed (39.7s)` | 같음(26) |

| AC | 상태 | 검증 | 실제 결과 |
|---|---|---|---|
| AC-APPLY-005 | PASS | `tests/integration/catalog-occupancy.spec.ts` — 이 기준 전용 데이터로 점유 인원 모듈 S1=3(취소 2명 제외)·빈 회차 0, 목록의 가장 가까운 회차와 상세의 S1 `remainingSeats 2 / capacity 5`, S2(정원 3, 대기 3) `{capacity:3, remainingSeats:0, selectable:false, reason:'full'}`, 투어 Q 회차 1개 → 6개에서 목록·상세 각각 `pool.query` 수 동일·1 이상, 네 구간 모두 `connect` 수 = `query` 수 | `pnpm test` 467/467 + 변이 확인 |

결정 메모:

- `catalog.ts`에 `toSessions(payload, docs, now)`를 두어 목록·상세가 같은 경로로 점유 인원 맵을 한 번 조회한다. 회차가 0개면 `getOccupiedSeatsBySession`이 질의 없이 빈 맵을 돌려준다(M2).
- `catalog.ts`·`session-availability.ts`의 신청 SPEC 확장 `@MX:NOTE`를 "확장 완료"로 갱신했다. `SessionList`의 `@MX:NOTE`는 화면을 바꾸는 M5에서 갱신한다.
- 화면 컴포넌트는 바꾸지 않았다. 목록·상세는 이미 조회 계층의 `availability`만 그리므로 남은 자리 표시가 자동으로 점유 인원을 반영한다(화면 확인은 M5 E2E AC-APPLY-006).

### M4 — 스팸 방지

기준 HEAD `d6f6ae6`(M3 커밋). 같은 worktree, 긴 출력은 `.moai/state/verify/apply001-m4/`(git 제외).

**RED 1** (구현 전, `pnpm exec vitest run --coverage.enabled=false tests/unit/rate-limit.spec.ts tests/integration/rate-limit.spec.ts tests/integration/submit-application.spec.ts tests/integration/application-concurrency.spec.ts`, 종료 코드 1, `red.log`):

```text
 FAIL  |unit| tests/unit/rate-limit.spec.ts [ tests/unit/rate-limit.spec.ts ]
Error: Cannot find module '../../src/lib/rate-limit' imported from …/tests/unit/rate-limit.spec.ts
 FAIL  |integration| tests/integration/application-concurrency.spec.ts [ … ]
Error: Cannot find module '../../src/lib/rate-limit' imported from …/tests/helpers/application-fixtures.ts
 FAIL  |integration| tests/integration/rate-limit.spec.ts [ … ]
 FAIL  |integration| tests/integration/submit-application.spec.ts [ … ]
 Test Files  4 failed (4)
      Tests  no tests
```

**RED 2 — 동작 실패** (`src/lib/rate-limit.ts`의 순수 함수·기록 함수만 만들고 신청 처리 함수에 연결하기 전, 단위·통합 `rate-limit.spec.ts`, 종료 코드 1, `red2.log`): 단위 통과, 통합 실패 —

```text
 FAIL  |integration| tests/integration/rate-limit.spec.ts > 허니팟과 횟수 제한(실제 DB, AC-APPLY-013) > 허니팟·10회 제한·IP 분리·키 해시 저장·시간 경과·오래된 기록 정리
AssertionError: expected { status: 'success', …(1) } to deeply equal { status: 'error', …(1) }
 Test Files  1 failed | 1 passed (2)
      Tests  1 failed | 17 passed (18)
```

이 실행에서 테스트의 `afterAll`이 정리 전에 단언하는 순서 결함이 드러났다(단언 실패 → 표식 투어 1개가 남음). 정리 후 단언하도록 세 파일의 `afterAll`을 고치고, 임시 스크립트(`payload run .moai/state/verify/apply001-m4/residue.ts clean-rate-limit`)로 그 투어·회차·신청만 지웠다: `{"cleanedRateLimitTours":1}` → `{"testTours":0,"applications":0,"attempts":0,"testUsers":0}`.

**GREEN** (신청 처리 함수 앞단 연결 후, 단위 3개 + 통합 3개, 종료 코드 0, `green.log`): `Test Files 6 passed (6)` / `Tests 148 passed (148)`.

**M4 종료 시 전체 검증** (작업 트리 = M4 변경 전부, 커밋 직전):

| 명령 | 종료 코드 | 결과 | M3 대비 |
|---|---|---|---|
| `pnpm typecheck` | 0 | 출력 없음 | 같음 |
| `pnpm lint` | 0 | 출력 없음 | 같음 |
| `pnpm format:check` | 0 | `All matched files use Prettier code style!` | 같음 |
| `pnpm test` | 0 | `Test Files 28 passed (28)` / `Tests 486 passed (486)` / `Lines : 98.91% ( 365/369 )` | +2 파일, +19건, 실패 0 |
| `pnpm e2e` | 0 | `26 passed (31.6s)` | 같음(26) |
| `git diff --stat 0cdea2f -- pnpm-lock.yaml .prettierignore eslint.config.mjs pnpm-workspace.yaml` | 0 | 출력 없음 | — |

테스트 데이터 잔여 확인(전체 실행 뒤, `payload run`으로 개수만 조회): `{"testTours":0,"applications":0,"attempts":0,"testUsers":0}`.

| AC | 상태 | 검증 | 실제 결과 |
|---|---|---|---|
| AC-APPLY-013 | PASS | 통합 `tests/integration/rate-limit.spec.ts`(정원 100, 고정 `now`): `203.0.113.12` + 허니팟 `x` → `SUBMISSION_REJECTED`·신청 0 / `203.0.113.10` 10건 성공, 11번째 `RATE_LIMITED`·신청 10 / `203.0.113.11` 성공 / 새 시도 기록 1·11·1건, 키 모두 `^[0-9a-f]{64}$`, `.10` 키 11건 동일·`.11`·`.12`와 다름, 시도 시각 = `now` / `.10` 키 = `HMAC-SHA256(process.env.PAYLOAD_SECRET, 'apply-rate-limit:203.0.113.10')`, 키 없는 `SHA-256('203.0.113.10')`과 다름(비밀 값 미출력) / 시도 기록 전체 `JSON.stringify`에 키가 있고 세 IP 문자열이 없음 / `now + 10분 + 1초` 제출 성공, 직전 1건 이상이던 10분 초과 기록이 0건. 단위 `tests/unit/rate-limit.spec.ts`: `198.51.100.7, 10.0.0.1` → `198.51.100.7`, `x-real-ip: 198.51.100.8` → `198.51.100.8`, 둘 다 없음 → `unknown`(+ 공백·빈 첫 값), 키 유도·비밀 값 없음 예외, 허니팟 판정 | `pnpm test` 486/486 |
| AC-APPLY-016 (시도 기록 정리 부분) | PASS | `rate-limit`·`submit-application`·`application-concurrency` 통합 파일의 `afterAll`이 자기가 쓴 IP들의 키로 시도 기록을 지우고 "지우기 전 ≥ 1, 지운 뒤 0"을 단언(정리를 끝낸 뒤 단언) | `pnpm test` 486/486, 잔여 `attempts: 0` |
| AC-APPLY-010 (회귀) | PASS | 동시성 테스트가 `submit()` 한 곳에서 제출마다 다른 `198.51.100.x`를 넘김(66개), 시나리오 A·B·잠금 증거·300ms 제한 모두 그대로 통과 | `pnpm test` 486/486 |

결정 메모:

- `src/lib/rate-limit.ts`: `clientIpFromHeaders`(서버 액션 M5용 순수 함수), `rateLimitKey(ip, secret = process.env.PAYLOAD_SECRET)`(비밀 값이 없으면 예외 — 키 없는 해시로 떨어지지 않음), `recordAttempt(payload, ip, now)`(오래된 행 삭제 → 기록 → 최근 10분 `[now − 10분, now]` 같은 키 수 ≤ 10). 기록·세기는 Payload 로컬 API(`overrideAccess` 기본값)로 한다. `@MX:DEBT`(+`@MX:CEILING`·`@MX:UPGRADE`)를 붙였다.
- 허니팟 입력란 이름 `HONEYPOT_FIELD = 'website'`와 판정 `isHoneypotFilled`는 `application-input.ts`에 두었다(서버 액션의 FormData 해석이 같은 이름을 쓴다). 빈 문자열·없음만 비어 있는 것으로 본다.
- `submitApplication(payload, input, { clientIp, now, lockTimeoutMs, beforeCommit })` — `clientIp`는 필수다(빠뜨리면 모든 제출이 한 키로 묶이므로 타입으로 막는다). 순서는 plan.md §B.5대로 시도 기록 → `RATE_LIMITED` → 허니팟 `SUBMISSION_REJECTED` → 입력 검증 → 정원 확인 구간. 시도 기록 단계의 DB 오류는 `INTERNAL_ERROR`(로그는 코드·오류 종류 이름·`sessionId: null`만) — 단위 테스트가 가짜 payload로 확인.
- 테스트 IP: `tests/helpers/application-fixtures.ts`의 `testIpPool(prefix, start)`가 파일마다 다른 대역·시작 번호를 내준다(동시성 `198.51.100.1~`, 신청 처리 `203.0.113.100~`, 횟수 제한 고정 `203.0.113.10~12`). E2E(M5)는 `198.51.100.x`를 쓸 예정이며, 통합 테스트가 끝나면 그 키의 기록은 남지 않는다.
- 남은 범위: 서버 액션의 `x-forwarded-for` 추출·`website` FormData 해석·화면의 허니팟 배치(M5), 로그 비노출 전체 점검(M6 AC-APPLY-015).

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
