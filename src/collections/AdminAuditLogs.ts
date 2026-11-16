import type { CollectionConfig } from 'payload'

import { adminOnly, denyAll, lockedField } from '../lib/access'
import { ADMIN_AUDIT_ACTIONS } from '../lib/admin-audit'
import { APPLICATION_STATUS_OPTIONS } from './Applications'

// 관리자 작업 기록(SPEC-ADMIN-001 REQ-ADMIN-013·014, plan.md §B.7).
// 모든 필드에 수정 거부(lockedField)를 붙여 관리자 화면에서도 편집할 수 없게 그린다. 쓰기는 서버 코드의 recordAdminAction만 한다.
// @MX:NOTE: [AUTO] 덧붙이기 전용 — 생성·수정·삭제는 관리자를 포함해 모두 거부하고 읽기는 관리자만 한다.
// 신청자 개인정보 필드(이름·이메일·연락처·요청 사항)를 두지 않는다. 관리자·신청·회차는 관계 필드가 아니라 숫자 ID로 담아
// 관리자 계정이나 회차를 지워도 기록이 남게 한다. 보관 기간 2년과 자동 삭제는 출시 전 점검 항목(plan.md §G R20)
export const AdminAuditLogs: CollectionConfig = {
  slug: 'admin-audit-logs',
  labels: { singular: '작업 기록', plural: '작업 기록' },
  defaultSort: '-occurredAt',
  disableBulkEdit: true,
  admin: {
    defaultColumns: [
      'occurredAt',
      'action',
      'actorId',
      'referenceCode',
      'sessionId',
      'fromStatus',
      'toStatus',
      'rowCount',
    ],
  },
  access: {
    read: adminOnly,
    create: denyAll,
    update: denyAll,
    delete: denyAll,
  },
  fields: [
    {
      name: 'action',
      label: '작업',
      type: 'select',
      required: true,
      options: ADMIN_AUDIT_ACTIONS.map(({ value, label }) => ({ value, label })),
      access: lockedField,
    },
    // 비어 있으면 관리자가 아닌 서버 경로(테스트·서버 코드의 로컬 API)의 변경이다
    { name: 'actorId', label: '관리자 ID', type: 'number', access: lockedField },
    { name: 'occurredAt', label: '처리 시각', type: 'date', required: true, index: true, access: lockedField },
    { name: 'applicationId', label: '신청 ID', type: 'number', access: lockedField },
    { name: 'referenceCode', label: '접수 번호', type: 'text', access: lockedField },
    // 테스트 정리와 고아 기록 검사(AC-ADMIN-016)가 회차 ID로 찾는다
    { name: 'sessionId', label: '회차 ID', type: 'number', index: true, access: lockedField },
    {
      name: 'fromStatus',
      label: '이전 상태',
      type: 'select',
      options: APPLICATION_STATUS_OPTIONS,
      access: lockedField,
    },
    { name: 'toStatus', label: '이후 상태', type: 'select', options: APPLICATION_STATUS_OPTIONS, access: lockedField },
    { name: 'rowCount', label: '내려받은 행 수', type: 'number', access: lockedField },
  ],
}
