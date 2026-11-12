// 접수 완료 화면 /apply/complete/<접수 번호> — SPEC-APPLY-001 REQ-APPLY-011·012·015, 디자인 핸드오프 화면 5, plan.md §B.4·§B.8.
// - 신청 저장 뒤 서버 액션이 이 경로로 리다이렉트한다(POST 뒤 GET). 새로고침해도 신청이 새로 만들어지지 않는다.
// - 접수 번호는 대소문자를 구분하지 않고 받아 대문자로 맞춘다. 형식이 틀리거나 없는 접수 번호는 404(DB 순번 ID도 형식이 틀려 404).
// - 개인정보와 DB 순번 ID를 그리지 않는다. 서버 컴포넌트가 글자만 그리고 클라이언트 컴포넌트에 데이터 객체를 넘기지 않는다.
// - 검색 엔진 색인을 막는다(robots noindex).
import config from '@payload-config'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getPayload } from 'payload'

import { APPLICATION_STATUS_LABELS, APPLY_TEXT } from '../../../../../lib/apply-messages'
import { findApplicationSummary } from '../../../../../lib/application-summary'
import { formatSessionDateTime } from '../../../../../lib/format'

export const metadata: Metadata = {
  title: `${APPLY_TEXT.completeTitle} | 숨비투어`,
  robots: { index: false, follow: false },
}

type ApplyCompletePageProps = { params: Promise<{ ref: string }> }

export default async function ApplyCompletePage({ params }: ApplyCompletePageProps) {
  await connection()

  const { ref } = await params
  const payload = await getPayload({ config })
  const summary = await findApplicationSummary(payload, ref)
  if (summary === null) notFound()

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-(--space-6) px-(--page-x) py-(--space-12)">
      <div className="flex flex-col gap-(--space-2)">
        <h1 className="text-(length:--text-h1) leading-tight font-bold">{APPLY_TEXT.completeTitle}</h1>
        <p className="text-(--color-text-2)">{APPLY_TEXT.completeBody}</p>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-(--space-6) gap-y-(--space-3) rounded-(--radius-lg) bg-(--color-surface) p-(--space-6)">
        <dt className="text-(--color-text-2)">접수 번호</dt>
        <dd className="font-mono text-(length:--text-h3) font-bold tracking-wide">{summary.referenceCode}</dd>
        <dt className="text-(--color-text-2)">투어</dt>
        <dd className="font-semibold">{summary.tourTitle}</dd>
        <dt className="text-(--color-text-2)">회차</dt>
        <dd>{formatSessionDateTime(summary.startsAt)}</dd>
        <dt className="text-(--color-text-2)">인원</dt>
        <dd>{summary.partySize}명</dd>
        <dt className="text-(--color-text-2)">상태</dt>
        <dd className="font-semibold">{APPLICATION_STATUS_LABELS[summary.status]}</dd>
      </dl>

      <Link
        href="/tours"
        className="inline-flex min-h-(--touch-min) w-fit items-center rounded-(--radius-sm) border border-(--color-accent) px-(--space-6) font-semibold text-(--color-accent) hover:bg-(--color-accent-tint)"
      >
        {APPLY_TEXT.toTours}
      </Link>
    </main>
  )
}
