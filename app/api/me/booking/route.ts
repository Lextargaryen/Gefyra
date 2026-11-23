import { protectedApi, respond } from '../../../../lib/api'
import { existingBooking } from '../../../../lib/rooms'
export const dynamic = 'force-dynamic'
export const GET = () => protectedApi(async student => respond({ booking: await existingBooking(student.studentId) }))
