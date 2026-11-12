import type { CollectionConfig } from 'payload'

import { denyAll } from '../lib/access'

// 신청 시도 기록(REQ-APPLY-013, plan.md §B.5). 횟수 제한을 위해 서버 제출 경로가 시도마다 1행을 남긴다.
// 접속 IP 원문은 저장하지 않고 키 해시(HMAC-SHA256 16진수)와 시도 시각만 둔다.
// @MX:NOTE: [AUTO] REQ-APPLY-003 — 읽기·생성·수정·삭제 모두 거부, 관리자 화면 메뉴에서도 숨긴다.
// 기록·정리는 서버 제출 경로가 로컬 API(overrideAccess: true)로만 한다
export const ApplicationAttempts: CollectionConfig = {
  slug: 'application-attempts',
  admin: {
    hidden: true,
  },
  access: {
    read: denyAll,
    create: denyAll,
    update: denyAll,
    delete: denyAll,
  },
  fields: [
    { name: 'keyHash', label: '키 해시', type: 'text', required: true, index: true },
    // Payload 자동 createdAt이 아니라 신청 처리 함수가 받은 현재 시각으로 기록한다(테스트가 시간 창을 검증)
    { name: 'attemptedAt', label: '시도 시각', type: 'date', required: true, index: true },
  ],
}
