import 'server-only'

export const support = () => process.env.SUPPORT_EMAIL?.trim()
export function bookingOpen() {
  if (process.env.BOOKING_ENABLED !== 'true') return false
  const opens = process.env.BOOKING_OPENS_AT
  const closes = process.env.BOOKING_CLOSES_AT
  const now = Date.now()
  return (!opens || (hasZone(opens) && now >= Date.parse(opens))) && (!closes || (hasZone(closes) && now < Date.parse(closes)))
}
const hasZone = (value: string) => /(?:Z|[+-]\d{2}:\d{2})$/i.test(value)

export function appOrigin(request?: Request) {
  const configured = process.env.APP_BASE_URL
  if (!configured) throw new Error('Set APP_BASE_URL.')
  const url = new URL(configured)
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Live deployments require HTTPS.')
  return url.origin
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return false
  return origin === appOrigin(request) && request.headers.get('sec-fetch-site') !== 'cross-site'
}
