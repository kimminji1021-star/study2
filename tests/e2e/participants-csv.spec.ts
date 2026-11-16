// SPEC-ADMIN-001 M4 E2E — 참가자 CSV 내려받기 경로(AC-ADMIN-011, REQ-ADMIN-009·010·013, plan.md §B.5).
// - 요청 API로 GET /api/tour-sessions/<id>/participants-csv를 보낸다. 관리자는 준비 단계(global-setup.ts)가 만든 테스트 관리자이며
//   로그인 토큰을 Authorization: JWT로 보낸다.
// - 데이터는 표식 투어(test-<무작위 값>…)에 만들고 끝나면 cleanupCatalogFixture가 신청 → 작업 기록 → 회차 → 투어 순서로 지운다.
import { expect, test, type APIRequestContext } from '@playwright/test'
import type { Payload } from 'payload'

import { applicationInput } from '../helpers/application-fixtures'
import { newMarker } from '../helpers/catalog-fixtures'
import { createE2eSession, createE2eTour } from '../helpers/e2e-apply'
import { cleanupCatalogFixture, getE2ePayload } from '../helpers/e2e-catalog'
import { E2E_BASE_URL } from '../helpers/e2e-env'
import { readTestAdmin } from '../helpers/test-admin'

type Prepared = { id: number; referenceCode: string; email: string; name: string; phone: string }

let payload: Payload
const marker = newMarker()
let anonymous: APIRequestContext
let admin: APIRequestContext
let adminId: number
let sessionS: number
let sessionT: number
const apps: Record<'A' | 'B' | 'C' | 'D', Prepared> = {} as never
let seq = 0

async function addApplication(session: number, overrides: Record<string, unknown>): Promise<Prepared> {
  seq += 1
  const doc = await payload.create({
    collection: 'applications',
    data: applicationInput(session, marker, { email: `${marker}-csv-${seq}@example.test`, ...overrides }) as never,
  })
  return { id: doc.id, referenceCode: doc.referenceCode, email: doc.email, name: doc.name, phone: doc.phone }
}

function csvPath(id: number | string) {
  return `/api/tour-sessions/${id}/participants-csv`
}

test.beforeAll(async ({ playwright }) => {
  payload = await getE2ePayload()
  const tour = await createE2eTour(payload, marker, 'csv')
  sessionS = (await createE2eSession(payload, tour.id, { days: 2, capacity: 10 })).id
  sessionT = (await createE2eSession(payload, tour.id, { days: 3, capacity: 10 })).id

  // 이 순서로 만든다(신청 시각 순 = A, B, C)
  apps.A = await addApplication(sessionS, { partySize: 1, status: 'pending' })
  apps.B = await addApplication(sessionS, {
    partySize: 2,
    status: 'cancelled',
    cancelledAt: new Date(Date.now() - 60_000).toISOString(),
  })
  apps.C = await addApplication(sessionS, {
    partySize: 3,
    status: 'confirmed',
    requests: `=HYPERLINK("x")${marker}`,
    requestsConsentAt: new Date().toISOString(),
  })
  apps.D = await addApplication(sessionT, { partySize: 1 })

  anonymous = await playwright.request.newContext({ baseURL: E2E_BASE_URL })
  const login = await playwright.request.newContext({ baseURL: E2E_BASE_URL })
  try {
    const response = await login.post('/api/users/login', { data: readTestAdmin() })
    expect(response.status()).toBe(200)
    const { token, user } = (await response.json()) as { token?: string; user?: { id?: number } }
    expect(typeof token).toBe('string')
    expect(typeof user?.id).toBe('number')
    adminId = user?.id as number
    admin = await playwright.request.newContext({
      baseURL: E2E_BASE_URL,
      extraHTTPHeaders: { Authorization: `JWT ${token}` },
    })
  } finally {
    await login.dispose()
  }
})

test.afterAll(async () => {
  await anonymous?.dispose()
  await admin?.dispose()
  if (payload === undefined) return
  await cleanupCatalogFixture(payload, marker)
  const left = await payload.count({ collection: 'applications', where: { email: { like: marker } } })
  expect(left.totalDocs).toBe(0)
  const logs = await payload.count({
    collection: 'admin-audit-logs',
    where: { sessionId: { in: [sessionS, sessionT] } },
  })
  expect(logs.totalDocs).toBe(0)
})

test.describe('참가자 CSV 내려받기(AC-ADMIN-011)', () => {
  test.describe.configure({ mode: 'serial' })

  test('거부: 익명·cross-site 403, 형식 오류·없는 회차 404 — CSV 본문이 없다', async () => {
    const rejected = [
      { response: await anonymous.get(csvPath(sessionS)), status: 403, code: 'FORBIDDEN' },
      {
        response: await admin.get(csvPath(sessionS), { headers: { 'Sec-Fetch-Site': 'cross-site' } }),
        status: 403,
        code: 'FORBIDDEN',
      },
      { response: await admin.get(csvPath(2147483000)), status: 404, code: 'NOT_FOUND' },
      { response: await admin.get(csvPath('abc')), status: 404, code: 'NOT_FOUND' },
    ]
    for (const { response, status, code } of rejected) {
      expect(response.status()).toBe(status)
      const text = await response.text()
      expect(JSON.parse(text)).toEqual({ code })
      expect(text).not.toContain(apps.A.email)
      expect(response.headers()['content-disposition']).toBeUndefined()
    }
  })

  test('관리자: 200, 머리글, BOM, A·B·C 순서와 상태, 다른 회차 제외, 수식 주입 방어, URL·파일 이름에 개인정보 없음', async () => {
    const url = csvPath(sessionS)
    const response = await admin.get(url)
    expect(response.status()).toBe(200)
    const headers = response.headers()
    expect(headers['content-type'].startsWith('text/csv')).toBe(true)
    expect(headers['content-type']).toContain('charset=utf-8')
    expect(headers['content-disposition']).toBe(`attachment; filename="session-${sessionS}-participants.csv"`)
    expect(headers['cache-control']).toContain('no-store')

    const bytes = await response.body()
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const text = bytes.toString('utf8').slice(1)
    expect(text.endsWith('\r\n')).toBe(true)
    const lines = text.slice(0, -2).split('\r\n')
    expect(lines).toHaveLength(4)
    expect(lines[0]).toBe('"접수번호","이름","연락처","이메일","인원","상태","요청 사항"')
    expect(lines[1].startsWith(`"${apps.A.referenceCode}",`)).toBe(true)
    expect(lines[2].startsWith(`"${apps.B.referenceCode}",`)).toBe(true)
    expect(lines[3].startsWith(`"${apps.C.referenceCode}",`)).toBe(true)
    expect(lines[1]).toContain(',"1","대기",')
    expect(lines[2]).toContain(',"2","취소",')
    expect(lines[3]).toContain(',"3","확정",')
    expect(lines[3].endsWith(`,"'=HYPERLINK(""x"")${marker}"`)).toBe(true)
    expect(text).not.toContain(apps.D.email)

    for (const value of [url, headers['content-disposition']]) {
      for (const secret of [apps.A.name, apps.A.email, apps.A.phone, marker]) {
        expect(value).not.toContain(secret)
      }
    }
  })

  test('작업 기록: S의 CSV 기록이 정확히 1건(관리자 ID, 회차 S, 행 수 3) — 거부된 요청은 남기지 않는다', async () => {
    const result = await payload.find({
      collection: 'admin-audit-logs',
      where: { and: [{ sessionId: { equals: sessionS } }, { action: { equals: 'session.participants_csv' } }] },
      depth: 0,
      pagination: false,
    })
    expect(result.docs).toHaveLength(1)
    expect(result.docs[0]).toMatchObject({ actorId: adminId, sessionId: sessionS, rowCount: 3 })
  })
})
