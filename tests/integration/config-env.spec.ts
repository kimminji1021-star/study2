// REQ-INFRA-008 두 번째 확인 지점 — Payload 설정을 직접 불러오는 경로(시작 전 점검을 거치지 않는 경로)에서도
// 필수 환경 변수가 비어 있으면 설정 로드 단계에서 변수 이름을 담은 오류로 멈춘다.
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('Payload 설정 로드 시 필수 환경 변수 재검증', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('PAYLOAD_SECRET이 비어 있으면 이름과 .env.example 안내를 담은 오류를 던진다', async () => {
    vi.stubEnv('PAYLOAD_SECRET', '')
    vi.resetModules()

    await expect(import('../../src/payload.config')).rejects.toThrow(
      /Missing required environment variables: PAYLOAD_SECRET\.[\s\S]*\.env\.example/,
    )
  })

  it('DATABASE_URL과 PAYLOAD_SECRET이 모두 비어 있으면 두 이름을 모두 담는다', async () => {
    vi.stubEnv('DATABASE_URL', '')
    vi.stubEnv('PAYLOAD_SECRET', '   ')
    vi.resetModules()

    await expect(import('../../src/payload.config')).rejects.toThrow(
      'Missing required environment variables: DATABASE_URL, PAYLOAD_SECRET.',
    )
  })
})
