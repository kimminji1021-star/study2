// SPEC-TOUR-001 M4 E2E 준비·정리 — 카탈로그 화면 E2E가 쓰는 테스트 데이터를 Payload 로컬 API로 만들고 지운다.
// - 각 E2E 파일은 준비 단계에서 자기 표식(test-<무작위 값>)으로 데이터를 만들고, 정리 단계에서 그 표식으로 지운다(plan.md M4·R8·R15).
// - 정리는 신청 → 회차 → 투어 → 미디어 순서이며(신청 단계는 SPEC-APPLY-001 M5), 한 단계가 실패해도 나머지를 계속하고 마지막에 첫 실패를 다시 던진다.
// - 회차는 실행 시각에서 하루 이상 떨어진 값만 쓴다(R16).
import { getPayload, type Payload } from 'payload'

// .env를 읽어 들이는 부수 효과가 있다(DATABASE_URL·PAYLOAD_SECRET). 설정 파일보다 먼저 불러온다.
import './e2e-env'
import config from '../../src/payload.config'
import { daysFromNow, newMarker, pngFile, tourInput } from './catalog-fixtures'

export type FixtureTour = { id: number; slug: string; title: string }

export type CatalogFixture = {
  marker: string
  /** 공개, 대표 이미지 a, 회차: +2일 모집 중(정원 11) · +3일 마감(13) · +5일 모집 중(12) · −2일 지난 회차(19) */
  open: FixtureTour & {
    imageAlt: string
    imageFilename: string
    sessionStarts: { plus2: string; plus3: string; plus5: string }
  }
  /** 공개, 이미지 없음, +4일 마감 회차만 */
  closed: FixtureTour
  /** 공개되지 않음, 대표 이미지 b, +3일 모집 중 회차 */
  hidden: FixtureTour & { imageFilename: string }
  /** 공개, 회차 없음 */
  empty: FixtureTour
  /** 어느 투어도 참조하지 않는 미디어 c */
  orphanImageFilename: string
}

export async function getE2ePayload(): Promise<Payload> {
  return getPayload({ config })
}

async function createImage(payload: Payload, marker: string, name: string, alt: string) {
  return payload.create({ collection: 'media', data: { alt }, file: pngFile(`${marker}-${name}.png`) })
}

async function createTour(payload: Payload, slug: string, overrides: Record<string, unknown>): Promise<FixtureTour> {
  const doc = await payload.create({ collection: 'tours', data: tourInput(slug, overrides) as never })
  return { id: doc.id, slug: doc.slug, title: doc.title }
}

async function createSession(
  payload: Payload,
  tour: number,
  days: number,
  capacity: number,
  status: 'open' | 'closed' = 'open',
): Promise<string> {
  const startsAt = daysFromNow(days)
  await payload.create({
    collection: 'tour-sessions',
    data: { tour, startsAt, endsAt: daysFromNow(days, 4), capacity, status } as never,
  })
  return startsAt
}

export async function createCatalogFixture(payload: Payload): Promise<CatalogFixture> {
  const marker = newMarker()

  const imageA = await createImage(payload, marker, 'a', `${marker} 영실 능선 사진`)
  const imageB = await createImage(payload, marker, 'b', `${marker} 비공개 사진`)
  const imageC = await createImage(payload, marker, 'c', `${marker} 참조 없는 사진`)

  const open = await createTour(payload, `${marker}-open`, { published: true, heroImage: imageA.id })
  const plus2 = await createSession(payload, open.id, 2, 11)
  const plus3 = await createSession(payload, open.id, 3, 13, 'closed')
  const plus5 = await createSession(payload, open.id, 5, 12)
  await createSession(payload, open.id, -2, 19)

  const closed = await createTour(payload, `${marker}-closed`, { published: true })
  await createSession(payload, closed.id, 4, 14, 'closed')

  const hidden = await createTour(payload, `${marker}-hidden`, { published: false, heroImage: imageB.id })
  await createSession(payload, hidden.id, 3, 10)

  const empty = await createTour(payload, `${marker}-empty`, { published: true })

  return {
    marker,
    open: {
      ...open,
      imageAlt: imageA.alt,
      imageFilename: imageA.filename ?? '',
      sessionStarts: { plus2, plus3, plus5 },
    },
    closed,
    hidden: { ...hidden, imageFilename: imageB.filename ?? '' },
    empty,
    orphanImageFilename: imageC.filename ?? '',
  }
}

/** 표식이 붙은 투어의 신청 → 회차 → 투어 → 미디어를 지운다. 준비가 중간에 실패해 일부만 만들어진 경우에도 쓸 수 있다. */
export async function cleanupCatalogFixture(payload: Payload, marker: string): Promise<void> {
  const failures: unknown[] = []
  // 조건(where)으로 지우는 로컬 API는 일부 문서 실패를 예외 대신 errors 배열로 돌려주므로 둘 다 실패로 본다
  const step = async (run: () => Promise<{ errors: unknown[] }>) => {
    try {
      const { errors } = await run()
      if (errors.length > 0) failures.push(new Error(`cleanup failed for ${errors.length} document(s) (${marker})`))
    } catch (error) {
      failures.push(error)
    }
  }

  const tours = await payload.find({
    collection: 'tours',
    where: { slug: { contains: marker } },
    depth: 0,
    pagination: false,
  })
  const tourIds = tours.docs.map((tour) => tour.id)

  if (tourIds.length > 0) {
    // SPEC-APPLY-001: 신청이 있는 회차는 삭제가 거부되므로(REQ-APPLY-004) 그 투어들의 회차에 속한 신청을 먼저 지운다.
    // 신청 삭제는 접근 규칙이 막으므로 로컬 API 기본값(overrideAccess: true)으로 한다. 신청이 없는 E2E에서는 삭제 대상이 0건이다
    await step(async () => {
      const sessions = await payload.find({
        collection: 'tour-sessions',
        where: { tour: { in: tourIds } },
        depth: 0,
        pagination: false,
      })
      const sessionIds = sessions.docs.map((session) => session.id)
      if (sessionIds.length === 0) return { errors: [] }
      return payload.delete({ collection: 'applications', where: { session: { in: sessionIds } } })
    })
    await step(() => payload.delete({ collection: 'tour-sessions', where: { tour: { in: tourIds } } }))
    await step(() => payload.delete({ collection: 'tours', where: { id: { in: tourIds } } }))
  }
  await step(() => payload.delete({ collection: 'media', where: { filename: { contains: marker } } }))

  if (failures.length > 0) throw failures[0]
}
