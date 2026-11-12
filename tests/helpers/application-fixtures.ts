// SPEC-APPLY-001 테스트 데이터 도우미 — 테스트 데이터 표식을 붙인 신청 입력값과 이메일 표본을 만든다.
// 신청은 이름에 표식을 넣고 이메일은 `<표식>@example.test`로 쓴다(acceptance.md 머리말).
// 정리 순서: 신청 시도 기록 → 신청 → 회차 → 투어 → 미디어(plan.md §B.9).
import type { Payload } from 'payload'

import type { ApplicationFormInput } from '../../src/lib/application-input'
import { rateLimitKey } from '../../src/lib/rate-limit'
import { generateReferenceCode } from '../../src/lib/reference-code'
import { daysFromNow, tourInput } from './catalog-fixtures'

/** `SB-XXXXX-XXXXX` 형식의 무작위 접수 번호. 로컬 API로 신청을 직접 만드는 테스트가 고유한 값을 쓸 때 부른다. */
export function testReferenceCode(): string {
  return generateReferenceCode()
}

/**
 * AC-APPLY-002 이메일 표본. 받는 표본은 모두 표식을 담고 example.test로 끝나므로 저장해도 정리 조건에 걸린다.
 * 거부 표본은 저장하지 않는다.
 */
export function emailSamples(marker: string): { accepted: string[]; rejected: string[] } {
  return {
    accepted: [`${marker}@example.test`, `kim.minji+${marker}@example.test`, `user-name-${marker}@sub.example.test`],
    rejected: ['a@b', 'a b@example.test', '"a"@example.test', 'a..b@example.test', `${'a'.repeat(242)}@example.test`],
  }
}

/** 필수 값을 모두 갖춘 신청 문서 입력값(로컬 API 저장용). */
export function applicationInput(
  session: number,
  marker: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    session,
    name: `${marker} 신청자`,
    email: `${marker}@example.test`,
    phone: '010-1234-5678',
    partySize: 2,
    referenceCode: testReferenceCode(),
    privacyConsentAt: new Date().toISOString(),
    privacyPolicyVersion: 'test-version',
    ...overrides,
  }
}

/** 서버 제출 경로(신청 처리 함수)에 넣는 올바른 양식 입력값. 이름에 표식, 이메일은 `<표식>@example.test`. */
export function submissionInput(
  sessionId: number,
  marker: string,
  overrides: Partial<ApplicationFormInput> = {},
): ApplicationFormInput {
  return {
    session: String(sessionId),
    name: `${marker} 신청자`,
    email: `${marker}@example.test`,
    phone: '010-1234-5678',
    partySize: '1',
    requests: '',
    privacyConsent: true,
    requestsConsent: false,
    ...overrides,
  }
}

export type SessionFixtureOptions = {
  capacity: number
  /** 시작 시각(실행 시각 기준 일수). 기본 +2일 — 하루 이상 떨어진 값만 쓴다(acceptance.md 머리말) */
  startsInDays?: number
  status?: 'open' | 'closed'
  published?: boolean
}

/** 표식을 붙인 투어 1개와 그 회차 1개를 만든다. slug는 `<표식>-<suffix>`라 정리 조건(slug like 표식)에 걸린다. */
export async function createTourWithSession(
  payload: Payload,
  marker: string,
  suffix: string,
  { capacity, startsInDays = 2, status = 'open', published = true }: SessionFixtureOptions,
): Promise<{ tourId: number; sessionId: number }> {
  const tour = await payload.create({
    collection: 'tours',
    data: tourInput(`${marker}-${suffix}`, { published }) as never,
  })
  const session = await payload.create({
    collection: 'tour-sessions',
    data: {
      tour: tour.id,
      startsAt: daysFromNow(startsInDays),
      endsAt: daysFromNow(startsInDays, 4),
      capacity,
      status,
    } as never,
  })
  return { tourId: tour.id, sessionId: session.id }
}

/** 표식이 붙은 투어의 신청 → 회차 → 투어를 지운다(신청 삭제는 접근 규칙이 막으므로 로컬 API 기본값). */
export async function cleanupMarkerData(payload: Payload, marker: string): Promise<void> {
  const tours = await payload.find({
    collection: 'tours',
    where: { slug: { like: marker } },
    pagination: false,
    depth: 0,
  })
  const tourIds = tours.docs.map((tour) => tour.id)
  const sessions =
    tourIds.length > 0
      ? await payload.find({
          collection: 'tour-sessions',
          where: { tour: { in: tourIds } },
          pagination: false,
          depth: 0,
        })
      : { docs: [] }
  const sessionIds = sessions.docs.map((session) => session.id)
  await payload.delete({
    collection: 'applications',
    where: {
      or: [{ email: { like: marker } }, ...(sessionIds.length > 0 ? [{ session: { in: sessionIds } }] : [])],
    },
  })
  if (tourIds.length > 0) {
    await payload.delete({ collection: 'tour-sessions', where: { tour: { in: tourIds } } })
    await payload.delete({ collection: 'tours', where: { id: { in: tourIds } } })
  }
}

/**
 * 문서용 주소 대역(203.0.113.0/24, 198.51.100.0/24)에서 접속 IP를 차례로 내준다(acceptance.md 머리말).
 * 제출마다 다른 IP를 쓰면 횟수 제한(10분 10회)에 걸리지 않는다. 쓴 IP 목록은 시도 기록 정리에 쓴다.
 * 파일마다 다른 대역·시작 번호를 쓰고, 끝나면 cleanupAttempts로 자기 IP의 기록을 지운다.
 */
export function testIpPool(prefix: '203.0.113' | '198.51.100', start: number) {
  let next = start
  const used: string[] = []
  return {
    next(): string {
      if (next > 254) throw new Error('Test IP range exhausted.')
      const ip = `${prefix}.${next}`
      next += 1
      used.push(ip)
      return ip
    },
    used: (): string[] => [...used],
  }
}

/** 주어진 접속 IP들의 키로 신청 시도 기록을 지우고, 지우기 전·후 개수를 돌려준다(AC-APPLY-016). */
export async function cleanupAttempts(payload: Payload, ips: string[]): Promise<{ before: number; after: number }> {
  const where = { keyHash: { in: ips.map((ip) => rateLimitKey(ip)) } }
  const before = (await payload.count({ collection: 'application-attempts', where })).totalDocs
  await payload.delete({ collection: 'application-attempts', where })
  const after = (await payload.count({ collection: 'application-attempts', where })).totalDocs
  return { before, after }
}

/** 회차의 상태와 신청 수(트랜잭션 밖, 커밋된 값). */
export async function sessionSnapshot(
  payload: Payload,
  sessionId: number,
): Promise<{ status: string; applications: number }> {
  const session = await payload.findByID({ collection: 'tour-sessions', id: sessionId, depth: 0 })
  const count = await payload.count({ collection: 'applications', where: { session: { equals: sessionId } } })
  return { status: session.status, applications: count.totalDocs }
}
