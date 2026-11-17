// 투어 카드 — 사진(4:3), 상태 배지, 제목, 요약, 소요 시간, 가격(현장 결제), 가장 가까운 회차와 남은 자리(디자인 핸드오프 §2).
// 카드 전체가 눌리도록 제목 링크의 클릭 영역을 카드 크기로 넓힌다(링크는 하나만 둔다).
import Link from 'next/link'

import type { TourListItem } from '../lib/catalog'
import { formatDuration, formatSeats, formatSessionDateTime } from '../lib/format'
import { tourStatusBadge } from '../lib/status-badge'
import { StatusBadge } from './StatusBadge'
import { TourImage } from './TourImage'

// 제목 단계는 놓이는 화면의 제목 구조에 맞춘다. /tours는 h2(기본값), 홈은 영역 제목 "추천 투어"(h2) 아래라 h3(SPEC-LANDING-001 plan.md §B.10)
export function TourCard({ tour, headingLevel = 'h2' }: { tour: TourListItem; headingLevel?: 'h2' | 'h3' }) {
  const { nearestSession } = tour
  const Heading = headingLevel

  return (
    // 카드는 그림자 없이 가는 테두리(--color-divider)와 큰 모서리(--radius-lg)로 구분한다(2026-11-16 디자인 방향 갱신)
    <article className="relative flex h-full flex-col overflow-hidden rounded-(--radius-lg) border border-(--color-divider) bg-(--color-bg) transition-colors hover:border-(--color-accent)">
      <TourImage image={tour.heroImage} />
      <div className="flex flex-1 flex-col gap-(--space-2) p-(--space-6)">
        <StatusBadge badge={tourStatusBadge({ hasSelectableSession: nearestSession !== null })} />
        <Heading className="text-(length:--text-h3) leading-(--leading-h3) font-semibold tracking-(--tracking-h3)">
          <Link href={`/tours/${tour.slug}`} className="after:absolute after:inset-0">
            {tour.title}
          </Link>
        </Heading>
        <p className="text-(--color-text-2)">{tour.summary}</p>
        <p className="text-(length:--text-small)">
          {formatDuration(tour.durationMinutes)} · {tour.priceNote}
        </p>
        {nearestSession !== null && (
          <p className="mt-auto text-(length:--text-small) font-medium text-(--color-accent)">
            가장 가까운 회차 {formatSessionDateTime(nearestSession.startsAt)} ·{' '}
            {formatSeats(nearestSession.availability.remainingSeats, nearestSession.availability.capacity)}
          </p>
        )}
      </div>
    </article>
  )
}
