import Link from 'next/link'
import { Icon, GoogleIcon } from './icon'

export function Brand() {
  return <Link className="brand" href="/" aria-label="E24 Hostel Allocation home">
    <span className="wordmark">E24</span>
    <span><strong>Hostel Allocation</strong><small>University of Peradeniya</small></span>
  </Link>
}
export function Header({ active }: { active?: 'rooms' | 'mine' }) {
  return <header className="site-header"><div className="header-inner">
    <Brand />
    {active && <nav aria-label="Room allocation" className="nav">
      <Link href="/rooms" aria-current={active === 'rooms' ? 'page' : undefined}><Icon name="grid" size={16}/> Rooms</Link>
      <Link href="/my-room" aria-current={active === 'mine' ? 'page' : undefined}><Icon name="door" size={17}/> My room</Link>
    </nav>}
    <div className="header-actions">
      {active && <form method="post" action="/api/auth/logout"><button className="signout" type="submit" aria-label="Sign out"><Icon name="logout" size={17}/><span>Sign out</span></button></form>}
    </div>
  </div></header>
}
export function Footer({ support }: { support?: string }) {
  return <footer className="site-footer"><div className="footer-inner">
    <span>Faculty of Engineering <span aria-hidden="true">·</span> Batch E24</span>
    <div>{support && <a href={'mailto:' + support}>Contact support</a>}<Link href="/privacy">Privacy</Link></div>
  </div></footer>
}
export function SignIn({ retry = false }: { retry?: boolean }) {
  return <a className="button google wide" href="/api/auth/google"><GoogleIcon/>{retry ? 'Try another Google account' : 'Continue with Google'}</a>
}
