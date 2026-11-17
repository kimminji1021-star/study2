// 디자인 값·375px 화면·스크린숏 E2E — SPEC-LANDING-001 M4: AC-LANDING-013, AC-LANDING-016(스크린숏 중 /tours·상세·404).
// - 홈 스크린숏 4개와 AC-LANDING-015 새로고침 시험은 home.spec.ts(M3)에 있다. 여기서는 겹쳐 만들지 않는다.
// - 대표 사진이 비어 있어야 하므로 홈 화면 설정의 원래 값을 먼저 파일에 남기고, 끝나면 되돌린 뒤 같음을 확인한다(plan.md §B.11).
// - 준비 단계가 표식 공개 투어(모집 중 회차)를 만들고, 정리 단계가 표식으로 지운다.
import { mkdir, stat } from 'node:fs/promises'
import path from 'node:path'

import { expect, test, type Locator, type Page } from '@playwright/test'
import type { Payload } from 'payload'

import { newMarker, repoRoot } from '../helpers/catalog-fixtures'
import { createE2eSession, createE2eTour, type E2eTour } from '../helpers/e2e-apply'
import { expectE2ePort } from '../helpers/e2e-assert'
import { cleanupCatalogFixture, getE2ePayload } from '../helpers/e2e-catalog'
import { setHomeSettings } from '../helpers/home-fixtures'
import { restoreHomeSettingsOriginal, saveHomeSettingsOriginal } from '../helpers/home-settings-original'

const SCREENSHOT_DIR = path.join(repoRoot, '.moai', 'state', 'verify', 'landing')
const DESKTOP = { width: 1440, height: 900 }
const MOBILE = { width: 375, height: 812 }
const TOUCH_MIN = 44

let payload: Payload
let saved = false
const marker = newMarker()
let tour: E2eTour

test.beforeAll(async () => {
  payload = await getE2ePayload()
  await saveHomeSettingsOriginal(payload)
  saved = true

  tour = await createE2eTour(payload, marker, 'responsive')
  await createE2eSession(payload, tour.id, { days: 2, capacity: 10 })
  await setHomeSettings(payload, { heroImage: null, headline: null, intro: null })
})

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

async function openPage(page: Page, target: string, status = 200): Promise<void> {
  const response = await page.goto(target)
  expectE2ePort(page)
  expect(response?.status(), target).toBe(status)
}

function heroOf(page: Page): Locator {
  return page.locator('section', { has: page.locator('h1') })
}

function recommendedOf(page: Page): Locator {
  return page.locator('section', { has: page.getByRole('heading', { level: 2, name: '추천 투어' }) })
}

async function styleOf(locator: Locator, property: string): Promise<string> {
  return locator.evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property)
}

test.describe('AC-LANDING-013 디자인 값(1440)', () => {
  test.use({ viewport: DESKTOP })

  test('/의 본문 크기·제목 무게와 자간·알약 버튼·그림자 없음·면 색이 정한 값이다', async ({ page }) => {
    await openPage(page, '/')

    const body = page.locator('body')
    await expect(body).toHaveCSS('font-size', '17px')
    await expect(body).toHaveCSS('line-height', '24.99px')

    const heading = heroOf(page).locator('h1')
    await expect(heading).toHaveCSS('font-weight', '600')
    expect(Number.parseFloat(await styleOf(heading, 'letter-spacing'))).toBeLessThan(0)

    for (const name of ['투어 둘러보기', '투어 전체 보기']) {
      const button = page.getByRole('link', { name, exact: true })
      await expect(button, name).toHaveCount(1)
      await expect(button, name).toHaveCSS('border-top-left-radius', '9999px')
      await expect(button, name).toHaveCSS('box-shadow', 'none')
    }

    const cards = recommendedOf(page).locator('article')
    const cardCount = await cards.count()
    expect(cardCount, '추천 투어 카드가 1개 이상 있어야 한다').toBeGreaterThanOrEqual(1)
    const shadows = await cards.evaluateAll((elements) =>
      elements.map((element) => getComputedStyle(element).boxShadow),
    )
    expect(shadows).toEqual(Array.from({ length: cardCount }, () => 'none'))

    await expect(heroOf(page)).toHaveCSS('background-color', 'rgb(39, 39, 41)')
    await expect(recommendedOf(page)).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    await expect(page.getByRole('contentinfo')).toHaveCSS('background-color', 'rgb(245, 245, 247)')
  })
})

test.describe('AC-LANDING-013 375px 화면', () => {
  test.use({ viewport: MOBILE })

  test('/의 본문 크기가 16px이다', async ({ page }) => {
    await openPage(page, '/')
    await expect(page.locator('body')).toHaveCSS('font-size', '16px')
  })

  test('/, /tours, 투어 상세에 가로 스크롤이 없다', async ({ page }) => {
    for (const target of ['/', '/tours', `/tours/${tour.slug}`]) {
      await openPage(page, target)
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(scrollWidth, target).toBeLessThanOrEqual(MOBILE.width)
    }
  })

  test('/의 머리글 링크 2개·투어 둘러보기·투어 전체 보기의 터치 영역이 44px 이상이다', async ({ page }) => {
    await openPage(page, '/')

    const headerLinks = page.getByRole('banner').locator('a')
    await expect(headerLinks).toHaveCount(2)
    const targets: { name: string; locator: Locator }[] = [
      { name: '머리글 숨비투어', locator: headerLinks.nth(0) },
      { name: '머리글 투어', locator: headerLinks.nth(1) },
      { name: '투어 둘러보기', locator: page.getByRole('link', { name: '투어 둘러보기', exact: true }) },
      { name: '투어 전체 보기', locator: page.getByRole('link', { name: '투어 전체 보기', exact: true }) },
    ]
    for (const { name, locator } of targets) {
      const box = await locator.boundingBox()
      expect(box, name).not.toBeNull()
      expect(box?.width ?? 0, `${name} 너비`).toBeGreaterThanOrEqual(TOUCH_MIN)
      expect(box?.height ?? 0, `${name} 높이`).toBeGreaterThanOrEqual(TOUCH_MIN)
    }
  })
})

test.describe('화면 스크린숏(AC-LANDING-016 — /tours·투어 상세·404)', () => {
  test('/tours, 투어 상세, 404를 1440과 375에서 전체 페이지로 남긴다', async ({ page }) => {
    await mkdir(SCREENSHOT_DIR, { recursive: true })
    const shots = [
      { name: 'tours', target: '/tours', status: 200 },
      { name: 'tour-detail', target: `/tours/${tour.slug}`, status: 200 },
      { name: 'not-found', target: '/no-such-page', status: 404 },
    ]
    for (const { name, target, status } of shots) {
      for (const viewport of [DESKTOP, MOBILE]) {
        await page.setViewportSize(viewport)
        await openPage(page, target, status)
        await page.waitForLoadState('networkidle')
        await page.evaluate(() => document.fonts.ready.then(() => undefined))
        const file = path.join(SCREENSHOT_DIR, `${name}-${viewport.width}.png`)
        await page.screenshot({ path: file, fullPage: true })
        expect((await stat(file)).size, file).toBeGreaterThan(0)
      }
    }
  })
})
