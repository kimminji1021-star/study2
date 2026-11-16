// SPEC-ADMIN-001 M6 — 관리자 운영 코드의 개인정보 비노출(실제 DB, Payload 로컬 API). AC-ADMIN-015 로그 부분, REQ-ADMIN-015.
// 같은 표식 값을 담은 신청으로 상태 변경 성공 → 복원 정원 초과 → 잠금 대기 초과(SESSION_BUSY) → 요청 사항 삭제 성공 →
// 요청 사항 삭제 잠금 대기 초과 → 작업 기록 실패(INTERNAL_ERROR, 상태 변경·요청 사항 삭제 두 경로)를 차례로 실행하면서
// console(log·info·warn·error)과 payload.logger(info·warn·error·debug) 출력을 붙잡아 표식 값이 하나도 없음을 확인한다.
// 작업 기록 실패는 DB 오류처럼 메시지에 표식 값을 담아 던진다 — 이 SPEC 코드가 원인 오류의 메시지를 옮기면 이 테스트가 잡는다.
// 범위: 이 SPEC 코드가 남기는 로그·오류만 판정한다. Payload가 저장 단계 DB 오류를 스스로 기록하는 경로는 plan.md §G R23.
import { randomInt } from 'node:crypto'
import { inspect } from 'node:util'

import { sql } from '@payloadcms/db-postgres'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi, type MockInstance } from 'vitest'

import { clearApplicationRequests, type ClearRequestsResult } from '../../src/lib/clear-requests'
import { transactionDb } from '../../src/lib/transaction-db'
import config from '../../src/payload.config'
import type { Application, User } from '../../src/payload-types'
import { caught, createTestAdmin, deleteTestAdmin, updateAsAdmin } from '../helpers/admin-fixtures'
import { applicationInput, cleanupMarkerData, createTourWithSession } from '../helpers/application-fixtures'
import { newMarker } from '../helpers/catalog-fixtures'

const marker = newMarker()

// 표식 값: 이름 `<표식>-이름`, 이메일 `<표식>@example.test`, 연락처 `010-66<무작위 6자리>`, 요청 사항 `<표식>-요청`
const phoneDigits = `01066${String(randomInt(0, 1_000_000)).padStart(6, '0')}`
const pii = {
  name: `${marker}-이름`,
  email: `${marker}@example.test`,
  phone: `${phoneDigits.slice(0, 3)}-${phoneDigits.slice(3)}`,
  requests: `${marker}-요청`,
}
// 연락처는 기호를 지운 정규화 값으로 다뤄질 수 있으므로 두 형태를 모두 찾는다
const forbidden = [pii.name, pii.email, pii.phone, phoneDigits, pii.requests]

let payload: Payload
let admin: User
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

/** 표식 값을 모두 담은 신청 한 건. */
function createApplication(sessionId: number, overrides: Record<string, unknown> = {}): Promise<Application> {
  return payload.create({
    collection: 'applications',
    data: applicationInput(sessionId, marker, {
      name: pii.name,
      email: pii.email,
      phone: pii.phone,
      requests: pii.requests,
      requestsConsentAt: new Date(Date.now() - 60_000).toISOString(),
      ...overrides,
    }) as never,
  })
}

/** 별도 트랜잭션으로 회차 행을 FOR UPDATE로 쥔다. 끝에 rollback으로 풀어 준다. */
async function holdSessionRow(sessionId: number) {
  const transactionID = await payload.db.beginTransaction()
  if (transactionID === null || transactionID === undefined) throw new Error('Transaction is not available.')
  await transactionDb(payload, transactionID).execute(
    sql`SELECT id FROM tour_sessions WHERE id = ${sessionId} FOR UPDATE`,
  )
  return { rollback: () => payload.db.rollbackTransaction(transactionID).catch(() => undefined) }
}

/** admin-audit-logs 생성만 한 번 실패시킨다. 오류 메시지·cause에 표식 값을 담는다(DB 오류의 바인딩 인자 흉내). */
function failAuditCreateOnce(): MockInstance {
  const original = payload.create.bind(payload)
  let failed = false
  return vi.spyOn(payload, 'create').mockImplementation(((args: { collection: string }) => {
    if (!failed && args.collection === 'admin-audit-logs') {
      failed = true
      return Promise.reject(
        Object.assign(new Error(`Failed query: insert into admin_audit_logs\nparams: ${forbidden.join(',')}`), {
          cause: { code: 'XX000', detail: pii.email },
        }),
      )
    }
    return original(args as never)
  }) as never)
}

type StatusError = (Error & { status?: number }) | undefined

describe('관리자 운영 코드의 개인정보 비노출(실제 DB, AC-ADMIN-015)', () => {
  const statusErrors: Record<string, StatusError> = {}
  const clearResults: Record<string, ClearRequestsResult> = {}
  let successStatus: string | undefined

  beforeAll(async () => {
    payload = await getPayload({ config })
    admin = await createTestAdmin(payload, 'admin-pii-logging')
    // 넉넉한 회차(성공·기록 실패), 정원 3 회차(복원 초과), 잠금을 쥘 회차(SESSION_BUSY 두 경로)
    const roomy = (await createTourWithSession(payload, marker, 'roomy', { capacity: 10 })).sessionId
    const tight = (await createTourWithSession(payload, marker, 'tight', { capacity: 3 })).sessionId
    const busy = (await createTourWithSession(payload, marker, 'busy', { capacity: 10 })).sessionId

    const statusOk = await createApplication(roomy)
    await createApplication(tight, { partySize: 2 })
    const overCapacity = await createApplication(tight, {
      partySize: 2,
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
    })
    const busyStatus = await createApplication(busy, { status: 'cancelled', cancelledAt: new Date().toISOString() })
    const clearOk = await createApplication(roomy)
    const busyClear = await createApplication(busy)
    const statusAuditFail = await createApplication(roomy)
    const clearAuditFail = await createApplication(roomy)

    capture(console, ['log', 'info', 'warn', 'error'])
    capture(payload.logger, ['info', 'warn', 'error', 'debug'])
    try {
      // 1) 상태 변경 성공
      const updated = await updateAsAdmin(payload, admin, statusOk.id, { status: 'confirmed' })
      successStatus = updated.status
      // 2) 복원 정원 초과(정원 3, 대기 2 + 복원 2)
      statusErrors.restore = await caught(updateAsAdmin(payload, admin, overCapacity.id, { status: 'pending' }))
      // 3) 잠금 대기 초과 — 상태 변경, 4) 요청 사항 삭제 성공, 5) 잠금 대기 초과 — 요청 사항 삭제
      const held = await holdSessionRow(busy)
      try {
        statusErrors.busy = await caught(updateAsAdmin(payload, admin, busyStatus.id, { status: 'pending' }))
        clearResults.busy = await clearApplicationRequests(payload, { applicationId: busyClear.id, user: admin })
      } finally {
        await held.rollback()
      }
      clearResults.success = await clearApplicationRequests(payload, { applicationId: clearOk.id, user: admin })
      // 6) 작업 기록 실패로 인한 INTERNAL_ERROR — 상태 변경 경로와 요청 사항 삭제 경로
      const failStatus = failAuditCreateOnce()
      try {
        statusErrors.internal = await caught(updateAsAdmin(payload, admin, statusAuditFail.id, { status: 'cancelled' }))
      } finally {
        failStatus.mockRestore()
      }
      const failClear = failAuditCreateOnce()
      try {
        clearResults.internal = await clearApplicationRequests(payload, {
          applicationId: clearAuditFail.id,
          user: admin,
        })
      } finally {
        failClear.mockRestore()
      }
    } finally {
      for (const spy of spies) spy.mockRestore()
    }
  })

  afterAll(async () => {
    if (payload === undefined) return
    const failures: unknown[] = []
    const step = async (run: () => Promise<unknown>) => {
      try {
        await run()
      } catch (error) {
        failures.push(error)
      }
    }
    await step(() => cleanupMarkerData(payload, marker))
    await step(() => deleteTestAdmin(payload, admin))
    await payload.destroy()
    if (failures.length > 0) throw failures[0]
  })

  it('여섯 사례가 각각 기대한 결과로 끝난다', () => {
    expect(successStatus).toBe('confirmed')
    expect(statusErrors.restore?.status).toBe(409)
    expect(statusErrors.restore?.message.startsWith('RESTORE_CAPACITY_EXCEEDED:')).toBe(true)
    expect(statusErrors.busy?.status).toBe(409)
    expect(statusErrors.busy?.message.startsWith('SESSION_BUSY:')).toBe(true)
    expect(clearResults.success?.status).toBe('cleared')
    expect(clearResults.busy).toEqual({ status: 'error', code: 'SESSION_BUSY' })
    expect(statusErrors.internal?.status).toBe(500)
    expect(statusErrors.internal?.message.startsWith('INTERNAL_ERROR:')).toBe(true)
    expect(clearResults.internal).toEqual({ status: 'error', code: 'INTERNAL_ERROR' })
  })

  it('로그 수집이 실제로 동작했다: 붙잡은 출력이 1건 이상이고 그중 하나에 INTERNAL_ERROR가 있다', () => {
    expect(captured.length).toBeGreaterThanOrEqual(1)
    expect(captured.some((line) => line.includes('INTERNAL_ERROR'))).toBe(true)
  })

  it('붙잡은 출력 전체에 네 표식 값(연락처는 정규화 형태 포함)이 하나도 없다', () => {
    const all = captured.join('\n')
    for (const value of forbidden) expect(all).not.toContain(value)
  })

  it('이 SPEC 코드가 던진 오류 객체에는 cause가 없고, 메시지·직렬화 결과에 표식 값이 없다', () => {
    const errors = [statusErrors.restore, statusErrors.busy, statusErrors.internal]
    expect(errors.every((error) => error instanceof Error)).toBe(true)
    for (const error of errors) {
      expect((error as { cause?: unknown }).cause).toBeUndefined()
      const text = [error?.message ?? '', inspect(error, { depth: 10, showHidden: true })].join('\n')
      for (const value of forbidden) expect(text).not.toContain(value)
    }
  })

  it('요청 사항 삭제의 결과 객체에 표식 값이 없다', () => {
    const results = Object.values(clearResults)
    expect(results).toHaveLength(3)
    const text = JSON.stringify(results)
    for (const value of forbidden) expect(text).not.toContain(value)
  })
})
