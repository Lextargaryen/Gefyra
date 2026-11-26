import Link from 'next/link'
import { Footer, Header } from '../../components/chrome'
import { Icon } from '../../components/icon'
import { support } from '../../lib/config'
export const metadata = { title: 'Privacy' }
export const dynamic = 'force-dynamic'
export default function Privacy() {
  const contact = support()
  return <><Header/><main id="main" className="document-page">
    <Link href="/" className="back-link"><Icon name="back" size={17}/> Hostel allocation</Link>
    <h1>Room allocation privacy</h1>
    <h2>Account and eligibility</h2>
    <p>We use your verified Google email to check the student list in Supabase. If your email is listed, you can access room allocation. Bookings are associated with your student ID.</p>
    <h2>Room details</h2>
    <p>Students whose Google email appears in the access table can see your name from that table in the details of the room you confirm. Room details show occupancy and display names.</p>
    {process.env.RETENTION_TERMS && <><h2>Data retention</h2><p>{process.env.RETENTION_TERMS}</p></>}
    {contact && <><h2>Contact</h2><p>For questions about your allocation data, <a href={'mailto:' + contact}>contact the allocation team</a>.</p></>}
  </main><Footer support={contact}/></>
}
