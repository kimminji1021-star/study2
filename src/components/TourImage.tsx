// 투어 대표 이미지 — 4:3 상자에 원본을 꽉 채워 넣는다(plan.md §B.1·§B.6). 이미지가 없으면 자리표시 블록을 그린다.
// sharp를 쓰지 않으므로 서버 이미지 최적화를 끄고(unoptimized) Payload 파일 주소를 그대로 쓴다.
// @MX:NOTE: [AUTO] 파일 주소는 Payload가 serverURL(NEXT_PUBLIC_SERVER_URL)을 붙인 절대 주소다(R14, M4 E2E 실측). unoptimized이면
//   next/image가 주소를 가공·검사하지 않아 images.localPatterns가 필요 없다. 배포 SPEC에서 serverURL과 실제 사이트 주소가 같아야 이미지가 보인다
import Image from 'next/image'

import type { CatalogImage } from '../lib/catalog'

export function TourImage({ image, priority = false }: { image: CatalogImage | null; priority?: boolean }) {
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-(--color-surface)">
      {image === null ? (
        <div
          data-image-placeholder
          role="img"
          aria-label="사진 준비 중"
          className="flex h-full w-full items-center justify-center text-(--color-text-2)"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M3 16l5-5 4 4 3-3 6 6" />
            <circle cx="16" cy="9" r="1.5" />
          </svg>
        </div>
      ) : (
        <Image src={image.url} alt={image.alt} fill unoptimized priority={priority} className="object-cover" />
      )}
    </div>
  )
}
