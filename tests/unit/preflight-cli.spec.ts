// scripts/preflight.mjs 진입점 테스트 — 실제 Node 프로세스로 실행해 종료 코드와 출력을 확인한다.
// DB가 필요 없는 경로(환경 변수 누락, build)만 다룬다. DB 미실행 경로는 AC-INFRA-014 수동 시나리오로 확인한다.
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const script = path.join(repoRoot, 'scripts', 'preflight.mjs')

// 이미 설정된 변수는 .env가 덮어쓰지 않으므로, 여기서 넣은 값이 그대로 쓰인다.
function runScript(args: string[], env: Record<string, string>) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: 20_000,
  })
}

describe('scripts/preflight.mjs', () => {
  it('필수 환경 변수가 비어 있으면 이름과 .env.example을 출력하고 1로 끝난다', () => {
    const result = runScript(['test'], { DATABASE_URL: '', PAYLOAD_SECRET: '' })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('DATABASE_URL')
    expect(result.stderr).toContain('PAYLOAD_SECRET')
    expect(result.stderr).toContain('.env.example')
  })

  it('build는 환경 변수만 확인하므로 DB 없이 0으로 끝난다', () => {
    const result = runScript(['build'], {
      DATABASE_URL: 'postgresql://u:p@127.0.0.1:1/none',
      PAYLOAD_SECRET: 'cli-test-only',
    })

    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
  })

  it('알 수 없는 명령이면 사용법을 출력하고 2로 끝난다', () => {
    const result = runScript(['lint'], {})

    expect(result.status).toBe(2)
    expect(result.stderr).toContain('Usage')
  })
})
