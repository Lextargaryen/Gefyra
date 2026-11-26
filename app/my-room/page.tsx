import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Footer, Header } from '../../components/chrome'
import { Icon } from '../../components/icon'
import { Occupants } from '../../components/occupants'
import { support } from '../../lib/config'
import { existingBooking, roomDetail } from '../../lib/rooms'
import { authorization } from '../../lib/session'
export const metadata = { title: 'My room' }
export const dynamic = 'force-dynamic'

export default async function MyRoom() {
  const auth = await authorization()
  if (!auth.student) redirect(auth.status === 401 ? '/' : auth.status === 403 ? '/access-denied' : '/?status=unavailable')
  const booking = await existingBooking(auth.student.studentId).catch(() => undefined)
  if (booking === null) redirect('/rooms')
  const room = booking ? await roomDetail(booking.roomId, auth.student.studentId).catch(() => null) : null
  return <><Header active="mine"/><main id="main" className="document-page my-room">
    <Link href="/rooms" className="back-link"><Icon name="back" size={17}/> View all rooms</Link>
    {booking ? <>
      <div className="success-line"><Icon name="check" size={20}/> Booking confirmed</div>
      <h1>Your room is confirmed</h1>
      <p>You have one place in this room.</p>
      <section className="confirmed-card">
        <div className="confirmed-heading"><div><p className="eyebrow">{booking.hostel}{booking.floor && ' · Floor ' + booking.floor}</p><h2>Room {booking.roomLabel}</h2></div><div className="login-mark"><Icon name="door" size={24}/></div></div>
        <h3>Current roommates</h3>
        {room ? <Occupants room={room}/> : <p>We couldn’t load your roommates. <a href="/my-room">Try again</a>.</p>}
      </section>
    </> : <><h1>Your room</h1><p>We couldn’t load your booking. <a href="/my-room">Try again</a>.</p></>}
  </main><Footer support={support()}/></>
}
