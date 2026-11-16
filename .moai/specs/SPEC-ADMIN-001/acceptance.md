# SPEC-ADMIN-001 수용 기준

> **검증 셸**: Windows PowerShell 5.1에서 그대로 실행되어야 한다. 명령 인자 안에 큰따옴표를 겹쳐 쓰지 않는다. 문자열·구조 검사는 셸 인용에 기대지 않고 테스트 코드(저장소 규칙 테스트 `tests/unit/repo-rules.spec.ts` 포함)나 `Select-String -SimpleMatch '<고정 문자열>'`로 한다.
> **판정**: 별도 표시가 없으면 "통과"는 해당 명령의 종료 코드가 0(`$LASTEXITCODE -eq 0`)임을 뜻한다.
> **빈 결과 방지**: "0건"이나 "없음"을 검사하는 테스트는 같은 검사 안에서 대상이 1건 이상 존재함(또는 검사가 실제로 무언가를 수집했음)을 먼저 단언한다.
> **전제**: SPEC-APPLY-001의 전제와 같다(`.env` 존재, PostgreSQL 컨테이너 `healthy`). `pnpm test`, `pnpm e2e`로 판정하는 기준은 모두 이 상태를 전제로 한다.
> **관리자 계정**: 실제 관리자 계정은 쓰지도 바꾸지도 않는다. 통합 테스트는 파일마다 `admin-<무작위 값>@example.test` 관리자를 만들고 끝나면 지운다. E2E는 준비 단계(`tests/e2e/global-setup.ts`)가 만든 테스트 관리자로만 로그인한다. 이 문서의 "테스트 관리자"는 둘 중 해당하는 계정이다.
> **테스트 데이터 표식**: SPEC-APPLY-001과 같다(투어 slug·제목 `test-<무작위 값>…`, 신청 이름에 표식, 신청 이메일 `<표식>…@example.test`, 접속 IP는 `203.0.113.0/24`·`198.51.100.0/24`). 테스트는 시드 데이터나 개발자가 만든 데이터에 기대지 않는다. 개발 DB의 실제 회차가 대시보드에 함께 보여도 단언은 표식 행만 대상으로 한다.
> **시각 기준**: 다가오는 회차는 실행 시각 기준 하루 이상 뒤에 시작한다. "지난 회차" 사례만 하루 전에 시작한 회차를 쓴다.
> **상태 변경 경로**: 통합 테스트의 "관리자가 상태를 바꾼다"는 `payload.update({ collection: 'applications', id, data: { status }, user: <테스트 관리자>, overrideAccess: false })`를 뜻한다(REST·관리자 화면과 같은 단건 수정 경로, `plan.md` §B.9). 다른 필드를 함께 보내는 사례는 따로 적는다.
> **테스트 데이터 독립**: 각 수용 기준의 투어·회차·신청 데이터는 그 기준 전용으로 만든다.

## 0. 오류 코드 (영문 고정, `error_messages: en`)

| 코드 | HTTP | 경로 | 뜻과 고정 문구 |
|---|---|---|---|
| `RESTORE_CAPACITY_EXCEEDED` | 409 | 상태 변경 | 취소 복원이 정원을 넘음. 메시지 `RESTORE_CAPACITY_EXCEEDED: Restoring this application would exceed the session capacity.` |
| `SESSION_BUSY` | 409 | 상태 변경, 요청 사항 삭제 | 회차 행이나 신청 행의 잠금을 5초 안에 얻지 못함(교착 감지도 같은 코드). 상태 변경은 메시지 `SESSION_BUSY: The session is being updated by another request. Try again.`, 요청 사항 삭제는 본문 `{"code":"SESSION_BUSY"}` |
| `SESSION_MISSING` | 409 | 상태 변경(복원·그 밖의 전환·같은 상태 저장·상태 없는 수정 등 모든 수정), 요청 사항 삭제 | 회차 없는 신청의 모든 수정(`session` 필드가 필수라 어떤 수정도 저장할 수 없음, `plan.md` §A.2·§B.2 3번). 실제 DB의 `session_id`가 `NOT NULL`이라 지금은 도달하지 않는 방어 처리(AC-ADMIN-005). 상태 변경은 메시지 `SESSION_MISSING: This application has no session, so it cannot be changed.`, 요청 사항 삭제는 본문 `{"code":"SESSION_MISSING"}` |
| `REQUESTS_EMPTY` | 409 | 요청 사항 삭제 | 잠근 뒤 읽은 요청 사항이 이미 비어 있음. 본문 `{"code":"REQUESTS_EMPTY"}` |
| `FORBIDDEN` | 403 | 요청 사항 삭제, CSV | 관리자가 아님, 또는 CSV 요청의 `Sec-Fetch-Site`가 `cross-site`. 본문 `{"code":"FORBIDDEN"}` |
| `NOT_FOUND` | 404 | 요청 사항 삭제, CSV | 식별 값이 1~2147483647 정수가 아니거나 대상이 없음. 본문 `{"code":"NOT_FOUND"}` |
| `INTERNAL_ERROR` | 500 | 요청 사항 삭제, CSV | 그 밖의 처리 오류(트랜잭션 되돌림, 또는 CSV 작업 기록 실패). 본문 `{"code":"INTERNAL_ERROR"}` |
| (Payload 기본) | 403 | 일괄 수정 | `Collection applications has disabled bulk edit`(Payload `disableBulkEdit`, `plan.md` §A.2) |
| (Payload 기본) | 403 | 접근 규칙 거부 | `You are not allowed to perform this action.`(Payload `Forbidden`) |

상태 변경 오류(`RESTORE_CAPACITY_EXCEEDED`, `SESSION_BUSY`, `SESSION_MISSING`)는 Payload 저장 오류로 나간다. 로컬 API에서는 잡은 오류의 `status`가 409이고 `message`가 위 문구다. REST에서는 응답 상태가 409이고 본문 `errors[0].message`가 위 문구다(`plan.md` §A.2 "REST 오류 응답").

## 1. 데이터 모델과 접근 규칙

### AC-ADMIN-001 — 등록 컬렉션

- **Given** 소스가 준비되어 있다
- **When** `pnpm test`를 실행한다
- **Then** 통합 테스트가 Payload 설정의 컬렉션 slug 목록에서 `payload-`로 시작하는 slug를 뺀 결과(정렬 후)가 정확히 `['admin-audit-logs', 'application-attempts', 'applications', 'media', 'tour-sessions', 'tours', 'users']`임을 단언하고 통과한다
- **And** 같은 테스트는 필터 전 목록이 필터 후보다 길다는 것을 먼저 단언한다
- **And** 기존 `Users` 인증 흐름 테스트(생성·로그인·틀린 비밀번호·삭제)가 계속 통과한다

### AC-ADMIN-002 — 신청 수정 범위 (로컬 API·REST·GraphQL)

- **Given** 테스트 관리자와, 공개 투어의 회차 S(정원 10)·S2(정원 10), S의 신청 A(대기, 인원 2, 요청 사항 `<표식>-요청`과 선택 동의 일시 있음)가 있다
- **When** `pnpm test`와 `pnpm e2e`를 실행한다
- **Then** 통합 테스트가 다음을 확인한다
  - 관리자가 A의 상태를 `confirmed`로 바꾸면 오류 없이 끝나고, 다시 읽은 A의 상태가 `confirmed`다
  - 관리자가 상태 `pending`과 함께 이름 `<표식>-바꾼이름`, 이메일 `<표식>-x@example.test`, 연락처 `010-9999-9999`, 인원 `5`, 요청 사항 `바뀐 글`, 접수 번호(새로 만든 값), 회차 S2, 동의 문구 버전 `x`, `cancelledAt`(임의 시각), `requestsDeletedAt`(임의 시각)을 보내면 오류 없이 끝나고, 다시 읽은 A의 상태는 `pending`이며 보낸 나머지 필드 열 개의 값은 모두 저장 전 값과 같다(필드별 단언)
  - 익명(`overrideAccess: false`, 사용자 없음)의 상태 수정은 권한 오류이고 A의 상태가 그대로다
  - 관리자의 일괄 수정(`payload.update({ collection: 'applications', where: { id: { equals: A } }, data: { status: 'cancelled' }, user, overrideAccess: false })`)은 오류로 끝나고 메시지에 `has disabled bulk edit`이 있으며 A의 상태가 그대로다
  - 관리자와 익명의 생성·삭제는 SPEC-APPLY-001과 같이 권한 오류다
- **And** E2E가 Playwright 요청 API로 다음을 확인한다(관리자는 `POST /api/users/login`으로 받은 토큰을 `Authorization: JWT <토큰>`으로 보냄)
  - 관리자의 `PATCH /api/applications/<A>` 본문 `{"status":"confirmed"}` → 응답 200, 이어서 관리자 `GET`의 `status`가 `confirmed`
  - 관리자의 `PATCH /api/applications/<A>` 본문 `{"name":"<표식>-바꾼이름"}` → 응답 200, 이어서 읽은 이름이 원래 값
  - 익명의 같은 `PATCH` → 정확히 403
  - 관리자의 `PATCH /api/applications?where[id][equals]=<A>` 본문 `{"status":"cancelled"}` → 정확히 403, 상태 그대로
  - 관리자와 익명의 `POST /api/applications`·`DELETE /api/applications/<A>` → 각각 정확히 403(SPEC-APPLY-001 AC-APPLY-003 유지)
  - GraphQL: 관리자의 `updateApplication`(A, 상태 확정) 변경 요청 → 응답에 `errors`가 없고 돌려받은 상태가 확정이다. 익명의 같은 요청 → `errors` 메시지 중 하나가 `You are not allowed to perform this action.`이고 A의 상태가 그대로다

### AC-ADMIN-003 — 관리자 신청 상세·목록 화면

- **Given** E2E 준비 단계가 공개 투어의 회차(+2일 정원 10)와 그 회차의 대기 신청 B(인원 2, 요청 사항 없음)를 로컬 API로 만들었다
- **When** `pnpm e2e`를 실행한다
- **Then** E2E가 테스트 관리자로 로그인해 `/admin/collections/applications/<B의 ID>`에서 다음을 확인한다
  - 상태 입력란이 편집 가능하고 선택지가 `대기`·`확정`·`취소` 세 개다
  - 이름·이메일·연락처·인원·접수 번호 입력란이 각각 편집할 수 없다(`disabled` 또는 `readonly`)
  - 상태를 `확정`으로 고르고 저장하면 저장 성공 알림이 보이고, 로컬 API로 읽은 B의 상태가 `confirmed`이며, `/apply/complete/<B의 접수 번호>`의 상태 항목 값(`dd` 요소)의 텍스트가 앞뒤 공백을 뺀 뒤 정확히 `확정`이고, 그 페이지 어디에도 대기 문구 `대기 — 관리자 확인 후 확정`이 없다(대기 문구도 `확정`을 담으므로 포함 여부만으로는 판정하지 않음)
- **And** `/admin/collections/applications` 목록에 "새로 만들기"(`Create New`) 링크가 없고, B 행의 선택 상자를 고른 뒤 나타나는 동작 중에 편집(`Edit`)·삭제(`Delete`)가 없다
- **And** (수동) 사용자가 관리자 화면에서 상세의 상태만 편집 가능하고 다른 필드는 회색으로 막혀 있으며 목록에 일괄 동작이 없음을 확인한다. 결과를 `progress.md` §E.2에 기록한다

## 2. 상태 변경 규칙

### AC-ADMIN-004 — 전환과 취소일

- **Given** 통합 테스트가 공개 투어의 회차 S(+2일 정원 10)와 대기 신청 P(인원 2)를 만들었다
- **When** `pnpm test`를 실행한다
- **Then** 관리자가 P의 상태를 차례로 바꾸며 각 단계 뒤 다음을 확인한다(각 저장 직전·직후 시각을 `t0`·`t1`로 잰다)
  1. `confirmed` → 상태 `confirmed`, `cancelledAt` 비어 있음, S의 점유 인원 2
  2. `cancelled` → `cancelledAt`이 `t0` 이상 `t1` 이하, S의 점유 인원 0
  3. `cancelled`(같은 값) → 오류 없음, `cancelledAt`이 2단계 값과 같음
  4. `pending` → 상태 `pending`, `cancelledAt` 비어 있음, S의 점유 인원 2
  5. `confirmed` → `cancelledAt` 비어 있음
- **And** 이 과정이 남긴 P의 작업 기록이 정확히 4건이고, 시각 순으로 (`pending`→`confirmed`), (`confirmed`→`cancelled`), (`cancelled`→`pending`), (`pending`→`confirmed`)이며 모두 `action`이 `application.status_change`, `actorId`가 테스트 관리자 ID, `applicationId`가 P, `referenceCode`가 P의 접수 번호, `sessionId`가 S다(3단계는 기록이 없다)

### AC-ADMIN-005 — 취소 복원의 정원 확인과 자동 마감

- **Given** 통합 테스트가 공개 투어에 다음 회차를 만들었다(신청은 로컬 API로 직접 만든다)
  - S5: 정원 5, 모집 중. 대기 X(인원 3), 취소 Y(인원 3, `cancelledAt` 있음)
  - S4: 정원 4, 모집 중. 대기 1건(인원 2), 취소 Z(인원 2)
  - U6: 정원 6, 마감. 대기 1건(인원 2), 취소 W(인원 2)
  - V3: 정원 3, 마감. 대기 1건(인원 2), 취소 Q(인원 2)
- **When** `pnpm test`를 실행한다
- **Then** 통합 테스트가 다음을 확인한다
  - 관리자가 Y를 `pending`으로 바꾸면 잡은 오류의 `status`가 409이고 메시지가 `RESTORE_CAPACITY_EXCEEDED:`로 시작하며, Y의 상태·`cancelledAt`이 그대로, S5가 `open`, Y의 작업 기록이 0건이다
  - 이어서 X를 `cancelled`로 바꾼 뒤 Y를 `confirmed`로 바꾸면 성공하고, S5의 점유 인원이 3이며 S5는 `open`이다
  - Z를 `pending`으로 바꾸면 성공하고, S4의 점유 인원이 4이며 처리 함수가 돌아온 직후 S4가 `closed`다
  - W를 `confirmed`로 바꾸면 성공하고, U6의 점유 인원이 4이며 U6은 `closed` 그대로다
  - Q를 `pending`으로 바꾸면 잡은 오류의 `status`가 409이고 메시지가 `RESTORE_CAPACITY_EXCEEDED:`로 시작하며 Q가 `cancelled` 그대로다
  - **회차 없는 신청(방어 처리)**: 실제 DB의 `applications.session_id`는 `NOT NULL`이라 회차 없는 신청은 커밋될 수 없으므로(`spec.md` §2.5), 이 사례는 도달하지 않는 상태에 대한 방어 처리를 검증한다. 별도 회차의 취소 신청 O(인원 1)와 대기 신청 O2(인원 1, 요청 사항 `<표식>-고아`)를 만든 뒤, 테스트가 하나의 시험 트랜잭션 안에서 `lock_timeout`을 3초로 두고 `ALTER TABLE applications ALTER COLUMN session_id DROP NOT NULL` → 그 신청의 `session_id`를 `NULL`로 바꿈 → 같은 트랜잭션의 `req`로 아래 수정 시도 → 트랜잭션 되돌림 순서로 재현한다. 아래 "다시 읽은" 값은 되돌린 뒤 읽은 값이며, 시험 뒤 `applications.session_id`의 `is_nullable`이 `NO` 그대로다. 관리자가 O를 `pending`으로 바꾸면 잡은 오류의 `status`가 409이고 메시지가 `SESSION_MISSING:`으로 시작하며 O가 `cancelled` 그대로이고 O의 작업 기록이 0건이다. 관리자가 O2를 `cancelled`로 바꾸면 잡은 오류의 `status`가 409이고 메시지가 `SESSION_MISSING:`으로 시작하며, 다시 읽은 O2의 상태가 `pending`, `cancelledAt`이 비어 있음 그대로다. 관리자로 O2의 요청 사항 삭제 처리 함수를 부르면 결과가 `SESSION_MISSING`이고, 다시 읽은 O2의 요청 사항이 `<표식>-고아` 그대로이며 `requestsDeletedAt`이 비어 있다. 이 사례가 끝난 뒤 `applicationId`가 O 또는 O2인 작업 기록이 0건이다. 이 사례는 끝에 O·O2를 신청 ID로 지운다
- **And** E2E가 Playwright 요청 API로 관리자 `PATCH /api/applications/<정원을 넘는 취소 신청>` 본문 `{"status":"pending"}`을 보내면 응답 상태가 정확히 409이고 본문 `errors[0].message`가 `RESTORE_CAPACITY_EXCEEDED:`로 시작하며, 이어서 로컬 API로 읽은 그 신청이 `cancelled` 그대로임을 확인한다
- **And** E2E가 관리자 화면에서 정원을 넘는 복원을 저장하면 고정 문자열 `RESTORE_CAPACITY_EXCEEDED`가 든 오류 알림이 보이고, 로컬 API로 읽은 그 신청이 `cancelled` 그대로임을 확인한다

### AC-ADMIN-006 — 사이트 접수와 상태 변경의 동시성 (실제 DB)

- **Given** PostgreSQL이 `healthy`이고, 통합 테스트가 매 사례마다 새 회차를 만든다
- **When** `pnpm test`를 실행한다
- **Then** 통합 테스트가 다음을 확인한다
  - **결정적 사례**: 정원 3인 모집 중 회차에 취소 신청 C(인원 2)를 둔다. 사이트 접수 처리 함수(SPEC-APPLY-001)로 인원 2를 잠금 대기 제한 30초로 제출하되, 주입 지점(`beforeCommit`)이 테스트가 풀어 줄 때까지 멈추게 한다. 주입 함수가 실행된 것을 확인한 뒤 관리자가 C를 `pending`으로 바꾸는 저장을 시작한다(기다리지 않음). 그 뒤 최대 3초 동안 `payload.db.pool.query`로 `pg_stat_activity`를 반복 조회해 `datname = current_database()`, `wait_event_type = 'Lock'`이고 `query`에 `for update`(대소문자 무시)가 든 세션을 1개 이상 찾는다(못 찾으면 실패). 찾으면 즉시 주입 지점을 풀어 준다. 결과: 사이트 접수는 성공, 상태 변경은 `RESTORE_CAPACITY_EXCEEDED:`로 끝나고, 회차 점유 인원이 2, C는 `cancelled`, C의 작업 기록 0건이다
  - **병렬 사례 3회 반복**: 정원 4인 모집 중 회차에 취소 신청 R1(인원 2)·R2(인원 2)를 두고, 관리자의 R1 복원·R2 복원과 사이트 접수 인원 2 제출 2건(접속 IP 다름, 잠금 대기 제한 30초)을 모두 시작한 뒤 한꺼번에 기다린다(`Promise.all`). 결과: 성공한 사이트 접수 인원 + 복원에 성공한 신청 인원의 합 ≤ 4, DB의 점유 인원이 그 합과 같다, 합이 4이면 회차가 `closed`, 실패한 복원의 오류 메시지는 모두 `RESTORE_CAPACITY_EXCEEDED:`로 시작하고, 실패한 사이트 접수 코드는 모두 `CAPACITY_EXCEEDED` 또는 `SESSION_CLOSED`다
  - **잠금 대기 초과**: 테스트가 별도 트랜잭션으로 회차 행에 `FOR UPDATE` 잠금을 쥔 상태에서 관리자가 그 회차의 취소 신청을 `pending`으로 바꾸면, 잡은 오류의 `status`가 409이고 메시지가 `SESSION_BUSY:`로 시작하며 7초 안에 돌아오고, 신청이 `cancelled` 그대로이며 작업 기록이 생기지 않는다. 테스트는 끝에 쥔 트랜잭션을 되돌린다
  - **요청 사항 삭제 ↔ 상태 변경, 결정적 사례(같은 신청)**: 정원 10인 모집 중 회차에 확정 신청 K(인원 2, 요청 사항 `<표식>-요청`)를 둔다. 테스트가 별도 트랜잭션으로 그 회차 행을 `FOR UPDATE`로 쥔다. 관리자가 K를 `cancelled`로 바꾸는 저장을 시작하고(기다리지 않음), 최대 3초 동안 `pg_stat_activity`에서 위 결정적 사례와 같은 조건의 잠금 대기 세션이 1개 이상임을 확인한다. 이어서 관리자로 K의 요청 사항 삭제 처리 함수를 시작하고(기다리지 않음), 최대 3초 동안 같은 조건의 잠금 대기 세션이 2개 이상임을 확인한다(못 찾으면 실패). 찾으면 즉시 쥔 트랜잭션을 되돌려 풀어 준다. 결과: 상태 변경은 오류 없이 끝나고 삭제 결과는 `cleared`이며, 어느 쪽도 `SESSION_BUSY`나 교착 오류(SQLSTATE `40P01`)로 끝나지 않는다. 최종 K는 상태 `cancelled`, `cancelledAt` 있음, 요청 사항 비어 있음, `requestsDeletedAt` 있음이다. K의 작업 기록은 `application.status_change`(`confirmed`→`cancelled`) 1건과 `application.requests_delete` 1건이다. (먼저 기다리는 상태 변경이 회차 → 신청을 차례로 얻는 동안, 요청 사항 삭제가 신청 행을 먼저 쥐는 구현이라면 이 사례는 교착으로 실패한다 — `plan.md` §G R3)
  - **요청 사항 삭제 ↔ 상태 변경, 병렬 3회 반복**: 매번 새 회차와 확정 신청(인원 2, 요청 사항 있음)을 만들고, 관리자의 `cancelled` 변경과 관리자의 요청 사항 삭제를 함께 시작한 뒤 `Promise.all`로 기다린다. 결과: 매번 둘 다 성공하고(`SESSION_BUSY`·`40P01` 없음), 최종 상태가 결정적 사례의 결과와 같으며, 작업 기록이 종류별로 1건씩이다
  - 모든 사례가 통합 테스트 제한 시간(60초) 안에 끝난다
- **And** E2E가 로컬 Payload의 `payload.db.pool`에서 빌린 연결로 테스트 회차 행을 `FOR UPDATE`로 쥔 상태에서 Playwright 요청 API로 관리자 `PATCH /api/applications/<그 회차의 취소 신청>` 본문 `{"status":"pending"}`을 보내면, 응답 상태가 정확히 409이고 본문 `errors[0].message`가 `SESSION_BUSY:`로 시작하며 응답이 7초 안에 오고, 로컬 API로 읽은 그 신청이 `cancelled` 그대로임을 확인한다. 끝에 쥔 트랜잭션을 되돌리고 연결을 돌려준다
- **And** 변이 확인(수동, `plan.md` §E-1 7번): 상태 변경 경로의 회차 행 `FOR UPDATE`를 잠시 뺀 코드로 이 테스트 파일만 실행하면 결정적 사례가 실패한다(잠금 대기 세션 0개 또는 점유 인원 4). 결과(명령, 실패 단언 발췌)를 `progress.md` §E.2에 기록하고 코드를 되돌린 뒤 다시 통과함을 기록한다

### AC-ADMIN-007 — 취소가 마감을 풀지 않음

- **Given** 통합 테스트가 공개 투어의 회차(+2일 정원 2)를 만들고, 사이트 접수 처리 함수로 인원 1을 두 번 제출해 회차가 `closed`가 되었다
- **When** `pnpm test`를 실행한다
- **Then** 관리자가 두 신청 중 하나를 `cancelled`로 바꾸면 성공하고, 회차 상태가 `closed` 그대로이며, 조회 계층(SPEC-APPLY-001 `catalog.ts`)의 그 회차 선택 불가 사유가 `closed`이고, 이어서 사이트 접수로 인원 1을 제출하면 코드가 `SESSION_CLOSED`다

## 3. 요청 사항 삭제

### AC-ADMIN-008 — 요청 사항 삭제 처리와 권한

- **Given** 통합 테스트가 공개 투어의 회차와 신청 R(요청 사항 `<표식>-요청`, `requestsConsentAt` 있음)·신청 E(요청 사항 없음)를 만들었다
- **When** `pnpm test`와 `pnpm e2e`를 실행한다
- **Then** 통합 테스트가 요청 사항 삭제 처리 함수(엔드포인트가 부르는 `src/lib/` 함수)로 다음을 확인한다
  - 익명(사용자 없음)으로 R → 결과 `FORBIDDEN`, R의 요청 사항이 그대로
  - 관리자로 없는 ID(`2147483000`) → `NOT_FOUND`, 관리자로 E → `REQUESTS_EMPTY`, 두 경우 모두 작업 기록이 생기지 않는다
  - 관리자로 R(고정 시각 `now` 주입) → 결과 `cleared`, 다시 읽은 R의 요청 사항이 비어 있고(`null` 또는 빈 문자열), `requestsDeletedAt`이 `now`와 같은 순간, `requestsConsentAt`·이름·이메일·연락처·인원·상태·접수 번호가 삭제 전과 같다
  - R의 작업 기록이 1건이고 `action`이 `application.requests_delete`, `actorId`가 테스트 관리자 ID, `applicationId`가 R, `sessionId`가 R의 회차다
  - 다시 관리자로 R → `REQUESTS_EMPTY`, `requestsDeletedAt`이 바뀌지 않고 작업 기록이 1건 그대로다
  - 원자성: 새 신청 R2(요청 사항 있음)에 대해 `admin-audit-logs` 생성만 한 번 실패하게 한 상태(`plan.md` §B.9)로 관리자 삭제를 하면 결과가 `INTERNAL_ERROR`이고, R2의 요청 사항이 그대로이며 `requestsDeletedAt`이 비어 있다
  - 관리자가 일반 수정으로 R2의 요청 사항을 `바뀐 글`로 보내면(`overrideAccess: false`) 오류 없이 끝나지만 요청 사항이 그대로다
  - **잠금 대기 초과**: 테스트가 별도 트랜잭션으로 새 신청 R3(요청 사항 있음)의 회차 행을 `FOR UPDATE`로 쥔 상태에서 관리자로 R3을 삭제하면 결과가 `SESSION_BUSY`이고 7초 안에 돌아오며, R3의 요청 사항이 그대로이고 `requestsDeletedAt`이 비어 있으며 작업 기록이 생기지 않는다. 테스트는 끝에 쥔 트랜잭션을 되돌린다
  - **되살림 방지, 같은 상태 저장(결정적)**: 대기 신청 G(요청 사항 `<표식>-되살림`)를 둔다. 관리자로 G의 요청 사항 삭제 처리 함수를 고정 시각 `now`와 테스트 전용 주입 지점(`beforeCommit` — 삭제와 작업 기록 뒤, 커밋 전)을 넘겨 시작하고, 주입 지점이 테스트가 풀어 줄 때까지 멈추게 한다. 주입 함수가 실행된 것을 확인한 뒤 관리자가 G에 같은 상태를 저장하기 시작한다(`data: { status: 'pending' }`, 기다리지 않음). 이 저장은 삭제가 커밋되기 전의 문서(요청 사항 있음)를 읽은 뒤 잠금을 기다린다. 최대 3초 동안 `pg_stat_activity`에서 AC-ADMIN-006 결정적 사례와 같은 조건의 잠금 대기 세션을 1개 이상 찾고(못 찾으면 실패), 찾으면 즉시 주입 지점을 풀어 준다. 결과: 삭제 결과는 `cleared`, 같은 상태 저장은 오류 없이 끝난다. 다시 읽은 G의 요청 사항이 비어 있고, `requestsDeletedAt`이 `now`와 같은 순간이며, 상태가 `pending`이다. G의 작업 기록은 `application.requests_delete` 1건이고 `application.status_change`는 0건이다
  - **되살림 방지, 상태 없는 수정(결정적)**: 새 대기 신청 H(요청 사항 `<표식>-되살림2`)로 같은 절차를 밟되, 겹치는 저장을 관리자의 이름 수정(`data: { name: '<표식>-바꾼이름' }`)으로 한다. 결과: 다시 읽은 H의 요청 사항이 비어 있고, `requestsDeletedAt`이 `now`와 같은 순간이며, 이름과 상태가 원래 값이다
- **And** 변이 확인(수동, `plan.md` §E-1 8번): 잠긴 필드 덮어쓰기를 상태가 바뀌는 분기에서만 하도록 잠시 바꾼 코드로 이 두 되살림 사례를 실행하면 실패한다(요청 사항 표식이 되살아나거나 `requestsDeletedAt`이 비워짐). 결과(명령, 실패 단언 발췌)를 `progress.md` §E.2에 기록하고 코드를 되돌린 뒤 다시 통과함을 기록한다
- **And** E2E가 Playwright 요청 API로 다음을 확인한다(준비 단계가 요청 사항 있는 신청 하나를 만듦)
  - 익명의 `POST /api/applications/<ID>/clear-requests` → 정확히 403, 본문 `code`가 `FORBIDDEN`, 요청 사항 그대로
  - 관리자의 같은 요청 → 200, 본문 `status`가 `cleared`, 응답 본문에 요청 사항 표식 문자열이 없다
  - 관리자의 두 번째 같은 요청 → 409, `code`가 `REQUESTS_EMPTY`
  - 관리자의 `POST /api/applications/2147483000/clear-requests` → 404, `POST /api/applications/abc/clear-requests` → 404

### AC-ADMIN-009 — 요청 사항 삭제 화면

- **Given** E2E 준비 단계가 요청 사항(`<표식>-민감`)이 있는 신청 M과 요청 사항이 없는 신청 N을 만들었다
- **When** `pnpm e2e`를 실행한다
- **Then** E2E가 테스트 관리자로 로그인해 다음을 확인한다
  - M 상세에서 요청 사항 입력란이 편집할 수 없고, `요청 사항 삭제` 버튼이 보인다
  - 버튼을 누르면 확인 단계가 나타나고, 거기서 취소하면 로컬 API로 읽은 M의 요청 사항이 그대로다
  - 다시 버튼을 누르고 확인하면, 화면을 다시 불러온 뒤 요청 사항 입력란이 비어 있고, 라벨 `요청 사항 삭제 일시` 옆에 값이 보이며, `요청 사항 삭제` 버튼이 사라지고, 로컬 API로 읽은 M의 요청 사항이 비어 있으며 페이지 HTML에 `<표식>-민감`이 없다
  - N 상세에는 `요청 사항 삭제` 버튼이 없다

## 4. 참가자 CSV

### AC-ADMIN-010 — CSV 형식 (순수 함수)

- **Given** 참가자 CSV를 만드는 순수 함수가 있다
- **When** `pnpm test`를 실행한다
- **Then** 단위 테스트가 다음을 확인한다
  - 결과가 `﻿`로 시작하고, 첫 줄이 정확히 `"접수번호","이름","연락처","이메일","인원","상태","요청 사항"`이며, 모든 줄이 `\r\n`으로 끝난다
  - 상태 `pending`·`confirmed`·`cancelled`가 각각 `"대기"`·`"확정"`·`"취소"`로, 인원 `2`가 `"2"`로, 비어 있는 요청 사항이 `""`로 나간다
  - 칸 값 `a"b`가 `"a""b"`로, 쉼표와 줄바꿈(`\n`)이 든 요청 사항이 따옴표 안에 그대로 나간다
  - 칸 값 `=1+1`, `+82 10-1234-5678`, `-5`, `@SUM(A1)`, `\t=1`, `\r=1`이 각각 `'`를 앞에 붙인 값으로 나간다(예: `"'=1+1"`). 이름 `김=민지`와 연락처 `010-1234-5678`처럼 첫 글자가 위 문자가 아닌 값은 바뀌지 않는다
  - 결과를 RFC 4180 방식으로 다시 나누면(테스트 안의 작은 해석기) 행 수가 입력 + 1이고, 각 칸이 (붙인 `'`를 뺀) 원래 값과 같다

### AC-ADMIN-011 — CSV 내려받기 경로

- **Given** E2E 준비 단계가 공개 투어의 회차 S와 S의 신청 세 건을 이 순서로 만들었다: A(대기, 인원 1), B(취소, 인원 2), C(확정, 인원 3, 요청 사항 `=HYPERLINK("x")<표식>`). 다른 회차 T에 신청 D가 있다
- **When** `pnpm e2e`를 실행한다
- **Then** E2E가 요청 API로 관리자 인증 `GET /api/tour-sessions/<S>/participants-csv`를 보내 다음을 확인한다
  - 응답 200, `content-type`이 `text/csv`로 시작하고 `charset=utf-8`을 담음, `content-disposition`이 정확히 `attachment; filename="session-<S>-participants.csv"`, `cache-control`에 `no-store`가 있음
  - 본문 바이트가 `EF BB BF`로 시작하고, 줄이 4개(머리글 + 3)이며, 2~4번째 줄이 A·B·C 순서(신청 시각 순, 같은 시각이면 신청 ID 순 — `plan.md` §B.5)이고 상태 칸이 `대기`·`취소`·`확정`이다. D의 이메일이 본문에 없다
  - C의 요청 사항 칸이 `"'=HYPERLINK(""x"")<표식>"`이다
  - 요청 URL과 `content-disposition` 값에 신청 이름·이메일·연락처·표식 문자열이 없다
- **And** 다음 요청은 CSV 본문 없이 끝난다(응답 본문에 A의 이메일이 없음): 익명 → 403, 관리자 인증 + `Sec-Fetch-Site: cross-site` 머리글 → 403, 관리자 `GET /api/tour-sessions/2147483000/participants-csv` → 404, 관리자 `GET /api/tour-sessions/abc/participants-csv` → 404
- **And** 로컬 API로 확인한 S의 작업 기록 중 `action`이 `session.participants_csv`인 것이 정확히 1건이고, `actorId`가 테스트 관리자 ID, `sessionId`가 S, `rowCount`가 3이다(거부된 네 요청은 기록을 남기지 않음)

## 5. 회차 현황 대시보드

### AC-ADMIN-012 — 대시보드 데이터와 질의 수

- **Given** 통합 테스트가 공개 투어 T에 회차 S1(+2일 정원 10, 모집 중: 대기 인원 1·1, 확정 인원 3, 취소 인원 4), S2(+3일 정원 3, 마감: 대기 인원 3), S0(하루 전 시작, 대기 인원 1)를 만들고, 비공개 투어 P(`published` 거짓)에 회차 S3(+4일 정원 6, 모집 중: 확정 인원 2)를 만들었다
- **When** `pnpm test`를 실행한다
- **Then** 대시보드 데이터 함수의 결과(표식 투어의 행만)에서 다음을 확인한다
  - S0은 없고, S1, S2, S3이 이 순서로 있다
  - S1: 투어 이름이 T의 제목, 공개 여부 값(`tourPublished`)이 참, 정원 10, 대기 인원 2, 확정 인원 3, 남은 자리 5, 상태 `open`, CSV 경로 `/api/tour-sessions/<S1>/participants-csv`
  - S2: 대기 인원 3, 확정 인원 0, 남은 자리 0, 상태 `closed`
  - S3: 투어 이름이 P의 제목, 공개 여부 값이 거짓, 정원 6, 대기 인원 0, 확정 인원 2, 남은 자리 4, 상태 `open`(비공개 투어의 회차도 결과에 있음)
  - S1의 남은 자리가 조회 계층(`getTourDetailBySlug`)이 돌려준 S1의 남은 자리와 같다(같은 점유 인원 정의)
- **And** 질의 수 검사: 투어 Q에 다가오는 회차 1개(신청 1건)만 있는 상태에서 데이터 함수 한 번이 실행하는 동안 `payload.db.pool.query` 호출 수를 센다. 이어서 Q에 다가오는 회차 5개(각 신청 1건)를 더한 뒤 다시 센다. 두 수가 같고 1 이상이다
- **And** 같은 두 측정 구간마다 `payload.db.pool.connect` 호출 수도 세어, 각 구간에서 `connect` 호출 수가 `query` 호출 수와 같다(트랜잭션 등 직접 연결로 나간 질의 없음 — SPEC-APPLY-001 AC-APPLY-005와 같은 판정)

### AC-ADMIN-013 — 대시보드 화면과 CSV 링크

- **Given** E2E 준비 단계가 공개 투어 T(제목에 표식)의 회차 S1(+2일 정원 10: 대기 인원 2, 확정 인원 3)과, 비공개 투어 P(제목에 표식, `published` 거짓)의 회차 S3(+3일 정원 6: 확정 인원 2)을 만들었다
- **When** `pnpm e2e`를 실행한다
- **Then** E2E가 테스트 관리자로 로그인해 `/admin`에서 다음을 확인한다
  - 열 머리글 `투어`, `시작 일시`, `정원`, `대기`, `확정`, `남은 자리`, `상태`가 있는 표가 있다
  - T의 제목이 든 행에 S1의 시작 일시(서울 시각 표기), `10`, `2`, `3`, `5`, `모집 중`이 보이고, 그 행의 투어 칸에 고정 문자열 `비공개`가 없다
  - P의 제목이 든 행이 있고, 그 행의 투어 칸에 고정 문자열 `비공개`가 보이며, `6`, `0`, `2`, `4`, `모집 중`이 보인다
  - T의 행의 `CSV 내려받기` 링크의 `href`가 `/api/tour-sessions/<S1>/participants-csv`이고, P의 행의 `CSV 내려받기` 링크의 `href`가 `/api/tour-sessions/<S3>/participants-csv`다
  - T의 행의 `CSV 내려받기` 링크를 누르면 내려받기가 일어나고(`page.waitForEvent('download')`), 제안 파일 이름이 `session-<S1>-participants.csv`, 파일이 `EF BB BF`로 시작하며 첫 줄에 `접수번호`가 있다
- **And** 로그인하지 않은 브라우저로 `/admin`을 열면 로그인 화면으로 이동하고 표가 보이지 않는다

## 6. 작업 기록

### AC-ADMIN-014 — 작업 기록 내용과 원자성

- **Given** 통합 테스트가 공개 투어의 회차와 신청을 만들고 AC-ADMIN-004와 같은 방식으로 상태를 바꿀 준비를 했다
- **When** `pnpm test`를 실행한다
- **Then** 통합 테스트가 다음을 확인한다
  - 관리자가 아닌 서버 경로(로컬 API, 사용자 없음, `overrideAccess` 기본값)로 상태를 바꾸면 작업 기록이 1건 생기고 `actorId`가 비어 있다
  - 이 SPEC의 테스트가 만든 작업 기록 전체를 로컬 API로 읽어 `JSON.stringify`한 문자열에 신청 이름·이메일·연락처·요청 사항 표식 값이 하나도 없다(그 문자열에 기록이 1건 이상 들어 있음을 먼저 단언)
  - `admin-audit-logs` 컬렉션의 필드 이름 목록에 `name`, `email`, `phone`, `requests`가 없다
  - 원자성: `admin-audit-logs` 생성만 한 번 실패하게 한 상태(`plan.md` §B.9)로 관리자가 대기 신청을 `cancelled`로 바꾸면 오류로 끝나고, 그 신청의 상태와 `cancelledAt`이 그대로이며 작업 기록이 생기지 않는다. 같은 방식으로 정원을 정확히 채우는 복원을 하면 오류로 끝나고 회차가 `open` 그대로다(마감 갱신도 함께 되돌려짐)

### AC-ADMIN-015 — 작업 기록 덧붙이기 전용과 개인정보 비노출

- **Given** 테스트 관리자와 작업 기록 1건 이상이 있다
- **When** `pnpm test`와 `pnpm e2e`를 실행한다
- **Then** 통합 테스트가 `overrideAccess: false`로 다음을 확인한다
  - 익명과 테스트 관리자 모두 `admin-audit-logs`의 생성·수정·삭제가 권한 오류이고 호출 전후의 문서 수와 값이 같다
  - 익명의 조회는 권한 오류이거나 0건이고, 테스트 관리자의 조회 결과에는 준비한 기록이 있다
- **And** E2E가 요청 API로 익명과 관리자의 `POST /api/admin-audit-logs`, `PATCH /api/admin-audit-logs/<ID>`, `DELETE /api/admin-audit-logs/<ID>`가 각각 정확히 403임을, 익명 `GET /api/admin-audit-logs`가 403이거나 `docs`가 빈 배열임을 확인한다
- **And** E2E가 테스트 관리자로 `/admin/collections/admin-audit-logs`를 열면 목록이 보이고 "새로 만들기" 링크가 없으며, 기록 상세의 입력란이 편집할 수 없고 저장 버튼이 없음을 확인한다
- **And** 통합 테스트가 `console`의 `log`·`info`·`warn`·`error`와 `payload.logger`의 `info`·`warn`·`error`·`debug` 출력을 붙잡은 채 상태 변경 성공, 복원 정원 초과, 잠금 대기 초과(`SESSION_BUSY`), 요청 사항 삭제 성공, 요청 사항 삭제 잠금 대기 초과, 작업 기록 실패로 인한 `INTERNAL_ERROR`를 차례로 실행하고, 붙잡은 출력이 1건 이상이며 그중 하나에 `INTERNAL_ERROR`가 있고, 출력 전체와 각 오류 메시지에 신청 이름·이메일·연락처·요청 사항 표식 값이 없음을 확인한다. 같은 테스트는 이 SPEC 코드가 던진 각 오류 객체에 `cause` 속성이 없음(또는 `undefined`)도 단언한다
- **And** 범위 주의: 이 기준은 REQ-ADMIN-015의 범위(이 SPEC의 코드가 남기는 로그·오류)를 판정한다. Payload가 저장 단계 DB 오류를 스스로 기록하는 경로는 판정 대상이 아니며 `plan.md` §G R23 잔여 위험으로 관리한다
- **And** (수동) 사용자가 관리자 화면 메뉴에서 작업 기록을 열어 목록이 읽기 전용이고 상태 변경·요청 사항 삭제·CSV 내려받기 기록이 보임을 확인한다. 결과를 `progress.md` §E.2에 기록한다

## 7. 테스트 체계

### AC-ADMIN-016 — 테스트 체계, 커버리지, 데이터 정리

- **Given** PostgreSQL이 `healthy`이고 E2E 전용 포트가 비어 있다
- **When** `pnpm test`를 실행한 뒤 `pnpm e2e`를 실행한다
- **Then** 둘 다 종료 코드 0이고, `pnpm test`는 기존 단위·통합 테스트와 이 SPEC의 테스트를, `pnpm e2e`는 기존 E2E와 이 SPEC의 E2E를 모두 통과로 보고한다(기존 단언 중 이 SPEC이 대체한 것 — 등록 컬렉션 목록, 관리자 수정 403 — 은 새 기준으로 바뀐 상태)
- **And** 커버리지 보고서의 `src/lib/` 합산 라인 커버리지가 85% 이상이다
- **And** 두 명령이 끝난 뒤 다음 명령의 출력이 각각 `0`이다
  - `docker compose exec -T postgres psql -U <POSTGRES_USER 값> -d <POSTGRES_DB 값> -tAc 'SELECT count(*) FROM applications WHERE email LIKE ''%example.test'';'`
  - `docker compose exec -T postgres psql -U <POSTGRES_USER 값> -d <POSTGRES_DB 값> -tAc 'SELECT count(*) FROM tours WHERE slug LIKE ''test-%'';'`
  - `docker compose exec -T postgres psql -U <POSTGRES_USER 값> -d <POSTGRES_DB 값> -tAc 'SELECT count(*) FROM users WHERE email LIKE ''%@example.test'';'`
  - `docker compose exec -T postgres psql -U <POSTGRES_USER 값> -d <POSTGRES_DB 값> -tAc 'SELECT count(*) FROM admin_audit_logs a WHERE a.session_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tour_sessions s WHERE s.id = a.session_id);'` (지워진 회차를 가리키는 작업 기록 — 테스트 정리 누락 검사. 회차 없는 신청의 수정은 모두 거부되어 기록을 남기지 않는다(AC-ADMIN-005). 기준값은 `admin_audit_logs` 테이블이 생긴 **M1 직후** 값이 0임을 §E.2에 기록)
- **And** 기존 SPEC-APPLY-001의 데이터 정리 기준(AC-APPLY-016)과 SPEC-TOUR-001 기준(AC-TOUR-009)이 계속 통과한다

## 8. 품질 게이트

| 항목 | 기준 | 검증 명령 |
|---|---|---|
| 타입 | 오류 0건 | `pnpm typecheck` |
| 빌드 | 종료 코드 0 | `pnpm build` |
| 단위·통합·저장소 규칙 테스트 | 전부 통과(동시성 테스트 포함) | `pnpm test` |
| 커버리지 | `src/lib/` 합산 라인 85% 이상 | `pnpm test`(임계값 내장) |
| E2E | 기존 + 이 SPEC 전부 통과 | `pnpm e2e` |
| 린트 | 오류 0건, 새 경고 0건 | `pnpm lint` |
| 포맷 | 차이 0건 | `pnpm format:check` |
| 의존성 | 잠금 파일 변경 없음, 새 패키지 없음 | `git diff --stat a8cf60b -- pnpm-lock.yaml` 출력 없음 |
| 보존 | 사이트 접수 정원 확인 구간 불변 | `git diff --stat a8cf60b -- src/lib/submit-application.ts` 출력 없음 |
| 생성 파일 | 타입·import map이 설정과 일치 | `pnpm generate:types`, `pnpm generate:importmap` 실행 후 `git status --short`에 두 파일 변경이 남지 않음 |
| 변이 확인 | 상태 변경 잠금을 빼면 동시성 테스트 실패, 잠긴 필드 덮어쓰기를 좁히면 되살림 사례 실패 | AC-ADMIN-006·AC-ADMIN-008 수동 기록 |

TRUST 5 대응: Tested(AC-ADMIN-004~014·016, 실제 DB 동시성 테스트), Readable(린트), Unified(포맷·생성 파일), Secured(AC-ADMIN-002·008·010·011·015 — 수정 범위, 관리자 전용 엔드포인트, 수식 주입, 교차 사이트 거부, 덧붙이기 전용 기록, 개인정보 비노출), Trackable(Conventional Commits, 커밋 메시지에 `SPEC-ADMIN-001`, 관리자 작업 기록).

## 9. 완료 정의 (Definition of Done)

- [ ] AC-ADMIN-001 ~ AC-ADMIN-016이 모두 통과했고, 각 명령과 출력 요약이 `progress.md` §E.2에 기록되었다
- [ ] 수동 확인 4건(AC-ADMIN-003 상세·목록 화면, AC-ADMIN-006 잠금 제거 변이, AC-ADMIN-008 잠긴 필드 덮어쓰기 축소 변이, AC-ADMIN-015 작업 기록 화면)이 기록되었다
- [ ] 품질 게이트 표의 모든 명령이 같은 커밋에서 통과했다
- [ ] `.env`, `media/` 아래 파일, 검증 로그가 커밋에 포함되지 않았다
- [ ] 실제 관리자 계정이 테스트에 쓰이지 않았다(테스트 코드에 `@example.test` 외 관리자 이메일 없음)
- [ ] `spec.md` §5 제외 범위 항목(일괄 변경, 차트, 이메일, 회원, 배포, F1·F2)이 구현에 섞이지 않았다
- [ ] 상태 변경 규칙에 `@MX:WARN`(+ `@MX:REASON`), 작업 기록 함수에 `@MX:ANCHOR`, 대시보드에 `@MX:DEBT`(`@MX:CEILING`·`@MX:UPGRADE` 포함)가 있고, `Applications.ts`·`consent.ts`의 관련 `@MX:NOTE`가 갱신되었다
- [ ] 작업 기록 보관 기간 검토 항목(`plan.md` §G R20)과 Payload 기본 오류 기록의 개인정보 처리 항목(`plan.md` §G R23)이 출시 전 검토 목록으로 `progress.md`에 옮겨 적혔다
