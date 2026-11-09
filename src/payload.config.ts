// Payload 설정 — 공식 with-postgres 템플릿(v3.93.0) 기반. 이 SPEC 범위에 맞춰 Media 컬렉션, sharp,
// 다국어(localization), 이메일 어댑터는 넣지 않는다(SPEC-INFRA-001 plan.md §B.4).
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig } from 'payload'

import { Users } from './collections/Users'
import { assertRequiredEnv } from './lib/preflight'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// REQ-INFRA-008 두 번째 확인 지점: 시작 전 점검(scripts/preflight.mjs)을 거치지 않고 설정을 직접 불러오는
// 경로(payload CLI, 통합 테스트 등)에서도 필수 변수가 비어 있으면 DB에 연결하기 전에 이름만 담은 오류로 멈춘다.
assertRequiredEnv(process.env)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET ?? '',
  // 사이트 주소. Payload는 빈 문자열이 아닌 serverURL을 CSRF 허용 목록에 자동으로 넣는다
  // (E2E 서버가 다른 포트를 쓸 때 이 값을 덮어쓴다 — plan.md R14, M5에서 확인).
  // 값이 없을 때는 undefined가 아니라 빈 문자열이어야 허용 목록에 잘못된 항목이 들어가지 않는다.
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL ?? '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL,
    },
  }),
})
