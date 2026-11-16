// 홈 화면 데이터 — SPEC-LANDING-001 REQ-LANDING-004·005·007·008, plan.md §B.3.
// 홈 화면(/)은 이 모듈만 거쳐 데이터를 읽는다. 추천 투어는 /tours와 같은 조회 계층(listPublishedTours)을 잘라 쓰므로
// 정렬·점유 인원·남은 자리 계산을 새로 쓰지 않는다(정렬 = SPEC-TOUR-001 REQ-TOUR-009).
import type { Payload } from 'payload'

import { HOME_SETTINGS_SLUG } from '../globals/HomeSettings'
import { listPublishedTours, toImage, type CatalogImage, type CatalogOptions, type TourListItem } from './catalog'

// 기본 문구는 필드 defaultValue가 아니라 여기서 적용한다. Payload는 "한 번도 저장하지 않은 전역 설정"에만
// defaultValue를 채우므로, 관리자가 칸을 비우고 저장한 경우를 덮으려면 코드에서 정해야 한다(plan.md §A.2·§B.3)
export const HOME_DEFAULTS = {
  headline: '제주를 가장 가까이, 숨비투어',
  intro: '제주의 소규모 투어와 다가오는 회차를 한눈에 확인하세요.',
} as const

export const RECOMMENDED_TOUR_LIMIT = 6

export type HomePageData = {
  headline: string
  intro: string
  /** 대표 사진이 없거나 채워지지 않았으면 null(→ 짙은 히어로) */
  heroImage: CatalogImage | null
  recommendedTours: TourListItem[]
}

/** 비었거나 공백뿐이면 기본 문구, 아니면 앞뒤 공백을 뺀 값. HTML은 해석하지 않고 문자열 그대로 둔다. */
export function resolveHeroText(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? fallback : trimmed
}

/** 입력 순서를 지킨 앞 6개. 입력 배열은 바꾸지 않는다. */
export function pickRecommendedTours(tours: readonly TourListItem[]): TourListItem[] {
  return tours.slice(0, RECOMMENDED_TOUR_LIMIT)
}

// @MX:DEBT: [AUTO] listPublishedTours는 공개 투어 전체를 읽고 홈은 그중 6개만 쓴다
// @MX:CEILING: 공개 투어 수백 개 이하
// @MX:UPGRADE: 투어가 늘어 홈이 느려지면 정렬 키를 DB 질의로 옮겨 6개만 읽는다
export async function getHomePageData(
  payload: Payload,
  { now = new Date() }: CatalogOptions = {},
): Promise<HomePageData> {
  // 익명 규칙으로 읽는다(로컬 API 기본값 overrideAccess: true를 쓰면 안 됨). 사용자·req를 넘기지 않는다.
  // depth 1로 대표 사진을 채울 때도 같은 overrideAccess 값이 넘어가 media 익명 읽기 규칙을 탄다
  const settings = await payload.findGlobal({ slug: HOME_SETTINGS_SLUG, depth: 1, overrideAccess: false })
  const tours = await listPublishedTours(payload, { now })

  return {
    headline: resolveHeroText(settings.headline, HOME_DEFAULTS.headline),
    intro: resolveHeroText(settings.intro, HOME_DEFAULTS.intro),
    heroImage: toImage(settings.heroImage),
    recommendedTours: pickRecommendedTours(tours),
  }
}
