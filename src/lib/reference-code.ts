// 접수 번호 — SPEC-APPLY-001 REQ-APPLY-011·012, plan.md §B.4.
// `SB-` + Crockford Base32 10자(50비트 난수, 5자씩 하이픈). DB 순번 ID와 무관하고 추측·열거할 수 없다.
// 난수는 node:crypto에서만 얻는다(추측 가능한 일반 난수 함수 금지 — 저장소 규칙 테스트 AC-APPLY-011).
import { randomBytes } from 'node:crypto'

// I·L·O·U를 뺀 32자(전화로 불러 줄 때 헷갈리지 않음)
export const CROCKFORD_BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export const REFERENCE_CODE_PATTERN = /^SB-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/

/**
 * 새 접수 번호. 바이트마다 아래 5비트를 문자 하나로 쓴다 — 256은 32의 배수라 모듈로 편향이 없다.
 * 충돌은 고유 제약이 막고, 그때는 트랜잭션이 되돌려져 INTERNAL_ERROR가 된다(재시도 루프 없음, plan.md §B.4).
 */
export function generateReferenceCode(): string {
  const chars = [...randomBytes(10)].map((byte) => CROCKFORD_BASE32[byte & 31]).join('')
  return `SB-${chars.slice(0, 5)}-${chars.slice(5)}`
}

/** 저장·조회 전에 쓰는 형식 검사(대문자 기준). */
export function isValidReferenceCode(value: unknown): value is string {
  return typeof value === 'string' && REFERENCE_CODE_PATTERN.test(value)
}

/** 접수 완료 경로의 값: 대소문자를 구분하지 않고 받아 대문자로 맞춘 뒤 형식을 검사한다. 틀리면 null(DB 조회 없이 404). */
export function normalizeReferenceCode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const upper = value.toUpperCase()
  return isValidReferenceCode(upper) ? upper : null
}
