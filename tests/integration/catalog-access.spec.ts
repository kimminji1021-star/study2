// SPEC-TOUR-001 M1 — media·tours·tour-sessions 접근 규칙(실제 DB, Payload 로컬 API).
// AC-TOUR-005: 익명 생성·수정·삭제 거부와 관리자 허용. AC-TOUR-006(로컬 API 부분): 익명 읽기 범위.
// 접근 규칙을 적용하려면 로컬 API에 overrideAccess: false를 꼭 넘긴다(기본값 true — plan.md R1).
// 조회 계층(src/lib/catalog.ts) 검증은 M3에서 이 파일 또는 별도 파일에 더한다.
import { randomUUID } from 'node:crypto'

import { Forbidden, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '../../src/payload.config'
import type { User } from '../../src/payload-types'
import { daysFromNow, newMarker, pngFile, tourInput } from '../helpers/catalog-fixtures'

const marker = newMarker()
const adminEmail = `access-${randomUUID()}@example.test`
let payload: Payload
let admin: User

// 준비 데이터: 공개 투어 A(이미지 a, 회차), 비공개 투어 B(이미지 b, 회차), 어느 투어도 참조하지 않는 미디어 c
const fixture = {} as {
  a: number
  b: number
  c: number
  tourA: number
  tourB: number
  sessionA: number
  sessionB: number
}

const ANON = { overrideAccess: false } as const

async function createMedia(name: string) {
  const doc = await payload.create({
    collection: 'media',
    data: { alt: `${marker} ${name}` },
    file: pngFile(`${marker}-${name}.png`),
  })
  return doc.id
}

async function createSession(tour: number) {
  const doc = await payload.create({
    collection: 'tour-sessions',
    data: { tour, startsAt: daysFromNow(3), endsAt: daysFromNow(3, 4), capacity: 10 } as never,
  })
  return doc.id
}

describe('카탈로그 접근 규칙(실제 DB)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    admin = await payload.create({ collection: 'users', data: { email: adminEmail, password: `pw-${randomUUID()}` } })

    fixture.a = await createMedia('a')
    fixture.b = await createMedia('b')
    fixture.c = await createMedia('c')
    fixture.tourA = (
      await payload.create({
        collection: 'tours',
        data: tourInput(`${marker}-public`, { published: true, heroImage: fixture.a }) as never,
      })
    ).id
    fixture.tourB = (
      await payload.create({
        collection: 'tours',
        data: tourInput(`${marker}-hidden`, { published: false, heroImage: fixture.b }) as never,
      })
    ).id
    fixture.sessionA = await createSession(fixture.tourA)
    fixture.sessionB = await createSession(fixture.tourB)
  })

  afterAll(async () => {
    if (payload === undefined) return
    // 한 단계가 실패해도 나머지 정리는 계속한다(특히 테스트 관리자 계정은 항상 지운다).
    // 순서는 회차 → 투어 → 미디어(plan.md R8). 마지막에 첫 실패를 다시 던져 정리 실패를 숨기지 않는다.
    const failures: unknown[] = []
    const step = async (run: () => Promise<unknown>) => {
      try {
        await run()
      } catch (error) {
        failures.push(error)
      }
    }
    await step(async () => {
      const tours = await payload.find({ collection: 'tours', where: { slug: { like: marker } }, pagination: false })
      const tourIds = tours.docs.map((tour) => tour.id)
      if (tourIds.length > 0) {
        await payload.delete({ collection: 'tour-sessions', where: { tour: { in: tourIds } } })
        await payload.delete({ collection: 'tours', where: { id: { in: tourIds } } })
      }
    })
    await step(() => payload.delete({ collection: 'media', where: { filename: { like: marker } } }))
    await step(() => payload.delete({ collection: 'users', where: { email: { equals: adminEmail } } }))
    await payload.destroy()
    if (failures.length > 0) throw failures[0]
  })

  describe('AC-TOUR-005 쓰기 권한', () => {
    it('익명 요청은 tours 생성·수정·삭제가 모두 권한 오류이고 데이터가 그대로다', async () => {
      const slug = `${marker}-anon-create`
      await expect(
        payload.create({ collection: 'tours', data: tourInput(slug) as never, ...ANON }),
      ).rejects.toBeInstanceOf(Forbidden)
      expect((await payload.count({ collection: 'tours', where: { slug: { equals: slug } } })).totalDocs).toBe(0)

      const before = await payload.findByID({ collection: 'tours', id: fixture.tourA })
      await expect(
        payload.update({ collection: 'tours', id: fixture.tourA, data: { title: 'hacked' }, ...ANON }),
      ).rejects.toBeInstanceOf(Forbidden)
      await expect(payload.delete({ collection: 'tours', id: fixture.tourB, ...ANON })).rejects.toBeInstanceOf(
        Forbidden,
      )

      const after = await payload.findByID({ collection: 'tours', id: fixture.tourA })
      expect(after.title).toBe(before.title)
      await expect(payload.findByID({ collection: 'tours', id: fixture.tourB })).resolves.toBeTruthy()
    })

    it('익명 요청은 tour-sessions 생성·수정·삭제가 모두 권한 오류이고 데이터가 그대로다', async () => {
      const beforeCount = await payload.count({
        collection: 'tour-sessions',
        where: { tour: { equals: fixture.tourA } },
      })
      await expect(
        payload.create({
          collection: 'tour-sessions',
          data: { tour: fixture.tourA, startsAt: daysFromNow(4), endsAt: daysFromNow(4, 2), capacity: 3 } as never,
          ...ANON,
        }),
      ).rejects.toBeInstanceOf(Forbidden)
      await expect(
        payload.update({ collection: 'tour-sessions', id: fixture.sessionA, data: { capacity: 99 }, ...ANON }),
      ).rejects.toBeInstanceOf(Forbidden)
      await expect(
        payload.delete({ collection: 'tour-sessions', id: fixture.sessionA, ...ANON }),
      ).rejects.toBeInstanceOf(Forbidden)

      const afterCount = await payload.count({
        collection: 'tour-sessions',
        where: { tour: { equals: fixture.tourA } },
      })
      expect(afterCount.totalDocs).toBe(beforeCount.totalDocs)
      const session = await payload.findByID({ collection: 'tour-sessions', id: fixture.sessionA })
      expect(session.capacity).toBe(10)
    })

    it('익명 요청은 media 생성·수정·삭제가 모두 권한 오류이고 데이터가 그대로다', async () => {
      const before = await payload.count({ collection: 'media' })
      await expect(
        payload.create({
          collection: 'media',
          data: { alt: `${marker} anon` },
          file: pngFile(`${marker}-anon.png`),
          ...ANON,
        }),
      ).rejects.toBeInstanceOf(Forbidden)
      await expect(
        payload.update({ collection: 'media', id: fixture.c, data: { alt: 'hacked' }, ...ANON }),
      ).rejects.toBeInstanceOf(Forbidden)
      await expect(payload.delete({ collection: 'media', id: fixture.c, ...ANON })).rejects.toBeInstanceOf(Forbidden)

      expect((await payload.count({ collection: 'media' })).totalDocs).toBe(before.totalDocs)
      const c = await payload.findByID({ collection: 'media', id: fixture.c })
      expect(c.alt).toBe(`${marker} c`)
    })

    it('관리자(users 컬렉션 사용자)는 접근 규칙 적용 상태에서도 세 컬렉션의 생성·수정·삭제를 모두 할 수 있다', async () => {
      const asAdmin = { overrideAccess: false, user: admin } as const

      const media = await payload.create({
        collection: 'media',
        data: { alt: `${marker} admin` },
        file: pngFile(`${marker}-admin.png`),
        ...asAdmin,
      })
      const updatedMedia = await payload.update({
        collection: 'media',
        id: media.id,
        data: { alt: `${marker} admin edited` },
        ...asAdmin,
      })
      expect(updatedMedia.alt).toBe(`${marker} admin edited`)

      const tour = await payload.create({
        collection: 'tours',
        data: tourInput(`${marker}-admin`, { heroImage: media.id }) as never,
        ...asAdmin,
      })
      const updatedTour = await payload.update({
        collection: 'tours',
        id: tour.id,
        data: { title: `${marker} admin tour` },
        ...asAdmin,
      })
      expect(updatedTour.title).toBe(`${marker} admin tour`)

      const session = await payload.create({
        collection: 'tour-sessions',
        data: { tour: tour.id, startsAt: daysFromNow(6), endsAt: daysFromNow(6, 3), capacity: 4 } as never,
        ...asAdmin,
      })
      const updatedSession = await payload.update({
        collection: 'tour-sessions',
        id: session.id,
        data: { capacity: 5 },
        ...asAdmin,
      })
      expect(updatedSession.capacity).toBe(5)

      await payload.delete({ collection: 'tour-sessions', id: session.id, ...asAdmin })
      await payload.delete({ collection: 'tours', id: tour.id, ...asAdmin })
      await payload.delete({ collection: 'media', id: media.id, ...asAdmin })

      expect((await payload.count({ collection: 'tours', where: { id: { equals: tour.id } } })).totalDocs).toBe(0)
      expect((await payload.count({ collection: 'media', where: { id: { equals: media.id } } })).totalDocs).toBe(0)
    })
  })

  describe('AC-TOUR-006 익명 읽기 범위(로컬 API, 접근 규칙 적용)', () => {
    it('투어는 공개 투어 A만 보이고 비공개 투어 B는 보이지 않는다', async () => {
      const result = await payload.find({
        collection: 'tours',
        where: { id: { in: [fixture.tourA, fixture.tourB] } },
        ...ANON,
      })
      expect(result.docs.map((doc) => doc.id)).toEqual([fixture.tourA])

      await expect(payload.findByID({ collection: 'tours', id: fixture.tourB, ...ANON })).rejects.toThrow()
    })

    it('회차는 공개 투어에 속한 것만 보인다', async () => {
      const result = await payload.find({
        collection: 'tour-sessions',
        where: { id: { in: [fixture.sessionA, fixture.sessionB] } },
        depth: 0,
        ...ANON,
      })
      expect(result.docs.map((doc) => doc.id)).toEqual([fixture.sessionA])
    })

    it('미디어는 공개 투어가 대표 이미지로 참조하는 a만 보이고 b·c는 보이지 않는다', async () => {
      const result = await payload.find({
        collection: 'media',
        where: { id: { in: [fixture.a, fixture.b, fixture.c] } },
        ...ANON,
      })
      expect(result.docs.map((doc) => doc.id)).toEqual([fixture.a])
    })

    it('관리자는 접근 규칙 적용 상태에서도 모두 읽는다', async () => {
      const asAdmin = { overrideAccess: false, user: admin } as const
      const tours = await payload.find({
        collection: 'tours',
        where: { id: { in: [fixture.tourA, fixture.tourB] } },
        ...asAdmin,
      })
      const media = await payload.find({
        collection: 'media',
        where: { id: { in: [fixture.a, fixture.b, fixture.c] } },
        ...asAdmin,
      })
      expect(tours.totalDocs).toBe(2)
      expect(media.totalDocs).toBe(3)
    })
  })
})
