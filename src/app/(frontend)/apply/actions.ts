'use server'
// 신청 제출 서버 액션 — SPEC-APPLY-001 REQ-APPLY-008·012·013, plan.md §B.3.
// 서버 액션은 신뢰할 수 없는 진입점이다(Next server-actions.md §Security). 여기서는 FormData 해석·접속 IP 추출·redirect만 하고,
// 검증·횟수 제한·정원 확인·저장은 모두 신청 처리 함수(src/lib/submit-application.ts)가 맡는다.
// 반환값은 오류 코드·입력란 코드·방문자 본인 입력값으로 제한한다. 로그는 신청 처리 함수가 코드만 남긴다(REQ-APPLY-015).
import config from '@payload-config'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { readApplyForm, refillValues, type ApplyFormState } from '../../../lib/apply-form'
import { clientIpFromHeaders } from '../../../lib/rate-limit'
import { submitApplication } from '../../../lib/submit-application'

export async function submitApplicationAction(_previous: ApplyFormState, formData: FormData): Promise<ApplyFormState> {
  const input = readApplyForm(formData)
  const payload = await getPayload({ config })
  const result = await submitApplication(payload, input, { clientIp: clientIpFromHeaders(await headers()) })

  // POST 뒤 리다이렉트(PRG): 자바스크립트 없는 제출은 HTTP 303, 있으면 클라이언트 이동. redirect는 예외로 동작하므로 try 밖에서 부른다
  if (result.status === 'success') redirect(`/apply/complete/${result.referenceCode}`)

  return {
    status: 'error',
    code: result.code,
    fieldErrors: result.code === 'VALIDATION_FAILED' ? result.fieldErrors : {},
    values: refillValues(input),
  }
}
