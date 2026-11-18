// 로그의 질의 바인딩 값 가림 — SPEC-DEPLOY-001 REQ-DEPLOY-011, plan.md §B.6 (SPEC-ADMIN-001 R23).
// Drizzle의 DrizzleQueryError는 문구에 `Failed query: <SQL>\nparams: <값들>`을 넣고 params 속성도 가지며, 원인인 PostgreSQL
// 오류의 detail에는 행 값(`Failing row contains (…)`)이 실린다. Payload 기본 로거는 이것을 그대로 기록하므로 신청자 정보가 남는다.
// Payload 설정의 로거(pino)에 두 가지를 건다: 오류 직렬화(err)와, 문자열 메시지(msg)를 바꾸는 logMethod 훅.
// SQL 문 자체와 오류 이름·SQLSTATE 코드는 원인 파악을 위해 남긴다.
import type { Config } from 'payload'

type LoggerSetting = Extract<NonNullable<Config['logger']>, { options: unknown }>
type LoggerOptions = LoggerSetting['options']
type LogMethodHook = NonNullable<NonNullable<LoggerOptions['hooks']>['logMethod']>

const REDACTED = '[REDACTED]'
// 지우는 속성: params(바인딩 값 배열), detail(PostgreSQL이 실패한 행 값을 담는 칸)
const DROPPED_KEYS: ReadonlySet<string> = new Set(['params', 'detail'])
// cause가 깊게 이어진 오류도 끝없이 따라가지 않는다
const MAX_DEPTH = 8

// 줄 머리의 `params:`부터 다음 호출 위치 줄(`    at …`) 전까지, 없으면 끝까지를 가린다.
// 값에 줄바꿈이 있어도(요청 사항 등) 스택의 호출 위치 줄 앞에서 멈춘다
const PARAMS_SEGMENT = /(^|\n)params:[\s\S]*?(?=\n\s+at\s|$)/g

/** 문자열 속 `params:` 이후(바인딩 값)를 고정 표시로 바꾼다. */
export function redactParamsText(text: string): string {
  return text.replace(PARAMS_SEGMENT, `$1params: ${REDACTED}`)
}

function redactValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') return redactParamsText(value)
  if (value === null || typeof value !== 'object') return value
  if (seen.has(value)) return '[Circular]'
  if (depth >= MAX_DEPTH) return '[Truncated]'
  seen.add(value)

  if (Array.isArray(value)) return value.map((item) => redactValue(item, depth + 1, seen))

  const result: Record<string, unknown> = {}
  if (value instanceof Error) {
    // pino 기본 오류 직렬화와 같은 칸 이름(type·message·stack). message·stack·cause는 열거되지 않는 속성이라 따로 옮긴다
    result.type = value.constructor.name
    result.message = redactParamsText(value.message)
    if (value.stack !== undefined) result.stack = redactParamsText(value.stack)
    if (value.name !== 'Error' && value.name !== result.type) result.name = value.name
  }
  for (const [key, item] of Object.entries(value)) {
    if (DROPPED_KEYS.has(key)) continue
    result[key] = redactValue(item, depth + 1, seen)
  }
  if (value instanceof Error && value.cause !== undefined && !('cause' in result)) {
    result.cause = redactValue(value.cause, depth + 1, seen)
  }
  return result
}

// @MX:NOTE: [AUTO] 오류 로그 가림의 핵심 — params·detail 속성을 지우고, 모든 문자열의 `params:` 이후를 [REDACTED]로 바꾸며, cause를 따라 내려간다.
//   SQL 문(query)·오류 이름·code(SQLSTATE)·제약 이름은 남긴다. Payload 설정의 로거만 덮는다 — console.error 직접 출력과
//   payload migrate 같은 명령줄 도구의 자체 로거는 범위 밖(plan.md §B.6, R18)
/** pino `err` 직렬화. 오류가 아닌 객체도 같은 규칙으로 가리고, 객체가 아닌 값은 문자열 가림만 한다. */
export function redactErrorForLog(err: unknown): unknown {
  return redactValue(err, 0, new WeakSet())
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Error)
}

/** 첫 인자(병합 객체)의 msg 문자열과 err 외 오류 값을 가린다. err만 있고 메시지가 없으면 pino가 err.message를 쓰므로 가린 문구를 넣어 둔다. */
function redactMergeObject(object: Record<string, unknown>, hasMessageArgument: boolean): Record<string, unknown> {
  const copy: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(object)) {
    if (key === 'err') copy[key] = value
    else if (typeof value === 'string') copy[key] = redactParamsText(value)
    else if (value instanceof Error) copy[key] = redactErrorForLog(value)
    else copy[key] = value
  }
  if (!hasMessageArgument && copy.msg === undefined && object.err instanceof Error) {
    copy.msg = redactParamsText(object.err.message)
  }
  return copy
}

/** 로그 메서드에 넘어온 인자 목록을 가린다(pino hooks.logMethod용). */
export function redactLogArguments(args: readonly unknown[]): unknown[] {
  const [first, ...rest] = args
  // 나머지 인자는 메시지 문자열과 printf 형식 값(%s·%o 등)이다
  const redactedRest = rest.map((item) =>
    typeof item === 'string' ? redactParamsText(item) : item instanceof Error ? redactErrorForLog(item) : item,
  )
  const hasMessageArgument = typeof rest[0] === 'string'

  if (first instanceof Error) {
    // pino는 첫 인자가 오류이면 err.message를 메시지로 쓴다 — 가린 문구를 직접 넘긴다
    return [{ err: first }, ...(hasMessageArgument ? redactedRest : [redactParamsText(first.message), ...redactedRest])]
  }
  if (typeof first === 'string') return [redactParamsText(first), ...redactedRest]
  if (isPlainObject(first)) return [redactMergeObject(first, hasMessageArgument), ...redactedRest]
  return [first, ...redactedRest]
}

const logMethod: LogMethodHook = function (this: unknown, inputArgs, method) {
  return method.apply(this, redactLogArguments(inputArgs) as Parameters<typeof method>)
}

// @MX:ANCHOR: [AUTO] Payload 설정의 로거 옵션 단일 지점 — payload.config.ts가 쓰고, 단위·통합 테스트가 같은 옵션으로 메모리 로거를 만든다
// @MX:REASON: 여기서 serializers.err나 hooks.logMethod가 빠지면 DB 오류 로그에 신청자 이름·이메일·연락처가 다시 남는다(REQ-DEPLOY-011)
/** Payload `logger.options`로 넘길 pino 옵션. 부를 때마다 새 객체를 만든다(Payload가 name·enabled를 채워 넣는다). */
export function redactingLoggerOptions(): LoggerOptions {
  return {
    serializers: { err: redactErrorForLog },
    hooks: { logMethod },
  }
}
