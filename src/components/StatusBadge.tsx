// 상태 배지 — 색 + 아이콘 + 글자(디자인 핸드오프 §2·§3: 상태를 색만으로 구분하지 않는다).
// 문구와 색 구분(tone)은 src/lib/status-badge.ts가 정한다. 이 컴포넌트는 그리기만 한다.
import type { StatusBadge as StatusBadgeValue, StatusTone } from '../lib/status-badge'

const TONE_CLASS: Record<StatusTone, string> = {
  open: 'bg-(--status-open-bg) text-(--status-open-fg)',
  closed: 'bg-(--status-closed-bg) text-(--status-closed-fg)',
}

// 모집 중 = 체크 표시, 마감 = 가로줄. 장식용이라 보조 기술에는 숨기고 글자로 상태를 전한다
const TONE_ICON_PATH: Record<StatusTone, string> = {
  open: 'M3.5 8.5l3 3 6-7',
  closed: 'M4 8h8',
}

export function StatusBadge({ badge }: { badge: StatusBadgeValue }) {
  return (
    <span
      data-status-badge={badge.tone}
      className={`inline-flex w-fit shrink-0 items-center gap-1 rounded-(--radius-pill) px-2.5 py-1 text-(length:--text-caption) leading-none font-semibold whitespace-nowrap ${TONE_CLASS[badge.tone]}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="size-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={TONE_ICON_PATH[badge.tone]} />
      </svg>
      {badge.label}
    </span>
  )
}
