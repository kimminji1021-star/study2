// 접수 완료 화면의 조회 — SPEC-APPLY-001 REQ-APPLY-011·012·015, plan.md §B.4.
// 접수 번호를 대소문자 구분 없이 받아 대문자로 맞추고, 형식이 틀리면 DB를 조회하지 않는다(→ 404).
// 신청 읽기 접근 규칙은 관리자만이라 로컬 API를 접근 규칙 없이 부른다. 그 대신 select로 개인정보가 아닌 필드만 읽는다.
import type { Payload } from 'payload'

import { normalizeReferenceCode } from './reference-code'

export type ApplicationSummary = {
  referenceCode: string
  partySize: number
  status: 'pending' | 'confirmed' | 'cancelled'
  tourTitle: string
  startsAt: string
}

const idOf = (value: number | { id: number }): number => (typeof value === 'number' ? value : value.id)

// @MX:NOTE: [AUTO] 접수 번호만 알면 열리는 화면이다(가정 A8). 그래서 개인정보(이름·이메일·연락처·요청 사항)와
//   DB 순번 ID를 결과에 담지 않는다. select를 넓히거나 문서를 통째로 돌려주면 접수 완료 화면에 개인정보가 새어 나간다
/** 접수 완료 화면에 보일 요약. 형식이 틀리거나 없는 접수 번호는 null. */
export async function findApplicationSummary(payload: Payload, rawCode: unknown): Promise<ApplicationSummary | null> {
  const referenceCode = normalizeReferenceCode(rawCode)
  if (referenceCode === null) return null

  const result = await payload.find({
    collection: 'applications',
    where: { referenceCode: { equals: referenceCode } },
    select: { referenceCode: true, partySize: true, status: true, session: true },
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
  })
  const application = result.docs[0]
  if (application === undefined) return null

  // 신청이 있는 회차는 삭제할 수 없으므로(REQ-APPLY-004) 회차·투어는 항상 있다
  const session = await payload.findByID({
    collection: 'tour-sessions',
    id: idOf(application.session),
    select: { startsAt: true, tour: true },
    depth: 0,
    overrideAccess: true,
  })
  const tour = await payload.findByID({
    collection: 'tours',
    id: idOf(session.tour),
    select: { title: true },
    depth: 0,
    overrideAccess: true,
  })

  return {
    referenceCode: application.referenceCode,
    partySize: application.partySize,
    status: application.status,
    tourTitle: tour.title,
    startsAt: session.startsAt,
  }
}
