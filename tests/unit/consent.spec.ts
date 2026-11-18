// SPEC-APPLY-001 M2 — 동의 문구와 문구 버전 단위 테스트(AC-APPLY-014 단위 부분, plan.md §B.7).
// 2026-11-12 출시 전 보완: 보유 기간 근거(전자상거래법), 민감정보 미수집, 만 14세 안내를 더했다.
import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import {
  AGE_NOTICE,
  PRIVACY_POLICY_VERSION,
  REQUESTS_CONSENT,
  REQUIRED_CONSENT,
  SENSITIVE_INFO_NOTICE,
  consentDocument,
  noticeText,
} from '../../src/lib/consent'

describe('동의 문구(AC-APPLY-014)', () => {
  it('필수 동의 문구는 수집 항목·이용 목적·보유 기간·5년·보존 근거 법률·거부 시 신청 불가를 담는다', () => {
    const text = noticeText(REQUIRED_CONSENT)
    for (const phrase of [
      '수집 항목',
      '이용 목적',
      '보유 기간',
      '5년',
      '「전자상거래 등에서의 소비자보호에 관한 법률」에 따른 거래 기록 보존',
      '거부하면 신청할 수 없습니다',
    ]) {
      expect(text, phrase).toContain(phrase)
    }
  })

  // SPEC-DEPLOY-001 REQ-DEPLOY-010(AC-DEPLOY-010): 예약 정리(매일 한 번)를 반영한 실제 최대 보관 시간과 변환 방식을 알린다
  it('필수 동의의 접속 IP 설명은 비밀키 변환·원래 IP 미저장·매일 자동 삭제·최대 72시간을 담는다', () => {
    const text = noticeText(REQUIRED_CONSENT)
    for (const phrase of [
      '비밀키로 변환한',
      '원래 IP 주소는 저장하지 않음',
      '매일 한 번 자동으로 지워',
      '늦어도 72시간 안에 삭제',
    ]) {
      expect(text, phrase).toContain(phrase)
    }
  })

  it('필수 동의는 예전 설명(다음 신청 처리 때 삭제)을 더 담지 않는다', () => {
    const text = noticeText(REQUIRED_CONSENT)
    expect(text).toContain('접속 IP')
    expect(text).not.toContain('다음 신청 처리 때')
  })

  it('선택 동의 문구는 민감정보를 수집하지 않는다는 점, 파기 시점, 거부해도 신청할 수 있다는 사실을 담는다', () => {
    const text = noticeText(REQUESTS_CONSENT)
    expect(text).toContain('요청 사항(건강·장애 등 민감정보 제외)')
    expect(text).toContain('투어 종료 후 지체 없이 파기')
    expect(text).toContain('거부해도 신청할 수 있습니다')
  })

  it('민감정보 안내는 적지 말라는 요청과 적힌 경우 즉시 삭제한다는 사실을 담는다', () => {
    for (const phrase of ['건강 상태·장애·복용 약', '민감한 정보는 적지 마세요', '확인하는 즉시 삭제합니다']) {
      expect(SENSITIVE_INFO_NOTICE, phrase).toContain(phrase)
    }
  })

  it('나이 안내는 만 14세 미만은 보호자가 신청하라고 알린다', () => {
    expect(AGE_NOTICE).toContain('만 14세 이상만 직접 신청할 수 있습니다')
    expect(AGE_NOTICE).toContain('만 14세 미만은 보호자가 신청해 주세요')
  })
})

describe('동의 문구 버전(REQ-APPLY-014: 문구가 바뀌면 버전도 바뀐다)', () => {
  // SPEC-DEPLOY-001 사용자 결정 D7(2026-11-17): IP 변환값 보관 문구를 확정한 날
  it('버전은 <날짜>.<해시 8자리> 형식이고 날짜는 문구를 확정한 2026-11-17이며, 예전 버전 값이 아니다', () => {
    expect(PRIVACY_POLICY_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.[0-9a-f]{8}$/)
    expect(PRIVACY_POLICY_VERSION.startsWith('2026-11-17.')).toBe(true)
    expect(PRIVACY_POLICY_VERSION).not.toBe('2026-11-12.99052510')
  })

  it('consentDocument()는 필수 → 선택 → 민감정보 안내 → 나이 안내 순서로 이어 붙인다', () => {
    const document = consentDocument()
    const required = document.indexOf(noticeText(REQUIRED_CONSENT))
    const optional = document.indexOf(noticeText(REQUESTS_CONSENT))
    const sensitive = document.indexOf(SENSITIVE_INFO_NOTICE)
    const age = document.indexOf(AGE_NOTICE)
    expect(required).toBe(0)
    expect(optional).toBeGreaterThan(required)
    expect(sensitive).toBeGreaterThan(optional)
    expect(age).toBeGreaterThan(sensitive)
  })

  it('현재 문구 전체의 SHA-256 앞 8자리가 버전 리터럴의 해시 부분과 같다', () => {
    const digest = createHash('sha256').update(consentDocument(), 'utf8').digest('hex')
    expect(PRIVACY_POLICY_VERSION.split('.')[1]).toBe(digest.slice(0, 8))
  })
})
