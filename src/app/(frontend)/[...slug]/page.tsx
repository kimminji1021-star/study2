// 사용자 화면이 처리하지 않는 주소(예: /no-such-page, /a/b/c)를 받아 사용자 화면 404로 보낸다(SPEC-LANDING-001 REQ-LANDING-011, plan.md §B.7).
// notFound()가 (frontend)/not-found.tsx를 (frontend)/layout.tsx 안에서 그리므로 404에도 머리글·바닥글이 있다.
// @MX:NOTE: [AUTO] 모든 경로 받기는 우선순위가 가장 낮다 — 정적 경로(/admin, /api, /tours, /apply)와 그 하위 동적 경로가 먼저 맞으므로
//   관리자 화면·Payload API를 가리지 않는다(AC-LANDING-011이 /admin·/api/tours를 확인). 실험 기능 global-not-found는 쓰지 않는다.
//   요청 시점 렌더링이며 generateStaticParams를 두지 않는다(사전 렌더링할 주소가 없다)
import { notFound } from 'next/navigation'

export default function UnknownPathPage(): never {
  notFound()
}
