// SPEC-LANDING-001 M3 — 짙은 히어로의 대비(단위). AC-LANDING-006 단위 부분, plan.md §B.5.
// tokens.css의 실제 값을 읽어 WCAG 2.x 공식으로 다시 잰다(값을 읽지 못하면 실패). 토큰을 바꾸면 이 표도 함께 바뀐다.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { compositeOver, contrastRatio, parseColor, readCustomProperties, round2, type Rgba } from '../helpers/contrast'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const TOKENS_FILE = path.join(repoRoot, 'src', 'app', '(frontend)', 'tokens.css')
const WHITE = parseColor('#FFFFFF')

const properties = readCustomProperties(TOKENS_FILE)

function token(name: string): Rgba {
  const value = properties.get(name)
  expect(value, `${name} 값을 tokens.css에서 읽어야 한다`).toBeDefined()
  return parseColor(value ?? '')
}

// 사진 중 가장 밝은 부분(순백) 위에 덮개를 겹친 색 — 사진 위 글자의 최악 배경
function worstPhotoBackground(): Rgba {
  return compositeOver(token('--overlay-photo'), WHITE)
}

describe('AC-LANDING-006 짙은 히어로의 대비(토큰 값으로 재계산)', () => {
  it('덮개 토큰은 rgba(29, 29, 31, 0.65)이고, 순백 위 합성색은 반올림하지 않은 rgb(108.1, 108.1, 109.4)다', () => {
    expect(token('--overlay-photo')).toEqual({ r: 29, g: 29, b: 31, a: 0.65 })

    const worst = worstPhotoBackground()
    expect(worst.r).toBeCloseTo(108.1, 10)
    expect(worst.g).toBeCloseTo(108.1, 10)
    expect(worst.b).toBeCloseTo(109.4, 10)
    expect(worst.a).toBe(1)
  })

  it('흰 글자(--on-dark) / 짙은 면(--surface-dark) = 14.91', () => {
    expect(round2(contrastRatio(token('--on-dark'), token('--surface-dark')))).toBe(14.91)
  })

  it('흰 글자(--on-dark) / 덮개 최악 배경 = 5.24이고 본문 기준 4.5 이상이다', () => {
    const ratio = contrastRatio(token('--on-dark'), worstPhotoBackground())
    expect(round2(ratio)).toBe(5.24)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('버튼 글자(--color-text) / 흰 버튼 = 16.83, / hover 바탕(--color-surface) = 15.46', () => {
    expect(round2(contrastRatio(token('--color-text'), WHITE))).toBe(16.83)
    expect(round2(contrastRatio(token('--color-text'), token('--color-surface')))).toBe(15.46)
  })

  it('흰 버튼 경계·포커스 외곽선 / 덮개 최악 배경 = 5.24이고 UI 기준 3 이상이다', () => {
    const ratio = contrastRatio(WHITE, worstPhotoBackground())
    expect(round2(ratio)).toBe(5.24)
    expect(ratio).toBeGreaterThanOrEqual(3)
  })

  it('포인트 색(--color-accent) / 짙은 면 = 2.65이고 3 미만이다(히어로 안에서 쓰지 않는 근거)', () => {
    const ratio = contrastRatio(token('--color-accent'), token('--surface-dark'))
    expect(round2(ratio)).toBe(2.65)
    expect(ratio).toBeLessThan(3)
  })
})

describe('대비 도우미 자체', () => {
  it('3자리·6자리 16진수와 rgb()를 같은 값으로 읽는다', () => {
    expect(parseColor('#fff')).toEqual(parseColor('#FFFFFF'))
    expect(parseColor('rgb(255, 255, 255)')).toEqual(parseColor('#ffffff'))
  })

  it('알 수 없는 형식은 오류다', () => {
    expect(() => parseColor('teal')).toThrow('unsupported color value')
  })

  it('흑백 대비는 21이다', () => {
    expect(round2(contrastRatio(parseColor('#000'), WHITE))).toBe(21)
  })
})
