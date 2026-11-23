import type { ReactNode } from 'react'

const paths = {
  arrow: <><path d="M5 12h14m-6-6 6 6-6 6"/></>,
  back: <path d="M19 12H5m6-6-6 6 6 6"/>,
  building: <><path d="M4 21h16M6 21V5l6-3 6 3v16M10 21v-4h4v4M9 7h.01M15 7h.01M9 10h.01M15 10h.01M9 13h.01M15 13h.01"/></>,
  door: <><path d="M4 21h16M7 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M13 12h.01"/></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  search: <><circle cx="10.8" cy="10.8" r="6.3"/><path d="m16 16 4 4"/></>,
  chevron: <path d="m6 9 6 6 6-6"/>,
  check: <path d="m5 12 4 4L19 6"/>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  user: <><circle cx="12" cy="8" r="3.1"/><path d="M5 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2"/></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/></>,
  logout: <><path d="M11 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h6m-1-8h10m-4-4 4 4-4 4"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></>,
} satisfies Record<string, ReactNode>
export function Icon({ name, size = 20 }: { name: keyof typeof paths; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}
export function GoogleIcon() {
  return <svg aria-hidden="true" width="19" height="19" viewBox="0 0 48 48">
    <path fill="#4285F4" d="M43.6 24.46c0-1.36-.12-2.66-.34-3.92H24v7.42h11a9.4 9.4 0 0 1-4.08 6.16v5.13h6.61c3.87-3.56 6.07-8.81 6.07-14.79Z"/>
    <path fill="#34A853" d="M24 44c5.51 0 10.13-1.83 13.53-4.75l-6.61-5.13c-1.83 1.23-4.17 1.96-6.92 1.96-5.32 0-9.83-3.59-11.44-8.42H5.74v5.29A20.5 20.5 0 0 0 24 44Z"/>
    <path fill="#FBBC05" d="M12.56 27.66a12.3 12.3 0 0 1 0-7.32v-5.29H5.74a20 20 0 0 0 0 17.9l6.82-5.29Z"/>
    <path fill="#EA4335" d="M24 11.92c3 0 5.69 1.03 7.82 3.07l5.86-5.86C34.12 5.82 29.5 4 24 4A20.5 20.5 0 0 0 5.74 15.05l6.82 5.29c1.61-4.83 6.12-8.42 11.44-8.42Z"/>
  </svg>
}
