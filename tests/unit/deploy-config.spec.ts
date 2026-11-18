// SPEC-DEPLOY-001 M1 단위 테스트 — 루프백 판정, DB 연결 설정, 업로드 저장소 설정 판정, Vercel 빌드 명령 목록,
// 마이그레이션 변화 검사(migrate:check) 핵심 로직. DB나 네트워크에 연결하지 않는다.
// 원격 주소 예시는 실제로 연결되지 않는 db.example.invalid를 쓰고, 비밀번호 자리에는 표식 문자열을 넣어 출력에 새지 않는지 본다.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { checkMigrations } from '../../scripts/migrate-check.mjs'
import { planVercelBuild } from '../../scripts/vercel-build.mjs'
import { buildPoolConfig, DatabaseConfigError, isLoopbackDatabaseUrl } from '../../src/lib/db-connection'
import { assertLoopbackDatabase, isLoopbackHost, runPreflight } from '../../src/lib/preflight'
import { resolveStorageConfig, S3_ENV_NAMES, StorageConfigError } from '../../src/lib/storage'

const PASSWORD_MARKER = 'pw-marker-7f3a9c'
const REMOTE_URL = `postgresql://postgres.ref:${PASSWORD_MARKER}@db.example.invalid:6543/postgres`
const LOOPBACK_URL = `postgresql://sumbi:${PASSWORD_MARKER}@127.0.0.1:5432/sumbi_tour`
// 형식만 맞춘 가짜 인증서(실제 인증서 아님)
const FAKE_CA = '-----BEGIN CERTIFICATE-----\ntest-ca-body\n-----END CERTIFICATE-----'

describe('AC-DEPLOY-002 루프백 판정', () => {
  it.each(['localhost', '127.0.0.1', '::1', '[::1]', 'LOCALHOST'])('%s는 루프백이다', (host) => {
    expect(isLoopbackHost(host)).toBe(true)
  })

  it.each(['db.example.invalid', 'aws-0-ap-northeast-2.pooler.supabase.com', '10.0.0.5', '127.0.0.2', ''])(
    '%s는 루프백이 아니다',
    (host) => {
      expect(isLoopbackHost(host)).toBe(false)
    },
  )

  it('연결 문자열 판정은 호스트만 본다', () => {
    expect(isLoopbackDatabaseUrl(LOOPBACK_URL)).toBe(true)
    expect(isLoopbackDatabaseUrl('postgres://u:p@[::1]:5432/db')).toBe(true)
    expect(isLoopbackDatabaseUrl(REMOTE_URL)).toBe(false)
    expect(isLoopbackDatabaseUrl('not a url')).toBe(false)
    expect(isLoopbackDatabaseUrl(undefined)).toBe(false)
  })

  it('assertLoopbackDatabase는 원격 주소면 호스트 이름만 담은 영문 오류를 던진다', () => {
    expect(() => assertLoopbackDatabase({ DATABASE_URL: REMOTE_URL })).toThrow(
      '[preflight] Only a loopback database is allowed for this command (host: db.example.invalid).',
    )
    try {
      assertLoopbackDatabase({ DATABASE_URL: REMOTE_URL })
    } catch (error) {
      expect(String(error)).not.toContain(PASSWORD_MARKER)
    }
  })

  it('assertLoopbackDatabase는 루프백·빈 값이면 통과하고, 해석할 수 없는 값이면 값 없이 거부한다', () => {
    expect(() => assertLoopbackDatabase({ DATABASE_URL: LOOPBACK_URL })).not.toThrow()
    expect(() => assertLoopbackDatabase({ DATABASE_URL: '' })).not.toThrow()
    expect(() => assertLoopbackDatabase({})).not.toThrow()
    expect(() => assertLoopbackDatabase({ DATABASE_URL: `x-${PASSWORD_MARKER}` })).toThrow(/not a valid PostgreSQL/)
    try {
      assertLoopbackDatabase({ DATABASE_URL: `x-${PASSWORD_MARKER}` })
    } catch (error) {
      expect(String(error)).not.toContain(PASSWORD_MARKER)
    }
  })

  it.each(['dev', 'test', 'e2e'] as const)(
    'runPreflight(%s)는 원격 DB면 연결을 시도하지 않고 거부한다',
    async (command) => {
      const calls: string[] = []
      const result = await runPreflight(
        command,
        { DATABASE_URL: REMOTE_URL, PAYLOAD_SECRET: 'unit-test-secret' },
        {
          probeTcp: async (host) => {
            calls.push(host)
            return { ok: true }
          },
          probePortFree: async () => ({ ok: true }),
        },
      )

      expect(result.ok).toBe(false)
      expect(calls).toEqual([])
      if (!result.ok) {
        expect(result.message).toContain('db.example.invalid')
        expect(result.message).toContain('Only a loopback database')
        expect(result.message).not.toContain(PASSWORD_MARKER)
      }
    },
  )

  it('runPreflight(build)는 원격 DB여도 루프백 점검을 하지 않는다(운영 빌드 경로)', async () => {
    const result = await runPreflight('build', { DATABASE_URL: REMOTE_URL, PAYLOAD_SECRET: 'unit-test-secret' })
    expect(result).toEqual({ ok: true })
  })
})

describe('AC-DEPLOY-004 DB 연결 설정', () => {
  it('원격 + 인증서: 인증서 검증을 켜고 풀 크기 기본값 5를 쓴다', () => {
    expect(buildPoolConfig({ DATABASE_URL: REMOTE_URL, DATABASE_CA_CERT: FAKE_CA })).toEqual({
      connectionString: REMOTE_URL,
      max: 5,
      ssl: { ca: FAKE_CA, rejectUnauthorized: true },
    })
  })

  it('원격 + 한 줄로 들어온 인증서(\\n 글자)는 줄바꿈으로 바꾼다', () => {
    const oneLine = FAKE_CA.replaceAll('\n', '\\n')
    const config = buildPoolConfig({ DATABASE_URL: REMOTE_URL, DATABASE_CA_CERT: oneLine })
    expect(config.ssl?.ca).toBe(FAKE_CA)
  })

  it.each([
    ['없음', undefined],
    ['빈 값', '  '],
    ['PEM 아님', 'not-a-certificate'],
  ])('원격 + 인증서 %s: 설정을 돌려주지 않고 변수 이름만 담은 오류', (_label, ca) => {
    let caught: unknown
    try {
      buildPoolConfig({ DATABASE_URL: REMOTE_URL, DATABASE_CA_CERT: ca })
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(DatabaseConfigError)
    const message = (caught as Error).message
    expect(message).toContain('DATABASE_CA_CERT')
    expect(message).not.toContain(PASSWORD_MARKER)
    expect(message).not.toContain('db.example.invalid:6543/postgres')
  })

  it.each([
    ['3', 3],
    ['20', 20],
  ])('DATABASE_POOL_MAX=%s이면 그 값을 쓴다(원격·루프백)', (raw, expected) => {
    expect(buildPoolConfig({ DATABASE_URL: REMOTE_URL, DATABASE_CA_CERT: FAKE_CA, DATABASE_POOL_MAX: raw }).max).toBe(
      expected,
    )
    expect(buildPoolConfig({ DATABASE_URL: LOOPBACK_URL, DATABASE_POOL_MAX: raw }).max).toBe(expected)
  })

  it.each(['2', '21', 'abc', '3.5', '-3'])('DATABASE_POOL_MAX=%s이면 설정 오류(원격·루프백)', (raw) => {
    expect(() =>
      buildPoolConfig({ DATABASE_URL: REMOTE_URL, DATABASE_CA_CERT: FAKE_CA, DATABASE_POOL_MAX: raw }),
    ).toThrow(/DATABASE_POOL_MAX/)
    expect(() => buildPoolConfig({ DATABASE_URL: LOOPBACK_URL, DATABASE_POOL_MAX: raw })).toThrow(DatabaseConfigError)
  })

  it('루프백 + DATABASE_POOL_MAX 없음: 지금 설정(연결 문자열만)과 같다', () => {
    expect(buildPoolConfig({ DATABASE_URL: LOOPBACK_URL })).toEqual({ connectionString: LOOPBACK_URL })
    expect(buildPoolConfig({ DATABASE_URL: LOOPBACK_URL, DATABASE_POOL_MAX: '' })).toEqual({
      connectionString: LOOPBACK_URL,
    })
  })

  it('루프백 + DATABASE_POOL_MAX=3: max가 3이고 SSL 설정을 더하지 않는다', () => {
    expect(buildPoolConfig({ DATABASE_URL: LOOPBACK_URL, DATABASE_POOL_MAX: '3' })).toEqual({
      connectionString: LOOPBACK_URL,
      max: 3,
    })
  })
})

const S3_VALUES: Record<string, string> = {
  S3_BUCKET: 'test-bucket-mk1',
  S3_ENDPOINT: 'https://test-ref.storage.example.invalid/storage/v1/s3',
  S3_REGION: 'test-region-mk2',
  S3_ACCESS_KEY_ID: 'test-access-mk3',
  S3_SECRET_ACCESS_KEY: 'test-secret-mk4',
}

describe('AC-DEPLOY-006 업로드 저장소 설정 판정', () => {
  it('변수 이름 목록은 다섯 개다', () => {
    expect([...S3_ENV_NAMES]).toEqual(Object.keys(S3_VALUES))
  })

  it('다섯 변수가 모두 있으면 설정 객체(forcePathStyle: true)', () => {
    expect(resolveStorageConfig(S3_VALUES)).toEqual({
      bucket: 'test-bucket-mk1',
      config: {
        endpoint: 'https://test-ref.storage.example.invalid/storage/v1/s3',
        region: 'test-region-mk2',
        forcePathStyle: true,
        credentials: { accessKeyId: 'test-access-mk3', secretAccessKey: 'test-secret-mk4' },
      },
    })
  })

  it('하나도 없으면(빈 값·공백 포함) null', () => {
    expect(resolveStorageConfig({})).toBeNull()
    expect(resolveStorageConfig({ S3_BUCKET: '', S3_REGION: '  ' })).toBeNull()
  })

  it('일부만 있으면 빠진 이름만 담은 오류(값 없음)', () => {
    const partial = { ...S3_VALUES, S3_REGION: '', S3_SECRET_ACCESS_KEY: undefined }
    let caught: unknown
    try {
      resolveStorageConfig(partial)
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(StorageConfigError)
    const message = (caught as Error).message
    expect(message).toContain('S3_REGION, S3_SECRET_ACCESS_KEY')
    expect(message).not.toContain('S3_BUCKET')
    for (const value of Object.values(S3_VALUES)) {
      expect(message).not.toContain(value)
    }
  })
})

describe('AC-DEPLOY-003 Vercel 빌드 명령 목록', () => {
  it('VERCEL_ENV=production이면 시작 전 점검 → 마이그레이션 → 빌드 순서', () => {
    const plan = planVercelBuild({ VERCEL_ENV: 'production' })
    expect(plan.ok).toBe(true)
    if (plan.ok) {
      expect(plan.steps.map((step) => step.name)).toEqual(['preflight', 'migrate', 'build'])
      expect(plan.steps.map((step) => [step.command, ...step.args].join(' '))).toEqual([
        'node scripts/preflight.mjs build',
        'pnpm exec payload migrate',
        'pnpm build',
      ])
    }
  })

  it.each([undefined, '', 'preview', 'development', 'Production'])('VERCEL_ENV=%s이면 명령 없이 거부', (value) => {
    const plan = planVercelBuild(value === undefined ? {} : { VERCEL_ENV: value })
    expect(plan.ok).toBe(false)
    if (!plan.ok) {
      expect(plan.message).toContain('production')
      expect(plan.message).toContain('No migration was run')
    }
  })
})

describe('AC-DEPLOY-003 migrate:check 핵심 로직(가짜 생성 명령)', () => {
  let root = ''

  afterEach(() => {
    if (root !== '') rmSync(root, { recursive: true, force: true })
    root = ''
  })

  function makeDir(): string {
    root = mkdtempSync(path.join(os.tmpdir(), 'migrate-check-unit-'))
    const dir = path.join(root, 'src', 'migrations')
    mkdirSync(dir, { recursive: true })
    writeFileSync(path.join(dir, '20260101_000000_initial.ts'), 'export const up = 1\n')
    writeFileSync(path.join(dir, '20260101_000000_initial.json'), '{}\n')
    writeFileSync(path.join(dir, 'index.ts'), 'export const migrations = [1]\n')
    return dir
  }

  it('두 실행 모두 새 파일이 없으면 통과하고 디렉터리를 건드리지 않는다', async () => {
    const dir = makeDir()
    const seen: string[] = []
    const result = await checkMigrations({
      dir,
      runs: [
        { label: 'no-s3', env: { A: '1' } },
        { label: 'fake-s3', env: { A: '2' } },
      ],
      create: async (env: Record<string, string | undefined>) => {
        seen.push(env.A ?? '')
        return { status: 0, output: '' }
      },
    })

    expect(seen).toEqual(['1', '2'])
    expect(result).toEqual({ ok: true, newFiles: [], failedRuns: [] })
    expect(readdirSync(dir).sort()).toEqual(['20260101_000000_initial.json', '20260101_000000_initial.ts', 'index.ts'])
  })

  it('새 파일이 생기면 실패하고 새 파일을 지우며 index.ts를 바이트 단위로 되돌린다', async () => {
    const dir = makeDir()
    const indexBefore = readFileSync(path.join(dir, 'index.ts'))
    const result = await checkMigrations({
      dir,
      runs: [{ label: 'no-s3', env: {} }],
      create: async () => {
        writeFileSync(path.join(dir, '20260102_000000_drift_check.ts'), 'export const up = 2\n')
        writeFileSync(path.join(dir, '20260102_000000_drift_check.json'), '{"x":1}\n')
        writeFileSync(path.join(dir, 'index.ts'), 'export const migrations = [1, 2]\n')
        return { status: 0, output: '' }
      },
    })

    expect(result.ok).toBe(false)
    expect(result.newFiles).toEqual(['20260102_000000_drift_check.json', '20260102_000000_drift_check.ts'])
    expect(readdirSync(dir).sort()).toEqual(['20260101_000000_initial.json', '20260101_000000_initial.ts', 'index.ts'])
    expect(readFileSync(path.join(dir, 'index.ts')).equals(indexBefore)).toBe(true)
  })

  it('생성 명령이 실패하거나 예외를 던져도 index.ts를 되돌리고 실패로 끝난다', async () => {
    const dir = makeDir()
    const indexBefore = readFileSync(path.join(dir, 'index.ts'))
    const failing = await checkMigrations({
      dir,
      runs: [{ label: 'no-s3', env: {} }],
      create: async () => {
        writeFileSync(path.join(dir, 'index.ts'), 'broken\n')
        return { status: 1, output: 'boom' }
      },
    })
    expect(failing.ok).toBe(false)
    expect(failing.failedRuns).toEqual(['no-s3'])
    expect(readFileSync(path.join(dir, 'index.ts')).equals(indexBefore)).toBe(true)

    await expect(
      checkMigrations({
        dir,
        runs: [{ label: 'throws', env: {} }],
        create: async () => {
          writeFileSync(path.join(dir, 'index.ts'), 'broken again\n')
          throw new Error('spawn failed')
        },
      }),
    ).rejects.toThrow('spawn failed')
    expect(readFileSync(path.join(dir, 'index.ts')).equals(indexBefore)).toBe(true)
  })

  it('실행 전에 index.ts가 없었으면 새로 생긴 index.ts를 지운다', async () => {
    root = mkdtempSync(path.join(os.tmpdir(), 'migrate-check-unit-'))
    const dir = path.join(root, 'src', 'migrations')
    mkdirSync(dir, { recursive: true })
    const result = await checkMigrations({
      dir,
      runs: [{ label: 'no-s3', env: {} }],
      create: async () => {
        writeFileSync(path.join(dir, 'index.ts'), 'export const migrations = []\n')
        return { status: 0, output: '' }
      },
    })
    expect(result.ok).toBe(false)
    expect(existsSync(path.join(dir, 'index.ts'))).toBe(false)
  })
})
