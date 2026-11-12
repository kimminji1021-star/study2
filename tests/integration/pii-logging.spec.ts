// SPEC-APPLY-001 M6 — 개인정보 비노출 통합 테스트(실제 DB, Payload 로컬 API). AC-APPLY-015, REQ-APPLY-015.
// 같은 표식 값으로 성공·검증 실패·자리 부족·주입 지점 강제 오류·횟수 제한 초과 제출을 차례로 하면서
// console(log·info·warn·error)과 payload.logger(info·warn·error·debug) 출력을 붙잡아, 표식 값이 하나도 없음을 확인한다.
// 강제 오류는 DB 오류처럼 메시지에 바인딩 인자(표식 값)를 담는다 — 로그가 오류 메시지를 옮기면 이 테스트가 잡는다.
import { randomInt } from 'node:crypto'
import { inspect } from 'node:util'

import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi, type MockInstance } from 'vitest'

import { FIELD_ERROR_MESSAGES, SUBMIT_ERROR_MESSAGES } from '../../src/lib/apply-messages'
import { recordAttempt, RATE_LIMIT_MAX_ATTEMPTS } from '../../src/lib/rate-limit'
import { submitApplication, type SubmitApplicationResult } from '../../src/lib/submit-application'
import config from '../../src/payload.config'
import {
  cleanupAttempts,
  cleanupMarkerData,
  createTourWithSession,
  submissionInput,
} from '../helpers/application-fixtures'
import { newMarker } from '../helpers/catalog-fixtures'

const marker = newMarker()
// 이 파일 전용 문서용 접속 IP 하나 — 횟수 제한 초과 사례까지 같은 키로 쌓는다
const clientIp = '203.0.113.250'
const now = new Date()

// AC-APPLY-015 표식 값: 이름 `<표식>-이름`, 이메일 `<표식>@example.test`, 연락처 `010-77<무작위 6자리>`, 요청 사항 `<표식>-요청`
const phoneDigits = `01077${String(randomInt(0, 1_000_000)).padStart(6, '0')}`
const pii = {
  name: `${marker}-이름`,
  email: `${marker}@example.test`,
  phone: `${phoneDigits.slice(0, 3)}-${phoneDigits.slice(3)}`,
  requests: `${marker}-요청`,
}
// 연락처는 기호를 지운 정규화 값으로 다뤄질 수 있으므로 두 형태를 모두 찾는다
const forbidden = [pii.name, pii.email, pii.phone, phoneDigits, pii.requests]

let payload: Payload
const captured: string[] = []
const spies: MockInstance[] = []

/** 출력 인자를 문자열로 바꾼다. 오류 객체는 메시지·스택·cause까지 펼쳐 숨은 값도 검사 대상에 넣는다. */
function serialize(args: unknown[]): string {
  return args.map((arg) => (typeof arg === 'string' ? arg : inspect(arg, { depth: 10, showHidden: true }))).join(' ')
}

function capture(target: object, methods: readonly string[]): void {
  for (const method of methods) {
    const spy = vi
      .spyOn(target as Record<string, (...args: unknown[]) => unknown>, method)
      .mockImplementation((...args: unknown[]) => {
        captured.push(serialize(args))
      })
    spies.push(spy)
  }
}

function input(overrides: Parameters<typeof submissionInput>[2] = {}) {
  return (sessionId: number) =>
    submissionInput(sessionId, marker, {
      name: pii.name,
      email: pii.email,
      phone: pii.phone,
      requests: pii.requests,
      requestsConsent: true,
      ...overrides,
    })
}

/** 실패 결과의 오류 코드·입력란 코드와 화면에 보일 안내 문구를 모두 이어 붙인다. */
function failureText(result: SubmitApplicationResult): string {
  if (result.status !== 'error') throw new Error(`Expected a failure result, got ${result.status}.`)
  const fieldErrors = result.code === 'VALIDATION_FAILED' ? result.fieldErrors : {}
  const fieldMessages = Object.values(fieldErrors).map((code) => FIELD_ERROR_MESSAGES[code])
  return [JSON.stringify(result), SUBMIT_ERROR_MESSAGES[result.code], ...fieldMessages].join('\n')
}

describe('개인정보 비노출(실제 DB, AC-APPLY-015)', () => {
  let sessionId: number
  const results: Record<string, SubmitApplicationResult> = {}

  beforeAll(async () => {
    payload = await getPayload({ config })
    ;({ sessionId } = await createTourWithSession(payload, marker, 'pii', { capacity: 3 }))

    capture(console, ['log', 'info', 'warn', 'error'])
    capture(payload.logger, ['info', 'warn', 'error', 'debug'])
    try {
      const submit = (build: ReturnType<typeof input>, beforeCommit?: () => never) =>
        submitApplication(payload, build(sessionId), { clientIp, now, ...(beforeCommit ? { beforeCommit } : {}) })

      // 1) 성공(인원 1 → 남은 자리 2)
      results.success = await submit(input({ partySize: '1' }))
      // 2) 검증 실패(필수 동의 없음 — 나머지 값은 모두 표식 값)
      results.validation = await submit(input({ privacyConsent: false }))
      // 3) 자리 부족(남은 자리 2에 인원 3)
      results.capacity = await submit(input({ partySize: '3' }))
      // 4) 주입 지점 강제 오류 — DB 오류 메시지처럼 바인딩 인자(표식 값)를 메시지와 cause에 담는다
      results.forced = await submit(input({ partySize: '1' }), () => {
        throw Object.assign(new Error(`Failed query: insert into applications\nparams: ${forbidden.join(',')}`), {
          cause: { code: 'XX000', detail: pii.email },
        })
      })
      // 5) 횟수 제한 초과 — 같은 키의 시도를 한도까지 채운 뒤 한 번 더 제출한다
      const recorded = 4
      for (let i = recorded; i < RATE_LIMIT_MAX_ATTEMPTS; i += 1) await recordAttempt(payload, clientIp, now)
      results.rateLimited = await submit(input({ partySize: '1' }))
    } finally {
      for (const spy of spies) spy.mockRestore()
    }
  })

  afterAll(async () => {
    if (payload === undefined) return
    try {
      // 정리를 모두 끝낸 뒤 단언한다(단언이 실패해도 테스트 데이터가 남지 않게)
      const attempts = await cleanupAttempts(payload, [clientIp])
      await cleanupMarkerData(payload, marker)
      expect(attempts.before).toBeGreaterThanOrEqual(1)
      expect(attempts.after).toBe(0)
    } finally {
      await payload.destroy()
    }
  })

  it('다섯 제출이 각각 기대한 결과로 끝난다(성공 1건만 저장)', async () => {
    expect(results.success?.status).toBe('success')
    expect(results.validation).toEqual({
      status: 'error',
      code: 'VALIDATION_FAILED',
      fieldErrors: { privacyConsent: 'PRIVACY_CONSENT_REQUIRED' },
    })
    expect(results.capacity).toEqual({ status: 'error', code: 'CAPACITY_EXCEEDED' })
    expect(results.forced).toEqual({ status: 'error', code: 'INTERNAL_ERROR' })
    expect(results.rateLimited).toEqual({ status: 'error', code: 'RATE_LIMITED' })
    const saved = await payload.count({ collection: 'applications', where: { session: { equals: sessionId } } })
    expect(saved.totalDocs).toBe(1)
  })

  it('로그 수집이 실제로 동작했다: 붙잡은 출력이 1건 이상이고 그중 하나에 INTERNAL_ERROR가 있다', () => {
    expect(captured.length).toBeGreaterThanOrEqual(1)
    expect(captured.some((line) => line.includes('INTERNAL_ERROR'))).toBe(true)
  })

  it('붙잡은 출력 전체에 네 표식 값(연락처는 정규화 형태 포함)이 하나도 없다', () => {
    const all = captured.join('\n')
    for (const value of forbidden) expect(all).not.toContain(value)
  })

  it('각 실패 결과의 오류 코드·입력란 코드·안내 문구에 네 표식 값이 없다', () => {
    const failures = [results.validation, results.capacity, results.forced, results.rateLimited]
    expect(failures).toHaveLength(4)
    for (const result of failures) {
      const text = failureText(result as SubmitApplicationResult)
      expect(text.length).toBeGreaterThan(0)
      for (const value of forbidden) expect(text).not.toContain(value)
    }
  })
})
