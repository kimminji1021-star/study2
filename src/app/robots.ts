// robots.txt — SPEC-DEPLOY-001 REQ-DEPLOY-012. 비공개 미리보기 동안 모든 검색 로봇에 모든 경로를 막는다.
// 보호(Vercel Authentication)가 실수로 꺼졌을 때를 대비한 이중 장치다. 사이트맵은 만들지 않는다.
// 2단계 공개 출시 SPEC이 이 파일과 X-Robots-Tag(next.config.ts), 로봇 메타 태그((frontend)/layout.tsx)를 함께 걷어 낸다.
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', disallow: '/' },
  }
}
