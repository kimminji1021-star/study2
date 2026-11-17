// 공통 머리글 — 모든 공개 화면 맨 위에 텍스트 로고(/)와 투어(/tours) 링크 두 개만 둔다(SPEC-LANDING-001 REQ-LANDING-009, plan.md §B.6).
// 화면마다 h1이 하나여야 하므로 제목 요소를 쓰지 않는다. 로그인·언어 전환은 범위 밖이다.
// 현재 위치 표시(aria-current)는 두지 않는다 — 경로 확인에 클라이언트 컴포넌트가 필요하고 링크가 둘뿐이라 효과가 작다.
import Link from 'next/link'

export function SiteHeader() {
  return (
    <header className="border-b border-(--color-divider) bg-(--surface-white)">
      <div className="mx-auto flex w-full max-w-(--content-max) items-center justify-between px-(--page-x)">
        <Link
          href="/"
          className="inline-flex min-h-(--touch-min) min-w-(--touch-min) items-center font-semibold tracking-(--tracking-h3) text-(--color-text)"
        >
          숨비투어
        </Link>
        <nav aria-label="주요 메뉴">
          <Link
            href="/tours"
            className="inline-flex min-h-(--touch-min) min-w-(--touch-min) items-center justify-center text-(--color-accent) transition-colors hover:text-(--color-accent-hover)"
          >
            투어
          </Link>
        </nav>
      </div>
    </header>
  )
}
