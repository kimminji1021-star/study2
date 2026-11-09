// Next.js 설정 — 공식 with-postgres 템플릿(v3.93.0) 기반. Media 컬렉션이 없으므로 이미지 경로 허용(images.localPatterns)은 뺐다.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  // next dev가 AI 에이전트를 감지하면 저장소 루트에 AGENTS.md를 자동 생성한다. 이 저장소의 AI 규칙은
  // MoAI의 CLAUDE.md로 관리하므로 생성하지 않게 끈다
  agentRules: false,
  // TypeScript 파일을 .js 확장자로 import해도 찾도록 한다(템플릿 설정 유지)
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  // 저장소 루트를 명시한다. 상위 디렉터리의 다른 잠금 파일을 작업 공간 루트로 오인하지 않게 한다
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
