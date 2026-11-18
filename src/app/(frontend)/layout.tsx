// 사용자 화면((frontend)) 루트 레이아웃. Payload 관리자 화면은 (payload)/layout.tsx가 따로 맡는다.
// 모든 공개 화면에 본문 바로가기 → 공통 머리글 → 본문 영역 → 공통 바닥글을 그린다(SPEC-LANDING-001 REQ-LANDING-009·010·014, plan.md §B.6).
// 각 화면의 <main>은 화면이 그대로 그린다(화면마다 폭·여백이 다름). 본문 영역은 바로가기 대상일 뿐이다.
import type { Metadata } from 'next'
import localFont from 'next/font/local'
import type { ReactNode } from 'react'

import { SiteFooter } from '../../components/SiteFooter'
import { SiteHeader } from '../../components/SiteHeader'
// Tailwind 스타일시트는 이 레이아웃에서만 불러온다(AC-INFRA-009)
import './globals.css'

// @MX:NOTE: [AUTO] Pretendard 가변 글꼴은 공식 v1.3.9 PretendardVariable.woff2 원본을 그대로 직접 호스팅한다(plan.md §B.8).
//   잘라 내거나 이름을 바꾸면 SIL OFL 1.1상 "Pretendard" 이름을 쓸 수 없다 — 크기·SHA-256은 저장소 규칙 테스트가 고정한다(AC-LANDING-012).
//   라이선스 전문은 같은 디렉터리의 OFL.txt. weight '45 920'은 공식 pretendardvariable.css의 무게 축 범위다.
//   preload: false — 첫 화면의 가장 큰 요소(홈 대표 사진)와 약 2MB 글꼴이 대역을 다투지 않게 한다. display swap으로 대체 글꼴이 먼저 보인다.
//   이 파일((frontend) 아래)에서만 불러온다 — 관리자 화면은 이 글꼴을 받지 않는다.
const pretendard = localFont({
  src: './fonts/PretendardVariable.woff2',
  weight: '45 920',
  display: 'swap',
  preload: false,
  variable: '--font-pretendard',
})

export const metadata: Metadata = {
  title: '숨비투어',
  description: '제주의 소규모 투어와 다가오는 회차를 한눈에 확인하세요.',
  // 비공개 미리보기 동안 검색 제외(SPEC-DEPLOY-001 REQ-DEPLOY-012). 2단계 공개 출시 때 걷어 낸다
  robots: { index: false, follow: false },
}

export default function FrontendLayout({ children }: { children: ReactNode }) {
  return (
    // --font-pretendard 변수를 <html>에 둔다. :root(=<html>)의 --font-sans가 이 변수를 맨 앞에 쓴다(tokens.css)
    <html lang="ko" className={pretendard.variable}>
      <body className="flex min-h-screen flex-col">
        {/* 첫 포커스 요소. 평소에는 화면 위로 밀어 두고 포커스를 받으면 보인다(흰 면 위 포커스 외곽선은 포인트 색 5.63:1) */}
        <a
          href="#main-content"
          className="absolute top-(--space-2) left-(--space-4) z-50 inline-flex min-h-(--touch-min) -translate-y-[200%] items-center rounded-(--radius-pill) border border-(--color-input-border) bg-(--color-bg) px-(--space-6) font-semibold text-(--color-text) focus:translate-y-0"
        >
          본문 바로가기
        </a>
        <SiteHeader />
        {/* 바로가기 대상. 포커스를 받아도 외곽선은 그리지 않는다(globals.css) — 다음 Tab이 본문의 첫 포커스 요소로 간다 */}
        <div id="main-content" tabIndex={-1} className="flex-1">
          {children}
        </div>
        <SiteFooter />
      </body>
    </html>
  )
}
