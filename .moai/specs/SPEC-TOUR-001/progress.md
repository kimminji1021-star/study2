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

### M2 — 남은 자리·표시 도우미

기준선(워크트리 `agent-a6e70eca600ee5f2b`, `ff00406`에서 `git merge --ff-only a3cc21c`, HEAD `a3cc21c`): `pnpm test` 종료 코드 0, `Tests 176 passed (176)`, `src/lib/` 라인 100%(92/92). 로그: `.moai/state/verify/a08890a8/tour-m2/baseline-test.log`

RED(구현 전, `npx vitest run --project unit --coverage.enabled=false <새 단위 테스트 4개>`, 종료 코드 1): `Test Files 4 failed (4)`, `Tests 4 skipped (4)`. 실패 — `Error: Cannot find module '../../src/lib/session-availability'`, `'../../src/lib/catalog-order'`, `'../../src/lib/format'`(정적·동적 import 모두). 로그: `.moai/state/verify/a08890a8/tour-m2/red-test.log`

GREEN(`pnpm test`, 종료 코드 0): `Test Files 13 passed (13)`, `Tests 215 passed (215)`. 커버리지 `src/lib/` 라인 100%(125/125), 분기 94.54%. 로그: `.moai/state/verify/a08890a8/tour-m2/final-test.log`

시간대 테스트 변이 확인: `src/lib/format.ts`에서 `timeZone`을 잠시 빼고 `format-timezone.spec.ts`만 실행 → 종료 코드 1, `Tests 3 failed | 1 passed (4)`(예: `Received: "11월 19일 (목) 오후 7:00"`). 되돌린 뒤 통과. 로그: `.moai/state/verify/a08890a8/tour-m2/mutation-no-timezone.log`

| AC | 상태 | 확인 방법 | 결과 |
|---|---|---|---|
| AC-TOUR-008 남은 자리 | PASS | `tests/unit/session-availability.spec.ts` | 15·0 → 15, 15·15 → 0(자리 없음), 15·20 → 0, 점유 생략 → 0으로 계산 |
| AC-TOUR-008 선택 가능 | PASS | 같은 파일 | 가능 / 마감(`closed`) / 시작 = 현재(`past`) / 지남(`past`) / 자리 없음(`full`), 해석 불가 시각 → `past`, 사유 우선순위 마감 → 지남 → 자리 없음 |
| AC-TOUR-008 가장 가까운 회차·정렬·상세 목록 | PASS | `tests/unit/catalog-order.spec.ts` | 선택 불가 건너뜀·없으면 `null`, 모집 중 먼저(시작 시각 → 제목), 나머지 제목 순(`localeCompare(…, 'ko')`), 상세는 시작 ≤ 현재 제외·시작 순·마감 포함 |
| AC-TOUR-008 일시 표기 | PASS | `tests/unit/format-timezone.spec.ts`(별도 파일, `TZ=America/New_York` 적용 단언 `getHours() === 19` 후 실행, 모듈은 시간대 변경 뒤 동적 import, 복원은 `delete process.env.TZ`/원래 값) | `11월 20일 (금) 오전 9:00`, `11월 20일 (금) 오후 3:30`, 날짜 경계 `11월 21일 (토) 오전 12:05` |
| AC-TOUR-008 소요 시간 | PASS | `tests/unit/format.spec.ts` | 30 → `30분`, 59 → `59분`, 60 → `1시간`, 90 → `1시간 30분`, 240 → `4시간`, 270 → `4시간 30분`, 0 → `0분`, 음수·소수·NaN → `RangeError` |
| AC-TOUR-008 slug 판정 | PASS | `tests/unit/catalog-validation.spec.ts`(M1) | `hallasan-yeongsil`·`udo-bike-2`·`a` 허용, 잘못된 값 거부 |

품질: `pnpm typecheck` 0, `pnpm lint` 0, `pnpm format:check` 0(`All matched files use Prettier code style!`). 정리 확인(DB): `tours` `test-%` 0, `users` `%@example.test` 0, `tour_sessions` 0, `media` `test-%` 0, 전체 `users` 1(실제 관리자), `media/` 파일 0.

커밋: `eaecd30` `feat(SPEC-TOUR-001): M2 남은 자리·표시 도우미`(pre-commit `moai gate` 통과)

### M3 — 카탈로그 조회 계층

RED(구현 전, `npx vitest run --project integration --coverage.enabled=false tests/integration/catalog-query.spec.ts`, 종료 코드 1): `Test Files 1 failed (1)`, `Tests no tests`. 실패 — `Error: Cannot find module '../../src/lib/catalog'`. 모듈을 불러오기 전에 실패하므로 준비 데이터는 만들어지지 않았다. 로그: `.moai/state/verify/a08890a8/tour-m3/red-test.log`

GREEN(`pnpm test`, 종료 코드 0): `Test Files 14 passed (14)`, `Tests 228 passed (228)`. 커버리지 `src/lib/` 라인 100%(153/153), 분기 91.97%(`catalog.ts` 분기 81.48% — 막힌 이미지 ID·`url` 없음·공개 투어 0건·관계 객체 형태의 방어 분기). 로그: `.moai/state/verify/a08890a8/tour-m3/final-test.log`

접근 규칙 변이 확인: `src/lib/catalog.ts`의 `overrideAccess`를 잠시 `true`로 바꾸고 `catalog-query.spec.ts`만 실행 → 종료 코드 1, `Tests 6 failed | 7 passed (13)`(공개되지 않은 투어 노출, 비공개 slug 상세가 null 아님, 호출 기록 단언 실패 등). 되돌린 뒤 통과. 로그: `.moai/state/verify/a08890a8/tour-m3/mutation-override-true.log`

| AC | 상태 | 확인 방법 | 결과 |
|---|---|---|---|
| AC-TOUR-006 (조회 계층 부분) | PASS | `tests/integration/catalog-query.spec.ts` | 목록에 공개 투어 4개만(비공개 H 없음), H의 회차(정원 7)·제목·이미지가 목록·상세 결과 어디에도 없음, H의 slug 상세 → `null`. 목록·상세의 모든 `payload.find` 호출이 `overrideAccess: false`, `user`·`req` 없음(호출 기록) |
| REQ-TOUR-009 정렬·가장 가까운 회차 | PASS | 같은 파일 | 표식 투어 순서 `+1일 → +2일 → (마감만, 나) → (회차 없음, 다)` — 제목 순과 반대로 골라 시작 시각 정렬을 확인. 가장 가까운 회차 정원 11, `{capacity: 11, remainingSeats: 11, selectable: true, reason: null}`. 마감만·회차 없음 → `null`. `now`를 +30일로 넘기면 모두 `null`, 제목 순 |
| REQ-TOUR-010 상세 회차 | PASS | 같은 파일 | 정원 순서 `[11, 13, 12]`(시작 시각 순), 선택 가능 `[true, false, true]`, 마감 사유 `closed`, 지난 회차(정원 19) 없음. 회차 없는 공개 투어 → `sessions: []`. 설명(빈 줄 포함)·집결 장소·대표 이미지(대체 텍스트, 주소에 파일명, 가로 1) |
| 없는 slug / 형식 오류 slug | PASS | 같은 파일 | `<표식>-missing` → `null`. `Not_A_Slug`·빈 문자열 → `null`이고 DB 조회 0회 |

품질: `pnpm typecheck` 0, `pnpm lint` 0, `pnpm format:check` 0. `git diff --stat a3cc21c -- pnpm-lock.yaml package.json .prettierignore eslint.config.mjs pnpm-workspace.yaml` 출력 없음. 정리 확인(DB): `tours` `test-%` 0, `users` `%@example.test` 0, `tour_sessions` 0, `media` `test-%` 0, 전체 `users` 1, `media/` 파일 0.

### M4 — 화면: 토큰, 공통 조각, 목록·상세·404, 홈 링크

기준선(워크트리 `agent-acedc9994cdbf9ebe`, `ff00406`에서 `git merge --ff-only main`, HEAD `8dd69f1`): `pnpm test` 종료 코드 0, `Tests 228 passed (228)`, `src/lib/` 라인 100%(153/153). `pnpm e2e` 종료 코드 0, `4 passed`. 로그: `.moai/state/verify/a08890a8/tour-m4/baseline-{test,e2e}.log`

RED(구현 전):
- 단위·저장소 규칙(`npx vitest run --project unit --coverage.enabled=false tests/unit/status-badge.spec.ts tests/unit/format.spec.ts tests/unit/repo-rules.spec.ts`, 종료 코드 1): `Test Files 3 failed (3)`, `Tests 12 failed | 54 passed (66)`. 실패 — `Cannot find module '../../src/lib/status-badge'`, `TypeError: splitParagraphs is not a function`(4건), `--color-accent:를 담은 파일이 있어야 한다: expected 0 to be greater than or equal to 1`(3건), `ENOENT … src\app\(frontend)\tours\page.tsx`·`[slug]\page.tsx`·`scandir … tours`(5건). 로그: `red-unit.log`
- E2E(`pnpm e2e`, 종료 코드 1): `14 failed`, `12 passed`. 실패 — 홈 `/tours` 링크 `Expected: 1 Received: 0`, 목록·상세 `Expected: 200 Received: 404`, 회차 라디오 `Expected: 3 Received: 0` 등 새 화면 14건. 통과 12건 = 기존 4건 + 익명 API 5건(M1 접근 규칙이 이미 충족 — 이 마일스톤에서 새로 생긴 동작이 아니라 E2E 증거 추가) + 404 3건(경로가 없어서 404 — 구현 뒤 경로가 생긴 상태에서 다시 통과해야 의미가 있으며 GREEN에서 통과). 로그: `red-e2e.log`

GREEN·최종(같은 작업 트리, 커밋 직전):

| 단계 | 명령 | 결과 | 로그 |
|---|---|---|---|
| 생성 파일 | `pnpm generate:types`, `pnpm generate:importmap` | 둘 다 0, 이후 `git status --short`에 두 파일 없음 | `gen-types.log`, `gen-importmap.log` |
| 타입 | `pnpm typecheck` | 0 | `typecheck.log` |
| 빌드 | `pnpm build` | 0. 경로 표 `○ /`, `ƒ /tours`, `ƒ /tours/[slug]` | `build.log` |
| 사전 렌더링 목록 | Node로 같은 판정(아래 차이 참고) | `app-path /tours: true`, `app-path /tours/[slug]: true`, `prerender routes has /: true`, `prerender routes has /tours: false`, `dynamicRoutes has /tours/[slug]: false`, routes 키 `["/","/_global-error","/_not-found"]` | `prerender-manifest.log` |
| 단위·통합 | `pnpm test` | 0. `Test Files 15 passed (15)`, `Tests 246 passed (246)`, `src/lib/` 라인 100%(161/161), 분기 92.19% | `final-test.log` |
| E2E | `pnpm e2e` | 0. `26 passed (31.0s)` | `final-e2e.log` |
| 린트·포맷 | `pnpm lint`, `pnpm format:check` | 0, 0(`All matched files use Prettier code style!`) | `lint.log`, `format.log` |
| 의존성 | `git diff --stat ff00406 -- pnpm-lock.yaml package.json .prettierignore eslint.config.mjs pnpm-workspace.yaml` | 출력 없음 | — |

연결 호출 변이 확인: `/tours`의 `await connection()`을 잠시 `void connection`으로 바꾸고 `pnpm build` → 경로 표 `○ /tours`, `prerender routes has /tours: true`(키에 `/tours` 추가). 되돌린 뒤 다시 빌드해 위 표의 결과를 얻었다. 로그: `mutation-no-connection{,-build}.log`

| AC | 상태 | 확인 방법 | 결과 |
|---|---|---|---|
| AC-TOUR-006 (REST·GraphQL·파일 주소) | PASS | `tests/e2e/catalog-api.spec.ts`(로그인하지 않은 요청) | `GET /api/tours?where[slug][equals]=` 공개 1·비공개 0, `GET /api/tour-sessions?where[tour][equals]=` 공개 ≥1·비공개 0, GraphQL `Tours(where: {slug: {in: [공개, 비공개]}})` 결과 slug = 공개 하나, 파일 주소 a 200·b·c 200 아님, 익명 `POST /api/tours` 2xx 아님 + 로컬 API 조회 0건 |
| AC-TOUR-010 | PASS | `tests/e2e/tours-list.spec.ts` | 200 + 포트 단언, O 카드에 요약·`4시간 30분`·`45,000원 · 현장 결제`·"모집 중"·+2일 일시·`남은 자리 11 / 11`, 이미지 `alt` 일치·`naturalWidth > 0`, C 카드 "모집 마감"·"남은 자리" 없음·`img` 0개·자리표시 블록, 두 배지 모두 `svg` 1개 + 글자, H 제목 0건, 카드 링크 → `/tours/<O slug>` |
| AC-TOUR-011 | PASS | `tests/e2e/tour-detail.spec.ts` | `h1`·이미지 대체 텍스트·설명 두 문단이 서로 다른 `<p>`·소요 시간·집결 장소·가격, 회차 순서 `11 / 11` → `13 / 13` → `12 / 12`, `/ 19` 없음, 마감 라디오 `disabled` + "마감" 배지, 클릭으로 하나만 선택, `ArrowDown`이 마감 회차를 건너뛰어 +5일 회차로 이동·선택, 회차 없는 E에 "예정된 회차가 없습니다" |
| AC-TOUR-012 | PASS | 같은 파일 | `test-<무작위>-missing` 404, H slug 404 + H 제목 0건, `Not_A_Slug` 404 |
| AC-TOUR-013 | PASS | 빌드 매니페스트 + `tests/unit/repo-rules.spec.ts` + `tour-detail.spec.ts` | 위 표의 매니페스트 판정. 저장소 규칙: 두 페이지가 `next/server`의 `connection` import + `await connection()`, `generateStaticParams` export 없음, `tours/` 아래 loading 파일 없음(R21). E2E: 로컬 API로 제목을 `test-…-renamed`로 바꾸고 새로고침 → 상세 `h1`·목록 모두 새 제목 |
| AC-TOUR-014 | PASS | `repo-rules.spec.ts` + E2E | `--color-accent:` 파일은 `src/app/(frontend)/tokens.css` 하나, 불러오는 파일은 `src/app/(frontend)/globals.css`(`@import "./tokens.css"`)뿐, `(payload)` 참조 0건, AC-INFRA-009 계속 통과. O 배지 배경 `rgb(226, 244, 236)`. 375×812에서 `/tours`·상세 `scrollWidth ≤ 375`, 모집 중 회차 라벨 높이·너비 ≥ 44 |
| AC-TOUR-015 | PASS | `tests/e2e/home.spec.ts` | 기존 2건 그대로 통과(`h1` 36px 유지), 새 테스트: `a[href="/tours"]` 1개 클릭 → 경로 `/tours` + 포트 단언 |

R14(미디어 주소 형태) 실측: E2E 서버(포트 3100)에서 카드 이미지 `src` = `http://localhost:3100/api/media/file/test-a9c69091-a.png` — Payload가 `serverURL`을 붙인 절대 주소. `next/image`를 `unoptimized`로 쓰므로 주소 가공·경로 허용 검사가 없어 `next.config.ts`에 `images.localPatterns`를 되살리지 않았다(주석만 현재 상태로 고침). E2E가 같은 출처·`/api/media/file/<파일명>` 경로·실제 로드를 확인한다. 로그: `r14-probe.json`

차이·사건:
- 사전 렌더링 판정은 acceptance.md의 PowerShell 명령 대신 같은 판정을 Node로 실행했다. 이 워크트리 격리 에이전트에서는 `powershell.exe` 실행이 차단되었다(같은 JSON 파일·같은 키 비교)
- 최종 `pnpm test` 1회차 도중 공용 PostgreSQL 컨테이너(`sumbi-tour-postgres-1`)가 종료 코드 255로 멈췄다(가동 04:21:10Z → 05:21:08Z, 재시작 정책 없음, 이 작업의 명령이 아님). 통합 테스트가 `Connection terminated unexpectedly`·`ECONNREFUSED 127.0.0.1:5432`로 실패. `docker compose up -d --wait`로 다시 올려 `healthy` 확인(이름 붙은 볼륨이라 데이터 유지 — 실제 관리자 1건 그대로), 남은 테스트 데이터 0건 확인 뒤 다시 실행해 통과
- 회차 배지 문구: 선택 불가 사유 `closed` → "마감", `full` → "자리 없음", `past` → "지난 회차"(`src/lib/status-badge.ts`). 지금은 점유 인원이 0이고 지난 회차는 상세에서 빠지므로 화면에는 "모집 중"/"마감"만 나온다

정리 확인(최종 E2E 뒤, DB): `tours` `test-%` 0, `tour_sessions` 전체 0, `media` `test-%` 0, `users` `%@example.test` 0, 전체 `users` 1, `media/` 디렉터리 있음·파일 0. 포트 3100 비어 있음(3000은 이 작업 전부터 떠 있던 다른 node 프로세스 PID 632 — 건드리지 않음). 로그: `cleanup-db.log`

### M5 — 개발용 시드

기준선(워크트리 `agent-a099d40de734716f5`, `ff00406`에서 `git merge --ff-only main`, HEAD `9fc8751`): `pnpm test` 종료 코드 0, `Tests 246 passed (246)`, `src/lib/` 라인 100%(161/161). `pnpm e2e` 종료 코드 0, `26 passed`. DB: 전체 `users` 1, 투어·회차 0, 시드 slug 0. 로그: `.moai/state/verify/a08890a8/tour-m5/baseline-{test,e2e}.log`

R17 재확인(빈 스크립트·거부 스크립트, `"type": "module"` 폴더의 임시 `.ts`를 `payload run`으로 실행): `process.exitCode = 3`만 설정 → 종료 코드 0, 최상위 `await` 뒤 `throw` → 종료 코드 1(`Error running script: …` + `Error: probe refuse`). 로그: `r17-probe-{exitcode,throw}.log`. 따라서 거부는 예외로 끝내고 진입점은 최상위 `await`로 기다린다

RED(구현 전):
- 단위·저장소 규칙(`npx vitest run --project unit --coverage.enabled=false tests/unit/seed-guard.spec.ts tests/unit/repo-rules.spec.ts`, 종료 코드 1): `Test Files 2 failed (2)`, `Tests 2 failed | 56 passed (58)`. 실패 — `Error: Cannot find module '../../src/lib/seed'`(seed-guard 파일 전체), `AssertionError: expected '' to match /^cross-env NODE_OPTIONS=--no…/seed\.ts$`(seed 스크립트 없음), `AssertionError: expected -1 to be greater than 3356`(README에 `pnpm seed` 없음). 로그: `red-unit.log`
- 통합(`npx vitest run --project integration --coverage.enabled=false tests/integration/seed.spec.ts`, 종료 코드 1): `Test Files 1 failed (1)`, `Tests no tests`. 실패 — `Error: Cannot find module '../../src/lib/seed'`. 모듈을 불러오기 전에 실패하므로 DB에 데이터가 만들어지지 않았다. 로그: `red-integration.log`

GREEN·최종:

| 단계 | 명령 | 결과 | 로그 |
|---|---|---|---|
| 단위·저장소 규칙 | 위 RED와 같은 명령 | 0. `Tests 77 passed (77)` | `green-unit.log` |
| 통합 | 위 RED와 같은 명령 | 0. `Tests 3 passed (3)` | `green-integration.log` |
| 타입·린트·포맷 | `pnpm typecheck`, `pnpm lint`, `pnpm format:check` | 0, 0, 0(`All matched files use Prettier code style!`) | `typecheck.log`, `lint.log`, `format.log` |
| 단위·통합 전체 | `pnpm test` | 0. `Test Files 17 passed (17)`, `Tests 275 passed (275)`, `src/lib/` 라인 100%, 분기 91.87%(`seed.ts` 라인 100%·분기 89.47% — `now` 기본값, 빈 목록 줄 생략 분기) | `final-test.log` |
| E2E(시드 데이터가 있는 상태) | `pnpm e2e` | 0. `26 passed (31.9s)` — 시드 투어 3개가 목록에 함께 있어도 테스트는 자기 표식 카드만 본다(R15) | `final-e2e.log` |

| AC | 상태 | 확인 방법 | 결과 |
|---|---|---|---|
| AC-TOUR-016 Given | PASS | 시드 slug 개수 조회(`psql … slug IN ('hallasan-yeongsil','udo-bike','haenyeo-experience')`) | 실행 전 `0`(`seed-before-counts.log`) |
| AC-TOUR-016 실행 2회 | PASS | `pnpm seed` → `seed-1.log`, 다시 `pnpm seed` → `seed-2.log` | 둘 다 종료 코드 0. 1회 `[seed] created 3, skipped 0, sessions created 7`, 2회 `[seed] created 0, skipped 3, sessions created 0`. 시드 slug 개수 두 실행 뒤 `3`, 회차 7(`seed-after-2-counts.log`) |
| AC-TOUR-016 데이터 모양 | PASS | 시드 투어·회차 조회(서울 시각) | 세 투어 모두 `published = t`. 회차 시작(서울) — 영실 11-13 09:00 모집 중 / 11-15 09:00 마감 / 11-20 09:00 모집 중, 우도·해녀 11-13·11-20 09:00 모집 중. 정원 15·12·10, 가격 문구 45,000·38,000·55,000원 · 현장 결제(`seed-detail.log`) |
| AC-TOUR-016 화면 | PASS(HTML 확인) | 임시 `next dev --port 3101`을 띄워 `/tours`·상세 HTML 확인 후 직접 띄운 프로세스 트리만 종료 | `/tours` 200, 세 제목 모두 있음, "모집 중" 6회(카드 3개 × 배지), "모집 마감" 0회. 상세 3개 200, 영실 상세에 "마감" 배지 1개. 종료 뒤 3101 응답 없음(`seed-pages.log`). 사람이 브라우저로 본 확인은 아님 |
| AC-TOUR-016 거부 1 | PASS | `NODE_ENV=production pnpm seed` | 종료 코드 1, `SeedRefusedError: Refusing to seed: NODE_ENV is "production". …`, `Pulling schema` 0줄(DB 연결 전), 개수 그대로 3(`seed-prod.log`, `seed-after-refusals-counts.log`) |
| AC-TOUR-016 거부 2 | PASS | `DATABASE_URL='postgres://seed:probe-pass-7731@db.example.com:5432/x' pnpm seed` | 종료 코드 1, `Refusing to seed: database host "db.example.com" is not local (allowed: localhost, 127.0.0.1, ::1).`, `db.example.com` 1줄, `probe-pass-7731` 0줄, `Pulling schema` 0줄(`seed-remote.log`) |
| AC-TOUR-016 단위 | PASS | `tests/unit/seed-guard.spec.ts` | `production` 거부(메시지에 `NODE_ENV`), `localhost`·`127.0.0.1`·`[::1]` 허용, `db.example.com`·`10.0.0.5`·`127.0.0.2`·`[::2]`·`localhost.example.com` 거부(호스트만, 비밀번호 없음), 빈 값·빈 문자열·URL 아님·호스트 없음 → 거부(값 미포함). 서울 날짜 계산(UTC 전날·월 넘김), 요약 문자열 |
| AC-TOUR-016 통합 | PASS | `tests/integration/seed.spec.ts` | 표식 데이터 집합 2개 투어·5회차: 1회 `created` 2·공개·회차 일시 = 서울 09:00·상태 `[open, closed, open]`·종료 = 시작 + 150분. 관리자 제목 수정 뒤 2회 `skipped` 2, 투어·회차 수 그대로, 수정한 제목 유지. 회차 생성 실패(정원 0) → 예외, 그 투어가 남지 않음 |
| AC-TOUR-016 저장소 규칙 | PASS | `tests/unit/repo-rules.spec.ts` | `seed` = `cross-env NODE_OPTIONS=--no-deprecation payload run scripts/seed.ts`, 다른 스크립트에 `seed` 0건(대조 확인 포함), `postinstall`·`prepare`·`preinstall`·`install` 없음, README에서 `pnpm seed`가 "개발 서버" 절 뒤 |

차이·결정:
- 거부 판정은 진입점 맨 앞에서 실행하고, Payload 설정은 판정 뒤에 동적 `import`로 불러온다(설정 모듈의 필수 변수 점검보다도 먼저 거부 이유가 나오게)
- 회차 생성이 중간에 실패하면 그 투어의 회차 → 투어 순서로 되돌린다. 반쯤 만든 투어가 남으면 다음 실행이 slug만 보고 건너뛰어 회차가 빠진 채로 굳기 때문이다(통합 테스트로 확인)
- 시드 투어의 설명·집결 장소·소요 시간(270·180·120분)은 핸드오프에 없는 값이라 가상 문구로 채웠다(가격·이름만 핸드오프 기준)
- README는 "6. 개발 서버 실행" 절 끝에 `### 샘플 투어 넣기(선택)` 한 단락만 더했다. `## ` 절을 새로 만들면 뒤 절 번호가 바뀌므로 피했고, 단락에 `pnpm test`·`pnpm e2e`·관리자 주소 문자열은 쓰지 않았다(D10, AC-INFRA-016 순서 검사 계속 통과)
- 거부 확인은 acceptance.md의 PowerShell `$env:` 대신 Bash 환경 변수 접두로 실행했다(이 워크트리 격리 에이전트에서 `powershell.exe` 실행 차단, 같은 `pnpm seed` 명령·같은 값)

시드 데이터는 개발 DB에 남겨 두었다(사용자 개발 데이터). 정리 확인(최종 E2E 뒤): 전체 `users` 1, `users` `%@example.test` 0, `tours` `test-%` 0, 표식 회차 0, `media` `test-%` 0, 시드 투어 3·회차 7. 로그: `cleanup-db.log`

커밋: `4e4e5ba` `feat(SPEC-TOUR-001): M5 개발용 시드`

### M6 — 회귀 정리와 품질 게이트

최종 트리(HEAD `4e4e5ba`, 작업 트리 변경 없음)에서 `plan.md` §E-1 순서대로 실행했다. 이 마일스톤은 새 동작을 더하지 않으므로 새 RED는 없다(M1~M5의 RED 기록이 각 동작의 근거). 로그: `.moai/state/verify/a08890a8/tour-m6/`

| 단계 | 명령 | 결과 | 로그 |
|---|---|---|---|
| DB | `docker compose ps --format '{{.Service}} {{.Health}}'` | `postgres healthy` | `compose-ps.log` |
| 생성 파일 | `pnpm generate:types`, `pnpm generate:importmap` | 0, 0. 이후 `git status --short` 출력 없음(두 생성 파일이 커밋된 상태와 같음) | `gen-types.log`, `gen-importmap.log` |
| 타입 | `pnpm typecheck` | 0 | `typecheck.log` |
| 빌드 | `pnpm build` | 0. 경로 표 `○ /`, `ƒ /tours`, `ƒ /tours/[slug]` | `build.log` |
| 사전 렌더링 목록(AC-TOUR-013) | Node로 같은 판정 | `app-path /tours: true`, `app-path /tours/[slug]: true`, `prerender routes has /: true`, `prerender routes has /tours: false`, `dynamicRoutes has /tours/[slug]: false`, routes 키 `["/","/_global-error","/_not-found"]` | `prerender-manifest.log` |
| 단위·통합·저장소 규칙 | `pnpm test` | 0. `Test Files 17 passed (17)`, `Tests 275 passed (275)` | `final-test.log` |
| 커버리지 | `coverage/coverage-summary.json` total | 라인 100%(201/201), 분기 91.87%(147/160). 파일별 라인 모두 100% | `coverage-total.log` |
| E2E | `pnpm e2e` | 0. `26 passed (30.7s)`(기존 4 + 이 SPEC 22) | `final-e2e.log` |
| 린트 | `pnpm lint` | 0 | `lint.log` |
| 포맷 | `pnpm format:check` | 0, `All matched files use Prettier code style!` | `format.log` |
| 의존성·검사 설정 | `git diff --stat ff00406 -- pnpm-lock.yaml .prettierignore eslint.config.mjs pnpm-workspace.yaml` | 출력 없음. `package.json` 차이는 `seed` 스크립트 한 줄뿐 | — |
| SPEC-INFRA-001 유지 | `git diff --stat ff00406 -- src/lib/preflight.ts scripts/preflight.mjs tests/helpers/e2e-env.ts vitest.config.mts src/collections/Users.ts "src/app/(payload)" playwright.config.ts docker-compose.yml .env.example .gitattributes prettier.config.mjs` | 출력 없음. AC-INFRA-* 저장소 규칙·홈 E2E는 위 `pnpm test`·`pnpm e2e`에서 계속 통과 | — |
| 범위 밖 경로 | `git diff --name-only ff00406` 중 `.claude/`·`.github/`·`.git_hooks/`·`CLAUDE.md`·`.mcp.json`·`.moai/project/`·`.moai/state/`·`AGENTS.md`·`media/`·`.env` | 0건(변경 파일 54개) | `changed-files.log` |

| AC | 상태 | 확인 방법 | 결과 |
|---|---|---|---|
| AC-TOUR-009 | PASS | 위 표 + DB·`media/` 정리 확인 | `pnpm test`·`pnpm e2e` 모두 0, `src/lib/` 라인 100%(기준 85%). 두 명령 뒤 `tours` `test-%` 0, `users` `%@example.test` 0, 표식 회차 0, `media` `test-%` 0, 전체 `users` 1. `media/` 있음 `true`, `test-*` 파일 0(`cleanup-db.log`). `git check-ignore -q media/probe.png` → 0 |

MX 태그 확인(`src/` 검색): 계산 지점 `@MX:ANCHOR`(`session-availability.ts`)와 신청 SPEC 확장 지점 `@MX:NOTE`(`session-availability.ts`·`catalog.ts`·`SessionList.tsx`), 미디어 읽기 조건 `@MX:DEBT` + `@MX:CEILING` + `@MX:UPGRADE`(`access.ts`), 시드 거부 `@MX:NOTE`·멱등성 `@MX:NOTE`(`seed.ts`). ANCHOR·WARN에는 모두 `@MX:REASON`이 있다. 파일별 한도(ANCHOR 3, WARN 5, NOTE 10) 안

정리: 포트 3100·3101 비어 있음(3101은 M5 화면 확인에 직접 띄웠다가 종료). 3000은 작업 전부터 있던 프로세스로 건드리지 않음. 임시 확인 스크립트는 저장소 밖(세션 임시 폴더)에만 두었다

## §E.3 Run-phase Audit-Ready Signal

```yaml
run_status: audit-ready
run_complete_at: 2026-11-10
run_commit_sha: pending-backfill   # M6 커밋 자신(커밋은 자기 SHA를 담을 수 없음). M6 SHA는 완료 보고와 git log로 확인
milestones:
  M1: a3cc21c   # 데이터 모델과 접근 규칙
  M2: eaecd30   # 남은 자리·표시 도우미
  M3: 8dd69f1   # 카탈로그 조회 계층
  M4: 9fc8751   # 화면: 토큰, 공통 조각, 목록·상세·404, 홈 링크
  M5: 4e4e5ba   # 개발용 시드
  M6: pending-backfill   # 회귀 정리와 품질 게이트(이 기록)
m1_to_mN_commit_strategy: 마일스톤마다 커밋 하나, 경로 명시 스테이징, 푸시하지 않음(origin/main = ff00406)
ac_pass_count: 16
ac_fail_count: 0
ac_matrix:   # automated = pnpm test / pnpm e2e가 매번 확인, manual = 사람이 아닌 일회성 확인 포함
  AC-TOUR-001: {status: PASS, automated: integration}
  AC-TOUR-002: {status: PASS, automated: integration + repo-rules, manual: "관리자 업로드 화면 자르기·초점 도구 없음 — 임시 Playwright(M1)"}
  AC-TOUR-003: {status: PASS, automated: integration}
  AC-TOUR-004: {status: PASS, automated: integration, manual: "관리자 일시 입력이 서울 기준으로 저장됨 — 임시 Playwright, 브라우저 시간대 뉴욕(M1)"}
  AC-TOUR-005: {status: PASS, automated: integration + unit}
  AC-TOUR-006: {status: PASS, automated: integration(로컬 API·조회 계층) + e2e(REST·GraphQL·파일 주소)}
  AC-TOUR-007: {status: PASS, automated: integration}
  AC-TOUR-008: {status: PASS, automated: unit}
  AC-TOUR-009: {status: PASS, automated: "pnpm test·pnpm e2e 종료 코드 + 커버리지 임계값", manual: "실행 뒤 DB·media/ 정리 조회(M6)"}
  AC-TOUR-010: {status: PASS, automated: e2e}
  AC-TOUR-011: {status: PASS, automated: e2e}
  AC-TOUR-012: {status: PASS, automated: e2e}
  AC-TOUR-013: {status: PASS, automated: repo-rules + e2e, manual: "빌드 뒤 사전 렌더링 목록 판정(M4·M6, Node)"}
  AC-TOUR-014: {status: PASS, automated: repo-rules + e2e}
  AC-TOUR-015: {status: PASS, automated: e2e}
  AC-TOUR-016: {status: PASS, automated: unit + integration + repo-rules, manual: "pnpm seed 2회·거부 2종·/tours HTML 확인(M5)"}
invariants:
  preserve_list_post_run_count: 0      # preflight·e2e 포트·Users·커버리지 설정·(payload) 템플릿·검사 제외 목록·잠금 파일 변경 0건
  lockfile_unchanged: true
  generated_files_in_sync: true        # generate:types·generate:importmap 뒤 git status 비어 있음
  new_warnings_or_lints_introduced: 0
coverage_src_lib: {lines: "100% (201/201)", branches: "91.87% (147/160)", threshold_lines: 85}
test_counts: {vitest: 275, e2e: 26}
cross_platform_build:
  windows: "pnpm build 0 (이 PC, Windows 11, Node 24)"
  other_os: not-run   # 이 단계에서 다른 OS 빌드는 실행하지 않음. CI가 맡는다
l44_pre_commit_fetch: not-run   # 지시에 따라 푸시하지 않음, 원격 갱신 확인도 하지 않음
l44_post_push_fetch: not-applicable
total_run_phase_files: 54   # git diff --name-only ff00406 (SPEC 문서 6개 포함)
dev_db_state_after_run: {users_total: 1, test_data: 0, seed_tours: 3, seed_sessions: 7}
known_gaps:
  - "PowerShell 전용 확인(사전 렌더링 목록의 ConvertFrom-Json 판정, AC-TOUR-009의 Test-Path·Get-ChildItem, AC-TOUR-016의 $env: 거부·*> 로그·Select-String)은 같은 판정을 Node/Bash로 실행했다 — 이 워크트리 격리 에이전트에서 powershell.exe 실행이 차단됨. 판정 대상 파일·값·명령(pnpm seed)은 같다"
  - "AC-TOUR-016 화면 확인은 임시 next dev(3101)에서 받은 HTML의 제목·배지 문자열 확인이다. 사람이 브라우저로 본 확인은 아니다"
  - "AC-TOUR-002·004 수동 확인은 M1의 임시 Playwright 확인이며 사람이 관리자 화면을 직접 조작한 기록은 아니다"
  - "다른 OS(macOS·Linux) 빌드·테스트는 이 단계에서 실행하지 않았다"
residual_risks:
  - "시드 회차는 실행일 기준(+3·+5·+10일)이라 열흘이 지나면 모두 지난 회차가 되고, 다시 실행해도 slug가 있어 건너뛴다. 새로 받으려면 관리자 화면에서 시드 투어의 회차 → 투어를 지운 뒤 다시 실행해야 한다"
  - "시드 되돌리기는 같은 연결에서 회차 → 투어를 지우는 방식이다. 되돌리기 자체가 실패하면(예: DB 연결 끊김) 회차가 빠진 투어가 남을 수 있다"
  - "공용 PostgreSQL 컨테이너가 M4 도중 한 번 종료 코드 255로 멈췄다(원인 미상, 재시작 정책 없음). M5·M6에서는 재발하지 않았다"
  - "서울 시각 계산은 UTC+9 고정(일광 절약 시간 없음)을 전제로 한다"
  - "src/lib/ 분기 커버리지 91.87% — 남은 분기는 catalog.ts의 방어 분기(막힌 이미지 ID·url 없음 등)와 기본 인자"
```

## §F Phase 4 Mode Selection

- 입력: Tier M, 마일스톤 6개, 예상 파일 30개 안팎, 도메인 1개(투어 카탈로그 — 데이터 모델·화면·시드), TypeScript 중심, 동시 실행 이점 낮음(코딩 위주, `package.json`·개발 DB 공유)
- 평가: `direct` 아님(다파일 구현) / `fanout` 아님(연구가 아닌 코딩, 3도메인 미만) / `sweep` 아님(기계적 일괄 변환 아님) / `serial` 선택
- Decision: serial
- 근거: 코딩 위주 작업이고 같은 `package.json`과 개발 DB를 공유해 병렬 작성 시 충돌 위험이 크다. Anthropic의 코딩 작업 병렬화 주의(코딩은 연구보다 진짜 병렬 가능한 작업이 적다)에 따라 마일스톤마다 manager-develop 하나를 순차 위임한다

## §E.4 Sync-phase Audit-Ready Signal

_<sync 단계에서 작성>_
