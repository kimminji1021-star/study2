// SPEC-APPLY-001 M2 — 점유 인원 정의와 신청 처리 함수(순차) 통합 테스트(실제 DB, Payload 로컬 API).
// AC-APPLY-005(점유 인원 정의 부분), AC-APPLY-008(통합 부분), AC-APPLY-009(정원 확인·자동 마감·롤백), AC-APPLY-014(동의 기록).
// 동시 제출은 application-concurrency.spec.ts가 맡는다.
import { sql } from '@payloadcms/db-postgres'
import { getPayload, type Payload, type PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PRIVACY_POLICY_VERSION } from '../../src/lib/consent'
import { getOccupiedSeatsBySession, getOccupiedSeatsInTransaction } from '../../src/lib/occupancy'
import { submitApplication, type SubmitApplicationOptions } from '../../src/lib/submit-application'
import { transactionDb } from '../../src/lib/transaction-db'
import config from '../../src/payload.config'
import {
  applicationInput,
  cleanupAttempts,
  cleanupMarkerData,
  createTourWithSession,
  sessionSnapshot,
  submissionInput,
  testIpPool,
} from '../helpers/application-fixtures'
import { newMarker } from '../helpers/catalog-fixtures'

const marker = newMarker()
// 제출마다 다른 문서용 접속 IP — 이 파일의 제출 수가 횟수 제한(10분 10회)에 걸리지 않게 한다(M4)
const ips = testIpPool('203.0.113', 100)
let payload: Payload

function submit(
  sessionId: number,
  overrides: Parameters<typeof submissionInput>[2] = {},
  options: Partial<SubmitApplicationOptions> = {},
) {
  return submitApplication(payload, submissionInput(sessionId, marker, overrides), {
    clientIp: ips.next(),
    ...options,
  })
}

async function occupied(sessionId: number): Promise<number> {
  return (await getOccupiedSeatsBySession(payload, [sessionId])).get(sessionId) ?? Number.NaN
}

async function findByReference(referenceCode: string) {
  const result = await payload.find({
    collection: 'applications',
    where: { referenceCode: { equals: referenceCode } },
    depth: 0,
  })
  expect(result.docs).toHaveLength(1)
  return result.docs[0]
}

describe('신청 처리 함수와 점유 인원(실제 DB)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  afterAll(async () => {
    if (payload === undefined) return
    try {
      // 정리를 모두 끝낸 뒤 단언한다(단언이 실패해도 테스트 데이터가 남지 않게)
      const attempts = await cleanupAttempts(payload, ips.used())
      await cleanupMarkerData(payload, marker)
      expect(attempts.before).toBeGreaterThanOrEqual(1)
      expect(attempts.after).toBe(0)
    } finally {
      await payload.destroy()
    }
  })

  describe('AC-APPLY-005 점유 인원 정의(대기·확정만 합산, 취소 제외)', () => {
    let sessionId: number
    let emptySessionId: number

    beforeAll(async () => {
      ;({ sessionId } = await createTourWithSession(payload, marker, 'occupancy', { capacity: 5 }))
      ;({ sessionId: emptySessionId } = await createTourWithSession(payload, marker, 'occupancy-empty', {
        capacity: 5,
      }))
      const seeds: [number, 'pending' | 'confirmed' | 'cancelled'][] = [
        [1, 'pending'],
        [1, 'pending'],
        [1, 'confirmed'],
        [1, 'cancelled'],
        [1, 'cancelled'],
      ]
      for (const [partySize, status] of seeds) {
        await payload.create({
          collection: 'applications',
          data: applicationInput(sessionId, marker, { partySize, status }) as never,
        })
      }
    })

    it('화면용 함수는 회차별 합계를 한 번에 돌려주고, 신청이 없는 회차는 0이다', async () => {
      const seats = await getOccupiedSeatsBySession(payload, [sessionId, emptySessionId])
      expect(seats.get(sessionId)).toBe(3)
      expect(seats.get(emptySessionId)).toBe(0)
    })

    it('빈 목록은 질의 없이 빈 맵이다', async () => {
      expect((await getOccupiedSeatsBySession(payload, [])).size).toBe(0)
    })

    it('정원 확인 구간용 함수(같은 트랜잭션 연결)도 같은 정의로 3을 돌려준다', async () => {
      const transactionID = await payload.db.beginTransaction()
      expect(transactionID).toBeTruthy()
      try {
        expect(await getOccupiedSeatsInTransaction(payload, transactionID as string, sessionId)).toBe(3)
        expect(await getOccupiedSeatsInTransaction(payload, transactionID as string, emptySessionId)).toBe(0)
      } finally {
        await payload.db.rollbackTransaction(transactionID as string)
      }
    })
  })

  describe('AC-APPLY-008 서버 재검증(통합)', () => {
    it('거부 사례를 제출하면 VALIDATION_FAILED이고 신청 수와 점유 인원이 그대로다', async () => {
      const { sessionId } = await createTourWithSession(payload, marker, 'validation', { capacity: 50 })
      await submit(sessionId, { partySize: '2' })
      const before = { ...(await sessionSnapshot(payload, sessionId)), occupied: await occupied(sessionId) }
      expect(before.applications).toBe(1)

      const cases: [Parameters<typeof submissionInput>[2], Record<string, string>][] = [
        [{ name: '   ' }, { name: 'NAME_REQUIRED' }],
        [{ phone: '1234567' }, { phone: 'PHONE_INVALID' }],
        [{ partySize: '11' }, { partySize: 'PARTY_SIZE_INVALID' }],
        [{ requests: '창가 자리', requestsConsent: false }, { requests: 'REQUESTS_CONSENT_REQUIRED' }],
        [{ privacyConsent: false }, { privacyConsent: 'PRIVACY_CONSENT_REQUIRED' }],
        [{ ageConfirmed: false }, { ageConfirmed: 'AGE_CONFIRM_REQUIRED' }],
        [{ ageConfirmed: undefined }, { ageConfirmed: 'AGE_CONFIRM_REQUIRED' }],
      ]
      for (const [overrides, fieldErrors] of cases) {
        const result = await submit(sessionId, overrides)
        expect(result).toEqual({ status: 'error', code: 'VALIDATION_FAILED', fieldErrors })
      }

      expect({ ...(await sessionSnapshot(payload, sessionId)), occupied: await occupied(sessionId) }).toEqual(before)
    })

    it('범위를 넘는 회차 식별 값은 DB를 조회하지 않고 SESSION_INVALID다', async () => {
      const result = await submitApplication(payload, submissionInput(0, marker, { session: '99999999999' }), {
        clientIp: ips.next(),
      })
      expect(result).toEqual({
        status: 'error',
        code: 'VALIDATION_FAILED',
        fieldErrors: { session: 'SESSION_INVALID' },
      })
    })
  })

  describe('AC-APPLY-009 정원 확인과 자동 마감(순차)', () => {
    it('정원 4: 3 성공 → 2 자리 부족 → 1 성공·마감 → 1 마감 거부', async () => {
      const { sessionId } = await createTourWithSession(payload, marker, 'sequence', { capacity: 4 })

      const first = await submit(sessionId, { partySize: '3' })
      expect(first.status).toBe('success')
      expect(await sessionSnapshot(payload, sessionId)).toEqual({ status: 'open', applications: 1 })
      expect(await occupied(sessionId)).toBe(3)

      expect(await submit(sessionId, { partySize: '2' })).toEqual({ status: 'error', code: 'CAPACITY_EXCEEDED' })
      expect(await sessionSnapshot(payload, sessionId)).toEqual({ status: 'open', applications: 1 })
      expect(await occupied(sessionId)).toBe(3)

      const third = await submit(sessionId, { partySize: '1' })
      expect(third.status).toBe('success')
      expect(await sessionSnapshot(payload, sessionId)).toEqual({ status: 'closed', applications: 2 })
      expect(await occupied(sessionId)).toBe(4)

      expect(await submit(sessionId, { partySize: '1' })).toEqual({ status: 'error', code: 'SESSION_CLOSED' })
      expect((await sessionSnapshot(payload, sessionId)).applications).toBe(2)

      // 성공한 신청의 저장값: 상태 pending, 접수 번호 형식, 회차
      for (const result of [first, third]) {
        if (result.status !== 'success') throw new Error('expected success')
        expect(result.referenceCode).toMatch(/^SB-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/)
        const doc = await findByReference(result.referenceCode)
        expect(doc.status).toBe('pending')
        expect(doc.session).toBe(sessionId)
      }
    })

    it('하루 전에 시작한 모집 중 회차는 SESSION_STARTED이고 신청이 생기지 않는다', async () => {
      const { sessionId } = await createTourWithSession(payload, marker, 'started', { capacity: 15, startsInDays: -1 })
      expect(await submit(sessionId)).toEqual({ status: 'error', code: 'SESSION_STARTED' })
      expect((await sessionSnapshot(payload, sessionId)).applications).toBe(0)
    })

    it('공개되지 않은 투어의 모집 중 회차는 SESSION_NOT_FOUND이고 신청이 생기지 않는다', async () => {
      const { sessionId } = await createTourWithSession(payload, marker, 'hidden', { capacity: 15, published: false })
      expect(await submit(sessionId)).toEqual({ status: 'error', code: 'SESSION_NOT_FOUND' })
      expect((await sessionSnapshot(payload, sessionId)).applications).toBe(0)
    })

    it('존재하지 않는 회차 ID는 SESSION_NOT_FOUND다', async () => {
      const result = await submitApplication(payload, submissionInput(2147483000, marker), { clientIp: ips.next() })
      expect(result).toEqual({ status: 'error', code: 'SESSION_NOT_FOUND' })
      const strays = await payload.count({ collection: 'applications', where: { session: { equals: 2147483000 } } })
      expect(strays.totalDocs).toBe(0)
    })

    it('롤백: 마감 갱신 뒤·커밋 직전 주입 함수가 예외를 던지면 저장과 마감이 함께 되돌려진다', async () => {
      const { sessionId } = await createTourWithSession(payload, marker, 'rollback', { capacity: 2 })
      const observed: { ran: boolean; status?: string } = { ran: false }

      const result = await submit(
        sessionId,
        { partySize: '2' },
        {
          beforeCommit: async (req: PayloadRequest) => {
            observed.ran = true
            const session = await payload.findByID({ collection: 'tour-sessions', id: sessionId, depth: 0, req })
            observed.status = session.status
            throw new Error('injected failure')
          },
        },
      )

      expect(observed).toEqual({ ran: true, status: 'closed' })
      expect(result).toEqual({ status: 'error', code: 'INTERNAL_ERROR' })
      expect(await sessionSnapshot(payload, sessionId)).toEqual({ status: 'open', applications: 0 })
    })

    it('대조: 주입 함수 없이 같은 제출은 성공하고 회차가 closed가 된다', async () => {
      const { sessionId } = await createTourWithSession(payload, marker, 'rollback-control', { capacity: 2 })
      expect((await submit(sessionId, { partySize: '2' })).status).toBe('success')
      expect(await sessionSnapshot(payload, sessionId)).toEqual({ status: 'closed', applications: 1 })
    })

    it('기본 잠금 대기 제한: 옵션 없이 제출하면 정원 확인 구간 안의 lock_timeout이 5s다', async () => {
      const { sessionId } = await createTourWithSession(payload, marker, 'lock-default', { capacity: 5 })
      let lockTimeout: unknown

      const result = await submit(
        sessionId,
        {},
        {
          beforeCommit: async (req: PayloadRequest) => {
            const db = transactionDb(payload, req.transactionID)
            const { rows } = await db.execute(sql`SELECT current_setting('lock_timeout') AS value`)
            lockTimeout = rows[0]?.value
          },
        },
      )

      expect(result.status).toBe('success')
      expect(lockTimeout).toBe('5s')
    })
  })

  describe('AC-APPLY-014 동의 기록', () => {
    let sessionId: number
    const now = new Date(Date.now())

    beforeAll(async () => {
      ;({ sessionId } = await createTourWithSession(payload, marker, 'consent', { capacity: 50 }))
    })

    it('필수 동의만 한 신청: 동의 일시 = now, 현재 문구 버전, 요청 사항·선택 동의 일시·취소일 비어 있음', async () => {
      const result = await submit(sessionId, {}, { now })
      if (result.status !== 'success') throw new Error(`expected success, got ${result.code}`)
      const doc = await findByReference(result.referenceCode)

      expect(new Date(doc.privacyConsentAt).getTime()).toBe(now.getTime())
      expect(doc.privacyPolicyVersion).toBe(PRIVACY_POLICY_VERSION)
      // 만 14세 이상 확인 일시도 같은 처리 시각이다(2026-11-12 출시 전 보완)
      expect(new Date(doc.ageConfirmedAt as string).getTime()).toBe(now.getTime())
      expect(doc.requests ?? '').toBe('')
      expect(doc.requestsConsentAt ?? null).toBeNull()
      expect(doc.cancelledAt ?? null).toBeNull()
    })

    it('요청 사항과 선택 동의를 함께 한 신청: 요청 사항 저장, 선택 동의 일시 = now', async () => {
      const requests = `${marker}-요청`
      const result = await submit(sessionId, { requests, requestsConsent: true }, { now })
      if (result.status !== 'success') throw new Error(`expected success, got ${result.code}`)
      const doc = await findByReference(result.referenceCode)

      expect(doc.requests).toBe(requests)
      expect(new Date(doc.requestsConsentAt as string).getTime()).toBe(now.getTime())
    })

    it('선택 동의만 체크하고 요청 사항을 비운 신청: 선택 동의 일시가 비어 있다', async () => {
      const result = await submit(sessionId, { requests: '', requestsConsent: true }, { now })
      if (result.status !== 'success') throw new Error(`expected success, got ${result.code}`)
      const doc = await findByReference(result.referenceCode)

      expect(doc.requestsConsentAt ?? null).toBeNull()
    })
  })
})
