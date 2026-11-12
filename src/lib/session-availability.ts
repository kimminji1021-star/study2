// 회차의 남은 자리·선택 가능 여부 계산 — SPEC-TOUR-001 REQ-TOUR-007, plan.md §B.4.
// 투어 목록(가장 가까운 회차·정렬)과 투어 상세(회차 목록)는 모두 이 함수의 결과만 쓴다. 화면 코드에서 따로 계산하지 않는다.

export type SessionStatus = 'open' | 'closed'

/** 선택 불가 사유: 마감(관리자가 닫음) / 지남(시작 시각 ≤ 현재) / 자리 없음(남은 자리 0). */
export type UnavailableReason = 'closed' | 'past' | 'full'

export type SessionAvailabilityInput = {
  capacity: number
  status: SessionStatus
  startsAt: string | Date
}

export type SessionAvailability = {
  capacity: number
  remainingSeats: number
  selectable: boolean
  /** 선택 가능하면 null. 사유가 여럿이면 마감 → 지남 → 자리 없음 순으로 하나만 */
  reason: UnavailableReason | null
}

/** 회차가 이미 시작했는지(시작 시각 ≤ 현재). 해석할 수 없는 시각은 시작한 것으로 본다(선택 불가 쪽으로 안전하게). */
export function hasStarted(startsAt: string | Date, now: Date): boolean {
  return !(new Date(startsAt).getTime() > now.getTime())
}

// @MX:ANCHOR: [AUTO] 남은 자리·선택 가능 여부의 단일 계산 지점 — 목록 조회·상세 조회·정렬(catalog-order)이 모두 이 결과를 쓴다
// @MX:REASON: REQ-TOUR-007이 계산 지점을 하나로 못박는다. 화면마다 따로 계산하면 목록과 상세의 "남은 자리"가 어긋난다
// @MX:NOTE: [AUTO] 신청 SPEC(SPEC-APPLY-001)에서 확장 완료 — 조회 계층(catalog.ts)과 신청 처리(submit-application.ts)가
//   점유 인원 모듈(occupancy.ts)의 합계를 occupiedSeats로 넘긴다. 이 함수의 규칙(남은 자리 = 정원 − 점유, 0 미만이면 0)은 그대로다
export function getSessionAvailability(
  session: SessionAvailabilityInput,
  { now, occupiedSeats = 0 }: { now: Date; occupiedSeats?: number },
): SessionAvailability {
  const remainingSeats = Math.max(0, session.capacity - occupiedSeats)

  let reason: UnavailableReason | null = null
  if (session.status !== 'open') reason = 'closed'
  else if (hasStarted(session.startsAt, now)) reason = 'past'
  else if (remainingSeats < 1) reason = 'full'

  return { capacity: session.capacity, remainingSeats, selectable: reason === null, reason }
}
