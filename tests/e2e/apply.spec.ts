// 신청 흐름 E2E — SPEC-APPLY-001 AC-APPLY-006·007·008(화면)·012·015(URL)·016(시도 기록 정리), plan.md M5.
// - 각 수용 기준은 자기 전용 투어·회차를 쓴다(acceptance.md 머리말 "테스트 데이터 독립").
// - 신청 제출마다 문서용 주소 대역(198.51.100.x)의 접속 IP를 x-forwarded-for로 보내 횟수 제한에 걸리지 않게 하고(R9),
//   끝나면 그 IP들의 키로 시도 기록을 지운다(AC-APPLY-016). 개발 서버는 들어온 x-forwarded-for를 보존한다(plan.md §A.2, R10).
// - 정리: cleanupCatalogFixture(표식)가 신청 → 회차 → 투어 → 미디어 순서로 지운다.
import { expect, test, type Locator, type Page } from '@playwright/test'
import type { Payload } from 'payload'

import { formatSessionDateTime } from '../../src/lib/format'
import { cleanupAttempts, testIpPool } from '../helpers/application-fixtures'
import { newMarker } from '../helpers/catalog-fixtures'
import {
  addE2eApplication,
  createE2eSession,
  createE2eTour,
  randomDigits,
  type E2eSession,
  type E2eTour,
} from '../helpers/e2e-apply'
import { expectE2ePort } from '../helpers/e2e-assert'
import { cleanupCatalogFixture, getE2ePayload } from '../helpers/e2e-catalog'
import { E2E_BASE_URL } from '../helpers/e2e-env'

const REFERENCE_PATH = /^\/apply\/complete\/(SB-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5})$/

let payload: Payload
const marker = newMarker()
const ips = testIpPool('198.51.100', 200)

type Fixture = {
  // AC-APPLY-006: S1 +2일 정원 5(대기 2·확정 1·취소 2명), S2 +3일 정원 3(대기 3명) / U는 마감 회차만
  listing: { tour: E2eTour; s1: E2eSession; s2: E2eSession; closedOnly: E2eTour }
  // AC-APPLY-007: A·B·C·E·F(공개 투어 T), D(공개되지 않은 투어 H)
  screen: {
    tour: E2eTour
    a: E2eSession
    b: E2eSession
    c: E2eSession
    e: E2eSession
    f: E2eSession
    d: E2eSession
  }
  // AC-APPLY-008: 정원 50
  validation: { tour: E2eTour; session: E2eSession }
  // AC-APPLY-012: A +2일 정원 15
  complete: { tour: E2eTour; a: E2eSession }
}

let fixture: Fixture

test.beforeAll(async () => {
  payload = await getE2ePayload()

  const listingTour = await createE2eTour(payload, marker, 'listing')
  const s1 = await createE2eSession(payload, listingTour.id, { days: 2, capacity: 5 })
  await addE2eApplication(payload, s1.id, marker, { partySize: 2, status: 'pending' })
  await addE2eApplication(payload, s1.id, marker, { partySize: 1, status: 'confirmed' })
  await addE2eApplication(payload, s1.id, marker, { partySize: 2, status: 'cancelled' })
  const s2 = await createE2eSession(payload, listingTour.id, { days: 3, capacity: 3 })
  await addE2eApplication(payload, s2.id, marker, { partySize: 3, status: 'pending' })
  const closedOnly = await createE2eTour(payload, marker, 'closed-only')
  await createE2eSession(payload, closedOnly.id, { days: 4, capacity: 10, status: 'closed' })

  const screenTour = await createE2eTour(payload, marker, 'screen')
  const a = await createE2eSession(payload, screenTour.id, { days: 2, capacity: 15 })
  const b = await createE2eSession(payload, screenTour.id, { days: 2, capacity: 5 })
  await addE2eApplication(payload, b.id, marker, { partySize: 1 })
  await addE2eApplication(payload, b.id, marker, { partySize: 1 })
  const c = await createE2eSession(payload, screenTour.id, { days: 3, capacity: 10, status: 'closed' })
  const e = await createE2eSession(payload, screenTour.id, { days: -1, capacity: 15 })
  const f = await createE2eSession(payload, screenTour.id, { days: 2, capacity: 2 })
  await addE2eApplication(payload, f.id, marker, { partySize: 2 })
  const hiddenTour = await createE2eTour(payload, marker, 'hidden', false)
  const d = await createE2eSession(payload, hiddenTour.id, { days: 3, capacity: 10 })

  const validationTour = await createE2eTour(payload, marker, 'validation')
  const validationSession = await createE2eSession(payload, validationTour.id, { days: 2, capacity: 50 })

  const completeTour = await createE2eTour(payload, marker, 'complete')
  const completeA = await createE2eSession(payload, completeTour.id, { days: 2, capacity: 15 })

  fixture = {
    listing: { tour: listingTour, s1, s2, closedOnly },
    screen: { tour: screenTour, a, b, c, e, f, d },
    validation: { tour: validationTour, session: validationSession },
    complete: { tour: completeTour, a: completeA },
  }
})

test.afterAll(async () => {
  if (payload === undefined) return
  // 아래 정리 확인 테스트가 실패·생략되어도 시도 기록이 남지 않게 한 번 더 지운다(이미 지웠으면 0건 삭제)
  await cleanupAttempts(payload, ips.used())
  await cleanupCatalogFixture(payload, marker)
  const left = await payload.count({ collection: 'applications', where: { email: { like: marker } } })
  expect(left.totalDocs).toBe(0)
})

/** 요소의 aria-describedby가 가리키는 요소들의 글자를 모은다. */
async function describedByText(page: Page, field: Locator): Promise<string[]> {
  const ids = ((await field.getAttribute('aria-describedby')) ?? '').split(/\s+/).filter((id) => id !== '')
  expect(ids.length, 'aria-describedby가 있어야 한다').toBeGreaterThanOrEqual(1)
  return Promise.all(ids.map(async (id) => (await page.locator(`[id="${id}"]`).textContent()) ?? ''))
}

function sessionRow(page: Page, seats: string): Locator {
  return page
    .locator('label')
    .filter({ has: page.getByRole('radio') })
    .filter({ hasText: seats })
}

/** dt(라벨)와 짝을 이루는 dd(값). */
function summaryValue(page: Page, label: string): Locator {
  return page.locator('dt', { hasText: label }).locator('xpath=following-sibling::dd[1]')
}

type ApplicantValues = { name: string; email: string; phone: string; partySize: string }

async function fillApplication(page: Page, values: ApplicantValues): Promise<void> {
  await page.getByLabel('이름', { exact: true }).fill(values.name)
  await page.getByLabel('이메일', { exact: true }).fill(values.email)
  await page.getByLabel('연락처', { exact: true }).fill(values.phone)
  await page.getByLabel('인원', { exact: true }).selectOption(values.partySize)
}

test.describe('목록·상세의 남은 자리와 "신청하기"(AC-APPLY-006)', () => {
  test('목록 카드와 상세 회차가 점유 인원을 반영하고, 회차를 고른 뒤 신청하기를 누르면 신청 화면으로 간다', async ({
    page,
  }) => {
    const { tour, s1 } = fixture.listing

    await page.goto('/tours')
    expectE2ePort(page)
    const card = page.locator('article').filter({ has: page.getByRole('heading', { name: tour.title, exact: true }) })
    await expect(card).toHaveCount(1)
    await expect(card).toContainText('남은 자리 2 / 5')

    await page.goto(`/tours/${tour.slug}`)
    expectE2ePort(page)
    await expect(sessionRow(page, '남은 자리 2 / 5')).toHaveCount(1)
    const s2Row = sessionRow(page, '남은 자리 0 / 3')
    await expect(s2Row).toHaveCount(1)
    await expect(s2Row.locator('[data-status-badge]')).toHaveText('자리 없음')
    await expect(s2Row.getByRole('radio')).toBeDisabled()

    const applyButton = page.getByRole('button', { name: '신청하기', exact: true })
    await expect(applyButton).toHaveCount(1)
    const detailPath = new URL(page.url()).pathname

    // 회차를 고르지 않으면 브라우저의 필수 선택 검사가 제출을 막는다
    await applyButton.click()
    await expect(page).toHaveURL((url) => url.pathname === detailPath)

    await sessionRow(page, '남은 자리 2 / 5').click()
    await applyButton.click()
    await page.waitForURL((url) => url.pathname === '/apply')
    expectE2ePort(page)
    expect(new URL(page.url()).searchParams.get('session')).toBe(String(s1.id))
  })

  test('신청 가능 회차가 없는 투어 상세에는 "신청하기" 버튼이 없다', async ({ page }) => {
    const response = await page.goto(`/tours/${fixture.listing.closedOnly.slug}`)
    expectE2ePort(page)
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('radio')).toHaveCount(1)
    await expect(page.getByRole('button', { name: '신청하기', exact: true })).toHaveCount(0)
  })
})

test.describe('신청 화면 구성·404·신청 불가 안내(AC-APPLY-007)', () => {
  test('신청 가능 회차: 투어·회차·남은 자리·라벨이 연결된 입력란·동의 고지·허니팟·인원 선택지', async ({ page }) => {
    const { tour, a } = fixture.screen
    const response = await page.goto(`/apply?session=${a.id}`)
    expectE2ePort(page)
    expect(response?.status()).toBe(200)

    const main = page.locator('main')
    await expect(main).toContainText(tour.title)
    await expect(main).toContainText(formatSessionDateTime(a.startsAt))
    await expect(main).toContainText('남은 자리 15 / 15')

    for (const label of ['이름', '이메일', '연락처', '인원', '요청 사항']) {
      await expect(page.getByLabel(label, { exact: true }), `${label} 입력란`).toHaveCount(1)
    }

    const privacy = page.getByRole('checkbox', { name: /개인정보 수집·이용에 동의합니다/ })
    const requestsConsent = page.getByRole('checkbox', { name: /요청 사항 수집·이용에 동의합니다/ })
    await expect(privacy).toHaveCount(1)
    await expect(requestsConsent).toHaveCount(1)
    await expect(privacy).not.toBeChecked()
    await expect(requestsConsent).not.toBeChecked()

    const required = (await describedByText(page, privacy)).join('\n')
    for (const phrase of ['수집 항목', '이용 목적', '보유 기간', '5년', '거부하면 신청할 수 없습니다']) {
      expect(required, `필수 고지: ${phrase}`).toContain(phrase)
    }
    const optional = (await describedByText(page, requestsConsent)).join('\n')
    for (const phrase of ['투어 종료 후 지체 없이 파기', '거부해도 신청할 수 있습니다']) {
      expect(optional, `선택 고지: ${phrase}`).toContain(phrase)
    }
    const requestsHints = await describedByText(page, page.getByLabel('요청 사항', { exact: true }))
    expect(requestsHints.some((text) => text.includes('건강·장애 등 민감한 정보는 적지 마세요'))).toBe(true)

    const partyOptions = page.getByLabel('인원', { exact: true }).locator('option')
    await expect(partyOptions).toHaveCount(10)
    expect(
      await partyOptions.evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value)),
    ).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'])

    const honeypot = page.locator('input[name="website"]')
    await expect(honeypot).toHaveCount(1)
    await expect(honeypot).not.toBeInViewport()
    await expect(honeypot).toHaveAttribute('tabindex', '-1')
    await expect(honeypot).toHaveAttribute('autocomplete', 'off')
    expect(await honeypot.locator('xpath=ancestor::*[@aria-hidden="true"]').count()).toBeGreaterThanOrEqual(1)
  })

  test('점유 인원이 있는 회차: "남은 자리 3 / 5"와 인원 선택지 1~3', async ({ page }) => {
    const response = await page.goto(`/apply?session=${fixture.screen.b.id}`)
    expectE2ePort(page)
    expect(response?.status()).toBe(200)

    await expect(page.locator('main')).toContainText('남은 자리 3 / 5')
    const partyOptions = page.getByLabel('인원', { exact: true }).locator('option')
    await expect(partyOptions).toHaveCount(3)
    expect(
      await partyOptions.evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value)),
    ).toEqual(['1', '2', '3'])
  })

  test('회차 식별 값이 없거나 틀리거나, 회차가 없거나 공개 투어의 회차가 아니면 404', async ({ page }) => {
    for (const path of [
      '/apply',
      '/apply?session=abc',
      `/apply?session=${fixture.screen.d.id}`,
      '/apply?session=2147483000',
      '/apply?session=99999999999',
    ]) {
      const response = await page.goto(path)
      expectE2ePort(page)
      expect(response?.status(), path).toBe(404)
    }
  })

  test('마감·시작함·자리 없음 회차는 200으로 신청 불가 안내와 투어 상세 링크를 보이고 입력 양식이 없다', async ({
    page,
  }) => {
    const { tour, c, e, f } = fixture.screen
    for (const [kind, session] of [
      ['마감', c],
      ['시작함', e],
      ['자리 없음', f],
    ] as const) {
      const response = await page.goto(`/apply?session=${session.id}`)
      expectE2ePort(page)
      expect(response?.status(), kind).toBe(200)
      await expect(page.getByText('신청할 수 없는 회차입니다'), kind).toBeVisible()
      await expect(page.locator(`main a[href="/tours/${tour.slug}"]`), kind).toHaveCount(1)
      await expect(page.getByLabel('이름', { exact: true }), kind).toHaveCount(0)
    }
  })
})

test.describe('입력 오류 안내(AC-APPLY-008 화면 부분)', () => {
  test('요청 사항을 적고 선택 동의를 하지 않으면 요청 사항 옆에 안내가 보이고 신청이 생기지 않는다', async ({
    page,
  }) => {
    const ip = ips.next()
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': ip })
    const email = `${marker}-validation@example.test`
    const name = `${marker}-검증`

    await page.goto(`/apply?session=${fixture.validation.session.id}`)
    expectE2ePort(page)
    await fillApplication(page, { name, email, phone: `010-66${randomDigits(6)}`, partySize: '1' })
    await page.getByLabel('요청 사항', { exact: true }).fill(`${marker}-요청`)
    await page.getByRole('checkbox', { name: /개인정보 수집·이용에 동의합니다/ }).check()
    await page.getByRole('button', { name: '신청 접수하기' }).click()

    const requests = page.getByLabel('요청 사항', { exact: true })
    await expect
      .poll(async () => (await describedByText(page, requests)).join('\n'))
      .toContain('요청 사항을 남기려면 선택 동의에 체크하거나 입력란을 비워 주세요')
    expect(new URL(page.url()).pathname).toBe('/apply')
    await expect(page.getByLabel('이름', { exact: true })).toHaveValue(name)

    const saved = await payload.count({ collection: 'applications', where: { email: { equals: email } } })
    expect(saved.totalDocs).toBe(0)
  })
})

test.describe('접수 완료와 재제출 방지(AC-APPLY-012, AC-APPLY-015 URL)', () => {
  test('제출하면 접수 번호 경로로 이동하고, 개인정보·DB ID 없이 요약을 보이며, 새로고침해도 신청이 1건이다', async ({
    page,
  }) => {
    const { tour, a } = fixture.complete
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': ips.next() })
    const visited: string[] = []
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) visited.push(frame.url())
    })
    const applicant = {
      name: `${marker}-이름`,
      email: `${marker}@example.test`,
      phone: `010-55${randomDigits(6)}`,
      partySize: '2',
    }

    await page.goto(`/apply?session=${a.id}`)
    expectE2ePort(page)
    await fillApplication(page, applicant)
    await page.getByRole('checkbox', { name: /개인정보 수집·이용에 동의합니다/ }).check()
    await page.getByRole('button', { name: '신청 접수하기' }).click()
    await page.waitForURL((url) => url.pathname.startsWith('/apply/complete/'))
    expectE2ePort(page)

    const match = REFERENCE_PATH.exec(new URL(page.url()).pathname)
    expect(match, page.url()).not.toBeNull()
    const code = match?.[1] ?? ''
    await expect(summaryValue(page, '접수 번호')).toHaveText(code)
    const main = page.locator('main')
    await expect(main).toContainText(tour.title)
    await expect(main).toContainText(formatSessionDateTime(a.startsAt))
    await expect(main).toContainText('대기 — 관리자 확인 후 확정')
    await expect(summaryValue(page, '인원')).toHaveText('2명')

    const saved = await payload.find({
      collection: 'applications',
      where: { email: { equals: applicant.email } },
      depth: 0,
    })
    expect(saved.totalDocs).toBe(1)
    const dbId = saved.docs[0].id
    expect(saved.docs[0].referenceCode).toBe(code)

    // 서버가 보낸 HTML 원문(RSC 데이터 포함)에 개인정보와 DB ID가 없다
    const html = await (await page.request.get(new URL(page.url()).pathname)).text()
    expect(html).toContain(code)
    for (const value of [applicant.name, applicant.email, applicant.phone]) expect(html).not.toContain(value)
    expect(html).not.toContain(`applications/${dbId}`)
    expect(html).not.toMatch(new RegExp(`\\\\?"id\\\\?":${dbId}[,}]`))
    expect(await page.locator('meta[name="robots"]').getAttribute('content')).toContain('noindex')

    await page.reload()
    expectE2ePort(page)
    await expect(summaryValue(page, '접수 번호')).toHaveText(code)
    expect(
      (await payload.count({ collection: 'applications', where: { email: { equals: applicant.email } } })).totalDocs,
    ).toBe(1)

    await page.goto(`/tours/${tour.slug}`)
    expectE2ePort(page)
    await expect(sessionRow(page, '남은 자리 13 / 15')).toHaveCount(1)

    // AC-APPLY-015: 거친 모든 페이지 URL에 개인정보가 없다(인코딩된 형태 포함)
    expect(visited.length).toBeGreaterThanOrEqual(2)
    for (const url of visited) {
      const decoded = decodeURIComponent(url)
      for (const value of [applicant.name, applicant.email, applicant.phone]) {
        expect(decoded, url).not.toContain(value)
        expect(url, url).not.toContain(encodeURIComponent(value))
      }
    }

    // 없는 접수 번호·형식이 틀린 값·DB ID는 404, 소문자 접수 번호는 대문자로 맞춰 200
    for (const path of ['/apply/complete/SB-00000-00000', '/apply/complete/abc', `/apply/complete/${dbId}`]) {
      const response = await page.goto(path)
      expect(response?.status(), path).toBe(404)
    }
    const lower = await page.goto(`/apply/complete/${code.toLowerCase()}`)
    expectE2ePort(page)
    expect(lower?.status()).toBe(200)
    await expect(summaryValue(page, '접수 번호')).toHaveText(code)
  })

  test('자바스크립트를 끈 브라우저의 양식 제출은 303으로 접수 완료 화면에 간다', async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: E2E_BASE_URL,
      javaScriptEnabled: false,
      extraHTTPHeaders: { 'x-forwarded-for': ips.next() },
    })
    try {
      const page = await context.newPage()
      await page.goto(`/apply?session=${fixture.complete.a.id}`)
      expectE2ePort(page)
      await fillApplication(page, {
        name: `${marker}-nojs`,
        email: `${marker}-nojs@example.test`,
        phone: `010-44${randomDigits(6)}`,
        partySize: '1',
      })
      await page.getByRole('checkbox', { name: /개인정보 수집·이용에 동의합니다/ }).check()

      const postRequest = page.waitForRequest((request) => request.method() === 'POST')
      await page.getByRole('button', { name: '신청 접수하기' }).click()
      const post = await postRequest
      await page.waitForURL((url) => url.pathname.startsWith('/apply/complete/'))
      expectE2ePort(page)

      const redirect = await post.response()
      expect(redirect?.status()).toBe(303)
      expect(redirect?.headers().location ?? '').toMatch(/^\/apply\/complete\/SB-/)

      const match = REFERENCE_PATH.exec(new URL(page.url()).pathname)
      expect(match, page.url()).not.toBeNull()
      await expect(summaryValue(page, '접수 번호')).toHaveText(match?.[1] ?? '')
    } finally {
      await context.close()
    }
  })
})

test.describe('신청 시도 기록 정리(AC-APPLY-016)', () => {
  test('이 파일이 쓴 접속 IP의 시도 기록을 지운다(지우기 전 1건 이상, 지운 뒤 0건)', async () => {
    expect(ips.used().length).toBeGreaterThanOrEqual(1)
    const { before, after } = await cleanupAttempts(payload, ips.used())
    expect(before).toBeGreaterThanOrEqual(1)
    expect(after).toBe(0)
  })
})
