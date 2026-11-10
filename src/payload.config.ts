// Payload 설정 — 공식 with-postgres 템플릿(v3.93.0) 기반. sharp, 다국어(localization), 이메일 어댑터는
// 넣지 않는다(SPEC-INFRA-001 plan.md §B.4, SPEC-TOUR-001 plan.md §B.1). 카탈로그 컬렉션은 SPEC-TOUR-001에서 더했다.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig } from 'payload'

import { Media } from './collections/Media'
import { Tours } from './collections/Tours'
import { TourSessions } from './collections/TourSessions'
import { Users } from './collections/Users'
import { assertRequiredEnv } from './lib/preflight'
import { MAX_UPLOAD_BYTES } from './lib/validation'

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
  collections: [Users, Media, Tours, TourSessions],
  editor: lexicalEditor(),
  // REST 멀티파트 요청을 일찍 끊는 보조 수단(SPEC-TOUR-001 plan.md §B.6). 로컬 API에는 적용되지 않으므로
  // 5MB 판정의 근거는 media 컬렉션의 beforeOperation 훅이다. 정확히 5MB인 REST 업로드가 막히지 않게 같은 값으로 둔다.
  upload: {
    limits: {
      fileSize: MAX_UPLOAD_BYTES,
    },
  },
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
