// 시작 전 점검(preflight) — 서버나 테스트를 띄우기 전에 환경 변수, DB 접속, E2E 포트를 확인한다.
// SPEC-INFRA-001 REQ-INFRA-008(환경 변수), REQ-INFRA-009(DB 접속), REQ-INFRA-010(비밀 값 미노출), REQ-INFRA-014(E2E 포트).
//
// 이 파일은 scripts/preflight.mjs가 Node의 타입 제거(type stripping)로 직접 불러온다.
// 그래서 enum·매개변수 속성처럼 지울 수 없는 TypeScript 문법과 다른 .ts 파일 import를 쓰지 않는다.
//
// 메시지 원칙: 변수 이름과 접속 대상(호스트·포트·DB 이름)만 보여 주고, 값(비밀번호·PAYLOAD_SECRET)은 절대 넣지 않는다.
import net from 'node:net'

export type EnvSource = Readonly<Record<string, string | undefined>>

export const REQUIRED_ENV_NAMES = ['DATABASE_URL', 'PAYLOAD_SECRET'] as const

// @MX:NOTE: [AUTO] E2E 전용 포트 기본값 — 개발 서버 기본 포트 3000과 겹치지 않게 고른 값(plan.md M5 예시)
export const DEFAULT_E2E_PORT = 3100

// DB 접속 확인 시간 제한. REQ-INFRA-009의 60초 안 종료 조건보다 충분히 짧게 둔다.
export const DB_PROBE_TIMEOUT_MS = 5000

const POSTGRES_DEFAULT_PORT = 5432
const LOG_PREFIX = '[preflight]'

/** 값이 없거나 공백뿐인 필수 변수의 이름을 선언 순서대로 돌려준다. */
export function findMissingEnv(env: EnvSource, names: readonly string[] = REQUIRED_ENV_NAMES): string[] {
  return names.filter((name) => (env[name] ?? '').trim() === '')
}

export function formatMissingEnvMessage(missing: readonly string[]): string {
  return [
    `${LOG_PREFIX} Missing required environment variables: ${missing.join(', ')}.`,
    'Copy .env.example to .env and set a value for each variable listed above.',
  ].join('\n')
}

// @MX:NOTE: [AUTO] Payload 설정 로드 시점의 재검증용(설정을 직접 불러오는 경로 대비, plan.md §B.3). 연결은 M3에서 한다
/** 필수 변수가 비어 있으면 이름만 담은 오류를 던진다. */
export function assertRequiredEnv(env: EnvSource): void {
  const missing = findMissingEnv(env)
  if (missing.length > 0) {
    throw new Error(formatMissingEnvMessage(missing))
  }
}

export type DatabaseTarget = { host: string; port: number; database: string }

/** DATABASE_URL에서 접속 대상만 꺼낸다. 사용자 이름·비밀번호는 결과에 담지 않는다. 해석할 수 없으면 null. */
export function parseDatabaseTarget(value: string): DatabaseTarget | null {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') return null
  // URL은 IPv6 주소를 대괄호로 감싸 돌려주지만, net.connect는 대괄호 없는 주소를 받는다.
  const host = url.hostname.replace(/^\[(.*)\]$/, '$1')
  if (host === '') return null
  return {
    host,
    port: url.port === '' ? POSTGRES_DEFAULT_PORT : Number(url.port),
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
  }
}

/** E2E_PORT를 해석한다. 비어 있으면 기본값, 1~65535 정수가 아니면 null. */
export function resolveE2ePort(env: EnvSource): number | null {
  const raw = (env.E2E_PORT ?? '').trim()
  if (raw === '') return DEFAULT_E2E_PORT
  if (!/^\d+$/.test(raw)) return null
  const port = Number(raw)
  return port >= 1 && port <= 65535 ? port : null
}

export type ProbeResult = { ok: true } | { ok: false; reason: string }

function errorReason(error: unknown): string {
  const { code, message } = error as NodeJS.ErrnoException
  return code ?? message
}

/** host:port로 TCP 연결을 한 번 시도한다. 시간 제한을 넘기면 실패로 본다. */
export function probeTcp(host: string, port: number, timeoutMs: number): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port })
    const finish = (result: ProbeResult) => {
      socket.destroy()
      resolve(result)
    }
    socket.setTimeout(timeoutMs, () => finish({ ok: false, reason: `timed out after ${timeoutMs} ms` }))
    socket.once('connect', () => finish({ ok: true }))
    socket.once('error', (error) => finish({ ok: false, reason: errorReason(error) }))
  })
}

/** 포트를 잠깐 열어 보고 닫는다. 이미 다른 프로세스가 쓰고 있으면 실패(EADDRINUSE). */
export function probePortFree(port: number): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', (error) => resolve({ ok: false, reason: errorReason(error) }))
    // 호스트를 지정하지 않으면 모든 주소(가능하면 IPv6 이중 스택)에 바인딩해, 어느 주소에서든 점유를 잡아낸다.
    server.listen({ port }, () => server.close(() => resolve({ ok: true })))
  })
}

export const PREFLIGHT_COMMANDS = ['dev', 'build', 'start', 'test', 'e2e'] as const
export type PreflightCommand = (typeof PREFLIGHT_COMMANDS)[number]

export function isPreflightCommand(value: unknown): value is PreflightCommand {
  return (PREFLIGHT_COMMANDS as readonly unknown[]).includes(value)
}

// DB 접속이 필요한 명령(REQ-INFRA-009). build·start는 환경 변수만 확인한다.
const DB_COMMANDS: readonly PreflightCommand[] = ['dev', 'test', 'e2e']

export type PreflightDeps = {
  probeTcp: (host: string, port: number, timeoutMs: number) => Promise<ProbeResult>
  probePortFree: (port: number) => Promise<ProbeResult>
}

export type PreflightResult = { ok: true } | { ok: false; message: string }

const defaultDeps: PreflightDeps = { probeTcp, probePortFree }

// @MX:ANCHOR: [AUTO] dev·build·start·test·e2e 스크립트가 모두 이 함수를 거쳐 시작된다
// @MX:REASON: 점검 순서(환경 변수 → DB → E2E 포트)와 "서버 시작 전 종료" 계약을 바꾸면 AC-INFRA-012·014·015가 함께 깨진다
/** 명령별 시작 전 점검. 첫 실패에서 멈추고 사람이 읽을 메시지를 돌려준다. */
export async function runPreflight(
  command: PreflightCommand,
  env: EnvSource,
  deps: PreflightDeps = defaultDeps,
): Promise<PreflightResult> {
  const missing = findMissingEnv(env)
  if (missing.length > 0) {
    return { ok: false, message: formatMissingEnvMessage(missing) }
  }

  if (DB_COMMANDS.includes(command)) {
    const target = parseDatabaseTarget(env.DATABASE_URL ?? '')
    if (target === null) {
      return {
        ok: false,
        message: [
          `${LOG_PREFIX} DATABASE_URL is not a valid PostgreSQL connection URL (the value is not shown).`,
          'Expected the form postgresql://USER:PASSWORD@HOST:PORT/DATABASE. See .env.example.',
        ].join('\n'),
      }
    }
    const probe = await deps.probeTcp(target.host, target.port, DB_PROBE_TIMEOUT_MS)
    if (!probe.ok) {
      const database = target.database === '' ? '(not set)' : target.database
      return {
        ok: false,
        message: [
          `${LOG_PREFIX} Database connection failed: cannot reach PostgreSQL at ${target.host}:${target.port} (database: ${database}) - ${probe.reason}.`,
          'Start the local database with: docker compose up -d',
        ].join('\n'),
      }
    }
  }

  if (command === 'e2e') {
    const port = resolveE2ePort(env)
    if (port === null) {
      return { ok: false, message: `${LOG_PREFIX} E2E_PORT must be an integer between 1 and 65535.` }
    }
    const probe = await deps.probePortFree(port)
    if (!probe.ok) {
      return {
        ok: false,
        message: [
          `${LOG_PREFIX} E2E port ${port} is already in use by another process (${probe.reason}).`,
          'Stop that process, or set E2E_PORT in .env to a free port.',
        ].join('\n'),
      }
    }
  }

  return { ok: true }
}
