/**
 * Drizzle ORM database client.
 * Single instance, shared across the application.
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../utils/env.js'

// Create the postgres connection pool
const connection = postgres(env.DATABASE_URL, {
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10,
})

export const db = drizzle(connection)
export type Database = typeof db

export { connection }

/**
 * Typed query wrapper — normalises drizzle's execute() return to { rows: Row[] }.
 * Drizzle with postgres-js returns a RowList (array-like) not { rows: [] }.
 */
export async function query<T = Record<string, unknown>>(
  statement: Parameters<typeof db.execute>[0]
): Promise<{ rows: T[] }> {
  const result = await db.execute(statement)
  return { rows: Array.from(result) as T[] }
}

/**
 * Parameterized raw query for dynamic SQL (dynamic UPDATEs/INSERTs with variable fields).
 * Uses postgres-js's unsafe() which supports $N placeholders with a values array.
 * Field names MUST be compile-time constants — never pass user input as field names.
 */
export async function unsafeQuery<T = Record<string, unknown>>(
  rawSql: string,
  params: unknown[] = []
): Promise<{ rows: T[] }> {
  const result = await connection.unsafe(rawSql, params as Parameters<typeof connection.unsafe>[1])
  return { rows: Array.from(result) as T[] }
}

/**
 * Execute multiple operations inside a single database transaction.
 *
 * The callback receives a transaction-scoped SQL instance.  All queries
 * inside the callback run atomically: if any query throws, the entire
 * transaction is rolled back automatically.
 *
 * Usage:
 * ```ts
 * await withTransaction(async (txn) => {
 *   await txn`INSERT INTO foo VALUES (${val1})`
 *   await txn`UPDATE bar SET x = ${val2} WHERE id = ${id}`
 * })
 * ```
 *
 * Note: postgres.js defines `TransactionSql` via `Omit<Sql, ...>` which
 * causes TypeScript to lose the tagged-template call signature.  We type the
 * callback as `(txn: ReturnType<typeof postgres>) => Promise<T>` (i.e. the
 * full `Sql` type) so callers can use template literal syntax normally.
 * The internal cast is safe because `TransactionSql` is structurally a
 * subset of `Sql`.
 */
export async function withTransaction<T>(
  fn: (txn: ReturnType<typeof postgres>) => Promise<T>
): Promise<T> {
  // postgres.js TransactionSql is structurally compatible with Sql at runtime;
  // the TypeScript definitions just don't reflect the call signature through Omit.
  return connection.begin(
    fn as unknown as (sql: postgres.TransactionSql) => Promise<T>
  ) as Promise<T>
}
