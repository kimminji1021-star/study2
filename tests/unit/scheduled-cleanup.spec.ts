// SPEC-DEPLOY-001 M2 — 예약 정리의 기준 시각 계산과 Cron 비밀값 비교 단위 테스트(AC-DEPLOY-007·008 단위 부분, plan.md §B.5).
import { randomBytes } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { cleanupCutoffs, isAuthorizedCronRequest } from '../../src/lib/scheduled-cleanup'

describe('정리 기준 시각(AC-DEPLOY-008)', () => {
  it('시도 기록 기준은 now − 10분, 작업 기록 기준은 UTC 연도 − 2(같은 월·일·시각)다', () => {
    const cutoffs = cleanupCutoffs(new Date('2026-11-17T09:00:00.000Z'))

    expect(cutoffs.attemptsBefore.toISOString()).toBe('2026-11-17T08:50:00.000Z')
    expect(cutoffs.auditLogsBefore.toISOString()).toBe('2024-11-17T09:00:00.000Z')
  })

  it('10분 경계는 now − 600000ms 정확히다(±1ms는 다른 값)', () => {
    const now = new Date('2026-11-17T09:00:00.000Z')
    const { attemptsBefore } = cleanupCutoffs(now)

    expect(now.getTime() - attemptsBefore.getTime()).toBe(600_000)
    expect(cleanupCutoffs(new Date(now.getTime() + 1)).attemptsBefore.getTime()).toBe(attemptsBefore.getTime() + 1)
    expect(cleanupCutoffs(new Date(now.getTime() - 1)).attemptsBefore.getTime()).toBe(attemptsBefore.getTime() - 1)
  })

  it('2월 29일 기준은 setUTCFullYear 규칙을 따라 2년 전 3월 1일이 된다', () => {
    const { auditLogsBefore } = cleanupCutoffs(new Date('2028-02-29T00:00:00.000Z'))

    expect(auditLogsBefore.toISOString()).toBe('2026-03-01T00:00:00.000Z')
  })

  it('받은 now를 바꾸지 않는다', () => {
    const now = new Date('2026-11-17T09:00:00.000Z')
    cleanupCutoffs(now)

    expect(now.toISOString()).toBe('2026-11-17T09:00:00.000Z')
  })
})

describe('Cron 비밀값 비교(AC-DEPLOY-007)', () => {
  // 실행마다 만드는 영문·숫자 32자 시험용 값(저장소에 고정 값을 두지 않는다)
  const secret = randomBytes(16).toString('hex')

  it('정확히 `Bearer <비밀값>`이면 참이다', () => {
    expect(isAuthorizedCronRequest(`Bearer ${secret}`, secret)).toBe(true)
  })

  it('한 글자 다른 값, 길이가 다른 값, 빈 값, Bearer 없는 값, 머리글 없음은 거짓이다', () => {
    const lastChar = secret.at(-1) === 'a' ? 'b' : 'a'
    const oneCharOff = `Bearer ${secret.slice(0, -1)}${lastChar}`

    for (const header of [oneCharOff, `Bearer ${secret}x`, `Bearer ${secret.slice(0, -1)}`, '', secret, 'Bearer ']) {
      expect(isAuthorizedCronRequest(header, secret), JSON.stringify(header.length)).toBe(false)
    }
    expect(isAuthorizedCronRequest(null, secret)).toBe(false)
  })

  it('서버 비밀값이 없거나 비었거나 16자 미만이면 어떤 머리글이든 거짓이다', () => {
    const short = 'a'.repeat(15)

    expect(isAuthorizedCronRequest('Bearer undefined', undefined)).toBe(false)
    expect(isAuthorizedCronRequest('Bearer ', '')).toBe(false)
    expect(isAuthorizedCronRequest(`Bearer ${short}`, short)).toBe(false)
    // 16자는 허용 하한
    const minimum = 'a'.repeat(16)
    expect(isAuthorizedCronRequest(`Bearer ${minimum}`, minimum)).toBe(true)
  })
})
