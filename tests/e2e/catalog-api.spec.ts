// 익명 REST·GraphQL·파일 주소 읽기 범위 E2E — AC-TOUR-006(E2E 부분), plan.md §B.5·M4.
// 로그인하지 않은 Playwright 요청으로 공개 투어 A(= 준비 데이터의 open), 공개되지 않은 투어 B(= hidden),
// 어느 투어도 참조하지 않는 미디어 c(= orphan)를 확인한다. 각 단언은 대조군(A 쪽 결과)을 함께 봐서 빈 응답으로 통과하지 않게 한다.
import { expect, test } from '@playwright/test'
import type { Payload } from 'payload'

import { tourInput } from '../helpers/catalog-fixtures'
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

type ListResponse = { totalDocs: number }

test.describe('익명 API 읽기 범위', () => {
  test('REST 투어 조회: 공개 투어 slug는 1건, 공개되지 않은 투어 slug는 0건', async ({ request }) => {
    const visible = await request.get(`/api/tours?where[slug][equals]=${fixture.open.slug}`)
    expect(visible.status()).toBe(200)
    expect(((await visible.json()) as ListResponse).totalDocs).toBe(1)

    const hidden = await request.get(`/api/tours?where[slug][equals]=${fixture.hidden.slug}`)
    expect(hidden.status()).toBe(200)
    expect(((await hidden.json()) as ListResponse).totalDocs).toBe(0)
  })

  test('REST 회차 조회: 공개 투어의 회차는 1건 이상, 공개되지 않은 투어의 회차는 0건', async ({ request }) => {
    const visible = await request.get(`/api/tour-sessions?where[tour][equals]=${fixture.open.id}`)
    expect(visible.status()).toBe(200)
    expect(((await visible.json()) as ListResponse).totalDocs).toBeGreaterThanOrEqual(1)

    const hidden = await request.get(`/api/tour-sessions?where[tour][equals]=${fixture.hidden.id}`)
    expect(hidden.status()).toBe(200)
    expect(((await hidden.json()) as ListResponse).totalDocs).toBe(0)
  })

  test('GraphQL 조회 결과에 공개되지 않은 투어가 없다', async ({ request }) => {
    const query = `query ($slugs: [String]) { Tours(where: { slug: { in: $slugs } }) { docs { slug } } }`
    const response = await request.post('/api/graphql', {
      data: { query, variables: { slugs: [fixture.open.slug, fixture.hidden.slug] } },
    })
    expect(response.status()).toBe(200)

    const body = (await response.json()) as { data?: { Tours?: { docs: Array<{ slug: string }> } }; errors?: unknown }
    expect(body.errors).toBeUndefined()
    const slugs = (body.data?.Tours?.docs ?? []).map((doc) => doc.slug)
    expect(slugs).toEqual([fixture.open.slug])
  })

  test('파일 주소: 공개 투어 이미지는 200, 공개되지 않은 투어 이미지와 참조 없는 이미지는 200이 아니다', async ({
    request,
  }) => {
    for (const filename of [fixture.open.imageFilename, fixture.hidden.imageFilename, fixture.orphanImageFilename]) {
      expect(filename, '준비 단계가 파일 이름을 돌려줘야 한다').not.toBe('')
    }

    expect((await request.get(`/api/media/file/${fixture.open.imageFilename}`)).status()).toBe(200)
    expect((await request.get(`/api/media/file/${fixture.hidden.imageFilename}`)).status()).not.toBe(200)
    expect((await request.get(`/api/media/file/${fixture.orphanImageFilename}`)).status()).not.toBe(200)
  })

  test('익명 투어 생성 요청은 거부되고 그 slug의 투어가 생기지 않는다', async ({ request }) => {
    const slug = `${fixture.marker}-anonymous-post`
    const response = await request.post('/api/tours', { data: tourInput(slug, { published: true }) })
    expect(response.status() >= 200 && response.status() < 300, `status ${response.status()}`).toBe(false)

    // 접근 규칙을 거치지 않는 로컬 API(관리자 시점)로 확인한다
    const found = await payload.find({ collection: 'tours', where: { slug: { equals: slug } }, depth: 0 })
    expect(found.totalDocs).toBe(0)
  })
})
