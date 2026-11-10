import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ValidationError, type CollectionConfig } from 'payload'

import { adminOnly, mediaReadAccess } from '../lib/access'
import { exceedsUploadLimit } from '../lib/validation'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// 이미지 업로드 컬렉션(REQ-TOUR-001, plan.md §B.1·§B.6).
// - sharp를 쓰지 않으므로 원본만 저장한다. 크기별 이미지·형식 변환·자르기·초점 기능은 끈다
//   (sharp 없이 자르기 UI가 보이면 관리자가 자른 결과가 조용히 무시된다 — plan.md R2).
// - 저장 위치는 저장소 루트 media/(git 추적 제외). 실행 디렉터리에 따라 바뀌지 않게 절대 경로로 둔다.
export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    useAsTitle: 'alt',
  },
  access: {
    read: mediaReadAccess,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  hooks: {
    // @MX:NOTE: [AUTO] 5MB 판정의 주 지점(REQ-TOUR-001). payload.config.ts의 upload.limits.fileSize는 REST 보조 수단일 뿐이다
    // beforeOperation은 파일 처리(generateFileData)와 접근 검사보다 먼저 실행되므로
    // 로컬 API와 REST 어느 경로로 오든 문서·파일이 생기기 전에 거부된다(plan.md §B.6).
    beforeOperation: [
      ({ args, operation, req }) => {
        if ((operation === 'create' || operation === 'update') && exceedsUploadLimit(req.file)) {
          throw new ValidationError({
            collection: 'media',
            errors: [{ message: 'File size exceeds the 5 MB limit.', path: 'file' }],
          })
        }
        return args
      },
    ],
  },
  upload: {
    staticDir: path.resolve(dirname, '..', '..', 'media'),
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    crop: false,
    focalPoint: false,
  },
  fields: [
    {
      name: 'alt',
      label: '대체 텍스트',
      type: 'text',
      required: true,
    },
  ],
}
