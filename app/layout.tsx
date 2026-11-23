import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = { title: { default: 'E24 Hostel Allocation', template: '%s · E24 Hostel Allocation' }, description: 'Hostel room allocation for the Faculty of Engineering, Batch E24, University of Peradeniya.' }
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><a className="skip-link" href="#main">Skip to main content</a>{children}</body></html>
}
