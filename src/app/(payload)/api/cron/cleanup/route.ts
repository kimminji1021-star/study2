// 예약 정리 엔드포인트 — SPEC-DEPLOY-001 REQ-DEPLOY-007, plan.md §B.5.
// Vercel Cron(vercel.json crons, 매일 UTC 18시대)이 `Authorization: Bearer <CRON_SECRET>`을 붙여 GET으로 부른다.
// 위치: src/app 바로 아래에는 두 라우트 그룹만 두는 규칙(AC-INFRA-004)이 있어 (payload)/api 아래에 둔다.
// 정적 경로라 같은 그룹의 모든 경로 받기 (payload)/api/[...slug](Payload REST)보다 먼저 골라진다(E2E로 확인).
import config from '@payload-config'
import { getPayload, type Payload } from 'payload'

import { isAuthorizedCronRequest, runScheduledCleanup } from '../../../../../lib/scheduled-cleanup'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

function plain(status: number, body: string, headers: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: { ...NO_STORE, 'Content-Type': 'text/plain; charset=utf-8', ...headers },
  })
}

// @MX:WARN: [AUTO] 데이터를 지우는 공개 경로 — 비밀값 검사를 통과한 요청만 정리를 실행한다
// @MX:REASON: 인증 없이 부를 수 있으면 누구나 시도·작업 기록 삭제를 반복 실행할 수 있다. 응답에는 비밀값·질의 값·오류 원인을 싣지 않는다
export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedCronRequest(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return plain(401, 'Unauthorized')
  }
  let payload: Payload | undefined
  try {
    payload = await getPayload({ config })
    const result = await runScheduledCleanup(payload, new Date())
    return Response.json(result, { headers: NO_STORE })
  } catch (error) {
    payload?.logger.error({ err: error }, 'Scheduled cleanup failed.')
    return plain(500, 'Internal Server Error')
  }
}

function methodNotAllowed(): Response {
  return plain(405, 'Method Not Allowed', { Allow: 'GET' })
}

export const POST = methodNotAllowed
export const PUT = methodNotAllowed
export const PATCH = methodNotAllowed
export const DELETE = methodNotAllowed
