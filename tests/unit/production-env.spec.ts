// SPEC-DEPLOY-001 M4 단위 테스트 — 운영 빌드의 필수 설정 점검(AC-DEPLOY-001 단위 부분).
// 각 시험 값에는 표식 문자열을 넣어, 문제 목록과 출력 문구에 값이 새지 않는지 함께 본다(이름만 출력).
import { describe, expect, it } from 'vitest'

import {
  findInvalidProductionEnv,
  formatInvalidProductionEnvMessage,
  PRODUCTION_ENV_NAMES,
  runPreflight,
  type EnvSource,
} from '../../src/lib/preflight'

const VALUE_MARKER = 'val-marker-3b8e1d'

// 형식이 모두 맞는 가짜 운영 환경. 어떤 값도 실제 비밀값이 아니다
function validProductionEnv(): Record<string, string> {
  return {
    VERCEL_ENV: 'production',
    DATABASE_URL: `postgresql://postgres.ref:${VALUE_MARKER}@db.example.invalid:6543/postgres`,
    PAYLOAD_SECRET: `secret-${VALUE_MARKER}`,
    NEXT_PUBLIC_SERVER_URL: 'https://test-site.example.invalid',
    CRON_SECRET: `Cron${VALUE_MARKER.replaceAll('-', '')}0123456789`,
    DATABASE_CA_CERT: `-----BEGIN CERTIFICATE-----\n${VALUE_MARKER}\n-----END CERTIFICATE-----`,
    S3_BUCKET: `test-bucket-${VALUE_MARKER}`,
    S3_ENDPOINT: `https://${VALUE_MARKER}.storage.example.invalid/storage/v1/s3`,
    S3_REGION: `test-region-${VALUE_MARKER}`,
    S3_ACCESS_KEY_ID: `test-key-${VALUE_MARKER}`,
    S3_SECRET_ACCESS_KEY: `test-secret-${VALUE_MARKER}`,
  }
}

function without(env: Record<string, string>, name: string): EnvSource {
  const copy: Record<string, string | undefined> = { ...env }
  delete copy[name]
  return copy
}

const noProbes = {
  probeTcp: async () => {
    throw new Error('build·start 점검은 DB에 연결하지 않아야 한다')
  },
  probePortFree: async () => {
    throw new Error('build·start 점검은 포트를 확인하지 않아야 한다')
  },
}

describe('AC-DEPLOY-001 운영 변수 점검 함수', () => {
  it('점검 대상 이름은 사이트 주소·Cron 비밀값·DB 인증서·S3 다섯 개다', () => {
    expect([...PRODUCTION_ENV_NAMES]).toEqual([
      'NEXT_PUBLIC_SERVER_URL',
      'CRON_SECRET',
      'DATABASE_CA_CERT',
      'S3_BUCKET',
      'S3_ENDPOINT',
      'S3_REGION',
      'S3_ACCESS_KEY_ID',
      'S3_SECRET_ACCESS_KEY',
    ])
  })

  it('모든 변수가 올바르면 문제 목록이 비어 있다', () => {
    expect(findInvalidProductionEnv(validProductionEnv())).toEqual([])
  })

  it.each([...PRODUCTION_ENV_NAMES])('%s 하나만 빠지면 그 이름 하나만 목록에 있다', (name) => {
    expect(findInvalidProductionEnv(without(validProductionEnv(), name))).toEqual([name])
    expect(findInvalidProductionEnv({ ...validProductionEnv(), [name]: '   ' })).toEqual([name])
  })

  it.each([
    ['http 주소', 'http://test-site.example.invalid'],
    ['끝 빗금', 'https://test-site.example.invalid/'],
    ['경로', 'https://test-site.example.invalid/app'],
    ['질의', 'https://test-site.example.invalid?x=1'],
    ['조각', 'https://test-site.example.invalid#top'],
    ['사용자 정보', `https://user:${VALUE_MARKER}@test-site.example.invalid`],
    ['주소 아님', `not-a-url-${VALUE_MARKER}`],
  ])('NEXT_PUBLIC_SERVER_URL 형식 오류(%s)', (_label, value) => {
    expect(findInvalidProductionEnv({ ...validProductionEnv(), NEXT_PUBLIC_SERVER_URL: value })).toEqual([
      'NEXT_PUBLIC_SERVER_URL',
    ])
  })

  it.each([
    ['15자', 'Abcdefghij12345'],
    ['특수문자', `Abcdefghij12345!${VALUE_MARKER}`],
    ['공백 포함', 'Abcdefghij 123456'],
    ['앞뒤 공백', ' Abcdefghij1234567 '],
  ])('CRON_SECRET 형식 오류(%s)', (_label, value) => {
    expect(findInvalidProductionEnv({ ...validProductionEnv(), CRON_SECRET: value })).toEqual(['CRON_SECRET'])
  })

  it('CRON_SECRET은 영문·숫자 16자부터 허용한다', () => {
    expect(findInvalidProductionEnv({ ...validProductionEnv(), CRON_SECRET: 'Abcdefghij123456' })).toEqual([])
  })

  it('DATABASE_CA_CERT에 BEGIN CERTIFICATE가 없으면 형식 오류', () => {
    expect(findInvalidProductionEnv({ ...validProductionEnv(), DATABASE_CA_CERT: `pem-${VALUE_MARKER}` })).toEqual([
      'DATABASE_CA_CERT',
    ])
  })

  it.each(['sslmode=require', 'sslrootcert=/tmp/ca.pem', 'SSLMODE=verify-full', 'ssl=true', 'sslcert=a', 'sslkey=b'])(
    'DATABASE_URL에 %s 인자가 있으면 DATABASE_URL이 목록에 있다',
    (param) => {
      const env = validProductionEnv()
      expect(findInvalidProductionEnv({ ...env, DATABASE_URL: `${env.DATABASE_URL}?${param}` })).toEqual([
        'DATABASE_URL',
      ])
      expect(
        findInvalidProductionEnv({ ...env, DATABASE_URL: `${env.DATABASE_URL}?application_name=x&${param}` }),
      ).toEqual(['DATABASE_URL'])
    },
  )

  it('SSL과 무관한 연결 인자는 허용한다', () => {
    const env = validProductionEnv()
    expect(findInvalidProductionEnv({ ...env, DATABASE_URL: `${env.DATABASE_URL}?application_name=sumbi` })).toEqual([])
  })

  it('여러 문제는 선언 순서대로 모두 나온다', () => {
    const env: Record<string, string | undefined> = {
      ...validProductionEnv(),
      NEXT_PUBLIC_SERVER_URL: 'http://x',
      S3_REGION: '',
    }
    env.DATABASE_URL = `${env.DATABASE_URL}?sslmode=require`
    expect(findInvalidProductionEnv(env)).toEqual(['NEXT_PUBLIC_SERVER_URL', 'S3_REGION', 'DATABASE_URL'])
  })

  it('출력 문구에는 이름만 있고 어떤 값의 표식도 없다', () => {
    const message = formatInvalidProductionEnvMessage(['CRON_SECRET', 'DATABASE_URL'])
    expect(message).toContain(
      '[preflight] Missing or invalid production environment variables: CRON_SECRET, DATABASE_URL.',
    )
    expect(message).not.toContain(VALUE_MARKER)
  })
})

describe('AC-DEPLOY-001 시작 전 점검의 운영 분기', () => {
  it.each(['build', 'start'] as const)(
    'VERCEL_ENV=production인 %s는 운영 변수가 빠지면 이름만 담아 실패한다',
    async (command) => {
      const result = await runPreflight(command, without(validProductionEnv(), 'CRON_SECRET'), noProbes)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.message).toContain('Missing or invalid production environment variables: CRON_SECRET.')
        expect(result.message).not.toContain(VALUE_MARKER)
      }
    },
  )

  it.each(['build', 'start'] as const)('VERCEL_ENV=production인 %s는 모든 값이 맞으면 통과한다', async (command) => {
    expect(await runPreflight(command, validProductionEnv(), noProbes)).toEqual({ ok: true })
  })

  it.each([undefined, 'preview', 'development', 'Production'])(
    'VERCEL_ENV=%s이면 운영 점검을 하지 않는다(로컬 build 규칙 그대로)',
    async (vercelEnv) => {
      const env: Record<string, string | undefined> = { ...without(validProductionEnv(), 'CRON_SECRET') }
      env.VERCEL_ENV = vercelEnv
      expect(await runPreflight('build', env, noProbes)).toEqual({ ok: true })
    },
  )

  it('필수 변수(DATABASE_URL·PAYLOAD_SECRET)가 비면 기존 문구가 먼저 나온다', async () => {
    const result = await runPreflight('build', without(validProductionEnv(), 'PAYLOAD_SECRET'), noProbes)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('Missing required environment variables: PAYLOAD_SECRET.')
  })
})
