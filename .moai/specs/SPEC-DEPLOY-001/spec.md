---
id: SPEC-DEPLOY-001
title: "배포 기반(1단계) — Vercel·Supabase 비공개 미리보기 배포, 마이그레이션, 업로드 저장소, 예약 정리, 운영 설정 점검"
version: "0.1.3"
status: in-progress
created: 2026-11-17
updated: 2026-11-23
author: study2
priority: P1
phase: "v0.6.0 target"
module: "src/, scripts/, vercel.json"
lifecycle: spec-anchored
tags: "deploy, vercel, supabase, migrations, storage-s3, cron, cron-secret, deployment-protection, noindex, pooler, ssl, log-redaction, consent-version, preflight"
tier: M
depends_on: [SPEC-INFRA-001, SPEC-TOUR-001, SPEC-APPLY-001, SPEC-ADMIN-001, SPEC-LANDING-001]
---

# SPEC-DEPLOY-001: 배포 기반 (로드맵 8번, 2단계 중 1단계)

## HISTORY

| 버전 | 날짜 | 작성자 | 내용 |
|---|---|---|---|
| 0.1.0 | 2026-11-17 | study2 (manager-spec) | 최초 작성 — `product.md` §7 로드맵 8번 "배포"의 1단계 "배포 기반". 2026-11-17 사용자 결정 6가지(`interview.md`)와 앞선 SPEC들의 배포 이월 항목(`plan.md` §A.3 처리 표) 반영. 공개 출시(처리방침 페이지·운영자 정보·바닥글 링크·검색 허용)는 2단계 SPEC(예: SPEC-LAUNCH-001)이 맡는다 |
| 0.1.1 | 2026-11-17 | study2 (manager-spec) | plan-audit 1회차(FAIL 0.69, `.moai/reports/plan-audit/SPEC-DEPLOY-001-review-1.md`) 반영. 필수 D1~D10: 저장소 플러그인을 항상 등록하고 `enabled`로 켜고 끄며 `alwaysInsertFields: true`로 두 환경의 스키마를 같게 함(첫 마이그레이션도 이 설정으로), AC-DEPLOY-015 비밀값 검사 명령을 `[^[:space:]]`·실제 비밀값 모양 기준으로 다시 쓰고 HEAD `0057e9d`에서 빈 출력 실측, 풀 최소 3(Payload가 연결 1개 상시 점유)과 연결 예산 재계산·최소값 동시 신청 시험, 원격 DB인데 인증서가 없으면 연결 거부, Supabase Data API 끄기 단계와 확인 줄, 사용자 답 Q5(업로드 칸 "4MB 이하" 안내)·Q6(미리보기 동안 수동 정리) 반영과 수동 정리 SQL, 다음 날 Cron 확인을 DB 확인으로, 리전 판정을 함수 리전·`x-vercel-id` 마지막 리전 칸으로, `migrate:check`가 새 파일을 지우고 실패하도록, 시험 설정 파일(`setup-env.ts`·`e2e-env.ts`)에도 루프백 판정. 선택 D11~D20 중 확인된 사실 오류·모호성 반영. REQ 16개·AC 16개 유지(새 항목은 기존 REQ·AC에 합침) |
| 0.1.2 | 2026-11-17 | study2 (manager-spec) | plan-audit 2회차(FAIL 0.84, `.moai/reports/plan-audit/SPEC-DEPLOY-001-review-2.md`) 반영. 필수 N1: 다음 날 자동 정리 확인의 증거 행을 Cron 수동 실행 **뒤에** 만드는 별도 확인 신청으로 바꿈(수동 실행이 증거 행을 지워 거짓 통과가 나던 순서 결함 — REQ-014 (가), `plan.md` §I.4 8번). 필수 N2: `migrate:check`가 새 파일을 지울 때 Payload가 다시 쓴 `src/migrations/index.ts`도 원래 내용으로 되돌리고, 실행 뒤 `git status --short src/migrations` 빈 출력을 판정에 더함(REQ-003). 선택 N3~N7 모두 반영: 시험 환경 파일의 판정 시점을 확인 가능한 문장으로, 수동 정리 SQL을 두 행 수를 한 번에 돌려주는 한 문장으로(2월 29일 하루 차이 기록), README SQL의 표·칸 이름을 정리 구현과 비교, M1에서 `pnpm generate:importmap` 확정, `interview.md`의 낡은 세 행에 대체 표시. REQ 16개·AC 16개 유지 |
| 0.1.3 | 2026-11-23 | study2 (manager-spec) | sync 감사 반영: 한글 파일 이름 업로드 알려진 제한, 사용자 결정 (가). §2.4에 제한 문구를 더하고, §5에 파일 이름 업로드 진단·수정과 Data API 두 번째 방어선을 SPEC-LAUNCH-001의 공개 전 필수 조건으로 더함. `plan.md`의 사용자 안내와 경로·버전 표기를 실제 배포 결과에 맞춤. REQ 16개·AC 16개 유지, `acceptance.md`는 바꾸지 않음 |

## 1. 개요

지금까지 만든 숨비투어를 **실제 인터넷 주소에 올리되 아무나 볼 수 없는 상태**로 배포한다. 운영과 같은 구성(Vercel 서울 함수 + Supabase 서울 DB·저장소)에서 모든 기능이 돌아가는지 확인하는 단계이며, 일반 방문자에게 여는 공개 출시는 2단계에서 한다. 범위는 다음 여섯 가지다.

1. 데이터베이스: 개발용 스키마 자동 반영(push) 대신 Payload 마이그레이션, Supabase 연결 풀러(트랜잭션 모드)와 인증서 확인(SSL), 연결 수 설정, 원격 DB에 개발·테스트 명령이 닿지 않게 막기
2. 업로드 저장소: 운영에서는 이미지 파일을 Supabase Storage(S3 호환)에 저장하고, 파일 주소의 공개 범위(공개 투어 대표 이미지 + 홈 대표 사진)는 그대로 지킨다
3. 예약 정리: Vercel Cron(하루 한 번)이 10분 지난 신청 시도 기록과 2년 지난 관리자 작업 기록을 지운다. 엔드포인트는 `CRON_SECRET`으로 보호하고, 동의 고지의 IP 변환값 보관 문구를 실제 최대 보관 시간으로 고친다
4. 운영 설정 점검: 운영 빌드에 꼭 필요한 값(사이트 주소, Cron 비밀값, DB 인증서, 저장소 키)이 빠지면 빌드를 멈추고, 서버 로그에 DB 질의 값(개인정보)이 남지 않게 가린다
5. 비공개 유지: Vercel Authentication(모든 배포 보호)으로 로그인한 본인만 보게 하고, 검색 엔진 제외 표시를 단다
6. 사용자 안내: 사용자만 할 수 있는 단계(계정·프로젝트 만들기, 키 복사, 저장소 연결, 보호 켜기)를 초보자용 단계별 안내로 `plan.md`에 둔다. Claude는 비밀값을 직접 입력하지 않는다

## 2. 배경과 전제

### 2.1 근거 문서

- `.moai/project/product.md` §7 로드맵 8번, `.moai/project/tech.md` §4 환경 변수 이름·§5 배포 방침(Vercel Hobby, Supabase Free, 풀러 주소, 마이그레이션 사용 권장, Hobby 비상업 용도 한정)
- 앞선 SPEC의 배포 이월 기록: SPEC-INFRA-001 `progress.md` `deferred_to_deployment_spec`, SPEC-TOUR-001 `progress.md` 잔여 위험, SPEC-APPLY-001 `progress.md` §E.4 `deferred_optional_findings` F3~F5와 "출시 전 보완 (2026-11-12)", SPEC-ADMIN-001 `progress.md` §E.4 `carry_over.deploy`와 `plan.md` §G R20·R23·R30, SPEC-LANDING-001 `plan.md` §G "배포 SPEC로 넘기는 출시 전 점검"
- `.moai/reports/legal/consent-review-2026-11-12.md`(저장소에서 추적하지 않는 법률 조사 자료, 법률 자문 아님) §3·§5·§6
- `interview.md` — 이 SPEC의 사용자 결정 기록
- `plan.md` §A.2 — 설치본 소스와 공식 문서로 확인한 근거

### 2.2 사용자가 확정한 사항 (2026-11-17, 구속력 있음)

- **D1. 계정**: Vercel과 Supabase 계정은 이미 있다.
- **D2. 주소**: 우선 무료 `*.vercel.app` 주소를 쓴다(자체 도메인은 나중).
- **D3. 지역**: Supabase 프로젝트는 서울 리전, Vercel 함수 리전도 서울(`icn1`)로 맞춘다.
- **D4. 2단계 출시**: 이 SPEC은 공개하지 않는 미리보기 배포(검색에 잡히지 않고 알리지 않음)를 만든다. 보호 방식은 사용자 요금제에서 쓸 수 있는 것으로 정하고, 무료 Hobby 요금제의 한계를 공식 문서로 확인해 그대로 기록한다. 공개 출시는 2단계에서 한다.
- **D5. 운영자 정보**: 상호·대표자·개인정보 보호책임자·연락처는 2단계에서 정한다(이 SPEC 범위 밖).
- **D6. 예약 정리**: Vercel Cron(Hobby는 하루 한 번)으로 10분 지난 신청 시도 기록과 2년 지난 관리자 작업 기록을 지운다. 동의 고지의 IP 변환값 문구("다음 신청 처리 때 삭제")를 실제 최대 보관 시간으로 고치고, 문구가 바뀌므로 `PRIVACY_POLICY_VERSION`을 올린다(`src/lib/consent.ts` 규칙). Cron 엔드포인트는 Vercel 문서대로 `CRON_SECRET` Bearer 값으로 보호한다.
- **D7. 초안 질문의 답 (2026-11-17, `interview.md` "추가 확인")**: Q1 IP 변환값 보관 고지는 **최대 72시간**. Q2 새 동의 문구에 **"비밀키로 변환한"·"원래 IP 주소는 저장하지 않음"을 넣는다**. Q5 업로드 코드 한도는 **5MB 그대로 두고, 사진 업로드 화면에 "실제 사이트에서는 4MB 이하" 안내 문구만 더한다**. Q6 Vercel 보호 때문에 예약 실행이 막히면 **미리보기 동안은 수동으로 정리하고, 자동 삭제는 정식 공개 때 확인한다**. 묻지 않은 Q3(UTC `0 18 * * *`)·Q4(HMAC은 `PAYLOAD_SECRET` 유지)는 초안 기본값, Q7(요금제)은 2단계 결정이다. Q1~Q7은 모두 결정되었다.

Tier는 M으로 정한다(근거와 분할 기준은 `plan.md` §A.4).

### 2.3 이 SPEC이 내리는 결정 (요약 — 근거는 `plan.md` §B)

- **비공개 방식**: Vercel 프로젝트의 Deployment Protection을 **Vercel Authentication + 보호 범위 "All Deployments"**로 둔다. 공식 문서상 두 기능 모두 Hobby를 포함한 모든 요금제에서 쓸 수 있고, 운영 주소(`<프로젝트>.vercel.app`)까지 보호한다. Password Protection은 Hobby에서 쓸 수 없다. 검색 제외 표시(`robots.txt` 전체 차단, `X-Robots-Tag: noindex`)는 보호가 꺼지는 실수에 대비한 이중 장치다(`plan.md` §B.1).
- **미리보기 = Vercel의 운영(Production) 배포**: Vercel Cron은 운영 배포에서만 실행되므로, 1단계의 비공개 미리보기는 `main` 가지의 운영 배포에 보호를 건 형태다. 다른 가지의 미리보기(Preview) 배포는 쓰지 않는다.
- **DB 연결**: Supabase 공유 풀러의 트랜잭션 모드(포트 6543)를 쓰고, 연결 문자열에는 SSL 모드를 넣지 않고 Supabase CA 인증서로 서버 인증서를 검증한다(`verify-full`). 원격 DB인데 인증서가 없으면 연결하지 않는다. 함수 하나의 연결 풀 크기는 환경 변수로 정한다(운영 권장 5, 최소 3 — Payload가 시작할 때 연결 1개를 오류 감시용으로 계속 붙잡기 때문, `plan.md` §B.2).
- **스키마 반영**: 지금 스키마 전체를 담은 첫 마이그레이션을 저장소에 두고, 운영 배포의 빌드 단계에서 `payload migrate`를 먼저 실행한다. 개발 DB는 지금처럼 push 모드로 두고 마이그레이션을 적용하지 않는다. 첫 마이그레이션은 저장소 플러그인을 등록한 설정으로 만든다(아래 업로드 저장소).
- **업로드 저장소**: `@payloadcms/storage-s3` 3.93.0(설치된 Payload와 같은 버전, 새 직접 의존성 1개)을 **언제나 등록**하고, S3 환경 변수 다섯 개가 모두 있을 때만 켠다(`enabled`). `alwaysInsertFields: true`로 두어 켜졌든 꺼졌든 `media` 스키마(플러그인이 더하는 열 포함)가 같게 한다 — 플러그인을 조건부로 넣으면 운영 스키마가 저장소의 마이그레이션과 달라진다(`plan.md` §B.4). 파일은 계속 `/api/media/file/<이름>`으로 나가며 `media` 읽기 규칙을 거친다. 서명된 직접 주소·브라우저 직접 업로드는 쓰지 않는다. 업로드 코드 한도는 5MB 그대로 두고, 사진 업로드 화면에 "실제 사이트에서는 4MB 이하" 안내를 더한다(D7).
- **Supabase Data API 끄기**: Payload 테이블은 `public` 스키마에 RLS 없이 만들어지므로, Supabase의 자동 REST API(Data API)가 켜져 있으면 공개 키만으로 신청자 정보를 읽고 쓸 수 있는 길이 생긴다. 이 앱은 Data API를 쓰지 않으므로 사용자가 Supabase에서 Data API를 끈다(`plan.md` §I.1, 사용자 전용 단계).
- **예약 정리**: 경로 `/api/cron/cleanup`, 매일 한 번(UTC 18시대 = 한국 시각 오전 3시대). 지우는 대상은 신청 시도 기록(10분 지난 것)과 관리자 작업 기록(2년 지난 것) 둘뿐이다. Vercel 보호 때문에 예약 실행이 막히면, 미리보기 동안은 사용자가 Supabase SQL 편집기에서 수동 정리 SQL(`plan.md` §I.5)을 실행하고, 자동 삭제 확인은 2단계 출시 조건으로 넘긴다(D7).
- **IP 변환값 보관 고지**: 실제 최대 보관 시간을 "만든 때부터 늦어도 72시간"으로 적는다(Cron이 한 번 빠져도 지켜지는 값, 계산은 `plan.md` §B.5). 사용자가 확정했다(D7).
- **로그 가림**: Payload 로거의 오류 직렬화에서 DB 질의 바인딩 값(`params`, 오류 문구의 `params:` 뒷부분, PostgreSQL 오류의 `detail`)을 지운다(SPEC-ADMIN-001 R23).
- **다른 SPEC 조항의 대체·확장**: SPEC-TOUR-001 REQ-TOUR-001의 "로컬 디렉터리에 원본 그대로 저장"은 S3 환경 변수가 설정된 운영에서 REQ-DEPLOY-006이 대체한다(설정이 없는 개발·테스트는 그대로). SPEC-INFRA-001 REQ-INFRA-008의 필수 환경 변수 목록은 운영 빌드에 한해 REQ-DEPLOY-001이 넓힌다. SPEC-APPLY-001 REQ-APPLY-014의 고지 중 IP 변환값 보관 설명은 REQ-DEPLOY-010이 바꾼다(문구 버전 규칙은 그대로).

### 2.4 기록된 가정

- **A1. 운영 = 1단계 미리보기**: 1단계에서는 Vercel 운영 배포 하나와 Supabase 프로젝트 하나만 쓴다. 이 DB에 들어가는 데이터는 사용자가 확인용으로 넣는 것뿐이며, 2단계 공개 전에 지울지는 2단계에서 정한다.
- **A2. 보호 범위 밖의 요청**: Vercel Cron 호출이 "All Deployments" 보호를 통과하는지는 공식 문서에 적혀 있지 않다(`plan.md` §A.2 확인 기록). 실제 배포에서 Cron 수동 실행 응답과 DB의 남은 행으로 확인한다. 막히면 사용자가 이미 정한 대로(D7) 미리보기 동안은 수동 정리로 대신하고, 자동 삭제 확인은 2단계 출시 조건으로 넘긴다(`plan.md` §G R1).
- **A3. 상업 이용**: Vercel 약관상 Hobby 요금제는 개인·비상업 용도 한정이다. 1단계는 공개하지 않는 확인용 배포라 영업에 쓰지 않는다. 유료 투어를 실제로 받는 공개 출시 전에 요금제를 정하는 일은 2단계 항목이다.
- **A4. Supabase 무료 프로젝트 일시 중지**: 7일 동안 활동이 적으면 무료 프로젝트가 일시 중지될 수 있다. 매일 실행되는 정리 작업이 DB에 질의하지만 이것이 "활동"으로 충분한지는 공식 문서가 정하지 않는다. 중지되면 대시보드에서 다시 켤 수 있다.
- **A5. 비밀값**: 모든 비밀값은 사용자가 Vercel 환경 변수에 직접 넣는다. Claude는 값을 보거나 입력하지 않으며, 저장소에는 이름만 남긴다(`.env.example`, `plan.md` §I).
- **A6. 관리자 계정**: 운영 DB의 첫 관리자는 사용자가 배포된 관리자 화면에서 직접 만든다. 테스트는 개발 DB에서만 돌고 `@example.test` 계정만 쓴다.
- **알려진 제한 — 사진 파일 이름 (sync 감사 F1, 사용자 결정 (가), 2026-11-23)**: 운영(S3 저장소)에서 한글·공백·괄호가 든 파일 이름의 사진 업로드는 실패할 수 있다(`다운로드 (1).jpg`에서 "Something went wrong" 확인, 원인 미확정). SPEC-LAUNCH-001에서 진단·수정할 때까지 파일 이름을 영문과 숫자로만 바꿔 올린다(예: `jeju2.jpg`).

### 2.5 용어

- **운영 빌드**: Vercel이 운영 환경 배포를 만들 때의 빌드. 환경 변수 `VERCEL_ENV`가 `production`이다. 로컬의 `pnpm build`는 운영 빌드가 아니다.
- **비공개 미리보기**: Vercel Authentication(All Deployments)으로 보호된 운영 배포. 주소는 `https://<프로젝트 이름>.vercel.app`.
- **루프백 DB**: `DATABASE_URL`의 호스트가 `localhost`, `127.0.0.1`, `::1` 중 하나인 DB(개발용 Docker PostgreSQL).
- **원격 DB**: 루프백 DB가 아닌 모든 DB(Supabase 포함).
- **트랜잭션 풀러**: Supabase 공유 풀러(Supavisor)의 트랜잭션 모드, 포트 6543. 이름 붙은 준비된 문장(prepared statement)을 지원하지 않는다.
- **정리 엔드포인트**: `GET /api/cron/cleanup`.
- **신청 시도 기록 / 작업 기록**: 컬렉션 `application-attempts`(SPEC-APPLY-001) / `admin-audit-logs`(SPEC-ADMIN-001).
- **10분 지난 시도**: `attemptedAt`이 실행 시각보다 10분(600,000ms) 넘게 앞선 행. **2년 지난 작업 기록**: `occurredAt`이 실행 시각(UTC)에서 달력상 2년을 뺀 시각보다 앞선 행.
- **질의 바인딩 값**: 매개변수화된 SQL에 따로 넘기는 값. Drizzle 오류(`DrizzleQueryError`)의 `params` 속성과 오류 문구의 `params:` 뒷부분, PostgreSQL 오류의 `detail`에 실린다.
- **사용자 전용 단계**: 사람이 계정에 로그인해야 하거나 비밀값을 다루는 단계. `plan.md` §I에 순서대로 적는다.

## 3. 요구사항 (GEARS)

패턴 표기: [Ubiquitous] 상시 / [Event-driven] **When** / [State-driven] **While** / [Capability] **Where** / [Unwanted] 금지. Tier M 예산(16개 이하)에 맞춰 묶었다.

### 3.1 운영 설정과 DB 보호

- **REQ-DEPLOY-001** [Event-driven + Unwanted] **When** 운영 빌드(`VERCEL_ENV=production`)에서 `build`나 `start`가 시작될 때 `NEXT_PUBLIC_SERVER_URL`(경로·끝 빗금 없는 `https://` 주소), `CRON_SECRET`(영문·숫자 16자 이상), `DATABASE_CA_CERT`(PEM 인증서), `S3_BUCKET`·`S3_ENDPOINT`·`S3_REGION`·`S3_ACCESS_KEY_ID`·`S3_SECRET_ACCESS_KEY` 중 하나라도 없거나 형식이 틀리거나, `DATABASE_URL`에 `sslmode`·`sslrootcert` 인자가 들어 있으면(넣으면 코드의 인증서 설정이 덮어써짐 — `plan.md` §A.2), 시작 전 점검은 서버를 띄우거나 DB에 연결하기 전에 0이 아닌 종료 코드로 끝나고 문제 있는 변수 이름만 출력해야 한다. 출력·오류·로그에는 어떤 변수의 값도 담지 않아야 한다. 운영 빌드가 아닌 로컬 `build`·`dev`·`test`·`e2e`의 필수 변수 규칙(SPEC-INFRA-001 REQ-INFRA-008)은 그대로다.
- **REQ-DEPLOY-002** [Event-driven + Unwanted] **When** `dev`, `test`, `e2e`, `seed` 중 하나가 원격 DB를 가리키는 `DATABASE_URL`로 시작되면, 그 명령은 DB에 연결하거나 스키마를 바꾸기 전에 0이 아닌 종료 코드로 끝나고 호스트 이름을 담은 영문 거부 문구만 출력해야 한다(비밀번호·연결 문자열 전체는 출력하지 않음). `seed`는 기존 거부 판정(`src/lib/seed.ts` `assertSeedAllowed`, SPEC-TOUR-001 REQ-TOUR-015)과 그 문구를 그대로 쓴다. **When** 통합 테스트(Vitest)나 E2E(Playwright)가 `package.json` 스크립트의 시작 전 점검을 거치지 않고 직접 실행되더라도, 시험 환경 준비 파일(`tests/integration/setup-env.ts`, `tests/helpers/e2e-env.ts`)이 같은 루프백 판정으로 원격 DB를 거부해 어떤 시험도 DB에 닿기 전에 멈춰야 한다. Payload의 개발용 스키마 자동 반영(push)은 원격 DB에 대해 실행되지 않아야 한다.
- **REQ-DEPLOY-003** [Ubiquitous + Event-driven + Unwanted] 저장소는 현재 Payload 설정의 스키마 전체를 만드는 마이그레이션을 담아야 한다. **When** 빈 PostgreSQL 데이터베이스에 모든 마이그레이션을 적용하면, 결과 스키마(테이블·열·열 형식·널 허용·기본값·인덱스·외래 키·열거형)는 개발용 push로 만든 스키마와 같아야 한다. 이 스키마는 S3 환경 변수가 모두 있는 설정과 하나도 없는 설정에서 같아야 한다(저장소 플러그인이 더하는 `media` 열 포함). **When** S3 변수가 있는 설정과 없는 설정 각각으로 새 마이그레이션 생성을 시도하면, 바뀐 점이 없어 새 파일이 생기지 않아야 하고, 마이그레이션 검사 명령(`migrate:check`)은 새 파일이 생기면 마이그레이션 디렉터리를 실행 전 상태로 되돌린 뒤(새 파일 삭제, Payload가 새 파일 기준으로 다시 쓴 `index.ts`를 실행 전 내용으로 복원) 파일 이름과 함께 0이 아닌 종료 코드로 끝나야 한다. 검사는 성공하든 실패하든 추적 파일을 바꿔 놓지 않아야 한다(실행 뒤 `git status --short src/migrations` 출력이 비어 있음). **When** 운영 빌드가 시작되면, 빌드는 Next.js 빌드보다 먼저 아직 적용하지 않은 마이그레이션을 적용해야 하고, 적용이 실패하면 배포는 실패해야 한다. **When** Vercel 빌드 스크립트가 운영이 아닌 환경(`VERCEL_ENV`가 `production`이 아님)에서 실행되면, 마이그레이션을 적용하지 않고 0이 아닌 종료 코드로 끝나야 한다(Preview 배포는 쓰지 않음). 로컬 `pnpm build`는 마이그레이션을 적용하지 않는다.
- **REQ-DEPLOY-004** [State-driven + Unwanted] **While** `DATABASE_URL`이 원격 DB를 가리키면, 연결은 `DATABASE_CA_CERT`의 인증서로 서버 인증서와 호스트 이름을 검증해야 하며(검증 실패 시 연결하지 않음), `DATABASE_CA_CERT`가 없거나 PEM 인증서가 아니면 운영 빌드 여부와 관계없이(로컬 `pnpm build`·`payload migrate` 포함) DB에 연결하지 않고 변수 이름만 담은 영문 설정 오류로 멈춰야 한다(값·연결 문자열 미출력, 암호화 없는 연결로 대체 금지). 함수 하나의 연결 풀 최대 크기는 `DATABASE_POOL_MAX`(3 이상 20 이하 정수)여야 하며, 값이 없으면 원격 DB는 5, 루프백 DB는 `pg` 기본값이다. 최소 3인 이유: Payload가 시작 때 연결 1개를 오류 감시용으로 계속 붙잡으므로 실제로 쓸 수 있는 연결은 `max − 1`이고, 정원 확인 트랜잭션과 트랜잭션 밖 질의가 동시에 연결을 얻을 수 있어야 한다. **When** 풀 최대 크기가 최소값 3일 때 같은 회차에 신청 2건이 동시에 들어오면, 두 신청 모두 교착 없이 끝까지 처리되어야 한다. 애플리케이션과 Payload는 이름 붙은 준비된 문장을 쓰지 않아야 하며, 기존 정원 확인 구간의 명시적 트랜잭션·`SELECT … FOR UPDATE`·트랜잭션 한정 `set_config('lock_timeout', …, true)` 동작은 트랜잭션 풀러를 거쳐도 바뀌지 않아야 한다. 루프백 DB의 연결 방식은 지금 그대로다.

### 3.2 운영 신뢰 경계

- **REQ-DEPLOY-005** [Ubiquitous + Unwanted] 운영 배포의 Payload `serverURL`은 `NEXT_PUBLIC_SERVER_URL`과 같아야 하고, 그 값은 Payload CSRF 허용 목록에 들어가 있어야 한다(빈 허용 목록 금지 — SPEC-INFRA-001 F8, SPEC-ADMIN-001 R30). 신청 횟수 제한의 접속 IP는 지금처럼 `x-forwarded-for`의 첫 값에서 얻으며, 이 값이 Vercel이 덮어쓴 값이라는 근거를 코드 주석과 `plan.md`에 남긴다. 횟수 제한 키의 HMAC 비밀값은 지금처럼 `PAYLOAD_SECRET`에 용도 접두어를 붙여 쓴다(`plan.md` §B.7).

### 3.3 업로드 저장소

- **REQ-DEPLOY-006** [Capability + Unwanted] **Where** `S3_BUCKET`·`S3_ENDPOINT`·`S3_REGION`·`S3_ACCESS_KEY_ID`·`S3_SECRET_ACCESS_KEY`가 모두 설정되어 있으면, `media` 업로드 파일은 Supabase Storage 버킷에 저장되고 서버의 로컬 디스크에는 저장되지 않아야 한다. 파일 주소는 계속 `/api/media/file/<파일 이름>` 형태여야 하고, 파일 요청은 `media` 읽기 규칙을 그대로 거쳐 관리자가 아닌 요청에게는 공개 투어 대표 이미지와 홈 대표 사진만 내줘야 한다(SPEC-TOUR-001 REQ-TOUR-005, SPEC-LANDING-001 REQ-LANDING-003). 저장소 직접 주소·서명된 내려받기 주소·브라우저 직접 업로드는 쓰지 않아야 한다. 다섯 변수 중 일부만 설정된 상태는 설정 오류다. 다섯 변수가 모두 없으면 지금처럼 로컬 `media/` 디렉터리를 쓴다. 저장소 플러그인은 변수 유무와 관계없이 언제나 등록되어 꺼짐·켜짐만 바뀌어야 하며(`enabled`), 플러그인이 `media`에 더하는 필드는 두 경우 모두 들어가야 한다(`alwaysInsertFields: true` — 스키마 일관성, REQ-DEPLOY-003). 업로드 코드 한도(5MB, SPEC-TOUR-001 REQ-TOUR-001)는 그대로이고, 관리자 화면의 `media` 업로드 안내 문구에는 "실제 사이트에서는 4MB 이하" 파일을 올리라는 한국어 안내가 들어 있어야 한다(사용자 결정 D7 — Vercel 함수 요청 본문 4.5MB 한도).

### 3.4 예약 정리

- **REQ-DEPLOY-007** [Event-driven + Unwanted] **When** 정리 엔드포인트에 `Authorization` 머리글이 정확히 `Bearer <CRON_SECRET 값>`인 `GET` 요청이 오면, 엔드포인트는 정리를 실행하고 HTTP 200과 지운 행 수만 담은 JSON(`attemptsDeleted`, `auditLogsDeleted`)을 돌려줘야 한다. **When** 머리글이 없거나 값이 다르거나 서버에 `CRON_SECRET`이 없으면, 아무것도 지우지 않고 HTTP 401로 끝나야 한다. 비교는 값 길이에 따라 걸리는 시간이 달라지지 않는 방식이어야 하고, 응답·로그에 비밀값이나 받은 머리글 값을 담지 않아야 한다. `GET` 외 메서드는 HTTP 405여야 하며, 응답은 캐시되지 않아야 한다(`Cache-Control: no-store`).
- **REQ-DEPLOY-008** [Event-driven + Unwanted] **When** 정리가 실행되면, 신청 시도 기록 중 10분 지난 시도와 작업 기록 중 2년 지난 작업 기록을 지워야 하며, 그 밖의 행과 다른 컬렉션은 바꾸지 않아야 한다. 같은 시각 기준으로 두 번 실행해도 두 번째 실행은 아무것도 지우지 않아야 하고(중복 실행에 안전), DB 질의 수는 지울 행 수에 따라 늘지 않아야 한다. 신청 처리 때마다 오래된 시도를 지우는 기존 동작(SPEC-APPLY-001 REQ-APPLY-013)은 그대로 둔다.
- **REQ-DEPLOY-009** [Ubiquitous] 배포 설정(`vercel.json`)은 정리 엔드포인트를 하루 한 번(UTC 기준 `0 18 * * *`, 한국 시각 오전 3시대) 호출하는 Cron 작업 하나와 함수 리전 `icn1` 하나를 선언해야 한다. Cron 경로는 실제 정리 엔드포인트 경로와 같아야 하고 끝 빗금이 없어야 한다.
- **REQ-DEPLOY-010** [Ubiquitous + Unwanted] 신청 화면 필수 동의 고지의 IP 변환값 설명은 "다음 신청 처리 때 삭제"가 아니라 실제 최대 보관 시간(만든 때부터 늦어도 72시간 — `plan.md` §B.5의 계산)과 매일 자동 삭제한다는 사실을 밝혀야 하며, 원래 IP 주소를 저장하지 않는다는 사실도 밝혀야 한다. 문구가 바뀌므로 `PRIVACY_POLICY_VERSION`은 `<문구 확정일>.<새 consentDocument()의 SHA-256 앞 8자리>`로 바뀌어야 하고, 이미 접수된 신청의 동의 버전 값은 바뀌지 않아야 한다.

### 3.5 로그와 검색 제외

- **REQ-DEPLOY-011** [Ubiquitous + Unwanted] Payload 로거가 기록하는 오류(중첩된 `cause` 포함)에는 질의 바인딩 값이 담기지 않아야 한다 — `params` 속성과 PostgreSQL `detail` 속성은 지워지고, 오류 문구의 `params:` 이후 부분은 고정 표시로 바뀌어야 한다. 로그 메시지 문자열(`msg` — Drizzle이 `err.message`를 이어 붙여 기록하는 경로)에 들어 있는 `params:` 이후 부분도 같은 고정 표시로 바뀌어야 한다. SQL 문 자체와 오류 이름·코드(SQLSTATE)는 원인 파악을 위해 남긴다. 이 규칙은 개발·테스트·운영 모든 환경에서 Payload 설정의 로거에 적용된다. 설정의 로거를 쓰지 않는 `payload migrate` 같은 명령줄 도구의 자체 로거와 `console.error` 경로는 범위의 한계로 `plan.md` §B.6에 기록한다.
- **REQ-DEPLOY-012** [Ubiquitous + Unwanted] 모든 응답(공개 화면, 관리자 화면, API, 정적 파일)은 `X-Robots-Tag: noindex, nofollow` 머리글을 가져야 하고, `/robots.txt`는 모든 검색 로봇에 모든 경로를 막는 내용이어야 하며, 공개 화면 HTML에는 `noindex, nofollow` 로봇 메타 태그가 있어야 한다. 사이트맵은 만들지 않는다. 이 표시는 2단계 공개 출시 SPEC이 걷어 낸다.

### 3.6 실제 배포 확인

- **REQ-DEPLOY-013** [State-driven + Unwanted] **While** 비공개 미리보기가 배포되어 있으면, Vercel에 로그인하지 않은 브라우저와 명령줄 요청은 홈·투어·신청·관리자 화면과 API의 내용을 받지 못해야 하고(Vercel 로그인 화면 또는 401), 사용자가 Vercel에 로그인한 브라우저에서는 모든 화면이 개발 환경과 같게 동작해야 한다. 이 상태는 사용자가 Deployment Protection 화면에서 Vercel Authentication과 "All Deployments"를 켜서 만든다(사용자 전용 단계). 같은 상태 동안 Supabase의 Data API(자동 REST API)는 꺼져 있어야 하며, 공개 키(publishable/anon 키)로 `https://<프로젝트 ref>.supabase.co/rest/v1/<테이블>`을 요청해도 Payload 테이블의 행을 받지 못해야 한다(사용자 전용 단계 `plan.md` §I.1).
- **REQ-DEPLOY-014** [Event-driven] **When** 사용자가 비공개 미리보기에서 확인 절차(`plan.md` §I.4)를 수행하면, 다음이 모두 성립해야 한다: 함수가 `icn1`에서 실행됨(배포 상세의 함수 리전, 또는 응답 머리글 `x-vercel-id`의 마지막 리전 칸 — 앞쪽 칸은 요청을 받은 엣지 리전이라 판정에 쓰지 않음), 관리자 첫 계정 생성·로그인, 대표 이미지가 있는 투어와 회차 생성, 익명 기준 공개 범위가 맞는 이미지 표시(공개 투어 이미지는 보이고 어디에도 쓰이지 않은 이미지는 안 보임), 신청 접수(정원 잠금 구간 통과), 관리자 상태 변경, Supabase Data API 차단, 그리고 예약 정리에 대해 다음 둘 중 하나: (가) Cron 수동 실행이 HTTP 200이고, **그 수동 실행 뒤에** 만든 확인용 신청의 시도 기록(그 뒤로 다른 신청·수동 실행·수동 정리 없음)이 만든 지 26시간 넘어 DB에서 0행으로 확인됨(예약 실행만이 지울 수 있는 행) (나) Cron이 보호에 막힌 것이 확인되어 "막힘"으로 기록하고, 사용자가 수동 정리 SQL(`plan.md` §I.5)을 실행해 결과 행 수를 받았으며, 자동 삭제 확인을 2단계 출시 조건으로 넘김(사용자 결정 D7). 결과는 `progress.md` §E.2에 기록한다.

### 3.7 문서와 테스트

- **REQ-DEPLOY-015** [Ubiquitous + Unwanted] 저장소는 배포에 필요한 환경 변수 이름과 용도를 `.env.example`과 README "배포" 절에 값 없이 적어야 하고, `plan.md` §I에 사용자 전용 단계를 초보자용 순서로 담아야 한다. 저장소의 어떤 추적 파일에도 비밀값(DB 비밀번호가 든 연결 문자열, `PAYLOAD_SECRET`, `CRON_SECRET`, 저장소 접근 키)이 들어가지 않아야 한다.
- **REQ-DEPLOY-016** [Ubiquitous] 테스트 실행(`pnpm test`, `pnpm e2e`)은 이 SPEC의 순수 함수(운영 설정 점검, 루프백 판정, 풀 설정, 비밀값 비교, 정리 기준 시각 계산, 로그 가림, 저장소 설정 판정, 동의 문구 버전), 실제 PostgreSQL 통합(정리 실행·중복 실행·질의 수, 빈 DB 마이그레이션 적용 결과와 개발 스키마 비교, 최소 풀 크기에서 동시 신청, 로거 출력 가림), E2E(정리 엔드포인트의 401·405·200, `robots.txt`와 `X-Robots-Tag`)를 검증해야 한다. 테스트는 실제 관리자 계정을 쓰지 않고, 표식 데이터를 스스로 만들고 지우며, 원격 DB에 닿지 않아야 한다. 새 의존성은 `@payloadcms/storage-s3`(정확한 버전 3.93.0)와 그것이 끌어오는 간접 의존성뿐이어야 하며, 의존성을 더한 뒤 `pnpm audit` 결과를 다시 재서 도달 경로와 함께 기록해야 한다. `src/lib/` 합산 라인 커버리지 85% 기준과 기존 품질 게이트(타입·빌드·린트·포맷)는 계속 통과해야 한다.

## 4. 비기능 제약

- **보안**: 비밀값은 Vercel 환경 변수(민감 값 표시)에만 둔다. Cron 비밀값 비교는 시간 차이가 나지 않는 방식. 저장소 접근 키는 서버에서만 쓰고 브라우저로 보내지 않는다(Supabase 문서: S3 키는 모든 버킷에 대한 전체 권한). DB 연결은 인증서 검증, 인증서가 없으면 원격 연결 거부(REQ-DEPLOY-004). Supabase Data API는 끈다 — Payload 테이블이 `public` 스키마에 RLS 없이 만들어지므로, 켜 두면 Vercel 보호와 상관없이 공개 키로 신청자 정보에 닿는 길이 생긴다(REQ-DEPLOY-013, Supabase 문서 "RLS 없는 노출 스키마의 테이블은 권한 있는 역할이 읽고 쓸 수 있음").
- **개인정보**: 로그에 신청자 정보가 남지 않게 한다(REQ-DEPLOY-011). 정리 작업 응답에는 행 수만 담는다. 수동 정리 SQL도 행 수만 돌려준다(`plan.md` §I.5). 2년 보관 기간과 IP 변환값 보관 문구의 법률 검토는 2단계 변호사 확인 목록에 넣는다.
- **성능·비용**: 함수 리전과 DB가 같은 서울. 연결 풀 크기 5 × 동시 인스턴스 수가 Supabase 무료 풀러 한도(클라이언트 200)를 넘지 않게 한다(인스턴스 40개까지). Vercel Fluid compute가 켜져 있으면 인스턴스 하나가 여러 요청을 동시에 처리해 인스턴스 수는 줄고 풀(실사용 4개)을 요청들이 나눠 쓴다 — 켜짐 여부는 run 단계에서 확인해 연결 예산을 `progress.md` §E.2에 다시 적는다(`plan.md` §B.2). 정리 작업의 질의 수는 고정.
- **호환**: 새 검증 명령은 Windows PowerShell 5.1에서 동작해야 한다. Vercel 빌드는 `packageManager`의 pnpm 11.28.9와 `engines`의 Node 24를 쓴다(`plan.md` §B.9).
- **의존성**: 새 직접 의존성은 `@payloadcms/storage-s3` 3.93.0 하나(사용자 결정 D3·D6과 업로드 저장소 이월 항목이 요구). 그 밖의 새 패키지는 금지.

수용 기준과 검증 명령은 `acceptance.md`에 둔다.

## 5. 제외 범위 (Out of Scope)

### Out of Scope — 2단계 공개 출시 SPEC(예: SPEC-LAUNCH-001)이 맡는 것

- 개인정보 처리방침 페이지 작성·상시 게시(처리 위탁·국외 이전·보호책임자·권리 행사 방법 포함)와 바닥글의 처리방침 링크 연결
- 운영자 정보(상호·대표자·개인정보 보호책임자·연락처)와 바닥글 표시
- Deployment Protection 해제, 검색 제외 표시(`robots.txt`·`X-Robots-Tag`·메타 태그) 제거, 사이트맵, 공개 알림
- 바뀐 동의 문구 전체와 2년·72시간 보관 기간의 변호사 최종 확인, 민감정보 발견 시 즉시 삭제 운영 절차 문서화, 시행 예정 개정 법률 확인
- 상업 운영을 위한 Vercel 요금제(Hobby는 비상업 용도 한정)와 Supabase 요금제(무료 프로젝트 일시 중지) 결정
- 운영 대표 사진·투어 사진의 실제 업로드와 크기 확인, 파비콘
- **공개 전 필수 — 파일 이름 업로드 진단·수정(F1)**: `다운로드.jpg`, `download (1).jpg`를 각각 올려 Vercel 로그의 오류 이름으로 원인을 확인한 뒤 고치고, 한글·공백·괄호 이름의 업로드 시험을 포함한다(§2.4 알려진 제한)
- **공개 전 필수 — Data API 두 번째 방어선**: `public` 표의 RLS를 켜거나 `anon`·`authenticated` 권한을 회수한다. Payload 연결 역할이 영향받지 않는지 확인한 뒤 공개 키 요청을 다시 시험한다. 지금은 Data API 끄기가 유일한 방어선이고, 확인 때 받은 `PGRST002` 응답의 차단 원인은 확정되지 않았다

### Out of Scope — 나중으로 미루는 것

- 자체 도메인 연결
- CI(GitHub Actions 등) 도입과 PowerShell 7 확인(SPEC-INFRA-001 accepted_debt — CI 도입 때 다시 봄)
- 이미지 크기 변환·최적화(`sharp` 미설치), 동적 분할 글꼴
- 개발용 Supabase 프로젝트·별도 스테이징 환경, Vercel Preview 배포 사용
- 백업·복구 절차, 모니터링·알림, 로그 전송(Drains — Hobby 미지원)
- 회차 삭제 경합(SPEC-APPLY-001 F1)·잠금 구간 `depth: 0`(F2)·사이트 접수 자동 마감 교착(SPEC-ADMIN-001 R26 ②) 같은 배포와 무관한 후속 항목
- 횟수 제한 HMAC 비밀값을 별도 환경 변수로 분리하는 일(`plan.md` §B.7에서 유지로 결정)
- 남은 `pnpm audit` 권고 패키지의 강제 상향(도달 경로 기록만 하고, 실행 경로에서 도달하는 것이 확인되면 차단자로 보고)

### Out of Scope — 다른 로드맵 기능

- 이메일 알림(로드맵 5번), 회원(4번), 다국어(7번)
- Vercel Schedules(Cron Jobs의 후속 베타 기능)로의 이전

## 6. 추적성

| 요구사항 | 수용 기준 (`acceptance.md`) |
|---|---|
| REQ-DEPLOY-001 | AC-DEPLOY-001 |
| REQ-DEPLOY-002 | AC-DEPLOY-002 |
| REQ-DEPLOY-003 | AC-DEPLOY-003, AC-DEPLOY-006(스키마 일관성) |
| REQ-DEPLOY-004 | AC-DEPLOY-004, AC-DEPLOY-014 |
| REQ-DEPLOY-005 | AC-DEPLOY-005 |
| REQ-DEPLOY-006 | AC-DEPLOY-006, AC-DEPLOY-014 |
| REQ-DEPLOY-007 | AC-DEPLOY-007 |
| REQ-DEPLOY-008 | AC-DEPLOY-008 |
| REQ-DEPLOY-009 | AC-DEPLOY-009 |
| REQ-DEPLOY-010 | AC-DEPLOY-010 |
| REQ-DEPLOY-011 | AC-DEPLOY-011 |
| REQ-DEPLOY-012 | AC-DEPLOY-012 |
| REQ-DEPLOY-013 | AC-DEPLOY-013, AC-DEPLOY-014(Data API 차단 줄) |
| REQ-DEPLOY-014 | AC-DEPLOY-014 |
| REQ-DEPLOY-015 | AC-DEPLOY-015 |
| REQ-DEPLOY-016 | AC-DEPLOY-016 |

## 7. 참조

- `plan.md` — 근거(§A.2), 이월 항목 처리 표(§A.3), 결정(§B), 마일스톤(§F), 위험(§G), 사용자 전용 단계 안내(§I)
- `acceptance.md` — Given/When/Then 수용 기준, 실제 배포 수동 확인, 품질 게이트, 완료 정의
- `interview.md` — 사용자 결정과 확인이 필요한 질문
- `spec-compact.md` — run 단계용 요약
