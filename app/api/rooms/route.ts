import { protectedApi, respond } from '../../../lib/api'
import { inventory } from '../../../lib/rooms'
export const dynamic = 'force-dynamic'
export const GET = () => protectedApi(async () => respond(await inventory()))
