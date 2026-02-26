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
