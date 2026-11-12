// SPEC-APPLY-001 M4 — 허니팟과 횟수 제한 통합 테스트(실제 DB, AC-APPLY-013).
// 신청 처리 함수에 접속 IP와 고정 시각 now를 넘겨, 10분 10회 제한·IP별 분리·시간 경과·오래된 기록 정리·키 해시 저장을 확인한다.
// 시도 기록은 이번 호출로 새로 생긴 것만 본다(같은 DB의 다른 기록과 섞지 않으려고 호출 전 최대 ID 이후의 기록만 읽는다).
import { createHash, createHmac } from 'node:crypto'

import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { submitApplication, type SubmitApplicationResult } from '../../src/lib/submit-application'
import config from '../../src/payload.config'
import type { ApplicationAttempt } from '../../src/payload-types'
import {
  cleanupAttempts,
  cleanupMarkerData,
  createTourWithSession,
  sessionSnapshot,
  submissionInput,
} from '../helpers/application-fixtures'
import { newMarker } from '../helpers/catalog-fixtures'

const marker = newMarker()
const IP_MAIN = '203.0.113.10'
const IP_OTHER = '203.0.113.11'
const IP_HONEYPOT = '203.0.113.12'
const TEN_MINUTES_MS = 10 * 60 * 1000
let payload: Payload

async function maxAttemptId(): Promise<number> {
  const result = await payload.find({ collection: 'application-attempts', sort: '-id', limit: 1, depth: 0 })
  return result.docs[0]?.id ?? 0
}

/** run 동안 새로 생긴 신청 시도 기록(ID 순). */
async function attemptsCreatedBy(run: () => Promise<unknown>): Promise<ApplicationAttempt[]> {
  const since = await maxAttemptId()
  await run()
  const result = await payload.find({
    collection: 'application-attempts',
    where: { id: { greater_than: since } },
    sort: 'id',
    pagination: false,
    depth: 0,
  })
  return result.docs
}

function codeOf(result: SubmitApplicationResult): string {
  return result.status === 'success' ? 'SUCCESS' : result.code
}

describe('허니팟과 횟수 제한(실제 DB, AC-APPLY-013)', () => {
  let sessionId: number
  // 실행 시각을 밀리초 단위로 자른 고정 시각. 회차는 +2일에 시작하므로 now + 10분 + 1초에도 신청 가능하다
  const now = new Date(Math.floor(Date.now() / 1000) * 1000)
  const later = new Date(now.getTime() + TEN_MINUTES_MS + 1000)

  const submit = (ip: string, at: Date, overrides: Parameters<typeof submissionInput>[2] = {}) =>
    submitApplication(payload, submissionInput(sessionId, marker, overrides), { clientIp: ip, now: at })

  beforeAll(async () => {
    payload = await getPayload({ config })
    ;({ sessionId } = await createTourWithSession(payload, marker, 'rate-limit', { capacity: 100 }))
  })

  afterAll(async () => {
    if (payload === undefined) return
    try {
      // 정리를 모두 끝낸 뒤 단언한다(단언이 실패해도 테스트 데이터가 남지 않게)
      const attempts = await cleanupAttempts(payload, [IP_MAIN, IP_OTHER, IP_HONEYPOT])
      await cleanupMarkerData(payload, marker)
      expect(attempts.before).toBeGreaterThanOrEqual(1)
      expect(attempts.after).toBe(0)
    } finally {
      await payload.destroy()
    }
  })

  it('허니팟·10회 제한·IP 분리·키 해시 저장·시간 경과·오래된 기록 정리', async () => {
    // 허니팟: 올바른 입력이라도 website에 값이 있으면 이유를 밝히지 않고 거부, 신청 없음
    let honeypotResult: SubmitApplicationResult | undefined
    const honeypotAttempts = await attemptsCreatedBy(async () => {
      honeypotResult = await submit(IP_HONEYPOT, now, { website: 'x' })
    })
    expect(honeypotResult).toEqual({ status: 'error', code: 'SUBMISSION_REJECTED' })
    expect((await sessionSnapshot(payload, sessionId)).applications).toBe(0)

    // 같은 IP 10건은 모두 처리, 11번째는 RATE_LIMITED이고 신청 수는 10 그대로
    const results: SubmitApplicationResult[] = []
    const mainAttempts = await attemptsCreatedBy(async () => {
      for (let index = 0; index < 11; index += 1) results.push(await submit(IP_MAIN, now))
    })
    expect(results.slice(0, 10).map(codeOf)).toEqual(Array(10).fill('SUCCESS'))
    expect(results[10]).toEqual({ status: 'error', code: 'RATE_LIMITED' })
    expect((await sessionSnapshot(payload, sessionId)).applications).toBe(10)

    // 다른 IP는 영향 없음
    let otherResult: SubmitApplicationResult | undefined
    const otherAttempts = await attemptsCreatedBy(async () => {
      otherResult = await submit(IP_OTHER, now)
    })
    expect(otherResult?.status).toBe('success')

    // 저장된 키: 16진수 64자, 같은 IP는 같은 키, IP가 다르면 다른 키
    expect(honeypotAttempts).toHaveLength(1)
    expect(mainAttempts).toHaveLength(11)
    expect(otherAttempts).toHaveLength(1)
    const all = [...honeypotAttempts, ...mainAttempts, ...otherAttempts]
    for (const attempt of all) {
      expect(attempt.keyHash).toMatch(/^[0-9a-f]{64}$/)
      expect(new Date(attempt.attemptedAt).getTime()).toBe(now.getTime())
    }
    const mainKey = mainAttempts[0].keyHash
    expect(new Set(mainAttempts.map((attempt) => attempt.keyHash))).toEqual(new Set([mainKey]))
    expect(otherAttempts[0].keyHash).not.toBe(mainKey)
    expect(honeypotAttempts[0].keyHash).not.toBe(mainKey)

    // 키 = HMAC-SHA256(PAYLOAD_SECRET 원래 환경 변수, 'apply-rate-limit:' + ip). 키 없는 SHA-256과는 다르다. 비밀 값은 출력하지 않는다
    const secret = process.env.PAYLOAD_SECRET ?? ''
    expect(secret.length).toBeGreaterThan(0)
    expect(mainKey).toBe(createHmac('sha256', secret).update(`apply-rate-limit:${IP_MAIN}`).digest('hex'))
    expect(mainKey).not.toBe(createHash('sha256').update(IP_MAIN).digest('hex'))

    // 시도 기록 문서 전체에 원래 IP 문자열이 없다(문자열에 기록이 실제로 들어 있음을 먼저 확인)
    const serialized = JSON.stringify(all)
    expect(serialized).toContain(mainKey)
    for (const ip of [IP_MAIN, IP_OTHER, IP_HONEYPOT]) expect(serialized).not.toContain(ip)

    // 10분 + 1초 뒤에는 같은 IP도 다시 처리되고, 그 시각 기준 10분보다 오래된 기록은 모두 지워진다
    const staleWhere = { attemptedAt: { less_than: new Date(later.getTime() - TEN_MINUTES_MS).toISOString() } }
    expect((await payload.count({ collection: 'application-attempts', where: staleWhere })).totalDocs).toBeGreaterThan(
      0,
    )
    expect((await submit(IP_MAIN, later)).status).toBe('success')
    expect((await payload.count({ collection: 'application-attempts', where: staleWhere })).totalDocs).toBe(0)
  })
})
