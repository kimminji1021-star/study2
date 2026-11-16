// SPEC-LANDING-001 M1 — 홈 화면 설정 전역 설정과 미디어 익명 읽기 범위(실제 DB, Payload 로컬 API).
// AC-LANDING-001: 등록·필드·길이 검증. AC-LANDING-002(통합): 익명 읽기·익명 수정 거부·관리자 수정.
// AC-LANDING-003(통합): 대표 사진에 따른 익명 미디어 읽기 범위. AC-LANDING-005 (c): 대표 사진 미디어 삭제 → 설정 값 비움.
// 전역 설정을 바꾸는 통합 시험은 이 파일 하나에 모은다(plan.md §B.11). 시작 전 원래 값을 파일에 남기고 끝나면 되돌린다.
import { randomUUID } from 'node:crypto'

import { Forbidden, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getHomePageData } from '../../src/lib/home-page'
import config from '../../src/payload.config'
import type { User } from '../../src/payload-types'
import { newMarker, pngFile, tourInput } from '../helpers/catalog-fixtures'
import {
  HOME_SETTINGS_SLUG,
  readHomeSettings,
  restoreHomeSettingsOriginal,
  saveHomeSettingsOriginal,
} from '../helpers/home-settings-original'

const marker = newMarker()
const adminEmail = `admin-${randomUUID()}@example.test`
let payload: Payload
let admin: User
let originalSaved = false

// 준비 데이터: 어느 투어도 참조하지 않는 미디어 h·c, 공개 투어 A(대표 이미지 a)
const fixture = {} as { h: number; c: number; a: number; tourA: number }

const ANON = { overrideAccess: false } as const

async function createMedia(name: string): Promise<number> {
  const doc = await payload.create({
    collection: 'media',
    data: { alt: `${marker}-${name}` },
    file: pngFile(`${marker}-${name}.png`),
  })
  return doc.id
}

async function setHeroImage(id: number | null): Promise<void> {
  await payload.updateGlobal({ slug: HOME_SETTINGS_SLUG, data: { heroImage: id } as never, overrideAccess: true })
}

async function anonymousMediaIds(): Promise<number[]> {
  const result = await payload.find({
    collection: 'media',
    where: { id: { in: [fixture.h, fixture.a, fixture.c] } },
    depth: 0,
    pagination: false,
    ...ANON,
  })
  return result.docs.map((doc) => doc.id).sort((x, y) => x - y)
}

const sorted = (ids: number[]) => [...ids].sort((x, y) => x - y)

async function captureError(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run()
  } catch (error) {
    return error
  }
  return undefined
}

describe('홈 화면 설정(실제 DB)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    // 원래 값 파일 쓰기가 끝나기 전에는 설정을 바꾸지 않는다
    await saveHomeSettingsOriginal(payload)
    originalSaved = true

    admin = await payload.create({ collection: 'users', data: { email: adminEmail, password: `pw-${randomUUID()}` } })
    fixture.h = await createMedia('h')
    fixture.c = await createMedia('c')
    fixture.a = await createMedia('a')
    fixture.tourA = (
      await payload.create({
        collection: 'tours',
        data: tourInput(`${marker}-public`, { published: true, heroImage: fixture.a }) as never,
      })
    ).id
  })

  afterAll(async () => {
    if (payload === undefined) return
    // 설정을 먼저 되돌린 뒤 표식 데이터를 지운다. 한 단계가 실패해도 나머지는 계속하고 마지막에 첫 실패를 던진다
    const failures: unknown[] = []
    const step = async (run: () => Promise<unknown>) => {
      try {
        await run()
      } catch (error) {
        failures.push(error)
      }
    }
    if (originalSaved) {
      await step(async () => {
        const { expected, actual } = await restoreHomeSettingsOriginal(payload)
        expect(actual).toEqual(expected)
      })
    }
    await step(async () => {
      const tours = await payload.find({ collection: 'tours', where: { slug: { like: marker } }, pagination: false })
      const ids = tours.docs.map((tour) => tour.id)
      if (ids.length > 0) await payload.delete({ collection: 'tours', where: { id: { in: ids } } })
    })
    await step(() => payload.delete({ collection: 'media', where: { filename: { like: marker } } }))
    await step(() => payload.delete({ collection: 'users', where: { email: { equals: adminEmail } } }))
    await payload.destroy()
    if (failures.length > 0) throw failures[0]
  })

  describe('AC-LANDING-001 등록과 길이 검증', () => {
    it('전역 설정 slug 목록이 정확히 home-settings 하나이고 라벨이 홈 화면 설정이다', () => {
      expect(payload.config.globals.map((global) => global.slug)).toEqual(['home-settings'])
      expect(payload.config.globals[0].label).toBe('홈 화면 설정')
    })

    it('데이터 필드는 headline·heroImage·intro이고 형식·길이 제한이 정해진 값이다', () => {
      const fields = payload.config.globals[0].fields.filter(
        (field): field is typeof field & { name: string } => 'name' in field,
      )
      const names = fields.map((field) => field.name).filter((name) => !['id', 'createdAt', 'updatedAt'].includes(name))
      expect([...names].sort()).toEqual(['headline', 'heroImage', 'intro'])
      for (const forbidden of ['name', 'email', 'phone', 'requests']) {
        expect(names).not.toContain(forbidden)
      }

      const byName = new Map(fields.map((field) => [field.name, field as unknown as Record<string, unknown>]))
      expect(byName.get('heroImage')).toMatchObject({ type: 'upload', relationTo: 'media' })
      expect(byName.get('heroImage')?.required).not.toBe(true)
      expect(byName.get('headline')).toMatchObject({ type: 'text', maxLength: 40 })
      expect(byName.get('intro')).toMatchObject({ type: 'text', maxLength: 120 })
    })

    it('큰 제목 40자는 저장되고 41자는 ValidationError이며 값이 그대로다', async () => {
      const asAdmin = { overrideAccess: false, user: admin } as const
      await payload.updateGlobal({ slug: HOME_SETTINGS_SLUG, data: { headline: '가'.repeat(40) }, ...asAdmin })
      expect((await readHomeSettings(payload)).headline).toBe('가'.repeat(40))

      const error = await captureError(() =>
        payload.updateGlobal({ slug: HOME_SETTINGS_SLUG, data: { headline: '가'.repeat(41) }, ...asAdmin }),
      )
      expect((error as Error | undefined)?.name).toBe('ValidationError')
      expect((await readHomeSettings(payload)).headline).toBe('가'.repeat(40))
    })

    it('소개 120자는 저장되고 121자는 ValidationError이며 값이 그대로다', async () => {
      const asAdmin = { overrideAccess: false, user: admin } as const
      await payload.updateGlobal({ slug: HOME_SETTINGS_SLUG, data: { intro: '가'.repeat(120) }, ...asAdmin })
      expect((await readHomeSettings(payload)).intro).toBe('가'.repeat(120))

      const error = await captureError(() =>
        payload.updateGlobal({ slug: HOME_SETTINGS_SLUG, data: { intro: '가'.repeat(121) }, ...asAdmin }),
      )
      expect((error as Error | undefined)?.name).toBe('ValidationError')
      expect((await readHomeSettings(payload)).intro).toBe('가'.repeat(120))
    })
  })

  describe('AC-LANDING-002 접근 규칙(통합)', () => {
    it('익명 findGlobal은 오류 없이 끝난다', async () => {
      await expect(payload.findGlobal({ slug: HOME_SETTINGS_SLUG, ...ANON })).resolves.toBeTruthy()
    })

    it('익명 updateGlobal은 권한 오류이고 큰 제목이 그대로다', async () => {
      const before = (await readHomeSettings(payload)).headline
      await expect(
        payload.updateGlobal({ slug: HOME_SETTINGS_SLUG, data: { headline: `${marker}-익명` }, ...ANON }),
      ).rejects.toBeInstanceOf(Forbidden)
      expect((await readHomeSettings(payload)).headline).toBe(before)
    })

    it('테스트 관리자의 updateGlobal은 성공하고 다시 읽은 값이 바뀐 값이다', async () => {
      await payload.updateGlobal({
        slug: HOME_SETTINGS_SLUG,
        data: { headline: `${marker}-관리자` },
        overrideAccess: false,
        user: admin,
      })
      expect((await readHomeSettings(payload)).headline).toBe(`${marker}-관리자`)
    })
  })

  describe('AC-LANDING-003 미디어 익명 읽기 범위(통합)', () => {
    it('1. 대표 사진을 비운 상태: a는 보이고 h·c는 보이지 않는다', async () => {
      await setHeroImage(null)
      expect(await anonymousMediaIds()).toEqual([fixture.a])
    })

    it('2. 대표 사진을 h로 바꾼 뒤: h와 a가 보이고 c는 보이지 않는다', async () => {
      await setHeroImage(fixture.h)
      expect(await anonymousMediaIds()).toEqual(sorted([fixture.h, fixture.a]))
    })

    it('3. 대표 사진을 다시 비운 뒤: h는 숨고 a는 보인다', async () => {
      await setHeroImage(null)
      expect(await anonymousMediaIds()).toEqual([fixture.a])
    })

    it('4. 대표 사진을 a로 바꿨다가 비운 뒤: a가 여전히 보인다(공개 투어가 참조)', async () => {
      await setHeroImage(fixture.a)
      expect(await anonymousMediaIds()).toEqual([fixture.a])
      await setHeroImage(null)
      expect(await anonymousMediaIds()).toEqual([fixture.a])
    })

    it('대표 사진으로 고른 h는 익명 전역 설정 조회(depth 1)에서 채워진 문서로 나온다', async () => {
      await setHeroImage(fixture.h)
      const doc = (await payload.findGlobal({ slug: HOME_SETTINGS_SLUG, depth: 1, ...ANON })) as {
        heroImage?: unknown
      }
      expect(doc.heroImage).toMatchObject({ id: fixture.h, alt: `${marker}-h` })
      await setHeroImage(null)
    })
  })

  describe('AC-LANDING-005 (c) 대표 사진 미디어 삭제', () => {
    it('대표 사진 미디어를 지우면 설정 값이 비고 홈 화면 데이터의 대표 사진이 null이다', async () => {
      const doomed = await createMedia('doomed')
      await setHeroImage(doomed)
      const withImage = await getHomePageData(payload)
      expect(withImage.heroImage).toMatchObject({ alt: `${marker}-doomed` })

      await payload.delete({ collection: 'media', id: doomed })

      expect((await readHomeSettings(payload)).heroImage).toBeNull()
      expect((await getHomePageData(payload)).heroImage).toBeNull()
    })
  })
})
