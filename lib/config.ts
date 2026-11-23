import 'server-only'

export type Student = { studentId: string; universityEmail: string; displayName: string; readOnly?: boolean }
export const support = () => process.env.SUPPORT_EMAIL?.trim()
export const domains = (key: string) => (process.env[key] ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
export const emailDomain = (email: string) => email.split('@')[1]
const validDomain = (domain: string) => /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(domain) && !/\.(?:invalid|example|test|localhost)$/.test(domain) && !/^(?:example\.(?:com|org|net)|gmail\.com|googlemail\.com)$/.test(domain)
let liveRoster: Student[] | undefined
export function roster(): Student[] {
  if (liveRoster) return liveRoster
  const emailDomains = domains('UNIVERSITY_EMAIL_DOMAINS')
  const hostedDomains = domains('UNIVERSITY_HOSTED_DOMAINS')
  if (!emailDomains.length || !hostedDomains.length || ![...emailDomains, ...hostedDomains].every(validDomain)) throw new Error('Configure the verified university domains.')
  const entries: unknown = JSON.parse(process.env.ELIGIBLE_STUDENTS_JSON ?? '[]')
  if (!Array.isArray(entries) || !entries.length) throw new Error('Configure the private roster.')
  const ids = new Set<string>()
  const emails = new Set<string>()
  liveRoster = entries.map((row: Partial<Student> | null) => {
    const studentId = typeof row?.studentId === 'string' ? row.studentId.trim() : ''
    const universityEmail = typeof row?.universityEmail === 'string' ? row.universityEmail.trim().toLowerCase() : ''
    const displayName = typeof row?.displayName === 'string' ? row.displayName.trim() : ''
    if (!/^[\w./-]{1,80}$/.test(studentId) || /^demo-/i.test(studentId) || !displayName || displayName.length > 120 ||
      !/^[^\s@]+@[^\s@]+$/.test(universityEmail) || !emailDomains.includes(emailDomain(universityEmail)) ||
      ids.has(studentId) || emails.has(universityEmail)) throw new Error('The private roster contains an invalid or duplicate entry.')
    ids.add(studentId)
    emails.add(universityEmail)
    return { studentId, universityEmail, displayName }
  })
  return liveRoster
}
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
  const url = new URL(configured || request!.url)
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Live deployments require HTTPS.')
  return url.origin
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return false
  return origin === appOrigin(request) && request.headers.get('sec-fetch-site') !== 'cross-site'
}
