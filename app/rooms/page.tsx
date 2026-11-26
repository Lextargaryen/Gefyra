import { redirect } from 'next/navigation'
import { Footer, Header } from '../../components/chrome'
import { RoomBrowser } from '../../components/room-browser'
import { support } from '../../lib/config'
import { existingBooking, inventory } from '../../lib/rooms'
import { authorization } from '../../lib/session'
export const metadata = { title: 'Choose a room' }
export const dynamic = 'force-dynamic'

export default async function Rooms() {
  const auth = await authorization()
  if (!auth.student) redirect(auth.status === 401 ? '/' : auth.status === 403 ? '/access-denied' : '/?status=unavailable')
  const [rooms, booking] = await Promise.allSettled([inventory(), existingBooking(auth.student.studentId)])
  return <><Header active="rooms"/>
    <RoomBrowser initialInventory={rooms.status === 'fulfilled' ? rooms.value : null}
      initialBooking={booking.status === 'fulfilled' ? booking.value : null} initialBookingKnown={booking.status === 'fulfilled'}/>
    <Footer support={support()}/></>
}
