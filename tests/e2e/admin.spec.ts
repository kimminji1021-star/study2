// 관리자 화면 E2E — AC-INFRA-008(관리자 부분), plan.md M5·R14.
// 테스트 관리자 계정은 tests/e2e/global-setup.ts가 테스트 시작 전에 만들고 끝나면 지운다.
// 비밀번호는 실행할 때마다 새로 만들고 화면·로그에 출력하지 않는다.
import { expect, test } from '@playwright/test'

import { expectE2ePort } from '../helpers/e2e-assert'
import { readTestAdmin } from '../helpers/test-admin'

test.describe('관리자 화면', () => {
  test('/admin/login은 이메일·비밀번호 입력란과 로그인 버튼을 보여 준다', async ({ page }) => {
    await page.goto('/admin/login')
    expectE2ePort(page)

    await expect(page.locator('#field-email')).toBeVisible()
    await expect(page.locator('#field-password')).toBeVisible()
    await expect(page.getByRole('button', { name: /login/i })).toBeVisible()
    // 사용자가 한 명도 없으면 /admin/create-first-user로 이동한다. 준비 단계가 계정을 먼저 만들었으므로 그대로 머문다
    expect(new URL(page.url()).pathname).toBe('/admin/login')
    expectE2ePort(page)
  })

  test('테스트 관리자 계정으로 로그인하면 /admin으로 이동하고 대시보드가 보인다', async ({ page }) => {
    const admin = readTestAdmin()

    await page.goto('/admin/login')
    expectE2ePort(page)

    await page.locator('#field-email').fill(admin.email)
    await page.locator('#field-password').fill(admin.password)
    await page.getByRole('button', { name: /login/i }).click()

    await page.waitForURL((url) => url.pathname === '/admin')
    expectE2ePort(page)
    await expect(page.locator('.dashboard')).toBeVisible()
  })
})
