// SPEC-APPLY-001 M2 — 신청 처리 함수의 순수 부분 단위 테스트(AC-APPLY-010 기본값, plan.md §B.1 7번).
// M4: 시도 기록 단계가 실패하면 고정 코드로만 끝나는지(가짜 payload — 실제 DB 경로는 통합 테스트가 맡는다).
import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_LOCK_TIMEOUT_MS, isLockTimeoutError, submitApplication } from '../../src/lib/submit-application'
import { submissionInput } from '../helpers/application-fixtures'

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

describe('시도 기록 단계의 실패(M4, REQ-APPLY-015)', () => {
  it('시도 기록 저장이 실패하면 INTERNAL_ERROR이고, 로그에는 코드·오류 종류 이름만 남는다', async () => {
    vi.stubEnv('PAYLOAD_SECRET', 'unit-test-secret-not-a-real-value')
    const error = vi.fn()
    const fakePayload = {
      delete: async () => {
        throw new Error('Failed query: delete …\nparams: test-unit-marker@example.test')
      },
      logger: { error },
    } as unknown as Payload
    try {
      const result = await submitApplication(fakePayload, submissionInput(1, 'test-unit-marker'), {
        clientIp: '203.0.113.200',
      })
      expect(result).toEqual({ status: 'error', code: 'INTERNAL_ERROR' })
      expect(error).toHaveBeenCalledTimes(1)
      expect(error.mock.calls[0][0]).toEqual({
        code: 'INTERNAL_ERROR',
        errorName: 'Error',
        sessionId: null,
        msg: 'Application submission failed: INTERNAL_ERROR',
      })
      expect(JSON.stringify(error.mock.calls)).not.toContain('test-unit-marker')
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
