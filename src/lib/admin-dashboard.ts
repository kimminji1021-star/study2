// 회차 현황 대시보드 데이터 — SPEC-ADMIN-001 REQ-ADMIN-011·012, plan.md §B.6.
// 관리자 첫 화면의 표(src/components/admin/SessionDashboard.tsx)가 이 함수의 결과만 그린다.
// 대기·확정 인원은 점유 인원 모듈(occupancy.ts), 남은 자리는 단일 계산 지점(getSessionAvailability)이 정한다.
// 관리자 전용 화면이므로 투어 공개 여부와 관계없이 다가오는 회차를 모두 담는다(호출자가 관리자 여부를 먼저 확인한다).
import type { Payload } from 'payload'

import { getSeatsByStatusBySession, type SeatsByStatus } from './occupancy'
import { getSessionAvailability, type SessionStatus } from './session-availability'

export type SessionDashboardRow = {
  sessionId: number
  tourTitle: string
  /** 투어 공개 여부. 거짓이면 표가 투어 이름 옆에 `비공개` 표시를 그린다 */
  tourPublished: boolean
  startsAt: string
  capacity: number
  pending: number
  confirmed: number
  remainingSeats: number
  status: SessionStatus
  /** 참가자 CSV 내려받기 경로(SPEC-ADMIN-001 M4 엔드포인트) */
  csvPath: string
}

// @MX:DEBT: [AUTO] 다가오는 회차를 행 수 제한 없이 한 번에 읽어 표 하나로 그린다(페이지 나누기·기간 필터 없음)
// @MX:CEILING: 다가오는 회차 수백 개 이하(관리자 1명·소규모 운영, plan.md §B.6·R11). 질의 수는 회차 수와 무관하게 3회로 고정
// @MX:UPGRADE: 다가오는 회차가 수백 개를 넘거나 첫 화면이 느려지면 페이지 나누기·기간 필터를 더한다
/**
 * 다가오는 회차(시작 일시 > now) 표의 행. 시작 일시 → ID 순.
 * 질의는 회차 1회 + 투어 1회 + 상태별 인원 1회로, 회차 수와 관계없이 모두 트랜잭션 밖 연결 풀로 나간다(REQ-ADMIN-012).
 */
export async function getSessionDashboard(payload: Payload, { now }: { now: Date }): Promise<SessionDashboardRow[]> {
  const sessions = await payload.find({
    collection: 'tour-sessions',
    where: { startsAt: { greater_than: now.toISOString() } },
    sort: ['startsAt', 'id'],
    depth: 0,
    pagination: false,
  })
  if (sessions.docs.length === 0) return []

  const tourIdOf = (tour: (typeof sessions.docs)[number]['tour']) => (typeof tour === 'number' ? tour : tour.id)
  const tours = await payload.find({
    collection: 'tours',
    where: { id: { in: [...new Set(sessions.docs.map((doc) => tourIdOf(doc.tour)))] } },
    select: { title: true, published: true },
    depth: 0,
    pagination: false,
  })
  const tourById = new Map(tours.docs.map((tour) => [tour.id, tour]))

  const seats = await getSeatsByStatusBySession(
    payload,
    sessions.docs.map((doc) => doc.id),
  )
  const apiRoute = payload.config.routes.api

  return sessions.docs.map((doc) => {
    const tour = tourById.get(tourIdOf(doc.tour))
    // 요청한 회차 ID마다 항목이 있다(신청이 없으면 모두 0) — 상태 목록을 이 파일에 다시 쓰지 않는다
    const { pending, confirmed, occupied } = seats.get(doc.id) as SeatsByStatus
    const { remainingSeats } = getSessionAvailability(doc, { now, occupiedSeats: occupied })
    return {
      sessionId: doc.id,
      tourTitle: tour?.title ?? '',
      tourPublished: tour?.published === true,
      startsAt: doc.startsAt,
      capacity: doc.capacity,
      pending,
      confirmed,
      remainingSeats,
      status: doc.status,
      csvPath: `${apiRoute}/tour-sessions/${doc.id}/participants-csv`,
    }
  })
}
