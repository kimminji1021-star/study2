// 신청 화면 /apply?session=<회차 ID> — SPEC-APPLY-001 REQ-APPLY-007·014, 디자인 핸드오프 화면 4, plan.md §B.8.
// - 회차 식별 값이 없거나 형식·범위가 틀리면, 또는 회차가 없거나 공개 투어의 회차가 아니면 404.
// - 공개 투어의 회차이지만 신청할 수 없으면(마감·시작함·자리 없음) 200으로 안내와 투어 상세 링크만 보이고 양식을 그리지 않는다.
// - 남은 자리는 조회 계층(getApplySession)이 점유 인원을 반영해 계산한 값만 쓴다. 인원 선택지는 1 ~ min(10, 남은 자리).
// @MX:NOTE: [AUTO] apply/ 아래에 loading 파일을 두면 notFound()가 스트리밍 시작 뒤에 호출되어 404가 아니라 200이 될 수 있다(R21).
//   저장소 규칙 테스트(AC-APPLY-012 묶음)가 loading 파일 부재와 connection() 호출을 확인한다
import config from '@payload-config'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getPayload } from 'payload'

import { parseSessionId } from '../../../lib/application-input'
import { partySizeOptions } from '../../../lib/apply-form'
import { APPLY_TEXT } from '../../../lib/apply-messages'
import { getApplySession } from '../../../lib/catalog'
import { formatSeats, formatSessionDateTime } from '../../../lib/format'
import { ApplyForm } from './ApplyForm'

export const metadata: Metadata = { title: `${APPLY_TEXT.formTitle} | 숨비투어` }

type ApplyPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function ApplyPage({ searchParams }: ApplyPageProps) {
  await connection()

  const sessionId = parseSessionId((await searchParams).session)
  if (sessionId === null) notFound()

  const payload = await getPayload({ config })
  const found = await getApplySession(payload, sessionId)
  if (found === null) notFound()

  const { tour, session } = found
  const { availability } = session
  const tourHref = `/tours/${tour.slug}`

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-(--space-8) px-(--page-x) py-(--space-8)">
      <header className="flex flex-col gap-(--space-3)">
        <h1 className="text-(length:--text-h1) leading-tight font-bold">{APPLY_TEXT.formTitle}</h1>
        <dl className="grid grid-cols-[auto_1fr] gap-x-(--space-4) gap-y-(--space-2) rounded-(--radius-md) bg-(--color-surface) p-(--space-4)">
          <dt className="text-(--color-text-2)">투어</dt>
          <dd className="font-semibold">{tour.title}</dd>
          <dt className="text-(--color-text-2)">회차</dt>
          <dd>{formatSessionDateTime(session.startsAt)}</dd>
          <dt className="text-(--color-text-2)">자리</dt>
          <dd>{formatSeats(availability.remainingSeats, availability.capacity)}</dd>
        </dl>
      </header>

      {availability.selectable ? (
        <ApplyForm sessionId={session.id} partySizes={partySizeOptions(availability.remainingSeats)} />
      ) : (
        <section aria-labelledby="unavailable-heading" className="flex flex-col items-start gap-(--space-4)">
          <h2 id="unavailable-heading" className="text-(length:--text-h2) font-bold">
            {APPLY_TEXT.unavailableTitle}
          </h2>
          <p className="text-(--color-text-2)">{APPLY_TEXT.unavailableBody}</p>
          <Link
            href={tourHref}
            className="inline-flex min-h-(--touch-min) items-center rounded-(--radius-sm) bg-(--color-accent) px-(--space-6) font-semibold text-white hover:bg-(--color-accent-hover)"
          >
            {APPLY_TEXT.backToTour}
          </Link>
        </section>
      )}
    </main>
  )
}
