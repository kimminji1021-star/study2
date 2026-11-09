// 임시 홈 페이지 E2E 스모크 — AC-INFRA-008(홈 부분)
import { expect, test } from '@playwright/test'

// 각 페이지 방문 뒤 E2E 전용 포트에서 응답했는지 확인한다(개발 서버 3000을 잘못 테스트하는 경우 방지)
import { expectE2ePort } from '../helpers/e2e-assert'

// Tailwind 유틸리티 `text-4xl`의 글자 크기(2.25rem, 루트 16px 기준)
const HEADING_FONT_SIZE = '36px'

test.describe('임시 홈 페이지', () => {
  test('/는 200으로 응답하고 숨비투어 제목과 준비 중 문구를 보여 준다', async ({ page }) => {
    const response = await page.goto('/')
    expectE2ePort(page)

    expect(response?.status()).toBe(200)
    await expect(page.locator('h1')).toContainText('숨비투어')
    await expect(page.getByText(/준비 중/)).toBeVisible()
  })

  test('제목의 글자 크기는 Tailwind 유틸리티 값이며 브라우저 기본값과 다르다', async ({ page, context }) => {
    // 스타일시트가 없는 빈 페이지에서 h1의 브라우저 기본 글자 크기를 잰다
    const blank = await context.newPage()
    await blank.setContent('<h1>기본</h1>')
    const browserDefault = await blank.locator('h1').evaluate((element) => getComputedStyle(element).fontSize)
    await blank.close()
    expect(browserDefault).not.toBe(HEADING_FONT_SIZE)

    await page.goto('/')
    expectE2ePort(page)

    await expect(page.locator('h1')).toHaveCSS('font-size', HEADING_FONT_SIZE)
  })
})
