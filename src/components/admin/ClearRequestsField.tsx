'use client'
// 관리자 신청 상세의 "요청 사항 삭제" 버튼 — SPEC-ADMIN-001 REQ-ADMIN-008, plan.md §B.4.
// 요청 사항이 비어 있지 않을 때만 버튼을 그리고, 확인 대화 상자를 거쳐 관리자 전용 엔드포인트로 POST한 뒤 화면을 새로 고친다.
// 같은 출처 요청이라 쿠키 인증의 Origin 검사(Payload csrf 허용 목록)를 통과한다. 요청 사항 글은 요청·알림에 담지 않는다.
import { Button, ConfirmationModal, toast, useConfig, useDocumentInfo, useFormFields, useModal } from '@payloadcms/ui'
import type { UIFieldClientComponent } from 'payload'

import { CLEAR_REQUESTS_UI } from '../../lib/admin-messages'

const MODAL_SLUG = 'confirm-clear-requests'

export const ClearRequestsField: UIFieldClientComponent = () => {
  const { id } = useDocumentInfo()
  const requests = useFormFields(([fields]) => fields.requests?.value)
  const { openModal } = useModal()
  const {
    config: { routes, serverURL },
  } = useConfig()

  if (id === undefined || id === null || typeof requests !== 'string' || requests === '') return null

  const clear = async () => {
    const response = await fetch(
      `${serverURL}${routes.api}/applications/${encodeURIComponent(String(id))}/clear-requests`,
      {
        method: 'POST',
        credentials: 'include',
      },
    )
    if (response.ok) {
      toast.success(CLEAR_REQUESTS_UI.success)
      // 폼 상태에 남은 요청 사항 값을 버리고 저장된 값으로 다시 그린다
      window.location.reload()
      return
    }
    const body = (await response.json().catch(() => ({}))) as { code?: unknown }
    const code = typeof body.code === 'string' ? body.code : String(response.status)
    toast.error(`${CLEAR_REQUESTS_UI.failed} (${code})`)
  }

  return (
    <div className="field-type clear-requests-field">
      <Button buttonStyle="secondary" size="small" onClick={() => openModal(MODAL_SLUG)}>
        {CLEAR_REQUESTS_UI.button}
      </Button>
      <ConfirmationModal
        modalSlug={MODAL_SLUG}
        heading={CLEAR_REQUESTS_UI.heading}
        body={CLEAR_REQUESTS_UI.body}
        confirmLabel={CLEAR_REQUESTS_UI.confirm}
        confirmingLabel={CLEAR_REQUESTS_UI.confirming}
        cancelLabel={CLEAR_REQUESTS_UI.cancel}
        onConfirm={clear}
      />
    </div>
  )
}
