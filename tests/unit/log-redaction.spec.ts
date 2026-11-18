// SPEC-DEPLOY-001 M4 단위 테스트 — 로그의 질의 바인딩 값 가림(AC-DEPLOY-011 단위 부분, plan.md §B.6).
// Payload가 쓰는 것과 같은 pino(payload 패키지가 끌어오는 설치본)로 메모리 출력 로거를 만들어, 가림 옵션을 거친
// 실제 기록 줄에 표식이 없는지 본다. pino는 이 저장소의 직접 의존성이 아니므로 payload 위치에서 불러온다.
import { randomBytes } from 'node:crypto'
import { realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { redactErrorForLog, redactingLoggerOptions, redactParamsText } from '../../src/lib/log-redaction'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const requireFromPayload = createRequire(realpathSync(path.join(repoRoot, 'node_modules', 'payload', 'package.json')))

type MemoryLogger = Record<'info' | 'warn' | 'error', (...args: unknown[]) => void>
type PinoFactory = (options: object, stream: { write(line: string): void }) => MemoryLogger
const pino = (requireFromPayload('pino') as { pino: PinoFactory }).pino

const marker = `test-${randomBytes(6).toString('hex')}@example.test`

function memoryLogger(): { logger: MemoryLogger; output: () => string } {
  const lines: string[] = []
  const logger = pino(redactingLoggerOptions(), { write: (line: string) => void lines.push(line) })
  return { logger, output: () => lines.join('') }
}

/** drizzle-orm DrizzleQueryError와 같은 모양의 오류(문구에 params, params 속성, pg 오류 cause). */
function fakeDrizzleError(value: string): Error {
  const cause = Object.assign(new Error('null value in column "attempted_at" violates not-null constraint'), {
    code: '23502',
    detail: `Failing row contains (1, ${value}, null).`,
    table: 'application_attempts',
  })
  const query = 'insert into "application_attempts" ("key_hash", "attempted_at") values ($1, $2)'
  const error = new Error(`Failed query: ${query}\nparams: ${value},`) as Error & {
    query: string
    params: unknown[]
  }
  error.query = query
  error.params = [value, null]
  error.cause = cause
  return error
}

describe('AC-DEPLOY-011 문자열 가림', () => {
  it('params: 이후를 고정 표시로 바꾸고 앞부분(SQL)은 남긴다', () => {
    expect(redactParamsText(`Failed query: select 1\nparams: ${marker},x`)).toBe(
      'Failed query: select 1\nparams: [REDACTED]',
    )
  })

  it('스택에서는 params: 부분만 가리고 호출 위치 줄은 남긴다', () => {
    const stack = `Error: Failed query: select 1\nparams: ${marker}\nsecond-line-${marker}\n    at run (file.js:1:1)\n    at main (file.js:2:2)`
    const redacted = redactParamsText(stack)
    expect(redacted).not.toContain(marker)
    expect(redacted).toBe(
      'Error: Failed query: select 1\nparams: [REDACTED]\n    at run (file.js:1:1)\n    at main (file.js:2:2)',
    )
  })

  it('params:가 없는 문자열은 그대로 둔다', () => {
    expect(redactParamsText('duplicate key value violates unique constraint')).toBe(
      'duplicate key value violates unique constraint',
    )
  })
})

describe('AC-DEPLOY-011 오류 직렬화 가림', () => {
  it('params·detail을 지우고 문구·스택·cause를 가리며 이름·code·SQL 문은 남긴다', () => {
    const serialized = JSON.stringify(redactErrorForLog(fakeDrizzleError(marker)))

    expect(serialized).not.toContain(marker)
    expect(serialized).toContain('Failed query: insert into \\"application_attempts\\"')
    expect(serialized).toContain('"code":"23502"')
    expect(serialized).toContain('"query":')
    expect(serialized).toContain('"type":"Error"')
    expect(serialized).toContain('null value in column')
    expect(serialized).not.toContain('"params"')
    expect(serialized).not.toContain('"detail"')
  })

  it('중첩 cause 안의 DrizzleQueryError도 가린다', () => {
    const outer = new Error('Error: cannot begin transaction', { cause: fakeDrizzleError(marker) })
    const serialized = JSON.stringify(redactErrorForLog(outer))

    expect(serialized).not.toContain(marker)
    expect(serialized).toContain('cannot begin transaction')
    expect(serialized).toContain('params: [REDACTED]')
  })

  it('순환 참조와 깊은 중첩에서도 멈춘다', () => {
    const error = new Error('loop') as Error & { self?: unknown }
    error.self = error
    let deep: Error = fakeDrizzleError(marker)
    for (let index = 0; index < 20; index += 1) deep = new Error(`level ${index}`, { cause: deep })

    expect(() => JSON.stringify(redactErrorForLog(error))).not.toThrow()
    expect(JSON.stringify(redactErrorForLog(deep))).not.toContain(marker)
  })

  it('오류가 아닌 값은 그대로 돌려준다', () => {
    expect(redactErrorForLog(undefined)).toBeUndefined()
    expect(redactErrorForLog('plain')).toBe('plain')
  })
})

describe('AC-DEPLOY-011 실제 pino 기록(메모리 출력)', () => {
  it('{ err } 기록(Payload logError 형태): 출력에 표식이 없고 SQL 문은 남는다', () => {
    const { logger, output } = memoryLogger()
    logger.error({ err: fakeDrizzleError(marker) })

    expect(output()).not.toBe('')
    expect(output()).not.toContain(marker)
    expect(output()).toContain('Failed query: insert into')
  })

  it('문자열 인자 msg(Drizzle의 err.message 이어 붙이기 경로)에서 표식이 없고 앞부분은 남는다', () => {
    const { logger, output } = memoryLogger()
    logger.error(`Error: Failed query: select 1\nparams: ${marker}`)

    const line = JSON.parse(output()) as { msg: string }
    expect(line.msg).not.toContain(marker)
    expect(line.msg).toContain('Failed query: select 1')
  })

  it('객체의 msg 속성과 err를 함께 넘긴 기록(beginTransaction·migrate 경로)도 가린다', () => {
    const { logger, output } = memoryLogger()
    const error = fakeDrizzleError(marker)
    logger.error({ err: error, msg: `Error running migration x ${error.message}.` })

    expect(output()).not.toContain(marker)
    expect(output()).toContain('Error running migration x Failed query:')
  })

  it('오류 객체를 첫 인자로 넘기거나 형식 인자로 넘겨도 가린다', () => {
    const { logger, output } = memoryLogger()
    logger.error(fakeDrizzleError(marker))
    logger.warn({ error: fakeDrizzleError(marker) }, 'nested %s', `params: ${marker}`)
    logger.info('format %o', fakeDrizzleError(marker))

    expect(output().split('\n').filter(Boolean)).toHaveLength(3)
    expect(output()).not.toContain(marker)
  })

  it('표식이 없는 일반 기록은 바뀌지 않는다', () => {
    const { logger, output } = memoryLogger()
    logger.info({ count: 2 }, 'cleanup done')

    expect(JSON.parse(output())).toMatchObject({ count: 2, msg: 'cleanup done' })
  })
})
