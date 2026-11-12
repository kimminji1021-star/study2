// AC-INFRA-006(통합 부분) — Payload 로컬 API로 실제 DB(DATABASE_URL)에 연결해 Users 컬렉션의 인증 흐름을 확인한다.
// 테스트가 만든 레코드는 성공·실패와 상관없이 afterAll에서 지운다(spec.md 가정 A3).
import { randomUUID } from 'node:crypto'

import { AuthenticationError, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '../../src/payload.config'

// 다른 실행이나 개발 데이터와 겹치지 않도록 실행마다 고유한 주소를 쓴다(.test는 예약된 최상위 도메인)
const email = `integration-${randomUUID()}@example.test`
const password = `pw-${randomUUID()}`

let payload: Payload

describe('Users 컬렉션 인증(Payload 로컬 API, 실제 DB)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  afterAll(async () => {
    if (payload === undefined) return
    try {
      await payload.delete({ collection: 'users', where: { email: { equals: email } } })
    } finally {
      await payload.destroy()
    }
  })

  it('등록된 컬렉션에서 Payload 시스템 컬렉션을 빼면 users·media·tours·tour-sessions·applications·application-attempts뿐이다', () => {
    // Payload는 설정에 없는 시스템 컬렉션(payload-preferences, payload-migrations, payload-locked-documents 등)을
    // 스스로 추가한다. 이 컬렉션들은 slug가 모두 `payload-`로 시작하므로 그 접두어로 걸러 낸 뒤 비교한다.
    // SPEC-APPLY-001 REQ-APPLY-002 / AC-APPLY-001: 정렬 후 정확히 여섯 개(SPEC-TOUR-001 REQ-TOUR-004의 목록을 대체).
    const slugs = payload.config.collections.map((collection) => collection.slug)
    const appSlugs = slugs.filter((slug) => !slug.startsWith('payload-'))

    expect(slugs.length).toBeGreaterThan(appSlugs.length)
    expect([...appSlugs].sort()).toEqual([
      'application-attempts',
      'applications',
      'media',
      'tour-sessions',
      'tours',
      'users',
    ])
  })

  it('Users 레코드를 만들 수 있다', async () => {
    const user = await payload.create({ collection: 'users', data: { email, password } })

    expect(user.email).toBe(email)
    expect(user).not.toHaveProperty('password')
  })

  it('올바른 비밀번호로 로그인하면 토큰을 받는다', async () => {
    const result = await payload.login({ collection: 'users', data: { email, password } })

    expect(typeof result.token).toBe('string')
    expect(result.token?.length ?? 0).toBeGreaterThan(0)
    expect(result.user?.email).toBe(email)
  })

  it('틀린 비밀번호로 로그인하면 인증 오류가 나고 토큰을 받지 못한다', async () => {
    let result: Awaited<ReturnType<Payload['login']>> | undefined
    let error: unknown

    try {
      result = await payload.login({
        collection: 'users',
        data: { email, password: `${password}-wrong` },
      })
    } catch (caught) {
      error = caught
    }

    expect(error).toBeInstanceOf(AuthenticationError)
    expect(result?.token).toBeUndefined()
  })

  it('만든 레코드를 지우면 더 이상 조회되지 않는다', async () => {
    const deleted = await payload.delete({ collection: 'users', where: { email: { equals: email } } })
    expect(deleted.docs).toHaveLength(1)

    const remaining = await payload.count({ collection: 'users', where: { email: { equals: email } } })
    expect(remaining.totalDocs).toBe(0)
  })
})
