import { defineConfig } from 'vitest/config'

// 단위 테스트와 통합 테스트를 프로젝트로 나눈다. 둘 다 Node 환경에서 실행한다.
// - unit: 저장소 규칙·시작 전 점검 등 DB가 필요 없는 테스트
// - integration: 로컬 PostgreSQL(DATABASE_URL)에 실제로 연결하는 Payload 테스트. 같은 DB를 쓰므로 파일을 하나씩 순서대로 실행한다
// 커버리지: `pnpm test`(vitest run)가 항상 v8 커버리지를 함께 계산한다. 대상은 src/lib/** 이고,
// 그 파일들을 합산한 라인 커버리지가 85% 미만이면 vitest가 0이 아닌 코드로 끝난다(AC-INFRA-006).
// 보고서는 coverage/ 에 생기며 git에 올리지 않는다(.gitignore).
export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      enabled: true,
      provider: 'v8',
      include: ['src/lib/**'],
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage',
      thresholds: {
        lines: 85,
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.spec.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.spec.ts'],
          setupFiles: ['./tests/integration/setup-env.ts'],
          fileParallelism: false,
          // Payload 초기화(첫 실행 시 개발 모드 스키마 반영 포함)가 기본 제한 시간 5초를 넘길 수 있다
          testTimeout: 60_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
})
