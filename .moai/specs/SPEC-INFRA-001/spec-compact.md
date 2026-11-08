# SPEC-INFRA-001 (compact) — 프로젝트 기반 구축

> run 단계용 요약본. 원본: `spec.md`(요구사항·용어), `acceptance.md`(수용 기준), `plan.md`(버전·마일스톤·위험). 내용이 다르면 원본이 우선한다.
> Tier M · status: draft · 문서 버전 0.1.1 · 개발 방식: TDD · 검증 셸: Windows PowerShell 5.1 / 7

## 용어 (spec.md §2.5)

- **정식 안정 버전**: 사전 배포 식별자 없음 + 메이저 1 이상. 직접 의존성에만 적용.
- **검사 대상 코드**: `src/`, `tests/`, 루트 JS·TS·JSON·CSS 설정 파일. **검사 제외 목록**(린트·포맷 무시 설정이 똑같이 담음): MoAI 소유 `.claude/`, `.moai/`, `.github/`, `.git_hooks/`, `CLAUDE.md`, `.mcp.json`, `.claudeignore`, `.worktreeinclude` · `*.md` · 생성 파일(`src/payload-types.ts`, `importMap.js`, `next-env.d.ts`, `pnpm-lock.yaml`) · 산출물(`.next/`, `out/`, `build/`, `coverage/`, `playwright-report/`, `test-results/`).

## 요구사항 (GEARS)

- **REQ-INFRA-001** [Ubiquitous + Event-driven] Node.js 범위(Payload ∩ Vitest, Node 25 제외)와 pnpm 정확한 버전 명시, 잠금 파일 포함·재현. **When** 범위 밖 Node.js로 설치하면 0이 아닌 코드로 실패한다.
- **REQ-INFRA-002** [Ubiquitous + Capability] 스크립트 `dev`, `build`, `start`, `test`, `e2e`, `lint`, `format`, `format:check`, `typecheck` 제공. **Where** Windows PowerShell에서도 `rm -rf`·인라인 `VAR=value` 없이 같은 결과.
- **REQ-INFRA-003** [Ubiquitous] Next.js App Router + Payload 단일 앱. 사용자 화면은 `(frontend)`, 관리자·API는 `(payload)`에만. 운영 빌드는 타입 오류 없이 완료.
- **REQ-INFRA-004** [Ubiquitous] 직접 의존성은 정식 안정 버전만. `payload`·`@payloadcms/*`는 하나의 정확한 버전. Next.js는 `@payloadcms/next` peer 범위 안.
- **REQ-INFRA-005** [Event-driven] **When** `/` 요청 시 "숨비투어"와 "준비 중" 문구를 담은 임시 홈을 Tailwind 적용 상태로 응답. Tailwind는 `(frontend)`에서만 로드, 관리자 화면은 로드 안 함.
- **REQ-INFRA-006** [Ubiquitous] Compose에 PostgreSQL 하나(메이저 고정, 재생성해도 남는 이름 있는 볼륨, healthcheck, 비밀번호 인증). 호스트 포트는 환경 변수(기본 5432).
- **REQ-INFRA-007** [Ubiquitous] `DATABASE_URL`로 `@payloadcms/db-postgres` 연결. `.env.example`은 이름만, `.env`는 git 제외.
- **REQ-INFRA-008** [Event-driven] **When** `DATABASE_URL`·`PAYLOAD_SECRET` 누락·빈 값으로 `dev`/`build`/`start`/`test`/`e2e`를 실행하면, 서버·DB 연결 전에 0이 아닌 코드로 끝나고 누락 변수 이름 전부와 `.env.example` 안내 출력.
- **REQ-INFRA-009** [Event-driven] **When** `dev`/`test`/`e2e` 시작 시 DB 연결 불가면, 서버·테스트 시작 전에 연결 실패·접속 대상(호스트·포트·DB 이름)·`docker compose up -d` 안내 후 60초 안에 0이 아닌 코드로 종료.
- **REQ-INFRA-010** [Unwanted] 출력·오류·로그에 `DATABASE_URL` 비밀번호나 `PAYLOAD_SECRET` 값을 포함하지 않는다.
- **REQ-INFRA-011** [Ubiquitous + Event-driven] `Users`(이메일·비밀번호)를 관리자 사용자 컬렉션으로 등록, 컬렉션은 `Users` 하나뿐. **When** 올바른 자격 증명 → 대시보드. **When** 잘못된 자격 증명 → 인증 오류, 토큰·세션 미발급.
- **REQ-INFRA-012** [State-driven + Event-driven] **While** `Users` 레코드가 없는 동안 **When** `/admin`을 열면 첫 관리자 생성 화면으로 안내.
- **REQ-INFRA-013** [Ubiquitous] `pnpm test`는 단위 스모크 1개 이상 + 실제 DB에서 관리자 생성·인증·삭제 통합 테스트 1개 이상. 커버리지 보고서 생성, `src/lib/` 합산 라인 85% 미만이면 실패.
- **REQ-INFRA-014** [Ubiquitous + Event-driven] `pnpm e2e`는 3000이 아닌 전용 포트에서 앱을 띄워 홈·로그인 화면·테스트 계정 로그인 확인. **When** 전용 포트가 점유되어 있으면 그 프로세스를 테스트하지 않고 포트 충돌 메시지와 함께 0이 아닌 코드로 종료.
- **REQ-INFRA-015** [Ubiquitous + Capability] `pnpm lint`·`pnpm format:check`가 검사 대상 코드에서 오류 없이 통과, 규칙 충돌 없음, 검사 대상 밖은 검사하지 않음. **Where** Windows 체크아웃에서도 LF 정규화.
- **REQ-INFRA-016** [Ubiquitous] 한국어 README: 사전 준비 → 환경 변수 → DB 실행 → 설치 → 개발 서버 → 첫 관리자 → 테스트 → 문제 해결(포트 충돌·DB 미실행·OneDrive).

## 수용 기준 (요약 — 상세 명령은 acceptance.md)

검사 원칙: 문자열·구조 검사는 저장소 규칙 테스트(`tests/unit/repo-rules.spec.ts`, `pnpm test`의 일부)로 하고, 각 검사는 대상 1건 이상 존재를 먼저 단언한다. 셸 검색은 `Select-String -SimpleMatch '<고정 문자열>'`만 쓴다. 별도 표시가 없으면 PostgreSQL 컨테이너 `healthy`(AC-INFRA-001)가 전제다(`pnpm test`로 판정하는 모든 기준 포함). 시간 조건은 `Measure-Command { <명령> *> <로그> }`의 `TotalSeconds`와 `$LASTEXITCODE`로 판정.

| AC | 핵심 검증 |
|---|---|
| AC-INFRA-001 | `docker compose up -d` → 60초 안에 `postgres healthy`; 규칙 테스트로 Compose 설정 확인; `down`(‑v 없이) → `up` 후 확인용 테이블 유지 |
| AC-INFRA-002 | `pnpm install --frozen-lockfile` 종료 0·peer 경고 없음; 규칙 테스트로 `packageManager`·`engines.node`(6개 버전 대입 판정); `nodeVersion` 25.0.0 덮어쓰기 설치는 실패 |
| AC-INFRA-003 | 규칙 테스트: 스크립트 9개 존재, `rm -rf` 0건, 인라인 `VAR=` 0건; PS 5.1/7 버전 기록 |
| AC-INFRA-004 | `pnpm typecheck`·`pnpm build` 종료 0; 규칙 테스트로 `(frontend)`에 `admin`/`api` 0건, `(payload)`에 각 1건 이상 |
| AC-INFRA-005 | 규칙 테스트: 직접 의존성 사전 배포·0.x 0건, payload 계열 범위 기호 없음·동일 버전, next가 peer 범위 만족 |
| AC-INFRA-006 | `pnpm test` 종료 0; 사용자 생성·로그인 성공·실패·삭제; slug 목록에서 `payload-` 접두어(시스템 컬렉션)를 뺀 결과가 정확히 `['users']`; `src/lib/` 합산 85% 이상(임계값 내장) |
| AC-INFRA-007 | (수동) 빈 DB에서 `/admin` → `/admin/create-first-user` → 생성 후 `/admin` |
| AC-INFRA-008 | `pnpm e2e` 종료 0; `/` 200, `h1`에 `숨비투어`, `준비 중` 문구, Tailwind 계산 스타일; 로그인 폼; 테스트 계정 로그인 → `/admin`; `new URL(page.url()).port`가 E2E 포트와 같고 `'3000'` 아님을 단언 |
| AC-INFRA-009 | 규칙 테스트: `@import "tailwindcss"` 파일·import 위치 1건 이상이고 모두 `(frontend)`; `(payload)` 참조 0건 |
| AC-INFRA-010 | `pnpm lint`·`pnpm format:check` 종료 0; 규칙 테스트로 §2.5 검사 제외 목록이 `.prettierignore`·`globalIgnores` 양쪽에 동일·`eslint-config-prettier`; `.moai/` 임시 파일은 무시되고 `src/` 임시 파일은 실패(대조); `i/crlf` 0건·`i/lf` 1건 이상 |
| AC-INFRA-011 | 규칙 테스트: `.env.example` 줄 1개 이상 모두 `^[A-Z][A-Z0-9_]*=$`, 필수 이름 존재; `git check-ignore -q .env` 0, `.env.example` 1 |
| AC-INFRA-012 | `PAYLOAD_SECRET` 제거 → `Measure-Command`로 `pnpm dev`·`pnpm test` 각 30초 미만·`$LASTEXITCODE` ≠ 0, 로그에 `PAYLOAD_SECRET`·`.env.example`, `Ready`/`Local:` 0건, 비밀번호 0건; 단위 테스트 4가지 조합 |
| AC-INFRA-013 | 포트 변수 5433 → `docker compose port postgres 5432`가 `:5433`, `git diff --exit-code -- docker-compose.yml` 0, AC-006 통과 |
| AC-INFRA-014 | DB 정지 → `Measure-Command`로 `pnpm test`·`pnpm dev` 각 60초 미만·`$LASTEXITCODE` ≠ 0, 연결 실패·대상·`docker compose up -d` 표시, `Ready`/`Local:` 0건, 비밀 값 0건 |
| AC-INFRA-015 | E2E 포트 점유 → `Measure-Command`로 `pnpm e2e` 30초 미만·`$LASTEXITCODE` ≠ 0, 포트 번호·사용 중 안내, `passed` 0건 |
| AC-INFRA-016 | README 항목 순서·키워드 일치, README대로 하면 AC-001·002·004·006·008 통과 |

## 생성·수정 파일

- 생성: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.gitattributes`, `.env.example`, `docker-compose.yml`, `next.config.*`, `tsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs`, Prettier 설정, `.prettierignore`, `vitest.config.mts`, `playwright.config.ts`, `scripts/preflight.mjs`(예시 이름), `src/payload.config.ts`, `src/payload-types.ts`, `src/collections/Users.ts`, `src/app/(frontend)/{layout.tsx,page.tsx,globals.css}`, `src/app/(payload)/**`, `src/lib/**`(`env` 디렉터리 이름 금지 — `.gitignore` L51), `tests/{unit,integration,e2e,helpers}/**`
- 수정: `.gitignore`(추가만: `coverage/`, `playwright-report/`, `test-results/`, `blob-report/`), `README.md`(확장)
- 변경 금지: `.claude/`, `.moai/`(이 SPEC 디렉터리 제외), `CLAUDE.md`, `.mcp.json`, `.git_hooks/`, `.github/`

## 실행 순서 주의 (plan.md §E)

- 순차: `docker compose up -d` → `pnpm install --frozen-lockfile` → `pnpm typecheck` → `pnpm build` → `pnpm test` → `pnpm e2e`
- 병렬(읽기 전용만): `docker compose ps`, `pnpm lint`, `pnpm format:check`, `pnpm list --depth 0 --json`, `git ls-files --eol`, `git check-ignore`, `git status --short`
- 예외 시나리오(AC-012~015)는 순차, 하나 끝날 때마다 원상 복구

## 제외 범위 (Out of Scope)

### Out of Scope — 요약

- `Tours`, `TourSessions`, `Applications`, `Members`, `Media` 컬렉션과 업무 로직
- 다국어(localization, `/ko`·`/en` 라우팅, UI 문구 사전)
- 이메일 어댑터와 발송
- 파일 업로드, S3·Supabase Storage, sharp 등 이미지 처리
- Vercel·Supabase 배포, 마이그레이션 운영 절차, Dockerfile·앱 컨테이너, 실행 도중 DB 끊김 복구
- CI 파이프라인
- 투어·신청·회원·통계 등 모든 사용자 기능, 디자인 시스템
