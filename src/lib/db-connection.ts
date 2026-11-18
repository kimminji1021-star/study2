// DB 연결 풀 설정 — SPEC-DEPLOY-001 REQ-DEPLOY-004, plan.md §B.2.
// 원격 DB(Supabase 트랜잭션 풀러)는 인증서 검증을 켠 SSL과 정해진 풀 크기로, 루프백 DB는 지금 설정 그대로 연결한다.
// 오류 문구에는 변수 이름만 담고 연결 문자열·인증서 값은 넣지 않는다(REQ-INFRA-010).
import { isLoopbackHost, parseDatabaseTarget, type EnvSource } from './preflight'

export const DEFAULT_REMOTE_POOL_MAX = 5
export const MIN_POOL_MAX = 3
export const MAX_POOL_MAX = 20

const CERTIFICATE_MARKER = '-----BEGIN CERTIFICATE-----'

export type DatabasePoolConfig = {
  connectionString?: string
  max?: number
  ssl?: { ca: string; rejectUnauthorized: true }
}

export class DatabaseConfigError extends Error {
  override name = 'DatabaseConfigError'
}

/** DATABASE_URL의 호스트가 루프백인지. 비었거나 해석할 수 없으면 원격으로 본다(안전한 쪽). */
export function isLoopbackDatabaseUrl(url: string | undefined): boolean {
  const target = parseDatabaseTarget(url ?? '')
  return target !== null && isLoopbackHost(target.host)
}

/** DATABASE_POOL_MAX를 해석한다. 없으면 undefined, 3~20 정수가 아니면 설정 오류. */
export function resolvePoolMax(env: EnvSource): number | undefined {
  const raw = (env.DATABASE_POOL_MAX ?? '').trim()
  if (raw === '') return undefined
  const value = /^\d+$/.test(raw) ? Number(raw) : Number.NaN
  if (!(value >= MIN_POOL_MAX && value <= MAX_POOL_MAX)) {
    throw new DatabaseConfigError(
      `[db] DATABASE_POOL_MAX must be an integer between ${MIN_POOL_MAX} and ${MAX_POOL_MAX}.`,
    )
  }
  return value
}

// 환경 변수 화면에 PEM을 한 줄로 넣으면 줄바꿈이 `\n` 글자로 들어올 수 있다. 실제 줄바꿈이 없을 때만 바꾼다
function normalizeCertificate(raw: string): string {
  const value = raw.trim()
  return value.includes('\n') ? value : value.replaceAll('\\n', '\n')
}

// @MX:NOTE: [AUTO] 풀 크기 최소 3인 이유 — Payload의 connectWithReconnect가 시작 때 연결 1개를 오류 감시용으로 계속 붙잡아
//   실제로 쓸 수 있는 연결은 max − 1이다. 정원 확인 트랜잭션이 1개를 쥔 동안 트랜잭션 밖 질의가 1개를 더 얻어야 하므로 2 이하면 서로 기다리며 멈춘다(R2).
//   원격인데 인증서가 없으면 설정을 돌려주지 않는다 — ssl이 빠진 설정이면 pg가 PGSSLMODE만 보고 암호화 없이 연결할 수 있다.
//   연결 문자열의 sslmode는 코드의 ssl 설정을 덮어쓰므로 쓰지 않는다(운영 빌드 점검이 거부 — M4)
/** Payload postgresAdapter의 pool 설정. 루프백 + 풀 크기 미지정이면 지금 설정(연결 문자열만)과 같다. */
export function buildPoolConfig(env: EnvSource): DatabasePoolConfig {
  const connectionString = env.DATABASE_URL
  const max = resolvePoolMax(env)

  if (isLoopbackDatabaseUrl(connectionString)) {
    return max === undefined ? { connectionString } : { connectionString, max }
  }

  const ca = normalizeCertificate(env.DATABASE_CA_CERT ?? '')
  if (!ca.includes(CERTIFICATE_MARKER)) {
    throw new DatabaseConfigError(
      `[db] DATABASE_CA_CERT must contain the database CA certificate (PEM, ${CERTIFICATE_MARKER}) to connect to a non-loopback database.`,
    )
  }
  return {
    connectionString,
    max: max ?? DEFAULT_REMOTE_POOL_MAX,
    ssl: { ca, rejectUnauthorized: true },
  }
}
