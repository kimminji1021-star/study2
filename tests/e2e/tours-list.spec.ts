// 투어 목록 /tours E2E — AC-TOUR-010, AC-TOUR-014(배지 색·375px), plan.md M4.
// 개발 DB에 다른 투어가 있어도 흔들리지 않게 자기 표식이 붙은 카드만 찾는다(R15). 순서 검증은 단위 테스트가 맡는다.
import { expect, test, type Page } from '@playwright/test'
import type { Payload } from 'payload'

import { formatDuration, formatSessionDateTime } from '../../src/lib/format'
import { expectE2ePort } from '../helpers/e2e-assert'
import { cleanupCatalogFixture, createCatalogFixture, getE2ePayload, type CatalogFixture } from '../helpers/e2e-catalog'

let payload: Payload
let fixture: CatalogFixture

test.beforeAll(async () => {
  payload = await getE2ePayload()
  fixture = await createCatalogFixture(payload)
})

test.afterAll(async () => {
  if (payload !== undefined && fixture !== undefined) await cleanupCatalogFixture(payload, fixture.marker)
})

function cardOf(page: Page, title: string) {
  return page.locator('article').filter({ has: page.getByRole('heading', { name: title, exact: true }) })
}

test.describe('투어 목록', () => {
  test('/tours는 200으로 응답하고 모집 중 투어 카드에 요약·소요 시간·가격·가장 가까운 회차·남은 자리를 보여 준다', async ({
    page,
  }) => {
    const response = await page.goto('/tours')
    expectE2ePort(page)
    expect(response?.status()).toBe(200)

    const card = cardOf(page, fixture.open.title)
    await expect(card).toHaveCount(1)
    await expect(card).toContainText(`${fixture.open.slug} 요약`)
    await expect(card).toContainText(formatDuration(270))
    await expect(card).toContainText('45,000원 · 현장 결제')
    await expect(card).toContainText(formatSessionDateTime(fixture.open.sessionStarts.plus2))
    await expect(card).toContainText('남은 자리 11 / 11')

    const badge = card.locator('[data-status-badge]')
    await expect(badge).toHaveText('모집 중')
    await expect(badge.locator('svg')).toHaveCount(1)
    // AC-TOUR-014: 토큰 --status-open-bg(#e2f4ec)
    await expect(badge).toHaveCSS('background-color', 'rgb(226, 244, 236)')
  })

  test('대표 이미지는 대체 텍스트가 맞고 실제로 로드된다', async ({ page }) => {
    await page.goto('/tours')
    expectE2ePort(page)

    const image = cardOf(page, fixture.open.title).getByRole('img', { name: fixture.open.imageAlt, exact: true })
    await expect(image).toHaveCount(1)

    // R14: Payload는 파일 주소에 serverURL을 붙인다. E2E 서버(같은 출처)의 미디어 파일 경로를 가리키는지 확인하고 실제 값을 기록한다
    const src = (await image.getAttribute('src')) ?? ''
    test.info().annotations.push({ type: 'hero-image-src', description: src })
    const resolved = new URL(src, page.url())
    expect(resolved.origin).toBe(new URL(page.url()).origin)
    expect(resolved.pathname).toBe(`/api/media/file/${fixture.open.imageFilename}`)
    await image.scrollIntoViewIfNeeded()
    await expect
      .poll(() => image.evaluate((element: HTMLImageElement) => (element.complete ? element.naturalWidth : 0)))
      .toBeGreaterThan(0)
  })

  test('회차가 모두 마감된 투어는 "모집 마감" 배지와 자리표시 블록을 보여 주고 남은 자리를 보여 주지 않는다', async ({
    page,
  }) => {
    await page.goto('/tours')
    expectE2ePort(page)

    const card = cardOf(page, fixture.closed.title)
    await expect(card).toHaveCount(1)
    const badge = card.locator('[data-status-badge]')
    await expect(badge).toHaveText('모집 마감')
    await expect(badge.locator('svg')).toHaveCount(1)
    await expect(card).not.toContainText('남은 자리')
    await expect(card.locator('img')).toHaveCount(0)
    await expect(card.locator('[data-image-placeholder]')).toBeVisible()
  })

  test('공개되지 않은 투어는 목록에 나오지 않는다', async ({ page }) => {
    await page.goto('/tours')
    expectE2ePort(page)

    // 공개 투어 카드가 그려진 뒤에 확인한다(빈 화면에서 통과하는 경우 방지)
    await expect(cardOf(page, fixture.open.title)).toHaveCount(1)
    await expect(page.getByText(fixture.hidden.title)).toHaveCount(0)
  })

  test('카드를 누르면 그 투어의 상세 경로로 이동한다', async ({ page }) => {
    await page.goto('/tours')
    expectE2ePort(page)

    await cardOf(page, fixture.open.title).getByRole('link').click()
    await page.waitForURL((url) => url.pathname === `/tours/${fixture.open.slug}`)
    expectE2ePort(page)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(fixture.open.title)
  })

  test('375px 화면에서 가로 스크롤이 생기지 않는다', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/tours')
    expectE2ePort(page)

    await expect(cardOf(page, fixture.open.title)).toHaveCount(1)
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(scrollWidth).toBeLessThanOrEqual(375)
  })
})
