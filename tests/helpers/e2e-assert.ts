// E2E 공통 단언 — 각 페이지 방문 뒤 E2E 전용 포트에서 응답했는지 확인한다(AC-INFRA-008).
// 개발 서버 기본 포트 3000을 잘못 테스트하는 경우를 막는다.
import { expect, type Page } from '@playwright/test'

import { E2E_PORT } from './e2e-env'

export function expectE2ePort(page: Page): void {
  const { port } = new URL(page.url())
  expect(port).toBe(String(E2E_PORT))
  expect(port).not.toBe('3000')
}
