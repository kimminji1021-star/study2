// SPEC-ADMIN-001 M3 E2E — 관리자 신청 상세 화면과 요청 사항 삭제, 신청 수정의 REST·GraphQL 경로.
// - AC-ADMIN-002(GraphQL updateApplication), AC-ADMIN-003(상세·목록 화면), AC-ADMIN-005(REST 409·화면 알림),
//   AC-ADMIN-006(REST 409 SESSION_BUSY), AC-ADMIN-008(요청 사항 삭제 REST), AC-ADMIN-009(삭제 화면),
//   AC-ADMIN-015(작업 기록 REST 403, 관리자 화면의 작업 기록 목록·상세 읽기 전용 — M6).
// - 관리자는 준비 단계(global-setup.ts)가 만든 테스트 관리자만 쓴다. 요청 API는 로그인 토큰을 Authorization: JWT로 보낸다.
// - 데이터는 표식 투어(test-<무작위 값>…)에 만들고 끝나면 cleanupCatalogFixture가 신청 → 작업 기록 → 회차 → 투어 순서로 지운다.
// - 화면 증거(스크린숏)는 .moai/state/verify/admin-m3/에 남긴다(gitignore 대상).
import path from 'node:path'

import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import type { Payload } from 'payload'

import { applicationInput } from '../helpers/application-fixtures'
import { newMarker, repoRoot } from '../helpers/catalog-fixtures'
import { createE2eSession, createE2eTour } from '../helpers/e2e-apply'
import { cleanupCatalogFixture, getE2ePayload } from '../helpers/e2e-catalog'
import { E2E_BASE_URL } from '../helpers/e2e-env'
import { readTestAdmin } from '../helpers/test-admin'

const FORBIDDEN_MESSAGE = 'You are not allowed to perform this action.'
const SHOT_DIR = path.join(repoRoot, '.moai', 'state', 'verify', 'admin-m3')
const SHOT_DIR_M6 = path.join(repoRoot, '.moai', 'state', 'verify', 'admin-m6')

type Prepared = { id: number; referenceCode: string; requests?: string | null }

let payload: Payload
const marker = newMarker()
let anonymous: APIRequestContext
let admin: APIRequestContext
let sessionId: number
let busySessionId: number
let seq = 0
const apps: Record<string, Prepared> = {}

async function addApplication(session: number, overrides: Record<string, unknown> = {}): Promise<Prepared> {
  seq += 1
  const doc = await payload.create({
    collection: 'applications',
    data: applicationInput(session, marker, { email: `${marker}-ops-${seq}@example.test`, ...overrides }) as never,
  })
  return { id: doc.id, referenceCode: doc.referenceCode, requests: doc.requests }
}

async function readApplication(id: number) {
  return payload.findByID({ collection: 'applications', id, depth: 0 })
}

function cancelled(partySize: number) {
  return { status: 'cancelled', partySize, cancelledAt: new Date(Date.now() - 60_000).toISOString() }
}

function withRequests(text: string) {
  return { requests: text, requestsConsentAt: new Date().toISOString() }
}

async function loginAsAdmin(page: Page) {
  const credentials = readTestAdmin()
  await page.goto('/admin/login')
  await page.locator('#field-email').fill(credentials.email)
  await page.locator('#field-password').fill(credentials.password)
  await page.getByRole('button', { name: /login/i }).click()
  await page.waitForURL((url) => url.pathname === '/admin')
}

async function openDetail(page: Page, id: number) {
  await page.goto(`/admin/collections/applications/${id}`)
  await expect(page.locator('#field-status')).toBeVisible()
}

async function chooseStatus(page: Page, label: string) {
  await page.locator('#field-status .rs__control').click()
  await page.locator('.rs__option', { hasText: label }).click()
}

test.beforeAll(async ({ playwright }) => {
  payload = await getE2ePayload()
  const tour = await createE2eTour(payload, marker, 'admin-ops')
  sessionId = (await createE2eSession(payload, tour.id, { days: 2, capacity: 10 })).id
  const fullSessionId = (await createE2eSession(payload, tour.id, { days: 3, capacity: 3 })).id
  busySessionId = (await createE2eSession(payload, tour.id, { days: 4, capacity: 10 })).id

  apps.detail = await addApplication(sessionId, { partySize: 2 })
  apps.graphql = await addApplication(sessionId, { partySize: 1 })
  apps.clearApi = await addApplication(sessionId, { partySize: 1, ...withRequests(`${marker}-요청`) })
  apps.withRequests = await addApplication(sessionId, { partySize: 1, ...withRequests(`${marker}-민감`) })
  apps.noRequests = await addApplication(sessionId, { partySize: 1 })
  await addApplication(fullSessionId, { partySize: 2 })
  apps.overCapacity = await addApplication(fullSessionId, cancelled(2))
  apps.busy = await addApplication(busySessionId, cancelled(2))

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
  const logs = await payload.count({
    collection: 'admin-audit-logs',
    where: { sessionId: { in: [sessionId, busySessionId] } },
  })
  expect(logs.totalDocs).toBe(0)
})

test.describe('신청 수정 API(AC-ADMIN-002·005·006)', () => {
  test('GraphQL: 익명 updateApplication은 권한 오류이고 상태가 그대로, 관리자는 오류 없이 확정을 돌려받는다', async () => {
    const mutation = `mutation { updateApplication(id: ${apps.graphql.id}, data: { status: confirmed }) { status } }`

    const asAnonymous = await anonymous.post('/api/graphql', { data: { query: mutation } })
    const anonymousBody = (await asAnonymous.json()) as { errors?: Array<{ message: string }> }
    expect((anonymousBody.errors ?? []).map((error) => error.message)).toContain(FORBIDDEN_MESSAGE)
    expect((await readApplication(apps.graphql.id)).status).toBe('pending')

    const asAdmin = await admin.post('/api/graphql', { data: { query: mutation } })
    expect(asAdmin.status()).toBe(200)
    const adminBody = (await asAdmin.json()) as {
      data?: { updateApplication?: { status?: string } | null }
      errors?: unknown[]
    }
    expect(adminBody.errors).toBeUndefined()
    expect(adminBody.data?.updateApplication?.status).toBe('confirmed')
    expect((await readApplication(apps.graphql.id)).status).toBe('confirmed')
  })

  test('REST: 정원을 넘는 복원은 정확히 409 RESTORE_CAPACITY_EXCEEDED이고 신청이 취소 그대로다', async () => {
    const response = await admin.patch(`/api/applications/${apps.overCapacity.id}`, { data: { status: 'pending' } })
    expect(response.status()).toBe(409)
    const body = (await response.json()) as { errors?: Array<{ message?: string }> }
    expect(body.errors?.[0]?.message?.startsWith('RESTORE_CAPACITY_EXCEEDED:')).toBe(true)
    expect((await readApplication(apps.overCapacity.id)).status).toBe('cancelled')
  })

  test('REST: 회차 행이 잡혀 있으면 7초 안에 정확히 409 SESSION_BUSY이고 신청이 취소 그대로다', async () => {
    const pool = (payload.db as unknown as { pool: { connect: () => Promise<PoolClientLike> } }).pool
    const client = await pool.connect()
    let status = 0
    let message: string | undefined
    let elapsed = Number.POSITIVE_INFINITY
    try {
      await client.query('BEGIN')
      await client.query('SELECT id FROM tour_sessions WHERE id = $1 FOR UPDATE', [busySessionId])
      const started = Date.now()
      const response = await admin.patch(`/api/applications/${apps.busy.id}`, { data: { status: 'pending' } })
      elapsed = Date.now() - started
      status = response.status()
      message = ((await response.json()) as { errors?: Array<{ message?: string }> }).errors?.[0]?.message
    } finally {
      await client.query('ROLLBACK').catch(() => undefined)
      client.release()
    }

    expect(status).toBe(409)
    expect(message?.startsWith('SESSION_BUSY:')).toBe(true)
    expect(elapsed).toBeLessThan(7000)
    expect((await readApplication(apps.busy.id)).status).toBe('cancelled')
  })
})

type PoolClientLike = { query: (text: string, values?: unknown[]) => Promise<unknown>; release: () => void }

test.describe('요청 사항 삭제 API(AC-ADMIN-008)', () => {
  test('익명 403 FORBIDDEN, 관리자 200 cleared, 두 번째 409 REQUESTS_EMPTY, 없는 ID·형식 오류 404', async () => {
    const url = `/api/applications/${apps.clearApi.id}/clear-requests`

    const asAnonymous = await anonymous.post(url)
    expect(asAnonymous.status()).toBe(403)
    expect(((await asAnonymous.json()) as { code?: string }).code).toBe('FORBIDDEN')
    expect((await readApplication(apps.clearApi.id)).requests).toBe(`${marker}-요청`)

    const first = await admin.post(url)
    expect(first.status()).toBe(200)
    const firstText = await first.text()
    expect((JSON.parse(firstText) as { status?: string }).status).toBe('cleared')
    expect(firstText).not.toContain(marker)
    expect((await readApplication(apps.clearApi.id)).requests ?? null).toBeNull()

    const second = await admin.post(url)
    expect(second.status()).toBe(409)
    expect(((await second.json()) as { code?: string }).code).toBe('REQUESTS_EMPTY')

    for (const id of ['2147483000', 'abc']) {
      const missing = await admin.post(`/api/applications/${id}/clear-requests`)
      expect(missing.status(), id).toBe(404)
      expect(((await missing.json()) as { code?: string }).code, id).toBe('NOT_FOUND')
    }
  })
})

test.describe('작업 기록 쓰기 거부(AC-ADMIN-015)', () => {
  test('익명과 관리자의 작업 기록 POST·PATCH·DELETE는 정확히 403이고, 익명 조회는 403이거나 빈 결과다', async () => {
    const log = await payload.create({
      collection: 'admin-audit-logs',
      data: {
        action: 'application.requests_delete',
        occurredAt: new Date().toISOString(),
        sessionId,
        applicationId: apps.noRequests.id,
      } as never,
    })

    for (const [who, context] of [
      ['anonymous', anonymous],
      ['admin', admin],
    ] as const) {
      const create = await context.post('/api/admin-audit-logs', {
        data: { action: 'session.participants_csv', occurredAt: new Date().toISOString(), sessionId },
      })
      expect(create.status(), `${who} POST`).toBe(403)
      const patch = await context.patch(`/api/admin-audit-logs/${log.id}`, { data: { rowCount: 99 } })
      expect(patch.status(), `${who} PATCH`).toBe(403)
      const remove = await context.delete(`/api/admin-audit-logs/${log.id}`)
      expect(remove.status(), `${who} DELETE`).toBe(403)
    }
    const after = await payload.findByID({ collection: 'admin-audit-logs', id: log.id, depth: 0 })
    expect(after.rowCount ?? null).toBeNull()

    const list = await anonymous.get('/api/admin-audit-logs')
    expect([200, 403]).toContain(list.status())
    if (list.status() === 200) expect(((await list.json()) as { docs?: unknown[] }).docs).toEqual([])
  })

  test('관리자 화면: 작업 기록 목록이 보이고 새로 만들기가 없으며, 상세의 입력란은 편집할 수 없고 저장 버튼이 없다', async ({
    page,
  }) => {
    const log = await payload.create({
      collection: 'admin-audit-logs',
      data: {
        action: 'application.status_change',
        occurredAt: new Date().toISOString(),
        applicationId: apps.noRequests.id,
        referenceCode: apps.noRequests.referenceCode,
        sessionId,
        fromStatus: 'pending',
        toStatus: 'confirmed',
      } as never,
    })

    await loginAsAdmin(page)
    await page.goto('/admin/collections/admin-audit-logs')
    await expect(page.locator('tr', { hasText: apps.noRequests.referenceCode })).toBeVisible()
    await expect(page.getByRole('link', { name: /create new/i })).toHaveCount(0)
    await page.screenshot({ path: path.join(SHOT_DIR_M6, 'admin-audit-logs-list.png'), fullPage: true })

    await page.goto(`/admin/collections/admin-audit-logs/${log.id}`)
    await expect(page.locator('#field-referenceCode')).toHaveValue(apps.noRequests.referenceCode)
    for (const field of ['#field-referenceCode', '#field-actorId', '#field-applicationId', '#field-sessionId']) {
      await expect(page.locator(field), field).not.toBeEditable()
    }
    for (const select of ['#field-action', '#field-fromStatus', '#field-toStatus']) {
      await expect(page.locator(`${select} .rs__control--is-disabled`), select).toHaveCount(1)
    }
    await expect(page.locator('#action-save')).toHaveCount(0)
    await page.screenshot({ path: path.join(SHOT_DIR_M6, 'admin-audit-logs-detail.png'), fullPage: true })
  })
})

test.describe('관리자 신청 화면(AC-ADMIN-003·005·009)', () => {
  test('상세: 상태만 편집 가능하고, 확정으로 저장하면 접수 완료 화면의 상태가 정확히 확정이다', async ({ page }) => {
    await loginAsAdmin(page)
    await openDetail(page, apps.detail.id)

    for (const field of ['#field-name', '#field-email', '#field-phone', '#field-partySize', '#field-referenceCode']) {
      await expect(page.locator(field), field).not.toBeEditable()
    }
    await expect(page.locator('#field-status .rs__control--is-disabled')).toHaveCount(0)
    await page.locator('#field-status .rs__control').click()
    await expect(page.locator('.rs__option')).toHaveText(['대기', '확정', '취소'])
    await page.locator('.rs__option', { hasText: '확정' }).click()
    await page.screenshot({ path: path.join(SHOT_DIR, 'admin-detail-status-editable.png'), fullPage: true })

    await page.locator('#action-save').click()
    await expect(page.locator('[data-sonner-toast][data-type="success"]')).toBeVisible()
    await expect.poll(async () => (await readApplication(apps.detail.id)).status).toBe('confirmed')

    await page.goto(`/apply/complete/${apps.detail.referenceCode}`)
    const statusValue = page.locator('dt', { hasText: /^상태$/ }).locator('xpath=following-sibling::dd[1]')
    await expect(statusValue).toBeVisible()
    expect((await statusValue.textContent())?.trim()).toBe('확정')
    expect(await page.content()).not.toContain('대기 — 관리자 확인 후 확정')
  })

  test('목록: 새로 만들기 링크가 없고, 행을 골라도 편집·삭제 동작이 없다', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/collections/applications')
    const row = page.locator('tr', { hasText: apps.detail.referenceCode })
    await expect(row).toBeVisible()
    await expect(page.getByRole('link', { name: /create new/i })).toHaveCount(0)

    await row.locator('input[type="checkbox"]').check({ force: true })
    await expect(row.locator('input[type="checkbox"]')).toBeChecked()
    await expect(page.getByRole('button', { name: /^edit$/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^delete$/i })).toHaveCount(0)
  })

  test('상세: 정원을 넘는 복원을 저장하면 RESTORE_CAPACITY_EXCEEDED 알림이 보이고 신청이 취소 그대로다', async ({
    page,
  }) => {
    await loginAsAdmin(page)
    await openDetail(page, apps.overCapacity.id)
    await chooseStatus(page, '대기')
    await page.locator('#action-save').click()
    await expect(
      page.locator('[data-sonner-toast][data-type="error"]', { hasText: 'RESTORE_CAPACITY_EXCEEDED' }),
    ).toBeVisible()
    expect((await readApplication(apps.overCapacity.id)).status).toBe('cancelled')
  })

  test('요청 사항 삭제: 확인 단계에서 취소하면 그대로, 확인하면 지워지고 삭제 일시가 보이며 버튼이 사라진다', async ({
    page,
  }) => {
    const sensitive = `${marker}-민감`
    await loginAsAdmin(page)
    await openDetail(page, apps.withRequests.id)

    await expect(page.locator('#field-requests')).not.toBeEditable()
    await expect(page.locator('#field-requests')).toHaveValue(sensitive)
    const button = page.getByRole('button', { name: '요청 사항 삭제' })
    await expect(button).toBeVisible()
    await page.screenshot({ path: path.join(SHOT_DIR, 'admin-detail-clear-button.png'), fullPage: true })

    await button.click()
    const modal = page.locator('.confirmation-modal')
    await expect(modal).toBeVisible()
    await page.screenshot({ path: path.join(SHOT_DIR, 'admin-detail-clear-confirm.png'), fullPage: true })
    await modal.getByRole('button', { name: '취소' }).click()
    await expect(modal).toHaveCount(0)
    expect((await readApplication(apps.withRequests.id)).requests).toBe(sensitive)

    await button.click()
    await modal.getByRole('button', { name: '삭제' }).click()
    await expect(page.getByRole('button', { name: '요청 사항 삭제' })).toHaveCount(0)
    await expect.poll(async () => (await readApplication(apps.withRequests.id)).requests ?? null).toBeNull()

    await openDetail(page, apps.withRequests.id)
    await expect(page.locator('#field-requests')).toHaveValue('')
    const deletedAt = page.locator('.field-type', { has: page.getByText('요청 사항 삭제 일시') }).locator('input')
    await expect(deletedAt).not.toHaveValue('')
    await expect(page.getByRole('button', { name: '요청 사항 삭제' })).toHaveCount(0)
    expect(await page.content()).not.toContain(sensitive)
    await page.screenshot({ path: path.join(SHOT_DIR, 'admin-detail-after-clear.png'), fullPage: true })
  })

  test('요청 사항이 없는 신청의 상세에는 요청 사항 삭제 버튼이 없다', async ({ page }) => {
    await loginAsAdmin(page)
    await openDetail(page, apps.noRequests.id)
    await expect(page.locator('#field-requests')).toBeVisible()
    await expect(page.getByRole('button', { name: '요청 사항 삭제' })).toHaveCount(0)
  })
})
