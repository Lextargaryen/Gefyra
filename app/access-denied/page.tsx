import { Footer, Header, SignIn } from '../../components/chrome'
import { Icon } from '../../components/icon'
import { support } from '../../lib/config'
export const metadata = { title: 'Access denied' }
export const dynamic = 'force-dynamic'
export default function AccessDenied() {
  return <><Header/><main id="main" className="login-stage">
    <section className="login-card">
      <div className="login-mark"><Icon name="lock" size={26}/></div>
      <h1>This account can’t access room allocation</h1>
      <p className="login-copy">Use the same Google email listed in the student access table. If you think your email should be listed, contact the allocation team.</p>
      <SignIn retry/>
    </section>
  </main><Footer support={support()}/></>
}
