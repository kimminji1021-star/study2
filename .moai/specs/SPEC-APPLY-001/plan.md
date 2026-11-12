# SPEC-APPLY-001 구현 계획

> 요구사항은 `spec.md`, 수용 기준은 `acceptance.md`가 기준이다. 이 문서는 결정의 근거, 작업 순서, 위험을 다룬다.
> 개발 방식: TDD(`quality.yaml` `constitution.development_mode: tdd`). 검증 셸: Windows PowerShell 5.1(SPEC-INFRA-001·SPEC-TOUR-001과 같음).
> 마일스톤은 바뀔 가능성이 큰 결정(데이터 모델, 정원 확인 구간, 점유 인원 인터페이스)을 앞에, 화면과 정리 작업을 뒤에 놓았다.

## §A. 맥락

### A.1 현재 상태 (HEAD `0cdea2f`, main = origin/main)

- SPEC-INFRA-001·SPEC-TOUR-001 완료(`status: completed`). 등록 컬렉션은 `users`, `media`, `tours`, `tour-sessions`.
- 남은 자리 단일 계산 지점: `src/lib/session-availability.ts`의 `getSessionAvailability(session, { now, occupiedSeats })`(`@MX:ANCHOR`). 지금은 `src/lib/catalog.ts`의 `toSession`이 점유 인원을 넘기지 않아 0으로 계산된다(`@MX:NOTE` — "회차별 점유 인원 맵을 한 번에 조회해 occupiedSeats로 넘긴다").
- 조회 계층 `src/lib/catalog.ts`는 모든 `payload.find`에 `overrideAccess: false`를 펼쳐 넘긴다(`ANONYMOUS_READ`, `@MX:WARN`).
- `src/components/SessionList.tsx`: 라디오 `name="session"`, 값 = 회차 ID, 지금은 어떤 양식에도 들어 있지 않다(`@MX:NOTE` — 신청 SPEC 확장 지점).
- `src/collections/Tours.ts`: 회차가 있는 투어 삭제를 `beforeDelete`에서 `APIError(…, 400, undefined, true)`로 거부(영문 고정 문구). 같은 방식을 회차에 적용한다.
- 테스트: 코드맵 기록 기준 Vitest 275건, Playwright 26건(정확한 기준선은 §C에서 다시 잰다). `tests/integration/users-auth.spec.ts` 38행이 등록 컬렉션 목록을 `['media', 'tour-sessions', 'tours', 'users']`로 단언한다 → 이 SPEC에서 바뀐다(REQ-APPLY-002).
- 저장소 규칙(`tests/unit/repo-rules.spec.ts`) 중 맞닿는 규칙: `(frontend)` 아래 경로 구간에 `admin`·`api` 금지(→ `/apply`는 문제없음), 직접 의존성 메이저 1 이상, 검사 제외 목록 일치, `tours/` 아래 `loading` 파일 금지와 `connection()` 호출.
- 통합 테스트는 같은 DB를 쓰므로 파일 단위로 순서대로 실행된다(`vitest.config.mts` `fileParallelism: false`). 한 파일 안의 `Promise.all`은 실제로 여러 DB 연결을 동시에 쓴다. E2E는 `next dev`에서 작업자 1개로 돈다(`playwright.config.ts`).

### A.2 확인한 근거 (설치본·실측·공식 문서)

새 npm 패키지를 추가하지 않는다. 따라서 레지스트리 조회 대상이 없다. `node:crypto`(Node 내장)와 `sql`(직접 의존성 `@payloadcms/db-postgres`가 내보냄)만 쓴다.

| 항목 | 확인 내용 | 근거 |
|---|---|---|
| 트랜잭션 시작 | `payload.db.beginTransaction()`이 UUID를 만들고 drizzle `transaction()` 콜백 안의 `tx`를 `this.sessions[id] = { db: tx, reject, resolve }`로 등록 | `node_modules/.pnpm/@payloadcms+drizzle@3.93.0__ba5d6d62ca5ea44ea9fc1d4d503a023b/node_modules/@payloadcms/drizzle/dist/transactions/beginTransaction.js` |
| 커밋·롤백 | `commitTransaction(id)`/`rollbackTransaction(id)`는 세션을 레지스트리에서 먼저 지우고 resolve/reject. 이미 지워진 세션이면 아무것도 하지 않음 | 같은 경로 `transactions/commitTransaction.js`, `rollbackTransaction.js` |
| 같은 트랜잭션 재사용 | 로컬 API 작업은 `req.transactionID`가 있으면 새 트랜잭션을 만들지 않고(`initTransaction`이 `false`) 커밋도 하지 않음. 질의는 `adapter.sessions[req.transactionID].db`로 실행 | `node_modules/payload/dist/utilities/initTransaction.js`, `…/drizzle/dist/utilities/getTransaction.js`, `payload/dist/collections/operations/create.js` 30행 |
| 안쪽 작업이 실패하면 | `create` 작업의 `catch`가 `killTransaction(req)`를 불러 **바깥 트랜잭션까지** 롤백하고 `req.transactionID`를 지움 → 바깥 코드의 롤백은 아무것도 하지 않게 됨(안전) | `payload/dist/collections/operations/create.js` 435행, `payload/dist/utilities/killTransaction.js` |
| `req` 전달 | 로컬 API는 넘겨받은 `req` 객체를 그대로 채워 쓰므로 `transactionID`가 유지됨 | `payload/dist/utilities/createLocalReq.js` 65행 |
| 원시 SQL | `@payloadcms/db-postgres`가 `sql`을 다시 내보냄. 트랜잭션 연결의 `execute(sql\`…\`)`로 실행 가능 | `node_modules/@payloadcms/db-postgres/dist/index.js` 170행, `…/drizzle/dist/postgres/execute.js`, `…/drizzle/dist/postgres/types.d.ts` 122행(`sessions[id].db`) |
| 잠금 대기 제한 설정 | `SET LOCAL lock_timeout = $1`(값을 바인딩 인자로)은 `42601 syntax error`로 실패(plan-audit 1회차 실측). `SELECT set_config('lock_timeout', $1, true)`는 바인딩 인자를 받고 트랜잭션 안에서만 적용됨 — 개발 DB에서 `PREPARE … set_config('lock_timeout', $1, true)` 실행 결과 `'300ms'` → `300ms`, `'5000'` → `5s`, `ROLLBACK` 뒤 세션 값 `0`(2026-11-10) | plan-audit 1회차 보고서 기술 근거 표, 개발 DB 실측 |
| 드라이버 오류 감싸기 | drizzle 0.45.2는 pg 오류를 `DrizzleQueryError`로 감싸 던지므로 SQLSTATE(`55P03` 등)는 `err.cause.code`에 있다. 이 오류의 `message`는 `Failed query: <SQL>\nparams: <바인딩 인자>`라서 INSERT가 실패하면 이름·이메일·연락처가 메시지에 그대로 실린다 | `node_modules/.pnpm/drizzle-orm@0.45.2_@types+pg@8.20.0_pg@8.20.0/node_modules/drizzle-orm/errors.js` 10~19행, `pg-core/session.js` 36~41행 |
| 커밋 실패 | `beginTransaction`의 `.catch(... transactionFailed(err))` 구조 때문에 COMMIT 자체가 실패해도 `commitTransaction`은 예외 없이 끝날 수 있다(잔여 위험 R20) | `…/drizzle/dist/transactions/beginTransaction.js`, `commitTransaction.js`(plan-audit 1회차 O9) |
| 개발 서버의 `x-forwarded-for` | 들어온 값이 있으면 그대로 두고, 없을 때만 소켓 주소를 넣는다(`??=`). 따라서 E2E가 보낸 값이 첫 값으로 보존되고, 로컬에서 `unknown`은 나오지 않는다 | `node_modules/.pnpm/next@16.4.5_…/node_modules/next/dist/server/base-server.js` 604행 |
| `pool.query`와 `pool.connect` | `Pool.query`는 내부에서 `this.connect(...)`를 부른다. 따라서 `connect` 호출 수에는 `query` 호출이 포함된다 | `node_modules/.pnpm/pg-pool@3.14.0_pg@8.20.0/node_modules/pg-pool/index.js` 431·449행 |
| Payload 권한 거부 | 접근 함수가 거짓을 돌려주면 `Forbidden`(HTTP 403, 메시지 `You are not allowed to perform this action.`)을 던진다. 생성 접근 검사는 입력 검증보다 먼저 실행된다 | `payload/dist/auth/executeAccess.js`, `payload/dist/errors/Forbidden.js`, `payload/dist/collections/operations/create.js` 130행, `@payloadcms/translations/dist/languages/en.js` 114행 |
| 트랜잭션 끄기 | `postgresAdapter({ transactionOptions: false })`일 때만 `beginTransaction`이 `null`을 돌려주는 기본 구현으로 바뀜. 이 프로젝트 설정은 이 옵션을 쓰지 않음 | `db-postgres/dist/index.js` 97·100행, `src/payload.config.ts` |
| 연결 풀 | `pg.Pool` 기본 `max` 10. 트랜잭션 밖 질의는 `pool.query`로 나감 | `node_modules/.pnpm/pg-pool@3.14.0_pg@8.20.0/node_modules/pg-pool/index.js` 89행, `…/drizzle-orm@0.45.2…/node-postgres/session.js` 113·124행, `db-postgres/dist/connect.js` 44~53행 |
| 테이블·열 이름 | `tour_sessions`의 관계 필드 `tour` → 열 `tour_id`, 정원 `capacity`는 `numeric`, 상태는 `enum_tour_sessions_status`. 같은 규칙이면 신청의 회차 관계는 `applications.session_id`, 인원은 `party_size`(`numeric`) | 개발 DB `information_schema.columns` 조회(2026-11-10) |
| 격리 수준 | `default_transaction_isolation = read committed`, PostgreSQL 17.11 | 개발 DB `SHOW` 조회 |
| 행 잠금 동작(실측) | 정원 3, 앞 트랜잭션이 `FOR UPDATE` 후 2초 대기·2명 저장. 0.7초 뒤 시작한 트랜잭션은 잠금에서 약 1.26초 기다린 뒤 합계 2를 읽고 2명 저장을 거절 → 최종 1건·합계 2. 잠금을 뺀 대조 실험은 두 트랜잭션 모두 합계 0을 읽고 저장 → 최종 2건·합계 4(정원 초과) | 개발 DB 임시 스키마 `zz_probe`에서 실험 후 삭제(2026-11-10) |
| Read Committed 의미 | "each command … sees a snapshot … as of the instant the query begins", `SELECT FOR UPDATE`는 앞 갱신 트랜잭션이 끝날 때까지 기다림 | https://www.postgresql.org/docs/17/transaction-iso.html (WebFetch로 문장 확인) |
| Payload 이메일 검증 | `email` 필드 정규식(따옴표·공백·연속 점 거부, 최상위 도메인 2자 이상) | `node_modules/payload/dist/fields/validations.js` 89~112행 |
| 서버 액션 리다이렉트 | 자바스크립트 없는 양식 제출에서 `redirect`는 HTTP 303, 있으면 클라이언트 이동. `try` 블록 밖에서 호출해야 함 | `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md` 12·51·215행 |
| 서버 액션 보안 | `Origin`과 `Host` 비교(CSRF), 본문 1MB 한도, "Treat every action as an untrusted entry point", 반환값 최소화 | `node_modules/next/dist/docs/01-app/02-guides/server-actions.md` 76~94행 |
| 오류 표시 | 양식 컴포넌트를 클라이언트 컴포넌트로 두고 `useActionState` 사용 | `node_modules/next/dist/docs/01-app/02-guides/forms.md` 192행 |
| Vercel의 접속 IP | "we currently overwrite the X-Forwarded-For header and do not forward external IPs. This restriction is in place to prevent IP spoofing." | https://vercel.com/docs/headers/request-headers (WebFetch, 2026-11-10) |

### A.3 Tier M 판단

- 예상 변경: 컬렉션 2개 추가(`Applications`, `ApplicationAttempts`) + `TourSessions` 삭제 훅, `payload.config.ts`, `src/lib/` 모듈 5~6개(입력 검증, 점유 인원, 신청 처리, 접수 번호, 횟수 제한, 동의·화면 문구), `catalog.ts` 확장, 페이지 2개(`/apply`, `/apply/complete/[ref]`) + 서버 액션 + 양식 클라이언트 컴포넌트, `SessionList`·상세 페이지 수정, 테스트 8~10개, 생성 파일(`payload-types.ts`, 필요하면 import map).
- 직접 작성 코드 추정: 제품 코드 약 900~1,100줄, 테스트 약 1,000~1,300줄.
- M으로 두는 이유: 단일 도메인(신청 접수)이고 프로젝트 원칙을 바꾸지 않는다. SPEC-TOUR-001이 같은 규모에서 M을 유지했다. 요구사항 16개·수용 기준 16개로 예산 안이다.
- 넘칠 경우: run 단계 중 제품 코드가 1,300줄을 넘거나 마일스톤이 7개를 넘으면 차단자 보고 후 분할을 검토한다(1순위: 횟수 제한·허니팟을 별도 SPEC으로).
- 참고: 동시성과 개인정보가 걸린 SPEC이므로 더 엄격한 감사(Tier L 기준 0.85)를 원하면 Tier L로 올릴 수 있다. 그 경우 `design.md`·`research.md`가 추가되며, 이 문서 §A.2·§B가 그 내용의 대부분이다.

## §B. 결정과 근거

### B.1 동시성 제어 — 명시적 트랜잭션 + 회차 행 잠금

| 선택지 | 장점 | 단점 | 판단 |
|---|---|---|---|
| **트랜잭션 + `SELECT … FOR UPDATE`(채택)** | 회차별로 정원 확인 구간이 직렬화된다. 점유 인원을 저장하지 않아도 되고, 같은 행을 바꾸는 관리자 수정도 같은 잠금을 기다린다. 실측으로 확인(§A.2) | 원시 SQL 1문장, 회차 하나에 몰리는 신청은 줄을 선다 | 채택 |
| 저장된 점유 카운터 + 조건부 `UPDATE … WHERE occupied + n <= capacity` | 한 문장으로 원자적 | 카운터가 실제 신청과 어긋날 위험. 로드맵 6번의 상태 변경·관리자 수정마다 카운터를 함께 고쳐야 함 | 기각 |
| DB 제약(합계 제약) | 선언적 | PostgreSQL은 여러 행 합계 제약을 CHECK로 표현할 수 없음. 트리거는 Payload 개발 모드 스키마 반영 밖에서 관리해야 해 깨지기 쉬움 | 기각 |
| `SERIALIZABLE` + 재시도 | 잠금 없이 정확 | 직렬화 실패 재시도 루프 필요, Payload 전역 `transactionOptions`를 바꿔야 함 | 기각 |
| 권고 잠금 `pg_advisory_xact_lock(회차 ID)` | 행과 무관하게 직렬화 | 관리자 수정과는 직렬화되지 않음. 잠금 키 의미가 코드에만 있음 | 기각 |

정원 확인 구간 절차(서버 제출 경로 안, 검증 통과 후):

1. `const transactionID = await payload.db.beginTransaction()` — 값이 비어 있으면(트랜잭션이 꺼진 설정) 처리하지 않고 내부 오류로 끝낸다(안전 쪽 실패).
2. 같은 트랜잭션 연결(`payload.db.sessions[transactionID].db`)로 `SELECT set_config('lock_timeout', $1, true)`(값은 밀리초 문자열, 기본 상수 `5000`, 테스트는 옵션으로 바꿈), 이어서 `SELECT … FROM tour_sessions WHERE id = $1 FOR UPDATE`. `SET LOCAL lock_timeout = $1` 형태는 바인딩 인자를 받지 못해 `42601`로 실패하므로 쓰지 않는다(§A.2). 기본 상수 5000은 단위 테스트로 고정한다(AC-APPLY-010).
3. **잠금을 얻은 뒤의 별도 문장**으로 회차(상태·시작 시각·정원)와 소속 투어의 공개 여부, 점유 인원 합계(§B.2 정의)를 읽는다. Read Committed는 문장마다 새 스냅숏을 쓰므로, 잠금을 기다리는 동안 커밋된 다른 신청이 이 합계에 들어간다. 잠금 문장과 합계를 한 문장으로 합치지 않는다.
4. 판단(우선순위): 회차 없음·공개 투어 아님 → `SESSION_NOT_FOUND` / 마감 → `SESSION_CLOSED` / 시작 시각 ≤ 현재 → `SESSION_STARTED` / 인원 > 남은 자리 → `CAPACITY_EXCEEDED`. SPEC-TOUR-001의 `getSessionAvailability`를 잠근 데이터로 호출해 판정을 재사용한다.
5. `payload.create({ collection: 'applications', data, req, overrideAccess: true })` — `req`에는 같은 `transactionID`가 들어 있다(§A.2).
6. 저장 후 점유 인원(= 3의 합계 + 이번 인원)이 정원과 같으면 같은 `req`로 회차 상태를 `closed`로 바꾼다.
7. `payload.db.commitTransaction(transactionID)`. 어느 단계든 예외가 나면 `rollbackTransaction(transactionID)` 후 오류 코드로 바꾼다(이미 안쪽 작업이 롤백했으면 아무것도 하지 않음, §A.2). 잠금 대기 초과는 `SESSION_BUSY`로 바꾼다. 판별은 `err.code === '55P03'` 또는 `err.cause?.code === '55P03'`(drizzle이 pg 오류를 `DrizzleQueryError`로 감싸므로 `cause`를 반드시 확인, §A.2). 어느 오류든 `message`는 바인딩 인자(개인정보)를 담을 수 있으므로 기록하지도 돌려주지도 않고 고정 코드로만 바꾼다(REQ-APPLY-015).

주의 사항:

- 정원 확인 구간 안의 **모든** 질의는 같은 `req`(같은 트랜잭션 연결)를 써야 한다. 연결 풀(기본 10개)이 잠금을 기다리는 트랜잭션으로 모두 차 있는데 잠금을 쥔 트랜잭션이 풀에서 새 연결을 기다리면 서로를 기다리는 정지가 생긴다. 동시성 테스트는 풀 크기보다 많은 12건으로 이를 드러낸다(AC-APPLY-010).
- `numeric` 열의 합계는 `pg`가 문자열로 돌려준다. `Number()`로 바꾸고 `NaN`이면 내부 오류로 끝낸다.
- 원시 SQL은 테이블·열 이름(`tour_sessions`, `applications.session_id`, `party_size`, `status`)에 기댄다. 이 이름은 통합 테스트가 실제 DB로 검증한다. 대안으로 `payload.db.tables`의 drizzle 테이블 객체를 써도 되며, 어느 쪽이든 run 단계가 정한다.
- 자동 마감은 이 경로에서만 일어난다. 마감을 푸는 코드(신청 `afterChange`에서 회차를 다시 여는 훅 등)는 만들지 않는다(REQ-APPLY-010).

### B.2 점유 인원 — 저장하지 않고 합계, 정의는 한 곳

- 정의: `SUM(party_size) WHERE session_id = ? AND status IN ('pending', 'confirmed')`. 취소는 세지 않는다.
- 한 모듈(예: `src/lib/occupancy.ts`)에 두 함수를 둔다. (a) 화면용: 회차 ID 목록을 받아 `Map<회차 ID, 점유 인원>`을 돌려주며 `GROUP BY session_id` 질의 1회. (b) 정원 확인 구간용: 트랜잭션 연결로 회차 하나의 합계. 두 함수는 같은 상태 목록 상수를 쓴다. `@MX:ANCHOR`(호출자: 목록·상세 조회, 신청 화면, 신청 처리).
- 조회 계층 연결: `catalog.ts`의 `findUpcomingSessions` 결과로 회차 ID를 모아 (a)를 한 번 부르고, `toSession`이 `getSessionAvailability(doc, { now, occupiedSeats })`에 그 값을 넘긴다. 목록은 투어 수와 관계없이 회차 조회 1회 + 점유 인원 1회다.
- 접근 규칙과의 관계: (a)는 합계 숫자만 읽고 신청 문서를 돌려주지 않는다. `ANONYMOUS_READ` 원칙(문서 조회는 익명 권한)은 그대로 두고, 이 집계만 예외로 하되 그 이유를 `@MX:NOTE`로 남긴다. 신청 문서를 화면 조회 계층에서 `payload.find`로 읽는 코드는 만들지 않는다.
- 질의 수 검증(AC-APPLY-005): 통합 테스트가 `payload.db.pool.query`와 `payload.db.pool.connect`를 함께 감시한다. 같은 투어에 회차 1개일 때와 회차 6개일 때의 목록·상세 조회 질의 수가 각각 같고 1 이상임을 단언한다. `Pool.query`가 내부에서 `connect`를 부르므로(§A.2) "직접 연결(트랜잭션 등) 0회"는 같은 구간의 `connect` 호출 수 = `query` 호출 수로 판정한다. 이렇게 해야 `pool.connect()` 경로로 회차마다 질의하는 구현도 드러난다.

### B.3 생성 경로 — 서버 액션 하나, API 생성은 모두 거부

| 선택지 | 판단 |
|---|---|
| Payload REST 생성을 익명에게 열고 훅으로 검증 | REST·GraphQL 양쪽에 같은 검증·횟수 제한·잠금을 넣어야 하고, 접수 번호·동의 기록을 클라이언트가 보낼 여지가 생긴다. 기각 |
| Next 라우트 핸들러(`POST /…`) | CSRF 검사를 직접 만들어야 하고 `(frontend)` 아래에 `api` 구간을 둘 수 없다(저장소 규칙). 기각 |
| **서버 액션(채택)** | Next가 `Origin`/`Host`를 비교하고 POST만 받는다(§A.2). 자바스크립트 없이도 양식이 동작하고 성공 시 303 리다이렉트로 새로고침 재제출을 막는다 |

- `applications` 접근 규칙: `read: adminOnly`, `create`·`update`·`delete`: 언제나 거부(관리자 포함). 관리자 화면은 읽기 전용이 되고 "새로 만들기"가 사라진다.
- `application-attempts`: `read`·`create`·`update`·`delete` 모두 거부, `admin.hidden: true`.
- 핵심 로직은 `src/lib/`의 함수(예: `submitApplication(payload, input, { clientKey, now, lockTimeoutMs })`)에 두고, 서버 액션 파일은 `FormData` 읽기·접속 IP 추출·`redirect`만 맡는다. 그래서 통합 테스트가 Next 없이 실제 DB로 핵심 로직을 검증할 수 있고 커버리지 대상(`src/lib/**`)에 들어간다.
- 테스트 전용 주입 지점: 신청 처리 함수는 옵션으로 "커밋 직전에 실행할 함수"를 받는다. 위치는 §B.1의 **6번(회차 마감 갱신, 마감 조건이 아니면 건너뜀) 뒤, 7번(커밋) 바로 앞**으로 고정한다. 주입 함수는 같은 트랜잭션의 `req`를 인자로 받아 같은 트랜잭션 안에서 데이터를 읽을 수 있다. 쓰임:
  - AC-APPLY-009 롤백: 주입 함수가 같은 `req`로 회차를 읽어 상태(`closed`)를 테스트 변수에 기록한 뒤 예외를 던진다. 마감 갱신이 실제로 실행된 뒤 되돌려졌음을 보인다
  - AC-APPLY-010 잠금 대기 증거: 첫 호출의 주입 함수가 잠금을 쥔 채 멈춰 있는 동안 테스트가 `pg_stat_activity`에서 잠금 대기 세션을 확인한다
  - AC-APPLY-015: 강제 오류로 `INTERNAL_ERROR` 로그를 만든다
  - 서버 액션은 이 옵션을 넘기지 않는다. 경합 창을 넓히는 지연이 필요해지면(M2 변이 확인) 같은 지점을 쓴다.
- 서버 액션은 `redirect`를 `try` 밖에서 부른다(§A.2). 반환값은 `{ status: 'error', code, fieldErrors, values }`로 제한한다(`values`는 방문자 본인 입력값을 다시 채우는 용도 — 가정 A3).

### B.4 접수 번호 — `SB-XXXXX-XXXXX`

- 문자 집합: Crockford Base32(`0123456789ABCDEFGHJKMNPQRSTVWXYZ`, I·L·O·U 제외 — 전화로 불러 줄 때 헷갈리지 않음). 10자 = 50비트. `node:crypto`의 `randomBytes`에서 비트를 잘라 쓰며(모듈로 편향 없음) `Math.random`은 쓰지 않는다.
- 추측 가능성: 신청이 1만 건일 때 무작위 추측 한 번이 맞을 확률은 약 10⁴ / 2⁵⁰ ≈ 9 × 10⁻¹²이다. 접수 완료 화면에는 개인정보가 없어 맞혀도 얻는 정보가 투어·회차·인원뿐이다.
- 고유성: 열에 고유 제약. 충돌 확률이 무시할 수준이라 재시도 루프를 두지 않는다. 충돌하면 고유 제약 위반으로 트랜잭션이 되돌려지고 `INTERNAL_ERROR`가 된다(방문자가 다시 제출).
- 접수 완료 경로는 받은 값을 대문자로 맞춘 뒤(대소문자 구분 없음, REQ-APPLY-012) 형식 검사를 먼저 하고, 형식이 틀리면 DB를 조회하지 않고 404. 화면은 대문자로 맞춘 접수 번호를 보여 준다.
- 조회는 로컬 API(`overrideAccess: true`)로 하되 `select`로 접수 번호·인원·상태·회차만 가져오고, 회차·투어 제목은 따로 읽는다. 개인정보 필드를 읽지 않는다.

### B.5 횟수 제한 — DB 기록, IP 키 해시

| 저장 위치 | 판단 |
|---|---|
| 프로세스 메모리 | Vercel 서버리스는 인스턴스마다 메모리가 따로 있고 콜드 스타트마다 비워진다. 개발 서버 재시작에도 사라진다. 기각 |
| `applications`에 해시를 함께 저장해 성공한 신청만 셈 | 새 테이블이 없지만 해시가 신청과 함께 5년 보관된다(최소 보관 원칙 위반). 실패한 시도는 세지 못한다. 기각 |
| 외부 저장소(Redis 등) | 사용자 결정 D2(외부 서비스 없음)에 어긋남. 기각 |
| **별도 컬렉션 `application-attempts`(채택)** | 인스턴스와 무관하게 정확. 시도마다 1행, 오래된 행은 다음 시도에서 지움 |

- 키: `HMAC-SHA256(process.env.PAYLOAD_SECRET, 'apply-rate-limit:' + ip)`의 16진수 64자. 접두어로 용도를 나눠 같은 비밀 값을 다른 서명과 섞지 않는다. 새 환경 변수는 만들지 않는다. 비밀 값은 원래 환경 변수 `process.env.PAYLOAD_SECRET`이다(`payload.secret`은 Payload가 SHA-256으로 줄인 다른 값이므로 쓰지 않는다).
- IP 추출: `x-forwarded-for`의 첫 값(공백 제거) → 없으면 `x-real-ip` → 없으면 `unknown`(모든 익명 키가 하나로 묶임 — 로컬 개발에서만 생길 수 있음). 추출 함수는 순수 함수로 두고 단위 테스트한다.
- 순서: (1) 오래된 행 정리 (2) 이번 시도 기록 (3) 최근 10분 안 같은 키의 행 수를 세어 10을 넘으면 `RATE_LIMITED` (4) 허니팟 (5) 입력 검증 (6) 정원 확인 구간. 시도 기록은 정원 확인 트랜잭션 밖에서 하므로 신청이 거절되어도 남는다.
- 시각: 테스트가 시간 창을 검증할 수 있게 시도 시각은 신청 처리 함수가 받은 `now`(주지 않으면 호출 시점의 현재 시각)로 기록한다(Payload 자동 `createdAt`에 기대지 않음). 동의 일시(`privacyConsentAt`, `requestsConsentAt`)도 같은 `now`로 기록한다(REQ-APPLY-014).
- 한계: 같은 키의 동시 요청 몇 건이 세기와 기록 사이에 끼어 한도를 조금 넘을 수 있다. 기본 수준의 스팸 방지로는 받아들인다. 트래픽이 없으면 오래된 행이 다음 시도까지 남는다 → 배포 SPEC이 예약 정리(Vercel Cron 등)를 붙인다. `@MX:DEBT`로 남긴다.
- 배포 SPEC이 다시 확인할 것: (1) 운영에서 `x-forwarded-for`가 실제 클라이언트 IP 하나인지(Vercel 문서 §A.2), (2) Supabase 풀러(트랜잭션 모드)에서 `set_config(…, true)`·`FOR UPDATE`가 같은 트랜잭션 안에서 동작하는지, (3) 오래된 시도 기록의 예약 정리, (4) 서버리스 인스턴스 수와 연결 풀 크기.

### B.6 입력 규칙과 오류 코드

| 입력 | 규칙(서버 기준) | 오류 코드 |
|---|---|---|
| 회차 | 1 이상 2147483647 이하의 정수(`tour_sessions.id`가 `integer`라 범위를 넘으면 조회가 PostgreSQL `22003`으로 실패해 404 대신 500이 됨) | `SESSION_INVALID` |
| 이름 | 앞뒤 공백 제거 후 1~50자, 제어 문자 없음 | `NAME_REQUIRED`, `NAME_TOO_LONG`, `NAME_INVALID` |
| 이메일 | 앞뒤 공백 제거, 254자 이하, Payload `email` 필드 정규식 통과 | `EMAIL_INVALID` |
| 연락처 | 공백·하이픈·괄호·점 제거 후 `^\+?[0-9]{8,15}$`, 원문 30자 이하. 저장은 앞뒤 공백만 뺀 원문 | `PHONE_INVALID` |
| 인원 | 문자열 `"1"`~`"10"`의 정수 | `PARTY_SIZE_INVALID` |
| 요청 사항 | 500자 이하. 비어 있지 않으면 선택 동의 필요 | `REQUESTS_TOO_LONG`, `REQUESTS_CONSENT_REQUIRED` |
| 필수 동의 | 체크됨 | `PRIVACY_CONSENT_REQUIRED` |

- 연락처 예: `010-1234-5678`(11자리), `02-123-4567`(9자리), `+82 10-1234-5678`, `+1 (415) 555-0100`은 통과. `1234567`(7자리), `010-1234-567a`, `12+3456789`, 16자리는 거부.
- 이메일 일관성: 서버 검증이 받은 값은 컬렉션의 `email` 필드도 받아야 한다(그렇지 않으면 사용자에게 일반 오류가 보임). AC-APPLY-002가 같은 표본으로 두 쪽을 함께 검사한다.
- 검증 함수는 순수 함수(예: `src/lib/application-input.ts`)로 두고, 컬렉션 필드 검증은 Payload 기본 검증 + 같은 범위 규칙을 덧붙인다(SPEC-TOUR-001의 `validation.ts` 방식).
- 화면 문구: 오류 코드 → 한국어 안내의 대응표를 한 모듈(예: `src/lib/apply-messages.ts`)에 둔다. 로드맵 7번에서 언어별로 나눌 수 있다.

### B.7 동의 고지와 기록

- 문구는 한 모듈(예: `src/lib/consent.ts`)에 상수로 두고 버전 문자열 상수(`PRIVACY_POLICY_VERSION`)와 묶는다. 버전 형식은 `<날짜>.<해시 8자리>`이며 첫 값은 `2026-11-10.<sha8>`이다. `<sha8>`은 그 버전 문구 전체(필수·선택 고지·민감정보 안내를 정해진 순서로 이어 붙인 문자열)의 SHA-256 16진수 앞 8자리다. 버전은 실행 중에 계산하지 않고 소스에 문자열 리터럴로 적는다. 단위 테스트는 현재 문구로 SHA-256을 계산해 그 앞 8자리가 버전 문자열의 `.` 뒤 부분과 같은지 단언한다. 따라서 문구를 고치면 버전 리터럴을 고치기 전에는 테스트가 실패하고, 고친 버전 리터럴이 곧 새 버전이 되어 저장되는 `privacyPolicyVersion`도 바뀐다(REQ-APPLY-014). `<sha8>` 값은 run 단계에서 문구를 확정할 때 계산해 넣는다.
- 필수 동의 문구 초안(출시 전 전문가 확인 필요):
  - 수집 항목: 이름, 이메일, 연락처, 신청 인원, 선택한 회차. 부정 신청 방지를 위해 접속 IP를 변환한 값(10분간 신청 횟수를 세는 데만 쓰고 그 뒤 다음 신청 처리 때 삭제)
  - 이용 목적: 투어 신청 접수와 확인, 신청 관련 연락, 현장 참가자 확인
  - 보유 기간: 투어 종료일(취소한 경우 취소일)부터 5년 동안 보관한 뒤 지체 없이 파기
  - 거부할 권리: 동의를 거부할 수 있으며, 거부하면 신청할 수 없습니다
- 선택 동의 문구 초안: 수집 항목 요청 사항 / 목적 투어 진행 시 요청 반영 / 보유기간 투어 종료 후 지체 없이 파기 / 동의를 거부해도 신청할 수 있습니다.
- 안내: 요청 사항 입력란 바로 위 "건강·장애 등 민감한 정보는 적지 마세요".
- 저장 필드: `privacyConsentAt`(신청 처리 함수의 `now`), `privacyPolicyVersion`, `requestsConsentAt`(선택 동의가 있고 요청 사항이 비어 있지 않을 때만, 같은 `now`), `cancelledAt`(비어 있음 — 로드맵 6번이 채움). 보관 기준일은 `cancelledAt ?? 회차.endsAt`(가정 A6).

### B.8 화면 흐름

- 상세(`/tours/[slug]`): `SessionList`를 `<form method="get" action="/apply">`로 감싸고 라디오에 `required`, "신청하기" 제출 버튼을 둔다. 신청 가능 회차가 없으면 버튼을 그리지 않는다. 회차 값만 질의 문자열로 간다(개인정보 없음).
- 신청 화면(`/apply?session=<회차 ID>`): 서버 컴포넌트가 조회 계층의 새 함수(익명 권한, 공개 투어의 회차만)로 회차와 점유 인원을 읽는다. 404·신청 불가 안내는 REQ-APPLY-007. 양식은 클라이언트 컴포넌트(`useActionState`)이고 회차 ID는 숨은 입력란으로 보낸다. 요청 시점 렌더링은 `searchParams` 사용으로 보장되지만 SPEC-TOUR-001과 맞춰 `connection()`도 호출한다.
- 허니팟: 이름 `website`, 화면 밖 배치(`display:none`이 아닌 위치 이동 — 일부 봇이 숨김 필드를 건너뛰는 것을 피함), 감싸는 요소 `aria-hidden="true"`, `tabIndex={-1}`, `autoComplete="off"`.
- 접수 완료(`/apply/complete/[ref]`): `robots: { index: false }` 메타데이터. 상태 문구: 대기 "대기 — 관리자 확인 후 확정", 확정 "확정", 취소 "취소".
- `src/app/(frontend)/apply/` 아래에는 `loading` 파일을 두지 않는다(SPEC-TOUR-001 R21과 같은 이유 — `notFound()` 404 유지).
- 디자인: 핸드오프 화면 4·5의 구성(인원 선택·필수/선택 동의 구분·완료 요약)을 따르되 SPEC-TOUR-001처럼 기능 위주 + 기존 토큰만 쓴다.

### B.9 신청이 있는 회차의 삭제 거부

- `tour-sessions`의 `beforeDelete` 훅이 `applications`를 같은 `req`로 세어 1 이상이면 `APIError('Cannot delete a session that has applications. Applications must be kept for their retention period.', 400, undefined, true)`. `Tours.ts`의 기존 방식과 같다.
- 테스트·정리 순서: 신청 시도 기록 → 신청 → 회차 → 투어 → 미디어. 신청 삭제는 접근 규칙이 막으므로 정리는 로컬 API 기본값(`overrideAccess: true`)으로 한다.

## §C. 사전 점검 (run 단계 시작 전, 순차)

```powershell
git branch --show-current          # main
git rev-parse --short HEAD         # 기준 HEAD 기록 (계획 시점 0cdea2f)
git status --short                 # 추적 파일 변경 없음 확인(로그·감사 보고서 외)
docker compose ps --format '{{.Service}} {{.Health}}'   # postgres healthy
pnpm install --frozen-lockfile
pnpm test                          # 기준선 통과 수 기록
pnpm e2e                           # 기준선 통과 수 기록
pnpm lint
pnpm format:check
pnpm typecheck
```

기준선 결과(종료 코드와 통과 수)를 `progress.md` §E.2 첫머리에 적는다. 긴 출력은 `.moai/state/verify/<세션>/` 아래 파일로 남긴다.

## §D. 제약 (지킬 것)

- 새 npm 패키지 추가 금지(직접·간접). `pnpm-lock.yaml`은 바뀌지 않아야 한다. `drizzle-orm`을 직접 import하지 않는다(직접 의존성이 아님 — `@payloadcms/db-postgres`의 `sql`을 쓴다).
- `.prettierignore`, `eslint.config.mjs`의 검사 제외 목록, `pnpm-workspace.yaml`은 바꾸지 않는다.
- 유지: 전역 `lexicalEditor()`, `Users`·`Tours`·`Media` 컬렉션, `src/lib/preflight.ts`, `scripts/preflight.mjs`, `tests/helpers/e2e-env.ts` 포트 처리, Vitest 커버리지 설정, `getSessionAvailability`의 규칙(남은 자리 = 정원 − 점유, 0 미만이면 0; 사유 우선순위).
- `TourSessions.ts`는 `beforeDelete` 훅 추가만 한다(필드·접근 규칙 그대로).
- `src/app/(payload)/` 템플릿 파일은 직접 고치지 않는다. 생성 파일은 `pnpm generate:types`·`pnpm generate:importmap`으로만 다시 만든다.
- 개인정보를 `console`·`payload.logger`로 출력하지 않는다. 잡은 오류는 오류 코드·오류 클래스 이름·회차 ID만 기록한다.
- 커밋은 경로를 명시해 스테이징한다(`git add -A` 금지). `.env`, `media/` 아래 파일, 검증 로그는 커밋하지 않는다. 새 경로는 `git check-ignore -v`로 확인한다.
- Conventional Commits, 메시지에 `SPEC-APPLY-001`, 마지막 줄 `🗿 MoAI`. `--no-verify` 금지.

## §E. 자체 검증 순서

### E-1. 순차 실행 (상태를 쓰는 명령)

`pnpm test`와 `pnpm e2e`는 같은 개발 DB를 쓰고, `build`와 `e2e`는 `.next/`를 다시 쓰므로 병렬로 실행하지 않는다.

1. `docker compose up -d` → `postgres healthy`
2. `pnpm generate:types`, `pnpm generate:importmap` → 생성 파일 차이 확인
3. `pnpm typecheck`
4. `pnpm build`
5. `pnpm test`
6. `pnpm e2e`
7. 변이 확인(AC-APPLY-010): 잠금 문장을 잠시 뺀 코드로 동시성 테스트 파일만 실행 → 실패 확인 → 되돌림 → 다시 통과 확인

### E-2. 병렬 실행 (읽기 전용 — E-1이 끝난 뒤 한 턴에)

```powershell
pnpm lint
pnpm format:check
git status --short
git diff --stat 0cdea2f -- pnpm-lock.yaml .prettierignore eslint.config.mjs pnpm-workspace.yaml
```

마지막 명령의 출력은 비어 있어야 한다(§D).

## §F. 마일스톤

각 마일스톤은 RED(실패하는 테스트) → GREEN(최소 구현) → REFACTOR 순서다.

### M1 — 데이터 모델과 접근 규칙 (우선순위: High)

- RED: 통합 테스트 — 등록 컬렉션 목록(REQ-APPLY-002, `users-auth.spec.ts` 단언 갱신), `applications` 필드 검증(필수 값, 인원 범위, 요청 사항 길이, 상태 기본값, 접수 번호 고유), 이메일 표본 일관성, 접근 규칙(익명·관리자 생성·수정·삭제 거부, 읽기는 관리자만, 시도 기록은 아무도 못 읽음), 신청이 있는 회차 삭제 거부
- GREEN: `src/collections/{Applications,ApplicationAttempts}.ts`, `TourSessions.ts` 삭제 훅, `payload.config.ts` 등록, 입력 규칙 순수 함수 일부(필드 검증이 쓰는 범위)
- `pnpm generate:types`, `pnpm generate:importmap`
- 수동: 관리자 화면에서 신청 목록·상세가 읽기 전용이고 "새로 만들기"가 없으며 시도 기록 메뉴가 없음을 확인 → §E.2 기록
- 검증: AC-APPLY-001~004
- 관련 REQ: 001~004

### M2 — 점유 인원과 정원 확인 구간 (우선순위: High — 가장 위험한 결정)

- RED: 단위(입력 검증 전체 표, 접수 번호 형식·문자 집합·1만 개 중복 없음) + 통합(점유 인원 정의: 대기·확정만 합산 / 순차 처리: 정확히 채우면 마감, 덜 채우면 모집 중 유지, 자리 부족·마감·시작·비공개 투어 거부, 처리 중 강제 오류 시 롤백 / 동시성: 12건 병렬, 섞인 인원 병렬, 각 3회 / 잠금 대기 초과 / 취소로 바꿔도 마감 유지)
- GREEN: 점유 인원 모듈, 입력 검증 모듈, 접수 번호 모듈, 신청 처리 함수(§B.1 절차), 동의 문구 모듈과 버전 해시 테스트
- 변이 확인(§E-1 7번): 잠금 문장을 빼면 동시성 테스트가 실패해야 한다. 3회 실행해도 실패하지 않으면 테스트가 경합 창을 넓힐 수 있게 커밋 직전 주입 지점(§B.3)에 지연을 넣는 방안을 차단자 보고로 올린다
- 잠금 대기 증거(AC-APPLY-010): 4건 병렬 제출 중 첫 주입 함수가 잠금을 쥔 채 기다리는 동안 `payload.db.pool.query`로 `pg_stat_activity`를 조회해 같은 DB에서 `wait_event_type = 'Lock'`이고 질의문에 `for update`가 들어간 세션이 1개 이상임을 확인한다. 병렬 수를 4로 두는 이유: 연결 풀(10개)에 여유가 있어야 확인 질의가 연결을 얻는다
- 검증: AC-APPLY-008(검증 함수 부분), AC-APPLY-009, AC-APPLY-010, AC-APPLY-011(단위), AC-APPLY-014
- 관련 REQ: 005(정의), 008~011, 014

### M3 — 화면 표시에 점유 인원 반영 (우선순위: High)

- RED: 통합 — 조회 계층이 점유 인원을 반영한 남은 자리를 돌려주는지(취소 제외), 질의 수가 회차 수와 무관한지(`payload.db.pool.query` 감시)
- GREEN: `catalog.ts`의 `findUpcomingSessions` 결과로 점유 인원 맵 1회 조회 → `toSession`에 전달. `@MX:NOTE` 갱신(확장 완료)
- 검증: AC-APPLY-005
- 관련 REQ: 005

### M4 — 스팸 방지 (우선순위: Medium)

- RED: 단위(IP 추출 순수 함수, 키 해시가 원문 IP를 담지 않음) + 통합(10회까지 처리, 11번째 `RATE_LIMITED`, 다른 IP는 영향 없음, 10분 뒤 다시 처리, 오래된 행 정리, 허니팟 거부·저장 없음)
- GREEN: 횟수 제한 모듈, 신청 처리 함수 앞단 연결
- 검증: AC-APPLY-013
- 관련 REQ: 013

### M5 — 화면: 신청하기, 신청 화면, 서버 액션, 접수 완료 (우선순위: Medium)

- RED: E2E — 상세의 "신청하기"(회차 미선택 시 이동 없음, 신청 가능 회차 없으면 버튼 없음), 신청 화면 구성·동의 고지 고정 문자열·허니팟 비가시·인원 선택지 상한(점유 인원이 있는 회차의 "남은 자리 3 / 5"와 선택지 `1`~`3`), 404 사례와 신청 불가 안내(마감·시작함·자리 없음 세 종류 모두 200), 입력 오류 안내, 성공 흐름(접수 번호 URL, 화면 내용, 새로고침 후 신청 수 불변, 개인정보·DB ID 없음), 자바스크립트 끈 제출의 303, 목록·상세 남은 자리 반영, 익명 REST·GraphQL 생성·조회 거부와 관리자 REST 생성 거부
- GREEN: `SessionList`·상세 페이지 수정, `src/app/(frontend)/apply/page.tsx`, 양식 클라이언트 컴포넌트, 서버 액션, `src/app/(frontend)/apply/complete/[ref]/page.tsx`, 화면 문구 모듈
- 저장소 규칙: `apply/` 아래 `loading` 파일 없음
- E2E 시도 기록 충돌 방지: 테스트마다 `x-forwarded-for`를 TEST-NET 주소(`198.51.100.x`)로 바꿔 보내고, 끝나면 그 주소들의 키 해시로 시도 기록을 지운다
- E2E 정리 도우미 변경(확정 작업): `tests/helpers/e2e-catalog.ts`의 `cleanupCatalogFixture`는 지금 `tour-sessions`를 투어 단위로 일괄 삭제한다(118행). 이 SPEC의 E2E는 그 투어의 회차에 신청을 만들므로, 새 `beforeDelete` 훅(§B.9) 때문에 일괄 삭제가 오류를 모아 정리가 실패한다. 회차 일괄 삭제 바로 앞에 "그 투어들의 회차에 속한 `applications` 삭제" 단계를 넣고, 같은 `step()`으로 오류를 모은다. 기존 SPEC-TOUR-001 E2E(신청 없음)에서는 삭제 대상이 0건이라 동작이 바뀌지 않는다
- 검증: AC-APPLY-003(E2E 부분), AC-APPLY-006, AC-APPLY-007, AC-APPLY-008(화면 부분), AC-APPLY-012
- 관련 REQ: 003, 005~008, 012, 014

### M6 — 개인정보 비노출 점검, 회귀 정리, 품질 게이트 (우선순위: Low)

- 통합: 성공·실패 처리 중 `console`과 `payload.logger` 출력을 붙잡아 표식이 붙은 이름·이메일·연락처·요청 사항이 0건임을 확인(대상 로그가 1건 이상 수집되었는지 먼저 단언)
- 전체 품질 게이트(`acceptance.md` §5), 커버리지 85% 이상
- MX 태그 정리: 점유 인원 `@MX:ANCHOR`, 신청 처리 함수 `@MX:WARN`(트랜잭션·잠금 — 같은 `req` 사용 필수) + `@MX:REASON`, 횟수 제한 `@MX:DEBT`(`@MX:CEILING` 트래픽 적은 단일 리전, `@MX:UPGRADE` 배포 SPEC 예약 정리), `getSessionAvailability`·`SessionList`의 신청 SPEC 확장 `@MX:NOTE` 갱신
- `progress.md` §E.2·§E.3 작성
- 검증: AC-APPLY-015, AC-APPLY-016
- 관련 REQ: 015, 016

### 예상 생성·수정 파일

- 생성: `src/collections/{Applications,ApplicationAttempts}.ts`, `src/lib/{occupancy,application-input,submit-application,reference-code,rate-limit,consent,apply-messages}.ts`(이름은 예시, 합치거나 나눌 수 있음), `src/app/(frontend)/apply/{page.tsx,ApplyForm.tsx,actions.ts}`, `src/app/(frontend)/apply/complete/[ref]/page.tsx`, `tests/unit/*`(입력 검증·접수 번호·IP 추출·동의 버전), `tests/integration/*`(신청 컬렉션·접근, 신청 처리, 동시성, 점유 인원·질의 수, 횟수 제한, 로그 비노출), `tests/e2e/apply.spec.ts`(예시), `tests/helpers/application-fixtures.ts`(예시)
- 수정: `src/payload.config.ts`, `src/collections/TourSessions.ts`(삭제 훅만), `src/lib/catalog.ts`, `src/components/SessionList.tsx`, `src/app/(frontend)/tours/[slug]/page.tsx`, `tests/integration/users-auth.spec.ts`, `tests/unit/repo-rules.spec.ts`, `tests/helpers/e2e-catalog.ts`(정리에 신청 삭제 단계를 회차 삭제 전에 추가 — M5, 확정)
- 생성 파일 갱신: `src/payload-types.ts`, 필요하면 `src/app/(payload)/admin/importMap.js`

## §G. 위험과 대응

| ID | 위험 | 대응 |
|---|---|---|
| R1 | 잠금 문장과 합계를 한 문장으로 쓰거나 잠금 전에 합계를 읽어 Read Committed 스냅숏이 오래된 값을 봄 → 정원 초과 | §B.1 3번 순서 고정. 동시성 테스트 + 잠금 제거 변이 확인 |
| R2 | 정원 확인 구간 안의 질의 하나가 `req` 없이 실행되어 풀 연결을 새로 기다림 → 풀 고갈 시 정지 | §B.1 주의 사항, `@MX:WARN`. 동시성 테스트를 풀 크기(10)보다 많은 12건으로 실행하고 제한 시간 안에 끝남을 단언 |
| R3 | 안쪽 `payload.create` 실패가 바깥 트랜잭션을 이미 롤백 → 바깥 코드가 같은 트랜잭션으로 회차를 갱신하려다 다른 연결로 실행 | 안쪽 작업 예외는 곧바로 바깥 `catch`로 가게 하고, 그 뒤 질의를 실행하지 않는다. 롤백 테스트(AC-APPLY-009 강제 오류)로 확인 |
| R4 | `beginTransaction`이 `null`(트랜잭션 꺼짐) → 잠금 없이 진행 | 값이 없으면 내부 오류로 끝냄(§B.1 1번). 단위로 대체할 수 없으므로 코드 검토 항목 |
| R5 | `numeric` 합계가 문자열로 와서 `'2' + 1 = '21'` 같은 결합 | `Number()` 변환과 `NaN` 거부. 순차 처리 테스트의 정확히 채우기 사례가 잡는다 |
| R6 | 원시 SQL의 테이블·열 이름이 Payload 생성 이름과 다름 | 통합 테스트가 실제 DB로 실행. 열 이름은 §A.2 실측 규칙을 따름 |
| R7 | 서버 액션 `redirect`를 `try` 안에서 불러 잡혀 버림 | `try` 밖에서 호출(§A.2). E2E 성공 흐름이 확인 |
| R8 | 자바스크립트 없는 제출이 동작하지 않음 | E2E가 자바스크립트를 끈 브라우저 컨텍스트로 제출해 303과 접수 완료 화면 확인(AC-APPLY-012) |
| R9 | E2E 제출이 같은 접속 IP로 묶여 10회 제한에 걸림 | 테스트마다 다른 `x-forwarded-for`, 끝나면 그 키의 시도 기록 삭제(M5) |
| R10 | 개발 서버가 `x-forwarded-for`를 바꿔 첫 값이 테스트가 보낸 값이 아님 | 설치본 확인 결과 들어온 값은 보존된다(§A.2, `base-server.js` 604행). M5 첫 단계에서 한 번 더 실제 값을 §E.2에 기록 |
| R11 | 로그·오류에 개인정보가 섞임(Payload `ValidationError` 메시지, PostgreSQL 오류 `detail`, `DrizzleQueryError.message`의 `params:` 줄 — INSERT 실패 시 이름·이메일·연락처가 그대로 실림) | 잡은 오류의 `message`·`detail`·`params`를 기록·반환하지 않고 고정 코드로만 바꾼다. SQLSTATE는 `err.cause?.code`까지 확인. AC-APPLY-015 로그 포착 테스트 |
| R12 | 신청이 남은 회차 때문에 기존 SPEC-TOUR-001 테스트 정리가 실패 | 이 SPEC 테스트는 자기 신청을 먼저 지운다(§B.9 순서). 공용 E2E 정리 도우미 `tests/helpers/e2e-catalog.ts`에는 회차 삭제 전 신청 삭제 단계를 추가한다(M5 확정 작업). 기존 테스트는 신청을 만들지 않으므로 그 단계의 삭제 대상이 0건이다 |
| R13 | 이메일 검증 불일치로 서버 검증 통과 값이 컬렉션에서 거부되어 일반 오류 | §B.6 일관성 표본 테스트 |
| R14 | 동의 문구가 버전 없이 바뀜 | 버전별 SHA-256 단위 테스트(§B.7) |
| R15 | 개발 모드 스키마 자동 반영이 새 테이블 생성 중 대화형 확인을 요구 | 새 테이블만 추가하고 기존 열은 바꾸지 않는다. 문제가 생기면 SPEC-TOUR-001 R12 절차 |
| R16 | 동시성 테스트가 시각에 따라 흔들림(시작 시각 근처) | 테스트 회차는 실행 시각 기준 하루 이상 뒤. "시작함" 사례만 하루 전 시작 회차를 쓴다 |
| R17 | 횟수 제한의 세기·기록 사이 경합으로 한도를 몇 건 넘김 | 기본 수준 보호로 받아들임(§B.5 한계). 테스트는 순차 제출로 판정 |
| R18 | 운영(Supabase 풀러)에서 트랜잭션·`set_config(…, true)`가 다르게 동작 | 배포 SPEC 확인 목록(§B.5)에 넣음 |
| R19 | 직접 작성 코드가 Tier M 지침을 크게 넘음 | §A.3 분할 기준 |
| R20 | (잔여 위험) COMMIT 자체가 실패해도 `commitTransaction`이 예외 없이 끝나 "성공"을 돌려주고 저장은 안 될 수 있음(연결 끊김 등, §A.2) | 이 SPEC에서는 코드 대응을 하지 않고 잔여 위험으로 기록한다. 필요하면 커밋 뒤 접수 번호로 다시 읽어 확인하는 방안을 로드맵 5번(알림) 이전에 검토 |
| R21 | `set_config` 대신 `SET LOCAL … = $1`을 써서 `42601` 실패 | §B.1 2번 고정. AC-APPLY-010 잠금 대기 사례가 실제로 실행되어 드러남 |
| R22 | 회차 식별 값이 `integer` 범위를 넘어 조회가 `22003`으로 실패 → 500 | 입력 규칙에서 범위 검사(§B.6). AC-APPLY-007·008 사례 |

안티 패턴 (하지 말 것):

- 정원 확인을 트랜잭션·잠금 없이 "읽고 나서 쓰기"로 하기
- 점유 인원을 화면 코드나 신청 처리 함수 안에서 따로 정의하기(상태 목록을 두 곳에 쓰기)
- `applications`의 REST 생성을 열고 훅으로 막으려 하기
- 서버 액션 반환값·로그·오류 문구에 입력값을 넣기
- 접수 번호에 `Math.random`이나 DB ID를 쓰기
- 횟수 제한을 메모리 `Map`으로 구현하기
- 동시성 테스트를 `await`를 하나씩 기다리는 순차 실행으로 쓰기(병렬이 아니면 아무것도 증명하지 못함)
- 검증 명령을 실행하지 않고 통과로 기록하기

## §H. 상호 참조

- `spec.md` — REQ-APPLY-001~016, 용어(§2.5), 가정(§2.4), 제외 범위
- `acceptance.md` — 오류 코드 표(§0), AC-APPLY-001~016, 품질 게이트, 완료 정의
- `interview.md` — 사용자 결정 D1~D4
- `.moai/specs/SPEC-TOUR-001/` — 단일 계산 지점, 조회 계층, 테스트 데이터 표식, 위험 R1·R8·R12·R21
- `.moai/project/product.md` §8.3, `structure.md` §3, `design/handoff.md` §1~§3
- 근거 소스: §A.2 표의 경로와 URL
