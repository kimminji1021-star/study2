// E2E 준비·정리 단계 — 테스트 관리자 계정을 테스트 전에 만들고 끝나면 지운다(AC-INFRA-008, plan.md M5·R10).
// - Payload 로컬 API로 DATABASE_URL의 DB에 직접 만든다. 사용자가 한 명도 없으면 /admin/login이
//   /admin/create-first-user로 이동하므로, 브라우저가 관리자 화면을 열기 전에 계정이 있어야 한다.
// - 이메일은 실행마다 고유하게, 비밀번호는 실행 중에 무작위로 만든다. 값은 출력하지 않는다.
// - Playwright는 준비 함수가 돌려준 함수를 정리 단계로 실행한다. 테스트가 실패해도 실행된다.
import { randomBytes, randomUUID } from 'node:crypto'

import { getPayload } from 'payload'

// .env를 읽어 들이는 부수 효과가 있다(DATABASE_URL·PAYLOAD_SECRET). 설정 파일보다 먼저 불러온다.
import '../helpers/e2e-env'
import config from '../../src/payload.config'
import { TEST_ADMIN_EMAIL_ENV, TEST_ADMIN_PASSWORD_ENV } from '../helpers/test-admin'

export default async function globalSetup(): Promise<() => Promise<void>> {
  const email = `e2e-admin-${randomUUID()}@example.test`
  const password = randomBytes(24).toString('base64url')

  const payload = await getPayload({ config })
  try {
    await payload.create({ collection: 'users', data: { email, password } })
  } catch (error) {
    await payload.destroy()
    throw error
  }

  process.env[TEST_ADMIN_EMAIL_ENV] = email
  process.env[TEST_ADMIN_PASSWORD_ENV] = password

  return async () => {
    try {
      await payload.delete({ collection: 'users', where: { email: { equals: email } } })
    } finally {
      await payload.destroy()
    }
  }
}
