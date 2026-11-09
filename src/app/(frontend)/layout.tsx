// 사용자 화면((frontend)) 루트 레이아웃. Payload 관리자 화면은 (payload)/layout.tsx가 따로 맡는다.
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// Tailwind 스타일시트는 이 레이아웃에서만 불러온다(AC-INFRA-009)
import './globals.css'

export const metadata: Metadata = {
  title: '숨비투어',
  description: '숨비투어 — 서비스 준비 중',
}

export default function FrontendLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
