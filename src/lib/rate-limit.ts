// 신청 횟수 제한 — SPEC-APPLY-001 REQ-APPLY-013, plan.md §B.5.
// 시도마다 application-attempts에 키 해시와 시도 시각을 1행 남기고, 최근 10분 안 같은 키의 행이 10개를 넘으면 거부한다.
// 기록은 DB에 둔다(서버리스 인스턴스마다 메모리가 따로 있고 재시작에 사라지므로). 원래 IP 문자열은 저장하지 않는다.
import { createHmac } from 'node:crypto'

import type { Payload } from 'payload'

export const RATE_LIMIT_MAX_ATTEMPTS = 10
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000

// 같은 비밀 값을 다른 서명과 섞지 않도록 용도 접두어를 붙인다
const KEY_PREFIX = 'apply-rate-limit:'

type HeaderReader = { get(name: string): string | null }

/**
 * 접속 IP: x-forwarded-for의 첫 값(공백 제거) → 없으면 x-real-ip → 없으면 'unknown'.
 * 'unknown'이면 모든 익명 요청이 한 키로 묶인다(로컬 개발에서만 생길 수 있음, plan.md §B.5). 서버 액션(M5)이 부른다.
 */
export function clientIpFromHeaders(headers: HeaderReader): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (forwarded) return forwarded
  const realIp = headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  return 'unknown'
}

/**
 * 횟수 제한 키: HMAC-SHA256(PAYLOAD_SECRET, 'apply-rate-limit:' + ip)의 16진수 64자.
 * 비밀 값은 원래 환경 변수 process.env.PAYLOAD_SECRET이다 — payload.secret은 Payload가 SHA-256으로 줄인 다른 값이라 쓰지 않는다.
 * 키 없는 해시는 IPv4 전체를 대입해 되돌릴 수 있으므로 반드시 비밀 값으로 서명한다.
 */
export function rateLimitKey(ip: string, secret: string | undefined = process.env.PAYLOAD_SECRET): string {
  if (!secret) throw new Error('PAYLOAD_SECRET is not set.')
  return createHmac('sha256', secret)
    .update(KEY_PREFIX + ip)
    .digest('hex')
}

// @MX:DEBT: [AUTO] 기록·세기를 원자적으로 묶지 않은 단순 횟수 제한 — 같은 키의 동시 요청 몇 건이 세기와 기록 사이에 끼어
//   한도를 조금 넘을 수 있고, 트래픽이 없으면 오래된 행이 다음 시도까지 남는다(plan.md §B.5 한계, R17)
// @MX:CEILING: 트래픽이 적은 단일 리전 배포의 기본 스팸 방지
// @MX:UPGRADE: 배포 SPEC에서 오래된 시도 기록 예약 정리(Vercel Cron 등)를 붙이고, 남용이 관측되면 원자적 카운터로 바꾼다
/**
 * 이번 시도를 기록하고 처리해도 되는지 돌려준다(true = 처리, false = RATE_LIMITED).
 * 순서(plan.md §B.5): 오래된 행 정리 → 이번 시도 기록 → 최근 10분 안 같은 키의 행 수가 10을 넘는지.
 * 시각은 신청 처리 함수가 받은 now로 기록한다(Payload 자동 createdAt에 기대지 않음). 신청이 거절되어도 기록은 남는다.
 */
export async function recordAttempt(payload: Payload, ip: string, now: Date): Promise<boolean> {
  const keyHash = rateLimitKey(ip)
  const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS).toISOString()

  await payload.delete({ collection: 'application-attempts', where: { attemptedAt: { less_than: windowStart } } })
  await payload.create({ collection: 'application-attempts', data: { keyHash, attemptedAt: now.toISOString() } })
  const recent = await payload.count({
    collection: 'application-attempts',
    where: {
      and: [
        { keyHash: { equals: keyHash } },
        { attemptedAt: { greater_than_equal: windowStart } },
        { attemptedAt: { less_than_equal: now.toISOString() } },
      ],
    },
  })
  return recent.totalDocs <= RATE_LIMIT_MAX_ATTEMPTS
}
