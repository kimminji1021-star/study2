// 관리자 첫 화면의 회차 현황 표 — SPEC-ADMIN-001 REQ-ADMIN-011, plan.md §B.6.
// Payload 기본 대시보드의 beforeDashboard 자리에 그리는 서버 구성 요소다(컬렉션 카드 위). 받은 payload·user로
// 데이터 함수(admin-dashboard.ts)를 부르고 표만 그린다. 계산은 하지 않는다. 차트는 두지 않는다.
// 관리자 화면에는 users 컬렉션 사용자만 들어오지만, 관리자가 아니면 한 번 더 확인해 아무것도 그리지 않는다.
import type { CSSProperties } from 'react'

import type { Payload } from 'payload'

import { isAdmin } from '../../lib/access'
import { getSessionDashboard } from '../../lib/admin-dashboard'
import { SESSION_DASHBOARD_UI } from '../../lib/admin-messages'
import { formatSessionDateTime } from '../../lib/format'

export type SessionDashboardProps = { payload: Payload; user?: { collection?: string } | null }

const cellStyle: CSSProperties = {
  padding: '8px 12px',
  borderBottom: '1px solid var(--theme-elevation-100)',
  textAlign: 'left',
  whiteSpace: 'nowrap',
}
const numberStyle: CSSProperties = { ...cellStyle, textAlign: 'right' }
// 정원·대기·확정·남은 자리 열(머리글도 숫자와 같은 쪽으로 맞춘다)
const NUMBER_COLUMNS = new Set([2, 3, 4, 5])
// 비공개 표시는 색만이 아니라 글자로 구분한다(접근성, plan.md §B.6)
const badgeStyle: CSSProperties = {
  marginLeft: 8,
  padding: '1px 6px',
  border: '1px solid var(--theme-elevation-400)',
  borderRadius: 4,
  fontSize: '0.85em',
}

export async function SessionDashboard({ payload, user }: SessionDashboardProps) {
  if (!isAdmin(user)) return null
  const rows = await getSessionDashboard(payload, { now: new Date() })
  const ui = SESSION_DASHBOARD_UI

  return (
    <section style={{ marginBottom: 32, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <caption style={{ textAlign: 'left', fontWeight: 600, fontSize: '1.2em', marginBottom: 12 }}>
          {ui.caption}
        </caption>
        <thead>
          <tr>
            {ui.headers.map((header, index) => (
              <th key={header} scope="col" style={NUMBER_COLUMNS.has(index) ? numberStyle : cellStyle}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={ui.headers.length} style={cellStyle}>
                {ui.empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.sessionId} data-session-id={row.sessionId}>
                <td style={cellStyle}>
                  {row.tourTitle}
                  {row.tourPublished ? null : <span style={badgeStyle}>{ui.unpublished}</span>}
                </td>
                <td style={cellStyle}>{formatSessionDateTime(row.startsAt)}</td>
                <td style={numberStyle}>{row.capacity}</td>
                <td style={numberStyle}>{row.pending}</td>
                <td style={numberStyle}>{row.confirmed}</td>
                <td style={numberStyle}>{row.remainingSeats}</td>
                <td style={cellStyle}>{ui.status[row.status]}</td>
                <td style={cellStyle}>
                  <a href={row.csvPath} download>
                    {ui.csvLink}
                  </a>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  )
}
