// 업로드 저장소 설정 판정 — SPEC-DEPLOY-001 REQ-DEPLOY-006, plan.md §B.4.
// S3 호환 저장소(Supabase Storage) 변수 다섯 개가 모두 있으면 켜고, 하나도 없으면 꺼서 개발·테스트는 로컬 media/를 쓴다.
// 일부만 있으면 설정 실수이므로 빠진 변수 이름만 담은 오류로 시작을 멈춘다(값은 넣지 않는다).
import type { EnvSource } from './preflight'

export const S3_ENV_NAMES = [
  'S3_BUCKET',
  'S3_ENDPOINT',
  'S3_REGION',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
] as const

export type S3StorageSettings = {
  bucket: string
  config: {
    endpoint: string
    region: string
    forcePathStyle: true
    credentials: { accessKeyId: string; secretAccessKey: string }
  }
}

export class StorageConfigError extends Error {
  override name = 'StorageConfigError'
}

/** 다섯 변수가 모두 있으면 저장소 설정, 모두 없으면 null, 일부만 있으면 오류. 공백뿐인 값은 없는 것으로 본다. */
export function resolveStorageConfig(env: EnvSource): S3StorageSettings | null {
  const value = (name: (typeof S3_ENV_NAMES)[number]) => (env[name] ?? '').trim()
  const missing = S3_ENV_NAMES.filter((name) => value(name) === '')

  if (missing.length === S3_ENV_NAMES.length) return null
  if (missing.length > 0) {
    throw new StorageConfigError(
      `[storage] Missing S3 storage environment variables: ${missing.join(', ')}. Set all five S3_* variables, or none to use local storage.`,
    )
  }
  return {
    bucket: value('S3_BUCKET'),
    config: {
      endpoint: value('S3_ENDPOINT'),
      region: value('S3_REGION'),
      // Supabase S3 엔드포인트는 경로 방식 주소를 쓴다
      forcePathStyle: true,
      credentials: { accessKeyId: value('S3_ACCESS_KEY_ID'), secretAccessKey: value('S3_SECRET_ACCESS_KEY') },
    },
  }
}
