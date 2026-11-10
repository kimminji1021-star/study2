// 투어 카드 — 사진(4:3), 상태 배지, 제목, 요약, 소요 시간, 가격(현장 결제), 가장 가까운 회차와 남은 자리(디자인 핸드오프 §2).
// 카드 전체가 눌리도록 제목 링크의 클릭 영역을 카드 크기로 넓힌다(링크는 하나만 둔다).
import Link from 'next/link'

import type { TourListItem } from '../lib/catalog'
import { formatDuration, formatSeats, formatSessionDateTime } from '../lib/format'
import { tourStatusBadge } from '../lib/status-badge'
import { StatusBadge } from './StatusBadge'
import { TourImage } from './TourImage'

export function TourCard({ tour }: { tour: TourListItem }) {
  const { nearestSession } = tour

  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-(--radius-md) border border-(--color-divider) bg-(--color-bg) shadow-(--shadow-sm) transition-colors hover:border-(--color-accent)">
      <TourImage image={tour.heroImage} />
      <div className="flex flex-1 flex-col gap-2 p-(--space-4)">
        <StatusBadge badge={tourStatusBadge({ hasSelectableSession: nearestSession !== null })} />
        <h2 className="text-(length:--text-h3) leading-snug font-bold">
          <Link href={`/tours/${tour.slug}`} className="after:absolute after:inset-0">
            {tour.title}
          </Link>
        </h2>
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
