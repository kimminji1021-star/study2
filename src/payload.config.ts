// Payload 설정 — 공식 with-postgres 템플릿(v3.93.0) 기반. sharp, 다국어(localization), 이메일 어댑터는
// 넣지 않는다(SPEC-INFRA-001 plan.md §B.4, SPEC-TOUR-001 plan.md §B.1). 카탈로그 컬렉션은 SPEC-TOUR-001,
// 신청 컬렉션은 SPEC-APPLY-001에서 더했다.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import { buildConfig, defaultLoggerOptions } from 'payload'

import { AdminAuditLogs } from './collections/AdminAuditLogs'
import { ApplicationAttempts } from './collections/ApplicationAttempts'
import { Applications } from './collections/Applications'
import { Media } from './collections/Media'
import { Tours } from './collections/Tours'
import { TourSessions } from './collections/TourSessions'
import { Users } from './collections/Users'
import { HomeSettings } from './globals/HomeSettings'
import { buildPoolConfig, isLoopbackDatabaseUrl } from './lib/db-connection'
import { redactingLoggerOptions } from './lib/log-redaction'
import { assertRequiredEnv } from './lib/preflight'
import { resolveStorageConfig } from './lib/storage'
import { MAX_UPLOAD_BYTES } from './lib/validation'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// REQ-INFRA-008 두 번째 확인 지점: 시작 전 점검(scripts/preflight.mjs)을 거치지 않고 설정을 직접 불러오는
// 경로(payload CLI, 통합 테스트 등)에서도 필수 변수가 비어 있으면 DB에 연결하기 전에 이름만 담은 오류로 멈춘다.
assertRequiredEnv(process.env)

// 업로드 저장소(SPEC-DEPLOY-001 REQ-DEPLOY-006): S3 변수 다섯 개가 모두 있을 때만 켜지고, 없으면 로컬 media/를 쓴다.
// 일부만 있으면 여기서 빠진 이름만 담은 오류로 멈춘다.
const storage = resolveStorageConfig(process.env)

export default buildConfig({
  admin: {
    user: Users.slug,
    // 관리자 첫 화면의 회차 현황 표(SPEC-ADMIN-001 REQ-ADMIN-011). 기본 대시보드의 컬렉션 카드 위에 그려진다
    components: {
      beforeDashboard: ['/components/admin/SessionDashboard#SessionDashboard'],
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  // 신청 컬렉션 두 개는 SPEC-APPLY-001에서(REQ-APPLY-002), 작업 기록은 SPEC-ADMIN-001에서 더했다(REQ-ADMIN-001)
  collections: [Users, Media, Tours, TourSessions, Applications, ApplicationAttempts, AdminAuditLogs],
  // 홈 화면의 대표 사진·큰 제목·한 줄 소개(SPEC-LANDING-001 REQ-LANDING-001)
  globals: [HomeSettings],
  editor: lexicalEditor(),
  // REST 멀티파트 요청을 일찍 끊는 보조 수단(SPEC-TOUR-001 plan.md §B.6). 로컬 API에는 적용되지 않으므로
  // 5MB 판정의 근거는 media 컬렉션의 beforeOperation 훅이다. 정확히 5MB인 REST 업로드가 막히지 않게 같은 값으로 둔다.
  upload: {
    limits: {
      fileSize: MAX_UPLOAD_BYTES,
    },
  },
  // SPEC-DEPLOY-001 REQ-DEPLOY-011: DB 오류 로그의 질의 바인딩 값(신청자 정보)을 가린다. 출력은 Payload 기본값과 같은
  // pino-pretty 스트림(defaultLoggerOptions)이다. 모든 환경(개발·테스트·운영)에 적용된다
  logger: { options: redactingLoggerOptions(), destination: defaultLoggerOptions },
  secret: process.env.PAYLOAD_SECRET ?? '',
  // 사이트 주소. Payload는 빈 문자열이 아닌 serverURL을 CSRF 허용 목록에 자동으로 넣는다
  // (E2E 서버가 다른 포트를 쓸 때 이 값을 덮어쓴다 — plan.md R14, M5에서 확인).
  // 값이 없을 때는 undefined가 아니라 빈 문자열이어야 허용 목록에 잘못된 항목이 들어가지 않는다.
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL ?? '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  // SPEC-DEPLOY-001 REQ-DEPLOY-004: 원격 DB는 인증서 검증 SSL·풀 크기 5(기본), 루프백은 지금 설정 그대로.
  // push(개발용 스키마 자동 반영)는 루프백 DB에서만 켠다 — 운영 DB 스키마는 마이그레이션으로만 만든다(REQ-DEPLOY-002·003)
  db: postgresAdapter({
    pool: buildPoolConfig(process.env),
    push: isLoopbackDatabaseUrl(process.env.DATABASE_URL),
  }),
  // 저장소 플러그인은 꺼진 환경에서도 언제나 등록한다. alwaysInsertFields: true면 꺼져 있어도 media에 같은 필드
  // (prefix, _objectKey)를 넣어, S3 변수 없이 만든 마이그레이션과 운영(켜짐) 스키마가 같아진다(plan.md §B.4 D1)
  plugins: [
    s3Storage({
      enabled: storage !== null,
      alwaysInsertFields: true,
      collections: { media: true },
      bucket: storage?.bucket ?? '',
      config: storage?.config ?? {},
    }),
  ],
})
