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
    <p>In live mode, we use your verified university Google account and the E24 eligibility roster to confirm access. We associate your booking with your roster student ID.</p>
    <h2>Room details</h2>
    <p>Eligible, signed-in E24 students can see your roster display name in the details of the room you confirm. Room details show occupancy and display names.</p>
    {process.env.RETENTION_TERMS && <><h2>Data retention</h2><p>{process.env.RETENTION_TERMS}</p></>}
    {contact && <><h2>Contact</h2><p>For questions about your allocation data, <a href={'mailto:' + contact}>contact the allocation team</a>.</p></>}
  </main><Footer support={contact}/></>
}
