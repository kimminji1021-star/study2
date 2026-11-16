// 투어 상세 /tours/[slug] — SPEC-TOUR-001 REQ-TOUR-010·011·012, AC-TOUR-011·012·013.
// - 요청마다 렌더링한다(plan.md §B.3). generateStaticParams를 두지 않는다.
// - 없는 slug·공개되지 않은 투어·형식에 맞지 않는 slug는 조회 계층이 null을 돌려주고, 여기서 404로 응답한다.
// - 신청 가능 회차가 있으면 회차 목록을 GET 양식으로 감싸 "신청하기"를 보인다(SPEC-APPLY-001 REQ-APPLY-006, AC-APPLY-006).
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
  // 신청 가능 회차가 하나도 없으면 "신청하기"를 그리지 않는다(SPEC-APPLY-001 REQ-APPLY-006)
  const canApply = tour.sessions.some((session) => session.availability.selectable)

  // 위쪽(사진·정보·회차)은 흰 면, 투어 소개는 연회색 면에 둔다 — 면의 바뀜이 섹션 구분선 역할을 한다(handoff.md §3, 2026-11-16)
  return (
    <main className="w-full">
      <div className="bg-(--surface-white)">
        <div className="mx-auto w-full max-w-(--content-max) px-(--page-x) pt-(--space-8) pb-(--section-y)">
          <Link
            href="/tours"
            className="inline-flex min-h-(--touch-min) items-center text-(length:--text-small) font-medium text-(--color-accent) hover:text-(--color-accent-hover)"
          >
            ← 투어 목록
          </Link>

          <div className="mt-(--space-4) grid gap-(--space-12) lg:grid-cols-2">
            {/* 그림자는 면 위에 놓인 사진에만 쓴다(카드·버튼에는 쓰지 않는다) */}
            <div className="self-start overflow-hidden rounded-(--radius-lg) shadow-(--shadow-photo)">
              <TourImage image={tour.heroImage} priority />
            </div>

            <div className="flex min-w-0 flex-col gap-(--space-8)">
              <h1 className="text-(length:--text-h1) leading-(--leading-heading) font-semibold tracking-(--tracking-heading)">
                {tour.title}
              </h1>

              <dl className="grid grid-cols-[auto_1fr] gap-x-(--space-6) gap-y-(--space-3) rounded-(--radius-lg) bg-(--color-surface) p-(--space-6)">
                <dt className="text-(--color-text-2)">소요 시간</dt>
                <dd>{formatDuration(tour.durationMinutes)}</dd>
                <dt className="text-(--color-text-2)">집결 장소</dt>
                <dd>{tour.meetingPoint}</dd>
                <dt className="text-(--color-text-2)">가격</dt>
                <dd>{tour.priceNote}</dd>
              </dl>

              <section aria-labelledby="sessions-heading">
                <h2
                  id="sessions-heading"
                  className="mb-(--space-4) text-(length:--text-h3) leading-(--leading-h3) font-semibold tracking-(--tracking-h3)"
                >
                  회차
                </h2>
                {canApply ? (
                  // 회차 값만 질의 문자열로 신청 화면에 보낸다(개인정보 없음, SPEC-APPLY-001 plan.md §B.8)
                  <form method="get" action="/apply" className="flex flex-col gap-(--space-6)">
                    <SessionList sessions={tour.sessions} required />
                    <button
                      type="submit"
                      className="inline-flex min-h-(--button-height) w-full items-center justify-center rounded-(--radius-pill) bg-(--color-accent) px-(--space-8) font-semibold text-white transition-colors hover:bg-(--color-accent-hover) sm:w-fit"
                    >
                      신청하기
                    </button>
                  </form>
                ) : (
                  <SessionList sessions={tour.sessions} />
                )}
              </section>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-(--surface-parchment)">
        <div className="mx-auto w-full max-w-(--content-max) px-(--page-x) py-(--section-y)">
          <section aria-labelledby="about-heading" className="max-w-3xl">
            <h2
              id="about-heading"
              className="mb-(--space-6) text-(length:--text-h2) leading-(--leading-heading) font-semibold tracking-(--tracking-heading)"
            >
              투어 소개
            </h2>
            <div className="flex flex-col gap-(--space-4)">
              {/* 빈 줄은 문단 경계, 한 줄 바꿈은 그대로 보인다(plan.md §B.2). 일반 텍스트라 React 기본 이스케이프로 충분하다 */}
              {splitParagraphs(tour.description).map((paragraph, index) => (
                <p key={index} className="whitespace-pre-line">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
