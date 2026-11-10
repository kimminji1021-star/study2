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

## §E.3 Run-phase Audit-Ready Signal

_<run 단계 완료 시 작성 — M1~M4 완료, M5~M6 남음>_

## §F Phase 4 Mode Selection

- 입력: Tier M, 마일스톤 6개, 예상 파일 30개 안팎, 도메인 1개(투어 카탈로그 — 데이터 모델·화면·시드), TypeScript 중심, 동시 실행 이점 낮음(코딩 위주, `package.json`·개발 DB 공유)
- 평가: `direct` 아님(다파일 구현) / `fanout` 아님(연구가 아닌 코딩, 3도메인 미만) / `sweep` 아님(기계적 일괄 변환 아님) / `serial` 선택
- Decision: serial
- 근거: 코딩 위주 작업이고 같은 `package.json`과 개발 DB를 공유해 병렬 작성 시 충돌 위험이 크다. Anthropic의 코딩 작업 병렬화 주의(코딩은 연구보다 진짜 병렬 가능한 작업이 적다)에 따라 마일스톤마다 manager-develop 하나를 순차 위임한다

## §E.4 Sync-phase Audit-Ready Signal

_<sync 단계에서 작성>_
