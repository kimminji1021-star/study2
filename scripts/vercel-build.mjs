// Vercel 빌드 명령 — SPEC-DEPLOY-001 REQ-DEPLOY-003, plan.md §B.3.
// 운영 배포(VERCEL_ENV=production)에서만 시작 전 점검 → 마이그레이션 적용 → 빌드를 차례로 실행한다.
// 운영이 아니면 아무 명령도 실행하지 않고 실패한다(Preview 배포는 쓰지 않으므로, 실행되면 설정 실수다).
// 로컬 `pnpm build`는 이 스크립트를 쓰지 않는다. 종료 코드: 0 성공, 그 밖은 실패한 단계의 코드 또는 1.
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * 실행할 단계 목록을 만든다.
 * @param {Readonly<Record<string, string | undefined>>} env
 * @returns {{ ok: true, steps: { name: string, command: string, args: string[] }[] } | { ok: false, message: string }}
 */
export function planVercelBuild(env) {
  if (env.VERCEL_ENV !== 'production') {
    return {
      ok: false,
      message: `[vercel-build] Refusing to run: VERCEL_ENV is "${env.VERCEL_ENV ?? ''}", expected "production". No migration was run.`,
    }
  }
  return {
    ok: true,
    steps: [
      { name: 'preflight', command: 'node', args: ['scripts/preflight.mjs', 'build'] },
      { name: 'migrate', command: 'pnpm', args: ['exec', 'payload', 'migrate'] },
      { name: 'build', command: 'pnpm', args: ['build'] },
    ],
  }
}

function main() {
  const plan = planVercelBuild(process.env)
  if (!plan.ok) {
    console.error(plan.message)
    return 1
  }
  for (const step of plan.steps) {
    console.log(`[vercel-build] ${step.name}: ${[step.command, ...step.args].join(' ')}`)
    // Windows에서 pnpm은 .cmd라 셸이 필요하다(Vercel은 Linux). 인자는 고정 문자열뿐이다
    const result = spawnSync(step.command, step.args, {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
    if (result.status !== 0) {
      console.error(`[vercel-build] Step "${step.name}" failed.`)
      return result.status ?? 1
    }
  }
  return 0
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main()
}
