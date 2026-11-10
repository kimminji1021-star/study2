// SPEC-TOUR-001 M1 — Media 업로드 검증과 저장 위치(실제 DB·실제 디스크, Payload 로컬 API).
// AC-TOUR-002: 대체 텍스트 필수, JPEG·PNG·WebP만 허용(텍스트·SVG 거부), 5MB 크기 규칙(경계 포함),
// 저장소 루트 media/ 저장과 삭제 시 파일 제거. 업로드 파일 이름은 모두 test-로 시작한다(AC-TOUR-009).
import { existsSync } from 'node:fs'
import path from 'node:path'

import { getPayload, ValidationError, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '../../src/payload.config'
import { mediaDir, newMarker, pngFile, svgFile, textFile, type UploadFile } from '../helpers/catalog-fixtures'

const FIVE_MB = 5 * 1024 * 1024
const marker = newMarker()
let payload: Payload

function upload(file: UploadFile, alt: string) {
  return payload.create({ collection: 'media', data: { alt } as never, file })
}

async function countMedia(): Promise<number> {
  return (await payload.count({ collection: 'media' })).totalDocs
}

describe('Media 업로드 검증과 저장 위치(AC-TOUR-002)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  afterAll(async () => {
    if (payload === undefined) return
    try {
      await payload.delete({ collection: 'media', where: { filename: { like: marker } } })
    } finally {
      await payload.destroy()
    }
  })

  it('대체 텍스트가 있는 PNG는 저장소 루트 media/에 저장되고 가로·세로 크기 (1, 1)이 기록되며, 지우면 파일도 사라진다', async () => {
    const doc = await upload(pngFile(`${marker}-ok.png`), `${marker} ok`)

    expect(doc.width).toBe(1)
    expect(doc.height).toBe(1)
    expect(doc.filename).toBeTruthy()
    const stored = path.join(mediaDir, doc.filename ?? '')
    expect(existsSync(stored)).toBe(true)

    await payload.delete({ collection: 'media', id: doc.id })
    expect(existsSync(stored)).toBe(false)
  })

  it('대체 텍스트가 빈 문자열이면 검증 오류로 끝나고 문서 수가 늘지 않는다', async () => {
    const before = await countMedia()
    const name = `${marker}-noalt.png`

    await expect(upload(pngFile(name), '')).rejects.toBeInstanceOf(ValidationError)

    expect(await countMedia()).toBe(before)
    expect(existsSync(path.join(mediaDir, name))).toBe(false)
  })

  it.each([
    ['텍스트 파일', textFile(`${marker}-plain.txt`)],
    ['SVG 파일', svgFile(`${marker}-vector.svg`)],
  ])('%s 업로드는 오류로 끝나고 문서 수가 늘지 않는다', async (_label, file) => {
    const before = await countMedia()

    await expect(upload(file, `${marker} rejected`)).rejects.toThrow()

    expect(await countMedia()).toBe(before)
    expect(existsSync(path.join(mediaDir, file.name))).toBe(false)
  })

  it('1×1 PNG를 채운 5 × 1024 × 1024 + 1바이트 파일은 ValidationError로 끝나고 문서·파일이 생기지 않는다', async () => {
    const before = await countMedia()
    const file = pngFile(`${marker}-over.png`, FIVE_MB + 1)
    expect(file.data.length).toBe(5_242_881)

    await expect(upload(file, `${marker} over`)).rejects.toBeInstanceOf(ValidationError)

    expect(await countMedia()).toBe(before)
    expect(existsSync(path.join(mediaDir, file.name))).toBe(false)
  })

  it('대조 사례: 같은 방식으로 정확히 5 × 1024 × 1024바이트인 파일은 성공하고 크기 (1, 1)이 기록되며, 지우면 파일이 남지 않는다', async () => {
    const file = pngFile(`${marker}-exact.png`, FIVE_MB)
    expect(file.data.length).toBe(5_242_880)

    const doc = await upload(file, `${marker} exact`)
    try {
      expect(doc.width).toBe(1)
      expect(doc.height).toBe(1)
      expect(doc.filesize).toBe(FIVE_MB)
      expect(existsSync(path.join(mediaDir, doc.filename ?? ''))).toBe(true)
    } finally {
      await payload.delete({ collection: 'media', id: doc.id })
    }
    expect(existsSync(path.join(mediaDir, doc.filename ?? ''))).toBe(false)
  })

  it('기존 문서의 파일을 5MB를 넘는 파일로 바꾸는 수정도 ValidationError로 거부된다', async () => {
    const doc = await upload(pngFile(`${marker}-replace.png`), `${marker} replace`)

    await expect(
      payload.update({
        collection: 'media',
        id: doc.id,
        data: {},
        file: pngFile(`${marker}-replace-over.png`, FIVE_MB + 1),
      }),
    ).rejects.toBeInstanceOf(ValidationError)

    expect(existsSync(path.join(mediaDir, `${marker}-replace-over.png`))).toBe(false)
    const reread = await payload.findByID({ collection: 'media', id: doc.id })
    expect(reread.filename).toBe(doc.filename)
  })
})
