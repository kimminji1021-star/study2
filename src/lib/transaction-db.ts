// 원시 SQL 실행 지점 — SPEC-APPLY-001 plan.md §B.1·§B.2.
// Payload의 Postgres 어댑터가 쥔 drizzle 인스턴스(트랜잭션 밖, 연결 풀)와 트랜잭션별 연결을 꺼낸다.
// drizzle-orm은 직접 의존성이 아니므로 import하지 않고(plan.md §D), 필요한 모양만 여기서 좁게 정의한다.
import type { sql } from '@payloadcms/db-postgres'
import type { Payload, PayloadRequest } from 'payload'

export type SqlQuery = ReturnType<typeof sql>
export type SqlRow = Record<string, unknown>
export type SqlExecutor = { execute: (query: SqlQuery) => Promise<{ rows: SqlRow[] }> }

type PostgresAdapterView = {
  drizzle: SqlExecutor
  sessions: Record<string, { db: SqlExecutor } | undefined>
}

function adapter(payload: Payload): PostgresAdapterView {
  return payload.db as unknown as PostgresAdapterView
}

/** 트랜잭션 밖 질의(연결 풀의 pool.query로 나간다). 화면용 집계가 쓴다. */
export function poolDb(payload: Payload): SqlExecutor {
  return adapter(payload).drizzle
}

/**
 * 진행 중인 트랜잭션의 연결. 정원 확인 구간의 모든 원시 SQL은 이 연결로만 실행해야 한다 —
 * 풀에서 새 연결을 얻으면 잠금을 기다리는 트랜잭션들이 풀을 다 차지했을 때 서로를 기다리며 멈춘다(plan.md R2).
 * 트랜잭션이 이미 끝났으면(안쪽 작업 실패로 롤백됨 등) 다른 연결로 새지 않도록 예외를 던진다.
 */
export function transactionDb(payload: Payload, transactionID: PayloadRequest['transactionID'] | null): SqlExecutor {
  const session =
    typeof transactionID === 'string' || typeof transactionID === 'number'
      ? adapter(payload).sessions[String(transactionID)]
      : undefined
  if (session === undefined) throw new Error('Transaction is not active.')
  return session.db
}
