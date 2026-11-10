// 사용자 화면 표기 도우미 — SPEC-TOUR-001 REQ-TOUR-008, plan.md §B.7·§B.8.
// 일시는 서버(프로세스) 시간대와 관계없이 항상 서울 기준 한국어로 표기한다.

// @MX:NOTE: [AUTO] timeZone을 빼면 서버 시간대를 따라가 표기가 바뀐다. 이 PC는 서울이라 결함이 숨으므로 format-timezone.spec.ts가 뉴욕 시간대에서 검증한다
export const DISPLAY_TIME_ZONE = 'Asia/Seoul'

const sessionDateTime = new Intl.DateTimeFormat('ko-KR', {
  timeZone: DISPLAY_TIME_ZONE,
  month: 'long',
  day: 'numeric',
  weekday: 'short',
  hour: 'numeric',
  minute: '2-digit',
})

/** 회차 일시 표기. 예: 2026-11-20T00:00:00Z → "11월 20일 (금) 오전 9:00" */
export function formatSessionDateTime(value: string | Date): string {
  return sessionDateTime.format(new Date(value))
}

/** 분 단위 소요 시간 → "N시간 M분"(분이 0이면 "N시간", 60분 미만이면 "M분"). */
export function formatDuration(minutes: number): string {
  if (!Number.isInteger(minutes) || minutes < 0) {
    throw new RangeError(`durationMinutes must be a non-negative integer, received ${minutes}`)
  }
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}분`
  return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`
}

/** 남은 자리 표기. 예: (4, 15) → "남은 자리 4 / 15" */
export function formatSeats(remainingSeats: number, capacity: number): string {
  return `남은 자리 ${remainingSeats} / ${capacity}`
}
