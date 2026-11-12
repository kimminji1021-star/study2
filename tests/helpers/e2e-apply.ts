// SPEC-APPLY-001 M5 E2E 준비 도우미 — 신청 화면 E2E가 쓰는 투어·회차·신청을 Payload 로컬 API로 만든다.
// - 투어 slug는 `<표식>-<이름>`이라 cleanupCatalogFixture(표식)가 신청 → 회차 → 투어 순서로 지운다.
// - 준비 단계의 신청은 이름에 표식, 이메일은 `<표식>-<번호>@example.test`를 쓴다(acceptance.md AC-APPLY-007).
// - 회차는 실행 시각에서 하루 이상 떨어진 값만 쓴다. "시작함" 사례만 하루 전에 시작한 회차를 쓴다.
import { randomInt } from 'node:crypto'

import type { Payload } from 'payload'

import { applicationInput } from './application-fixtures'
import { daysFromNow, tourInput } from './catalog-fixtures'

export type E2eTour = { id: number; slug: string; title: string }
export type E2eSession = { id: number; startsAt: string }

export async function createE2eTour(
  payload: Payload,
  marker: string,
  name: string,
  published = true,
): Promise<E2eTour> {
  const doc = await payload.create({
    collection: 'tours',
    data: tourInput(`${marker}-${name}`, { published }) as never,
  })
  return { id: doc.id, slug: doc.slug, title: doc.title }
}

export async function createE2eSession(
  payload: Payload,
  tour: number,
  { days, capacity, status = 'open' }: { days: number; capacity: number; status?: 'open' | 'closed' },
): Promise<E2eSession> {
  const startsAt = daysFromNow(days)
  const doc = await payload.create({
    collection: 'tour-sessions',
    data: { tour, startsAt, endsAt: daysFromNow(days, 4), capacity, status } as never,
  })
  return { id: doc.id, startsAt }
}

let applicationSeq = 0

/** 준비 단계의 신청(로컬 API, 접근 규칙 생략). 이메일은 `<표식>-<번호>@example.test`. */
export async function addE2eApplication(
  payload: Payload,
  sessionId: number,
  marker: string,
  { partySize, status = 'pending' }: { partySize: number; status?: 'pending' | 'confirmed' | 'cancelled' },
): Promise<{ id: number; email: string }> {
  applicationSeq += 1
  const email = `${marker}-${applicationSeq}@example.test`
  const doc = await payload.create({
    collection: 'applications',
    data: applicationInput(sessionId, marker, { partySize, status, email }) as never,
  })
  return { id: doc.id, email }
}

/** 무작위 숫자 n자리(연락처 표식용). */
export function randomDigits(length: number): string {
  return Array.from({ length }, () => randomInt(10)).join('')
}
