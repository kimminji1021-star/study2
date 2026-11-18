// SPEC-DEPLOY-001 M1 — 연결 풀 최소값(DATABASE_POOL_MAX=3)에서 같은 회차 동시 신청 2건이 끝까지 처리되는지(AC-DEPLOY-004).
// Payload는 시작 때 연결 1개를 오류 감시용으로 계속 붙잡으므로 실제로 쓸 수 있는 연결은 2개다(plan.md §B.2).
// 그 상태에서 정원 확인 트랜잭션(FOR UPDATE)이 서로 기다리며 멈추지 않아야 한다(R2).
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { submitApplication } from '../../src/lib/submit-application'
import {
  cleanupAttempts,
  cleanupMarkerData,
  createTourWithSession,
  sessionSnapshot,
  submissionInput,
  testIpPool,
} from '../helpers/application-fixtures'
import { newMarker } from '../helpers/catalog-fixtures'

// 설정 모듈이 풀 크기를 읽기 전에 최소값을 넣는다(정적 import보다 먼저 실행됨)
vi.hoisted(() => {
  process.env.DATABASE_POOL_MAX = '3'
})

const { default: config } = await import('../../src/payload.config')

const marker = newMarker()
const ips = testIpPool('203.0.113', 230)
const WAIT_LIMIT_MS = 30_000
let payload: Payload

describe('AC-DEPLOY-004 최소 풀 3에서 동시 신청 2건', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  afterAll(async () => {
    delete process.env.DATABASE_POOL_MAX
    if (payload === undefined) return
    try {
      const attempts = await cleanupAttempts(payload, ips.used())
      await cleanupMarkerData(payload, marker)
      expect(attempts.after).toBe(0)
    } finally {
      await payload.destroy()
    }
  })

  it('풀의 최대 연결 수가 3이다', () => {
    const pool = (payload.db as unknown as { pool: { options: { max?: number } } }).pool
    expect(pool.options.max).toBe(3)
  })

  it('정원 2 회차에 1명씩 2건을 동시에 넣으면 둘 다 30초 안에 접수되고 시간 초과 오류가 없다', async () => {
    const { sessionId } = await createTourWithSession(payload, marker, 'pool-min', { capacity: 2 })
    const started = Date.now()

    const results = await Promise.all(
      [0, 1].map(() =>
        submitApplication(payload, submissionInput(sessionId, marker, { partySize: '1' }), {
          clientIp: ips.next(),
          lockTimeoutMs: WAIT_LIMIT_MS,
        }),
      ),
    )
    const elapsed = Date.now() - started

    expect(results.map((result) => result.status)).toEqual(['success', 'success'])
    expect(elapsed).toBeLessThan(WAIT_LIMIT_MS)
    expect(await sessionSnapshot(payload, sessionId)).toEqual({ status: 'closed', applications: 2 })
  })
})
