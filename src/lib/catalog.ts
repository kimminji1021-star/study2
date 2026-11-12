// 사용자 화면의 카탈로그 조회 계층 — SPEC-TOUR-001 REQ-TOUR-005·007·009·010, plan.md §B.5·M3.
// 화면(/tours, /tours/[slug])은 이 모듈만 거쳐 데이터를 읽는다. 남은 자리·선택 가능·정렬은 session-availability·catalog-order가 정한다.
import type { Payload, Where } from 'payload'

import type { Media, Tour, TourSession } from '../payload-types'
import { listUpcomingSessions, pickNearestSelectableSession, sortToursForListing } from './catalog-order'
import { getOccupiedSeatsBySession } from './occupancy'
import { getSessionAvailability, type SessionAvailability, type SessionStatus } from './session-availability'
import { isValidSlug } from './validation'

export type CatalogImage = { url: string; alt: string; width: number | null; height: number | null }

export type CatalogSession = {
  id: number
  startsAt: string
  endsAt: string
  status: SessionStatus
  capacity: number
  availability: SessionAvailability
}

export type TourListItem = {
  id: number
  slug: string
  title: string
  summary: string
  durationMinutes: number
  priceNote: string
  heroImage: CatalogImage | null
  /** 선택 가능한 회차 중 가장 이른 것. 없으면 null("모집 마감") */
  nearestSession: CatalogSession | null
}

export type TourDetail = Omit<TourListItem, 'nearestSession'> & {
  description: string
  meetingPoint: string
  /** 지난 회차를 뺀 예정 회차(시작 시각 순). 마감 회차는 선택 불가로 포함 */
  sessions: CatalogSession[]
}

export type CatalogOptions = { now?: Date }

// @MX:WARN: [AUTO] 로컬 API는 기본값이 overrideAccess: true라 그대로 부르면 공개되지 않은 투어·회차·이미지까지 읽힌다
// @MX:REASON: 이 계층의 모든 payload.find는 이 값을 펼쳐 넘기고 user·req를 넘기지 않는다(plan.md R1). 호출자는 접근 옵션을 넘길 수 없다
const ANONYMOUS_READ = { overrideAccess: false } as const

function toImage(heroImage: Tour['heroImage']): CatalogImage | null {
  // depth 1로 채운 문서만 이미지로 쓴다. 익명 읽기 규칙에 막힌 이미지는 ID(숫자)로만 남는다
  if (heroImage === null || heroImage === undefined || typeof heroImage === 'number') return null
  const media: Media = heroImage
  if (!media.url) return null
  return { url: media.url, alt: media.alt, width: media.width ?? null, height: media.height ?? null }
}

function toSession(doc: TourSession, now: Date, occupiedSeats: number): CatalogSession {
  const availability = getSessionAvailability(doc, { now, occupiedSeats })
  return {
    id: doc.id,
    startsAt: doc.startsAt,
    endsAt: doc.endsAt,
    status: doc.status,
    capacity: doc.capacity,
    availability,
  }
}

function toCard(tour: Tour) {
  return {
    id: tour.id,
    slug: tour.slug,
    title: tour.title,
    summary: tour.summary,
    durationMinutes: tour.durationMinutes,
    priceNote: tour.priceNote,
    heroImage: toImage(tour.heroImage),
  }
}

// DB에서는 아직 시작하지 않은 회차만 가져온다(지난 회차가 쌓여도 조회량이 늘지 않게).
// 최종 판정(지난 회차 제외·선택 가능)은 같은 기준(시작 시각 > 현재)으로 catalog-order·session-availability가 다시 한다
async function findUpcomingSessions(payload: Payload, tourFilter: Where, now: Date): Promise<TourSession[]> {
  const result = await payload.find({
    collection: 'tour-sessions',
    where: { and: [tourFilter, { startsAt: { greater_than: now.toISOString() } }] },
    depth: 0,
    pagination: false,
    sort: 'startsAt',
    ...ANONYMOUS_READ,
  })
  return result.docs
}

// @MX:NOTE: [AUTO] 신청 SPEC(SPEC-APPLY-001 M3)에서 확장 완료 — 조회한 회차 묶음의 점유 인원을 GROUP BY 질의 1회로 세어
//   단일 계산 지점(getSessionAvailability)에 넘긴다. 회차마다 따로 세지 않으므로 질의 수는 회차 수와 무관하다(REQ-APPLY-005)
async function toSessions(payload: Payload, docs: TourSession[], now: Date): Promise<CatalogSession[]> {
  const occupied = await getOccupiedSeatsBySession(
    payload,
    docs.map((doc) => doc.id),
  )
  return docs.map((doc) => toSession(doc, now, occupied.get(doc.id) ?? 0))
}

const tourIdOf = (session: TourSession) => (typeof session.tour === 'number' ? session.tour : session.tour.id)

/** 공개 투어 목록(카드용). 선택 가능한 회차가 있는 투어가 먼저 — REQ-TOUR-009. */
export async function listPublishedTours(
  payload: Payload,
  { now = new Date() }: CatalogOptions = {},
): Promise<TourListItem[]> {
  const tours = await payload.find({ collection: 'tours', depth: 1, pagination: false, ...ANONYMOUS_READ })
  if (tours.docs.length === 0) return []

  const docs = await findUpcomingSessions(payload, { tour: { in: tours.docs.map((tour) => tour.id) } }, now)
  const sessions = await toSessions(payload, docs, now)
  const sessionsByTour = new Map<number, CatalogSession[]>()
  docs.forEach((doc, index) => {
    const list = sessionsByTour.get(tourIdOf(doc)) ?? []
    list.push(sessions[index])
    sessionsByTour.set(tourIdOf(doc), list)
  })

  return sortToursForListing(
    tours.docs.map((tour) => ({
      ...toCard(tour),
      nearestSession: pickNearestSelectableSession(sessionsByTour.get(tour.id) ?? []),
    })),
  )
}

/** 공개 투어 상세. 없는 slug·공개되지 않은 투어·형식에 맞지 않는 slug는 null — REQ-TOUR-010·012. */
export async function getTourDetailBySlug(
  payload: Payload,
  slug: string,
  { now = new Date() }: CatalogOptions = {},
): Promise<TourDetail | null> {
  if (!isValidSlug(slug)) return null

  const result = await payload.find({
    collection: 'tours',
    where: { slug: { equals: slug } },
    depth: 1,
    limit: 1,
    pagination: false,
    ...ANONYMOUS_READ,
  })
  const tour = result.docs[0]
  if (tour === undefined) return null

  const sessions = await findUpcomingSessions(payload, { tour: { equals: tour.id } }, now)
  return {
    ...toCard(tour),
    description: tour.description,
    meetingPoint: tour.meetingPoint,
    sessions: listUpcomingSessions(await toSessions(payload, sessions, now), now),
  }
}
