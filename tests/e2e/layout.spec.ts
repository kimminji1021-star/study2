// 공통 머리글·바닥글·404·글꼴·접근성 E2E — SPEC-LANDING-001 AC-LANDING-009·010·011·012(E2E 부분)·014(공통 부분), plan.md M2.
// - 공개 화면 6개(acceptance.md 머리말): /, /tours, /tours/<공개 투어>, /apply?session=<모집 중 회차>, /apply/complete/<접수 번호>, /tours/<없는 slug>.
// - 준비 단계가 표식 투어·회차·신청을 로컬 API로 만들고, 정리 단계가 cleanupCatalogFixture(표식)로 신청 → 회차 → 투어 순서로 지운다.
// - 홈 화면 고유 단언(추천 투어 h2·카드 h3 등)은 M3에서 더한다.
import { expect, test, type Page } from '@playwright/test'
import type { Payload } from 'payload'

import { applicationInput } from '../helpers/application-fixtures'
import { newMarker } from '../helpers/catalog-fixtures'
import { createE2eSession, createE2eTour, type E2eTour } from '../helpers/e2e-apply'
import { expectE2ePort } from '../helpers/e2e-assert'
import { cleanupCatalogFixture, getE2ePayload } from '../helpers/e2e-catalog'
import { E2E_BASE_URL } from '../helpers/e2e-env'

const NOT_FOUND_HEADING = '페이지를 찾을 수 없습니다'
const SKIP_LINK_NAME = '본문 바로가기'
// 브라우저가 Tab으로 포커스할 수 있는 요소(숨김 입력·비활성 요소·tabindex -1 제외)
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

let payload: Payload
const marker = newMarker()
let tour: E2eTour
let publicPages: { name: string; path: string; status: number }[]

test.beforeAll(async () => {
  payload = await getE2ePayload()

  tour = await createE2eTour(payload, marker, 'layout')
  const session = await createE2eSession(payload, tour.id, { days: 2, capacity: 10 })
  // 접수 완료 화면용 신청(이메일 `<표식>-1@example.test` — 정리 조건에 걸린다)
  const application = await payload.create({
    collection: 'applications',
    data: applicationInput(session.id, marker, { email: `${marker}-1@example.test`, partySize: 1 }) as never,
  })

  publicPages = [
    { name: '홈', path: '/', status: 200 },
    { name: '투어 목록', path: '/tours', status: 200 },
    { name: '투어 상세', path: `/tours/${tour.slug}`, status: 200 },
    { name: '신청', path: `/apply?session=${session.id}`, status: 200 },
    { name: '접수 완료', path: `/apply/complete/${application.referenceCode}`, status: 200 },
    { name: '사용자 화면 404', path: `/tours/${marker}-missing`, status: 404 },
  ]
})

// Payload 인스턴스는 같은 워커의 다른 E2E 파일과 함께 쓰는 단일 인스턴스이므로 여기서 닫지 않는다(다음 파일의 DB 연결이 끊긴다)
test.afterAll(async () => {
  if (payload !== undefined) await cleanupCatalogFixture(payload, marker)
})

async function openPage(page: Page, path: string, status: number): Promise<void> {
  const response = await page.goto(path)
  expectE2ePort(page)
  expect(response?.status(), path).toBe(status)
}

test.describe('AC-LANDING-009 공통 머리글', () => {
  test('공개 화면 6개의 머리글은 하나이고 링크가 숨비투어(/)·투어(/tours) 둘뿐이며 제목·버튼·로그인 문구가 없다', async ({
    page,
  }) => {
    for (const { name, path, status } of publicPages) {
      await openPage(page, path, status)

      const banner = page.getByRole('banner')
      await expect(banner, name).toHaveCount(1)

      const links = banner.locator('a')
      await expect(links, name).toHaveCount(2)
      await expect(links.nth(0), name).toHaveText('숨비투어')
      await expect(links.nth(0), name).toHaveAttribute('href', '/')
      await expect(links.nth(1), name).toHaveText('투어')
      await expect(links.nth(1), name).toHaveAttribute('href', '/tours')

      await expect(banner.locator('h1, h2, h3, h4, h5, h6'), name).toHaveCount(0)
      await expect(banner.locator('button'), name).toHaveCount(0)
      for (const text of ['로그인', '회원가입', 'English']) {
        await expect(banner, `${name} — ${text}`).not.toContainText(text)
      }
    }
  })

  test('머리글의 숨비투어는 /로, 투어는 /tours로 이동한다', async ({ page }) => {
    await openPage(page, '/tours', 200)
    await page.getByRole('banner').getByRole('link', { name: '숨비투어', exact: true }).click()
    await page.waitForURL((url) => url.pathname === '/')
    expectE2ePort(page)

    await page.getByRole('banner').getByRole('link', { name: '투어', exact: true }).click()
    await page.waitForURL((url) => url.pathname === '/tours')
    expectE2ePort(page)
  })

  test('/admin 로그인 화면에는 숨비투어(/) 링크가 없다', async ({ page }) => {
    await openPage(page, '/admin', 200)
    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible()

    await expect(page.locator('a[href="/"]', { hasText: '숨비투어' })).toHaveCount(0)
  })
})

test.describe('AC-LANDING-010 바닥글과 처리방침 자리표시', () => {
  test('공개 화면 6개의 바닥글은 하나이고 두 문구가 있으며 링크가 없고, 페이지에 죽은 링크가 없다', async ({
    page,
  }) => {
    for (const { name, path, status } of publicPages) {
      await openPage(page, path, status)

      const footer = page.getByRole('contentinfo')
      await expect(footer, name).toHaveCount(1)
      await expect(footer, name).toContainText('© 숨비투어')
      await expect(footer, name).toContainText('개인정보 처리방침(준비 중)')
      await expect(footer.locator('a'), name).toHaveCount(0)

      // 페이지 자신의 마크업만 본다(개발 도구의 섀도 DOM은 제외)
      const hrefs = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a'), (anchor) => anchor.getAttribute('href')),
      )
      expect(hrefs.length, `${name} — a 요소가 1개 이상 있어야 한다`).toBeGreaterThanOrEqual(1)
      expect(
        hrefs.filter((href) => href === null || href.trim() === '' || href.trim() === '#'),
        name,
      ).toEqual([])
    }
  })
})

test.describe('AC-LANDING-011 처리하지 않는 주소의 404', () => {
  for (const path of ['/no-such-page', '/a/b/c']) {
    test(`${path}는 머리글·바닥글이 있는 사용자 화면 404다`, async ({ page }) => {
      await openPage(page, path, 404)

      await expect(page.locator('h1')).toHaveText(NOT_FOUND_HEADING)
      await expect(page.getByRole('banner')).toHaveCount(1)
      await expect(page.getByRole('contentinfo')).toHaveCount(1)
    })
  }

  test('/tours/<없는 slug>도 같은 머리글·바닥글이 있는 404다', async ({ page }) => {
    await openPage(page, `/tours/${marker}-missing`, 404)

    await expect(page.locator('h1')).toHaveText(NOT_FOUND_HEADING)
    await expect(page.getByRole('banner')).toHaveCount(1)
    await expect(page.getByRole('contentinfo')).toHaveCount(1)
  })

  test('/admin은 Payload 로그인 화면이고 사용자 화면 머리글이 없다', async ({ page }) => {
    await openPage(page, '/admin', 200)

    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible()
    await expect(page.locator('a[href="/tours"]', { hasText: '투어' })).toHaveCount(0)
    await expect(page.getByText(SKIP_LINK_NAME)).toHaveCount(0)
  })

  test('익명 GET /api/tours?limit=1은 200 JSON이다', async ({ request }) => {
    const response = await request.get(`${E2E_BASE_URL}/api/tours?limit=1`)

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('application/json')
  })
})

// 계산된 font-family 목록을 이름 단위로 나누고 따옴표를 뗀다
function fontFamilyNames(value: string): string[] {
  return value.split(',').map((name) => name.trim().replace(/^["']|["']$/g, ''))
}

test.describe('AC-LANDING-012 Pretendard 직접 호스팅(E2E)', () => {
  test('/는 같은 출처의 /_next/static/media/ 글꼴만 받고 외부 출처 요청이 없으며 본문 글꼴이 불러온 Pretendard다', async ({
    page,
  }) => {
    const fontUrls: string[] = []
    const foreignUrls: string[] = []
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (url.protocol === 'data:' || url.protocol === 'blob:') return
      if (url.origin !== E2E_BASE_URL) foreignUrls.push(request.url())
      if (request.resourceType() === 'font') fontUrls.push(request.url())
    })

    await openPage(page, '/', 200)
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready.then(() => undefined))

    expect(fontUrls.length, 'font 요청이 1개 이상 있어야 한다').toBeGreaterThanOrEqual(1)
    for (const fontUrl of fontUrls) {
      const url = new URL(fontUrl)
      expect(url.origin).toBe(E2E_BASE_URL)
      expect(url.pathname.startsWith('/_next/static/media/'), url.pathname).toBe(true)
    }
    expect(foreignUrls).toEqual([])

    const fontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily)
    const names = fontFamilyNames(fontFamily)
    expect(names).toContain('Pretendard Variable')
    expect(names.at(-1)).toBe('sans-serif')

    const firstName = names[0] ?? ''
    const statuses = await page.evaluate((family) => {
      const unquote = (value: string) => value.replace(/^["']|["']$/g, '')
      return Array.from(document.fonts)
        .filter((face) => unquote(face.family) === family)
        .map((face) => face.status)
    }, firstName)
    expect(statuses.length, `${firstName} FontFace가 있어야 한다`).toBeGreaterThanOrEqual(1)
    expect(statuses).toContain('loaded')
  })

  test('/admin은 공개 화면에서 받은 Pretendard 파일을 요청하지 않는다', async ({ page }) => {
    const publicFontPaths = new Set<string>()
    const collect = (target: Set<string>) => (request: { url(): string; resourceType(): string }) => {
      const url = new URL(request.url())
      if (request.resourceType() === 'font' && url.pathname.includes('/_next/static/media/')) target.add(url.pathname)
    }

    const onPublic = collect(publicFontPaths)
    page.on('request', onPublic)
    await openPage(page, '/', 200)
    await page.waitForLoadState('networkidle')
    page.off('request', onPublic)
    expect(publicFontPaths.size, '공개 화면에서 글꼴 요청이 있어야 한다').toBeGreaterThanOrEqual(1)

    const adminFontPaths = new Set<string>()
    page.on('request', collect(adminFontPaths))
    await openPage(page, '/admin', 200)
    await page.waitForLoadState('networkidle')

    expect([...adminFontPaths].filter((fontPath) => publicFontPaths.has(fontPath))).toEqual([])
  })
})

test.describe('AC-LANDING-014 랜드마크·본문 바로가기·움직임(공통 부분)', () => {
  test('공개 화면 6개에 banner·main·contentinfo·h1이 각각 하나이고 문서 언어가 ko다', async ({ page }) => {
    for (const { name, path, status } of publicPages) {
      await openPage(page, path, status)

      await expect(page.getByRole('banner'), name).toHaveCount(1)
      await expect(page.getByRole('main'), name).toHaveCount(1)
      await expect(page.getByRole('contentinfo'), name).toHaveCount(1)
      await expect(page.locator('h1'), name).toHaveCount(1)
      await expect(page.locator('html'), name).toHaveAttribute('lang', 'ko')
    }
  })

  for (const path of ['/', '/tours']) {
    test(`${path}의 첫 Tab은 보이는 본문 바로가기이고, 누른 뒤 다음 Tab은 main의 첫 포커스 요소다`, async ({
      page,
    }) => {
      await openPage(page, path, 200)

      await page.keyboard.press('Tab')
      const skipLink = page.locator(':focus')
      await expect(skipLink).toHaveText(SKIP_LINK_NAME)
      expect(await skipLink.evaluate((element) => element.tagName)).toBe('A')

      const box = await skipLink.boundingBox()
      const viewport = page.viewportSize()
      expect(box).not.toBeNull()
      expect(viewport).not.toBeNull()
      if (box && viewport) {
        expect(box.width).toBeGreaterThan(0)
        expect(box.height).toBeGreaterThan(0)
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.y).toBeGreaterThanOrEqual(0)
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
      }

      await page.keyboard.press('Enter')
      await page.keyboard.press('Tab')

      const result = await page.evaluate((selector) => {
        const main = document.querySelector('main')
        const first = main?.querySelector(selector) ?? null
        const active = document.activeElement
        return {
          hasFirst: first !== null,
          insideMain: main !== null && active !== null && main.contains(active),
          isFirst: first !== null && active === first,
        }
      }, FOCUSABLE_SELECTOR)
      expect(result.hasFirst, 'main 안에 포커스 가능한 요소가 있어야 한다').toBe(true)
      expect(result.insideMain).toBe(true)
      expect(result.isFirst).toBe(true)
    })
  }

  test('/에는 기본 설정과 동작 줄이기 모두 애니메이션·동영상·marquee가 없다', async ({ page }) => {
    for (const reducedMotion of ['no-preference', 'reduce'] as const) {
      await page.emulateMedia({ reducedMotion })
      await openPage(page, '/', 200)

      const animated = await page.evaluate(() =>
        Array.from(document.querySelectorAll('*'))
          .filter((element) => getComputedStyle(element).animationName !== 'none')
          .map((element) => element.tagName),
      )
      expect(animated, reducedMotion).toEqual([])
      await expect(page.locator('video, marquee'), reducedMotion).toHaveCount(0)
    }
  })

  for (const path of ['/', '/tours']) {
    test(`${path}에서 동작 줄이기를 켜면 모든 전환 시간이 0.01초 이하다`, async ({ page }) => {
      // 계산값(예: "0.15s", "0s, 0.2s")을 초 단위 배열로 바꾼다
      const maxDurations = () =>
        page.evaluate(() => {
          const seconds = (value: string) =>
            value.split(',').map((part) => {
              const text = part.trim()
              return text.endsWith('ms') ? Number.parseFloat(text) / 1000 : Number.parseFloat(text)
            })
          return Array.from(document.querySelectorAll('*'), (element) =>
            Math.max(...seconds(getComputedStyle(element).transitionDuration)),
          )
        })

      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await openPage(page, path, 200)
      const defaults = await maxDurations()
      expect(
        defaults.filter((duration) => duration > 0).length,
        '기본 설정에서 전환 시간이 0보다 큰 요소가 있어야 한다',
      ).toBeGreaterThanOrEqual(1)

      await page.emulateMedia({ reducedMotion: 'reduce' })
      await openPage(page, path, 200)
      const reduced = await maxDurations()
      expect(reduced.length).toBeGreaterThanOrEqual(1)
      expect(reduced.filter((duration) => duration > 0.01)).toEqual([])
    })
  }
})
