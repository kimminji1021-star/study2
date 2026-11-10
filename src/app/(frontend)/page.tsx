// 임시 홈 페이지 — 실제 홈 화면 디자인 전까지 쓰는 안내 페이지. 투어 목록(/tours)으로 가는 링크를 둔다(SPEC-TOUR-001 AC-TOUR-015).
import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-4xl font-bold">숨비투어</h1>
      <p className="text-lg text-gray-600">서비스를 준비 중입니다.</p>
      <Link
        href="/tours"
        className="inline-flex min-h-(--button-height) items-center rounded-(--radius-sm) bg-(--color-accent) px-(--space-6) font-semibold text-white hover:bg-(--color-accent-hover)"
      >
        투어 둘러보기
      </Link>
    </main>
  )
}
