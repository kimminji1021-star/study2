// 시작 전 점검 진입점 — package.json 스크립트가 `node scripts/preflight.mjs <명령> && <실제 명령>` 형태로 부른다.
// 사용법: node scripts/preflight.mjs <dev|build|start|test|e2e>
// 종료 코드: 0 통과, 1 점검 실패, 2 사용법 오류.
//
// 점검 로직은 src/lib/preflight.ts에 있고, Node의 타입 제거(type stripping) 기능으로 그대로 불러온다(별도 빌드 없음).
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { isPreflightCommand, runPreflight } from '../src/lib/preflight.ts'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const envFile = path.join(repoRoot, '.env')

// .env는 이미 설정된 변수를 덮어쓰지 않는다(Node 내장 process.loadEnvFile 동작).
// .env가 없으면 그대로 진행해, 누락된 변수 이름을 점검 메시지로 안내한다.
if (existsSync(envFile)) {
  process.loadEnvFile(envFile)
}

const command = process.argv[2]

if (!isPreflightCommand(command)) {
  console.error('[preflight] Usage: node scripts/preflight.mjs <dev|build|start|test|e2e>')
  process.exitCode = 2
} else {
  const result = await runPreflight(command, process.env)
  if (!result.ok) {
    console.error(result.message)
    process.exitCode = 1
  }
}
