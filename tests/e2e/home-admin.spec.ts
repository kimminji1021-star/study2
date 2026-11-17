// 홈 화면 설정의 권한과 관리자 편집 E2E — SPEC-LANDING-001 M4: AC-LANDING-002(E2E 부분)·003(E2E 부분).
// - 요청 API: 익명 컨텍스트와 테스트 관리자 토큰(Authorization: JWT) 컨텍스트로 REST·GraphQL 권한을 확인한다.
// - 관리자 화면: 준비 단계(global-setup.ts)가 만든 테스트 관리자로만 로그인한다. 실제 관리자 계정은 쓰지 않는다.
// - 홈 화면 설정은 바꾸기 전에 원래 값을 파일에 남기고, 끝나면 되돌린 뒤 다시 읽어 같음을 확인한다(plan.md §B.11).
// - 대표 사진 선택은 업로드 선택 창 구조에 기대지 않도록 로컬 API로 정한다. 관리자 화면에서 사진을 올려 고르는 흐름은 사용자 수동 확인이다.
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import type { Payload } from 'payload'

import { newMarker } from '../helpers/catalog-fixtures'
import { expectE2ePort } from '../helpers/e2e-assert'
import { cleanupCatalogFixture, getE2ePayload } from '../helpers/e2e-catalog'
import { E2E_BASE_URL } from '../helpers/e2e-env'
import { setHomeSettings, whitePngFile } from '../helpers/home-fixtures'
import {
  HOME_SETTINGS_SLUG,
  readHomeSettings,
  restoreHomeSettingsOriginal,
  saveHomeSettingsOriginal,
} from '../helpers/home-settings-original'
import { readTestAdmin } from '../helpers/test-admin'

const FORBIDDEN_MESSAGE = 'You are not allowed to perform this action.'
const GLOBAL_PATH = `/api/globals/${HOME_SETTINGS_SLUG}`

let payload: Payload
let saved = false
const marker = newMarker()
let anonymous: APIRequestContext
let admin: APIRequestContext
let heroMedia: { id: number; path: string }

test.beforeAll(async ({ playwright }) => {
  payload = await getE2ePayload()
  // 설정을 바꾸는 어떤 일보다 먼저 원래 값을 파일에 남긴다
  await saveHomeSettingsOriginal(payload)
  saved = true

  // 어느 투어도 참조하지 않는 표식 미디어 h
  const media = await payload.create({
    collection: 'media',
    data: { alt: `${marker}-대표 사진` },
    file: whitePngFile(`${marker}-hero.png`),
  })
  // url이 절대 주소여도 E2E 서버의 같은 경로로 요청하도록 경로만 쓴다
  heroMedia = { id: media.id, path: new URL(media.url ?? '', E2E_BASE_URL).pathname }

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

// 설정을 먼저 되돌리고(표식 미디어를 가리키고 있을 수 있음) 표식 데이터를 지운다.
// Payload 인스턴스는 같은 워커의 다른 E2E 파일과 함께 쓰는 단일 인스턴스이므로 닫지 않는다
test.afterAll(async () => {
  await anonymous?.dispose()
  await admin?.dispose()
  if (payload === undefined) return
  try {
    if (saved) {
      const { expected, actual } = await restoreHomeSettingsOriginal(payload)
      expect(actual).toEqual(expected)
    }
  } finally {
    await cleanupCatalogFixture(payload, marker)
  }
})

async function loginAsAdmin(page: Page): Promise<void> {
  const credentials = readTestAdmin()
  await page.goto('/admin/login')
  expectE2ePort(page)
  await page.locator('#field-email').fill(credentials.email)
  await page.locator('#field-password').fill(credentials.password)
  await page.getByRole('button', { name: /login/i }).click()
  await page.waitForURL((url) => url.pathname === '/admin')
}

test.describe('AC-LANDING-002 전역 설정 접근 규칙(요청 API)', () => {
  test('REST: 익명 읽기는 200, 익명 수정은 정확히 403이고 값이 그대로, 관리자 수정은 200이다', async () => {
    await setHomeSettings(payload, { headline: null })

    const read = await anonymous.get(GLOBAL_PATH)
    expect(read.status()).toBe(200)

    const asAnonymous = await anonymous.post(GLOBAL_PATH, { data: { headline: `${marker}-익명` } })
    expect(asAnonymous.status()).toBe(403)
    expect((await readHomeSettings(payload)).headline).toBeNull()

    const asAdmin = await admin.post(GLOBAL_PATH, { data: { headline: `${marker}-관리자` } })
    expect(asAdmin.status()).toBe(200)
    expect((await readHomeSettings(payload)).headline).toBe(`${marker}-관리자`)
  })

  test('GraphQL: 익명 updateHomeSetting은 권한 오류이고 큰 제목이 그대로다', async () => {
    await setHomeSettings(payload, { headline: null })
    const mutation = `mutation { updateHomeSetting(data: { headline: "${marker}-익명" }) { headline } }`

    const response = await anonymous.post('/api/graphql', { data: { query: mutation } })
    const body = (await response.json()) as { errors?: Array<{ message: string }> }
    expect((body.errors ?? []).map((error) => error.message)).toContain(FORBIDDEN_MESSAGE)
    expect((await readHomeSettings(payload)).headline).toBeNull()
  })
})

test.describe('AC-LANDING-002 관리자 화면 편집', () => {
  test('메뉴에 홈 화면 설정이 있고, 큰 제목을 바꿔 저장하면 익명으로 연 /의 h1이 그 값이다', async ({
    page,
    browser,
  }) => {
    await setHomeSettings(payload, { headline: null, intro: null, heroImage: null })
    await loginAsAdmin(page)

    const menuLink = page.locator('nav').getByRole('link', { name: '홈 화면 설정' })
    await expect(menuLink.first()).toBeVisible()
    await expect(menuLink.first()).toHaveAttribute('href', `/admin/globals/${HOME_SETTINGS_SLUG}`)

    await page.goto(`/admin/globals/${HOME_SETTINGS_SLUG}`)
    expectE2ePort(page)
    const headline = page.locator('#field-headline')
    await expect(headline).toBeVisible()
    await headline.fill(`${marker}-화면편집`)
    await page.locator('#action-save').click()
    await expect(page.locator('[data-sonner-toast][data-type="success"]')).toBeVisible()
    await expect.poll(async () => (await readHomeSettings(payload)).headline).toBe(`${marker}-화면편집`)

    // 관리자 로그인 쿠키가 없는 새 브라우저 컨텍스트
    const visitor = await browser.newContext({ baseURL: E2E_BASE_URL })
    try {
      const home = await visitor.newPage()
      const response = await home.goto('/')
      expectE2ePort(home)
      expect(response?.status()).toBe(200)
      await expect(home.locator('h1')).toHaveText(`${marker}-화면편집`)
    } finally {
      await visitor.close()
    }
  })
})

test.describe('AC-LANDING-003 대표 사진 파일 주소(익명)', () => {
  test('대표 사진으로 정하면 익명 파일 요청이 200·image/png이고, 비우면 200이 아니다', async () => {
    await setHomeSettings(payload, { heroImage: heroMedia.id })
    const shown = await anonymous.get(heroMedia.path)
    expect(shown.status()).toBe(200)
    expect(shown.headers()['content-type']).toContain('image/png')

    await setHomeSettings(payload, { heroImage: null })
    const hidden = await anonymous.get(heroMedia.path)
    expect(hidden.status()).not.toBe(200)
  })
})
