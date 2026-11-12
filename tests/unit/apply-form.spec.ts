// SPEC-APPLY-001 M5 — 신청 화면의 양식 해석·인원 선택지·화면 문구(순수 함수).
// 서버 액션은 FormData를 이 함수로 해석해 신청 처리 함수에 넘기고, 화면은 오류 코드를 이 문구표로 바꾼다(plan.md §B.6·§B.8).
import { describe, expect, it } from 'vitest'

import type { FieldErrorCode } from '../../src/lib/application-input'
import { partySizeOptions, readApplyForm, refillValues } from '../../src/lib/apply-form'
import {
  APPLICATION_STATUS_LABELS,
  APPLY_TEXT,
  FIELD_ERROR_MESSAGES,
  SUBMIT_ERROR_MESSAGES,
} from '../../src/lib/apply-messages'
import type { SubmitErrorCode } from '../../src/lib/submit-application'

function form(entries: Record<string, string>): FormData {
  const data = new FormData()
  for (const [name, value] of Object.entries(entries)) data.set(name, value)
  return data
}

describe('readApplyForm — FormData → 신청 처리 함수 입력', () => {
  it('입력란 값을 문자열로, 체크된 체크 상자를 true로 옮긴다', () => {
    const input = readApplyForm(
      form({
        session: '12',
        name: ' 김민지 ',
        email: 'a@example.test',
        phone: '010-1234-5678',
        partySize: '2',
        requests: '창가 자리',
        privacyConsent: 'on',
        requestsConsent: 'on',
        website: '',
      }),
    )
    expect(input).toEqual({
      session: '12',
      name: ' 김민지 ',
      email: 'a@example.test',
      phone: '010-1234-5678',
      partySize: '2',
      requests: '창가 자리',
      privacyConsent: true,
      requestsConsent: true,
      website: '',
    })
  })

  it('체크하지 않은 체크 상자(값 없음)는 false, 없는 입력란은 undefined다', () => {
    const input = readApplyForm(form({ session: '3' }))
    expect(input.privacyConsent).toBe(false)
    expect(input.requestsConsent).toBe(false)
    expect(input.name).toBeUndefined()
    expect(input.website).toBeUndefined()
  })

  it('파일 값은 문자열이 아니므로 undefined로 본다', () => {
    const data = new FormData()
    data.set('name', new Blob(['x']), 'x.txt')
    expect(readApplyForm(data).name).toBeUndefined()
  })

  it('허니팟 입력란 값은 그대로 넘긴다(판정은 신청 처리 함수가 한다)', () => {
    expect(readApplyForm(form({ website: 'x' })).website).toBe('x')
  })
})

describe('refillValues — 검증 오류 뒤 다시 채울 방문자 본인 입력값(가정 A3)', () => {
  it('회차·허니팟을 빼고 화면 입력란 값만 문자열·불리언으로 돌려준다', () => {
    const values = refillValues(
      readApplyForm(
        form({ session: '1', name: '이름', email: 'e', phone: 'p', partySize: '3', requests: 'r', website: 'bot' }),
      ),
    )
    expect(values).toEqual({
      name: '이름',
      email: 'e',
      phone: 'p',
      partySize: '3',
      requests: 'r',
      privacyConsent: false,
      requestsConsent: false,
    })
  })

  it('없는 값은 빈 문자열이다', () => {
    expect(refillValues({})).toEqual({
      name: '',
      email: '',
      phone: '',
      partySize: '',
      requests: '',
      privacyConsent: false,
      requestsConsent: false,
    })
  })
})

describe('partySizeOptions — 인원 선택지 1 ~ min(10, 남은 자리)', () => {
  it.each([
    [15, 10],
    [10, 10],
    [3, 3],
    [1, 1],
    [0, 0],
    [-2, 0],
  ])('남은 자리 %i → 선택지 %i개', (remaining, count) => {
    const options = partySizeOptions(remaining)
    expect(options).toHaveLength(count)
    expect(options).toEqual(Array.from({ length: count }, (_, index) => index + 1))
  })
})

const FIELD_CODES: FieldErrorCode[] = [
  'SESSION_INVALID',
  'NAME_REQUIRED',
  'NAME_TOO_LONG',
  'NAME_INVALID',
  'EMAIL_INVALID',
  'PHONE_INVALID',
  'PARTY_SIZE_INVALID',
  'REQUESTS_TOO_LONG',
  'REQUESTS_CONSENT_REQUIRED',
  'PRIVACY_CONSENT_REQUIRED',
]

const SUBMIT_CODES: SubmitErrorCode[] = [
  'VALIDATION_FAILED',
  'RATE_LIMITED',
  'SUBMISSION_REJECTED',
  'SESSION_NOT_FOUND',
  'SESSION_CLOSED',
  'SESSION_STARTED',
  'CAPACITY_EXCEEDED',
  'SESSION_BUSY',
  'INTERNAL_ERROR',
]

describe('화면 문구표(apply-messages)', () => {
  it('입력란 오류 코드마다 비어 있지 않은 한국어 안내가 있다', () => {
    expect(Object.keys(FIELD_ERROR_MESSAGES).sort()).toEqual([...FIELD_CODES].sort())
    for (const code of FIELD_CODES) expect(FIELD_ERROR_MESSAGES[code]).toMatch(/[가-힣]/)
  })

  it('요청 사항 선택 동의 누락 안내는 고정 문자열을 담는다(AC-APPLY-008)', () => {
    expect(FIELD_ERROR_MESSAGES.REQUESTS_CONSENT_REQUIRED).toContain(
      '요청 사항을 남기려면 선택 동의에 체크하거나 입력란을 비워 주세요',
    )
  })

  it('제출 오류 코드마다 비어 있지 않은 한국어 안내가 있고, 허니팟 거부 안내는 이유를 드러내지 않는다', () => {
    expect(Object.keys(SUBMIT_ERROR_MESSAGES).sort()).toEqual([...SUBMIT_CODES].sort())
    for (const code of SUBMIT_CODES) expect(SUBMIT_ERROR_MESSAGES[code]).toMatch(/[가-힣]/)
    expect(SUBMIT_ERROR_MESSAGES.SUBMISSION_REJECTED).not.toMatch(/허니팟|봇|website/i)
  })

  it('신청 상태 문구: 대기는 "대기 — 관리자 확인 후 확정"(AC-APPLY-012)', () => {
    expect(APPLICATION_STATUS_LABELS).toEqual({
      pending: '대기 — 관리자 확인 후 확정',
      confirmed: '확정',
      cancelled: '취소',
    })
  })

  it('신청 불가 안내 고정 문자열(AC-APPLY-007)', () => {
    expect(APPLY_TEXT.unavailableTitle).toContain('신청할 수 없는 회차입니다')
  })
})
