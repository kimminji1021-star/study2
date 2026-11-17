// 홈의 추천 투어 영역 — /tours와 같은 순서의 앞 최대 6개를 기존 투어 카드로 보여 주고 "투어 전체 보기"로 /tours에 잇는다
// (SPEC-LANDING-001 REQ-LANDING-007, plan.md §B.3·§B.10). 짙은 히어로 다음의 흰 면이다.
// 영역 제목 "추천 투어"가 h2이므로 카드 제목은 h3이다. 투어가 없으면 안내 문구만 두고 링크는 그대로 둔다.
import Link from 'next/link'

import type { TourListItem } from '../lib/catalog'
import { TourCard } from './TourCard'

export function RecommendedTours({ tours }: { tours: readonly TourListItem[] }) {
  return (
    <section aria-labelledby="recommended-heading" className="bg-(--surface-white)">
      <div className="mx-auto flex w-full max-w-(--content-max) flex-col px-(--page-x) py-(--section-y)">
        <h2
          id="recommended-heading"
          className="text-center text-(length:--text-h2) leading-(--leading-heading) font-semibold tracking-(--tracking-heading)"
        >
          추천 투어
        </h2>
        {tours.length === 0 ? (
          <p className="mt-(--space-6) text-center text-(--color-text-2)">지금은 공개된 투어가 없습니다.</p>
        ) : (
          <ul className="mt-(--space-12) grid gap-(--space-6) sm:grid-cols-2 lg:grid-cols-3">
            {tours.map((tour) => (
              <li key={tour.id}>
                <TourCard tour={tour} headingLevel="h3" />
              </li>
            ))}
          </ul>
        )}
        {/* 흰 면 위라 포인트 색을 쓴다(5.63:1). 테두리만 있는 알약(보조 버튼 모양) */}
        <Link
          href="/tours"
          className="mt-(--space-12) inline-flex min-h-(--button-height) items-center self-center rounded-(--radius-pill) border border-(--color-accent) px-(--space-8) font-semibold text-(--color-accent) transition-colors hover:border-(--color-accent-hover) hover:text-(--color-accent-hover)"
        >
          투어 전체 보기
        </Link>
      </div>
    </section>
  )
}
