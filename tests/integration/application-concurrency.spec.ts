// SPEC-APPLY-001 M2 — 같은 회차 동시 제출 통합 테스트(실제 PostgreSQL 병렬, AC-APPLY-010).
// 각 반복의 제출은 모두 시작한 뒤 Promise.all로 한꺼번에 기다린다(순차 await는 아무것도 증명하지 못함, plan.md §G).
// 정원 판정만 시험하도록 잠금 대기 제한은 30초로 준다. 기본 5초 값은 submit-application.spec.ts와 단위 테스트가 확인한다.
// 횟수 제한(M4, 10분 10회)에 걸리지 않도록 submit()이 제출마다 다른 문서용 접속 IP(198.51.100.x)를 넘기고, 끝나면 그 기록을 지운다.
import { sql } from '@payloadcms/db-postgres'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getOccupiedSeatsBySession } from '../../src/lib/occupancy'
import {
  submitApplication,
  type SubmitApplicationOptions,
  type SubmitApplicationResult,
} from '../../src/lib/submit-application'
import { transactionDb } from '../../src/lib/transaction-db'
import config from '../../src/payload.config'
import {
  cleanupAttempts,
  cleanupMarkerData,
  createTourWithSession,
  sessionSnapshot,
  submissionInput,
  testIpPool,
} from '../helpers/application-fixtures'
import { newMarker } from '../helpers/catalog-fixtures'

const marker = newMarker()
const WAIT_LIMIT_MS = 30_000
const REJECTION_CODES = ['CAPACITY_EXCEEDED', 'SESSION_CLOSED']
const ips = testIpPool('198.51.100', 1)
let payload: Payload

function submit(sessionId: number, partySize: number, options: Partial<SubmitApplicationOptions> = {}) {
  return submitApplication(payload, submissionInput(sessionId, marker, { partySize: String(partySize) }), {
    clientIp: ips.next(),
    lockTimeoutMs: WAIT_LIMIT_MS,
    ...options,
  })
}

async function occupied(sessionId: number): Promise<number> {
  return (await getOccupiedSeatsBySession(payload, [sessionId])).get(sessionId) ?? Number.NaN
}

// 같은 DB에서 행 잠금을 기다리는(FOR UPDATE) 세션 수. 연결 풀(payload.db.pool)에서 트랜잭션 밖으로 조회한다
async function countLockWaiters(): Promise<number> {
  const pool = (
    payload.db as unknown as { pool: { query: (text: string) => Promise<{ rows: { waiting: number }[] }> } }
  ).pool
  const { rows } = await pool.query(
    `SELECT count(*)::int AS waiting FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock' AND query ILIKE '%for update%'`,
  )
  return rows[0]?.waiting ?? 0
}

function codeOf(result: SubmitApplicationResult): string {
  return result.status === 'success' ? 'SUCCESS' : result.code
}

describe('동시 제출(실제 DB 병렬, AC-APPLY-010)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  afterAll(async () => {
    if (payload === undefined) return
    try {
      // 정리를 모두 끝낸 뒤 단언한다(단언이 실패해도 테스트 데이터가 남지 않게)
      const attempts = await cleanupAttempts(payload, ips.used())
      await cleanupMarkerData(payload, marker)
      expect(attempts.before).toBeGreaterThanOrEqual(1)
      expect(attempts.after).toBe(0)
    } finally {
      await payload.destroy()
    }
  })

  describe.each([1, 2, 3])('시나리오 A — 정원 5에 인원 1 제출 12건(연결 풀 10보다 많음), 반복 %d', (round) => {
    it('성공 정확히 5건, 나머지는 자리 부족·마감, DB 신청 5·점유 5·closed', async () => {
      const { sessionId } = await createTourWithSession(payload, marker, `scenario-a-${round}`, { capacity: 5 })

      const results = await Promise.all(Array.from({ length: 12 }, () => submit(sessionId, 1)))
      const codes = results.map(codeOf)

      expect(codes.filter((code) => code === 'SUCCESS')).toHaveLength(5)
      expect(codes.filter((code) => code !== 'SUCCESS' && !REJECTION_CODES.includes(code))).toEqual([])
      expect(await sessionSnapshot(payload, sessionId)).toEqual({ status: 'closed', applications: 5 })
      expect(await occupied(sessionId)).toBe(5)

      if (round === 1) {
        // 다시 열지 않음: 신청 하나를 취소로 바꿔도 마감 그대로이고, 이어서 낸 인원 1은 SESSION_CLOSED다
        const one = await payload.find({
          collection: 'applications',
          where: { session: { equals: sessionId } },
          limit: 1,
          depth: 0,
        })
        await payload.update({ collection: 'applications', id: one.docs[0].id, data: { status: 'cancelled' } })
        expect(await occupied(sessionId)).toBe(4)
        expect((await sessionSnapshot(payload, sessionId)).status).toBe('closed')
        expect(await submit(sessionId, 1)).toEqual({ status: 'error', code: 'SESSION_CLOSED' })
      }
    })
  })

  describe.each([1, 2, 3])('시나리오 B — 정원 10에 인원 4·4·4·3·3·2·2·1 제출 8건, 반복 %d', (round) => {
    it('성공 인원 합계 ≤ 10, DB 값이 성공 결과와 일치, 거절 사유가 최종 상태와 맞는다', async () => {
      const { sessionId } = await createTourWithSession(payload, marker, `scenario-b-${round}`, { capacity: 10 })
      const sizes = [4, 4, 4, 3, 3, 2, 2, 1]

      const results = await Promise.all(sizes.map((size) => submit(sessionId, size)))
      const accepted = sizes.filter((_, index) => results[index].status === 'success')
      const acceptedSeats = accepted.reduce((sum, size) => sum + size, 0)
      const snapshot = await sessionSnapshot(payload, sessionId)
      const remaining = 10 - acceptedSeats

      expect(acceptedSeats).toBeLessThanOrEqual(10)
      expect(snapshot.applications).toBe(accepted.length)
      expect(await occupied(sessionId)).toBe(acceptedSeats)
      expect(snapshot.status).toBe(acceptedSeats === 10 ? 'closed' : 'open')

      results.forEach((result, index) => {
        if (result.status === 'success') return
        expect(REJECTION_CODES).toContain(result.code)
        if (result.code === 'CAPACITY_EXCEEDED') expect(sizes[index]).toBeGreaterThan(remaining)
        if (result.code === 'SESSION_CLOSED') expect(snapshot.status).toBe('closed')
      })
    })
  })

  it('DB 수준 잠금 대기 증거: 첫 제출이 커밋 직전에 멈춘 동안 FOR UPDATE에서 기다리는 세션이 있다', async () => {
    const { sessionId } = await createTourWithSession(payload, marker, 'lock-evidence', { capacity: 10 })
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let holderEntered!: () => void
    const entered = new Promise<void>((resolve) => {
      holderEntered = resolve
    })
    let calls = 0
    const beforeCommit = async () => {
      calls += 1
      if (calls === 1) {
        holderEntered()
        await gate
      }
    }

    const pending = Promise.all(Array.from({ length: 4 }, () => submit(sessionId, 1, { beforeCommit })))
    let waiting = 0
    try {
      await entered
      const deadline = Date.now() + 5000
      while (Date.now() < deadline) {
        waiting = await countLockWaiters()
        if (waiting > 0) break
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    } finally {
      release()
    }
    const results = await pending

    expect(waiting).toBeGreaterThanOrEqual(1)
    expect(results.map(codeOf)).toEqual(['SUCCESS', 'SUCCESS', 'SUCCESS', 'SUCCESS'])
    expect((await sessionSnapshot(payload, sessionId)).applications).toBe(4)
  })

  it('잠금 대기 제한: 다른 트랜잭션이 회차 행을 잠근 동안 300ms 제한 제출은 2초 안에 SESSION_BUSY다', async () => {
    const { sessionId } = await createTourWithSession(payload, marker, 'lock-timeout', { capacity: 10 })
    const transactionID = await payload.db.beginTransaction()
    expect(transactionID).toBeTruthy()
    try {
      await transactionDb(payload, transactionID).execute(
        sql`SELECT id FROM tour_sessions WHERE id = ${sessionId} FOR UPDATE`,
      )

      const started = Date.now()
      const result = await submit(sessionId, 1, { lockTimeoutMs: 300 })
      const elapsed = Date.now() - started

      expect(result).toEqual({ status: 'error', code: 'SESSION_BUSY' })
      expect(elapsed).toBeLessThan(2000)
    } finally {
      await payload.db.rollbackTransaction(transactionID as string)
    }
    expect((await sessionSnapshot(payload, sessionId)).applications).toBe(0)
  })
})
