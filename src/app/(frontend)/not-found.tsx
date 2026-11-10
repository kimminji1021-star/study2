// 사용자 화면 404 — 없는 투어·공개되지 않은 투어(notFound())에 쓴다(SPEC-TOUR-001 REQ-TOUR-012, AC-TOUR-012).
// 공개 여부를 드러내지 않도록 두 경우 모두 같은 문구를 보여 준다.
import Link from 'next/link'

export default function FrontendNotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-(--content-max) flex-col items-center justify-center gap-(--space-4) px-(--page-x) py-(--space-12) text-center">
      <h1 className="text-(length:--text-h2) font-bold">페이지를 찾을 수 없습니다</h1>
      <p className="text-(--color-text-2)">주소가 바뀌었거나 지금은 볼 수 없는 투어입니다.</p>
      <Link
        href="/tours"
        className="inline-flex min-h-(--touch-min) items-center rounded-(--radius-sm) bg-(--color-accent) px-(--space-6) font-semibold text-white hover:bg-(--color-accent-hover)"
      >
        투어 목록 보기
      </Link>
    </main>
  )
}
