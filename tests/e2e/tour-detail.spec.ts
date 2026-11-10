// 투어 상세 /tours/[slug] E2E — AC-TOUR-011·012, AC-TOUR-013(수정 반영), AC-TOUR-014(375px·44px), plan.md M4.
// 수정 반영 테스트는 투어 제목을 바꾸므로 이 파일의 마지막에 둔다(Playwright는 한 파일의 테스트를 적힌 순서대로 실행한다).
import { randomUUID } from 'node:crypto'

import { expect, test } from '@playwright/test'
import type { Payload } from 'payload'

import { formatDuration } from '../../src/lib/format'
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

test.describe('투어 상세', () => {
  test('제목·대표 이미지·설명 두 문단·소요 시간·집결 장소·가격을 보여 준다', async ({ page }) => {
    const response = await page.goto(`/tours/${fixture.open.slug}`)
    expectE2ePort(page)
    expect(response?.status()).toBe(200)

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(fixture.open.title)
    await expect(page.getByRole('img', { name: fixture.open.imageAlt, exact: true })).toHaveCount(1)
    // 설명의 빈 줄로 나뉜 두 문단은 서로 다른 <p>다(catalog-fixtures의 tourInput 설명 값)
    await expect(page.locator('p', { hasText: `${fixture.open.slug} 첫 문단` })).toHaveCount(1)
    await expect(page.locator('p', { hasText: '두 번째 문단' })).toHaveCount(1)
    await expect(page.locator('p', { hasText: `${fixture.open.slug} 첫 문단` })).not.toContainText('두 번째 문단')
    await expect(page.locator('main')).toContainText(formatDuration(270))
    await expect(page.locator('main')).toContainText(`${fixture.open.slug} 집결 장소`)
    await expect(page.locator('main')).toContainText('45,000원 · 현장 결제')
  })

  test('회차는 시작 시각 순서로 나오고 지난 회차는 나오지 않는다', async ({ page }) => {
    await page.goto(`/tours/${fixture.open.slug}`)
    expectE2ePort(page)

    const options = page.getByRole('radio')
    await expect(options).toHaveCount(3)
    const labels = page.locator('label').filter({ has: page.getByRole('radio') })
    await expect(labels.nth(0)).toContainText('남은 자리 11 / 11')
    await expect(labels.nth(1)).toContainText('남은 자리 13 / 13')
    await expect(labels.nth(2)).toContainText('남은 자리 12 / 12')
    await expect(page.locator('main')).not.toContainText('/ 19')
  })

  test('마감 회차는 선택할 수 없고 모집 중 회차는 한 번에 하나만 선택된다', async ({ page }) => {
    await page.goto(`/tours/${fixture.open.slug}`)
    expectE2ePort(page)

    const options = page.getByRole('radio')
    await expect(options).toHaveCount(3)
    const labels = page.locator('label').filter({ has: page.getByRole('radio') })

    await expect(options.nth(1)).toBeDisabled()
    await expect(labels.nth(1).locator('[data-status-badge]')).toHaveText('마감')
    await expect(labels.nth(0).locator('[data-status-badge]')).toHaveText('모집 중')

    await labels.nth(0).click()
    await expect(options.nth(0)).toBeChecked()
    await labels.nth(2).click()
    await expect(options.nth(2)).toBeChecked()
    await expect(options.nth(0)).not.toBeChecked()
    await expect(options.nth(1)).not.toBeChecked()
  })

  test('회차 선택 항목은 화살표 키로 옮겨 갈 수 있다(마감 회차는 건너뜀)', async ({ page }) => {
    await page.goto(`/tours/${fixture.open.slug}`)
    expectE2ePort(page)

    const options = page.getByRole('radio')
    await expect(options).toHaveCount(3)
    await options.nth(0).focus()
    await page.keyboard.press('ArrowDown')

    await expect(options.nth(2)).toBeFocused()
    await expect(options.nth(2)).toBeChecked()
  })

  test('예정된 회차가 없는 투어는 안내 문구를 보여 준다', async ({ page }) => {
    const response = await page.goto(`/tours/${fixture.empty.slug}`)
    expectE2ePort(page)
    expect(response?.status()).toBe(200)

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(fixture.empty.title)
    await expect(page.getByText('예정된 회차가 없습니다')).toBeVisible()
    await expect(page.getByRole('radio')).toHaveCount(0)
  })

  test('375px 화면에서 가로 스크롤이 없고 모집 중 회차 선택 영역은 44px 이상이다', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`/tours/${fixture.open.slug}`)
    expectE2ePort(page)

    const label = page.locator('label').filter({ hasText: '남은 자리 11 / 11' })
    await expect(label).toHaveCount(1)
    const box = await label.boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44)

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(scrollWidth).toBeLessThanOrEqual(375)
  })
})

test.describe('없는 투어와 공개되지 않은 투어', () => {
  test('없는 slug는 404', async ({ page }) => {
    const response = await page.goto(`/tours/test-${randomUUID().slice(0, 8)}-missing`)
    expectE2ePort(page)
    expect(response?.status()).toBe(404)
  })

  test('공개되지 않은 투어의 slug는 404이고 제목이 보이지 않는다', async ({ page }) => {
    const response = await page.goto(`/tours/${fixture.hidden.slug}`)
    expectE2ePort(page)
    expect(response?.status()).toBe(404)
    await expect(page.getByText(fixture.hidden.title)).toHaveCount(0)
  })

  test('형식에 맞지 않는 slug는 404', async ({ page }) => {
    const response = await page.goto('/tours/Not_A_Slug')
    expectE2ePort(page)
    expect(response?.status()).toBe(404)
  })
})

test.describe('관리자 수정 반영', () => {
  test('투어 제목을 바꾸면 새로고침한 상세와 목록에 새 제목이 보인다', async ({ page }) => {
    await page.goto(`/tours/${fixture.open.slug}`)
    expectE2ePort(page)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(fixture.open.title)

    const renamed = `${fixture.marker}-renamed`
    await payload.update({ collection: 'tours', id: fixture.open.id, data: { title: renamed } })

    await page.reload()
    expectE2ePort(page)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(renamed)

    await page.goto('/tours')
    expectE2ePort(page)
    await expect(page.getByRole('heading', { name: renamed, exact: true })).toHaveCount(1)
  })
})
