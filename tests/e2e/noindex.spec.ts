// SPEC-DEPLOY-001 M4 E2E — 검색 제외 표시(AC-DEPLOY-012). 비공개 미리보기 동안 보호가 실수로 꺼져도 검색에 잡히지 않게 하는 이중 장치.
// robots.txt 전체 차단, 모든 응답의 X-Robots-Tag, 공개 화면 HTML의 로봇 메타 태그를 확인한다.
// 공개 투어 대표 이미지 주소는 카탈로그 준비 데이터(표식)로 만들고 끝나면 지운다.
import { expect, test } from '@playwright/test'
import type { Payload } from 'payload'

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

test.describe('검색 제외 표시(AC-DEPLOY-012)', () => {
  test('robots.txt는 모든 로봇에 모든 경로를 막고 사이트맵을 알리지 않는다', async ({ request }) => {
    const response = await request.get('/robots.txt')

    expect(response.status()).toBe(200)
    const body = await response.text()
    expect(body).toMatch(/^User-Agent: \*$/m)
    expect(body).toMatch(/^Disallow: \/$/m)
    expect(body).not.toMatch(/^Allow:/m)
    expect(body).not.toContain('Sitemap:')
  })

  test('공개 화면·관리자·API·이미지·404 응답 모두 X-Robots-Tag에 noindex, nofollow가 있다', async ({ request }) => {
    const targets: { path: string; status: number }[] = [
      { path: '/', status: 200 },
      { path: '/tours', status: 200 },
      { path: '/admin', status: 200 },
      { path: '/api/tours', status: 200 },
      { path: `/api/media/file/${fixture.open.imageFilename}`, status: 200 },
      { path: '/robots.txt', status: 200 },
      { path: '/no-such-page', status: 404 },
    ]
    expect(fixture.open.imageFilename).not.toBe('')

    for (const target of targets) {
      const response = await request.get(target.path)
      expect(response.status(), target.path).toBe(target.status)
      expect(response.headers()['x-robots-tag'] ?? '', target.path).toContain('noindex, nofollow')
    }
  })

  test('홈과 투어 목록 HTML에 noindex·nofollow 로봇 메타 태그가 정확히 1개 있다', async ({ page }) => {
    for (const pathname of ['/', '/tours']) {
      await page.goto(pathname)
      const robots = page.locator('head meta[name="robots"]')
      await expect(robots, pathname).toHaveCount(1)
      const content = (await robots.getAttribute('content')) ?? ''
      expect(content, pathname).toContain('noindex')
      expect(content, pathname).toContain('nofollow')
    }
  })
})
