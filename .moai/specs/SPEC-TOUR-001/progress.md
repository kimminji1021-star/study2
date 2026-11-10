# SPEC-TOUR-001 진행 기록

## §E.1 Plan-phase Audit-Ready Signal

```yaml
plan_status: audit-ready
plan_complete_at: 2026-11-10
tier: M
artifacts: [interview.md, spec.md, plan.md, acceptance.md, spec-compact.md]
req_count: 16
ac_count: 16
depends_on: [SPEC-INFRA-001]   # status: completed
base_head: ff00406
author: manager-spec
needs_clarification: 0
```

## §E.2 Run-phase Evidence

### 진입 기록 (오케스트레이터 기록, M1 커밋에 반영)

- **Phase 1 Plan Audit Gate**: 건너뜀 계약(skip contract)에 따라 재실행하지 않음. 근거 세 조건 — (1) 판정 PASS(`.moai/reports/plan-audit/SPEC-TOUR-001-review-3.md`), (2) 점수 0.94 ≥ Tier M 기준 0.80, (3) 계획 산출물이 review-3 이후 바뀌지 않음(산출물 mtime ≤ 13:14:29, review-3 13:17:07, `4963a66`에 변경 없이 커밋됨). review-3의 선택 지적 O1(AC-TOUR-002 Given에 채운 PNG 두 개)은 테스트에 반영, O2(크기 판정에 `max(size, data.length)`)는 코드에 반영. `acceptance.md`는 고치지 않음
- **Implementation Kickoff Approval**: 사용자 승인 — 세션 `a08890a8`, 2026-11-10. 진행 방식: 자율(autonomous), 위임은 마일스톤 하나씩

### 기준선 (M1 시작 전, 워크트리 `agent-a5f2212fade220fad`, HEAD `4963a66`)

| 명령 | 결과 |
|---|---|
| `git rev-parse HEAD` | `4963a665cd08006c19a1660bbcf7aa6216dfb6d3` (`ff00406`에서 `git merge --ff-only 4963a66`) |
| `docker compose ps --format '{{.Service}} {{.Health}}'` | `postgres healthy` |
| `pnpm install --frozen-lockfile` | 종료 코드 0 |
| `pnpm test` | 종료 코드 0, `Test Files 5 passed (5)`, `Tests 98 passed (98)`, `src/lib/` 라인 100% |

### M1 — 데이터 모델과 접근 규칙

RED(구현 전, `pnpm test`, 종료 코드 1): `Test Files 5 failed | 4 passed (9)`, `Tests 30 failed | 97 passed | 17 skipped (144)`. 대표 실패 — `Error: Cannot find module '../../src/lib/access'`(단위), `APIError: The collection with slug tours can't be found. Create Operation.`, `APIError: The collection with slug media can't be found. Create Operation.`(통합), 컬렉션 목록 단언 실패(`users-auth.spec.ts`). 전체 로그: `.moai/state/verify/a08890a8/tour-m1/red-test.log`

GREEN(`pnpm test`, 종료 코드 0): `Test Files 9 passed (9)`, `Tests 176 passed (176)`. 커버리지 `src/lib/` 라인 100%(92/92), 분기 92.4%. 로그: `.moai/state/verify/a08890a8/tour-m1/final-test.log`

| AC | 상태 | 확인 방법 | 결과 |
|---|---|---|---|
| AC-TOUR-001 | PASS | `tests/integration/users-auth.spec.ts`(필터 전 > 필터 후, 정렬 후 `['media','tour-sessions','tours','users']`, 기존 인증 흐름 4건) | 통과 |
| AC-TOUR-002 (자동) | PASS | `tests/integration/media-upload.spec.ts` 6건 — PNG 저장·`media/` 파일·(1,1)·삭제 시 파일 제거, 빈 대체 텍스트 `ValidationError`, 텍스트·SVG 거부, 5,242,881바이트 `ValidationError`·문서/파일 없음, 5,242,880바이트 성공·(1,1)·정리 후 파일 없음, 수정 시 5MB 초과 거부 | 통과 |
| AC-TOUR-002 (`git check-ignore`) | PASS | `git check-ignore -q media/probe.png; echo $?` | `0` (`.gitignore:261:/media/`) |
| AC-TOUR-002 (AC-INFRA-010 유지) | PASS | `tests/unit/repo-rules.spec.ts` | 통과(`.prettierignore`·ESLint 무시 목록 변경 없음) |
| AC-TOUR-002 (수동) | PASS | 임시 Playwright 확인(커밋하지 않음, 브라우저 시간대 `America/New_York`) + `next dev` 출력 | 미디어 생성·편집 화면의 `Edit Image` 컨트롤 0건, 관리자 화면 업로드로 문서 생성 성공. 개발 서버 출력에 `sharp not installed` 0건(같은 출력에 Payload 로그 `WARN: No email adapter provided` 존재 — 로그가 실제로 수집됨을 확인) |
| AC-TOUR-003 | PASS | `tests/integration/tour-collections.spec.ts` | 기본값 `published=false`, 잘못된 slug 7종 `ValidationError`, 중복 slug 거부(1건만 남음), 소요 시간 0·-30·1.5 거부·1 저장, 필수 7필드 각각 거부, 대표 이미지 연결·재조회 |
| AC-TOUR-004 (자동) | PASS | `tests/integration/tour-collections.spec.ts` | 종료 ≤ 시작 거부(생성 2종 + 기존 회차 종료만 수정), 정원 0·-1·1.5 거부·1 저장, 투어 없음 거부, 상태 기본값 `open`, `2026-11-20T00:00:00.000Z` 재조회 동일 |
| AC-TOUR-004 (수동) | PASS | 임시 Playwright 확인(브라우저 시간대 뉴욕, `getTimezoneOffset()` = 300) | 회차 생성 화면 시간대 선택 기본값 `서울`. 시작 `Nov 20, 2026 9:00 AM` 입력 후 저장 → REST 조회 `startsAt=2026-11-20T00:00:00.000Z startsAt_tz=Asia/Seoul`, 종료 `1:00 PM` → `endsAt=2026-11-20T04:00:00.000Z` |
| AC-TOUR-005 | PASS | `tests/integration/catalog-access.spec.ts` + `tests/unit/catalog-validation.spec.ts` | 익명(`overrideAccess: false`, 사용자 없음) 생성·수정·삭제 → 세 컬렉션 모두 `Forbidden`, 전후 개수·값 동일. 테스트 관리자로는 모두 성공. 관리자 판정 단위: 없음 거부·`users` 허용·`members` 거부 |
| AC-TOUR-006 (로컬 API 부분) | PASS | `tests/integration/catalog-access.spec.ts` | 익명 조회: 투어 A만, A의 회차만, 미디어 a만(b·c 없음). B `findByID` 오류. 관리자는 전부. 조회 계층(M3)·REST·GraphQL·파일 주소(M4 E2E)는 이후 마일스톤 |
| AC-TOUR-007 | PASS | `tests/integration/tour-collections.spec.ts` | 회차가 있는 투어 삭제 → `Cannot delete a tour that has sessions` 오류, 투어·회차 유지. 회차 삭제 후 투어 삭제 성공 |

관리자 화면 확인(R5): `/admin/collections/media`, `/admin/collections/tours`, `/admin/collections/tours/create`, `/admin/collections/tour-sessions` 모두 200, import map 오류 문구 없음. `pnpm generate:importmap` 출력 `No new imports found, skipping writing import map`(새 구성 요소 없음 — `importMap.js` 변경 없음). `pnpm generate:types` 종료 코드 0, `src/payload-types.ts` 갱신.

품질: `pnpm typecheck` 0, `pnpm lint` 0(경고 0), `pnpm format:check` 0(`All matched files use Prettier code style!`). `git diff --stat ff00406 -- pnpm-lock.yaml .prettierignore eslint.config.mjs pnpm-workspace.yaml package.json` 출력 없음.

정리 확인(테스트 후 DB 조회): `tours` slug `test-%` 0, `users` `%@example.test` 0, `media` filename `test-%` 0, `tour_sessions` 0, `media/` 비어 있음. 기존 실제 관리자 계정 1건 유지.

메모:
- RED 실행 중 `catalog-access.spec.ts` 정리 단계가 컬렉션 부재로 중간에 멈춰 테스트 관리자(`access-…@example.test`) 1건이 남았다. 해당 1건만 지웠고(실제 관리자 영향 없음), 정리 단계를 단계별 독립 실행(실패해도 계정 삭제는 계속, 끝에 첫 오류를 다시 던짐)으로 고쳤다
- 개발 DB에 `media`, `tours`, `tour_sessions`(+ `startsat_tz`·`endsat_tz` 열) 테이블이 개발 모드 자동 반영으로 생겼다

## §E.3 Run-phase Audit-Ready Signal

_<run 단계 완료 시 작성 — M1 완료, M2~M6 남음>_

## §F Phase 4 Mode Selection

- 입력: Tier M, 마일스톤 6개, 예상 파일 30개 안팎, 도메인 1개(투어 카탈로그 — 데이터 모델·화면·시드), TypeScript 중심, 동시 실행 이점 낮음(코딩 위주, `package.json`·개발 DB 공유)
- 평가: `direct` 아님(다파일 구현) / `fanout` 아님(연구가 아닌 코딩, 3도메인 미만) / `sweep` 아님(기계적 일괄 변환 아님) / `serial` 선택
- Decision: serial
- 근거: 코딩 위주 작업이고 같은 `package.json`과 개발 DB를 공유해 병렬 작성 시 충돌 위험이 크다. Anthropic의 코딩 작업 병렬화 주의(코딩은 연구보다 진짜 병렬 가능한 작업이 적다)에 따라 마일스톤마다 manager-develop 하나를 순차 위임한다

## §E.4 Sync-phase Audit-Ready Signal

_<sync 단계에서 작성>_
