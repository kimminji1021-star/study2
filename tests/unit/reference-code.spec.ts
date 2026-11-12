// SPEC-APPLY-001 M2 — 접수 번호 생성 단위 테스트(AC-APPLY-011, plan.md §B.4).
// 저장소 규칙 부분(node:crypto 사용, Math.random 없음)은 tests/unit/repo-rules.spec.ts에 있다.
import { describe, expect, it } from 'vitest'

import {
  CROCKFORD_BASE32,
  REFERENCE_CODE_PATTERN,
  generateReferenceCode,
  isValidReferenceCode,
  normalizeReferenceCode,
} from '../../src/lib/reference-code'

const ACCEPTANCE_PATTERN = /^SB-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/

describe('접수 번호 생성(AC-APPLY-011)', () => {
  const codes = Array.from({ length: 10_000 }, () => generateReferenceCode())

  it('1만 개 모두 SB-XXXXX-XXXXX 형식(Crockford Base32)이다', () => {
    expect(codes).toHaveLength(10_000)
    expect(codes.filter((code) => !ACCEPTANCE_PATTERN.test(code))).toEqual([])
  })

  it('1만 개가 모두 서로 다르다', () => {
    expect(new Set(codes).size).toBe(10_000)
  })

  it('Crockford Base32 32자가 모두 1회 이상 나타나고 I·L·O·U는 나타나지 않는다', () => {
    const body = codes.map((code) => code.slice(3).replace('-', '')).join('')
    expect(CROCKFORD_BASE32).toBe('0123456789ABCDEFGHJKMNPQRSTVWXYZ')
    expect(CROCKFORD_BASE32).toHaveLength(32)
    for (const char of CROCKFORD_BASE32) {
      expect(body.includes(char), char).toBe(true)
    }
    expect(body).not.toMatch(/[ILOU]/)
  })
})

describe('접수 번호 형식 검사와 대문자 정규화(REQ-APPLY-012 준비)', () => {
  it('형식 검사 정규식은 수용 기준 정규식과 같은 범위를 받는다', () => {
    expect(REFERENCE_CODE_PATTERN.source).toBe(ACCEPTANCE_PATTERN.source)
  })

  it.each(['SB-00000-00000', 'SB-ABCDE-FGHJK', 'SB-VWXYZ-12345'])('%s는 올바른 형식이다', (code) => {
    expect(isValidReferenceCode(code)).toBe(true)
  })

  it.each(['SB-0000-00000', 'SB-ABCDI-00000', 'sb-abcde-fghjk', 'SB-ABCDE-FGHJK ', 'abc', '', 42])(
    '%j는 형식이 틀렸다',
    (code) => {
      expect(isValidReferenceCode(code)).toBe(false)
    },
  )

  it('대문자로 맞춘 뒤 형식을 검사한다', () => {
    expect(normalizeReferenceCode('sb-abcde-fghjk')).toBe('SB-ABCDE-FGHJK')
    expect(normalizeReferenceCode('sb-abcdi-00000')).toBeNull()
    expect(normalizeReferenceCode(undefined)).toBeNull()
  })
})
