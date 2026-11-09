import { defineConfig } from 'vitest/config'

// M1 최소 설정: 저장소 규칙 단위 테스트만 실행한다.
// 단위·통합 분리와 커버리지 임계값은 M5에서 정리한다.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.spec.ts'],
  },
})
