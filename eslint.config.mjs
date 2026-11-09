// ESLint 설정 (SPEC-INFRA-001 M6). Next.js 16은 `next lint`를 없앴으므로 ESLint CLI를 직접 쓴다.
// 순서: Next 권장 규칙(core-web-vitals + typescript) → 검사 제외 목록 → Prettier와 겹치는 규칙 끄기(마지막).
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import prettier from 'eslint-config-prettier/flat'

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // spec.md §2.5 검사 제외 목록. .prettierignore와 같은 목록이며(표기만 `dir/**`),
  // 저장소 규칙 테스트(AC-INFRA-010)가 두 파일을 하나의 목록과 대조한다.
  globalIgnores(
    [
      // MoAI 소유 경로
      '.claude/**',
      '.moai/**',
      '.github/**',
      '.git_hooks/**',
      'CLAUDE.md',
      '.mcp.json',
      '.claudeignore',
      '.worktreeinclude',
      // 문서
      '**/*.md',
      // 생성 파일
      'src/payload-types.ts',
      'src/app/(payload)/admin/importMap.js',
      'next-env.d.ts',
      'pnpm-lock.yaml',
      // 산출물 디렉터리
      '.next/**',
      'out/**',
      'build/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
    'sumbi-tour/check-exclusions',
  ),
  prettier,
])
