// 홈 히어로 — 전폭 짙은 면 위에 큰 제목 → 한 줄 소개 → 흰 알약 버튼 "투어 둘러보기"(SPEC-LANDING-001 REQ-LANDING-004·005·006, plan.md §B.4·§B.5).
// 바탕은 항상 --surface-dark다. 대표 사진이 있으면 그 위에 사진 층과 균일 덮개 층을 깔고, 없으면 두 층을 그리지 않는다(이미지 요청 0건).
// 히어로 안에서는 포인트 색(accent)을 쓰지 않는다 — 짙은 면 위 2.65:1. 글자·버튼·포커스는 흰색 계열로 둔다.
import Image from 'next/image'
import Link from 'next/link'

import type { CatalogImage } from '../lib/catalog'

type HomeHeroProps = { headline: string; intro: string; image: CatalogImage | null }

export function HomeHero({ headline, intro, image }: HomeHeroProps) {
  return (
    // data-on-dark: 이 범위의 포커스 외곽선을 흰색으로 바꾼다(globals.css)
    <section
      aria-labelledby="hero-heading"
      data-on-dark
      className="relative flex items-center overflow-hidden bg-(--surface-dark) text-(--on-dark) md:min-h-[min(88vh,760px)]"
    >
      {image !== null && (
        <>
          {/* 첫 화면의 가장 큰 요소라 미리 받는다(Next 16 preload — priority 대체). sharp가 없어 서버 최적화는 끈다 */}
          <Image src={image.url} alt={image.alt} fill unoptimized preload sizes="100vw" className="object-cover" />
          {/* @MX:NOTE: [AUTO] 덮개는 그라데이션이 아니라 균일한 --overlay-photo(rgba(29, 29, 31, 0.65))다.
              순백 사진 위에서도 흰 글자·흰 버튼 경계·흰 포커스가 5.24:1(plan.md §B.5). 위쪽만 어둡게 하면 최악 배경 대비를 보장하지 못한다 */}
          <div data-hero-overlay aria-hidden="true" className="absolute inset-0 bg-(--overlay-photo)" />
        </>
      )}
      <div className="relative mx-auto flex w-full max-w-(--content-max) flex-col items-center px-(--page-x) py-(--space-20) text-center">
        <h1
          id="hero-heading"
          className="max-w-[18em] text-(length:--text-display) leading-(--leading-display) font-semibold tracking-(--tracking-display)"
        >
          {headline}
        </h1>
        <p className="mt-(--space-4) max-w-[34em] text-(length:--text-h3) leading-(--leading-h3)">{intro}</p>
        <Link
          href="/tours"
          className="mt-(--space-8) inline-flex min-h-(--button-height) items-center rounded-(--radius-pill) bg-(--on-dark) px-(--space-8) font-semibold text-(--color-text) transition-colors hover:bg-(--color-surface)"
        >
          투어 둘러보기
        </Link>
      </div>
    </section>
  )
}
