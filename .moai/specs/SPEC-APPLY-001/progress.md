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

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
