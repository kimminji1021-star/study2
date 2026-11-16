// 카탈로그 접근 규칙 — SPEC-TOUR-001 REQ-TOUR-005, plan.md §B.5.
// 쓰기(생성·수정·삭제)는 관리자만. 익명 읽기는 공개 투어, 공개 투어의 회차, 공개 투어가 대표 이미지로 참조하는 미디어와
// 홈 화면 설정의 대표 사진(SPEC-LANDING-001 REQ-LANDING-003)만.
// 이 규칙은 REST·GraphQL·업로드 파일 주소(checkFileAccess)와 overrideAccess: false인 로컬 API에 똑같이 적용된다.
// 신청 컬렉션 규칙(SPEC-APPLY-001 REQ-APPLY-003): 신청 읽기는 관리자만(adminOnly), 그 밖에는 모두 거부(denyAll).
// SPEC-ADMIN-001 REQ-ADMIN-002: 신청 수정만 관리자 단건(adminSingleDocOnly)으로 열고, status 외 필드는 lockedField로 잠근다.
import type { Access, FieldAccess } from 'payload'

// 관리자 인증 컬렉션 slug(가정 A1). Members 같은 다른 인증 컬렉션이 생겨도 관리자 권한을 얻지 않게 한다
export const ADMIN_COLLECTION = 'users'

// @MX:ANCHOR: [AUTO] 관리자 판정의 단일 지점 — 카탈로그·신청·작업 기록 컬렉션의 접근 규칙과 작업 기록의 관리자 ID 판정
// (recordAdminAction)이 모두 이 함수를 거친다
// @MX:REASON: "로그인했다"가 아니라 "users 컬렉션 사용자다"로 판정해야 회원 기능(로드맵 4번) 도입 후에도 권한이 새지 않는다
export function isAdmin(user: { collection?: string } | null | undefined): boolean {
  return user?.collection === ADMIN_COLLECTION
}

export const adminOnly: Access = ({ req }) => isAdmin(req.user)

// 관리자를 포함한 누구에게도 허용하지 않는다(SPEC-APPLY-001 REQ-APPLY-003). 신청은 서버 제출 경로가
// 로컬 API를 접근 규칙 없이(overrideAccess: true) 부르는 방법으로만 만들어진다
export const denyAll: Access = () => false

// 관리자가 문서 한 건을 ID로 지정한 수정만 허용한다(SPEC-ADMIN-001 REQ-ADMIN-002, plan.md §B.1).
// 일괄 수정은 Payload가 id 없이 이 함수를 부르므로 여기서도 거부된다(disableBulkEdit와 이중 차단)
export const adminSingleDocOnly: Access = ({ req, id }) => isAdmin(req.user) && id !== undefined && id !== null

// 필드 단위 수정 거부. 거부된 값은 오류 없이 버려지고 저장된 값이 유지되며, 관리자 화면은 그 필드를 읽기 전용으로 그린다.
// 서버 코드의 overrideAccess: true 저장에는 걸리지 않는다(plan.md §B.1·R4·R5)
export const lockedField: { update: FieldAccess } = { update: () => false }

export const toursReadAccess: Access = ({ req }) => (isAdmin(req.user) ? true : { published: { equals: true } })

export const tourSessionsReadAccess: Access = ({ req }) =>
  isAdmin(req.user) ? true : { 'tour.published': { equals: true } }

// SPEC-LANDING-001 REQ-LANDING-003, plan.md §B.2: 관리자가 아닌 요청에는 공개 투어 대표 이미지에 더해
// 홈 화면 설정의 대표 사진 하나를 허용한다. 업로드 파일 주소도 이 규칙을 그대로 쓴다(checkFileAccess).
// 대표 사진을 바꾸거나 비우면 다음 요청부터 이전 사진은 다시 숨는다(매번 현재 값을 읽음).
// @MX:DEBT: [AUTO] 익명 미디어 읽기마다 공개 투어 대표 이미지 ID 목록과 홈 대표 사진 ID를 각각 한 번 더 조회해(추가 조회 2회)
//   id in [...] 조건으로 돌려준다
// @MX:CEILING: 공개 투어 수백 개 이하(조건 목록 길이와 추가 조회 2회가 감당 가능한 규모)
// @MX:UPGRADE: 미디어 조회가 느려지거나 투어당 여러 장 사진(갤러리)을 도입할 때 미디어 쪽 공개 플래그·역참조 조건으로 바꾼다
export const mediaReadAccess: Access = async ({ req }) => {
  if (isAdmin(req.user)) return true

  // 공개 여부는 이 함수가 직접 거르므로 투어·전역 설정 조회 자체는 접근 규칙 없이(로컬 API 기본값) 실행한다.
  // depth 0이라 전역 설정 → 미디어 채우기 → 이 규칙 → 전역 설정 같은 재귀가 생기지 않는다
  const tours = await req.payload.find({
    collection: 'tours',
    where: { and: [{ published: { equals: true } }, { heroImage: { exists: true } }] },
    depth: 0,
    pagination: false,
    select: { heroImage: true },
    req,
  })
  const homeSettings = await req.payload.findGlobal({
    slug: 'home-settings',
    depth: 0,
    select: { heroImage: true },
    req,
  })
  const ids = [...tours.docs.map((tour) => tour.heroImage), homeSettings.heroImage].filter(
    (id): id is number => typeof id === 'number',
  )

  return ids.length > 0 ? { id: { in: ids } } : false
}
