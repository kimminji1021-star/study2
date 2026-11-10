// 투어 목록 /tours — SPEC-TOUR-001 REQ-TOUR-009·012, AC-TOUR-010·013.
// 요청마다 렌더링한다: 관리자 수정과 시간 경과(회차가 지난 회차가 됨)가 다음 요청에 바로 반영되어야 한다(plan.md §B.3).
// 데이터는 조회 계층(src/lib/catalog.ts)만 거쳐 읽는다 — 그 계층이 익명 접근 규칙(overrideAccess: false)을 강제한다.
import config from '@payload-config'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getPayload } from 'payload'

import { TourCard } from '../../../components/TourCard'
import { listPublishedTours } from '../../../lib/catalog'

export const metadata: Metadata = {
  title: '투어 목록 · 숨비투어',
  description: '제주의 소규모 투어와 다가오는 회차를 확인하세요.',
}

export default async function ToursPage() {
  // 사전 렌더링을 여기서 멈춘다(빌드 결과의 prerender-manifest에 /tours가 없어야 한다 — AC-TOUR-013)
  await connection()

  const payload = await getPayload({ config })
  const tours = await listPublishedTours(payload)

  return (
    <main className="mx-auto w-full max-w-(--content-max) px-(--page-x) py-(--space-12)">
      <h1 className="text-(length:--text-h1) leading-tight font-bold">투어 목록</h1>
      <p className="mt-(--space-2) text-(--color-text-2)">모든 투어는 현장 결제입니다.</p>
      {tours.length === 0 ? (
        <p className="mt-(--space-8) text-(--color-text-2)">지금은 공개된 투어가 없습니다.</p>
      ) : (
        <ul className="mt-(--space-8) grid gap-(--space-6) sm:grid-cols-2 lg:grid-cols-3">
          {tours.map((tour) => (
            <li key={tour.id}>
              <TourCard tour={tour} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
