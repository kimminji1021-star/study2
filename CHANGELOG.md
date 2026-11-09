# 변경 이력

이 파일은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) 형식을 따르며, 버전은 [유의적 버전](https://semver.org/lang/ko/)을 따릅니다.

## [Unreleased]

### 추가됨

- **SPEC-INFRA-001 프로젝트 기반 구축** (수용 기준 16개 전부 충족)
  - Payload CMS 3.93.0과 Next.js 16.4.5를 하나로 실행하는 앱 골격: 사용자 화면 `src/app/(frontend)`과 관리자·API `src/app/(payload)`를 라우트 그룹으로 분리 (`src/payload.config.ts`)
  - 로컬 PostgreSQL: `docker-compose.yml`(프로젝트 이름 `sumbi-tour`, `127.0.0.1` 바인딩, 포트는 `POSTGRES_PORT`로 변경 가능)과 환경 변수 이름 목록 `.env.example`
  - 시작 전 점검: 필수 환경 변수 누락과 DB 연결 실패를 안내 문구와 함께 알리는 `src/lib/preflight.ts`, 실행 진입점 `scripts/preflight.mjs`
  - 관리자 인증 컬렉션 `src/collections/Users.ts`(이메일·비밀번호, 첫 관리자 생성 화면 포함)
  - 임시 홈 페이지 `src/app/(frontend)/page.tsx`
  - 테스트 도구: Vitest 단위·통합 테스트(`tests/unit`, `tests/integration`, 98건), Playwright E2E(`tests/e2e`, 4건), 공용 도우미 `tests/helpers`, 저장소 규칙 테스트 `tests/unit/repo-rules.spec.ts`
  - 린트·포맷: ESLint(`eslint.config.mjs`), Prettier(`prettier.config.mjs`)
  - 패키지 관리: pnpm 11.28.9 고정(`package.json` `packageManager`), Node.js 버전 범위 강제(`pnpm-workspace.yaml` `engineStrict: true`)
  - 한국어 개발 환경 안내 `README.md`(설치, 실행, 테스트, 문제 해결)

### 보안

- 간접 의존성 `dompurify`를 3.4.17로 고정해 critical·high 권고를 해소 (`pnpm-workspace.yaml` `overrides`). `pnpm audit` 권고 10건 → 5건(critical 0건)
