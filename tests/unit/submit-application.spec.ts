// SPEC-APPLY-001 M2 — 신청 처리 함수의 순수 부분 단위 테스트(AC-APPLY-010 기본값, plan.md §B.1 7번).
import { describe, expect, it } from 'vitest'

import { DEFAULT_LOCK_TIMEOUT_MS, isLockTimeoutError } from '../../src/lib/submit-application'

describe('정원 확인 구간의 잠금 대기 제한', () => {
  it('기본 상수는 5000밀리초다(AC-APPLY-010)', () => {
    expect(DEFAULT_LOCK_TIMEOUT_MS).toBe(5000)
  })
})

describe('잠금 대기 초과 판별(SQLSTATE 55P03)', () => {
  it('pg 오류의 code가 55P03이면 참이다', () => {
    expect(isLockTimeoutError({ code: '55P03' })).toBe(true)
  })

  it('drizzle이 감싼 오류(DrizzleQueryError)는 cause.code를 본다', () => {
    const wrapped = Object.assign(new Error('Failed query: select …\nparams: 1'), { cause: { code: '55P03' } })
    expect(isLockTimeoutError(wrapped)).toBe(true)
  })

  it.each([{ code: '23505' }, { cause: { code: '22003' } }, new Error('x'), null, undefined, '55P03'])(
    '%j는 잠금 대기 초과가 아니다',
    (err) => {
      expect(isLockTimeoutError(err)).toBe(false)
    },
  )
})
