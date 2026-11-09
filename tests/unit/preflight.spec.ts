// 시작 전 점검(preflight) 로직 단위 테스트 — REQ-INFRA-008·009·010, AC-INFRA-012·014.
// 비밀 값이 메시지에 섞이지 않는지 확인하려고 일부러 눈에 띄는 가짜 값을 쓴다.
import net from 'node:net'

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_E2E_PORT,
  assertRequiredEnv,
  findMissingEnv,
  formatMissingEnvMessage,
  isPreflightCommand,
  parseDatabaseTarget,
  probePortFree,
  probeTcp,
  resolveE2ePort,
  runPreflight,
  type PreflightDeps,
  type PreflightResult,
} from '../../src/lib/preflight'

const FAKE_DB_PASSWORD = 'pw-must-not-leak-7f3a'
const FAKE_PAYLOAD_SECRET = 'secret-must-not-leak-91c2'
const FAKE_DATABASE_URL = `postgresql://sumbi:${FAKE_DB_PASSWORD}@127.0.0.1:5433/sumbi_tour`

const COMPLETE_ENV = {
  DATABASE_URL: FAKE_DATABASE_URL,
  PAYLOAD_SECRET: FAKE_PAYLOAD_SECRET,
}

// 실패 결과의 메시지(성공이면 undefined).
function messageOf(result: PreflightResult): string | undefined {
  return result.ok ? undefined : result.message
}

function expectNoSecrets(message: string | undefined): void {
  expect(message).toBeTypeOf('string')
  expect(message).not.toContain(FAKE_DB_PASSWORD)
  expect(message).not.toContain(FAKE_PAYLOAD_SECRET)
}

describe('필수 환경 변수 검증 (AC-INFRA-012)', () => {
  it('DATABASE_URL만 없으면 DATABASE_URL만 보고한다', () => {
    expect(findMissingEnv({ PAYLOAD_SECRET: FAKE_PAYLOAD_SECRET })).toEqual(['DATABASE_URL'])
  })

  it('PAYLOAD_SECRET만 없으면 PAYLOAD_SECRET만 보고한다', () => {
    expect(findMissingEnv({ DATABASE_URL: FAKE_DATABASE_URL })).toEqual(['PAYLOAD_SECRET'])
  })

  it('둘 다 없으면 두 이름을 모두 보고한다', () => {
    expect(findMissingEnv({})).toEqual(['DATABASE_URL', 'PAYLOAD_SECRET'])
  })

  it('빈 문자열과 공백만 있는 값은 누락으로 본다', () => {
    expect(findMissingEnv({ DATABASE_URL: '', PAYLOAD_SECRET: '   ' })).toEqual([
      'DATABASE_URL',
      'PAYLOAD_SECRET',
    ])
  })

  it('둘 다 값이 있으면 누락이 없다', () => {
    expect(findMissingEnv(COMPLETE_ENV)).toEqual([])
  })

  it('누락 메시지는 이름 전부와 .env.example을 담는다', () => {
    const message = formatMissingEnvMessage(['DATABASE_URL', 'PAYLOAD_SECRET'])

    expect(message).toContain('DATABASE_URL')
    expect(message).toContain('PAYLOAD_SECRET')
    expect(message).toContain('.env.example')
  })

  it('assertRequiredEnv는 누락 시 이름을 담은 오류를 던지고 값은 드러내지 않는다', () => {
    const env = { DATABASE_URL: FAKE_DATABASE_URL, PAYLOAD_SECRET: '' }

    expect(() => assertRequiredEnv(env)).toThrowError(/PAYLOAD_SECRET/)
    try {
      assertRequiredEnv(env)
    } catch (error) {
      expectNoSecrets((error as Error).message)
      expect((error as Error).message).not.toContain(FAKE_DATABASE_URL)
    }
  })

  it('assertRequiredEnv는 값이 모두 있으면 아무것도 하지 않는다', () => {
    expect(() => assertRequiredEnv(COMPLETE_ENV)).not.toThrow()
  })
})

describe('DATABASE_URL 접속 대상 해석', () => {
  it('호스트·포트·DB 이름을 꺼내고 사용자·비밀번호는 담지 않는다', () => {
    const target = parseDatabaseTarget(FAKE_DATABASE_URL)

    expect(target).toEqual({ host: '127.0.0.1', port: 5433, database: 'sumbi_tour' })
    expect(JSON.stringify(target)).not.toContain(FAKE_DB_PASSWORD)
  })

  it('포트가 없으면 5432를 쓰고 postgres:// 형식도 받는다', () => {
    expect(parseDatabaseTarget('postgres://u:p@localhost/app')).toEqual({
      host: 'localhost',
      port: 5432,
      database: 'app',
    })
  })

  it('IPv6 주소의 대괄호를 벗기고 퍼센트 인코딩된 DB 이름을 푼다', () => {
    expect(parseDatabaseTarget('postgresql://u:p@[::1]:5432/my%20db')).toEqual({
      host: '::1',
      port: 5432,
      database: 'my db',
    })
  })

  it.each([
    ['URL이 아닌 문자열', `not a url ${FAKE_DB_PASSWORD}`],
    ['PostgreSQL이 아닌 스킴', 'http://localhost:5432/app'],
    ['호스트가 없는 URL', 'postgresql:///app'],
  ])('%s는 해석하지 않는다(null)', (_label, value) => {
    expect(parseDatabaseTarget(value)).toBeNull()
  })
})

describe('E2E 전용 포트 값', () => {
  it.each([
    [undefined, DEFAULT_E2E_PORT],
    ['', DEFAULT_E2E_PORT],
    ['3200', 3200],
  ])('E2E_PORT=%s → %s', (value, expected) => {
    expect(resolveE2ePort({ E2E_PORT: value })).toBe(expected)
  })

  it.each(['abc', '0', '70000', '31.5'])('잘못된 값 %s는 null', (value) => {
    expect(resolveE2ePort({ E2E_PORT: value })).toBeNull()
  })
})

describe('TCP 접속·포트 점유 확인 (로컬 소켓)', () => {
  const servers: net.Server[] = []

  afterEach(async () => {
    await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))))
    servers.length = 0
  })

  function listen(host?: string): Promise<number> {
    const server = net.createServer()
    servers.push(server)
    return new Promise((resolve) => {
      server.listen({ port: 0, host }, () => resolve((server.address() as net.AddressInfo).port))
    })
  }

  async function closedPort(): Promise<number> {
    const port = await listen('127.0.0.1')
    const server = servers.pop() as net.Server
    await new Promise((resolve) => server.close(resolve))
    return port
  }

  it('열린 포트에는 접속에 성공한다', async () => {
    const port = await listen('127.0.0.1')

    await expect(probeTcp('127.0.0.1', port, 3000)).resolves.toEqual({ ok: true })
  })

  it('닫힌 포트는 실패와 오류 코드를 돌려준다', async () => {
    const port = await closedPort()
    const result = await probeTcp('127.0.0.1', port, 5000)

    expect(result.ok).toBe(false)
    expect(result.ok ? '' : result.reason).toMatch(/ECONNREFUSED|timed out/)
  })

  it('응답이 없으면 시간 제한 안에 실패로 끝난다', async () => {
    // 192.0.2.1은 문서용 예약 주소(TEST-NET-1)로 라우팅되지 않는다.
    const started = Date.now()
    const result = await probeTcp('192.0.2.1', 5432, 200)

    expect(result.ok).toBe(false)
    expect(Date.now() - started).toBeLessThan(3000)
  })

  it('비어 있는 포트는 사용 가능으로 본다', async () => {
    const port = await closedPort()

    await expect(probePortFree(port)).resolves.toEqual({ ok: true })
  })

  it('다른 프로세스가 듣고 있는 포트는 사용 중으로 본다', async () => {
    const port = await listen()
    const result = await probePortFree(port)

    expect(result).toEqual({ ok: false, reason: 'EADDRINUSE' })
  })
})

describe('명령별 시작 전 점검 흐름', () => {
  function fakeDeps(overrides: Partial<PreflightDeps> = {}): PreflightDeps {
    return {
      probeTcp: vi.fn(async () => ({ ok: true as const })),
      probePortFree: vi.fn(async () => ({ ok: true as const })),
      ...overrides,
    }
  }

  it('알려진 명령 이름만 받는다', () => {
    expect(['dev', 'build', 'start', 'test', 'e2e'].every(isPreflightCommand)).toBe(true)
    expect(isPreflightCommand('lint')).toBe(false)
    expect(isPreflightCommand(undefined)).toBe(false)
  })

  it.each(['dev', 'build', 'start', 'test', 'e2e'] as const)(
    '%s: 환경 변수가 없으면 DB 확인 전에 실패한다',
    async (command) => {
      const deps = fakeDeps()
      const result = await runPreflight(command, { DATABASE_URL: FAKE_DATABASE_URL }, deps)

      expect(result.ok).toBe(false)
      expect(messageOf(result)).toContain('PAYLOAD_SECRET')
      expect(messageOf(result)).toContain('.env.example')
      expectNoSecrets(messageOf(result))
      expect(deps.probeTcp).not.toHaveBeenCalled()
      expect(deps.probePortFree).not.toHaveBeenCalled()
    },
  )

  it.each(['build', 'start'] as const)('%s: DB 접속은 확인하지 않는다', async (command) => {
    const deps = fakeDeps()

    await expect(runPreflight(command, COMPLETE_ENV, deps)).resolves.toEqual({ ok: true })
    expect(deps.probeTcp).not.toHaveBeenCalled()
  })

  it.each(['dev', 'test', 'e2e'] as const)('%s: DATABASE_URL의 호스트·포트로 접속을 확인한다', async (command) => {
    const deps = fakeDeps()

    await expect(runPreflight(command, COMPLETE_ENV, deps)).resolves.toEqual({ ok: true })
    expect(deps.probeTcp).toHaveBeenCalledWith('127.0.0.1', 5433, expect.any(Number))
  })

  it('DB 접속 실패 메시지는 대상·조치 명령을 담고 비밀 값은 담지 않는다', async () => {
    const deps = fakeDeps({ probeTcp: vi.fn(async () => ({ ok: false as const, reason: 'ECONNREFUSED' })) })
    const result = await runPreflight('test', COMPLETE_ENV, deps)

    expect(result.ok).toBe(false)
    expect(messageOf(result)).toMatch(/database connection failed/i)
    expect(messageOf(result)).toContain('127.0.0.1:5433')
    expect(messageOf(result)).toContain('sumbi_tour')
    expect(messageOf(result)).toContain('ECONNREFUSED')
    expect(messageOf(result)).toContain('docker compose up -d')
    expectNoSecrets(messageOf(result))
  })

  it('해석할 수 없는 DATABASE_URL은 값을 숨긴 채 실패한다', async () => {
    const deps = fakeDeps()
    const badUrl = `not a url ${FAKE_DB_PASSWORD}`
    const result = await runPreflight('dev', { ...COMPLETE_ENV, DATABASE_URL: badUrl }, deps)

    expect(result.ok).toBe(false)
    expect(messageOf(result)).toContain('DATABASE_URL')
    expectNoSecrets(messageOf(result))
    expect(deps.probeTcp).not.toHaveBeenCalled()
  })

  it('e2e: 전용 포트가 사용 중이면 포트 번호와 함께 실패한다', async () => {
    const deps = fakeDeps({ probePortFree: vi.fn(async () => ({ ok: false as const, reason: 'EADDRINUSE' })) })
    const result = await runPreflight('e2e', { ...COMPLETE_ENV, E2E_PORT: '3200' }, deps)

    expect(result.ok).toBe(false)
    expect(messageOf(result)).toContain('3200')
    expect(messageOf(result)).toMatch(/already in use/i)
    expect(deps.probePortFree).toHaveBeenCalledWith(3200)
  })

  it('e2e: E2E_PORT가 없으면 기본 포트를 확인한다', async () => {
    const deps = fakeDeps()

    await expect(runPreflight('e2e', COMPLETE_ENV, deps)).resolves.toEqual({ ok: true })
    expect(deps.probePortFree).toHaveBeenCalledWith(DEFAULT_E2E_PORT)
  })

  it('e2e: E2E_PORT가 잘못되면 포트 확인 없이 실패한다', async () => {
    const deps = fakeDeps()
    const result = await runPreflight('e2e', { ...COMPLETE_ENV, E2E_PORT: 'abc' }, deps)

    expect(result.ok).toBe(false)
    expect(messageOf(result)).toContain('E2E_PORT')
    expect(deps.probePortFree).not.toHaveBeenCalled()
  })

  it('test·dev는 E2E 포트를 확인하지 않는다', async () => {
    const deps = fakeDeps()

    await runPreflight('test', COMPLETE_ENV, deps)
    await runPreflight('dev', COMPLETE_ENV, deps)
    expect(deps.probePortFree).not.toHaveBeenCalled()
  })
})
