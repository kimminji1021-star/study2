// 상태 배지 문구와 색 구분 — SPEC-TOUR-001 REQ-TOUR-009·010·014, plan.md §B.8.
// 화면은 배지 문구를 직접 정하지 않고 이 결과만 쓴다. 선택 가능 여부·사유 판정은 session-availability가 이미 끝냈다.
import type { SessionAvailability, UnavailableReason } from './session-availability'

export type StatusTone = 'open' | 'closed'

/** 색(tone)과 글자(label). 화면은 여기에 아이콘을 더해 색만으로 상태를 구분하지 않는다(디자인 핸드오프 §3). */
export type StatusBadge = { tone: StatusTone; label: string }

const OPEN: StatusBadge = { tone: 'open', label: '모집 중' }

/** 투어 카드 배지: 선택 가능한 회차가 있으면 "모집 중", 없으면 "모집 마감". */
export function tourStatusBadge({ hasSelectableSession }: { hasSelectableSession: boolean }): StatusBadge {
  return hasSelectableSession ? OPEN : { tone: 'closed', label: '모집 마감' }
}

const UNAVAILABLE_LABELS: Record<UnavailableReason, string> = {
  closed: '마감',
  full: '자리 없음',
  past: '지난 회차',
}

/** 회차 배지: 선택 가능하면 "모집 중", 아니면 선택 불가 사유에 맞는 문구. */
export function sessionStatusBadge(availability: SessionAvailability): StatusBadge {
  if (availability.reason === null) return OPEN
  return { tone: 'closed', label: UNAVAILABLE_LABELS[availability.reason] }
}
