import 'server-only'

type SupabaseTable = 'eligible_students' | 'rooms' | 'bookings'

function requestUrl(table: SupabaseTable, query?: Record<string, string>) {
  const baseUrl = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!baseUrl || !key) throw new Error('Supabase server configuration is unavailable.')

  const url = new URL(`/rest/v1/${table}`, baseUrl)
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error('Supabase must use HTTPS.')
  }
  for (const [name, value] of Object.entries(query ?? {})) url.searchParams.set(name, value)
  return { url, key }
}

function headers(key: string) {
  return { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' }
}

export async function selectRows<T>(table: SupabaseTable, query: Record<string, string>): Promise<T[]> {
  const { url, key } = requestUrl(table, query)
  const response = await fetch(url, {
    headers: headers(key),
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  })
  if (!response.ok) throw new Error('Supabase query failed.')

  const rows: unknown = await response.json()
  if (!Array.isArray(rows)) throw new Error('Supabase returned an invalid response.')
  return rows as T[]
}

export async function insertRows<T>(table: SupabaseTable, values: Record<string, unknown>): Promise<T[] | null> {
  const { url, key } = requestUrl(table)
  const response = await fetch(url, {
    method: 'POST',
    headers: { ...headers(key), 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(values),
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  })
  if (response.status === 409) return null
  if (!response.ok) throw new Error('Supabase insert failed.')

  const rows: unknown = await response.json()
  if (!Array.isArray(rows)) throw new Error('Supabase returned an invalid response.')
  return rows as T[]
}
