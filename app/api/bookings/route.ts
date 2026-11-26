import { protectedApi, respond } from '../../../lib/api'
import { sameOrigin } from '../../../lib/config'
import { book } from '../../../lib/rooms'
export const runtime = 'nodejs'
export function POST(request: Request) {
  return save(request, false)
}
export function PATCH(request: Request) {
  return save(request, true)
}
function save(request: Request, changing: boolean) {
  return protectedApi(async student => {
    if (!sameOrigin(request)) return respond({ code: 'ORIGIN_DENIED' }, 403)
    if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return respond({ code: 'INVALID_REQUEST' }, 400)
    const body = await request.json().catch(() => null)
    const validRoomId = (value: unknown): value is string => typeof value === 'string' && /^[\w-]{1,100}$/.test(value)
    if (!body || Object.keys(body).length !== (changing ? 2 : 1) || !validRoomId(body.roomId) ||
      (changing && !validRoomId(body.fromRoomId))) return respond({ code: 'INVALID_REQUEST' }, 400)
    const { status, ...payload } = await book(body.roomId, student.studentId, changing ? body.fromRoomId : undefined)
    return respond(payload, status)
  })
}
