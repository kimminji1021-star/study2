// SPEC-ADMIN-001 M4 — 참가자 CSV 형식(순수 함수, AC-ADMIN-010, REQ-ADMIN-009·010, plan.md §B.5).
// 수식 주입 방어는 OWASP "CSV Injection"(2026-11-16 확인, progress.md §E.2 M4)의 시작 문자 목록을 따른다 —
// plan.md §B.5의 `=` `+` `-` `@` 탭 CR에 더해 LF와 전각 `＝` `＋` `－` `＠`도 막는다(더 엄격한 쪽).
import { describe, expect, it } from 'vitest'

import {
  buildParticipantsCsv,
  csvCell,
  participantsCsvFilename,
  PARTICIPANTS_CSV_HEADERS,
  type ParticipantCsvRow,
} from '../../src/lib/participants-csv'

const BOM = '﻿'
const HEADER_LINE = '"접수번호","이름","연락처","이메일","인원","상태","요청 사항"'

function row(overrides: Partial<ParticipantCsvRow> = {}): ParticipantCsvRow {
  return {
    referenceCode: 'SB-AAAAA-11111',
    name: '김민지',
    phone: '010-1234-5678',
    email: 'minji@example.test',
    partySize: 2,
    status: 'pending',
    requests: null,
    ...overrides,
  }
}

/** RFC 4180 해석기(테스트 전용) — 큰따옴표 안의 쉼표·줄바꿈·`""`를 한 칸으로 읽는다. 줄 끝은 CRLF. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let cells: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i += 1
      } else if (ch === '"') {
        quoted = false
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      cells.push(cell)
      cell = ''
    } else if (ch === '\r' && text[i + 1] === '\n') {
      cells.push(cell)
      rows.push(cells)
      cells = []
      cell = ''
      i += 1
    } else {
      cell += ch
    }
  }
  if (cell !== '' || cells.length > 0) {
    cells.push(cell)
    rows.push(cells)
  }
  return rows
}

describe('참가자 CSV 형식(AC-ADMIN-010)', () => {
  it('BOM으로 시작하고 첫 줄이 정확히 머리글이며 모든 줄이 CRLF로 끝난다', () => {
    const csv = buildParticipantsCsv([row(), row({ referenceCode: 'SB-BBBBB-22222' })])
    expect(csv.startsWith(BOM)).toBe(true)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const body = csv.slice(1)
    expect(body.split('\r\n')[0]).toBe(HEADER_LINE)
    expect(body.endsWith('\r\n')).toBe(true)
    // 줄바꿈이 없는 칸만 있으므로 CRLF로 나눈 줄 = 머리글 + 2행 + 끝의 빈 조각
    expect(body.split('\r\n')).toHaveLength(4)
    // CR 없는 LF가 줄 끝으로 쓰이지 않는다
    expect(body.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
    expect(PARTICIPANTS_CSV_HEADERS).toEqual(['접수번호', '이름', '연락처', '이메일', '인원', '상태', '요청 사항'])
  })

  it('행이 없으면 BOM + 머리글 한 줄뿐이다', () => {
    expect(buildParticipantsCsv([])).toBe(`${BOM}${HEADER_LINE}\r\n`)
  })

  it('상태 라벨·인원·빈 요청 사항', () => {
    const csv = buildParticipantsCsv([
      row({ status: 'pending', partySize: 2, requests: null }),
      row({ status: 'confirmed', requests: '' }),
      row({ status: 'cancelled', requests: undefined }),
    ])
    const lines = csv.slice(1).split('\r\n')
    expect(lines[1]).toBe('"SB-AAAAA-11111","김민지","010-1234-5678","minji@example.test","2","대기",""')
    expect(lines[2].endsWith(',"확정",""')).toBe(true)
    expect(lines[3].endsWith(',"취소",""')).toBe(true)
  })

  it('큰따옴표는 두 번 쓰고, 쉼표·줄바꿈이 든 값은 따옴표 안에 그대로 둔다', () => {
    expect(csvCell('a"b')).toBe('"a""b"')
    expect(csvCell('"=1"')).toBe('"""=1"""')
    expect(csvCell('가,나\n다')).toBe('"가,나\n다"')
    expect(csvCell('가\r\n나')).toBe('"가\r\n나"')
    const csv = buildParticipantsCsv([row({ requests: '휠체어, 2명\n엘리베이터 "꼭" 필요' })])
    expect(csv).toContain('"휠체어, 2명\n엘리베이터 ""꼭"" 필요"')
  })

  it.each([
    ['=1+1', `"'=1+1"`],
    ['+82 10-1234-5678', `"'+82 10-1234-5678"`],
    ['-5', `"'-5"`],
    ['@SUM(A1)', `"'@SUM(A1)"`],
    ['\t=1', `"'\t=1"`],
    ['\r=1', `"'\r=1"`],
    ['\n=1', `"'\n=1"`],
    ['＝1+1', `"'＝1+1"`],
    ['＋82', `"'＋82"`],
    ['－5', `"'－5"`],
    ['＠SUM(A1)', `"'＠SUM(A1)"`],
    ['=HYPERLINK("x")', `"'=HYPERLINK(""x"")"`],
  ])('수식 시작 문자 %j는 앞에 작은따옴표를 붙인다', (value, expected) => {
    expect(csvCell(value)).toBe(expected)
  })

  it.each([['김=민지'], ['010-1234-5678'], ['01012345678'], ["'=이미 작은따옴표"], [' =앞 공백'], ['a,=b'], ['']])(
    '첫 글자가 위험 문자가 아닌 %j는 바뀌지 않는다',
    (value) => {
      expect(csvCell(value)).toBe(`"${value.replace(/"/g, '""')}"`)
    },
  )

  it('숫자·빈 값도 문자열 칸으로 나간다', () => {
    expect(csvCell(2)).toBe('"2"')
    expect(csvCell(null)).toBe('""')
    expect(csvCell(undefined)).toBe('""')
  })

  it('모든 열에 같은 규칙이 걸린다(이름·이메일·연락처·접수 번호·요청 사항)', () => {
    const csv = buildParticipantsCsv([
      row({
        referenceCode: '=ref',
        name: '+이름',
        phone: '+82 10-1234-5678',
        email: '@mail',
        requests: '-요청',
      }),
    ])
    expect(csv.slice(1).split('\r\n')[1]).toBe(`"'=ref","'+이름","'+82 10-1234-5678","'@mail","2","대기","'-요청"`)
  })

  it('RFC 4180 방식으로 다시 나누면 행 수가 입력 + 1이고 각 칸이 (붙인 작은따옴표를 뺀) 원래 값과 같다', () => {
    const input: ParticipantCsvRow[] = [
      row({ name: '=김민지', requests: '휠체어, 2명\n"꼭"' }),
      row({ referenceCode: 'SB-BBBBB-22222', phone: '+82 10-9999-0000', status: 'confirmed', partySize: 3 }),
      row({ referenceCode: 'SB-CCCCC-33333', email: '＠x@example.test', status: 'cancelled', requests: '\t탭' }),
      row({ referenceCode: 'SB-DDDDD-44444', name: '김=민지', requests: '=HYPERLINK("x")' }),
    ]
    const parsed = parseCsv(buildParticipantsCsv(input).slice(1))
    expect(parsed).toHaveLength(input.length + 1)
    expect(parsed[0]).toEqual([...PARTICIPANTS_CSV_HEADERS])
    const label = { pending: '대기', confirmed: '확정', cancelled: '취소' } as const
    const risky = /^[=+\-@\t\r\n＝＋－＠]/
    const restore = (cell: string, original: string) => (risky.test(original) ? cell.slice(1) : cell)
    input.forEach((source, index) => {
      const cells = parsed[index + 1]
      const originals = [
        source.referenceCode,
        source.name,
        source.phone,
        source.email,
        String(source.partySize),
        label[source.status],
        source.requests ?? '',
      ]
      expect(cells).toHaveLength(7)
      cells.forEach((cell, column) => {
        const original = originals[column]
        if (risky.test(original)) expect(cell.startsWith("'")).toBe(true)
        expect(restore(cell, original)).toBe(original)
      })
    })
  })

  it('파일 이름은 회차 ID만 담는다', () => {
    expect(participantsCsvFilename(42)).toBe('session-42-participants.csv')
  })
})
