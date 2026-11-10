// 카탈로그 선택·정렬 규칙 — SPEC-TOUR-001 REQ-TOUR-009·010, plan.md §B.8.
// 선택 가능 여부는 session-availability의 결과(availability)만 보고 판단한다.
import { hasStarted, type SessionAvailability } from './session-availability'

type Timed = { startsAt: string | Date }

const startTime = (item: Timed) => new Date(item.startsAt).getTime()

/** 선택 가능한 회차 중 시작 시각이 가장 이른 것. 없으면 null. */
export function pickNearestSelectableSession<T extends Timed & { availability: SessionAvailability }>(
  sessions: readonly T[],
): T | null {
  let nearest: T | null = null
  for (const session of sessions) {
    if (!session.availability.selectable) continue
    if (nearest === null || startTime(session) < startTime(nearest)) nearest = session
  }
  return nearest
}

/**
 * 목록 정렬: 선택 가능한 회차가 있는 투어를 먼저(가장 가까운 회차의 시작 시각 오름차순, 같으면 제목 순),
 * 그다음 나머지 투어를 제목 순(한국어 정렬). 입력 배열은 바꾸지 않는다.
 */
export function sortToursForListing<T extends { title: string; nearestSession: Timed | null }>(
  tours: readonly T[],
): T[] {
  return [...tours].sort((a, b) => {
    if (a.nearestSession !== null && b.nearestSession !== null) {
      const byStart = startTime(a.nearestSession) - startTime(b.nearestSession)
      if (byStart !== 0) return byStart
    } else if (a.nearestSession !== null) {
      return -1
    } else if (b.nearestSession !== null) {
      return 1
    }
    return a.title.localeCompare(b.title, 'ko')
  })
}

/** 상세 회차 목록: 지난 회차(시작 시각 ≤ 현재)를 빼고 시작 시각 오름차순. 마감 회차는 남긴다. */
export function listUpcomingSessions<T extends Timed>(sessions: readonly T[], now: Date): T[] {
  return sessions.filter((session) => !hasStarted(session.startsAt, now)).sort((a, b) => startTime(a) - startTime(b))
}
