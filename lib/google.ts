import 'server-only'
import { createHash, randomBytes, createPublicKey, verify, timingSafeEqual } from 'node:crypto'

// Google's documented OIDC endpoints. Only trust keys from Google's fixed JWKS URL.
const authorizationEndpoint = 'https://accounts.google.com/o/oauth2/v2/auth'
const tokenEndpoint = 'https://oauth2.googleapis.com/token'
const jwksEndpoint = 'https://www.googleapis.com/oauth2/v3/certs'
export type OAuthFlow = { state: string; nonce: string; verifier: string }
const random = () => randomBytes(32).toString('base64url')
const callback = (origin: string) => new URL('/api/auth/callback', origin).href
const clientId = () => {
  if (!process.env.AUTH_GOOGLE_ID) throw new Error('Configure Google sign-in.')
  return process.env.AUTH_GOOGLE_ID
}
export function beginGoogle(origin: string, hostedDomain?: string) {
  const flow = { state: random(), nonce: random(), verifier: random() }
  const url = new URL(authorizationEndpoint)
  url.search = new URLSearchParams({
    client_id: clientId(), redirect_uri: callback(origin), response_type: 'code',
    scope: 'openid email profile', prompt: 'select_account', state: flow.state, nonce: flow.nonce,
    code_challenge_method: 'S256', code_challenge: createHash('sha256').update(flow.verifier).digest('base64url'),
    ...(hostedDomain ? { hd: hostedDomain } : {}),
  }).toString()
  return { flow, url }
}
function matches(actual: string | null, expected: string) {
  return actual !== null && Buffer.byteLength(actual) === Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
}
export async function finishGoogle(params: URLSearchParams, flow: OAuthFlow, origin: string) {
  const code = params.get('code')
  const secret = process.env.AUTH_GOOGLE_SECRET
  if (!code || params.has('error') || !matches(params.get('state'), flow.state) || !secret) throw new Error('Invalid authorization response.')
  const exchange = await fetch(tokenEndpoint, {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(10_000),
    body: new URLSearchParams({ code, client_id: clientId(), client_secret: secret,
      redirect_uri: callback(origin), grant_type: 'authorization_code', code_verifier: flow.verifier }),
  })
  if (!exchange.ok) throw new Error('Google token exchange failed.')
  const token = (await exchange.json()).id_token
  if (typeof token !== 'string' || token.length > 16384) throw new Error('Missing ID token.')
  const parts = token.split('.')
  if (parts.length !== 3 || !parts.every(part => /^[\w-]+$/.test(part))) throw new Error('Malformed ID token.')
  const [headerPart, payloadPart, signature] = parts
  const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString())
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error('Invalid signing algorithm.')
  const keysResponse = await fetch(jwksEndpoint, { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
  if (!keysResponse.ok) throw new Error('Google signing keys unavailable.')
  const { keys } = await keysResponse.json()
  const jwk = keys.find((key: { kid: string; kty: string; alg?: string; use?: string }) => key.kid === header.kid && key.kty === 'RSA' && (!key.alg || key.alg === 'RS256') && (!key.use || key.use === 'sig'))
  if (!jwk || !verify('RSA-SHA256', Buffer.from(headerPart + '.' + payloadPart), createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(signature, 'base64url'))) throw new Error('Invalid signature.')
  const claims = JSON.parse(Buffer.from(payloadPart, 'base64url').toString())
  const now = Math.floor(Date.now() / 1000)
  if (!['https://accounts.google.com', 'accounts.google.com'].includes(claims.iss) ||
    claims.aud !== clientId() || (claims.azp && claims.azp !== clientId()) ||
    !Number.isFinite(claims.exp) || claims.exp <= now || !Number.isFinite(claims.iat) || claims.iat > now + 60 ||
    (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > now)) ||
    typeof claims.nonce !== 'string' || !matches(claims.nonce, flow.nonce) ||
    claims.email_verified !== true || typeof claims.email !== 'string' || (claims.hd !== undefined && typeof claims.hd !== 'string') ||
    typeof claims.sub !== 'string' || !claims.sub) throw new Error('Account is ineligible or the token is invalid.')
  return { sub: claims.sub, email: claims.email.trim().toLowerCase(), hd: (claims.hd ?? '').trim().toLowerCase() }
}
