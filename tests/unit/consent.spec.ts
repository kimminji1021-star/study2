// SPEC-APPLY-001 M2 — 동의 문구와 문구 버전 단위 테스트(AC-APPLY-014 단위 부분, plan.md §B.7).
import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import {
  PRIVACY_POLICY_VERSION,
  REQUESTS_CONSENT,
  REQUIRED_CONSENT,
  SENSITIVE_INFO_NOTICE,
  consentDocument,
  noticeText,
} from '../../src/lib/consent'

describe('동의 문구(AC-APPLY-014)', () => {
  it('필수 동의 문구는 수집 항목·이용 목적·보유 기간·5년·거부 시 신청 불가를 담는다', () => {
    const text = noticeText(REQUIRED_CONSENT)
    for (const phrase of ['수집 항목', '이용 목적', '보유 기간', '5년', '거부하면 신청할 수 없습니다']) {
      expect(text, phrase).toContain(phrase)
    }
  })

  it('선택 동의 문구는 파기 시점과 거부해도 신청할 수 있다는 사실을 담는다', () => {
    const text = noticeText(REQUESTS_CONSENT)
    expect(text).toContain('투어 종료 후 지체 없이 파기')
    expect(text).toContain('거부해도 신청할 수 있습니다')
  })

  it('민감정보 안내 문구가 있다', () => {
    expect(SENSITIVE_INFO_NOTICE).toContain('건강·장애 등 민감한 정보는 적지 마세요')
  })
})

describe('동의 문구 버전(REQ-APPLY-014: 문구가 바뀌면 버전도 바뀐다)', () => {
  it('버전은 <날짜>.<해시 8자리> 형식이다', () => {
    expect(PRIVACY_POLICY_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.[0-9a-f]{8}$/)
  })

  it('consentDocument()는 필수 → 선택 → 민감정보 안내 순서로 이어 붙인다', () => {
    const document = consentDocument()
    const required = document.indexOf(noticeText(REQUIRED_CONSENT))
    const optional = document.indexOf(noticeText(REQUESTS_CONSENT))
    const sensitive = document.indexOf(SENSITIVE_INFO_NOTICE)
    expect(required).toBe(0)
    expect(optional).toBeGreaterThan(required)
    expect(sensitive).toBeGreaterThan(optional)
  })

  it('현재 문구 전체의 SHA-256 앞 8자리가 버전 리터럴의 해시 부분과 같다', () => {
    const digest = createHash('sha256').update(consentDocument(), 'utf8').digest('hex')
    expect(PRIVACY_POLICY_VERSION.split('.')[1]).toBe(digest.slice(0, 8))
  })
})
