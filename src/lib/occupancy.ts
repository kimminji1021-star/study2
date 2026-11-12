// 점유 인원 — SPEC-APPLY-001 REQ-APPLY-005, plan.md §B.2.
// 정의: 한 회차에 속한 대기·확정 신청 인원의 합계. 취소 신청은 세지 않는다. 저장하지 않고 매번 합계로 구한다.
// 화면 표시(조회 계층)와 서버 제출 경로의 정원 판단이 모두 이 모듈만 쓴다. 상태 목록을 다른 곳에 다시 쓰지 않는다.
import { sql } from '@payloadcms/db-postgres'
import type { Payload, PayloadRequest } from 'payload'

import { poolDb, transactionDb, type SqlExecutor } from './transaction-db'

export const OCCUPYING_STATUSES = ['pending', 'confirmed'] as const

// 회차 ID 목록의 점유 인원을 GROUP BY 질의 1회로 센다. party_size는 numeric이라 pg가 문자열로 돌려준다
async function sumBySession(db: SqlExecutor, sessionIds: readonly number[]): Promise<Map<number, number>> {
  const seats = new Map<number, number>(sessionIds.map((id) => [id, 0]))
  if (sessionIds.length === 0) return seats

  const { rows } = await db.execute(sql`
    SELECT session_id, COALESCE(SUM(party_size), 0) AS occupied
    FROM applications
    WHERE session_id IN (${sql.join(
      sessionIds.map((id) => sql`${id}`),
      sql`, `,
    )})
      AND status IN (${sql.join(
        OCCUPYING_STATUSES.map((status) => sql`${status}`),
        sql`, `,
      )})
    GROUP BY session_id
  `)
  for (const row of rows) {
    const occupied = Number(row.occupied)
    if (!Number.isFinite(occupied)) throw new Error('Occupied seat sum is not a number.')
    seats.set(Number(row.session_id), occupied)
  }
  return seats
}

// @MX:ANCHOR: [AUTO] 점유 인원 정의의 단일 지점 — 화면용인 이 함수(목록·상세·신청 화면이 catalog.ts toSessions로 호출)와
//   정원 확인 구간용 getOccupiedSeatsInTransaction(submit-application.ts)이 같은 sumBySession·OCCUPYING_STATUSES를 쓴다
// @MX:REASON: REQ-APPLY-005가 정의를 한 곳에 못박는다. 화면과 신청 처리가 다르게 세면 "남은 자리"와 실제 접수가 어긋난다
// @MX:NOTE: [AUTO] 신청 문서를 돌려주지 않고 합계 숫자만 읽으므로, 문서 조회는 익명 권한(ANONYMOUS_READ)이라는
//   조회 계층 원칙의 예외로 둔다(plan.md §B.2). 이 함수로 신청 내용을 읽는 코드를 만들지 않는다
/** 회차 ID → 점유 인원. 신청이 없는 회차는 0. 트랜잭션 밖(연결 풀)에서 질의 1회. */
export function getOccupiedSeatsBySession(
  payload: Payload,
  sessionIds: readonly number[],
): Promise<Map<number, number>> {
  return sumBySession(poolDb(payload), sessionIds)
}

/** 정원 확인 구간용: 같은 트랜잭션 연결로 회차 하나의 점유 인원을 읽는다(잠금을 얻은 뒤의 별도 문장, plan.md §B.1 3번). */
export async function getOccupiedSeatsInTransaction(
  payload: Payload,
  transactionID: PayloadRequest['transactionID'],
  sessionId: number,
): Promise<number> {
  const seats = await sumBySession(transactionDb(payload, transactionID), [sessionId])
  return seats.get(sessionId) ?? 0
}
