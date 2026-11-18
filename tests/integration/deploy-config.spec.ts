// SPEC-DEPLOY-001 M3·M4 통합 테스트 — Payload 설정을 실제로 불러와(sanitize 결과) 저장소 플러그인이 켜졌을 때·꺼졌을 때의
// media 설정(AC-DEPLOY-006), 사이트 주소의 CSRF 허용 목록(AC-DEPLOY-005)을 확인하고, 시작 전 점검의 운영 분기를
// 자식 프로세스로 확인한다(AC-DEPLOY-001). 설정 로드는 DB·저장소에 연결하지 않는다(S3 클라이언트는 업로드 때에만 만든다).
// 가짜 S3 값은 모두 `test-` 접두어이며 실제로 연결되지 않는 주소(.invalid)를 쓴다.
import { spawnSync } from 'node:child_process'
import path from 'node:path'

import type { CollectionConfig, SanitizedConfig } from 'payload'
import { afterEach, describe, expect, it, vi } from 'vitest'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')

const FAKE_S3 = {
  S3_BUCKET: 'test-bucket',
  S3_ENDPOINT: 'https://test-ref.storage.example.invalid/storage/v1/s3',
  S3_REGION: 'test-region',
  S3_ACCESS_KEY_ID: 'test-access-key',
  S3_SECRET_ACCESS_KEY: 'test-secret-key',
} as const

/** 환경 변수를 덮어쓴 상태로 payload.config.ts를 새로 불러와 sanitize된 설정을 돌려준다. */
async function loadConfig(env: Record<string, string>): Promise<SanitizedConfig> {
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value)
  vi.resetModules()
  const loaded = (await import('../../src/payload.config')) as { default: Promise<SanitizedConfig> }
  return loaded.default
}

function mediaCollection(config: SanitizedConfig): CollectionConfig {
  const media = config.collections.find((collection) => collection.slug === 'media')
  expect(media, 'media 컬렉션이 있어야 한다').toBeDefined()
  return media as CollectionConfig
}

/** 최상위 필드 이름(이름 없는 배치 필드는 뺀다). */
function fieldNames(collection: CollectionConfig): string[] {
  return collection.fields.flatMap((field) => ('name' in field && typeof field.name === 'string' ? [field.name] : []))
}

function uploadSettings(collection: CollectionConfig) {
  expect(typeof collection.upload).toBe('object')
  return collection.upload as Exclude<CollectionConfig['upload'], boolean | undefined>
}

const noS3 = Object.fromEntries(Object.keys(FAKE_S3).map((name) => [name, '']))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('AC-DEPLOY-006 저장소 플러그인이 켜진 설정과 꺼진 설정', () => {
  it('가짜 S3 값 다섯 개: media는 로컬 저장을 끄고 저장소 처리기를 쓴다', async () => {
    const media = mediaCollection(await loadConfig(FAKE_S3))
    const upload = uploadSettings(media)

    expect(upload.disableLocalStorage).toBe(true)
    expect(upload.handlers?.length ?? 0).toBeGreaterThanOrEqual(1)
  })

  it('S3 값 없음: media는 저장소 루트 media 디렉터리에 로컬로 저장한다', async () => {
    const media = mediaCollection(await loadConfig(noS3))
    const upload = uploadSettings(media)

    expect(upload.staticDir).toBe(path.join(repoRoot, 'media'))
    expect(upload.disableLocalStorage).not.toBe(true)
    expect(upload.handlers ?? []).toEqual([])
  })

  it('두 설정의 media 필드 이름 목록이 같고 둘 다 prefix·_objectKey를 담는다(스키마 일관성)', async () => {
    const enabled = fieldNames(mediaCollection(await loadConfig(FAKE_S3)))
    vi.unstubAllEnvs()
    const disabled = fieldNames(mediaCollection(await loadConfig(noS3)))

    expect(enabled.length).toBeGreaterThanOrEqual(3)
    expect(enabled).toEqual(disabled)
    expect(enabled).toEqual(expect.arrayContaining(['alt', 'prefix', '_objectKey']))
  })

  it('켜진 설정에서도 파일 주소는 Payload 파일 경로를 거친다(서명된 직접 주소 처리기 없음)', async () => {
    const config = await loadConfig(FAKE_S3)
    const paths = (config.endpoints ?? []).map((endpoint) => endpoint.path)

    expect(paths.filter((endpointPath) => endpointPath.includes('storage-s3'))).toEqual([])
    expect(mediaCollection(config).access?.read).toBeTypeOf('function')
  })
})

describe('AC-DEPLOY-005 사이트 주소와 CSRF 허용 목록', () => {
  it('NEXT_PUBLIC_SERVER_URL을 준 설정의 serverURL이 그 값이고 CSRF 허용 목록에 들어 있다', async () => {
    const url = 'https://test-csrf.example.invalid'
    const config = await loadConfig({ NEXT_PUBLIC_SERVER_URL: url })

    expect(config.serverURL).toBe(url)
    expect(config.csrf).toContain(url)
  })

  it('값이 없으면 serverURL은 빈 문자열이고 허용 목록에 빈 항목이 들어가지 않는다', async () => {
    const config = await loadConfig({ NEXT_PUBLIC_SERVER_URL: '' })

    expect(config.serverURL).toBe('')
    expect(config.csrf).not.toContain('')
  })
})

describe('AC-DEPLOY-001 시작 전 점검의 운영 분기(자식 프로세스)', () => {
  const VALUE_MARKER = 'prod-marker-6d2f0a'

  // .env는 이미 설정된 변수를 덮어쓰지 않으므로(빈 문자열 포함) 여기서 준 값이 그대로 쓰인다.
  function productionEnv(): NodeJS.ProcessEnv {
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith('VITEST')),
    ) as NodeJS.ProcessEnv
    return {
      ...env,
      VERCEL_ENV: 'production',
      DATABASE_URL: `postgresql://postgres.ref:${VALUE_MARKER}@db.example.invalid:6543/postgres`,
      PAYLOAD_SECRET: `secret-${VALUE_MARKER}`,
      NEXT_PUBLIC_SERVER_URL: 'https://test-site.example.invalid',
      CRON_SECRET: '',
      DATABASE_CA_CERT: `-----BEGIN CERTIFICATE-----\n${VALUE_MARKER}\n-----END CERTIFICATE-----`,
      S3_BUCKET: `test-${VALUE_MARKER}`,
      S3_ENDPOINT: `https://${VALUE_MARKER}.example.invalid`,
      S3_REGION: `test-${VALUE_MARKER}`,
      S3_ACCESS_KEY_ID: `test-${VALUE_MARKER}`,
      S3_SECRET_ACCESS_KEY: `test-${VALUE_MARKER}`,
    }
  }

  function preflight(command: string, env: NodeJS.ProcessEnv) {
    const result = spawnSync(process.execPath, ['scripts/preflight.mjs', command], {
      cwd: repoRoot,
      env,
      encoding: 'utf8',
      timeout: 30_000,
    })
    return { status: result.status, output: `${result.stdout ?? ''}\n${result.stderr ?? ''}` }
  }

  it('VERCEL_ENV=production에서 CRON_SECRET이 비면 build 점검이 이름만 출력하고 실패한다', () => {
    const { status, output } = preflight('build', productionEnv())

    expect(status).not.toBe(0)
    expect(output).toContain('Missing or invalid production environment variables: CRON_SECRET.')
    expect(output).not.toContain(VALUE_MARKER)
  })

  it('같은 환경에서 VERCEL_ENV만 비우면 운영 점검을 하지 않는다', () => {
    const { status, output } = preflight('build', { ...productionEnv(), VERCEL_ENV: '' })

    expect(output).not.toContain('production environment variables')
    expect(status).toBe(0)
  })
})
