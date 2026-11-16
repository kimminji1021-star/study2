// 관리자 작업 기록 함수(SPEC-ADMIN-001 REQ-ADMIN-013·014, plan.md §B.7).
// 상태 변경·요청 사항 삭제는 작업과 같은 req(같은 트랜잭션)로 기록해, 기록이 실패하면 작업도 함께 되돌려진다.
import type { PayloadRequest } from 'payload'

import { isAdmin } from './access'

// 작업 종류. 값은 저장·API용 영문 식별자, 라벨은 관리자 화면 표시용
export const ADMIN_AUDIT_ACTIONS = [
  { value: 'application.status_change', label: '신청 상태 변경' },
  { value: 'application.requests_delete', label: '요청 사항 삭제' },
  { value: 'session.participants_csv', label: '참가자 CSV 내려받기' },
] as const

export type AdminAuditAction = (typeof ADMIN_AUDIT_ACTIONS)[number]['value']

type ApplicationStatus = 'pending' | 'confirmed' | 'cancelled'

// @MX:NOTE: [AUTO] 입력 타입에 신청자 개인정보 필드(이름·이메일·연락처·요청 사항)를 두지 않아 실수로 넣을 수 없게 한다(REQ-ADMIN-015).
// 저장할 때도 아래 필드만 골라 옮기므로, 다른 속성을 가진 객체를 넘겨도 그 값은 기록되지 않는다
export type AdminAuditEntry = {
  action: AdminAuditAction
  sessionId: number
  applicationId?: number
  referenceCode?: string
  fromStatus?: ApplicationStatus
  toStatus?: ApplicationStatus
  rowCount?: number
}

// @MX:ANCHOR: [AUTO] 관리자 작업 기록의 단일 저장 지점 — 상태 변경(application-status.ts), 요청 사항 삭제(clear-requests.ts),
// 참가자 CSV(participants-csv-endpoint.ts)가 모두 이 함수로 기록한다
// @MX:REASON: 개인정보 없는 필드만 옮기는 규칙(REQ-ADMIN-015)과 관리자 ID 판정이 여기 한곳에 있어야 경로마다 어긋나지 않는다
/**
 * 작업 기록 1건을 남긴다. 접근 규칙(생성 거부)을 건너뛰어(overrideAccess: true) 받은 req로 저장하므로
 * 호출한 작업과 같은 트랜잭션에 묶인다. 관리자 ID는 req의 사용자가 관리자일 때만 채우고, 아니면 비운다.
 */
export async function recordAdminAction(req: PayloadRequest, entry: AdminAuditEntry) {
  const actorId = req.user !== null && req.user !== undefined && isAdmin(req.user) ? req.user.id : null
  return req.payload.create({
    collection: 'admin-audit-logs',
    data: {
      action: entry.action,
      actorId,
      occurredAt: new Date().toISOString(),
      sessionId: entry.sessionId,
      applicationId: entry.applicationId ?? null,
      referenceCode: entry.referenceCode ?? null,
      fromStatus: entry.fromStatus ?? null,
      toStatus: entry.toStatus ?? null,
      rowCount: entry.rowCount ?? null,
    },
    req,
    overrideAccess: true,
  })
}
