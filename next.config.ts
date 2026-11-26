import type { NextConfig } from 'next'
const config: NextConfig = {
  poweredByHeader: false,
  images: { unoptimized: true },
  async headers() {
    return [
      { source: '/:path*', headers: [
        { key: 'Referrer-Policy', value: 'same-origin' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ] },
      ...['/api/:path*', '/rooms', '/my-room'].map(source => ({ source, headers: [{ key: 'Cache-Control', value: 'private, no-store' }] })),
    ]
  },
}
export default config
