// 홈 / — SPEC-LANDING-001 REQ-LANDING-004·005·007·015. 짙은 히어로 → 흰 추천 투어(→ 레이아웃의 연회색 바닥글).
// 요청마다 렌더링한다: 관리자가 홈 화면 설정을 바꾸거나 회차가 지나면 다음 요청에 바로 반영되어야 한다(AC-LANDING-015).
// 데이터는 홈 화면 데이터 모듈(src/lib/home-page.ts)만 거쳐 읽는다 — 그 모듈이 익명 접근 규칙(overrideAccess: false)을 강제한다.
import config from '@payload-config'
import { connection } from 'next/server'
import { getPayload } from 'payload'

import { HomeHero } from '../../components/HomeHero'
import { RecommendedTours } from '../../components/RecommendedTours'
import { getHomePageData } from '../../lib/home-page'

export default async function HomePage() {
  // 사전 렌더링을 여기서 멈춘다(빌드 결과의 prerender-manifest에 /가 없어야 한다)
  await connection()

  const payload = await getPayload({ config })
  const { headline, intro, heroImage, recommendedTours } = await getHomePageData(payload)

  return (
    <main className="w-full">
      <HomeHero headline={headline} intro={intro} image={heroImage} />
      <RecommendedTours tours={recommendedTours} />
    </main>
  )
}
