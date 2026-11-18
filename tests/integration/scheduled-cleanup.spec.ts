// SPEC-DEPLOY-001 M2 — 예약 정리 통합 테스트(실제 PostgreSQL, AC-DEPLOY-008, plan.md §B.5·§B.11).
// 정리는 실행 시점의 실제 현재 시각으로만 돌린다(미래 시각을 넘기면 개발 DB의 실제 기록을 지울 수 있다 — R8).
// 단언은 이 파일이 만든 표식 행(시도 기록 keyHash `test-…`, 작업 기록은 표식 회차 ID)만 대상으로 한다.
// 실행하면서 개발 DB의 이미 만료된 실제 시도 기록이 함께 지워지는 것은 원래 지워질 행이라 허용한다.
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '../../src/payload.config'
import { cleanupCutoffs, runScheduledCleanup } from '../../src/lib/scheduled-cleanup'
import { cleanupMarkerData, createTourWithSession } from '../helpers/application-fixtures'
import { newMarker } from '../helpers/catalog-fixtures'

const marker = newMarker()
const DAY_MS = 24 * 60 * 60 * 1000
let payload: Payload
let sessionId: number

type PoolCalls = { query: number; connect: number }
type CountablePool = { query: (...args: unknown[]) => unknown; connect: (...args: unknown[]) => unknown }

// 측정 구간 동안 연결 풀의 query·connect 호출 수를 센다(SPEC-ADMIN-001 AC-ADMIN-012와 같은 방식)
async function countPoolCalls(run: () => Promise<unknown>): Promise<PoolCalls> {
  const pool = (payload.db as unknown as { pool: CountablePool }).pool
  const originalQuery = pool.query
  const originalConnect = pool.connect
  const calls: PoolCalls = { query: 0, connect: 0 }
  pool.query = function (this: unknown, ...args: unknown[]) {
    calls.query += 1
    return originalQuery.apply(this, args)
  }
  pool.connect = function (this: unknown, ...args: unknown[]) {
    calls.connect += 1
    return originalConnect.apply(this, args)
  }
  try {
    await run()
  } finally {
    pool.query = originalQuery
    pool.connect = originalConnect
  }
  return calls
}

const markerKey = (name: string) => `${marker}-${name}`

async function createAttempt(name: string, attemptedAt: Date): Promise<number> {
  const doc = await payload.create({
    collection: 'application-attempts',
    data: { keyHash: markerKey(name), attemptedAt: attemptedAt.toISOString() },
  })
  return doc.id
}

async function createAuditLog(occurredAt: Date): Promise<number> {
  const doc = await payload.create({
    collection: 'admin-audit-logs',
    data: { action: 'session.participants_csv', sessionId, rowCount: 0, occurredAt: occurredAt.toISOString() },
  })
  return doc.id
}

async function attemptExists(id: number): Promise<boolean> {
  return (await payload.count({ collection: 'application-attempts', where: { id: { equals: id } } })).totalDocs === 1
}

async function auditLogExists(id: number): Promise<boolean> {
  return (await payload.count({ collection: 'admin-audit-logs', where: { id: { equals: id } } })).totalDocs === 1
}

/** 정리 대상이 아닌 컬렉션들의 전체 행 수. */
async function otherCounts(): Promise<Record<string, number>> {
  const collections = ['tours', 'tour-sessions', 'applications', 'media', 'users'] as const
  const entries = await Promise.all(
    collections.map(async (collection) => [collection, (await payload.count({ collection })).totalDocs] as const),
  )
  return Object.fromEntries(entries)
}

async function cleanupMarkerAttempts(): Promise<void> {
  await payload.delete({ collection: 'application-attempts', where: { keyHash: { like: marker } } })
}

describe('예약 정리(실제 DB, AC-DEPLOY-008)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    ;({ sessionId } = await createTourWithSession(payload, marker, 'cleanup', { capacity: 5 }))
  })

  afterAll(async () => {
    if (payload === undefined) return
    try {
      await cleanupMarkerAttempts()
      // 표식 회차의 작업 기록 → 회차 → 투어 순서로 지운다
      await cleanupMarkerData(payload, marker)
      const left = await payload.count({ collection: 'application-attempts', where: { keyHash: { like: marker } } })
      expect(left.totalDocs).toBe(0)
    } finally {
      await payload.destroy()
    }
  })

  it('10분 지난 시도·2년 지난 작업 기록만 지우고, 경계 안쪽 행과 다른 컬렉션은 그대로 둔다', async () => {
    const now = new Date()
    const { auditLogsBefore } = cleanupCutoffs(now)
    const a1 = await createAttempt('a1', new Date(now.getTime() - 10 * 60 * 1000 - 1000))
    const a2 = await createAttempt('a2', new Date(now.getTime() - 9 * 60 * 1000))
    const l1 = await createAuditLog(new Date(auditLogsBefore.getTime() - DAY_MS))
    const l2 = await createAuditLog(new Date(auditLogsBefore.getTime() + DAY_MS))
    const before = await otherCounts()
    expect(before.tours, '표식 투어가 있어야 한다').toBeGreaterThanOrEqual(1)
    expect(before['tour-sessions'], '표식 회차가 있어야 한다').toBeGreaterThanOrEqual(1)

    const result = await runScheduledCleanup(payload, new Date())

    expect(Object.keys(result).sort()).toEqual(['attemptsDeleted', 'auditLogsDeleted'])
    expect(result.attemptsDeleted).toBeGreaterThanOrEqual(1)
    expect(result.auditLogsDeleted).toBeGreaterThanOrEqual(1)
    expect(await attemptExists(a1)).toBe(false)
    expect(await attemptExists(a2)).toBe(true)
    expect(await auditLogExists(l1)).toBe(false)
    expect(await auditLogExists(l2)).toBe(true)
    expect(await otherCounts()).toEqual(before)
  })

  it('같은 기준 시각으로 한 번 더 실행하면 두 결과 값이 모두 0이다(중복 전달에 안전)', async () => {
    const now = new Date()
    await createAttempt('repeat', new Date(now.getTime() - 11 * 60 * 1000))

    const first = await runScheduledCleanup(payload, now)
    expect(first.attemptsDeleted).toBeGreaterThanOrEqual(1)

    const second = await runScheduledCleanup(payload, now)
    expect(second).toEqual({ attemptsDeleted: 0, auditLogsDeleted: 0 })
  })

  it('질의 수는 지울 표식 행 수(2개·20개)와 관계없이 같고, 트랜잭션 연결을 쓰지 않는다', async () => {
    async function measure(rows: number): Promise<{ calls: PoolCalls; deleted: number }> {
      const now = new Date()
      for (let i = 0; i < rows; i += 1) {
        await createAttempt(`count-${rows}-${i}`, new Date(now.getTime() - 11 * 60 * 1000 - i * 1000))
      }
      let deleted = 0
      const calls = await countPoolCalls(async () => {
        deleted = (await runScheduledCleanup(payload, now)).attemptsDeleted
      })
      return { calls, deleted }
    }

    const small = await measure(2)
    const large = await measure(20)

    expect(small.deleted).toBeGreaterThanOrEqual(2)
    expect(large.deleted).toBeGreaterThanOrEqual(20)
    // 삭제 질의 두 번(시도 기록·작업 기록)뿐이다
    expect(small.calls.query).toBe(2)
    expect(large.calls).toEqual(small.calls)
    // pool.query 한 번이 내부에서 connect를 한 번 부른다 — 같으면 트랜잭션용 직접 연결이 없다
    expect(small.calls.connect).toBe(small.calls.query)
  })
})
