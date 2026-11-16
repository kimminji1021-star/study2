// 참가자 CSV 내려받기 — SPEC-ADMIN-001 REQ-ADMIN-009·010·013, plan.md §B.5.
// GET /api/tour-sessions/:id/participants-csv(TourSessions 컬렉션 엔드포인트). 경로·파일 이름에는 회차 ID 말고 아무 값도 넣지 않는다.
// 순서: 관리자 아님 → 403 / Sec-Fetch-Site: cross-site → 403 / ID 형식 오류·회차 없음 → 404 /
// 그 회차의 신청(대기·확정·취소 모두)을 관리자 읽기 규칙으로 읽음 → 작업 기록 저장 → CSV 응답. 기록이 실패하면 CSV 없이 500.
// 엔드포인트에는 컬렉션 접근 규칙이 자동으로 걸리지 않으므로 관리자 확인을 여기서 한다(plan.md §A.2).
import type { Endpoint, PayloadRequest } from 'payload'

import { isAdmin } from './access'
import { recordAdminAction } from './admin-audit'
import { buildParticipantsCsv, participantsCsvFilename } from './participants-csv'
import { parseRouteId } from './route-id'

export type ParticipantsCsvErrorCode = 'FORBIDDEN' | 'NOT_FOUND' | 'INTERNAL_ERROR'

const HTTP_STATUS: Record<ParticipantsCsvErrorCode, number> = {
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
}

// 내려받은 명단이 브라우저·중간 캐시에 남지 않게 한다(오류 응답도 같음)
const NO_STORE = 'no-store, private'

function failure(code: ParticipantsCsvErrorCode): Response {
  return Response.json({ code }, { status: HTTP_STATUS[code], headers: { 'Cache-Control': NO_STORE } })
}

// @MX:NOTE: [AUTO] GET이 작업 기록을 남기는 부수 효과가 있으므로, 다른 사이트가 관리자 브라우저로 링크를 열게 하는 요청을
// Sec-Fetch-Site: cross-site로 거부한다(plan.md §B.5·R9). 머리글이 없는 요청(브라우저가 아닌 클라이언트)은 인증만으로 판정한다 —
// 쿠키 인증의 교차 사이트 차단은 Payload csrf 허용 목록이 맡는다(목록이 빈 설정은 배포 SPEC 확인 항목)
function isCrossSite(req: PayloadRequest): boolean {
  return req.headers?.get('sec-fetch-site')?.toLowerCase() === 'cross-site'
}

/** 요청 하나를 처리해 CSV 또는 `{ code }` 응답을 돌려준다. 신청자 정보는 CSV 본문에만 담고 로그·오류에는 담지 않는다. */
export async function handleParticipantsCsv(req: PayloadRequest): Promise<Response> {
  if (!isAdmin(req.user)) return failure('FORBIDDEN')
  if (isCrossSite(req)) return failure('FORBIDDEN')
  const sessionId = parseRouteId(req.routeParams?.id)
  if (sessionId === null) return failure('NOT_FOUND')

  const { payload } = req
  try {
    const session = await payload.count({
      collection: 'tour-sessions',
      where: { id: { equals: sessionId } },
      overrideAccess: false,
      req,
    })
    if (session.totalDocs === 0) return failure('NOT_FOUND')

    // 관리자 읽기 규칙을 한 번 더 태운다(overrideAccess: false). 신청 시각 오름차순, 같은 시각이면 신청 ID 오름차순(D7)
    const applications = await payload.find({
      collection: 'applications',
      where: { session: { equals: sessionId } },
      sort: ['createdAt', 'id'],
      pagination: false,
      depth: 0,
      overrideAccess: false,
      req,
    })
    const csv = buildParticipantsCsv(applications.docs)

    // 응답 전에 기록한다. 실패하면 아래 catch에서 CSV 없이 500으로 끝난다(REQ-ADMIN-013)
    await recordAdminAction(req, {
      action: 'session.participants_csv',
      sessionId,
      rowCount: applications.docs.length,
    })

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${participantsCsvFilename(sessionId)}"`,
        'Cache-Control': NO_STORE,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (err) {
    // 코드·오류 종류 이름·회차 ID만 기록한다(원문 메시지는 질의 바인딩 값을 담을 수 있음, REQ-ADMIN-015)
    const errorName = err instanceof Error ? err.constructor.name : typeof err
    payload.logger.error({
      code: 'INTERNAL_ERROR',
      errorName,
      sessionId,
      msg: 'Participants CSV failed: INTERNAL_ERROR',
    })
    return failure('INTERNAL_ERROR')
  }
}

export const participantsCsvEndpoint: Endpoint = {
  path: '/:id/participants-csv',
  method: 'get',
  handler: handleParticipantsCsv,
}
