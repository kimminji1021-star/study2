# SPEC-APPLY-001 (compact) — 신청 흐름과 정원

> run 단계용 요약본. 원본: `spec.md`(요구사항·용어·가정), `acceptance.md`(오류 코드·수용 기준), `plan.md`(결정·마일스톤·위험), `interview.md`(사용자 결정). 내용이 다르면 원본이 우선한다.
> Tier M · status: draft · 문서 버전 0.1.2(plan-audit 1회차 D1~D7·O1~O12, 2회차 MF-1·MF-2·N1·N3·N5 반영) · 개발 방식: TDD · 검증 셸: Windows PowerShell 5.1 · 의존: SPEC-TOUR-001(completed) · 기준 HEAD `0cdea2f`

## 사용자 결정 (구속)

D1 인원 1~10 정수, 남은 자리 이하 · D2 허니팟 + 간단한 횟수 제한(외부 서비스·캡차 없음) · D3 별도 접수 완료 페이지(접수 번호·투어·회차·인원·"대기 — 관리자 확인 후 확정", 개인정보 없음, 새로고침 재제출 없음, 추측 불가 번호, DB ID 비노출) · D4 관리자는 읽기만, 기본 상태 대기, 상태 변경은 로드맵 6번.

## 핵심 결정 (plan.md §B)

- 동시성: `payload.db.beginTransaction()` → 같은 연결로 `SELECT set_config('lock_timeout', $1, true)`(기본 `'5000'` — `SET LOCAL … = $1`은 42601로 실패) → `SELECT … FROM tour_sessions WHERE id = $1 FOR UPDATE` → **잠금 뒤 별도 문장**으로 회차·투어 공개 여부·점유 합계 → 판정(`getSessionAvailability` 재사용) → `payload.create(..., req, overrideAccess: true)` → 합계 = 정원이면 같은 `req`로 회차 `closed` → 커밋. 예외 시 롤백, `55P03`(`err.code` 또는 drizzle `DrizzleQueryError`의 `err.cause.code`) → `SESSION_BUSY`. 오류 `message`는 바인딩 인자(개인정보)를 담으므로 기록·반환 금지, 고정 코드로만 변환. COMMIT 실패가 조용히 삼켜질 수 있음(잔여 위험 R20). 실측: 잠금 있으면 뒤 트랜잭션이 앞 저장을 보고 거절, 없으면 정원 초과
- 정원 확인 구간의 모든 질의는 같은 `req`(풀 기본 10 — 고갈 정지 방지). `numeric` 합계는 문자열 → `Number()`. `beginTransaction`이 `null`이면 내부 오류
- 점유 인원: 저장 안 함. `SUM(party_size) … status IN ('pending','confirmed')` 정의 한 곳(`@MX:ANCHOR`). 화면용은 회차 ID 목록 `GROUP BY` 1회, `catalog.ts` `toSession`이 `occupiedSeats`로 전달
- 생성 경로: 서버 액션 하나 → `src/lib/` 신청 처리 함수. `applications` 접근: 읽기 관리자만, 생성·수정·삭제 모두 거부(관리자 포함). `application-attempts`: 전부 거부 + `admin.hidden`
- 접수 번호: `SB-XXXXX-XXXXX`, Crockford Base32 10자(50비트, `node:crypto`), 고유 제약, 재시도 없음. 완료 경로는 대소문자 구분 없이 받아 대문자로 맞춘 뒤 형식 검사·조회, 개인정보 필드 미조회
- 횟수 제한: `application-attempts`(키 = `HMAC-SHA256(process.env.PAYLOAD_SECRET, 'apply-rate-limit:' + ip)`, 시도 시각 = 주입 `now`, 동의 일시도 같은 `now`). 순서: 오래된 행 정리 → 기록 → 10분 내 > 10회면 `RATE_LIMITED` → 허니팟 → 검증 → 정원 확인. IP = `x-forwarded-for` 첫 값 → `x-real-ip` → `unknown`
- 입력: 회차 1~2147483647 정수, 이름 앞뒤 공백 제거 후 1~50자·제어 문자 없음, 이메일 Payload 정규식 + 254자, 연락처 기호 제거 후 `^\+?[0-9]{8,15}$`(원문 30자 이하), 인원 `"1"`~`"10"`, 요청 사항 500자 + 있으면 선택 동의 필수, 필수 동의
- 동의: 문구·버전 한 모듈. 버전 리터럴 `2026-11-10.<sha8>`(문구 전체 SHA-256 앞 8자리), 단위 테스트가 계산한 해시와 버전 뒤 8자리 일치를 단언 → 문구 변경 ⇒ 버전 변경. 저장 `privacyConsentAt`·`privacyPolicyVersion`·`requestsConsentAt`·`cancelledAt`(비어 있음). 출시 전 전문가 확인 필요
- 화면: 상세 `SessionList`를 `<form method="get" action="/apply">`로 감싸고 `required` + "신청하기"(신청 가능 회차 없으면 버튼 없음). `/apply?session=<id>`(404·신청 불가 안내), 양식은 `useActionState` 클라이언트 컴포넌트, 성공 시 `redirect`(try 밖, 무JS 303) → `/apply/complete/<ref>`(noindex). `apply/` 아래 `loading` 파일 금지
- 신청이 있는 회차 삭제 거부: `Cannot delete a session that has applications. …`(영문 고정)
- 테스트 전용 주입 지점: 회차 마감 갱신 뒤·커밋 바로 앞, 같은 트랜잭션의 `req`를 받음(롤백 시 마감 상태 `closed` 기록 후 예외, 잠금 대기 증거용 일시 정지, 강제 오류 로그)
- 새 npm 패키지 없음(`drizzle-orm` 직접 import 금지, `@payloadcms/db-postgres`의 `sql` 사용)

## 요구사항 (GEARS)

- **REQ-APPLY-001** `applications`: 회차(필수)·이름·이메일·연락처·인원(1~10 정수)·요청 사항(선택, ≤500)·상태(대기/확정/취소, 기본 대기)·접수 번호(고유)·필수 동의 일시·문구 버전·선택 동의 일시·취소일. **When** 위반 → 검증 오류, 변경 없음.
- **REQ-APPLY-002** 시스템 제외 등록 목록 = `users`, `media`, `tours`, `tour-sessions`, `applications`, `application-attempts`(REQ-TOUR-004 대체).
- **REQ-APPLY-003** 두 컬렉션의 생성·수정·삭제는 모든 접근 규칙 경로에서 익명·관리자 모두 거부. 시도 기록은 누구도 못 읽고 메뉴에 없음. **While** 관리자가 아니면 신청 읽기는 비었거나 권한 오류. 관리자는 읽기 가능. 생성은 서버 제출 경로로만.
- **REQ-APPLY-004** **When** 신청이 있는 회차 삭제 → 거부(영문 고정 문구), 관리자도.
- **REQ-APPLY-005** 점유 인원 = 대기·확정 인원 합(취소 제외), 정의 한 곳, 화면·처리 공통, 단일 계산 지점에 전달, 조회 질의 수는 회차 수와 무관.
- **REQ-APPLY-006** **While** 신청 가능 회차 있음 → "신청하기". **When** 회차 선택 후 누름 → 신청 화면. 미선택이면 이동 없음, 없으면 버튼 없음.
- **REQ-APPLY-007** **When** 신청 가능 회차의 신청 화면 → 제목·일시·남은 자리·입력란·필수/선택 동의 고지·민감정보 안내·허니팟, 인원 선택지 1~min(10, 남은 자리). 식별 값 없음·1~2147483647 정수 아님·없음·비공개 → 404. 공개지만 신청 불가 → 안내 + 상세 링크, 양식 없음.
- **REQ-APPLY-008** **When** 제출 → 서버 재검증(규칙은 위 — 연락처 원문 30자 이하 포함, 이름은 앞뒤 공백 제거 후 1~50자·제어 문자 없음). 위반 → 저장 없음, 입력란별 영문 코드, 한국어 안내. 요청 사항을 몰래 버리고 저장하지 않음.
- **REQ-APPLY-009** **When** 검증 통과 → 한 트랜잭션: 회차 잠금, 공개·모집 중·시작 전·인원 ≤ 남은 자리 재확인, 대기로 저장, 합계 = 정원이면 마감, 커밋. 실패·오류 → 롤백 + 코드.
- **REQ-APPLY-010** 동시 제출에도 점유 ≤ 정원, 받아들인 수 = 저장 수, 회차별 직렬. **When** 잠금 5초 초과 → 다시 시도 코드. **While** 마감 → 받지 않음, 스스로 다시 열지 않음(취소돼도).
- **REQ-APPLY-011** 접수 번호 `SB-` + Crockford Base32 10자, 암호학적 난수, 고유, DB ID 무관. DB ID는 화면 URL·내용에 없음.
- **REQ-APPLY-012** **When** 커밋 → `/apply/complete/<번호>` 리다이렉트(무JS 303). 번호·제목·일시·인원·상태 문구, 개인정보 없음, noindex, 새로고침 재제출 없음. 번호는 대소문자 구분 없이 받아 대문자로 맞춘 뒤 검사·조회. **When** 그래도 형식 오류·없는 번호 → 404.
- **REQ-APPLY-013** 시도마다 IP 키 해시 + 시각 기록(원문 IP 저장 안 함). **When** 10분 내 10회 초과 → `RATE_LIMITED`. **When** 허니팟 값 → `SUBMISSION_REJECTED`. 10분 지난 기록은 다음 시도 때 삭제.
- **REQ-APPLY-014** 필수 고지 ①~④(5년, 거부 시 신청 불가), 선택 고지(거부해도 신청 가능), 민감정보 안내. **When** 저장 → 동의 일시·버전·(선택 동의 + 요청 사항 있을 때 선택 동의 일시) 기록, 두 일시는 처리 시각(주입 `now`). 문구가 바뀌면 버전도.
- **REQ-APPLY-015** 개인정보를 로그·오류 코드·오류 문구·URL·완료 화면에 담지 않음. 로그는 오류 코드·오류 종류 이름·회차 ID만.
- **REQ-APPLY-016** 단위·통합(실제 DB 병렬 동시성 포함)·E2E, 데이터 자체 생성·정리, 커버리지 85%, 기존 게이트 유지.

## 수용 기준 요약 (acceptance.md)

AC-001 컬렉션 목록 · AC-002 필드 검증·이메일 일관성 · AC-003 권한(로컬·REST·GraphQL 관리자 대조군, 쓰기 정확히 403, 관리자 수동) · AC-004 회차 삭제 거부 · AC-005 점유 인원·질의 수(`pool.query` 감시 + `connect` 수 = `query` 수) · AC-006 목록·상세 남은 자리와 "신청하기" · AC-007 신청 화면·404·허니팟, 점유 반영(정원 5·대기 2 회차 → "남은 자리 3 / 5", 선택지 `1`~`3`), 마감·시작함·자리 없음 회차 모두 200 + 불가 안내 · AC-008 입력 검증 · AC-009 순차 정원·자동 마감·롤백 · AC-010 병렬 12건·섞인 인원 각 3회, `pg_stat_activity` 잠금 대기 증거, 기본 5초 단언, 잠금 대기 제한(300ms → `SESSION_BUSY`, 2초 안에 반환), 다시 열지 않음, 잠금 제거 변이 · AC-011 접수 번호 · AC-012 완료 화면·303·404·재제출 없음 · AC-013 허니팟·횟수 제한, 저장 키 = `HMAC-SHA256(PAYLOAD_SECRET, 'apply-rate-limit:203.0.113.10')` 16진수 ≠ `SHA-256('203.0.113.10')` · AC-014 동의 기록·문구 버전 · AC-015 개인정보 비노출 · AC-016 테스트·커버리지·정리

## 마일스톤 (plan.md §F)

M1 데이터 모델·접근 규칙 → M2 점유 인원·정원 확인 구간(동시성, 변이 확인) → M3 화면 표시 반영 → M4 스팸 방지 → M5 화면·서버 액션·완료(+ `tests/helpers/e2e-catalog.ts` 정리에 회차 삭제 전 신청 삭제 단계 추가 — 확정) → M6 개인정보 점검·품질 게이트·MX
