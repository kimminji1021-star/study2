// 카탈로그 접근 규칙 — SPEC-TOUR-001 REQ-TOUR-005, plan.md §B.5.
// 쓰기(생성·수정·삭제)는 관리자만. 익명 읽기는 공개 투어, 공개 투어의 회차, 공개 투어가 대표 이미지로 참조하는 미디어만.
// 이 규칙은 REST·GraphQL·업로드 파일 주소(checkFileAccess)와 overrideAccess: false인 로컬 API에 똑같이 적용된다.
import type { Access } from 'payload'

// 관리자 인증 컬렉션 slug(가정 A1). Members 같은 다른 인증 컬렉션이 생겨도 관리자 권한을 얻지 않게 한다
export const ADMIN_COLLECTION = 'users'

// @MX:ANCHOR: [AUTO] 관리자 판정의 단일 지점 — 세 컬렉션의 쓰기 규칙과 읽기 규칙이 모두 이 함수를 거친다
// @MX:REASON: "로그인했다"가 아니라 "users 컬렉션 사용자다"로 판정해야 회원 기능(로드맵 4번) 도입 후에도 권한이 새지 않는다
export function isAdmin(user: { collection?: string } | null | undefined): boolean {
  return user?.collection === ADMIN_COLLECTION
}

export const adminOnly: Access = ({ req }) => isAdmin(req.user)

export const toursReadAccess: Access = ({ req }) => (isAdmin(req.user) ? true : { published: { equals: true } })

export const tourSessionsReadAccess: Access = ({ req }) =>
  isAdmin(req.user) ? true : { 'tour.published': { equals: true } }

// @MX:DEBT: [AUTO] 익명 미디어 읽기마다 공개 투어의 대표 이미지 ID 목록을 한 번 더 조회해 id in [...] 조건으로 돌려준다
// @MX:CEILING: 공개 투어 수백 개 이하(조건 목록 길이와 추가 조회 1회가 감당 가능한 규모)
// @MX:UPGRADE: 미디어 조회가 느려지거나 투어당 여러 장 사진(갤러리)을 도입할 때 미디어 쪽 공개 플래그·역참조 조건으로 바꾼다
export const mediaReadAccess: Access = async ({ req }) => {
  if (isAdmin(req.user)) return true

  // 공개 여부는 이 함수가 직접 거르므로 투어 조회 자체는 접근 규칙 없이(로컬 API 기본값) 실행한다
  const tours = await req.payload.find({
    collection: 'tours',
    where: { and: [{ published: { equals: true } }, { heroImage: { exists: true } }] },
    depth: 0,
    pagination: false,
    select: { heroImage: true },
    req,
  })
  const ids = tours.docs.map((tour) => tour.heroImage).filter((id): id is number => typeof id === 'number')

  return ids.length > 0 ? { id: { in: ids } } : false
}
