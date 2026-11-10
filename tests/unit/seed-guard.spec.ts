// SPEC-TOUR-001 M5 — 개발용 시드의 거부 판정과 보조 함수(DB 없음).
// AC-TOUR-016: NODE_ENV=production → 거부, 호스트 localhost·127.0.0.1·IPv6 루프백 → 허용(IPv6는 `[::1]` 형식 URL,
// 대괄호를 벗겨 판정), 그 밖의 호스트 → 거부, 해석할 수 없는 DATABASE_URL → 거부. 거부 메시지에 비밀번호는 담지 않는다(plan.md §B.9).
import { describe, expect, it } from 'vitest'

import { assertSeedAllowed, formatSeedSummary, SeedRefusedError, seoulDateAt } from '../../src/lib/seed'

const PASSWORD = 'probe-pass-7731'
const local = (host: string) => `postgres://seed:${PASSWORD}@${host}:5432/sumbi`

function refusal(env: Record<string, string | undefined>): SeedRefusedError {
  try {
    assertSeedAllowed(env)
  } catch (error) {
    expect(error).toBeInstanceOf(SeedRefusedError)
    return error as SeedRefusedError
  }
  throw new Error('거부되어야 하는데 허용되었다')
}

describe('시드 거부 판정 assertSeedAllowed', () => {
  it.each(['localhost', '127.0.0.1', '[::1]'])('로컬 호스트 %s는 허용한다', (host) => {
    expect(() => assertSeedAllowed({ DATABASE_URL: local(host) })).not.toThrow()
  })

  it('postgresql:// 형식과 NODE_ENV=development도 허용한다', () => {
    expect(() =>
      assertSeedAllowed({ NODE_ENV: 'development', DATABASE_URL: `postgresql://u:p@127.0.0.1:5432/db` }),
    ).not.toThrow()
  })

  it('NODE_ENV=production이면 호스트가 로컬이어도 거부하고, 메시지에 NODE_ENV가 있다', () => {
    const error = refusal({ NODE_ENV: 'production', DATABASE_URL: local('127.0.0.1') })
    expect(error.message).toContain('NODE_ENV')
    expect(error.message).not.toContain(PASSWORD)
  })

  it.each(['db.example.com', '10.0.0.5', '127.0.0.2', '[::2]', 'localhost.example.com'])(
    '로컬이 아닌 호스트 %s는 거부하고, 메시지에 호스트만 있고 비밀번호는 없다',
    (host) => {
      const error = refusal({ DATABASE_URL: local(host) })
      expect(error.message).toContain(host.replace(/^\[|\]$/g, ''))
      expect(error.message).not.toContain(PASSWORD)
    },
  )

  it.each([
    ['비어 있음', undefined],
    ['빈 문자열', ''],
    ['URL 아님', `not a url ${PASSWORD}`],
    ['호스트 없음', `postgres:///${PASSWORD}`],
  ])('해석할 수 없는 DATABASE_URL(%s)은 거부하고, 값을 메시지에 옮기지 않는다', (_label, value) => {
    const error = refusal({ DATABASE_URL: value })
    expect(error.message).toContain('DATABASE_URL')
    expect(error.message).not.toContain(PASSWORD)
  })
})

describe('서울 기준 일시 seoulDateAt', () => {
  it('서울 날짜 기준으로 며칠 뒤 지정한 시각(서울)을 UTC로 돌려준다', () => {
    // 2026-11-10T01:00Z = 서울 11월 10일 오전 10시 → +3일 오전 9시 = 11월 13일 09:00 서울 = 11-13T00:00Z
    expect(seoulDateAt(new Date('2026-11-10T01:00:00Z'), 3, 9).toISOString()).toBe('2026-11-13T00:00:00.000Z')
  })

  it('UTC로는 전날이지만 서울로는 다음 날인 시각을 서울 날짜로 계산한다', () => {
    // 2026-11-10T20:00Z = 서울 11월 11일 오전 5시 → +3일 = 11월 14일 09:00 서울 = 11-14T00:00Z
    expect(seoulDateAt(new Date('2026-11-10T20:00:00Z'), 3, 9).toISOString()).toBe('2026-11-14T00:00:00.000Z')
  })

  it('월이 넘어가도 계산한다', () => {
    expect(seoulDateAt(new Date('2026-11-28T03:00:00Z'), 10, 9).toISOString()).toBe('2026-12-08T00:00:00.000Z')
  })
})

describe('결과 요약 formatSeedSummary', () => {
  it('첫 줄에 만든 수와 건너뛴 수, 만든 회차 수가 있고 slug 목록이 이어진다', () => {
    const lines = formatSeedSummary({ created: ['a-tour', 'b-tour'], skipped: ['c-tour'], sessionsCreated: 5 }).split(
      '\n',
    )
    expect(lines[0]).toBe('[seed] created 2, skipped 1, sessions created 5')
    expect(lines).toContain('[seed] created: a-tour, b-tour')
    expect(lines).toContain('[seed] skipped: c-tour')
  })

  it('모두 건너뛰면 created 0과 skipped N을 담고, 빈 목록 줄은 쓰지 않는다', () => {
    const summary = formatSeedSummary({ created: [], skipped: ['a', 'b', 'c'], sessionsCreated: 0 })
    expect(summary.split('\n')[0]).toBe('[seed] created 0, skipped 3, sessions created 0')
    expect(summary).not.toContain('[seed] created:')
  })
})
