# 변경 이력

이 파일은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) 형식을 따르며, 버전은 [유의적 버전](https://semver.org/lang/ko/)을 따릅니다.

## [Unreleased]

### 추가됨

- **SPEC-TOUR-001 투어 카탈로그와 회차** (수용 기준 16개 충족, sync 감사 PASS 92.5)
  - 컬렉션 3종과 접근 규칙: 투어 `src/collections/Tours.ts`, 회차 `src/collections/TourSessions.ts`, 이미지 `src/collections/Media.ts`. 쓰기는 관리자만, 익명 읽기는 공개 투어와 그 회차·대표 이미지로 제한 (`src/lib/access.ts`)
  - 업로드 규칙: JPEG·PNG·WebP만 허용, 5MB 초과 거부, 대체 텍스트 필수. 업로드 파일은 저장소 루트 `media/`에 저장하며 git에서 제외
  - 투어 목록 `/tours` (`src/app/(frontend)/tours/page.tsx`)와 상세 `/tours/[slug]` (`src/app/(frontend)/tours/[slug]/page.tsx`): 공개 투어만 표시, 다가오는 회차와 남은 자리 배지, 요청 시점 렌더링
  - 없는 투어·비공개 투어 404 화면 `src/app/(frontend)/not-found.tsx`, 홈에서 투어 목록으로 가는 링크 (`src/app/(frontend)/page.tsx`)
  - 카탈로그 조회 계층 `src/lib/catalog.ts`(익명 권한으로만 조회)와 표시 도우미 `src/lib/session-availability.ts`·`src/lib/format.ts`·`src/lib/catalog-order.ts`·`src/lib/status-badge.ts`·`src/lib/validation.ts`
  - 화면 공통 조각 `src/components/`(`TourCard`, `TourImage`, `SessionList`, `StatusBadge`)과 사용자 화면 범위의 디자인 토큰 `src/app/(frontend)/tokens.css`
  - 개발용 시드 `pnpm seed` (`scripts/seed.ts`, `src/lib/seed.ts`): 투어 3개·회차 7개, 운영 환경과 원격 DB에서는 실행 거부
  - 테스트: Vitest 275건(`src/lib` 라인 커버리지 100%), Playwright E2E 26건

- **SPEC-INFRA-001 프로젝트 기반 구축** (수용 기준 16개 충족, 단 PowerShell 7 실행 확인은 부채로 남김 — Windows PowerShell 5.1에서는 전부 통과)
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
