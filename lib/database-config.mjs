import { supabaseRootCA } from './supabase-root-ca.mjs'

export function databaseConfig(maintenance = false, env = process.env) {
  const raw = (maintenance && env.DATABASE_DIRECT_URL) || env.DATABASE_URL ||
    (maintenance && env.POSTGRES_URL_NON_POOLING) || env.POSTGRES_URL
  if (!raw) throw new Error('Configure DATABASE_URL or connect the Supabase Postgres integration.')
  let url
  try { url = new URL(raw) } catch { throw new Error('The configured PostgreSQL connection URL is invalid.') }
  if (!['postgresql:', 'postgres:'].includes(url.protocol) || !url.hostname) throw new Error('Expected a PostgreSQL connection URL with a hostname.')
  if (url.hostname.endsWith('.pooler.supabase.com') || /^db\.[\w-]+\.supabase\.co$/.test(url.hostname)) {
    // pg parses sslmode after the SSL object. Remove it so the verified CA is not discarded.
    if (!['sslrootcert', 'sslcert', 'sslkey'].some(key => url.searchParams.has(key))) {
      url.searchParams.delete('sslmode')
      url.searchParams.delete('ssl')
      return { connectionString: url.href, ssl: { ca: supabaseRootCA, rejectUnauthorized: true } }
    }
    url.searchParams.set('sslmode', 'verify-full')
  }
  return { connectionString: url.href }
}
