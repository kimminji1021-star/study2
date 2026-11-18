// SPEC-DEPLOY-001 M1 — 첫 마이그레이션과 migrate:check(AC-DEPLOY-003).
// 1) 같은 컨테이너에 빈 임시 DB를 만들어 모든 마이그레이션을 적용하고, 개발 DB(push 모드) 스키마와 같은지 비교한다.
// 2) migrate:check가 바뀐 점이 없으면 0으로 끝나고, 바뀐 점이 있으면 새 파일을 지우고 index.ts를 되돌린 뒤 실패하는지 본다.
// 개발 DB에는 마이그레이션을 적용하지 않는다. 임시 DB는 실패해도 지운다. 모두 루프백 DB만 쓴다.
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '../../src/payload.config'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const migrationsDir = path.join(repoRoot, 'src', 'migrations')
const TEMP_DB = `sumbi_migration_check_${randomBytes(4).toString('hex')}`
const CLI_TIMEOUT_MS = 240_000

type QueryResult = { rows: Record<string, unknown>[] }
type PgPool = { query: (text: string) => Promise<QueryResult>; end: () => Promise<void> }
type PgModule = { Pool: new (options: { connectionString: string; max?: number }) => PgPool }

let payload: Payload
let devPool: PgPool
let tempPool: PgPool | undefined
let migrationRowsBefore = 0

function databaseUrl(database: string): string {
  const url = new URL(process.env.DATABASE_URL ?? '')
  url.pathname = `/${database}`
  return url.toString()
}

function childEnv(overrides: Record<string, string>): NodeJS.ProcessEnv {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('VITEST')))
  return { ...env, ...overrides } as NodeJS.ProcessEnv
}

function runNode(args: string[], cwd: string, env: NodeJS.ProcessEnv) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: CLI_TIMEOUT_MS,
  })
  return { status: result.status, output: `${result.stdout ?? ''}\n${result.stderr ?? ''}` }
}

// 디렉터리의 파일 이름과 내용(바이트)을 모은다. 실행 전후 비교용
function snapshotDir(dir: string): Map<string, Buffer> {
  const files = new Map<string, Buffer>()
  for (const name of readdirSync(dir).sort()) files.set(name, readFileSync(path.join(dir, name)))
  return files
}

function expectSameDir(before: Map<string, Buffer>, after: Map<string, Buffer>): void {
  expect([...after.keys()]).toEqual([...before.keys()])
  for (const [name, bytes] of before) {
    expect(after.get(name)?.equals(bytes), `${name} 내용이 같아야 한다`).toBe(true)
  }
}

async function rowsAsLines(pool: PgPool, text: string): Promise<string[]> {
  const { rows } = await pool.query(text)
  return rows.map((row) => JSON.stringify(Object.values(row))).sort()
}

// 비교 대상 스키마 목록: 테이블, 열(형식·널 허용·기본값), 인덱스 정의, 제약 정의(기본 키·고유·검사·외래 키), 열거형 값
async function schemaOf(pool: PgPool) {
  return {
    tables: await rowsAsLines(
      pool,
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
    ),
    columns: await rowsAsLines(
      pool,
      `SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default,
              character_maximum_length, numeric_precision, numeric_scale, datetime_precision
         FROM information_schema.columns WHERE table_schema = 'public'`,
    ),
    indexes: await rowsAsLines(
      pool,
      `SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'`,
    ),
    constraints: await rowsAsLines(
      pool,
      `SELECT conrelid::regclass::text, conname, contype, pg_get_constraintdef(oid)
         FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND contype IN ('p', 'u', 'c', 'f')`,
    ),
    enums: await rowsAsLines(
      pool,
      `SELECT t.typname, e.enumsortorder, e.enumlabel
         FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'`,
    ),
  }
}

async function countMigrationRows(pool: PgPool): Promise<number> {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM payload_migrations')
  return Number(rows[0]?.n ?? Number.NaN)
}

describe('AC-DEPLOY-003 첫 마이그레이션과 migrate:check', () => {
  beforeAll(async () => {
    // Payload 초기화가 개발 DB를 현재 설정(저장소 플러그인 등록 포함)으로 push한다
    payload = await getPayload({ config })
    devPool = (payload.db as unknown as { pool: PgPool }).pool
    migrationRowsBefore = await countMigrationRows(devPool)
    await devPool.query(`CREATE DATABASE "${TEMP_DB}"`)
  })

  afterAll(async () => {
    try {
      await tempPool?.end()
      if (devPool !== undefined) await devPool.query(`DROP DATABASE IF EXISTS "${TEMP_DB}" WITH (FORCE)`)
    } finally {
      await payload?.destroy()
    }
  })

  it(
    '빈 임시 DB에 모든 마이그레이션을 적용한 결과가 개발 DB 스키마와 같다',
    async () => {
      const migrated = runNode(
        ['node_modules/payload/bin.js', 'migrate'],
        repoRoot,
        childEnv({ DATABASE_URL: databaseUrl(TEMP_DB) }),
      )
      expect(migrated.status, migrated.output.slice(-2000)).toBe(0)

      const pg = (payload.db as unknown as { pg: PgModule }).pg
      tempPool = new pg.Pool({ connectionString: databaseUrl(TEMP_DB), max: 2 })
      const dev = await schemaOf(devPool)
      const temp = await schemaOf(tempPool)

      expect(dev.tables.length).toBeGreaterThanOrEqual(10)
      expect(temp.tables).toEqual(dev.tables)
      expect(temp.columns).toEqual(dev.columns)
      expect(temp.indexes).toEqual(dev.indexes)
      expect(temp.constraints).toEqual(dev.constraints)
      expect(temp.enums).toEqual(dev.enums)
    },
    CLI_TIMEOUT_MS + 30_000,
  )

  // 실제 열 이름은 M1 첫 마이그레이션에서 확인했다: prefix 필드 → "prefix", _objectKey 필드 → "_objectkey"(소문자)
  it('임시 DB의 media 테이블에 저장소 플러그인 열(prefix, _objectkey)이 있다', async () => {
    expect(tempPool, '앞 시험이 임시 DB를 마이그레이션해야 한다').toBeDefined()
    const columns = await rowsAsLines(
      tempPool as PgPool,
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'media'`,
    )
    expect(columns).toContain(JSON.stringify(['prefix']))
    expect(columns).toContain(JSON.stringify(['_objectkey']))
  })

  it('개발 DB의 payload_migrations에 새 행이 생기지 않는다', async () => {
    expect(await countMigrationRows(devPool)).toBe(migrationRowsBefore)
  })

  it(
    'migrate:check는 S3 변수 없음·가짜 S3 값 두 설정 모두 새 마이그레이션 없이 0으로 끝나고 디렉터리를 바꾸지 않는다',
    () => {
      const before = snapshotDir(migrationsDir)
      const checked = runNode(['scripts/migrate-check.mjs'], repoRoot, childEnv({}))
      expect(checked.status, checked.output.slice(-2000)).toBe(0)
      expect(checked.output).toContain('no-s3')
      expect(checked.output).toContain('fake-s3')
      expectSameDir(before, snapshotDir(migrationsDir))
    },
    CLI_TIMEOUT_MS * 2,
  )

  it(
    'migrate:check는 스키마와 다른 스냅숏이면 새 파일 이름을 알리고 실패하며, 대상 디렉터리를 실행 전과 같게 되돌린다',
    () => {
      const realBefore = snapshotDir(migrationsDir)
      const root = mkdtempSync(path.join(os.tmpdir(), 'migrate-check-drift-'))
      try {
        const copyDir = path.join(root, 'src', 'migrations')
        cpSync(migrationsDir, copyDir, { recursive: true })
        // 복사본의 마지막 스냅숏에서 media.prefix 열을 지워 "바뀐 점이 있음" 상태를 만든다
        const latest = readdirSync(copyDir)
          .filter((name) => name.endsWith('.json'))
          .sort()
          .at(-1) as string
        const snapshotPath = path.join(copyDir, latest)
        const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8')) as {
          tables: Record<string, { columns: Record<string, unknown> }>
        }
        const media = snapshot.tables['public.media']
        expect(media?.columns.prefix, '스냅숏에 media.prefix 열이 있어야 한다').toBeDefined()
        delete media?.columns.prefix
        writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`)
        const before = snapshotDir(copyDir)

        const checked = runNode([path.join(repoRoot, 'scripts', 'migrate-check.mjs')], root, childEnv({}))

        expect(checked.status).not.toBe(0)
        expect(checked.output).toMatch(/_drift_check\.ts/)
        expectSameDir(before, snapshotDir(copyDir))
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
      expectSameDir(realBefore, snapshotDir(migrationsDir))
    },
    CLI_TIMEOUT_MS * 2,
  )
})
