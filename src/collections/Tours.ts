import {
  APIError,
  type CollectionConfig,
  type NumberFieldSingleValidation,
  type TextFieldSingleValidation,
} from 'payload'
import { number, text } from 'payload/shared'

import { adminOnly, toursReadAccess } from '../lib/access'
import { isPositiveInteger, isValidSlug } from '../lib/validation'

// REQ-TOUR-006 / AC-TOUR-007이 고정 문자열로 확인하는 영문 안내(language.yaml error_messages: en)
export const TOUR_HAS_SESSIONS_MESSAGE = 'Cannot delete a tour that has sessions. Delete its sessions first.'

// Payload 기본 검증(필수 값 등)을 먼저 거친 뒤 이 SPEC의 형식 규칙을 덧붙인다
const validateSlug: TextFieldSingleValidation = (value, args) => {
  const base = text(value, args)
  if (base !== true) return base
  return isValidSlug(value) ? true : 'Use lowercase letters and digits separated by single hyphens.'
}

const validateDuration: NumberFieldSingleValidation = (value, args) => {
  const base = number(value, args)
  if (base !== true) return base
  return isPositiveInteger(value) ? true : 'Duration must be a whole number of minutes (1 or more).'
}

// 투어 컬렉션(REQ-TOUR-002, plan.md §B.2). 다국어 대비: 텍스트 필드는 로드맵 7번에서 필드 단위
// localized로 바꿀 수 있게 각각 독립 필드로 두고, slug는 언어와 무관한 값, 소요 시간은 분 단위 숫자로 저장한다.
export const Tours: CollectionConfig = {
  slug: 'tours',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'published', 'updatedAt'],
  },
  access: {
    read: toursReadAccess,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  hooks: {
    // @MX:NOTE: [AUTO] 가정 A3 — 회차가 연결된 투어는 관리자도 지울 수 없다(신청 기록 5년 보관과 연쇄 삭제 방지). 숨기려면 공개를 끈다
    // 테스트·시드 정리는 반드시 회차 → 투어 → 미디어 순서로 지운다(plan.md R8)
    beforeDelete: [
      async ({ id, req }) => {
        const sessions = await req.payload.count({
          collection: 'tour-sessions',
          where: { tour: { equals: id } },
          req,
        })
        if (sessions.totalDocs > 0) {
          throw new APIError(TOUR_HAS_SESSIONS_MESSAGE, 400, undefined, true)
        }
      },
    ],
  },
  fields: [
    { name: 'title', label: '제목', type: 'text', required: true },
    {
      name: 'slug',
      label: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: '영문 소문자·숫자와 단어 사이 하이픈 하나 (예: hallasan-yeongsil)',
      },
      validate: validateSlug,
    },
    { name: 'summary', label: '요약', type: 'textarea', required: true },
    { name: 'description', label: '설명', type: 'textarea', required: true },
    { name: 'heroImage', label: '대표 이미지', type: 'upload', relationTo: 'media' },
    {
      name: 'durationMinutes',
      label: '소요 시간(분)',
      type: 'number',
      required: true,
      min: 1,
      validate: validateDuration,
    },
    { name: 'meetingPoint', label: '집결 장소', type: 'text', required: true },
    { name: 'priceNote', label: '가격 안내 문구', type: 'text', required: true },
    {
      name: 'published',
      label: '공개',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
  ],
}
