// SPEC-DEPLOY-001 M2 E2E — 예약 정리 엔드포인트 인증(AC-DEPLOY-007)과 바뀐 동의 고지·버전(AC-DEPLOY-010).
// - 서버의 CRON_SECRET은 playwright.config.ts가 러너 프로세스에서 한 번 만든 무작위 값이며, 테스트는 같은 process.env 값을 읽는다.
// - 경로 우선순위: 인증 없는 요청이 Payload REST 경로((payload)/api/[...slug])의 JSON 오류가 아니라 정리 처리기의 401이어야 한다.
// - 정리: 표식 시도 기록은 테스트 안에서, 신청·회차·투어는 cleanupCatalogFixture(표식)가, 시도 기록은 IP 키로 지운다.
import { expect, test, type Page } from '@playwright/test'
import type { Payload } from 'payload'

import { PRIVACY_POLICY_VERSION, REQUIRED_CONSENT } from '../../src/lib/consent'
import { cleanupAttempts, testIpPool } from '../helpers/application-fixtures'
import { newMarker } from '../helpers/catalog-fixtures'
import { createE2eSession, createE2eTour, randomDigits, type E2eSession } from '../helpers/e2e-apply'
import { expectE2ePort } from '../helpers/e2e-assert'
import { cleanupCatalogFixture, getE2ePayload } from '../helpers/e2e-catalog'

const CRON_PATH = '/api/cron/cleanup'
const ELEVEN_MINUTES_MS = 11 * 60 * 1000

let payload: Payload
const marker = newMarker()
const ips = testIpPool('203.0.113', 250)
let session: E2eSession

/** 서버와 같은 시험용 비밀값(playwright.config.ts가 만든 값). 값은 출력하지 않는다. */
function cronSecret(): string {
  const secret = process.env.CRON_SECRET ?? ''
  expect(secret.length, 'CRON_SECRET 시험용 값이 있어야 한다').toBeGreaterThanOrEqual(16)
  return secret
}

test.beforeAll(async () => {
  payload = await getE2ePayload()
  const tour = await createE2eTour(payload, marker, 'consent')
  session = await createE2eSession(payload, tour.id, { days: 2, capacity: 10 })
})

test.afterAll(async () => {
  if (payload === undefined) return
  await payload.delete({ collection: 'application-attempts', where: { keyHash: { like: marker } } })
  await cleanupAttempts(payload, ips.used())
  await cleanupCatalogFixture(payload, marker)
})

test.describe('정리 엔드포인트 인증(AC-DEPLOY-007)', () => {
  test('머리글 없음·틀린 값은 401(정리 처리기의 고정 문구)이고 아무것도 지우지 않는다', async ({ request }) => {
    const secret = cronSecret()
    const expired = await payload.create({
      collection: 'application-attempts',
      data: { keyHash: `${marker}-cron-401`, attemptedAt: new Date(Date.now() - ELEVEN_MINUTES_MS).toISOString() },
    })
    const stillThere = async () =>
      (await payload.count({ collection: 'application-attempts', where: { id: { equals: expired.id } } })).totalDocs

    expect(await stillThere()).toBe(1)

    const missing = await request.get(CRON_PATH)
    expect(missing.status()).toBe(401)
    const body = await missing.text()
    expect(body).toBe('Unauthorized')
    expect(body).not.toContain(secret)
    // Payload REST 경로의 JSON 오류({"errors": …})가 아니다
    expect(missing.headers()['content-type'] ?? '').not.toContain('application/json')
    expect(body).not.toContain('errors')

    const wrong = await request.get(CRON_PATH, { headers: { authorization: `Bearer ${secret.slice(0, -1)}x` } })
    expect(wrong.status()).toBe(401)
    expect(await wrong.text()).toBe('Unauthorized')

    expect(await stillThere()).toBe(1)
    await payload.delete({ collection: 'application-attempts', where: { id: { equals: expired.id } } })
  })

  test('GET 외 메서드는 맞는 머리글이어도 405이고 Allow: GET을 알린다', async ({ request }) => {
    const response = await request.post(CRON_PATH, { headers: { authorization: `Bearer ${cronSecret()}` } })

    expect(response.status()).toBe(405)
    expect(response.headers()['allow']).toBe('GET')
  })

  test('맞는 머리글의 GET은 200, 행 수 JSON 두 키, Cache-Control: no-store', async ({ request }) => {
    const response = await request.get(CRON_PATH, { headers: { authorization: `Bearer ${cronSecret()}` } })

    expect(response.status()).toBe(200)
    expect(response.headers()['cache-control'] ?? '').toContain('no-store')
    const body = (await response.json()) as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(['attemptsDeleted', 'auditLogsDeleted'])
    for (const value of Object.values(body)) {
      expect(Number.isInteger(value)).toBe(true)
      expect(value as number).toBeGreaterThanOrEqual(0)
    }
  })
})

async function submitApplication(page: Page, email: string): Promise<void> {
  await page.getByLabel('이름', { exact: true }).fill(`${marker}-이름`)
  await page.getByLabel('이메일', { exact: true }).fill(email)
  await page.getByLabel('연락처', { exact: true }).fill(`010-55${randomDigits(6)}`)
  await page.getByLabel('인원', { exact: true }).selectOption('1')
  await page.getByRole('checkbox', { name: /개인정보 수집·이용에 동의합니다/ }).check()
  await page.getByRole('checkbox', { name: /만 14세 이상입니다/ }).check()
  await page.getByRole('button', { name: '신청 접수하기' }).click()
  await page.waitForURL((url) => url.pathname.startsWith('/apply/complete/'))
}

test.describe('IP 변환값 보관 고지와 문구 버전(AC-DEPLOY-010)', () => {
  test('신청 화면에 새 "수집 항목" 문구가 보이고, 신청의 동의 버전이 새 PRIVACY_POLICY_VERSION이다', async ({
    page,
  }) => {
    const collected = REQUIRED_CONSENT.items.find((item) => item.label === '수집 항목')?.text ?? ''
    expect(collected).toContain('늦어도 72시간 안에 삭제')
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': ips.next() })

    await page.goto(`/apply?session=${session.id}`)
    expectE2ePort(page)
    await expect(page.locator('main')).toContainText(collected)

    const email = `${marker}-consent@example.test`
    await submitApplication(page, email)
    expectE2ePort(page)

    const saved = await payload.find({ collection: 'applications', where: { email: { equals: email } }, depth: 0 })
    expect(saved.totalDocs).toBe(1)
    expect(saved.docs[0].privacyPolicyVersion).toBe(PRIVACY_POLICY_VERSION)
  })
})
