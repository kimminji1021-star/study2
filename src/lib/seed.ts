// 개발용 시드 로직 — SPEC-TOUR-001 REQ-TOUR-015, plan.md §B.9.
// 진입점(scripts/seed.ts)이 핸드오프 가상 데이터를 넘기고, 통합 테스트는 테스트 데이터 표식을 붙인 데이터 집합으로 같은 로직을 검증한다.
// 이 모듈은 DB에 연결하지 않는다. 연결은 호출자가 assertSeedAllowed를 통과한 뒤 getPayload()로 만든 인스턴스를 넘길 때만 일어난다.
import type { Payload } from 'payload'

export type SeedSession = {
  /** 실행일(서울 날짜) 기준 며칠 뒤 */
  dayOffset: number
  /** 서울 기준 시작 시각(시) */
  hour: number
  capacity: number
  status?: 'open' | 'closed'
}

export type SeedTour = {
  title: string
  slug: string
  summary: string
  description: string
  durationMinutes: number
  meetingPoint: string
  priceNote: string
  sessions: SeedSession[]
}

export type SeedResult = { created: string[]; skipped: string[]; sessionsCreated: number }

export class SeedRefusedError extends Error {
  override name = 'SeedRefusedError'
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

// @MX:NOTE: [AUTO] 시드 거부 판정 — getPayload()보다 먼저 불러야 DB에 연결하지 않는다(REQ-TOUR-015, plan.md R18).
//   거부는 예외로 끝낸다. `payload run`은 스크립트가 끝나면 무조건 process.exit(0)이라 process.exitCode는 무시된다(R17 실측).
//   메시지에는 호스트 이름만 담고 DATABASE_URL 전체(비밀번호 포함)는 옮기지 않는다(REQ-INFRA-010)
export function assertSeedAllowed(env: Record<string, string | undefined>): void {
  if (env.NODE_ENV === 'production') {
    throw new SeedRefusedError('Refusing to seed: NODE_ENV is "production". The seed is for local development only.')
  }

  let hostname = ''
  try {
    hostname = new URL(env.DATABASE_URL ?? '').hostname
  } catch {
    // 아래에서 빈 호스트로 거부한다
  }
  // WHATWG URL은 IPv6 호스트를 대괄호째 돌려준다([::1]) — 벗긴 값으로 비교한다
  const host = hostname.replace(/^\[(.*)\]$/, '$1')
  if (host === '') {
    throw new SeedRefusedError('Refusing to seed: DATABASE_URL is missing or is not a valid URL with a host.')
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new SeedRefusedError(
      `Refusing to seed: database host "${host}" is not local (allowed: localhost, 127.0.0.1, ::1).`,
    )
  }
}

const SEOUL_OFFSET_HOURS = 9 // 서울은 일광 절약 시간이 없어 UTC+9 고정

/** 기준 시각의 서울 날짜에서 dayOffset일 뒤, 서울 hour시 정각의 순간. */
export function seoulDateAt(now: Date, dayOffset: number, hour: number): Date {
  const seoul = new Date(now.getTime() + SEOUL_OFFSET_HOURS * 3600 * 1000)
  return new Date(
    Date.UTC(seoul.getUTCFullYear(), seoul.getUTCMonth(), seoul.getUTCDate() + dayOffset, hour - SEOUL_OFFSET_HOURS),
  )
}

/** 실행 결과를 출력용 문자열로. 첫 줄은 AC-TOUR-016이 로그에서 찾는 `created N`·`skipped N`을 담는다. */
export function formatSeedSummary(result: SeedResult): string {
  const lines = [
    `[seed] created ${result.created.length}, skipped ${result.skipped.length}, sessions created ${result.sessionsCreated}`,
  ]
  if (result.created.length > 0) lines.push(`[seed] created: ${result.created.join(', ')}`)
  if (result.skipped.length > 0) lines.push(`[seed] skipped: ${result.skipped.join(', ')}`)
  return lines.join('\n')
}

async function createTourWithSessions(payload: Payload, tour: SeedTour, now: Date): Promise<number> {
  const { sessions, ...fields } = tour
  const created = await payload.create({ collection: 'tours', data: { ...fields, published: true } })
  try {
    for (const session of sessions) {
      const startsAt = seoulDateAt(now, session.dayOffset, session.hour)
      const endsAt = new Date(startsAt.getTime() + tour.durationMinutes * 60 * 1000)
      await payload.create({
        collection: 'tour-sessions',
        data: {
          tour: created.id,
          startsAt: startsAt.toISOString(),
          startsAt_tz: 'Asia/Seoul',
          endsAt: endsAt.toISOString(),
          endsAt_tz: 'Asia/Seoul',
          capacity: session.capacity,
          status: session.status ?? 'open',
        },
      })
    }
  } catch (error) {
    // 반쯤 만든 투어가 남으면 다음 실행이 slug만 보고 건너뛰어 회차가 빠진 채로 굳는다 — 회차 → 투어 순서로 되돌린다(plan.md R8)
    await payload.delete({ collection: 'tour-sessions', where: { tour: { equals: created.id } } })
    await payload.delete({ collection: 'tours', id: created.id })
    throw error
  }
  return sessions.length
}

// @MX:NOTE: [AUTO] 멱등성 계약 — slug가 이미 있으면 투어와 회차 모두 건너뛴다(관리자가 고친 내용을 덮어쓰지 않음, REQ-TOUR-015).
//   진입점(scripts/seed.ts)과 통합 테스트(tests/integration/seed.spec.ts)가 이 함수 하나를 함께 쓴다
export async function runSeed(
  payload: Payload,
  dataset: SeedTour[],
  options: { now?: Date } = {},
): Promise<SeedResult> {
  const now = options.now ?? new Date()
  const result: SeedResult = { created: [], skipped: [], sessionsCreated: 0 }

  for (const tour of dataset) {
    const existing = await payload.count({ collection: 'tours', where: { slug: { equals: tour.slug } } })
    if (existing.totalDocs > 0) {
      result.skipped.push(tour.slug)
      continue
    }
    result.sessionsCreated += await createTourWithSessions(payload, tour, now)
    result.created.push(tour.slug)
  }
  return result
}
