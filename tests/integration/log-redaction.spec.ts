// SPEC-DEPLOY-001 M4 통합 테스트 — 실제 PostgreSQL 질의 오류의 로그 가림(AC-DEPLOY-011 통합 부분, plan.md §B.6).
// 표식 값을 바인딩한 질의를 NOT NULL 제약 위반으로 실패시켜 drizzle-orm의 DrizzleQueryError(문구·params·cause.detail에
// 표식이 실린 오류)를 얻고, Payload 설정의 로거 옵션으로 만든 메모리 출력 로거를 Payload의 logError에 넘겨 출력을 본다.
// 질의는 제약 위반으로 실패하므로 행이 남지 않는다. pino는 payload 패키지 위치에서 불러온다(직접 의존성 아님).
import { randomBytes } from 'node:crypto'
import { realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

import { sql } from '@payloadcms/db-postgres'
import { getPayload, logError, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { redactErrorForLog } from '../../src/lib/log-redaction'
import config from '../../src/payload.config'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const requireFromPayload = createRequire(realpathSync(path.join(repoRoot, 'node_modules', 'payload', 'package.json')))
type PinoFactory = (options: object, stream: { write(line: string): void }) => Payload['logger']
const pino = (requireFromPayload('pino') as { pino: PinoFactory }).pino

const marker = `test-${randomBytes(6).toString('hex')}@example.test`
let payload: Payload

type LoggerSetting = { options: object }

/** 표식을 바인딩한 질의를 NOT NULL 위반으로 실패시켜 실제 DB 오류를 얻는다. */
async function realQueryError(): Promise<unknown> {
  try {
    await payload.db.drizzle.execute(
      sql`insert into application_attempts (key_hash, attempted_at, updated_at, created_at) values (${marker}, null, now(), now())`,
    )
  } catch (error) {
    return error
  }
  throw new Error('질의가 실패해야 한다')
}

beforeAll(async () => {
  payload = await getPayload({ config })
})

describe('AC-DEPLOY-011 실제 DB 오류의 로그 가림', () => {
  it('준비: 실제 오류의 문구·params·cause.detail에 표식이 있다(가리지 않으면 새는 값)', async () => {
    const error = (await realQueryError()) as Error & { params?: unknown[]; cause?: { detail?: string; code?: string } }

    expect(error.message).toContain(marker)
    expect(error.params).toContain(marker)
    expect(error.cause?.code).toBe('23502')
    expect(error.cause?.detail ?? '').toContain(marker)
  })

  it('Payload 설정의 로거 옵션으로 만든 로거에 logError로 넘기면 출력에 표식이 0회이고 SQL 문은 남는다', async () => {
    const resolved = await config
    const setting = resolved.logger as LoggerSetting
    expect(typeof setting).toBe('object')
    expect(setting.options).toBeTypeOf('object')

    const lines: string[] = []
    const logger = pino({ ...setting.options }, { write: (line: string) => void lines.push(line) })
    const error = await realQueryError()

    logError({ err: error, payload: { config: resolved, logger } as unknown as Payload })
    // Drizzle이 err.message를 문구에 이어 붙여 기록하는 경로(beginTransaction·migrate)도 같은 로거로 확인한다
    logger.error({ err: error, msg: `Error: cannot begin transaction: ${(error as Error).message}` })

    const output = lines.join('')
    expect(output).not.toBe('')
    expect(output.split(marker)).toHaveLength(1)
    expect(output).toContain('insert into application_attempts')
    expect(output).toContain('23502')
  })

  it('실행 중인 Payload 인스턴스의 로거도 같은 가림 옵션으로 만들어졌다', () => {
    const serializers = (payload.logger as unknown as Record<symbol, unknown>)[
      Object.getOwnPropertySymbols(payload.logger).find((symbol) => symbol.description === 'pino.serializers') ??
        Symbol('missing')
    ] as Record<string, unknown> | undefined

    expect(serializers?.err).toBe(redactErrorForLog)
  })
})
