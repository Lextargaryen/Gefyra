import 'server-only'
import { NextResponse } from 'next/server'
import { authorization } from './session'
import type { Student } from './config'

export function respond(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
}
export async function protectedApi(handle: (student: Student) => Promise<NextResponse>) {
  try {
    const auth = await authorization()
    if (!auth.student) return respond({ code: auth.status === 401 ? 'UNAUTHENTICATED' : 'INELIGIBLE' }, auth.status)
    return await handle(auth.student)
  } catch {
    return respond({ code: 'TEMPORARILY_UNAVAILABLE' }, 503)
  }
}
