// SPEC-LANDING-001 홈 화면 시험 도우미 — 순백 1×1 PNG(덮개 최악 배경 확인용)와 홈 화면 설정 변경(plan.md §B.11).
// 설정을 바꾸기 전에 반드시 saveHomeSettingsOriginal(home-settings-original.ts)로 원래 값을 남긴다.
import type { Payload } from 'payload'

import type { UploadFile } from './catalog-fixtures'
import { HOME_SETTINGS_SLUG, type HomeSettingsSnapshot } from './home-settings-original'

// 올바른 1×1 PNG(불투명 순백 픽셀, RGB 8비트). 새 패키지 없이 바이트 상수로 둔다
const WHITE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC',
  'base64',
)

/** 순백 1×1 PNG 업로드 파일. 파일 이름에 표식(test-…)을 넣어 정리 조건에 걸리게 한다. */
export function whitePngFile(name: string): UploadFile {
  const data = Buffer.from(WHITE_PIXEL_PNG)
  return { data, mimetype: 'image/png', name, size: data.length }
}

/** 홈 화면 설정의 일부 필드를 바꾼다(로컬 API, 접근 규칙 생략). 주지 않은 필드는 그대로 둔다. */
export async function setHomeSettings(payload: Payload, values: Partial<HomeSettingsSnapshot>): Promise<void> {
  await payload.updateGlobal({ slug: HOME_SETTINGS_SLUG, data: values as never, depth: 0, overrideAccess: true })
}
