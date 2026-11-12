// SPEC-APPLY-001 테스트 데이터 도우미 — 테스트 데이터 표식을 붙인 신청 입력값과 이메일 표본을 만든다.
// 신청은 이름에 표식을 넣고 이메일은 `<표식>@example.test`로 쓴다(acceptance.md 머리말).
// 정리 순서: 신청 시도 기록 → 신청 → 회차 → 투어 → 미디어(plan.md §B.9).
import { randomBytes } from 'node:crypto'

// Crockford Base32(I·L·O·U 제외). 접수 번호 생성 모듈(M2) 이전에 테스트가 고유한 값을 만들 때만 쓴다
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** `SB-XXXXX-XXXXX` 형식의 무작위 접수 번호(테스트 전용). */
export function testReferenceCode(): string {
  const chars = [...randomBytes(10)].map((byte) => CROCKFORD[byte & 31]).join('')
  return `SB-${chars.slice(0, 5)}-${chars.slice(5)}`
}

/**
 * AC-APPLY-002 이메일 표본. 받는 표본은 모두 표식을 담고 example.test로 끝나므로 저장해도 정리 조건에 걸린다.
 * 거부 표본은 저장하지 않는다.
 */
export function emailSamples(marker: string): { accepted: string[]; rejected: string[] } {
  return {
    accepted: [`${marker}@example.test`, `kim.minji+${marker}@example.test`, `user-name-${marker}@sub.example.test`],
    rejected: ['a@b', 'a b@example.test', '"a"@example.test', 'a..b@example.test', `${'a'.repeat(242)}@example.test`],
  }
}

/** 필수 값을 모두 갖춘 신청 문서 입력값(로컬 API 저장용). */
export function applicationInput(
  session: number,
  marker: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    session,
    name: `${marker} 신청자`,
    email: `${marker}@example.test`,
    phone: '010-1234-5678',
    partySize: 2,
    referenceCode: testReferenceCode(),
    privacyConsentAt: new Date().toISOString(),
    privacyPolicyVersion: 'test-version',
    ...overrides,
  }
}
