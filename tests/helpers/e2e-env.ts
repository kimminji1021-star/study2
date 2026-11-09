// E2E 공통 환경 — playwright.config.ts와 E2E 테스트가 같은 포트 값을 쓰도록 한 곳에서 정한다.
// 시작 전 점검(scripts/preflight.mjs e2e)과 똑같이 .env를 읽고 같은 해석 함수(resolveE2ePort)를 써서,
// 점검한 포트와 Playwright가 서버를 띄우는 포트가 어긋나지 않게 한다.
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { resolveE2ePort } from '../../src/lib/preflight'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const envFile = path.join(repoRoot, '.env')

// 이미 설정된 변수는 덮어쓰지 않는다(Node 내장 process.loadEnvFile 동작).
if (existsSync(envFile)) {
  process.loadEnvFile(envFile)
}

const port = resolveE2ePort(process.env)
if (port === null) {
  throw new Error('E2E_PORT must be an integer between 1 and 65535.')
}

/** E2E 전용 포트(기본 3100). 개발 서버 기본 포트 3000과 겹치지 않게 한다. */
export const E2E_PORT: number = port

/** E2E 서버 주소. Payload serverURL(NEXT_PUBLIC_SERVER_URL)도 이 값으로 덮어쓴다(plan.md R14). */
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`
