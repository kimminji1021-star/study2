import type {
  CollectionConfig,
  EmailFieldValidation,
  NumberFieldSingleValidation,
  TextareaFieldValidation,
  TextFieldSingleValidation,
} from 'payload'
import { email, number, text, textarea } from 'payload/shared'

import { adminOnly, denyAll } from '../lib/access'
import { checkEmail, checkName, checkPhone, checkRequests, isValidPartySize } from '../lib/application-input'
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

// 신청 컬렉션(REQ-APPLY-001). 점유 인원은 저장하지 않고 대기·확정 신청 인원의 합계로 구한다(plan.md §B.2).
// @MX:NOTE: [AUTO] REQ-APPLY-003 — 생성·수정·삭제는 관리자를 포함해 모두 거부한다. 신청은 서버 제출 경로가
// 로컬 API를 overrideAccess: true로 부르는 방법으로만 만들어지고, 관리자 화면은 읽기 전용이 된다("새로 만들기" 없음).
// 상태 변경·취소는 로드맵 6번 SPEC이 이 규칙을 다시 정한다
export const Applications: CollectionConfig = {
  slug: 'applications',
  admin: {
    useAsTitle: 'referenceCode',
    defaultColumns: ['referenceCode', 'session', 'partySize', 'status', 'createdAt'],
  },
  access: {
    read: adminOnly,
    create: denyAll,
    update: denyAll,
    delete: denyAll,
  },
  fields: [
    {
      name: 'session',
      label: '회차',
      type: 'relationship',
      relationTo: 'tour-sessions',
      required: true,
      index: true,
    },
    { name: 'name', label: '이름', type: 'text', required: true, validate: validateName },
    { name: 'email', label: '이메일', type: 'email', required: true, validate: validateEmail },
    { name: 'phone', label: '연락처', type: 'text', required: true, validate: validatePhone },
    {
      name: 'partySize',
      label: '인원',
      type: 'number',
      required: true,
      min: 1,
      max: 10,
      validate: validatePartySize,
    },
    { name: 'requests', label: '요청 사항', type: 'textarea', validate: validateRequests },
    {
      name: 'status',
      label: '상태',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: [
        { label: '대기', value: 'pending' },
        { label: '확정', value: 'confirmed' },
        { label: '취소', value: 'cancelled' },
      ],
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
    },
    // 동의 기록(REQ-APPLY-014). 보관 기준일은 cancelledAt ?? 회차 종료 일시(가정 A6) — 파기 작업은 범위 밖
    { name: 'privacyConsentAt', label: '필수 동의 일시', type: 'date', required: true },
    { name: 'privacyPolicyVersion', label: '동의 문구 버전', type: 'text', required: true },
    { name: 'requestsConsentAt', label: '요청 사항 선택 동의 일시', type: 'date' },
    // 만 14세 이상 확인 일시(2026-11-12 출시 전 보완). 서버 제출 경로는 항상 채우지만, 이 필드가 생기기 전의 신청이
    // 계속 유효하도록 DB 수준 필수로 두지 않는다
    { name: 'ageConfirmedAt', label: '만 14세 이상 확인 일시', type: 'date' },
    { name: 'cancelledAt', label: '취소일', type: 'date' },
  ],
}
