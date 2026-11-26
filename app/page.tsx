import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Footer, Header, SignIn } from '../components/chrome'
import { Icon } from '../components/icon'
import { support } from '../lib/config'
import { authorization } from '../lib/session'

export default async function Home() {
  const auth = await authorization()
  if (auth.student) redirect('/rooms')
  return <><Header/><main id="main" className="login-stage">
    <section className="login-card" aria-labelledby="login-title">
      <div className="login-mark"><Icon name="building" size={27}/></div>
      <p className="eyebrow">University of Peradeniya</p>
      <h1 id="login-title">E24 Hostel<br/>Allocation</h1>
      <p className="login-copy">Sign in with the Google account listed for your student record to choose a hostel room.</p>
      {auth.status === 503 && <p className="notice" role="status">Sign-in is temporarily unavailable. Please try again shortly.</p>}
      <SignIn/>
      <div className="privacy-note"><Icon name="lock" size={17}/><p>Only eligible E24 students can see occupant names. <Link href="/privacy">Privacy details</Link></p></div>
    </section>
  </main><Footer support={support()}/></>
}
