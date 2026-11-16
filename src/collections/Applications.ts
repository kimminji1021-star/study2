import type {
  CollectionConfig,
  EmailFieldValidation,
  NumberFieldSingleValidation,
  TextareaFieldValidation,
  TextFieldSingleValidation,
} from 'payload'
import { email, number, text, textarea } from 'payload/shared'

import { adminOnly, adminSingleDocOnly, denyAll, lockedField } from '../lib/access'
import { checkEmail, checkName, checkPhone, checkRequests, isValidPartySize } from '../lib/application-input'
import { lockApplicationForUpdate, markStatusRequest, recordStatusChange } from '../lib/application-status'
import { clearRequestsEndpoint } from '../lib/clear-requests'
import { isValidReferenceCode } from '../lib/reference-code'

// Payload 기본 검증(필수 값 등)을 먼저 거친 뒤 서버 제출 경로와 같은 입력 규칙을 덧붙인다(plan.md §B.6).
// 안내 문구는 영문 고정(language.yaml error_messages: en)이며 입력값을 담지 않는다(REQ-APPLY-015)
const validateName: TextFieldSingleValidation = (value, args) => {
  const base = text(value, args)
  if (base !== true) return base
  return checkName(value) === null ? true : 'Name must be 1 to 50 characters without control characters.'
}

const validateEmail: EmailFieldValidation = (value, args) => {
  const base = email(value, args)
  if (base !== true) return base
  return checkEmail(value) === null ? true : 'Enter a valid email address of 254 characters or fewer.'
}

const validatePhone: TextFieldSingleValidation = (value, args) => {
  const base = text(value, args)
  if (base !== true) return base
  return checkPhone(value) === null ? true : 'Enter a phone number with 8 to 15 digits.'
}

const validatePartySize: NumberFieldSingleValidation = (value, args) => {
  const base = number(value, args)
  if (base !== true) return base
  return isValidPartySize(value) ? true : 'Party size must be a whole number from 1 to 10.'
}

const validateReferenceCode: TextFieldSingleValidation = (value, args) => {
  const base = text(value, args)
  if (base !== true) return base
  return isValidReferenceCode(value) ? true : 'Reference code must match SB-XXXXX-XXXXX (Crockford Base32).'
}

const validateRequests: TextareaFieldValidation = (value, args) => {
  const base = textarea(value, args)
  if (base !== true) return base
  return checkRequests(value) === null ? true : 'Requests must be 500 characters or fewer.'
}

// 신청 상태 선택지. 작업 기록의 이전·이후 상태도 같은 목록을 쓴다
export const APPLICATION_STATUS_OPTIONS = [
  { label: '대기', value: 'pending' },
  { label: '확정', value: 'confirmed' },
  { label: '취소', value: 'cancelled' },
]

// 신청 컬렉션(REQ-APPLY-001). 점유 인원은 저장하지 않고 대기·확정 신청 인원의 합계로 구한다(plan.md §B.2).
// @MX:NOTE: [AUTO] REQ-APPLY-003 + SPEC-ADMIN-001 REQ-ADMIN-002 — 생성·삭제는 관리자를 포함해 모두 거부한다. 수정은 관리자가
// 신청 한 건을 ID로 지정할 때만 받고, status 외 모든 필드는 수정 거부(lockedField)라 바뀌지 않는다. 일괄 수정은 관리자도 403.
// 신청은 서버 제출 경로가 로컬 API를 overrideAccess: true로 부르는 방법으로만 만들어진다("새로 만들기" 없음).
// 새 필드를 더할 때는 lockedField를 붙인다(저장소 규칙 테스트가 status 외 잠기지 않은 필드를 잡는다)
export const Applications: CollectionConfig = {
  slug: 'applications',
  admin: {
    useAsTitle: 'referenceCode',
    defaultColumns: ['referenceCode', 'session', 'partySize', 'status', 'createdAt'],
  },
  // 일괄 수정은 관리자 화면과 API 모두에서 403(plan.md §A.2 — overrideAccess: true인 서버 코드에는 걸리지 않음, R5)
  disableBulkEdit: true,
  access: {
    read: adminOnly,
    create: denyAll,
    update: adminSingleDocOnly,
    delete: denyAll,
  },
  // 모든 신청 수정의 보호 구간(SPEC-ADMIN-001 plan.md §B.2): 원본 입력으로 상태 변경 요청을 가리고(beforeOperation),
  // 회차 행 → 신청 행 순서로 잠근 뒤 판단·저장하며(beforeChange), 같은 트랜잭션으로 작업 기록을 남긴다(afterChange)
  hooks: {
    beforeOperation: [markStatusRequest],
    beforeChange: [lockApplicationForUpdate],
    afterChange: [recordStatusChange],
  },
  // 요청 사항 삭제(REQ-ADMIN-008): POST /api/applications/:id/clear-requests — 관리자 확인·트랜잭션은 처리 함수가 직접 한다
  endpoints: [clearRequestsEndpoint],
  fields: [
    {
      name: 'session',
      label: '회차',
      type: 'relationship',
      relationTo: 'tour-sessions',
      required: true,
      index: true,
      access: lockedField,
    },
    { name: 'name', label: '이름', type: 'text', required: true, validate: validateName, access: lockedField },
    { name: 'email', label: '이메일', type: 'email', required: true, validate: validateEmail, access: lockedField },
    { name: 'phone', label: '연락처', type: 'text', required: true, validate: validatePhone, access: lockedField },
    {
      name: 'partySize',
      label: '인원',
      type: 'number',
      required: true,
      min: 1,
      max: 10,
      validate: validatePartySize,
      access: lockedField,
    },
    { name: 'requests', label: '요청 사항', type: 'textarea', validate: validateRequests, access: lockedField },
    // 요청 사항 바로 아래의 "요청 사항 삭제" 버튼(plan.md §B.4). 값을 저장하지 않는 화면 전용 필드라 수정 잠금 대상이 아니다
    {
      name: 'clearRequests',
      type: 'ui',
      admin: {
        components: { Field: '/components/admin/ClearRequestsField#ClearRequestsField' },
        disableListColumn: true,
      },
    },
    // 요청 사항 삭제 일시(SPEC-ADMIN-001 REQ-ADMIN-008). 관리자 전용 삭제 동작만 서버 코드로 채운다
    { name: 'requestsDeletedAt', label: '요청 사항 삭제 일시', type: 'date', access: lockedField },
    // 관리자가 바꿀 수 있는 유일한 필드(REQ-ADMIN-002)
    {
      name: 'status',
      label: '상태',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: APPLICATION_STATUS_OPTIONS,
    },
    // 공개 식별자(접수 완료 화면 경로). DB 순번 ID와 무관한 무작위 값이며 모든 신청에서 고유하다(REQ-APPLY-011)
    {
      name: 'referenceCode',
      label: '접수 번호',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      validate: validateReferenceCode,
      access: lockedField,
    },
    // 동의 기록(REQ-APPLY-014). 보관 기준일은 cancelledAt ?? 회차 종료 일시(가정 A6) — 파기 작업은 범위 밖
    { name: 'privacyConsentAt', label: '필수 동의 일시', type: 'date', required: true, access: lockedField },
    { name: 'privacyPolicyVersion', label: '동의 문구 버전', type: 'text', required: true, access: lockedField },
    { name: 'requestsConsentAt', label: '요청 사항 선택 동의 일시', type: 'date', access: lockedField },
    // 만 14세 이상 확인 일시(2026-11-12 출시 전 보완). 서버 제출 경로는 항상 채우지만, 이 필드가 생기기 전의 신청이
    // 계속 유효하도록 DB 수준 필수로 두지 않는다
    { name: 'ageConfirmedAt', label: '만 14세 이상 확인 일시', type: 'date', access: lockedField },
    // 취소일. 상태 변경 처리(lib/application-status.ts)가 서버 쪽에서 채우고 비운다(plan.md §B.3)
    { name: 'cancelledAt', label: '취소일', type: 'date', access: lockedField },
  ],
}
