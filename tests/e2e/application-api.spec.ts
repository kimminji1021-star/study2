// 신청 API 권한 E2E — SPEC-APPLY-001 AC-APPLY-003(REST·GraphQL 부분), plan.md M5.
// - 대조군: 테스트 관리자 인증으로 같은 조회를 보내 준비한 신청이 실제로 보이는지 먼저 확인한다(빈 응답으로 통과하지 않게).
// - 생성·수정·삭제는 익명과 관리자 모두 정확히 403이고, 요청 뒤 데이터가 그대로다(Payload는 생성 접근 검사를 입력 검증보다 먼저 한다).
// - 익명 요청은 쿠키를 공유하지 않도록 새 요청 컨텍스트로 보낸다. 관리자 토큰은 출력하지 않는다.
import { expect, test, type APIRequestContext } from '@playwright/test'
import type { Payload } from 'payload'

import { applicationInput } from '../helpers/application-fixtures'
import { newMarker } from '../helpers/catalog-fixtures'
import { addE2eApplication, createE2eSession, createE2eTour } from '../helpers/e2e-apply'
import { cleanupCatalogFixture, getE2ePayload } from '../helpers/e2e-catalog'
import { E2E_BASE_URL } from '../helpers/e2e-env'
import { readTestAdmin } from '../helpers/test-admin'

const FORBIDDEN_MESSAGE = 'You are not allowed to perform this action.'

let payload: Payload
const marker = newMarker()
let prepared: { id: number; email: string; sessionId: number }
let anonymous: APIRequestContext
let admin: APIRequestContext

test.beforeAll(async ({ playwright }) => {
  payload = await getE2ePayload()
  const tour = await createE2eTour(payload, marker, 'api')
  const session = await createE2eSession(payload, tour.id, { days: 2, capacity: 10 })
  const application = await addE2eApplication(payload, session.id, marker, { partySize: 1 })
  prepared = { ...application, sessionId: session.id }

  anonymous = await playwright.request.newContext({ baseURL: E2E_BASE_URL })
  const login = await playwright.request.newContext({ baseURL: E2E_BASE_URL })
  try {
    const response = await login.post('/api/users/login', { data: readTestAdmin() })
    expect(response.status()).toBe(200)
    const { token } = (await response.json()) as { token?: string }
    expect(typeof token).toBe('string')
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
})

type ListResponse = { totalDocs?: number; docs?: Array<{ email?: string }> }
type GraphqlResponse = {
  data?: { Applications?: { docs: Array<{ email: string }> } | null }
  errors?: Array<{ message: string }>
}

function graphqlQuery(email: string): string {
  return `{ Applications(where: { email: { equals: "${email}" } }) { docs { email } } }`
}

test.describe('신청 조회 범위(AC-APPLY-003)', () => {
  test('REST: 관리자는 준비한 신청 1건을 보고, 익명은 403이거나 빈 결과다', async () => {
    const path = `/api/applications?where[email][equals]=${encodeURIComponent(prepared.email)}`

    const asAdmin = await admin.get(path)
    expect(asAdmin.status()).toBe(200)
    const adminBody = await asAdmin.text()
    expect((JSON.parse(adminBody) as ListResponse).totalDocs).toBe(1)
    expect(adminBody).toContain(prepared.email)

    const asAnonymous = await anonymous.get(path)
    const anonymousBody = await asAnonymous.text()
    expect([200, 403]).toContain(asAnonymous.status())
    if (asAnonymous.status() === 200) expect((JSON.parse(anonymousBody) as ListResponse).docs).toEqual([])
    expect(anonymousBody).not.toContain(prepared.email)
  })

  test('GraphQL: 관리자는 준비한 신청을 보고, 익명은 권한 오류이거나 빈 결과다', async () => {
    const asAdmin = await admin.post('/api/graphql', { data: { query: graphqlQuery(prepared.email) } })
    expect(asAdmin.status()).toBe(200)
    const adminBody = (await asAdmin.json()) as GraphqlResponse
    expect(adminBody.errors).toBeUndefined()
    expect(adminBody.data?.Applications?.docs.map((doc) => doc.email)).toContain(prepared.email)

    const asAnonymous = await anonymous.post('/api/graphql', { data: { query: graphqlQuery(prepared.email) } })
    const anonymousText = await asAnonymous.text()
    expect(anonymousText).not.toContain(prepared.email)
    const anonymousBody = JSON.parse(anonymousText) as GraphqlResponse
    const forbidden = (anonymousBody.errors ?? []).some((error) => error.message === FORBIDDEN_MESSAGE)
    const empty = (anonymousBody.data?.Applications?.docs ?? null)?.length === 0
    expect(forbidden || empty, anonymousText.slice(0, 300)).toBe(true)
  })
})

test.describe('신청 쓰기 거부(AC-APPLY-003)', () => {
  test('익명과 관리자의 REST 생성은 정확히 403이고 그 이메일의 신청이 생기지 않는다', async () => {
    for (const [who, context] of [
      ['anonymous', anonymous],
      ['admin', admin],
    ] as const) {
      const email = `${marker}-post-${who}@example.test`
      const response = await context.post('/api/applications', {
        data: applicationInput(prepared.sessionId, marker, { email }),
      })
      expect(response.status(), who).toBe(403)
      const found = await payload.count({ collection: 'applications', where: { email: { equals: email } } })
      expect(found.totalDocs, who).toBe(0)
    }
  })

  test('익명과 관리자의 REST 수정·삭제는 각각 정확히 403이고 신청이 그대로 대기 상태다', async () => {
    for (const [who, context] of [
      ['admin', admin],
      ['anonymous', anonymous],
    ] as const) {
      const patch = await context.patch(`/api/applications/${prepared.id}`, { data: { status: 'confirmed' } })
      expect(patch.status(), `${who} PATCH`).toBe(403)
      const remove = await context.delete(`/api/applications/${prepared.id}`)
      expect(remove.status(), `${who} DELETE`).toBe(403)
    }

    const after = await payload.findByID({ collection: 'applications', id: prepared.id, depth: 0 })
    expect(after.status).toBe('pending')
    expect(after.email).toBe(prepared.email)
  })
})
