// SPEC-APPLY-001 M4 — 스팸 방지 순수 함수 단위 테스트(AC-APPLY-013 단위 부분, plan.md §B.5·§B.8).
// 접속 IP 추출, 횟수 제한 키(HMAC-SHA256) 유도, 허니팟 판정. DB를 쓰는 기록·판정은 통합 테스트(rate-limit.spec.ts)가 맡는다.
import { createHash, createHmac } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { HONEYPOT_FIELD, isHoneypotFilled } from '../../src/lib/application-input'
import {
  RATE_LIMIT_MAX_ATTEMPTS,
  RATE_LIMIT_WINDOW_MS,
  clientIpFromHeaders,
  rateLimitKey,
} from '../../src/lib/rate-limit'

// 테스트 전용 비밀 값(실제 PAYLOAD_SECRET이 아니다). 단위 테스트는 환경 변수에 기대지 않는다
const SECRET = 'unit-test-secret-not-a-real-value'

function headers(values: Record<string, string>) {
  return new Headers(values)
}

describe('횟수 제한 상수(REQ-APPLY-013)', () => {
  it('최근 10분 안 10회까지 처리한다', () => {
    expect(RATE_LIMIT_MAX_ATTEMPTS).toBe(10)
    expect(RATE_LIMIT_WINDOW_MS).toBe(10 * 60 * 1000)
  })
})

describe('접속 IP 추출(x-forwarded-for 첫 값 → x-real-ip → unknown)', () => {
  it('x-forwarded-for의 첫 값을 공백을 빼고 쓴다', () => {
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': '198.51.100.7, 10.0.0.1' }))).toBe('198.51.100.7')
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': '  198.51.100.9  ' }))).toBe('198.51.100.9')
  })

  it('x-forwarded-for가 없으면 x-real-ip를 쓴다', () => {
    expect(clientIpFromHeaders(headers({ 'x-real-ip': '198.51.100.8' }))).toBe('198.51.100.8')
  })

  it('x-forwarded-for의 첫 값이 비어 있으면 x-real-ip로 넘어간다', () => {
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': ' , 10.0.0.1', 'x-real-ip': '198.51.100.8' }))).toBe(
      '198.51.100.8',
    )
  })

  it('둘 다 없으면 unknown이다', () => {
    expect(clientIpFromHeaders(headers({}))).toBe('unknown')
    expect(clientIpFromHeaders(headers({ 'x-real-ip': '   ' }))).toBe('unknown')
  })
})

describe('횟수 제한 키(HMAC-SHA256, 원문 IP를 담지 않음)', () => {
  it("HMAC-SHA256(비밀 값, 'apply-rate-limit:' + ip)의 16진수 64자다", () => {
    const expected = createHmac('sha256', SECRET).update('apply-rate-limit:203.0.113.10').digest('hex')
    const key = rateLimitKey('203.0.113.10', SECRET)
    expect(key).toBe(expected)
    expect(key).toMatch(/^[0-9a-f]{64}$/)
  })

  it('키 없는 SHA-256과 다르고, 원문 IP 문자열을 담지 않는다', () => {
    const key = rateLimitKey('203.0.113.10', SECRET)
    expect(key).not.toBe(createHash('sha256').update('203.0.113.10').digest('hex'))
    expect(key).not.toContain('203.0.113.10')
  })

  it('같은 IP는 같은 키, 다른 IP·다른 비밀 값은 다른 키다', () => {
    expect(rateLimitKey('203.0.113.10', SECRET)).toBe(rateLimitKey('203.0.113.10', SECRET))
    expect(rateLimitKey('203.0.113.10', SECRET)).not.toBe(rateLimitKey('203.0.113.11', SECRET))
    expect(rateLimitKey('203.0.113.10', SECRET)).not.toBe(rateLimitKey('203.0.113.10', `${SECRET}-other`))
  })

  it('비밀 값이 비어 있으면 키를 만들지 않고 예외를 던진다', () => {
    expect(() => rateLimitKey('203.0.113.10', '')).toThrow('PAYLOAD_SECRET is not set.')
  })
})

describe('허니팟 입력란(website)', () => {
  it('입력란 이름은 website다(plan.md §B.8)', () => {
    expect(HONEYPOT_FIELD).toBe('website')
  })

  it.each(['x', ' ', 'https://example.test'])('값 %j가 있으면 채워진 것이다', (website) => {
    expect(isHoneypotFilled({ website })).toBe(true)
  })

  it.each([{}, { website: '' }, { website: undefined }, { website: null }])('%j는 비어 있다', (input) => {
    expect(isHoneypotFilled(input)).toBe(false)
  })
})
