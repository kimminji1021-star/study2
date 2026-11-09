// Playwright E2E 설정 — 전용 포트에 개발 서버를 새로 띄워 테스트한다(SPEC-INFRA-001 plan.md M4·M5, R8·R13·R14).
// 테스트 관리자 계정 준비·정리 단계는 M5에서 추가한다.
import { defineConfig, devices } from '@playwright/test'

import { E2E_BASE_URL, E2E_PORT } from './tests/helpers/e2e-env'

export default defineConfig({
  testDir: './tests/e2e',
  // CI에서 test.only가 남아 있으면 실패시킨다
  forbidOnly: !!process.env.CI,
  retries: 0,
  // 테스트가 같은 개발 서버와 DB를 쓰므로 하나씩 실행한다
  workers: 1,
  reporter: 'list',
  // 개발 서버는 페이지를 처음 요청할 때 컴파일하므로 첫 방문이 느리다(R13)
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: E2E_BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // 포트를 명시해 Next가 다른 포트로 옮겨 뜨지 않게 한다(R15)
    command: `pnpm exec next dev --port ${E2E_PORT}`,
    // 준비 확인은 URL 응답이 아니라 포트 열림으로 한다. URL 확인은 404를 준비 안 됨으로 보므로,
    // 특정 페이지의 존재 여부가 서버 기동 판정에 섞이지 않게 한다. 첫 컴파일은 각 테스트 제한 시간 안에서 기다린다
    port: E2E_PORT,
    // 이미 떠 있는 다른 서버를 재사용하지 않는다. 포트가 점유되어 있으면 실패한다(R8)
    reuseExistingServer: false,
    // 첫 컴파일 시간을 고려해 기본값 60초보다 넉넉히 둔다(R13)
    timeout: 180_000,
    // Payload serverURL을 E2E 서버 주소로 맞춘다(R14). 나머지 변수는 현재 환경과 Next의 .env 로드를 그대로 쓴다
    env: {
      NEXT_PUBLIC_SERVER_URL: E2E_BASE_URL,
    },
  },
})
