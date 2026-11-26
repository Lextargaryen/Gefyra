import { NextRequest, NextResponse } from 'next/server'
import { appOrigin, sameOrigin } from '../../../../lib/config'
import { beginGoogle, finishGoogle, type OAuthFlow } from '../../../../lib/google'
import { findStudentByEmail } from '../../../../lib/students'
import { cookieOptions, oauthName, seal, sessionName, unseal } from '../../../../lib/session'

type Context = { params: Promise<{ action: string }> }
function go(path: string, origin: string) {
  return NextResponse.redirect(new URL(path, origin), 303)
}
function session(response: NextResponse, origin: string, identity: { sub: string; email: string }) {
  const seconds = 2 * 60 * 60
  response.cookies.set(sessionName, seal(sessionName, identity, seconds), cookieOptions(origin, seconds))
  return response
}
export async function GET(request: NextRequest, { params }: Context) {
  const { action } = await params
  if (!['google', 'callback'].includes(action)) return new NextResponse(null, { status: 404 })
  try {
    const origin = appOrigin(request)
    if (action === 'google') {
      const { url, flow } = beginGoogle(origin)
      const result = NextResponse.redirect(url, 303)
      result.cookies.set(oauthName, seal(oauthName, flow, 600), cookieOptions(origin, 600))
      return result
    }
    const flow = unseal<OAuthFlow>(oauthName, request.cookies.get(oauthName)?.value)
    const identity = flow ? await finishGoogle(request.nextUrl.searchParams, flow, origin).catch(() => null) : null
    const student = identity ? await findStudentByEmail(identity.email) : null
    const result = student && identity ? session(go('/rooms', origin), origin, identity) : go('/access-denied', origin)
    result.cookies.set(oauthName, '', cookieOptions(origin, 0))
    return result
  } catch {
    return new NextResponse('Sign-in is temporarily unavailable.', { status: 503 })
  }
}
export async function POST(request: NextRequest, { params }: Context) {
  try {
    if (!sameOrigin(request)) return new NextResponse(null, { status: 403 })
    const { action } = await params
    const origin = appOrigin(request)
    if (action === 'logout') {
      const result = go('/', origin)
      result.cookies.set(sessionName, '', cookieOptions(origin, 0))
      result.cookies.set(oauthName, '', cookieOptions(origin, 0))
      return result
    }
    return new NextResponse(null, { status: 404 })
  } catch {
    return new NextResponse('Sign-in is temporarily unavailable.', { status: 503 })
  }
}
