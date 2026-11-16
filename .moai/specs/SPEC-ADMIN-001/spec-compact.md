# SPEC-ADMIN-001 (compact) — 관리자 운영 기능

> run 단계용 요약본. 원본: `spec.md`(요구사항·용어·가정), `acceptance.md`(오류 코드·수용 기준), `plan.md`(결정·근거·마일스톤·위험), `interview.md`(사용자 결정). 내용이 다르면 원본이 우선한다.
> Tier M · status: draft · 문서 버전 0.1.2(2026-11-16, plan-audit 2회차 반영) · 개발 방식: TDD · 검증 셸: Windows PowerShell 5.1 · 의존: SPEC-APPLY-001(completed) · 기준 HEAD `a8cf60b`(최초 계획 `8a4cdd1`, 사이 커밋은 화면·디자인만 — `plan.md` §A.1)

## 사용자 결정 (구속)

D1 상태는 관리자 신청 상세에서만 — `status`만 편집(대기·확정·취소 자유 전환), 나머지 필드 읽기 전용, 일괄 작업 없음 · D2 취소 복원이 정원을 넘으면 차단, 취소로 마감 안 풀림, 사이트 접수와 같은 회차 행 잠금으로 동시성 안전, `cancelledAt` 처리는 초안 작성자가 정함 · D3 "요청 사항 삭제" 동작 하나로만 글 전체 삭제 + 삭제 시각 기록 · D4 회차별 참가자 CSV(접수번호·이름·연락처·이메일·인원·상태·요청 사항), 관리자 전용, UTF-8 BOM, 수식 주입 차단, URL·파일 이름에 개인정보 없음, 캐시 금지 · D5 관리자 첫 화면의 다가오는 회차 표(투어·시작 일시·정원·대기·확정·남은 자리·상태), 단일 점유 정의, N+1 없음, 행마다 CSV 링크, 차트 없음 · D6 작업 기록(누가·무엇을·언제 — 상태 변경 이전→이후, 요청 사항 삭제, CSV 회차), 개인정보 없음, 덧붙이기 전용, 관리자는 읽기만 · D7 제외: 이메일, 일괄 변경, 차트, 회원, 배포, SPEC-APPLY-001 F1·F2.

추가 확인(2026-11-16): 복원으로 정원이 꽉 차면 자동 마감 · CSV에 취소 신청 포함(상태 열로 구분) · 대시보드에 비공개 투어의 회차도 보이고 **`비공개` 표시** · 작업 기록 보관 2년(자동 삭제는 배포 단계, 법정 기준은 변호사 확인).

## 핵심 결정 (plan.md §B)

- 편집 범위: `applications` `update: isAdmin && id 있음`, `disableBulkEdit: true`(일괄 수정 API·화면 403), `status` 외 모든 필드 `access.update: () => false`(Payload가 값을 오류 없이 버리고 화면에서 읽기 전용 — `beforeValidate/promise.js` 219~246, `RenderFields/index.js` 53~68). 저장소 규칙: `access.update` 없는 이름 있는 필드 = `status` 하나. `create`·`delete` 거부, `read` 관리자 그대로. 새 필드 `requestsDeletedAt`
- **Payload 전제(1회차 감사 D1)**: 필드 `beforeValidate`가 요청에 없던 필드를 잠금 전 `originalDoc` 값으로 채운다(`promise.js` 179~191·238~246, `getFallbackValue.js` 6). → 컬렉션 `beforeChange`의 `data.status`는 **항상** 있고, 요청에 없던 `requests`·`requestsDeletedAt`·`cancelledAt`도 잠금 전 값으로 실린다
- **모든 신청 수정 = 한 가지 잠금 순서**: `beforeOperation`(필드 처리 전, `updateByID.js` 59~66)이 원본 `args.data`에 `status` 키가 있는지를 `req.context`의 **신청 ID 키** 항목에 `statusRequested`로 적음 → `beforeChange`는 **모든 수정**에서: `transactionDb` → `lock_timeout 5000` → **회차 없는 신청이면 잠그기 전에 모든 수정 `SESSION_MISSING`(409)**(`session` `required: true`라 어떤 저장도 필드 검증에서 실패 — `Applications.ts` 70~74, `getFallbackValue.js` 6, `validations.js` 569~573) → 회차 행 `FOR UPDATE` → 신청 행 `FOR UPDATE` → 잠금 뒤 별도 문장으로 현재 값 읽기(`session_id`가 바뀌었으면 `SESSION_MISSING`) → **잠긴 필드(`requests`·`requestsDeletedAt`·`cancelledAt`)를 모든 분기보다 먼저 현재 값으로 덮어씀, 상태 변경 요청이 아니면 `status`도 현재 값** → 요청 사항 삭제 표시면 비었을 때 `REQUESTS_EMPTY`, 아니면 비우고 삭제 시각(표시는 쓴 뒤 지움) → 상태 변경 요청 아님·같은 상태면 끝(기록 없음) → 취소 복원: 점유 + 인원 > 정원 `RESTORE_CAPACITY_EXCEEDED`(409), = 정원이고 `open`이면 **트랜잭션 연결의 원시 SQL** `UPDATE tour_sessions SET status = 'closed', updated_at = now()`로 마감(중첩 `payload.update` 금지 — 문서 잠금 행 삭제가 행 잠금 뒤에 끼어 교착 가능, 2회차 감사 N1) → `cancelledAt` → `afterChange`가 신청 ID 키 항목으로 작업 기록(실패하면 전부 되돌림, `updateByID.js` 240) → 55P03·40P01은 `SESSION_BUSY`(409), 그 밖 원시 오류는 원인 없는 고정 문구. 잠금 순서: 모든 신청 수정 (Payload 문서 잠금 행 삭제, `update.js` 48 — 행 잠금 전·5초 제한 밖) → 회차 → 신청, 사이트 접수 회차만 + 새 행 삽입 → `applications`·`tour_sessions` 행 사이 순환 대기 없음. 행 잠금을 쥔 뒤 문서 잠금 행을 건드리지 않음. 문서 잠금 행 대기(늦어짐만)와 사이트 접수 자동 마감의 교착 가능성은 R26(범위 밖 이월)
- `cancelledAt`: → 취소면 처리 시각, 취소 → 대기·확정이면 비움, 대기↔확정·같은 값은 그대로(보관 기준일 = `cancelledAt ?? 회차 종료`)
- 요청 사항 삭제: `POST /api/applications/:id/clear-requests` — 관리자 아님 403 `FORBIDDEN` / ID 오류·없음 404 / 트랜잭션 + 잠금 없는 존재 확인 / `req.context`에 신청 ID 키로 삭제 표시 / `payload.update(… overrideAccess: true)`로 위 보호 구간 통과(신청 행을 먼저 잠그지 않음) / 작업 기록 / 테스트 전용 `beforeCommit` / 커밋. `REQUESTS_EMPTY`·`SESSION_BUSY`·`SESSION_MISSING` 409, 그 밖 500. 회차 없는 신청의 요청 사항 삭제는 F1 해결 때. `requestsConsentAt`·상태 유지. 화면: `type: 'ui'` 필드 버튼 + 확인 단계
- CSV: `GET /api/tour-sessions/:id/participants-csv`, 파일 이름 `session-<id>-participants.csv`. 관리자 아님·`Sec-Fetch-Site: cross-site` 403, ID 오류·없음 404. 행 = 그 회차 모든 신청(취소 포함), 정렬 `['createdAt', 'id']`. BOM + CRLF + 모든 칸 큰따옴표(안의 `"` → `""`) + 첫 글자 `= + - @ \t \r`이면 `'`. 머리글 `text/csv; charset=utf-8`, `attachment`, `Cache-Control: no-store, private`, `nosniff`. 작업 기록 먼저 저장, 실패하면 500 본문 없음
- 대시보드: `admin.components.beforeDashboard` 서버 컴포넌트. 데이터 = 다가오는 회차(공개 여부 무관, `['startsAt', 'id']`) 1회 + 투어 `select: { title, published }` 1회 + `occupancy.ts` 새 상태별 합계 `GROUP BY session_id, status` 1회(같은 `OCCUPYING_STATUSES`) → `getSessionAvailability`. 비공개 투어 행은 투어 이름 칸에 `비공개` 표식(열 추가 없음). 행 수 제한 없음(`@MX:DEBT`)
- 작업 기록 `admin-audit-logs`: `action`(`application.status_change`/`application.requests_delete`/`session.participants_csv`), `actorId`(숫자, 사람 아닌 경로는 비움), `occurredAt`, `applicationId`, `referenceCode`, `sessionId`(회차 없는 신청은 기록이 생기지 않으므로 항상 채워짐), `fromStatus`·`toStatus`, `rowCount`. 개인정보 필드 없음. `read: adminOnly`, 쓰기 모두 거부, 필드 수정 거부. 테스트 정리는 회차 삭제 전에 회차 ID로 기록 삭제
- 로그(D4 결정): REQ-ADMIN-015는 **이 SPEC 코드**의 로그·오류로 한정. Payload `routeError` → `logError`가 저장 단계 DB 오류(`DrizzleQueryError` 메시지·`params`)를 스스로 기록하는 경로는 `afterError`·`loggingLevels`로 막을 수 없어(`routeError.js` 38~41 vs 57~86, `errors.js` 10~19 이름 `Error`) 잔여 위험 R23 + 출시 전 점검(배포 SPEC·변호사 확인)으로 넘김
- 테스트: 통합은 파일마다 `@example.test` 관리자, 상태 변경은 `payload.update(… user, overrideAccess: false)`(잡은 오류 `status` 409 단언), 사이트 접수 동시성은 `beforeCommit`으로 회차 잠금을 쥔 채 `pg_stat_activity` 확인, 삭제 ↔ 상태 변경 동시성은 테스트가 쥔 회차 잠금 + 삭제 함수 `beforeCommit`. E2E는 global-setup 테스트 관리자(`JWT` 머리글 요청 API + 로그인 화면, REST 409 단언). 원자성은 `vi.spyOn(payload, 'create')`로 기록 생성만 실패시킴. 실제 관리자 계정 사용 금지
- 새 npm 패키지 없음, `submit-application.ts` 불변

## 요구사항 (GEARS)

- **REQ-ADMIN-001** 시스템 제외 등록 목록 = `users`, `media`, `tours`, `tour-sessions`, `applications`, `application-attempts`, `admin-audit-logs`(REQ-APPLY-002 대체).
- **REQ-ADMIN-002** **While** 관리자 + 신청 한 건 ID → 수정 허용, 바뀌는 필드는 `status`뿐(다른 필드 값은 어떤 접근 규칙 경로로도 불변). 일괄 수정 모두 403. 비관리자 수정·모든 생성·삭제 거부(REQ-APPLY-003의 "관리자도 수정 거부"만 대체).
- **REQ-ADMIN-003** **When** 관리자가 상세를 열면 상태 선택(대기·확정·취소)·저장 버튼, 다른 필드 편집 불가. 목록에 "새로 만들기"·일괄 편집·일괄 삭제 없음.
- **REQ-ADMIN-004** **When** 상태 변경 저장 → 새 상태 저장, 취소면 `cancelledAt` = 처리 시각, 취소→활성은 비움, 대기↔확정 그대로. **When** 상태 변경 요청 값 = 잠금 뒤 현재 상태 → 상태·`cancelledAt`은 잠금 뒤 값, 기록 없음.
- **REQ-ADMIN-005** **When** 취소 복원 → 잠금 뒤 점유 + 인원 vs 정원. 초과 → `RESTORE_CAPACITY_EXCEEDED`(409), 아무것도 안 바뀜. 같고 `open` → 같은 트랜잭션에서 마감. 마감인데 자리 있음 → 복원, 마감 유지. **When** 회차 없는 신청의 수정(복원·다른 전환·같은 상태·상태 없는 수정·요청 사항 삭제 모두) → `SESSION_MISSING`(409), 아무것도 안 바뀜·기록 없음.
- **REQ-ADMIN-006** 상태 변경 요청·요청 사항 삭제를 포함한 **모든** 신청 수정은 회차 행 → 신청 행(회차 없는 신청은 잠그기 전 거부) 잠금 뒤 읽은 값으로만 판단·저장. 바꾸는 필드 외의 잠긴 필드와 상태 변경 요청이 아닌 수정의 `status`는 잠금 뒤 값으로 저장, 잠금 전 문서 값은 판단·저장에 쓰지 않음. 사이트 접수와 동시여도 점유 ≤ 정원, 삭제와 상태 변경이 동시여도 교착 없이 둘 다 남음. **When** 잠금 5초 초과 → `SESSION_BUSY`(409), 변경 없음.
- **REQ-ADMIN-007** **While** 회차 마감 → 취소가 회차 상태를 바꾸지 않음, 스스로 다시 열지 않음.
- **REQ-ADMIN-008** **While** 요청 사항 있음 → 상세에 "요청 사항 삭제"(확인 단계). **When** 확인 → 한 트랜잭션(REQ-006 잠금 순서)에서 글 전체 비움 + `requestsDeletedAt` + 작업 기록, 상태·`requestsConsentAt`·다른 필드 불변. 비었는지는 잠금 뒤 값으로 판단. 비었으면 409 `REQUESTS_EMPTY`, 비관리자 403, ID 오류·없음 404, 잠금 5초 초과 409 `SESSION_BUSY`, 회차 없는 신청 409 `SESSION_MISSING`, 그 밖 500 `INTERNAL_ERROR`(모두 변경 없음). 삭제 커밋 뒤 어떤 수정도 지운 글·빈 삭제 일시를 되돌리지 않음. 다른 방법으로는 요청 사항 변경 불가.
- **REQ-ADMIN-009** **When** 관리자가 회차 CSV 요청 → 그 회차 모든 신청 신청 시각 순, 머리글 7열, 상태 한국어, BOM·CRLF·전 칸 큰따옴표.
- **REQ-ADMIN-010** 첫 글자 `= + - @ \t \r` 칸은 `'` 접두. URL·파일 이름은 회차 ID만, `attachment` + `no-store`. **When** 비관리자·`cross-site` → 403, 회차 ID 오류·없음 → 404.
- **REQ-ADMIN-011** **When** 관리자 첫 화면 → 다가오는 회차 표(시작 순, 7열 + CSV 링크, 공개 여부 무관), 비공개 투어 행은 투어 이름 칸에 `비공개` 표시(공개 투어 행엔 없음), 대기+확정 = 점유 정의, 남은 자리는 단일 계산 지점. 차트 없음.
- **REQ-ADMIN-012** 대시보드 질의 수는 회차 수와 무관, 모두 연결 풀.
- **REQ-ADMIN-013** **When** 상태 변경·요청 사항 삭제 커밋 또는 CSV 응답 → 작업 기록(종류·관리자 ID·시각·대상·이전→이후·행 수). 상태 변경·삭제는 같은 트랜잭션(기록 실패 시 작업도 되돌림), CSV는 응답 전 저장(실패 시 500). 거부된 요청은 기록 안 함.
- **REQ-ADMIN-014** 작업 기록 생성·수정·삭제는 모든 접근 규칙 경로에서 모두 거부. **While** 비관리자 → 읽기 빈 결과·권한 오류. 관리자는 화면에서 읽기만. 개인정보 필드 없음.
- **REQ-ADMIN-015** 이 SPEC 코드는 개인정보를 로그·오류 코드·오류 문구·URL·CSV 파일 이름·작업 기록에 담지 않음. 로그는 코드·오류 종류 이름·ID만, 던지는 오류에 `cause`·원시 문구 없음. Payload 자체 DB 오류 기록은 범위 밖(R23).
- **REQ-ADMIN-016** 단위·통합(실제 DB 동시성: 사이트 접수 ↔ 복원, 삭제 ↔ 다른 수정)·E2E(테스트 관리자 로그인), 실제 관리자 미사용, 데이터 자체 생성·정리(작업 기록 포함), 커버리지 85%, 기존 게이트 유지.

## 수용 기준 요약 (acceptance.md)

AC-001 컬렉션 7개 · AC-002 수정 범위(관리자 상태 수정 성공, 다른 필드 10개 값 불변, 일괄 403 `has disabled bulk edit`, 익명 거부, REST·GraphQL) · AC-003 상세·목록 화면(E2E: 상태만 편집, 저장 후 완료 화면 상태 값이 정확히 `확정`이고 대기 문구 없음, 일괄 동작 없음 + 수동) · AC-004 전환표·`cancelledAt`·기록 4건 · AC-005 복원 정원(초과 거부 409·정확히 채우면 마감·마감 회차 복원 유지·마감 회차 초과 거부, 회차 없는 신청은 복원·취소·요청 사항 삭제 모두 `SESSION_MISSING`·변경 없음·기록 0건, E2E REST `PATCH` 정확히 409 + 오류 알림) · AC-006 동시성(사이트 접수 결정적·병렬 3회, 잠금 초과 `SESSION_BUSY` 409 7초 안, 삭제 ↔ 상태 변경 결정적(대기 세션 2개 확인 뒤 풀기 — 둘 다 성공, 40P01 없음)·병렬 3회, E2E REST `PATCH` 잠금 초과 정확히 409, 잠금 제거 변이) · AC-007 취소가 마감 안 풀림 · AC-008 요청 사항 삭제 함수·엔드포인트(403·404·409·200, `SESSION_BUSY`, 원자성, 일반 수정 불가, 되살림 방지 결정적 2개 — 같은 상태 저장·상태 없는 수정, 덮어쓰기 축소 변이) · AC-009 삭제 화면(확인 단계 취소/확인) · AC-010 CSV 형식 단위 · AC-011 CSV 경로(머리글·BOM·순서·수식 칸·403·404·기록 1건) · AC-012 대시보드 데이터(비공개 투어 회차 포함·`tourPublished`)·질의 수(`query` 수 동일, `connect` = `query`) · AC-013 대시보드 화면(비공개 행 `비공개` 표시, 공개 행 없음)·T 행 링크 `<S1>`·P 행 링크 `<S3>`·링크 내려받기 · AC-014 기록 내용·개인정보 없음·원자성 · AC-015 기록 덧붙이기 전용(로컬·REST·화면) + 이 SPEC 코드 로그 개인정보 0·`cause` 없음 + 수동 · AC-016 테스트·커버리지·잔여 0(고아 기록은 `session_id IS NOT NULL`만, 회차 없는 신청은 기록 없음, 기준값 M1 직후)

## 마일스톤 (plan.md §F)

M1 접근 규칙·데이터 모델(작업 기록 컬렉션, 정리 도우미, 고아 검사 기준값) → M2 모든 수정의 보호 구간·상태 변경 규칙·사이트 접수 동시성(변이 확인) → M3 상세 화면·요청 사항 삭제·삭제 동시성·되살림 방지(변이 확인, 기존 E2E 관리자 PATCH 단언 갱신, REST 409) → M4 참가자 CSV → M5 대시보드(비공개 표시) → M6 개인정보 점검·품질 게이트(`acceptance.md` §8)·MX·출시 전 점검 후보(R20·R23)
