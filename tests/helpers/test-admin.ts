// E2E 테스트 관리자 계정 정보 전달 — 준비 단계(tests/e2e/global-setup.ts)가 실행마다 새 계정을 만들고
// 이 변수 이름으로 process.env에 넣는다. Playwright는 준비 단계에서 설정한 환경 변수를 테스트 작업자에게 넘긴다.
// 값(특히 비밀번호)은 출력하지 않는다. 오류 메시지에도 변수 이름만 넣는다.
export const TEST_ADMIN_EMAIL_ENV = 'E2E_TEST_ADMIN_EMAIL'
export const TEST_ADMIN_PASSWORD_ENV = 'E2E_TEST_ADMIN_PASSWORD'

export type TestAdmin = { email: string; password: string }

export function readTestAdmin(env: NodeJS.ProcessEnv = process.env): TestAdmin {
  const email = env[TEST_ADMIN_EMAIL_ENV] ?? ''
  const password = env[TEST_ADMIN_PASSWORD_ENV] ?? ''
  if (email === '' || password === '') {
    throw new Error(
      `Test admin account is not prepared: ${TEST_ADMIN_EMAIL_ENV} and ${TEST_ADMIN_PASSWORD_ENV} must be set by tests/e2e/global-setup.ts.`,
    )
  }
  return { email, password }
}
