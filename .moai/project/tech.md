# 기술 스택 (tech.md)

> 상태: SPEC-INFRA-001(기반 구축) 완료로 핵심 버전이 고정되었습니다(§8). 이메일·스토리지·배포 관련 항목은 해당 SPEC에서 확정합니다.

## 1. 스택과 선택 이유

| 영역 | 선택 | 이유 |
|---|---|---|
| 언어 | TypeScript | Payload가 컬렉션 정의에서 타입을 생성하므로 데이터 모델과 화면 코드의 타입을 일치시킬 수 있음 |
| 프레임워크 | Next.js (App Router) | 사용자 지정. 서버 컴포넌트로 투어 페이지를 렌더링하고 Vercel에 그대로 배포 가능 |
| CMS | Payload CMS | 사용자 지정(Payload CMS). Next.js 앱 내장 실행을 위해 3.x 계열을 전제로 제안하며, 메이저 버전은 첫 SPEC에서 현재 공식 문서로 확인해 확정. Next.js 앱 안에서 실행되어 관리자 화면·API·인증을 별도 서버 없이 제공 |
| DB 어댑터 | `@payloadcms/db-postgres` | PostgreSQL 사용 요구에 맞는 공식 어댑터 |
| 데이터베이스 | PostgreSQL (운영: Supabase) | 무료 요금제로 운영 가능. 서버리스 환경에서는 **Supabase 연결 풀러(pooler)** 주소를 사용해야 연결 수 고갈을 피할 수 있음 |
| 미디어 저장소 | Supabase Storage (S3 호환) + Payload S3 스토리지 어댑터 | Vercel의 파일 시스템은 영구 저장이 안 되므로 외부 객체 저장소 필요. 어댑터 패키지명은 설치 시 공식 문서 확인 필요 |
| 다국어 | Payload localization (`ko`, `en`) + 로케일 라우팅 | 컬렉션 필드 단위로 한·영 콘텐츠 관리. 고정 UI 문구는 별도 사전으로 관리 |
| 회원 인증 | Payload 내장 인증 (이메일 + 비밀번호) | 추가 인증 서비스 없이 `Members` 컬렉션으로 구현 |
| 이메일 | 무료 요금제 트랜잭션 메일 서비스 — **결정 필요** (`product.md` §8) | 아래 2절 참고 |
| 테스트 | Vitest (단위·통합), Playwright (E2E) | 사용자 지정. 신청 흐름 전체를 브라우저로 검증 |
| 패키지 매니저 | pnpm 11.28.9 (`packageManager`로 고정) | Payload 공식 템플릿이 주로 사용 |

## 2. 이메일 발송 서비스 후보 (결정 필요 — `product.md` §8)

| 후보 | 특징 | 확인할 점 |
|---|---|---|
| Resend | Payload 공식 이메일 어댑터 제공, 설정이 간단 | 무료 발송 한도, 도메인 인증 필요 여부 — 현재 공식 문서 확인 필요 |
| 일반 SMTP 제공자 (Gmail 등) | Payload Nodemailer 어댑터로 연결 | 발송 한도·스팸 분류 위험, 계정 보안 설정 — 현재 공식 문서 확인 필요 |

참고: Supabase Auth의 기본 메일 기능은 Supabase 인증 전용으로 보이며, 이 프로젝트는 Payload 인증을 쓰므로 후보에서 제외했습니다. 공식 문서로 확인하지 않은 판단이므로 선택 전 확인이 필요합니다.

## 3. 로컬 개발 환경

- Node.js LTS (정확한 최소 버전은 Payload·Next.js 공식 요구사항 확인 필요)
- 패키지 매니저: pnpm 11.28.9 (Corepack 사용, `README.md` 참고)
- Node.js 범위: `^22.23.4 || ^24.22.1 || >=26.0.0` (`engineStrict: true`로 범위 밖 설치 차단)
- PostgreSQL — 다음 중 하나
  - Docker로 로컬 PostgreSQL 실행 (`docker-compose.yml`)
  - 개발 전용 Supabase 프로젝트 사용 (무료 프로젝트 수 제한 확인 필요)
- Playwright 브라우저 설치 (E2E 테스트용)
- 운영 체제: Windows 개발 환경 (현재 작업 PC 기준)

## 4. 환경 변수 (이름만, 값은 기록하지 않음)

| 이름(제안) | 용도 |
|---|---|
| `DATABASE_URL` | PostgreSQL 연결 문자열 (운영은 Supabase 풀러 주소) |
| `PAYLOAD_SECRET` | Payload 토큰 서명용 비밀 값 |
| `NEXT_PUBLIC_SERVER_URL` | 사이트 기본 URL (메일 링크 등) |
| `S3_BUCKET` | Supabase Storage 버킷 이름 |
| `S3_ENDPOINT` | Supabase Storage S3 호환 엔드포인트 |
| `S3_REGION` | 스토리지 리전 |
| `S3_ACCESS_KEY_ID` | 스토리지 접근 키 |
| `S3_SECRET_ACCESS_KEY` | 스토리지 비밀 키 |
| `EMAIL_FROM` | 발신 주소 |
| `ADMIN_NOTIFY_EMAIL` | 새 신청 알림을 받을 관리자 주소 |
| `RESEND_API_KEY` 또는 `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | 이메일 서비스 결정에 따라 하나만 사용 |

실제 값은 `.env`(git 제외)와 Vercel 환경 변수에만 저장하고, 저장소에는 `.env.example`로 이름만 남깁니다.

## 5. 배포

- 호스팅: Vercel (Hobby)
- 데이터베이스: Supabase Free, **풀러 연결 주소** 사용
- 미디어: Supabase Storage (S3 호환 접근 키 발급 필요)
- DB 스키마 반영: Payload 마이그레이션을 배포 전에 실행하는 방식으로 운영 (운영 DB에서 자동 스키마 푸시 사용 금지 권장). 세부 절차는 배포 SPEC에서 결정
- 서버리스 함수 실행 시간·용량 제한이 관리자 CSV 내려받기 등에 영향을 줄 수 있으므로 배포 단계에서 확인

## 6. 무료 요금제 제약과 주의 사항

- **Vercel Hobby**: 비상업적 개인 용도 한정. 상업 운영 시 Pro 전환 검토 필요. 대역폭·함수 실행 한도는 현재 공식 문서 확인 필요.
- **Supabase Free**: 일정 기간 비활성 시 프로젝트 일시 정지. DB 용량·Storage 용량·대역폭 한도는 현재 공식 문서 확인 필요.
- **이메일 서비스**: 일·월 발송 한도는 현재 공식 문서 확인 필요. 한도 초과 시 접수 확인 메일이 누락될 수 있으므로 신청 저장은 메일 발송 성공 여부와 분리해 처리할 것을 제안합니다(제안 — 해당 SPEC에서 확정).

## 7. 품질 기준

- TRUST 5 원칙 적용, 테스트 커버리지 목표 85% 이상
- 린트·포맷: ESLint 9 + eslint-config-next, Prettier 3(§8 참고)
- 코드 주석: 한국어 (`language.yaml`의 `code_comments: ko`)

## 8. 확정 버전과 결정 사항 (SPEC-INFRA-001)

| 항목 | 값 | 비고 |
|---|---|---|
| Payload CMS | 3.93.0 (`payload`, `@payloadcms/next`, `@payloadcms/ui`, `@payloadcms/db-postgres`, `@payloadcms/richtext-lexical`) | 템플릿은 payload v3.93.0 저장소의 `with-postgres`를 sparse clone으로 가져옴(`create-payload-app`에 해당 템플릿이 없음) |
| Next.js | 16.4.5 | `next.config.ts`에서 `agentRules: false` |
| React | 19.3.1 | |
| TypeScript | 6.0.3 | 7.x는 typescript-eslint 8.72.1이 지원하지 않아 보류 |
| GraphQL | 16.15.0 | Payload 피어 의존성 |
| Tailwind CSS | 4.3.5 (PostCSS 플러그인) | |
| Vitest / Playwright | 5.1.0 / 1.65.0 | Playwright `webServer` 준비 확인은 `port` 기준 |
| ESLint / Prettier | 9.39.5 / 3.9.10 | Prettier: `semi: false`, `singleQuote`, `printWidth: 120`, CSS는 큰따옴표 |
| pnpm | 11.28.9 | `engineStrict: true`, `allowBuilds`에 esbuild만 허용 |

구현 결정:

- 환경 변수 로딩은 dotenv 대신 Node 내장 `process.loadEnvFile()`을 쓰고, 점검 로직은 `src/lib/preflight.ts` 한 모듈에 모았습니다.
- 로컬 DB는 Docker Compose(프로젝트 이름 `sumbi-tour`)로 실행하며 `127.0.0.1`에만 바인딩합니다. 포트는 `.env`의 `POSTGRES_PORT`로 바꿀 수 있습니다(5433 변경 확인 완료).
- 간접 의존성 `dompurify`는 `overrides`로 3.4.17에 고정했습니다(상위 패키지가 따라오면 제거).

### 8.1 투어 카탈로그 결정 사항 (SPEC-TOUR-001)

- 새 패키지는 추가하지 않았습니다(잠금 파일 변경 없음).
- `sharp`는 의도적으로 설치하지 않았습니다. 따라서 Payload 이미지 자르기·크기 변환을 쓰지 않고, `next/image`는 `unoptimized`로 Payload 파일 주소를 그대로 씁니다.
- 투어 목록·상세 화면은 `next/server`의 `connection()`으로 요청 시점에 렌더링합니다. 관리자가 바꾼 내용이 다시 빌드하지 않아도 바로 반영됩니다.
- 업로드 이미지는 Payload 로컬 저장소(저장소 루트 `media/`, git 제외)에 둡니다. 파일 주소는 `serverURL`(`NEXT_PUBLIC_SERVER_URL`)을 붙인 절대 주소입니다.

배포 SPEC으로 넘긴 항목:

- 업로드 저장소를 로컬 `media/`에서 Supabase Storage(S3 어댑터)로 전환하고, 이미지 주소가 운영 주소로 만들어지도록 `NEXT_PUBLIC_SERVER_URL`을 정확히 설정

- `NEXT_PUBLIC_SERVER_URL`이 비어 있으면 CSRF 허용 목록이 비게 됩니다. 운영에서는 이 값을 필수로 하거나 `csrf`를 명시적으로 설정해야 합니다.
- 남은 `pnpm audit` 권고 5건(happy-dom high 2건, esbuild·minimatch moderate, deepmerge low) 재평가
- 개발 모드 스키마 푸시 대신 마이그레이션으로 전환, 개발 DB에 남은 `payload_migrations` 행 정리
