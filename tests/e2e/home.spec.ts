// 홈 화면(/) E2E — SPEC-LANDING-001 M3: AC-LANDING-004·005·006·007(E2E 부분)·014(홈 부분)·015(새로고침 반영).
// 임시 홈 단언(SPEC-INFRA-001 AC-INFRA-008 홈 부분, SPEC-TOUR-001 AC-TOUR-015)을 이 기준으로 바꿨다. 각 페이지 방문 뒤 E2E 포트 단언은 유지한다.
// - 홈 화면 설정은 바꾸기 전에 원래 값을 파일에 남기고, 끝나면 되돌린 뒤 다시 읽어 같음을 확인한다(plan.md §B.11).
// - 각 시험은 자기가 필요한 설정 상태를 처음에 직접 만든다(앞 시험의 상태에 기대지 않음).
// - 추천 투어 기대값은 페이지를 열기 직전 로컬 API(listPublishedTours, 익명)로 정한다(개발 DB의 실제 투어가 섞임 — R9).
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import { expect, test, type Locator, type Page } from '@playwright/test'
import type { Payload } from 'payload'

import { listPublishedTours } from '../../src/lib/catalog'
import { HOME_DEFAULTS } from '../../src/lib/home-page'
import { newMarker, repoRoot } from '../helpers/catalog-fixtures'
import { createE2eSession, createE2eTour, type E2eTour } from '../helpers/e2e-apply'
import { expectE2ePort } from '../helpers/e2e-assert'
import { cleanupCatalogFixture, getE2ePayload } from '../helpers/e2e-catalog'
import { setHomeSettings, whitePngFile } from '../helpers/home-fixtures'
import { restoreHomeSettingsOriginal, saveHomeSettingsOriginal } from '../helpers/home-settings-original'

const ACCENT = 'rgb(0, 115, 122)'
const WHITE = 'rgb(255, 255, 255)'
const SURFACE_DARK = 'rgb(39, 39, 41)'
const SCREENSHOT_DIR = path.join(repoRoot, '.moai', 'state', 'verify', 'landing')

// 기본 뷰포트는 1440×900(acceptance.md 머리말 "뷰포트")
test.use({ viewport: { width: 1440, height: 900 } })

let payload: Payload
let saved = false
const marker = newMarker()
let heroMedia: { id: number; filename: string; alt: string }
let publicTour: E2eTour
let hiddenTour: E2eTour

test.beforeAll(async () => {
  payload = await getE2ePayload()
  // 설정을 바꾸는 어떤 일보다 먼저 원래 값을 파일에 남긴다
  await saveHomeSettingsOriginal(payload)
  saved = true

  const media = await payload.create({
    collection: 'media',
    data: { alt: `${marker}-대표 사진` },
    file: whitePngFile(`${marker}-hero.png`),
  })
  heroMedia = { id: media.id, filename: media.filename ?? '', alt: media.alt }

  publicTour = await createE2eTour(payload, marker, 'home')
  await createE2eSession(payload, publicTour.id, { days: 2, capacity: 10 })
  hiddenTour = await createE2eTour(payload, marker, 'home-hidden', false)
  await createE2eSession(payload, hiddenTour.id, { days: 2, capacity: 10 })
})

// 설정을 먼저 되돌리고(표식 미디어를 가리키고 있을 수 있음) 표식 데이터를 지운다.
// Payload 인스턴스는 같은 워커의 다른 E2E 파일과 함께 쓰는 단일 인스턴스이므로 닫지 않는다
test.afterAll(async () => {
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

async function openHome(page: Page): Promise<void> {
  const response = await page.goto('/')
  expectE2ePort(page)
  expect(response?.status()).toBe(200)
}

function heroOf(page: Page): Locator {
  return page.locator('section', { has: page.locator('h1') })
}

function recommendedOf(page: Page): Locator {
  return page.locator('section', { has: page.getByRole('heading', { level: 2, name: '추천 투어' }) })
}

function cardOf(scope: Page | Locator, slug: string): Locator {
  return scope.locator(`article:has(a[href="/tours/${slug}"])`)
}

test.describe('AC-LANDING-004 큰 제목·소개와 기본 문구', () => {
  test('설정이 비면 h1 → 소개 → 투어 둘러보기 순서로 기본 문구가 보이고, 투어 둘러보기는 /tours로 간다', async ({
    page,
  }) => {
    await setHomeSettings(payload, { headline: null, intro: null, heroImage: null })
    await openHome(page)

    const hero = heroOf(page)
    await expect(hero).toHaveCount(1)
    const heading = hero.locator('h1')
    const intro = hero.locator('p')
    const cta = hero.getByRole('link', { name: '투어 둘러보기' })
    await expect(heading).toHaveText(HOME_DEFAULTS.headline, { useInnerText: true })
    await expect(intro).toHaveCount(1)
    await expect(intro).toHaveText(HOME_DEFAULTS.intro)
    await expect(cta).toHaveCount(1)
    await expect(cta).toHaveAttribute('href', '/tours')

    // 문서 순서: h1이 소개보다, 소개가 버튼보다 앞
    const ordered = await hero.evaluate((section) => {
      const [h1, p, a] = [
        section.querySelector('h1'),
        section.querySelector('p'),
        Array.from(section.querySelectorAll('a')).find((link) => link.textContent?.trim() === '투어 둘러보기'),
      ]
      if (!h1 || !p || !a) return false
      const follows = (first: Node, second: Node) =>
        (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
      return follows(h1, p) && follows(p, a)
    })
    expect(ordered).toBe(true)

    await cta.click()
    await page.waitForURL((url) => url.pathname === '/tours')
    expectE2ePort(page)
  })

  test('사용자 문구는 앞뒤 공백만 빼고 HTML로 해석하지 않는다', async ({ page }) => {
    await setHomeSettings(payload, { headline: `${marker} <b>굵게</b>`, intro: `  ${marker}-소개  `, heroImage: null })
    await openHome(page)

    const hero = heroOf(page)
    await expect(hero.locator('h1')).toHaveText(`${marker} <b>굵게</b>`)
    await expect(hero.locator('h1 b')).toHaveCount(0)
    await expect(hero.locator('p')).toHaveText(`${marker}-소개`)
  })

  test('홈 화면에 임시 홈의 준비 중 안내가 없다', async ({ page }) => {
    await setHomeSettings(payload, { headline: null, intro: null, heroImage: null })
    await openHome(page)

    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.getByText('서비스를 준비 중입니다')).toHaveCount(0)
  })
})

test.describe('AC-LANDING-005 대표 사진이 있을 때와 없을 때', () => {
  test('(a) 대표 사진을 정했다가 비우면 히어로에 이미지가 없고 짙은 면이며 미리 받기·파일 요청도 없다', async ({
    page,
  }) => {
    await setHomeSettings(payload, { heroImage: heroMedia.id })
    await setHomeSettings(payload, { heroImage: null })

    const heroRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes(heroMedia.filename)) heroRequests.push(request.url())
    })
    await openHome(page)
    await page.waitForLoadState('networkidle')

    const hero = heroOf(page)
    await expect(hero.locator('img')).toHaveCount(0)
    await expect(hero).toHaveCSS('background-color', SURFACE_DARK)
    await expect(page.locator('head link[rel="preload"][as="image"]')).toHaveCount(0)
    expect(heroRequests).toEqual([])
  })

  test('(b) 대표 사진이 있으면 히어로 이미지가 하나이고 대체 텍스트·응답·미리 받기 링크가 맞다', async ({ page }) => {
    await setHomeSettings(payload, { heroImage: heroMedia.id })

    const heroResponses: number[] = []
    page.on('response', (response) => {
      if (response.url().includes(heroMedia.filename)) heroResponses.push(response.status())
    })
    await openHome(page)

    const image = heroOf(page).locator('img')
    await expect(image).toHaveCount(1)
    await expect(image).toHaveAttribute('alt', heroMedia.alt)
    await expect
      .poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth))
      .toBeGreaterThan(0)

    expect(heroResponses.length, '대표 사진 파일 요청이 있어야 한다').toBeGreaterThanOrEqual(1)
    expect(heroResponses.filter((status) => status !== 200)).toEqual([])

    // plan-audit O2-1: (a)의 0개 단언이 잘못된 선택자로 우연히 통과하지 않도록, 같은 선택자로 1개 이상을 확인한다
    const preloadHrefs = await page
      .locator('head link[rel="preload"][as="image"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''))
    expect(preloadHrefs.filter((href) => href.includes(heroMedia.filename)).length).toBeGreaterThanOrEqual(1)
  })

  test('(c) 대표 사진 미디어를 지우면 히어로에 이미지가 없고 200이다', async ({ page }) => {
    const disposable = await payload.create({
      collection: 'media',
      data: { alt: `${marker}-지울 사진` },
      file: whitePngFile(`${marker}-hero-delete.png`),
    })
    await setHomeSettings(payload, { heroImage: disposable.id })
    await payload.delete({ collection: 'media', id: disposable.id })

    await openHome(page)
    await expect(heroOf(page).locator('img')).toHaveCount(0)
  })
})

test.describe('AC-LANDING-006 짙은 히어로의 대비(E2E)', () => {
  test('순백 대표 사진 위에서 덮개·글자·버튼·포커스가 정한 색이고 히어로 안에 포인트 색이 없다', async ({ page }) => {
    await setHomeSettings(payload, { heroImage: heroMedia.id, headline: null, intro: null })
    await openHome(page)

    const hero = heroOf(page)
    await expect(hero.locator('[data-hero-overlay]')).toHaveCSS('background-color', 'rgba(29, 29, 31, 0.65)')
    await expect(hero.locator('h1')).toHaveCSS('color', WHITE)
    await expect(hero.locator('p')).toHaveCSS('color', WHITE)

    const cta = hero.getByRole('link', { name: '투어 둘러보기' })
    await expect(cta).toHaveCSS('background-color', WHITE)
    await expect(cta).toHaveCSS('color', 'rgb(29, 29, 31)')

    // 키보드 Tab으로 버튼까지 이동한다(본문 바로가기 → 머리글 링크 2개 → 버튼)
    for (let presses = 0; presses < 8; presses += 1) {
      await page.keyboard.press('Tab')
      if ((await page.evaluate(() => document.activeElement?.textContent?.trim())) === '투어 둘러보기') break
    }
    await expect(cta).toBeFocused()
    await expect(cta).toHaveCSS('outline-style', 'solid')
    await expect(cta).toHaveCSS('outline-color', WHITE)
    const outlineWidth = await cta.evaluate((element) => Number.parseFloat(getComputedStyle(element).outlineWidth))
    expect(outlineWidth).toBeGreaterThanOrEqual(2)

    // 버튼에 포커스가 있는 상태로 히어로(section 자신 포함) 모든 요소의 색 속성을 훑는다
    const scan = await hero.evaluate((section) => {
      const elements = [section, ...Array.from(section.querySelectorAll('*'))]
      const values = elements.flatMap((element) => {
        const style = getComputedStyle(element)
        return [style.color, style.backgroundColor, style.borderColor, style.outlineColor]
      })
      return { count: elements.length, values }
    })
    expect(scan.count, '검사한 요소가 3개 이상이어야 한다').toBeGreaterThanOrEqual(3)
    expect(scan.values.filter((value) => value.includes(ACCENT))).toEqual([])
  })
})

test.describe('AC-LANDING-007 추천 투어(E2E)', () => {
  test('추천 투어 카드가 listPublishedTours 앞 6개와 순서·남은 자리까지 같고 투어 전체 보기가 /tours로 간다', async ({
    page,
  }) => {
    await setHomeSettings(payload, { heroImage: null })
    const expected = (await listPublishedTours(payload)).slice(0, 6)
    expect(expected.length, '공개 투어가 1개 이상 있어야 한다(준비 단계의 표식 투어)').toBeGreaterThanOrEqual(1)

    await openHome(page)

    const section = recommendedOf(page)
    await expect(section).toHaveCount(1)
    const cards = section.locator('article')
    await expect(cards).toHaveCount(expected.length)
    await expect(cards.locator('h3')).toHaveText(expected.map((tour) => tour.title))

    const homeTexts = await Promise.all(expected.map((tour) => cardOf(section, tour.slug).innerText()))

    const more = section.getByRole('link', { name: '투어 전체 보기' })
    await expect(more).toHaveAttribute('href', '/tours')
    await expect(page.getByText(hiddenTour.title)).toHaveCount(0)
    await expect(page.locator('h2')).toHaveCount(1)
    await expect(page.locator('h2')).toHaveText('추천 투어')

    // 같은 투어의 /tours 카드 문구(가장 가까운 회차·남은 자리 포함)와 같다
    const response = await page.goto('/tours')
    expectE2ePort(page)
    expect(response?.status()).toBe(200)
    const listTexts = await Promise.all(expected.map((tour) => cardOf(page, tour.slug).innerText()))
    expect(homeTexts).toEqual(listTexts)

    await openHome(page)
    await recommendedOf(page).getByRole('link', { name: '투어 전체 보기' }).click()
    await page.waitForURL((url) => url.pathname === '/tours')
    expectE2ePort(page)
  })
})

test.describe('AC-LANDING-014 제목 단계(홈 부분)', () => {
  test('/의 추천 투어는 h2이고 카드 제목 h3 수가 카드 수와 같으며, /tours의 카드 제목은 계속 h2다', async ({
    page,
  }) => {
    await openHome(page)
    const section = recommendedOf(page)
    const cardCount = await section.locator('article').count()
    expect(cardCount).toBeGreaterThanOrEqual(1)
    await expect(section.locator('article h3')).toHaveCount(cardCount)
    await expect(section.locator('article h2')).toHaveCount(0)

    const response = await page.goto('/tours')
    expectE2ePort(page)
    expect(response?.status()).toBe(200)
    const listCount = await page.locator('article').count()
    expect(listCount).toBeGreaterThanOrEqual(1)
    await expect(page.locator('article h2')).toHaveCount(listCount)
    await expect(page.locator('article h3')).toHaveCount(0)
  })
})

test.describe('AC-LANDING-015 설정 반영(새로고침)', () => {
  test('/를 연 뒤 큰 제목을 바꾸고 새로고침하면 새 제목이 보인다', async ({ page }) => {
    await setHomeSettings(payload, { headline: null })
    await openHome(page)
    await expect(page.locator('h1')).toHaveText(HOME_DEFAULTS.headline)

    await setHomeSettings(payload, { headline: `${marker}-갱신` })
    await page.reload()
    expectE2ePort(page)
    await expect(page.locator('h1')).toHaveText(`${marker}-갱신`)
  })
})

test.describe('홈 화면 스크린숏(AC-LANDING-016 홈 부분)', () => {
  test('대표 사진 없음·있음을 1440과 375에서 전체 페이지로 남긴다', async ({ page }) => {
    await mkdir(SCREENSHOT_DIR, { recursive: true })
    const shots = [
      { name: 'home-dark', heroImage: null },
      { name: 'home-photo', heroImage: heroMedia.id },
    ]
    for (const { name, heroImage } of shots) {
      await setHomeSettings(payload, { heroImage, headline: null, intro: null })
      for (const viewport of [
        { width: 1440, height: 900 },
        { width: 375, height: 812 },
      ]) {
        await page.setViewportSize(viewport)
        await openHome(page)
        await page.waitForLoadState('networkidle')
        await page.evaluate(() => document.fonts.ready.then(() => undefined))
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}-${viewport.width}.png`), fullPage: true })
      }
    }
  })
})
