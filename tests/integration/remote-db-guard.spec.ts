// SPEC-DEPLOY-001 M1 — 원격 DB 차단(AC-DEPLOY-002). 개발·테스트용 진입점이 루프백이 아닌 DB 주소를 받으면
// DB에 연결하기 전에 호스트 이름만 담은 영문 문구로 멈추는지 자식 프로세스로 확인한다.
// 원격 주소는 실제로 연결되지 않는 db.example.invalid이고, 비밀번호 자리의 표식이 출력에 새지 않아야 한다.
import { spawnSync } from 'node:child_process'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const PASSWORD_MARKER = 'guard-pw-5e1c8d'
const REMOTE_HOST = 'db.example.invalid'
const LOOPBACK_REFUSAL = 'Only a loopback database is allowed for this command'

// 이미 설정된 변수는 .env가 덮어쓰지 않으므로(process.loadEnvFile·Payload loadEnv 모두) 여기서 넣은 주소가 쓰인다.
// 부모 Vitest의 내부 변수(VITEST_*)는 넘기지 않아 자식이 독립 실행처럼 동작하게 한다.
function remoteEnv(): NodeJS.ProcessEnv {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('VITEST')),
  ) as NodeJS.ProcessEnv
  env.DATABASE_URL = `postgresql://postgres:${PASSWORD_MARKER}@${REMOTE_HOST}:5432/sumbi`
  env.PAYLOAD_SECRET = 'guard-test-secret'
  return env
}

function run(args: string[]) {
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    env: remoteEnv(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
  })
  return { status: result.status, output: `${result.stdout ?? ''}\n${result.stderr ?? ''}` }
}

describe('AC-DEPLOY-002 원격 DB 차단(자식 프로세스)', () => {
  it.each(['dev', 'test', 'e2e'])('시작 전 점검 %s는 원격 DB를 연결 확인 전에 거부한다', (command) => {
    const { status, output } = run(['scripts/preflight.mjs', command])

    expect(status).not.toBe(0)
    expect(output).toContain(LOOPBACK_REFUSAL)
    expect(output).toContain(REMOTE_HOST)
    expect(output).not.toContain('Database connection failed')
    expect(output).not.toContain(PASSWORD_MARKER)
  })

  it('seed 진입점은 기존 assertSeedAllowed 문구로 거부한다', () => {
    const { status, output } = run(['node_modules/payload/bin.js', 'run', 'scripts/seed.ts'])

    expect(status).not.toBe(0)
    expect(output).toContain('Refusing to seed')
    expect(output).toContain(REMOTE_HOST)
    expect(output).not.toContain(PASSWORD_MARKER)
  })

  it('시작 전 점검을 거치지 않은 Vitest 직접 실행도 setup-env.ts에서 시험 본문 전에 거부한다', () => {
    const { status, output } = run([
      'node_modules/vitest/vitest.mjs',
      'run',
      '--project',
      'integration',
      'tests/integration/config-env.spec.ts',
      '--coverage.enabled=false',
    ])

    expect(status).not.toBe(0)
    expect(output).toContain(LOOPBACK_REFUSAL)
    expect(output).toContain(REMOTE_HOST)
    expect(output).not.toMatch(/Tests\s+\d+ passed/)
    expect(output).not.toContain(PASSWORD_MARKER)
  })

  it('Playwright 설정이 불러오는 e2e-env.ts도 원격 DB를 거부한다(웹 서버 시작 전)', () => {
    const { status, output } = run(['node_modules/@playwright/test/cli.js', 'test', '--list'])

    expect(status).not.toBe(0)
    expect(output).toContain(LOOPBACK_REFUSAL)
    expect(output).toContain(REMOTE_HOST)
    expect(output).not.toContain(PASSWORD_MARKER)
  })
})
