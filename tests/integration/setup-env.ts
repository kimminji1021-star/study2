// 통합 테스트 준비: 저장소 루트의 .env를 테스트 프로세스 환경 변수로 읽어 들인다.
// pnpm test의 시작 전 점검(scripts/preflight.mjs)은 별도 프로세스라 그 환경이 Vitest까지 이어지지 않는다.
// process.loadEnvFile은 이미 설정된 변수를 덮어쓰지 않는다(명령줄에서 넘긴 값이 우선).
import { existsSync } from 'node:fs'
import path from 'node:path'

const envFile = path.resolve(import.meta.dirname, '..', '..', '.env')

if (existsSync(envFile)) {
  process.loadEnvFile(envFile)
}
