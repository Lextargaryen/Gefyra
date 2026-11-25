import 'server-only'
import { Pool } from 'pg'
import { databaseConfig } from './database-config.mjs'

const database = globalThis as typeof globalThis & { e24Pool?: Pool }
export function pool() {
  if (!database.e24Pool) {
    database.e24Pool = new Pool({ ...databaseConfig(), max: 5, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 5_000 })
    database.e24Pool.on('error', () => console.error('An idle database connection was lost.'))
  }
  return database.e24Pool
}
