// SPEC-ADMIN-001 M5 E2E — 관리자 첫 화면의 회차 현황 표와 CSV 링크(AC-ADMIN-013, REQ-ADMIN-011, plan.md §B.6).
// - 준비 단계(global-setup.ts)가 만든 테스트 관리자로 /admin에 로그인한다. 실제 관리자 계정은 쓰지 않는다.
// - 개발 DB의 실제 회차도 표에 함께 보이므로 단언은 표식 투어 제목이 든 행만 대상으로 한다(plan.md §B.9).
// - 데이터는 표식 투어에 만들고 끝나면 cleanupCatalogFixture가 신청 → 작업 기록(CSV 내려받기 기록 포함) → 회차 → 투어 순서로 지운다.
// - 화면 증거(스크린숏)는 .moai/state/verify/admin-m5/에 남긴다(gitignore 대상).
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { expect, test, type Locator, type Page } from '@playwright/test'
import type { Payload } from 'payload'

import { formatSessionDateTime } from '../../src/lib/format'
import { newMarker, repoRoot } from '../helpers/catalog-fixtures'
import { addE2eApplication, createE2eSession, createE2eTour, type E2eSession, type E2eTour } from '../helpers/e2e-apply'
import { cleanupCatalogFixture, getE2ePayload } from '../helpers/e2e-catalog'
import { readTestAdmin } from '../helpers/test-admin'

const SHOT_DIR = path.join(repoRoot, '.moai', 'state', 'verify', 'admin-m5')

let payload: Payload
const marker = newMarker()
let publicTour: E2eTour
let privateTour: E2eTour
let s1: E2eSession
let s3: E2eSession

async function loginAsAdmin(page: Page) {
  const credentials = readTestAdmin()
  await page.goto('/admin/login')
  await page.locator('#field-email').fill(credentials.email)
  await page.locator('#field-password').fill(credentials.password)
  await page.getByRole('button', { name: /login/i }).click()
  await page.waitForURL((url) => url.pathname === '/admin')
}

function dashboardTable(page: Page): Locator {
  return page.getByRole('table', { name: '다가오는 회차 현황' })
}

function rowOf(page: Page, title: string): Locator {
  return dashboardTable(page).locator('tbody tr', { hasText: title })
}

test.beforeAll(async () => {
  payload = await getE2ePayload()
  publicTour = await createE2eTour(payload, marker, 'dashboard-open')
  s1 = await createE2eSession(payload, publicTour.id, { days: 2, capacity: 10 })
  await addE2eApplication(payload, s1.id, marker, { partySize: 1, status: 'pending' })
  await addE2eApplication(payload, s1.id, marker, { partySize: 1, status: 'pending' })
  await addE2eApplication(payload, s1.id, marker, { partySize: 3, status: 'confirmed' })

  privateTour = await createE2eTour(payload, marker, 'dashboard-hidden', false)
  s3 = await createE2eSession(payload, privateTour.id, { days: 3, capacity: 6 })
  await addE2eApplication(payload, s3.id, marker, { partySize: 2, status: 'confirmed' })
})

test.afterAll(async () => {
  if (payload === undefined) return
  await cleanupCatalogFixture(payload, marker)
  const left = await payload.count({ collection: 'applications', where: { email: { like: marker } } })
  expect(left.totalDocs).toBe(0)
  const logs = await payload.count({ collection: 'admin-audit-logs', where: { sessionId: { in: [s1.id, s3.id] } } })
  expect(logs.totalDocs).toBe(0)
})

test.describe('회차 현황 대시보드(AC-ADMIN-013)', () => {
  test('관리자 첫 화면: 열 머리글, 공개·비공개 투어 행의 값과 `비공개` 표시, CSV 링크 주소', async ({ page }) => {
    await loginAsAdmin(page)
    const table = dashboardTable(page)
    await expect(table).toBeVisible()
    for (const header of ['투어', '시작 일시', '정원', '대기', '확정', '남은 자리', '상태']) {
      await expect(table.getByRole('columnheader', { name: header, exact: true })).toBeVisible()
    }

    const publicRow = rowOf(page, publicTour.title)
    await expect(publicRow).toHaveCount(1)
    const publicCells = publicRow.locator('td')
    await expect(publicCells.nth(0)).toContainText(publicTour.title)
    await expect(publicCells.nth(0)).not.toContainText('비공개')
    await expect(publicCells.nth(1)).toHaveText(formatSessionDateTime(s1.startsAt))
    for (const [index, value] of ['10', '2', '3', '5', '모집 중'].entries()) {
      await expect(publicCells.nth(index + 2)).toHaveText(value)
    }
    await expect(publicRow.getByRole('link', { name: 'CSV 내려받기' })).toHaveAttribute(
      'href',
      `/api/tour-sessions/${s1.id}/participants-csv`,
    )

    const privateRow = rowOf(page, privateTour.title)
    await expect(privateRow).toHaveCount(1)
    const privateCells = privateRow.locator('td')
    await expect(privateCells.nth(0)).toContainText(privateTour.title)
    await expect(privateCells.nth(0)).toContainText('비공개')
    await expect(privateCells.nth(1)).toHaveText(formatSessionDateTime(s3.startsAt))
    for (const [index, value] of ['6', '0', '2', '4', '모집 중'].entries()) {
      await expect(privateCells.nth(index + 2)).toHaveText(value)
    }
    await expect(privateRow.getByRole('link', { name: 'CSV 내려받기' })).toHaveAttribute(
      'href',
      `/api/tour-sessions/${s3.id}/participants-csv`,
    )

    await table.scrollIntoViewIfNeeded()
    await page.screenshot({ path: path.join(SHOT_DIR, 'dashboard-full.png'), fullPage: true })
    await table.screenshot({ path: path.join(SHOT_DIR, 'dashboard-table.png') })
  })

  test('CSV 링크를 누르면 내려받기: 파일 이름 session-<S1>-participants.csv, BOM, 첫 줄 머리글', async ({ page }) => {
    await loginAsAdmin(page)
    const link = rowOf(page, publicTour.title).getByRole('link', { name: 'CSV 내려받기' })
    const [download] = await Promise.all([page.waitForEvent('download'), link.click()])
    expect(download.suggestedFilename()).toBe(`session-${s1.id}-participants.csv`)

    const bytes = await readFile(await download.path())
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const firstLine = bytes.toString('utf8').slice(1).split('\r\n')[0]
    expect(firstLine).toContain('접수번호')
  })

  test('로그인하지 않은 브라우저: /admin은 로그인 화면으로 이동하고 표가 없다', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForURL((url) => url.pathname === '/admin/login')
    await expect(page.locator('#field-email')).toBeVisible()
    await expect(dashboardTable(page)).toHaveCount(0)
    await page.screenshot({ path: path.join(SHOT_DIR, 'dashboard-anonymous-login.png') })
  })
})
