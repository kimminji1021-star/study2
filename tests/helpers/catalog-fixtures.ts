// SPEC-TOUR-001 테스트 데이터 도우미 — 테스트 데이터 표식(test-<무작위 값>)을 붙인 투어·회차·미디어 입력값을 만든다.
// 테스트는 이 표식으로 자기 데이터만 찾고 지운다(acceptance.md 머리말, plan.md R8·R15).
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

// 업로드 파일 저장 위치(plan.md §B.6: 저장소 루트 media/)
export const mediaDir = path.join(repoRoot, 'media')

/** 실행마다 고유한 테스트 데이터 표식. slug 규칙(소문자·숫자·하이픈)에 맞는다. */
export function newMarker(): string {
  return `test-${randomUUID().slice(0, 8)}`
}

/** 필수 값이 모두 있고 대표 이미지가 없는 투어 입력값. */
export function tourInput(slug: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: `${slug} 제목`,
    slug,
    summary: `${slug} 요약`,
    description: `${slug} 첫 문단\n\n두 번째 문단`,
    durationMinutes: 270,
    meetingPoint: `${slug} 집결 장소`,
    priceNote: '45,000원 · 현장 결제',
    ...overrides,
  }
}

// 올바른 1×1 PNG(투명 픽셀). Payload가 가로·세로 크기를 (1, 1)로 측정한다.
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

export type UploadFile = { data: Buffer; mimetype: string; name: string; size: number }

/** 1×1 PNG. totalBytes를 주면 뒤에 0바이트를 채워 전체 크기를 정확히 그 값으로 맞춘다(plan.md §B.6 시험 파일). */
export function pngFile(name: string, totalBytes?: number): UploadFile {
  const data =
    totalBytes === undefined
      ? Buffer.from(ONE_PIXEL_PNG)
      : Buffer.concat([ONE_PIXEL_PNG, Buffer.alloc(totalBytes - ONE_PIXEL_PNG.length)])
  return { data, mimetype: 'image/png', name, size: data.length }
}

export function textFile(name: string): UploadFile {
  const data = Buffer.from('plain text, not an image\n', 'utf8')
  return { data, mimetype: 'text/plain', name, size: data.length }
}

export function svgFile(name: string): UploadFile {
  const data = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><script>alert(1)</script></svg>',
    'utf8',
  )
  return { data, mimetype: 'image/svg+xml', name, size: data.length }
}

/** 실행 시각 기준 days일 뒤(음수면 앞)의 일시. 통합·E2E 회차는 하루 이상 떨어진 값만 쓴다. */
export function daysFromNow(days: number, hours = 0): string {
  return new Date(Date.now() + (days * 24 + hours) * 60 * 60 * 1000).toISOString()
}
