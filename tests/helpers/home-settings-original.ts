// SPEC-LANDING-001 전역 설정 원래 값 보존 도우미 — plan.md §B.11, acceptance.md 머리말 "전역 설정 원래 값".
// home-settings는 개발 DB에 하나뿐이고 운영자가 실제 값을 넣었을 수 있으므로, 설정을 바꾸는 통합·E2E 시험은
// 바꾸기 전에 원래 값을 gitignore 대상 파일에 남기고, 끝나면 그 값으로 되돌린 뒤 다시 읽어 같음을 확인한다.
// 파일은 복원 확인이 끝난 뒤에만 지운다. 강제 종료로 복원이 빠지면 다음 실행이 파일 값으로 먼저 되돌린다.
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { Payload } from 'payload'

import { HOME_SETTINGS_SLUG } from '../../src/globals/HomeSettings'
import { repoRoot } from './catalog-fixtures'

export { HOME_SETTINGS_SLUG }

export const HOME_SETTINGS_ORIGINAL_FILE = path.join(
  repoRoot,
  '.moai',
  'state',
  'verify',
  'landing',
  'home-settings-original.json',
)

/** 비교 기준으로 맞춘 세 필드. 저장한 적 없는 필드(undefined)와 비운 필드(null)를 같은 값으로 본다. */
export type HomeSettingsSnapshot = { heroImage: number | null; headline: string | null; intro: string | null }

function idOf(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (value !== null && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'number') {
    return (value as { id: number }).id
  }
  return null
}

/** depth 0으로 읽은 현재 값을 `값 ?? null`로 맞춘다(heroImage는 미디어 ID). */
export async function readHomeSettings(payload: Payload): Promise<HomeSettingsSnapshot> {
  const doc = (await payload.findGlobal({ slug: HOME_SETTINGS_SLUG, depth: 0, overrideAccess: true })) as {
    heroImage?: unknown
    headline?: string | null
    intro?: string | null
  }
  return { heroImage: idOf(doc.heroImage), headline: doc.headline ?? null, intro: doc.intro ?? null }
}

async function writeHomeSettings(payload: Payload, values: HomeSettingsSnapshot): Promise<void> {
  await payload.updateGlobal({ slug: HOME_SETTINGS_SLUG, data: values as never, depth: 0, overrideAccess: true })
}

/**
 * 시작: 원래 값을 파일에 남긴다. 파일이 이미 있으면 이전 실행이 복원 전에 끊긴 것이므로
 * 지금 DB 값이 아니라 파일 값을 원래 값으로 삼아 먼저 되돌린다. 이 함수가 끝나기 전에는 설정을 바꾸지 않는다.
 */
export async function saveHomeSettingsOriginal(payload: Payload): Promise<HomeSettingsSnapshot> {
  if (existsSync(HOME_SETTINGS_ORIGINAL_FILE)) {
    const original = JSON.parse(await readFile(HOME_SETTINGS_ORIGINAL_FILE, 'utf8')) as HomeSettingsSnapshot
    await writeHomeSettings(payload, original)
    return original
  }
  const original = await readHomeSettings(payload)
  await mkdir(path.dirname(HOME_SETTINGS_ORIGINAL_FILE), { recursive: true })
  await writeFile(HOME_SETTINGS_ORIGINAL_FILE, `${JSON.stringify(original, null, 2)}\n`, 'utf8')
  return original
}

/**
 * 끝: 파일 값으로 되돌리고 다시 읽어 비교한다. 같으면 파일을 지우고, 다르면 파일을 남긴 채 오류를 던진다
 * (다음 실행이나 사람이 복원할 수 있게). 돌려준 두 값으로 호출자가 엄격 비교 단언을 한 번 더 할 수 있다.
 */
export async function restoreHomeSettingsOriginal(
  payload: Payload,
): Promise<{ expected: HomeSettingsSnapshot; actual: HomeSettingsSnapshot }> {
  const expected = JSON.parse(await readFile(HOME_SETTINGS_ORIGINAL_FILE, 'utf8')) as HomeSettingsSnapshot
  await writeHomeSettings(payload, expected)
  const actual = await readHomeSettings(payload)
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`home-settings restore mismatch; original values kept in ${HOME_SETTINGS_ORIGINAL_FILE}`)
  }
  await rm(HOME_SETTINGS_ORIGINAL_FILE)
  return { expected, actual }
}
