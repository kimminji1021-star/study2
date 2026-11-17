// WCAG 2.x 대비 계산 시험 도우미 — SPEC-LANDING-001 AC-LANDING-006, plan.md §B.5.
// 토큰 파일(tokens.css)의 색 값을 읽어 상대 휘도와 대비를 다시 잰다. 제품 코드는 이 계산을 쓰지 않는다.
// 덮개 합성은 spec.md §2.5 "덮개 합성" 규칙대로 채널마다 α×덮개 + (1−α)×바탕의 실수값을 쓰고 반올림하지 않는다.
// 마지막 대비 값만 소수 둘째 자리에서 반올림한다(round2).
import { readFileSync } from 'node:fs'

export type Rgba = { r: number; g: number; b: number; a: number }

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
const RGB = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i

/** `#rgb`·`#rrggbb`·`rgb(…)`·`rgba(…)`를 채널 값(0~255, 실수)과 알파(0~1)로 바꾼다. 형식이 다르면 오류. */
export function parseColor(value: string): Rgba {
  const text = value.trim()
  const hex = HEX.exec(text)
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((digit) => digit + digit).join('') : hex[1]
    return {
      r: Number.parseInt(digits.slice(0, 2), 16),
      g: Number.parseInt(digits.slice(2, 4), 16),
      b: Number.parseInt(digits.slice(4, 6), 16),
      a: 1,
    }
  }
  const rgb = RGB.exec(text)
  if (rgb) {
    return {
      r: Number(rgb[1]),
      g: Number(rgb[2]),
      b: Number(rgb[3]),
      a: rgb[4] === undefined ? 1 : Number(rgb[4]),
    }
  }
  throw new Error(`unsupported color value: ${value}`)
}

/** 반투명 색(top)을 불투명 바탕(bottom) 위에 겹친 색. 채널 값은 반올림하지 않는다. */
export function compositeOver(top: Rgba, bottom: Rgba): Rgba {
  const mix = (front: number, back: number) => top.a * front + (1 - top.a) * back
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a: 1 }
}

function channel(value: number): number {
  const srgb = value / 255
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
}

/** WCAG 2.x 상대 휘도. 불투명 색만 받는다(반투명이면 먼저 compositeOver로 합성한다). */
export function relativeLuminance(color: Rgba): number {
  if (color.a !== 1) throw new Error('relativeLuminance expects an opaque color; composite it first')
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b)
}

/** 두 불투명 색의 대비(반올림하지 않은 값). */
export function contrastRatio(first: Rgba, second: Rgba): number {
  const [light, dark] = [relativeLuminance(first), relativeLuminance(second)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

/** 소수 둘째 자리 반올림(대비 값 표기용). */
export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** CSS 파일의 사용자 정의 속성 선언(`--이름: 값;`)을 읽는다. 주석은 빼고, 같은 이름은 처음 나온 값(:root 기본값)을 쓴다. */
export function readCustomProperties(filePath: string): Map<string, string> {
  const source = readFileSync(filePath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const properties = new Map<string, string>()
  for (const match of source.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    if (!properties.has(match[1])) properties.set(match[1], match[2].trim())
  }
  return properties
}
