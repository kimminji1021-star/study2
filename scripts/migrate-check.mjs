// 마이그레이션 누락 검사(pnpm migrate:check) — SPEC-DEPLOY-001 REQ-DEPLOY-003, plan.md §B.3.
// 현재 컬렉션 설정이 마지막 마이그레이션 스냅숏과 같은지 `payload migrate:create --skip-empty`로 확인한다.
// S3 변수 없는 설정과 가짜 S3 값(연결하지 않음)을 준 설정, 두 번 실행한다(저장소 플러그인 켜짐·꺼짐 스키마가 같은지).
//
// 판정은 종료 코드가 아니라 실행 전후 파일 목록으로 한다: --skip-empty는 바뀐 점이 없을 때만 파일 없이 끝나고,
// 바뀐 점이 있으면 새 마이그레이션을 쓰고 index.ts를 디렉터리 전체 기준으로 다시 쓴 뒤 역시 0으로 끝난다.
// 그래서 새 파일이 생기면 그 파일을 지우고 index.ts를 실행 전 바이트로 되돌린 뒤 이름을 알리고 실패한다.
// 마이그레이션 디렉터리는 Payload 기본값과 같이 현재 작업 디렉터리의 src/migrations다. DB에는 연결하지 않는다.
// 종료 코드: 0 바뀐 점 없음, 1 새 마이그레이션이 필요하거나 생성 명령 실패.
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const S3_ENV_NAMES = ['S3_BUCKET', 'S3_ENDPOINT', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']
// 가짜 S3 값: test- 접두어, 연결되지 않는 주소. migrate:create는 업로드를 하지 않으므로 S3에 연결하지 않는다
const FAKE_S3_ENV = {
  S3_BUCKET: 'test-migrate-check',
  S3_ENDPOINT: 'https://test-migrate-check.example.invalid/storage/v1/s3',
  S3_REGION: 'test-region',
  S3_ACCESS_KEY_ID: 'test-access-key',
  S3_SECRET_ACCESS_KEY: 'test-secret-key',
}
const CREATE_TIMEOUT_MS = 180_000
const INDEX_FILE = 'index.ts'

/**
 * 생성 명령을 차례로 실행하고 새로 생긴 파일을 찾는다. 새 파일은 지우고, index.ts는 어떤 경우에도(예외 포함) 실행 전 상태로 되돌린다.
 * @param {{
 *   dir: string,
 *   runs: { label: string, env: Record<string, string | undefined> }[],
 *   create: (env: Record<string, string | undefined>, label: string) => Promise<{ status: number | null, output: string }>,
 * }} options
 * @returns {Promise<{ ok: boolean, newFiles: string[], failedRuns: string[] }>}
 */
export async function checkMigrations({ dir, runs, create }) {
  const indexPath = path.join(dir, INDEX_FILE)
  const before = new Set(existsSync(dir) ? readdirSync(dir) : [])
  const indexBefore = existsSync(indexPath) ? readFileSync(indexPath) : null
  const failedRuns = []
  let newFiles = []

  try {
    for (const run of runs) {
      const result = await create(run.env, run.label)
      if (result.status !== 0) failedRuns.push(run.label)
    }
  } finally {
    newFiles = (existsSync(dir) ? readdirSync(dir) : []).filter((name) => !before.has(name) && name !== INDEX_FILE)
    for (const name of newFiles) rmSync(path.join(dir, name), { force: true })
    if (indexBefore === null) {
      rmSync(indexPath, { force: true })
    } else if (!existsSync(indexPath) || !readFileSync(indexPath).equals(indexBefore)) {
      writeFileSync(indexPath, indexBefore)
    }
  }

  newFiles.sort()
  return { ok: newFiles.length === 0 && failedRuns.length === 0 && indexBefore !== null, newFiles, failedRuns }
}

function envWithoutS3(base) {
  const env = { ...base }
  for (const name of S3_ENV_NAMES) delete env[name]
  return env
}

async function main() {
  // .env는 이미 설정된 변수를 덮어쓰지 않는다. Payload CLI가 어느 작업 디렉터리에서든 같은 설정을 찾도록 경로를 넘긴다
  const envFile = path.join(repoRoot, '.env')
  if (existsSync(envFile)) process.loadEnvFile(envFile)
  const base = {
    ...process.env,
    PAYLOAD_CONFIG_PATH: process.env.PAYLOAD_CONFIG_PATH ?? path.join(repoRoot, 'src', 'payload.config.ts'),
  }
  const dir = path.resolve(process.cwd(), 'src', 'migrations')
  const payloadBin = path.join(repoRoot, 'node_modules', 'payload', 'bin.js')

  const runs = [
    { label: 'no-s3', env: envWithoutS3(base) },
    { label: 'fake-s3', env: { ...envWithoutS3(base), ...FAKE_S3_ENV } },
  ]
  const result = await checkMigrations({
    dir,
    runs,
    create: async (env, label) => {
      console.log(`[migrate:check] ${label}: payload migrate:create drift-check --skip-empty`)
      const child = spawnSync(process.execPath, [payloadBin, 'migrate:create', 'drift-check', '--skip-empty'], {
        cwd: process.cwd(),
        env,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: CREATE_TIMEOUT_MS,
      })
      const output = `${child.stdout ?? ''}${child.stderr ?? ''}`
      if (child.status !== 0) {
        console.error(`[migrate:check] ${label}: migrate:create exited with ${child.status ?? child.signal}.`)
        console.error(output.slice(-4000))
      }
      return { status: child.status, output }
    },
  })

  if (result.newFiles.length > 0) {
    console.error(
      `[migrate:check] Schema changes are not covered by a migration. Generated and removed: ${result.newFiles.join(', ')}.`,
    )
    console.error('Create a migration for the change (pnpm exec payload migrate:create <name>) and commit it.')
  }
  if (result.failedRuns.length > 0) {
    console.error(`[migrate:check] migrate:create failed for: ${result.failedRuns.join(', ')}.`)
  }
  if (!existsSync(path.join(dir, INDEX_FILE))) {
    console.error(`[migrate:check] ${path.join('src', 'migrations', INDEX_FILE)} was not found.`)
  }
  if (result.ok) {
    console.log('[migrate:check] OK: no new migration for no-s3 and fake-s3.')
  }
  return result.ok ? 0 : 1
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = await main()
}
