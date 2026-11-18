// 통합 테스트 준비: 저장소 루트의 .env를 테스트 프로세스 환경 변수로 읽어 들인다.
// pnpm test의 시작 전 점검(scripts/preflight.mjs)은 별도 프로세스라 그 환경이 Vitest까지 이어지지 않는다.
// process.loadEnvFile은 이미 설정된 변수를 덮어쓰지 않는다(명령줄에서 넘긴 값이 우선).
// SPEC-DEPLOY-001 REQ-DEPLOY-002: 시작 전 점검을 거치지 않는 직접 실행(pnpm exec vitest, 편집기 테스트 실행기)도
// 원격 DB에 닿지 않게, .env를 읽은 바로 다음 루프백 판정을 한다. 이 파일은 Vitest setupFiles라 시험 파일과
// 그 파일이 불러오는 모듈(payload, 설정, 시험 도우미)보다 먼저 평가된다. DB에 연결하는 모듈은 import하지 않는다.
import { existsSync } from 'node:fs'
import path from 'node:path'

import { assertLoopbackDatabase } from '../../src/lib/preflight'

const envFile = path.resolve(import.meta.dirname, '..', '..', '.env')

if (existsSync(envFile)) {
  process.loadEnvFile(envFile)
}

assertLoopbackDatabase(process.env)
