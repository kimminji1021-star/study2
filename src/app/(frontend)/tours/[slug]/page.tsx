// 투어 상세 /tours/[slug] — SPEC-TOUR-001 REQ-TOUR-010·011·012, AC-TOUR-011·012·013.
// - 요청마다 렌더링한다(plan.md §B.3). generateStaticParams를 두지 않는다.
// - 없는 slug·공개되지 않은 투어·형식에 맞지 않는 slug는 조회 계층이 null을 돌려주고, 여기서 404로 응답한다.
// @MX:NOTE: [AUTO] tours/ 아래에 loading 파일(Suspense 경계)을 두면 notFound()가 스트리밍 시작 뒤에 호출되어 404가 아니라 200으로 응답할 수 있다(R21).
//   저장소 규칙 테스트(AC-TOUR-013 묶음)가 loading 파일 부재와 connection() 호출을 확인한다
import config from '@payload-config'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getPayload } from 'payload'

import { SessionList } from '../../../../components/SessionList'
import { TourImage } from '../../../../components/TourImage'
import { getTourDetailBySlug } from '../../../../lib/catalog'
import { formatDuration, splitParagraphs } from '../../../../lib/format'

type TourDetailPageProps = { params: Promise<{ slug: string }> }

export default async function TourDetailPage({ params }: TourDetailPageProps) {
  await connection()

  const { slug } = await params
  const payload = await getPayload({ config })
  const tour = await getTourDetailBySlug(payload, slug)
  if (tour === null) notFound()

  return (
    <main className="mx-auto w-full max-w-(--content-max) px-(--page-x) py-(--space-8)">
      <Link
        href="/tours"
        className="inline-flex min-h-(--touch-min) items-center text-(length:--text-small) font-medium text-(--color-accent) hover:text-(--color-accent-hover)"
      >
        ← 투어 목록
      </Link>

      <div className="mt-(--space-4) grid gap-(--space-8) lg:grid-cols-2">
        <div className="overflow-hidden rounded-(--radius-lg)">
          <TourImage image={tour.heroImage} priority />
        </div>

        <div className="flex min-w-0 flex-col gap-(--space-6)">
          <h1 className="text-(length:--text-h1) leading-tight font-bold">{tour.title}</h1>

          <dl className="grid grid-cols-[auto_1fr] gap-x-(--space-4) gap-y-(--space-2) rounded-(--radius-md) bg-(--color-surface) p-(--space-4)">
            <dt className="text-(--color-text-2)">소요 시간</dt>
            <dd>{formatDuration(tour.durationMinutes)}</dd>
            <dt className="text-(--color-text-2)">집결 장소</dt>
            <dd>{tour.meetingPoint}</dd>
            <dt className="text-(--color-text-2)">가격</dt>
            <dd>{tour.priceNote}</dd>
          </dl>

          <section aria-labelledby="sessions-heading">
            <h2 id="sessions-heading" className="mb-(--space-3) text-(length:--text-h3) font-bold">
              회차
            </h2>
            <SessionList sessions={tour.sessions} />
          </section>
        </div>
      </div>

      <section aria-labelledby="about-heading" className="mt-(--space-12) max-w-3xl">
        <h2 id="about-heading" className="mb-(--space-3) text-(length:--text-h2) font-bold">
          투어 소개
        </h2>
        <div className="flex flex-col gap-(--space-4) leading-relaxed">
          {/* 빈 줄은 문단 경계, 한 줄 바꿈은 그대로 보인다(plan.md §B.2). 일반 텍스트라 React 기본 이스케이프로 충분하다 */}
          {splitParagraphs(tour.description).map((paragraph, index) => (
            <p key={index} className="whitespace-pre-line">
              {paragraph}
            </p>
          ))}
        </div>
      </section>
    </main>
  )
}
