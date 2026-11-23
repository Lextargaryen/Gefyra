import { protectedApi, respond } from '../../../../lib/api'
import { roomDetail } from '../../../../lib/rooms'
export const dynamic = 'force-dynamic'
export function GET(_: Request, { params }: { params: Promise<{ roomId: string }> }) {
  return protectedApi(async student => {
    const room = await roomDetail((await params).roomId, student.studentId)
    return room ? respond(room) : respond({ code: 'ROOM_NOT_FOUND' }, 404)
  })
}
