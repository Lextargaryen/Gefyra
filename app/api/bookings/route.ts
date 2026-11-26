import { protectedApi, respond } from '../../../lib/api'
import { sameOrigin } from '../../../lib/config'
import { book } from '../../../lib/rooms'
export const runtime = 'nodejs'
export function POST(request: Request) {
  return protectedApi(async student => {
    if (!sameOrigin(request)) return respond({ code: 'ORIGIN_DENIED' }, 403)
    if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return respond({ code: 'INVALID_REQUEST' }, 400)
    const body = await request.json().catch(() => null)
    if (!body || Object.keys(body).length !== 1 || typeof body.roomId !== 'string' || !/^[\w-]{1,100}$/.test(body.roomId)) return respond({ code: 'INVALID_REQUEST' }, 400)
    const { status, ...payload } = await book(body.roomId, student.studentId)
    return respond(payload, status)
  })
}
