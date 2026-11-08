---
id: SPEC-INFRA-001
title: "프로젝트 기반 구축 — Next.js + Payload CMS 단일 앱 골격과 로컬 개발·테스트 환경"
version: "0.1.3"
status: draft
created: 2026-11-08
updated: 2026-11-08
author: study2
priority: P1
phase: "v0.1.0 target"
module: "/"
lifecycle: spec-anchored
tags: "infra, nextjs, payload, postgres, docker, tailwind, vitest, playwright, pnpm, windows"
tier: M
---

# SPEC-INFRA-001: 프로젝트 기반 구축

## HISTORY

| 버전 | 날짜 | 작성자 | 내용 |
|---|---|---|---|
| 0.1.0 | 2026-11-08 | study2 (manager-spec) | 최초 작성 — `product.md` §7 로드맵 1번 항목 "프로젝트 기반 구축" |
| 0.1.1 | 2026-11-08 | study2 (manager-spec) | plan-audit 1~2회차 지적 반영 — 1회차 D1~D13(셸 안전 검증, 검사 범위, 순차 검증, 조항별 AC, `.gitignore` 실제 상태, Node 범위 교집합 등), 2회차 N1~N8(제외 목록 단일화, DB 전제 명시, E2E 포트 단언, 측정 방식 통일, 시스템 컬렉션 필터). 서비스 가칭을 "숨비투어"로 변경 |
| 0.1.2 | 2026-11-08 | study2 (orchestrator) | plan-audit 3회차 N9 반영 — "검사 대상 코드"에 `scripts/`와 루트 YAML 설정 파일 포함, `lint` 예시에 `scripts` 추가, AC-INFRA-010에 `scripts/` 대조 확인 추가 |
| 0.1.3 | 2026-11-08 | study2 (manager-spec) | run 단계 plan-audit 4회차 N12 반영 — AC-INFRA-010의 scripts/ 린트 탐침 내용을 구문 오류(`var a = ;`)로 바꿔 ESLint·Prettier가 모두 실패하도록 수정 |

## 1. 개요

숨비투어(투어 신청 사이트)의 모든 후속 SPEC(로드맵 2~8번)이 올라설 기반을 만든다. 범위는 다음 다섯 가지다.

1. Next.js App Router 안에서 Payload CMS를 함께 실행하는 단일 앱 골격
2. Docker Compose로 띄우는 로컬 PostgreSQL과 `@payloadcms/db-postgres` 연결
3. 관리자 화면 접근에 필요한 최소 인증 컬렉션 `Users`
4. Tailwind CSS를 적용한 임시 홈 페이지
5. 테스트(Vitest·Playwright)·린트·포맷 도구, 실행 스크립트, 한국어 개발 환경 안내(README)

이 SPEC이 끝나면 개발자는 빈 Windows 11 PC에서 README 순서만 따라 DB를 띄우고, 첫 관리자 계정을 만들어 `/admin`에 로그인하고, `pnpm build`·`pnpm test`·`pnpm e2e`·`pnpm lint`를 모두 통과시킬 수 있어야 한다.

## 2. 배경과 전제

### 2.1 근거 문서

- `.moai/project/product.md` — §7 로드맵 1번, §8 결정 필요 항목
- `.moai/project/structure.md` — §2 디렉터리 제안, §3 `Users` 컬렉션 개념 설계
- `.moai/project/tech.md` — §1 스택, §3 로컬 개발 환경, §4 환경 변수 이름, §7 품질 기준
- `.moai/project/interview.md` — Stage A~B 결정 기록

### 2.2 이번 SPEC에서 사용자가 확정한 사항

- 로컬 DB: Docker(Compose)로 실행하는 PostgreSQL. Supabase 연결은 이 SPEC에서 다루지 않는다.
- 스타일링: Tailwind CSS
- 패키지 매니저: pnpm (`product.md` §8의 "패키지 매니저" 항목은 이 결정으로 닫힌다)
- SPEC 복잡도: Tier M. 생성되는 파일 수는 Tier M 기준(5~15개)보다 많지만 대부분 템플릿이 만드는 파일과 설정 파일이고, 직접 작성하는 코드는 1000 LOC 미만으로 예상한다(근거는 `plan.md` §A).
- 개발 PC 상태: Windows 11, Docker 설치됨, **Node.js 미설치**

### 2.3 사용자 사전 작업 (에이전트가 대신하지 않음)

다음 작업은 개발자가 직접 수행하며, 구현 단계는 이 작업이 끝났다는 전제에서 시작한다. 구체 절차와 확인 명령은 README와 `plan.md` §C에 둔다.

- **P1.** Node.js LTS 설치 — REQ-INFRA-001의 지원 범위 안의 버전(권장: Node.js 24 LTS)
- **P2.** pnpm 활성화 — Corepack(`corepack enable pnpm`) 또는 대체 설치 방법
- **P3.** Docker Desktop 실행 상태 확인
- **P4.** Playwright용 Chromium 브라우저 설치(의존성 설치 직후)

### 2.4 기록된 가정

- **A1.** 임시 홈 페이지는 로케일 접두어 없이 `/`에 둔다. `structure.md`가 제안한 `[locale]` 라우팅(`/ko`, `/en`)은 다국어 SPEC(로드맵 7번)에서 도입한다.
- **A2.** 로컬 개발 DB의 스키마는 Payload 개발 모드의 자동 반영 기능을 사용한다. 마이그레이션 파일 기반 운영 절차는 배포 SPEC(로드맵 8번)에서 정한다.
- **A3.** 통합 테스트와 E2E 테스트는 로컬 Docker DB를 개발 서버와 함께 쓰며, 테스트가 만든 데이터는 테스트가 직접 지운다.
- **A4.** CI 파이프라인은 도입하지 않는다. 1인 개발이고 배포 대상이 아직 없으므로, 로컬 품질 명령 통과를 완료 기준으로 삼는다(§5 참고).

### 2.5 용어

- **정식 안정 버전**: 사전 배포 식별자(`-alpha`, `-beta`, `-canary`, `-rc`, `-preview` 등)가 없고 메이저 버전이 1 이상인 버전. 이 정의는 `package.json`에 직접 적는 의존성에 적용하고, 간접 의존성에는 적용하지 않는다.
- **검사 대상 코드**: `src/`, `tests/`, `scripts/`, 그리고 저장소 루트의 JavaScript·TypeScript·JSON·CSS·YAML 설정 파일(`docker-compose.yml`, `pnpm-workspace.yaml` 포함). 린트(ESLint)는 이 중 JavaScript·TypeScript 파일을, 포맷 검사(Prettier)는 전체를 검사한다. 다음 **검사 제외 목록**은 포함하지 않으며, 린트와 포맷 검사의 무시 설정은 이 목록 전체를 똑같이 담는다.
  - MoAI 소유 경로: `.claude/`, `.moai/`, `.github/`, `.git_hooks/`, `CLAUDE.md`, `.mcp.json`, `.claudeignore`, `.worktreeinclude`
  - 문서: 모든 Markdown 파일(`*.md`)
  - 생성 파일: `src/payload-types.ts`, 관리자 `importMap.js`, `next-env.d.ts`, `pnpm-lock.yaml`
  - 산출물 디렉터리: `.next/`, `out/`, `build/`, `coverage/`, `playwright-report/`, `test-results/`

## 3. 요구사항 (GEARS)

각 요구사항은 GEARS 패턴을 따른다. 패턴 표기: [Ubiquitous] 상시 / [Event-driven] **When** / [State-driven] **While** / [Capability] **Where** / [Unwanted] 금지. Tier M 예산(요구사항 16개 이하)에 맞춰 관련 조항을 묶었다.

### 3.1 개발 환경과 실행 스크립트

- **REQ-INFRA-001** [Ubiquitous + Event-driven] 프로젝트 설정은 지원 Node.js 버전 범위와 pnpm의 정확한 버전을 명시하고 pnpm 잠금 파일을 포함해야 한다. 지원 범위는 Payload와 Vitest가 공식 지원하는 Node.js 범위의 교집합이어야 하며(Node.js 25는 제외된다), 잠금 파일 그대로 설치하면 같은 의존성 트리가 재현되어야 한다. **When** 지원 범위 밖의 Node.js 버전으로 의존성 설치를 실행하면, 설치는 0이 아닌 종료 코드로 실패해야 한다.
- **REQ-INFRA-002** [Ubiquitous + Capability] 프로젝트는 `dev`, `build`, `start`, `test`, `e2e`, `lint`, `format`, `format:check`, `typecheck` 스크립트를 제공해야 한다. **Where** 개발 환경이 Windows 11의 PowerShell인 경우에도, 이 스크립트들은 POSIX 셸 전용 구문(`rm -rf`, 명령 앞 인라인 `VAR=value` 대입) 없이 같은 결과를 내야 한다.

### 3.2 애플리케이션 골격

- **REQ-INFRA-003** [Ubiquitous] 애플리케이션은 Next.js App Router 위에서 Payload CMS를 함께 실행하는 단일 앱이어야 한다. 사용자 화면은 `(frontend)` 라우트 그룹에 두고, Payload 관리자 화면과 API는 `(payload)` 라우트 그룹에만 두어야 한다. 운영 빌드는 타입 오류 없이 완료되어야 한다.
- **REQ-INFRA-004** [Ubiquitous] 프로젝트가 직접 선언하는 의존성은 정식 안정 버전(§2.5)만 사용해야 한다. `payload`와 모든 `@payloadcms/*` 패키지는 하나의 동일한 정확한 버전으로 고정해야 하며, Next.js 버전은 `@payloadcms/next`가 선언한 지원 범위 안에 있어야 한다.
- **REQ-INFRA-005** [Event-driven] **When** 방문자가 `/`를 요청하면, 프론트엔드는 서비스명 "숨비투어"와 "준비 중" 안내 문구를 담은 임시 홈 페이지를 Tailwind CSS 스타일이 적용된 상태로 응답해야 한다. Tailwind CSS 스타일시트는 `(frontend)` 라우트 그룹에서만 로드되어야 하며, Payload 관리자 화면은 이 스타일시트를 로드하지 않아야 한다.

### 3.3 데이터베이스와 환경 변수

- **REQ-INFRA-006** [Ubiquitous] Docker Compose 파일은 로컬 PostgreSQL 서비스 하나를 정의해야 한다. 이 서비스는 메이저 버전을 고정한 이미지, 컨테이너를 지우고 다시 만들어도 데이터가 남는 이름 있는 볼륨, 상태 확인(healthcheck), 비밀번호 인증을 갖춰야 한다. 호스트 쪽 포트는 환경 변수로 받아야 하며, 값이 없으면 5432를 써야 한다.
- **REQ-INFRA-007** [Ubiquitous] Payload는 `DATABASE_URL`이 가리키는 PostgreSQL에 `@payloadcms/db-postgres` 어댑터로 연결해야 한다. 저장소는 필요한 환경 변수의 이름만 값 없이 나열한 `.env.example`을 포함해야 하며, 실제 값을 담는 `.env`는 git 추적에서 제외되어야 한다.
- **REQ-INFRA-008** [Event-driven] **When** 필수 환경 변수(`DATABASE_URL`, `PAYLOAD_SECRET`) 중 하나라도 없거나 빈 값인 상태로 `dev`, `build`, `start`, `test`, `e2e` 중 하나를 실행하면, 애플리케이션은 서버를 띄우거나 데이터베이스에 연결하기 전에 0이 아닌 종료 코드로 끝나야 하며, 출력에 누락된 변수 이름 전부와 `.env.example`을 참고하라는 안내를 담아야 한다.
- **REQ-INFRA-009** [Event-driven] **When** `dev`, `test`, `e2e`를 시작할 때 데이터베이스에 연결할 수 없으면, 애플리케이션은 서버를 띄우거나 테스트를 실행하기 전에 데이터베이스 연결 실패임을 밝히고 접속 대상(호스트·포트·데이터베이스 이름)과 조치 명령 `docker compose up -d`를 안내한 뒤, 60초 안에 0이 아닌 종료 코드로 끝나야 한다.
- **REQ-INFRA-010** [Unwanted] 애플리케이션과 테스트 도구는 출력·오류 메시지·로그에 `DATABASE_URL`의 비밀번호나 `PAYLOAD_SECRET`의 값을 포함하지 않아야 한다.

### 3.4 관리자 인증

- **REQ-INFRA-011** [Ubiquitous + Event-driven] Payload 설정은 이메일·비밀번호 인증을 쓰는 `Users` 컬렉션을 관리자 화면 사용자 컬렉션으로 등록해야 하며, 이 SPEC에서 등록하는 컬렉션은 `Users` 하나뿐이어야 한다. **When** 관리자가 `/admin/login`에서 등록된 이메일과 올바른 비밀번호를 제출하면, Payload는 인증을 마치고 관리자 대시보드를 보여 줘야 한다. **When** 잘못된 자격 증명이 제출되면, Payload는 인증 오류를 알리고 인증 토큰이나 세션을 발급하지 않아야 한다.
- **REQ-INFRA-012** [State-driven + Event-driven] **While** 데이터베이스에 `Users` 레코드가 하나도 없는 동안, **When** 방문자가 `/admin`을 열면, 관리자 화면은 첫 관리자 계정 생성 화면으로 안내해야 한다.

### 3.5 테스트·품질 도구와 문서

- **REQ-INFRA-013** [Ubiquitous] 테스트 실행(`pnpm test`)은 단위 테스트와 통합 테스트를 실행해야 하며, 단위 스모크 테스트를 1개 이상, 실제 데이터베이스에서 관리자 사용자를 생성·인증·삭제하는 통합 테스트를 1개 이상 포함해야 한다. 테스트 실행은 커버리지 보고서를 생성해야 하며, `src/lib/` 아래 파일을 합산한 라인 커버리지가 85% 미만이면 실패해야 한다.
- **REQ-INFRA-014** [Ubiquitous + Event-driven] E2E 실행(`pnpm e2e`)은 개발 서버 기본 포트(3000)와 다른 전용 포트에서 앱을 직접 띄운 뒤, 홈 페이지 렌더링과 관리자 로그인 화면 렌더링, 테스트용 관리자 계정 로그인을 확인해야 한다. **When** E2E 전용 포트를 다른 프로세스가 이미 쓰고 있으면, E2E 실행은 그 프로세스를 대상으로 테스트하지 않고 포트 충돌을 밝힌 메시지와 함께 0이 아닌 종료 코드로 끝나야 한다.
- **REQ-INFRA-015** [Ubiquitous + Capability] 린트(`pnpm lint`)와 포맷 검사(`pnpm format:check`)는 검사 대상 코드(§2.5)에 대해 오류 없이 통과해야 하고, 두 도구의 규칙은 서로 충돌하지 않아야 하며, 검사 대상 밖의 경로는 검사하지 않아야 한다. **Where** 저장소를 Windows에서 체크아웃한 경우, 텍스트 파일의 줄바꿈은 LF로 정규화되어 포맷 검사가 줄바꿈 차이 때문에 실패하지 않아야 한다.
- **REQ-INFRA-016** [Ubiquitous] `README.md`는 한국어로 사전 준비(Node.js LTS 설치, pnpm 활성화, Docker Desktop), 환경 변수 설정, DB 실행, 의존성 설치, 개발 서버 실행, 첫 관리자 계정 생성, 테스트 실행, 자주 겪는 문제(포트 충돌·DB 미실행·OneDrive 동기화) 해결 방법을 순서대로 안내해야 한다.

## 4. 비기능 제약

- **보안**: 저장소에는 비밀 값이 들어가지 않는다(REQ-INFRA-007, REQ-INFRA-010). 로컬 DB도 비밀번호 인증을 쓴다(REQ-INFRA-006).
- **재현성**: 잠금 파일과 정확한 버전 고정으로 같은 의존성 트리를 재현한다(REQ-INFRA-001, REQ-INFRA-004).
- **Windows 호환**: 모든 스크립트와 검증 명령은 Windows PowerShell 5.1과 PowerShell 7에서 동작해야 한다(REQ-INFRA-002, REQ-INFRA-015).
- **비용**: 유료 서비스나 계정 없이 로컬에서 전부 실행된다.

수용 기준과 검증 명령은 `acceptance.md`에 둔다.

## 5. 제외 범위 (Out of Scope)

### Out of Scope — 업무 데이터 모델

- `Tours`, `TourSessions`, `Applications`, `Members`, `Media` 컬렉션 (로드맵 2~4번 SPEC)
- 컬렉션 간 관계, 정원 계산, 신청 상태 관리 로직

### Out of Scope — 다국어(i18n)

- Payload localization 설정(`ko`, `en`)
- 로케일 라우팅(`/ko`, `/en`)과 UI 문구 사전 (로드맵 7번 SPEC)

### Out of Scope — 이메일

- 이메일 어댑터(Resend, Nodemailer 등)와 발송 기능 (로드맵 5번 SPEC)

### Out of Scope — 미디어 저장소

- 파일 업로드, S3 호환 스토리지 어댑터, Supabase Storage 연결
- 이미지 처리 라이브러리(sharp 등) 도입

### Out of Scope — 배포와 운영

- Vercel 배포, Supabase 데이터베이스·풀러 연결 (로드맵 8번 SPEC)
- 마이그레이션 파일 기반 스키마 운영 절차
- 앱 컨테이너화(Dockerfile, Compose 안의 앱 서비스)
- 실행 도중 데이터베이스가 끊기는 상황의 복구 처리(시작 시점 확인만 다룬다)

### Out of Scope — CI 파이프라인

- GitHub Actions 등 CI 워크플로. 1인 개발이고 배포 대상이 없어 이 단계에서는 로컬 품질 명령으로 충분하다. 배포 SPEC 또는 별도 SPEC에서 다시 판단한다.

### Out of Scope — 업무 기능

- 투어 목록·상세, 신청, 회원 가입·로그인, 관리자 통계·CSV 등 모든 사용자 기능
- 디자인 시스템, 브랜드 토큰, 실제 랜딩 페이지 디자인 (임시 홈 페이지만 만든다)

## 6. 추적성

| 요구사항 | 수용 기준 (`acceptance.md`) |
|---|---|
| REQ-INFRA-001 | AC-INFRA-002 |
| REQ-INFRA-002 | AC-INFRA-003 |
| REQ-INFRA-003 | AC-INFRA-004 |
| REQ-INFRA-004 | AC-INFRA-005 |
| REQ-INFRA-005 | AC-INFRA-008, AC-INFRA-009 |
| REQ-INFRA-006 | AC-INFRA-001, AC-INFRA-013 |
| REQ-INFRA-007 | AC-INFRA-006, AC-INFRA-011 |
| REQ-INFRA-008 | AC-INFRA-012 |
| REQ-INFRA-009 | AC-INFRA-014 |
| REQ-INFRA-010 | AC-INFRA-012, AC-INFRA-014 |
| REQ-INFRA-011 | AC-INFRA-006, AC-INFRA-008 |
| REQ-INFRA-012 | AC-INFRA-007 |
| REQ-INFRA-013 | AC-INFRA-006 |
| REQ-INFRA-014 | AC-INFRA-008, AC-INFRA-015 |
| REQ-INFRA-015 | AC-INFRA-010 |
| REQ-INFRA-016 | AC-INFRA-016 |

## 7. 참조

- `plan.md` — 검증된 버전, 부트스트랩 방식, 마일스톤, 위험
- `acceptance.md` — Given/When/Then 수용 기준, 품질 게이트, 완료 정의
