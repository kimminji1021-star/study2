// 카탈로그 컬렉션 입력 검증용 순수 도우미 — SPEC-TOUR-001 REQ-TOUR-001·002·003.
// 컬렉션 설정(src/collections/)이 Payload 기본 검증 뒤에 이 함수들을 덧붙여 쓴다.
// 화면 쪽 경로 판정(M4 404 처리)도 같은 slug 규칙을 써야 하므로 경로 파일 밖에 둔다.

// slug: 영문 소문자·숫자로 된 단어를 하이픈 하나로 잇는다(앞뒤 하이픈, 연속 하이픈 금지)
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// @MX:NOTE: [AUTO] 업로드 한도 5MB = 5 × 1024 × 1024바이트(REQ-TOUR-001). 정확히 5MB는 허용, 1바이트라도 넘으면 거부
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

export function isValidSlug(value: unknown): boolean {
  return typeof value === 'string' && SLUG_PATTERN.test(value)
}

/** 1 이상의 정수인지(소요 시간·정원). */
export function isPositiveInteger(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1
}

function toTime(value: unknown): number {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string' || typeof value === 'number') return new Date(value).getTime()
  return Number.NaN
}

/** 종료 일시가 시작 일시보다 뒤인지. 둘 중 하나라도 해석할 수 없으면 false. */
export function isEndAfterStart(start: unknown, end: unknown): boolean {
  const startTime = toTime(start)
  const endTime = toTime(end)
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) return false
  return endTime > startTime
}

export type UploadSize = { size?: number; data?: { length: number } }

/**
 * 업로드 파일이 5MB를 넘는지. 선언된 size와 실제 데이터 길이 중 큰 값으로 판정한다
 * (size가 작게 적혀 들어와도 우회되지 않게 — plan-audit review-3 O2).
 */
export function exceedsUploadLimit(file: UploadSize | null | undefined): boolean {
  if (file === null || file === undefined) return false
  const bytes = Math.max(file.size ?? 0, file.data?.length ?? 0)
  return bytes > MAX_UPLOAD_BYTES
}
