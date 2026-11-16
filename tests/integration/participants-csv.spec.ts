// SPEC-ADMIN-001 M4 — 참가자 CSV 내려받기 처리 함수(실제 PostgreSQL, plan.md §B.5·§B.9).
// 엔드포인트 처리 함수를 createLocalReq로 만든 req(routeParams·머리글)로 직접 부른다.
// AC-ADMIN-011(권한·cross-site·404·행 순서·다른 회차 제외·작업 기록 1건·거부 0건), REQ-ADMIN-013(기록 실패 시 500·CSV 없음).
import { createLocalReq, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { participantsCsvEndpoint } from '../../src/lib/participants-csv-endpoint'
import config from '../../src/payload.config'
import type { AdminAuditLog, Application, User } from '../../src/payload-types'
import { createTestAdmin, deleteTestAdmin } from '../helpers/admin-fixtures'
import { applicationInput, cleanupMarkerData, createTourWithSession } from '../helpers/application-fixtures'
import { newMarker } from '../helpers/catalog-fixtures'

const marker = newMarker()
const BOM_BYTES = [0xef, 0xbb, 0xbf]
let payload: Payload
let admin: User
let seq = 0

type PoolView = { pool: { query: (text: string, values?: unknown[]) => Promise<unknown> } }

async function createApplication(sessionId: number, overrides: Record<string, unknown> = {}): Promise<Application> {
  seq += 1
  return payload.create({
    collection: 'applications',
    data: applicationInput(sessionId, marker, { email: `${marker}-csv-${seq}@example.test`, ...overrides }) as never,
  })
}

/** 신청 시각을 직접 고친다(같은 시각일 때 신청 ID 순 — plan.md §B.5 D7 — 을 확인하기 위해). */
async function setCreatedAt(ids: number[], at: string) {
  await (payload.db as unknown as PoolView).pool.query('UPDATE applications SET created_at = $1 WHERE id = ANY($2)', [
    at,
    ids,
  ])
}

async function csvLogs(sessionId: number): Promise<AdminAuditLog[]> {
  const result = await payload.find({
    collection: 'admin-audit-logs',
    where: { and: [{ sessionId: { equals: sessionId } }, { action: { equals: 'session.participants_csv' } }] },
    depth: 0,
    pagination: false,
  })
  return result.docs
}

type CallResult = { status: number; bytes: Uint8Array; text: string; headers: Headers }

async function call(user: User | null, id: string, headers: Record<string, string> = {}): Promise<CallResult> {
  const req = await createLocalReq({ user: (user ?? undefined) as never }, payload)
  req.routeParams = { id }
  for (const [name, value] of Object.entries(headers)) req.headers.set(name, value)
  const response = await participantsCsvEndpoint.handler(req)
  const bytes = new Uint8Array(await response.arrayBuffer())
  return { status: response.status, bytes, text: new TextDecoder().decode(bytes), headers: response.headers }
}

/** BOM을 뺀 본문을 CRLF 줄로 나눈다(마지막 줄 끝 CRLF 뒤의 빈 조각은 뺀다). 이 시험의 칸에는 줄바꿈이 없다. */
function lines(text: string): string[] {
  const body = text.startsWith('﻿') ? text.slice(1) : text
  expect(body.endsWith('\r\n')).toBe(true)
  return body.slice(0, -2).split('\r\n')
}

describe('참가자 CSV 처리 함수(실제 DB)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    admin = await createTestAdmin(payload, 'admin-participants-csv')
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

  it('관리자: 200, 머리글, BOM, 행 순서(신청 시각 → ID), 취소 포함·상태 라벨, 다른 회차 제외, 수식 주입 방어, 작업 기록 1건', async () => {
    const { sessionId } = await createTourWithSession(payload, marker, 'csv', { capacity: 20 })
    const other = await createTourWithSession(payload, marker, 'csv-other', { capacity: 20 })
    const a = await createApplication(sessionId, { partySize: 1, status: 'pending' })
    const b = await createApplication(sessionId, {
      partySize: 2,
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
    })
    const c = await createApplication(sessionId, {
      partySize: 3,
      status: 'confirmed',
      phone: '+82 10-1234-5678',
      requests: `=HYPERLINK("x")${marker}`,
      requestsConsentAt: new Date().toISOString(),
    })
    const d = await createApplication(other.sessionId, { partySize: 1 })
    // 신청 시각: c가 가장 이르고, a·b는 같은 시각 → 기대 순서 c, a, b(같은 시각은 ID 오름차순)
    await setCreatedAt([c.id], '2026-11-01T00:00:00.000Z')
    await setCreatedAt([a.id, b.id], '2026-11-02T00:00:00.000Z')

    const result = await call(admin, String(sessionId))
    expect(result.status).toBe(200)
    expect(result.headers.get('content-type')).toBe('text/csv; charset=utf-8')
    expect(result.headers.get('content-disposition')).toBe(
      `attachment; filename="session-${sessionId}-participants.csv"`,
    )
    expect(result.headers.get('cache-control')).toContain('no-store')
    expect(result.headers.get('x-content-type-options')).toBe('nosniff')
    expect([...result.bytes.slice(0, 3)]).toEqual(BOM_BYTES)

    const rows = lines(result.text)
    expect(rows).toHaveLength(4)
    expect(rows[0]).toBe('"접수번호","이름","연락처","이메일","인원","상태","요청 사항"')
    expect(rows[1].startsWith(`"${c.referenceCode}",`)).toBe(true)
    expect(rows[2].startsWith(`"${a.referenceCode}",`)).toBe(true)
    expect(rows[3].startsWith(`"${b.referenceCode}",`)).toBe(true)
    expect(rows[1]).toBe(
      `"${c.referenceCode}","${marker} 신청자","'+82 10-1234-5678","${c.email}","3","확정","'=HYPERLINK(""x"")${marker}"`,
    )
    expect(rows[2]).toContain(`,"1","대기",""`)
    expect(rows[3]).toContain(`,"2","취소",""`)
    expect(result.text).not.toContain(d.email)

    const logs = await csvLogs(sessionId)
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({ actorId: admin.id, sessionId, rowCount: 3 })
    expect(logs[0].applicationId ?? null).toBeNull()
    expect(JSON.stringify(logs)).not.toContain(marker)
  })

  it('신청이 없는 회차는 머리글 한 줄과 rowCount 0 기록', async () => {
    const { sessionId } = await createTourWithSession(payload, marker, 'csv-empty', { capacity: 5 })
    const result = await call(admin, String(sessionId))
    expect(result.status).toBe(200)
    expect(lines(result.text)).toHaveLength(1)
    const logs = await csvLogs(sessionId)
    expect(logs).toHaveLength(1)
    expect(logs[0].rowCount).toBe(0)
  })

  it('거부: 익명 403, cross-site 403, 형식 오류·없는 회차 404 — CSV 본문도 작업 기록도 없다', async () => {
    const { sessionId } = await createTourWithSession(payload, marker, 'csv-deny', { capacity: 5 })
    const app = await createApplication(sessionId, { partySize: 1 })

    const anonymous = await call(null, String(sessionId))
    expect(anonymous.status).toBe(403)
    expect(JSON.parse(anonymous.text)).toEqual({ code: 'FORBIDDEN' })

    const crossSite = await call(admin, String(sessionId), { 'sec-fetch-site': 'cross-site' })
    expect(crossSite.status).toBe(403)
    expect(JSON.parse(crossSite.text)).toEqual({ code: 'FORBIDDEN' })

    // 같은 출처·같은 사이트·직접 입력은 받는다(아래에서 기록 1건으로 확인 — 이 사례 전에는 0건)
    for (const id of ['2147483000', 'abc', '0', '-1', '2147483648', '1.5', '01', '']) {
      const missing = await call(admin, id)
      expect(missing.status, id).toBe(404)
      expect(JSON.parse(missing.text)).toEqual({ code: 'NOT_FOUND' })
      expect(missing.headers.get('cache-control')).toContain('no-store')
    }
    for (const rejected of [anonymous, crossSite]) {
      expect(rejected.text).not.toContain(app.email)
      expect(rejected.headers.get('content-disposition')).toBeNull()
      expect(rejected.headers.get('cache-control')).toContain('no-store')
    }
    expect(await csvLogs(sessionId)).toHaveLength(0)

    for (const site of ['same-origin', 'same-site', 'none']) {
      expect((await call(admin, String(sessionId), { 'sec-fetch-site': site })).status, site).toBe(200)
    }
    expect(await csvLogs(sessionId)).toHaveLength(3)
  })

  it('작업 기록이 실패하면 500 INTERNAL_ERROR이고 CSV가 없으며, 로그에 개인정보가 없다', async () => {
    const { sessionId } = await createTourWithSession(payload, marker, 'csv-fail', { capacity: 5 })
    const app = await createApplication(sessionId, {
      partySize: 1,
      requests: `${marker}-민감`,
      requestsConsentAt: new Date().toISOString(),
    })
    const original = payload.create.bind(payload)
    const createSpy = vi.spyOn(payload, 'create').mockImplementation(((args: { collection: string }) => {
      if (args.collection === 'admin-audit-logs') {
        return Promise.reject(new Error(`audit insert failed (test) ${app.email}`))
      }
      return original(args as never)
    }) as never)
    const logSpy = vi.spyOn(payload.logger, 'error')
    try {
      const result = await call(admin, String(sessionId))
      expect(result.status).toBe(500)
      expect(JSON.parse(result.text)).toEqual({ code: 'INTERNAL_ERROR' })
      expect(result.headers.get('content-disposition')).toBeNull()
      expect(result.text).not.toContain(app.email)
      expect(logSpy).toHaveBeenCalled()
      const logged = JSON.stringify(logSpy.mock.calls)
      expect(logged).toContain('INTERNAL_ERROR')
      for (const value of [app.email, app.name, app.phone, `${marker}-민감`]) {
        expect(logged).not.toContain(value)
      }
    } finally {
      createSpy.mockRestore()
      logSpy.mockRestore()
    }
    expect(await csvLogs(sessionId)).toHaveLength(0)
  })
})
