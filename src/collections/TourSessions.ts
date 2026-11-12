import { APIError, type CollectionConfig, type DateFieldValidation, type NumberFieldSingleValidation } from 'payload'
import { date, number } from 'payload/shared'

import { adminOnly, tourSessionsReadAccess } from '../lib/access'
import { isEndAfterStart, isPositiveInteger } from '../lib/validation'

// REQ-APPLY-004 / AC-APPLY-004가 고정 문자열로 확인하는 영문 안내(language.yaml error_messages: en)
export const SESSION_HAS_APPLICATIONS_MESSAGE =
  'Cannot delete a session that has applications. Applications must be kept for their retention period.'

// siblingData는 수정 시 기존 문서 값과 합쳐져 들어오므로, 종료 일시만 바꾸는 수정도 같은 규칙으로 막힌다
const validateEndsAt: DateFieldValidation = (value, args) => {
  const base = date(value, args)
  if (base !== true) return base
  const startsAt = (args.siblingData as { startsAt?: unknown } | undefined)?.startsAt
  return isEndAfterStart(startsAt, value) ? true : 'End time must be after start time.'
}

const validateCapacity: NumberFieldSingleValidation = (value, args) => {
  const base = number(value, args)
  if (base !== true) return base
  return isPositiveInteger(value) ? true : 'Capacity must be a whole number (1 or more).'
}

// 관리자 화면 일시 입력은 브라우저 시간대와 관계없이 서울 기준으로 해석한다(REQ-TOUR-003, plan.md §B.7).
// 저장은 UTC. Payload가 시간대 보조 열(<필드>_tz)을 함께 둔다.
const seoulTimezone = {
  defaultTimezone: 'Asia/Seoul',
  supportedTimezones: [{ label: '서울', value: 'Asia/Seoul' }],
}

// 회차 컬렉션(REQ-TOUR-003). 남은 자리·선택 가능 여부는 저장하지 않고 src/lib/의 계산 지점에서 구한다(M2).
export const TourSessions: CollectionConfig = {
  slug: 'tour-sessions',
  admin: {
    defaultColumns: ['tour', 'startsAt', 'capacity', 'status'],
  },
  access: {
    read: tourSessionsReadAccess,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  hooks: {
    // @MX:NOTE: [AUTO] 가정 A6·A7(SPEC-APPLY-001) — 신청이 연결된 회차는 관리자도 지울 수 없다. 회차가 사라지면
    // 신청의 보관 기준일(회차 종료 일시)과 정원 기록이 사라진다. 정리는 신청 → 회차 → 투어 순서(plan.md §B.9)
    beforeDelete: [
      async ({ id, req }) => {
        const applications = await req.payload.count({
          collection: 'applications',
          where: { session: { equals: id } },
          req,
        })
        if (applications.totalDocs > 0) {
          throw new APIError(SESSION_HAS_APPLICATIONS_MESSAGE, 400, undefined, true)
        }
      },
    ],
  },
  fields: [
    { name: 'tour', label: '투어', type: 'relationship', relationTo: 'tours', required: true, index: true },
    {
      name: 'startsAt',
      label: '시작 일시',
      type: 'date',
      required: true,
      timezone: seoulTimezone,
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'endsAt',
      label: '종료 일시',
      type: 'date',
      required: true,
      timezone: seoulTimezone,
      admin: { date: { pickerAppearance: 'dayAndTime' } },
      validate: validateEndsAt,
    },
    {
      name: 'capacity',
      label: '정원',
      type: 'number',
      required: true,
      min: 1,
      validate: validateCapacity,
    },
    {
      name: 'status',
      label: '상태',
      type: 'select',
      required: true,
      defaultValue: 'open',
      options: [
        { label: '모집 중', value: 'open' },
        { label: '마감', value: 'closed' },
      ],
    },
  ],
}
