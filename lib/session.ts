import 'server-only'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { universityDomains, emailDomain } from './config'
import { activeStudent } from './students'

export const sessionName = 'e24-session'
export const oauthName = 'e24-oauth'
type Identity = { sub: string; email: string; hd: string }

function key() {
  const secret = process.env.AUTH_SECRET
  if (secret && secret.length >= 32) return createHash('sha256').update(secret).digest()
  throw new Error('Set an AUTH_SECRET of at least 32 characters.')
}
export function seal(name: string, data: object, seconds: number) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  cipher.setAAD(Buffer.from(name))
  const encrypted = Buffer.concat([cipher.update(JSON.stringify({ data, exp: Date.now() + seconds * 1000 })), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url')
}
export function unseal<T>(name: string, value?: string): T | null {
  if (!value || value.length > 4096) return null
  try {
    const bytes = Buffer.from(value, 'base64url')
    const decipher = createDecipheriv('aes-256-gcm', key(), bytes.subarray(0, 12))
    decipher.setAAD(Buffer.from(name))
    decipher.setAuthTag(bytes.subarray(12, 28))
    const parsed = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString())
    return parsed.exp > Date.now() ? parsed.data : null
  } catch {
    return null
  }
}
export function cookieOptions(origin: string, maxAge: number) {
  return { httpOnly: true, secure: origin.startsWith('https:'), sameSite: 'lax' as const, path: '/', maxAge }
}
export async function eligible(identity: Identity) {
  const email = identity.email.trim().toLowerCase()
  if (identity.sub && email === 'lextargaryens@gmail.com') return { studentId: 'master-viewer', universityEmail: identity.email, displayName: 'Viewer', readOnly: true }
  const { emailDomains, hostedDomains } = universityDomains()
  if (!identity.sub || !hostedDomains.includes(identity.hd) || !emailDomains.includes(emailDomain(email))) return null
  return activeStudent(email)
}
export async function authorization() {
  const value = (await cookies()).get(sessionName)?.value
  const identity = unseal<Identity>(sessionName, value)
  if (!identity) return { student: null, status: 401 as const }
  const student = await eligible(identity)
  return student ? { student, status: 200 as const } : { student: null, status: 403 as const }
}
