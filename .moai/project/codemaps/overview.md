# 코드맵 개요

> SPEC-TOUR-001 완료 시점(2026-11-10)의 개요입니다(SPEC-INFRA-001 개요에 카탈로그 모듈을 더함). 기능 SPEC이 추가되면 `/moai codemaps`로 다시 생성합니다.

## 현재 모듈

| 모듈 | 파일 | 역할 |
|---|---|---|
| Payload 설정 | `src/payload.config.ts` | DB 어댑터, 컬렉션 등록, 시크릿·서버 URL |
| 관리자 인증 | `src/collections/Users.ts` | 관리자 계정 컬렉션 |
| 카탈로그 컬렉션 | `src/collections/{Tours,TourSessions,Media}.ts` | 투어·회차·이미지, 업로드 규칙 |
| 접근 규칙 | `src/lib/access.ts` | 관리자 판정, 익명 읽기 범위(공개 투어·그 회차·대표 이미지) |
| 카탈로그 조회 | `src/lib/catalog.ts` | 화면이 쓰는 유일한 조회 계층(익명 권한) |
| 표시 도우미 | `src/lib/{session-availability,format,catalog-order,status-badge,validation}.ts` | 남은 자리, 서울 시각·가격 표시, 정렬, 배지, 입력 검증 |
| 개발용 시드 | `src/lib/seed.ts`, `scripts/seed.ts` | `pnpm seed`, 운영·원격 DB 거부 |
| 시작 전 점검 | `src/lib/preflight.ts`, `scripts/preflight.mjs` | 필수 환경 변수와 DB 연결 확인 |
| 사용자 화면 | `src/app/(frontend)/` | 홈, `/tours`, `/tours/[slug]`, 404, 디자인 토큰 |
| 화면 공통 조각 | `src/components/` | TourCard, TourImage, SessionList, StatusBadge |
| 관리자·API | `src/app/(payload)/` | Payload 템플릿 생성 라우트 |
| 테스트 | `tests/{unit,integration,e2e,helpers}` | Vitest 275건, Playwright 26건 |

카탈로그 흐름:

```mermaid
flowchart LR
    req["요청 /tours, /tours/[slug]"] --> page["tours 페이지(connection, 요청 시점 렌더링)"]
    page --> cat["src/lib/catalog.ts (익명 권한)"]
    cat --> acc["컬렉션 읽기 규칙 src/lib/access.ts"]
    cat --> avail["session-availability.ts"]
    acc --> db[("PostgreSQL")]
    page --> comp["src/components/*"]
    comp --> media["Payload 파일 주소 (media/)"]
```

기반 흐름:

```mermaid
flowchart LR
    dev["pnpm dev / test"] --> pre["scripts/preflight.mjs"]
    pre --> lib["src/lib/preflight.ts"]
    lib --> db[("PostgreSQL (Docker)")]
    app["Next.js 앱"] --> cfg["src/payload.config.ts"]
    cfg --> users["src/collections/Users.ts"]
    cfg --> db
```

## 프로젝트 목표

- 여행지 투어 프로그램을 한국어·영어로 소개하는 랜딩페이지 제공
- 투어별 회차와 정원을 관리하고, 신청 인원 합계가 정원에 도달하면 자동으로 마감
- 비회원·회원 모두 온라인으로 신청 가능 (개인정보 동의 필수)
- 이메일·비밀번호 회원 로그인과 내 신청 내역 조회 (회원 본인 것만)
- 신청자와 관리자에게 이메일 알림 발송
- 관리자가 신청 상태(대기·확정·취소)를 관리하고 CSV 내려받기와 통계(회차별 정원 대비 신청 인원)를 확인
- Vercel + Supabase 무료 요금제 범위 안에서 운영

실제·계획 구조는 `../structure.md`, 기술 스택은 `../tech.md`를 참고하세요.
