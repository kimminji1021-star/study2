'use client'
// 신청 양식 — SPEC-APPLY-001 REQ-APPLY-007·008·014, 디자인 핸드오프 화면 4(신청 정보 입력), plan.md §B.7·§B.8.
// - 서버 액션을 useActionState로 부른다. 자바스크립트가 없어도 양식이 그대로 제출된다(성공하면 303 리다이렉트).
// - 오류 안내는 해당 입력란의 aria-describedby로 연결한다. 검증 오류 뒤에는 방문자 본인 입력값을 다시 채운다(가정 A3).
// - 허니팟(website)은 화면 밖에 두고 보조 기술·키보드 이동에서 뺀다. display:none을 쓰지 않는다(일부 봇이 숨김 입력란을 건너뜀).
import { useActionState, type ReactNode } from 'react'

import { INITIAL_APPLY_FORM_STATE, type ApplyFormValues } from '../../../lib/apply-form'
import { HONEYPOT_FIELD, type ApplicationField } from '../../../lib/application-input'
import { APPLY_TEXT, FIELD_ERROR_MESSAGES, SUBMIT_ERROR_MESSAGES } from '../../../lib/apply-messages'
import { REQUESTS_CONSENT, REQUIRED_CONSENT, SENSITIVE_INFO_NOTICE, type ConsentNotice } from '../../../lib/consent'
import { submitApplicationAction } from './actions'

const EMPTY_VALUES: ApplyFormValues = {
  name: '',
  email: '',
  phone: '',
  partySize: '1',
  requests: '',
  privacyConsent: false,
  requestsConsent: false,
}

// 한 화면에 양식이 하나뿐이라 고정 id를 쓴다
const errorId = (field: ApplicationField) => `apply-${field}-error`

const inputClass =
  'min-h-(--touch-min) w-full rounded-(--radius-sm) border border-(--color-input-border) bg-(--color-bg) px-(--space-3) py-(--space-2) aria-invalid:border-(--status-canceled-fg)'

function FieldError({ field, message }: { field: ApplicationField; message: string | undefined }) {
  if (message === undefined) return null
  return (
    <p id={errorId(field)} className="text-(length:--text-small) font-medium text-(--status-canceled-fg)">
      {message}
    </p>
  )
}

function describedBy(...ids: Array<string | false | undefined>): string | undefined {
  const joined = ids.filter((id): id is string => typeof id === 'string' && id !== '').join(' ')
  return joined === '' ? undefined : joined
}

function Notice({ id, notice }: { id: string; notice: ConsentNotice }) {
  return (
    <div id={id} className="rounded-(--radius-md) bg-(--color-surface) p-(--space-4) text-(length:--text-small)">
      <p className="mb-(--space-2) font-semibold">{notice.title}</p>
      <dl className="grid gap-y-1 sm:grid-cols-[auto_1fr] sm:gap-x-(--space-3)">
        {notice.items.map((item) => (
          <div key={item.label} className="contents">
            <dt className="font-medium text-(--color-text-2)">{item.label}</dt>
            <dd>{item.text}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function Labeled({ htmlFor, label, children }: { htmlFor: string; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-(--space-2)">
      <label htmlFor={htmlFor} className="font-semibold">
        {label}
      </label>
      {children}
    </div>
  )
}

export function ApplyForm({ sessionId, partySizes }: { sessionId: number; partySizes: number[] }) {
  const [state, formAction, pending] = useActionState(submitApplicationAction, INITIAL_APPLY_FORM_STATE)
  const values = state.status === 'error' ? state.values : EMPTY_VALUES
  const fieldErrors = state.status === 'error' ? state.fieldErrors : {}
  const message = (field: ApplicationField) => {
    const code = fieldErrors[field]
    return code === undefined ? undefined : FIELD_ERROR_MESSAGES[code]
  }
  const has = (field: ApplicationField) => fieldErrors[field] !== undefined

  return (
    <form action={formAction} className="relative flex flex-col gap-(--space-6)">
      {state.status === 'error' && (
        <div
          role="alert"
          className="rounded-(--radius-md) bg-(--status-canceled-bg) p-(--space-4) text-(--status-canceled-fg)"
        >
          <p className="font-semibold">{SUBMIT_ERROR_MESSAGES[state.code]}</p>
          {fieldErrors.session !== undefined && <p>{FIELD_ERROR_MESSAGES[fieldErrors.session]}</p>}
        </div>
      )}

      <input type="hidden" name="session" value={sessionId} />

      <Labeled htmlFor="apply-name" label="이름">
        <input
          id="apply-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          defaultValue={values.name}
          aria-invalid={has('name') || undefined}
          aria-describedby={describedBy(has('name') && errorId('name'))}
          className={inputClass}
        />
        <FieldError field="name" message={message('name')} />
      </Labeled>

      <Labeled htmlFor="apply-email" label="이메일">
        <input
          id="apply-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={values.email}
          aria-invalid={has('email') || undefined}
          aria-describedby={describedBy(has('email') && errorId('email'))}
          className={inputClass}
        />
        <FieldError field="email" message={message('email')} />
      </Labeled>

      <Labeled htmlFor="apply-phone" label="연락처">
        <input
          id="apply-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          required
          defaultValue={values.phone}
          aria-invalid={has('phone') || undefined}
          aria-describedby={describedBy(has('phone') && errorId('phone'))}
          className={inputClass}
        />
        <FieldError field="phone" message={message('phone')} />
      </Labeled>

      <Labeled htmlFor="apply-partySize" label="인원">
        <select
          id="apply-partySize"
          name="partySize"
          required
          defaultValue={values.partySize}
          aria-invalid={has('partySize') || undefined}
          aria-describedby={describedBy(has('partySize') && errorId('partySize'))}
          className={inputClass}
        >
          {partySizes.map((size) => (
            <option key={size} value={String(size)}>
              {size}명
            </option>
          ))}
        </select>
        <FieldError field="partySize" message={message('partySize')} />
      </Labeled>

      <Labeled htmlFor="apply-requests" label="요청 사항">
        <p id="apply-requests-hint" className="text-(length:--text-small) text-(--color-text-2)">
          선택 입력입니다. {SENSITIVE_INFO_NOTICE}
        </p>
        <textarea
          id="apply-requests"
          name="requests"
          rows={4}
          defaultValue={values.requests}
          aria-invalid={has('requests') || undefined}
          aria-describedby={describedBy('apply-requests-hint', has('requests') && errorId('requests'))}
          className={inputClass}
        />
        <FieldError field="requests" message={message('requests')} />
      </Labeled>

      <fieldset className="flex flex-col gap-(--space-4)">
        <legend className="mb-(--space-3) text-(length:--text-h3) font-bold">개인정보 수집·이용 동의</legend>

        <div className="flex flex-col gap-(--space-2)">
          <Notice id="apply-privacy-notice" notice={REQUIRED_CONSENT} />
          <label className="flex min-h-(--touch-min) cursor-pointer items-center gap-(--space-3)">
            <input
              type="checkbox"
              name="privacyConsent"
              required
              defaultChecked={values.privacyConsent}
              aria-invalid={has('privacyConsent') || undefined}
              aria-describedby={describedBy('apply-privacy-notice', has('privacyConsent') && errorId('privacyConsent'))}
              className="size-5 shrink-0 accent-(--color-accent)"
            />
            <span className="font-medium">{APPLY_TEXT.privacyConsentLabel}</span>
          </label>
          <FieldError field="privacyConsent" message={message('privacyConsent')} />
        </div>

        <div className="flex flex-col gap-(--space-2)">
          <Notice id="apply-requests-consent-notice" notice={REQUESTS_CONSENT} />
          <label className="flex min-h-(--touch-min) cursor-pointer items-center gap-(--space-3)">
            <input
              type="checkbox"
              name="requestsConsent"
              defaultChecked={values.requestsConsent}
              aria-describedby="apply-requests-consent-notice"
              className="size-5 shrink-0 accent-(--color-accent)"
            />
            <span className="font-medium">{APPLY_TEXT.requestsConsentLabel}</span>
          </label>
        </div>
      </fieldset>

      {/* 허니팟: 사람에게는 보이지 않고 보조 기술·키보드 이동에서도 빠진다. 값이 있으면 서버가 이유 없이 거부한다 */}
      <div aria-hidden="true" className="absolute top-0 -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor="apply-website">웹사이트</label>
        <input id="apply-website" type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-(--button-height) w-full items-center justify-center rounded-(--radius-sm) bg-(--color-accent) px-(--space-6) font-semibold text-white hover:bg-(--color-accent-hover) disabled:opacity-60 sm:w-fit"
      >
        {pending ? APPLY_TEXT.submitting : APPLY_TEXT.submit}
      </button>
    </form>
  )
}
