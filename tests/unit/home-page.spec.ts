// SPEC-LANDING-001 M1 — 홈 화면 데이터의 순수 함수(DB 없음).
// AC-LANDING-004(단위): 큰 제목·소개 문구 결정과 기본 문구. AC-LANDING-007(단위): 추천 투어 자르기.
// AC-LANDING-005 (d): 채워지지 않은 대표 사진(ID 숫자)이나 url 없는 문서는 이미지가 아니다.
import { describe, expect, it } from 'vitest'

import { toImage, type TourListItem } from '../../src/lib/catalog'
import { HOME_DEFAULTS, pickRecommendedTours, RECOMMENDED_TOUR_LIMIT, resolveHeroText } from '../../src/lib/home-page'

describe('AC-LANDING-004 문구 결정 함수', () => {
  it('기본 문구가 정확히 정해진 값이다', () => {
    expect(HOME_DEFAULTS.headline).toBe('제주를 가장 가까이, 숨비투어')
    expect(HOME_DEFAULTS.intro).toBe('제주의 소규모 투어와 다가오는 회차를 한눈에 확인하세요.')
  })

  it.each([undefined, null, '', '   '])('값이 %j이면 기본 문구를 돌려준다', (value) => {
    expect(resolveHeroText(value, HOME_DEFAULTS.headline)).toBe(HOME_DEFAULTS.headline)
    expect(resolveHeroText(value, HOME_DEFAULTS.intro)).toBe(HOME_DEFAULTS.intro)
  })

  it('앞뒤 공백을 뺀 값을 돌려준다', () => {
    expect(resolveHeroText('  값  ', HOME_DEFAULTS.headline)).toBe('값')
  })

  it('HTML처럼 보이는 문자열도 해석하지 않고 그대로 돌려준다', () => {
    expect(resolveHeroText('<b>굵게</b>', HOME_DEFAULTS.headline)).toBe('<b>굵게</b>')
  })
})

function fakeTours(count: number): TourListItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    slug: `tour-${index + 1}`,
    title: `투어 ${index + 1}`,
    summary: '',
    durationMinutes: 60,
    priceNote: '',
    heroImage: null,
    nearestSession: null,
  }))
}

describe('AC-LANDING-007 추천 투어 자르기', () => {
  it('추천 개수 상한은 6이다', () => {
    expect(RECOMMENDED_TOUR_LIMIT).toBe(6)
  })

  it.each([
    [0, 0],
    [3, 3],
    [6, 6],
    [8, 6],
  ])('입력 %i개 → 출력 %i개, 입력의 앞부분과 순서가 같고 입력 배열은 바뀌지 않는다', (input, output) => {
    const tours = fakeTours(input)
    const snapshot = tours.map((tour) => tour.id)

    const picked = pickRecommendedTours(tours)

    expect(picked).toHaveLength(output)
    expect(picked.map((tour) => tour.id)).toEqual(snapshot.slice(0, output))
    expect(tours.map((tour) => tour.id)).toEqual(snapshot)
    expect(tours).toHaveLength(input)
  })
})

describe('AC-LANDING-005 (d) 대표 사진 변환', () => {
  it('채워지지 않은 ID(숫자)·null·undefined는 null이다', () => {
    expect(toImage(42)).toBeNull()
    expect(toImage(null)).toBeNull()
    expect(toImage(undefined)).toBeNull()
  })

  it('url이 없는 문서는 null이다', () => {
    expect(toImage({ id: 1, alt: '사진', url: null, updatedAt: '', createdAt: '' } as never)).toBeNull()
  })

  it('url이 있는 문서는 주소·대체 텍스트·크기를 담은 이미지다', () => {
    expect(
      toImage({ id: 1, alt: '사진', url: '/api/media/file/a.png', width: 2, height: 1, updatedAt: '', createdAt: '' }),
    ).toEqual({ url: '/api/media/file/a.png', alt: '사진', width: 2, height: 1 })
  })
})
