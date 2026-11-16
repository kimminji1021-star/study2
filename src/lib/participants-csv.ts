// 참가자 CSV 형식(순수 함수) — SPEC-ADMIN-001 REQ-ADMIN-009·010, plan.md §B.5.
// 내려받기 엔드포인트(participants-csv-endpoint.ts)가 읽은 신청을 이 함수로 CSV 문자열로 바꾼다.
// 엑셀(한국어 Windows)이 한글을 깨지 않고 열도록 UTF-8 BOM으로 시작하고, 줄 끝은 CRLF다(RFC 4180).
import type { Application } from '../payload-types'

export type ParticipantCsvRow = {
  referenceCode: string
  name: string
  phone: string
  email: string
  partySize: number
  status: Application['status']
  requests?: string | null
}

export const PARTICIPANTS_CSV_HEADERS = ['접수번호', '이름', '연락처', '이메일', '인원', '상태', '요청 사항'] as const

// 관리자 화면의 상태 선택지(Applications.ts)와 같은 라벨. 사이트 접수 완료 화면 문구(apply-messages.ts)와는 다르다
export const PARTICIPANT_STATUS_LABELS: Record<Application['status'], string> = {
  pending: '대기',
  confirmed: '확정',
  cancelled: '취소',
}

const BOM = '﻿'
const LINE_END = '\r\n'

// @MX:NOTE: [AUTO] 수식 주입(CSV Injection) 방어 — 첫 글자가 이 목록이면 앞에 작은따옴표를 붙여 글자로 읽히게 한다.
// plan.md §B.5의 `=` `+` `-` `@` 탭(0x09) CR(0x0D)에 OWASP "CSV Injection"(2026-11-16 확인, progress.md §E.2 M4)이 더 드는
// LF(0x0A)와 전각 `＝` `＋` `－` `＠`를 더했다. 모든 열에 같은 규칙을 건다 — 인원은 양의 정수라 해당 없고,
// 연락처 `+82 …`는 작은따옴표가 붙는다(엑셀이 수식으로 읽어 오류를 보이지 않게, plan.md §B.5). 칸 중간의 `=`는 엑셀이 수식으로 읽지 않는다
const FORMULA_LEADING = /^[=+\-@\t\r\n＝＋－＠]/

/** 칸 하나: 문자열로 바꿈 → 수식 시작 문자 무력화 → 안의 큰따옴표를 두 번 → 큰따옴표로 감쌈. 칸 안 줄바꿈은 그대로(따옴표 안이라 한 칸). */
export function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value)
  const safe = FORMULA_LEADING.test(text) ? `'${text}` : text
  return `"${safe.replace(/"/g, '""')}"`
}

function csvLine(cells: readonly (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(',') + LINE_END
}

/** BOM + 머리글 + 신청 한 건당 한 행. 행 순서는 받은 순서 그대로(정렬은 조회가 정한다 — 신청 시각, 같으면 신청 ID). */
export function buildParticipantsCsv(rows: readonly ParticipantCsvRow[]): string {
  const body = rows.map((row) =>
    csvLine([
      row.referenceCode,
      row.name,
      row.phone,
      row.email,
      row.partySize,
      PARTICIPANT_STATUS_LABELS[row.status],
      row.requests,
    ]),
  )
  return BOM + csvLine(PARTICIPANTS_CSV_HEADERS) + body.join('')
}

/** 내려받기 파일 이름. 회차 ID 말고는 아무 값도 넣지 않는다(REQ-ADMIN-010). */
export function participantsCsvFilename(sessionId: number): string {
  return `session-${sessionId}-participants.csv`
}
