// SPEC-APPLY-001 M5 — 신청 화면·접수 완료 화면이 쓰는 조회 함수(실제 DB).
// - getApplySession: 신청 화면(/apply?session=)의 회차 조회. 익명 권한으로 공개 투어의 회차만 읽고, 시작한 회차도 404가 아닌
//   "신청 불가"로 돌려준다(예정 회차 조회 startsAt > now로 거르지 않음, AC-APPLY-007). 남은 자리는 점유 인원을 반영한다(REQ-APPLY-005).
// - findApplicationSummary: 접수 완료 화면의 조회. 접수 번호를 대문자로 맞춰 찾고, 개인정보 필드를 돌려주지 않는다(REQ-APPLY-012·015).
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { findApplicationSummary } from '../../src/lib/application-summary'
import { getApplySession } from '../../src/lib/catalog'
import config from '../../src/payload.config'
import { applicationInput, cleanupMarkerData, createTourWithSession } from '../helpers/application-fixtures'
import { newMarker } from '../helpers/catalog-fixtures'

const marker = newMarker()
let payload: Payload

describe('신청 화면·접수 완료 화면 조회(실제 DB)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  afterAll(async () => {
    if (payload === undefined) return
    try {
      await cleanupMarkerData(payload, marker)
      const left = await payload.count({ collection: 'applications', where: { email: { like: marker } } })
      expect(left.totalDocs).toBe(0)
    } finally {
      await payload.destroy()
    }
  })

  describe('getApplySession', () => {
    it('공개 투어의 모집 중 회차: 투어 제목·slug와 점유 인원을 반영한 남은 자리', async () => {
      const { sessionId } = await createTourWithSession(payload, marker, 'open', { capacity: 5 })
      await payload.create({
        collection: 'applications',
        data: applicationInput(sessionId, marker, { partySize: 1, status: 'pending' }) as never,
      })
      await payload.create({
        collection: 'applications',
        data: applicationInput(sessionId, marker, { partySize: 1, status: 'confirmed' }) as never,
      })
      await payload.create({
        collection: 'applications',
        data: applicationInput(sessionId, marker, { partySize: 2, status: 'cancelled' }) as never,
      })

      const found = await getApplySession(payload, sessionId)
      expect(found).not.toBeNull()
      expect(found?.tour).toEqual({ slug: `${marker}-open`, title: `${marker}-open 제목` })
      expect(found?.session.id).toBe(sessionId)
      expect(found?.session.availability).toEqual({ capacity: 5, remainingSeats: 3, selectable: true, reason: null })
    })

    it('마감 회차·자리 없는 회차는 null이 아니라 선택 불가 사유와 함께 돌려준다', async () => {
      const closed = await createTourWithSession(payload, marker, 'closed', { capacity: 5, status: 'closed' })
      expect((await getApplySession(payload, closed.sessionId))?.session.availability.reason).toBe('closed')

      const full = await createTourWithSession(payload, marker, 'full', { capacity: 2 })
      await payload.create({
        collection: 'applications',
        data: applicationInput(full.sessionId, marker, { partySize: 2 }) as never,
      })
      const fullFound = await getApplySession(payload, full.sessionId)
      expect(fullFound?.session.availability).toEqual({
        capacity: 2,
        remainingSeats: 0,
        selectable: false,
        reason: 'full',
      })
    })

    it('이미 시작한 회차도 null이 아니라 사유 past로 돌려준다(시작 시각으로 거르지 않음)', async () => {
      const started = await createTourWithSession(payload, marker, 'started', { capacity: 15, startsInDays: -1 })
      const found = await getApplySession(payload, started.sessionId)
      expect(found).not.toBeNull()
      expect(found?.session.availability.reason).toBe('past')
    })

    it('공개되지 않은 투어의 회차와 없는 회차는 null', async () => {
      const hidden = await createTourWithSession(payload, marker, 'hidden', { capacity: 10, published: false })
      expect(await getApplySession(payload, hidden.sessionId)).toBeNull()
      expect(await getApplySession(payload, 2147483000)).toBeNull()
    })

    it('주입한 현재 시각을 기준으로 판정한다', async () => {
      const { sessionId } = await createTourWithSession(payload, marker, 'later', { capacity: 4, startsInDays: 2 })
      const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      expect((await getApplySession(payload, sessionId, { now: future }))?.session.availability.reason).toBe('past')
    })
  })

  describe('findApplicationSummary', () => {
    it('접수 번호(대소문자 무시)로 접수 번호·인원·상태·투어 제목·회차 일시만 돌려준다', async () => {
      const { sessionId } = await createTourWithSession(payload, marker, 'summary', { capacity: 10 })
      const session = await payload.findByID({ collection: 'tour-sessions', id: sessionId, depth: 0 })
      const created = await payload.create({
        collection: 'applications',
        data: applicationInput(sessionId, marker, { partySize: 3 }) as never,
      })

      const summary = await findApplicationSummary(payload, created.referenceCode.toLowerCase())
      expect(summary).toEqual({
        referenceCode: created.referenceCode,
        partySize: 3,
        status: 'pending',
        tourTitle: `${marker}-summary 제목`,
        startsAt: session.startsAt,
      })
      // 개인정보(이름·이메일·연락처)와 DB 순번 ID가 결과에 섞이지 않는다. 투어 제목에는 표식이 있으므로 표식 자체로 검사하지 않는다
      const serialized = JSON.stringify(summary)
      for (const value of [created.name, created.email, created.phone]) expect(serialized).not.toContain(value)
      expect(Object.keys(summary ?? {})).not.toContain('id')
    })

    it('형식에 맞지 않는 값과 없는 접수 번호는 null', async () => {
      expect(await findApplicationSummary(payload, 'abc')).toBeNull()
      expect(await findApplicationSummary(payload, '123')).toBeNull()
      expect(await findApplicationSummary(payload, 'SB-00000-00000')).toBeNull()
    })
  })
})
