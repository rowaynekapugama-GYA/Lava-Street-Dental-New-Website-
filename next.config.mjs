import { withPayload } from '@payloadcms/next/withPayload'

/** Security headers for every response, applied by Next.js (the v1.2.2 static site relied on Vercel's defaults). */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // the public pages handle their own trailing slash in src/proxy.ts; /admin, /cms and /api are never redirected
  skipTrailingSlashRedirect: true,
  // files the dashboard reads while it runs (the content model, the photo list, the asset version)
  outputFileTracingIncludes: {
    '/api/import-content': ['./content/**/*', './site.config.mjs'],
    '/api/import-media': ['./content/**/*', './public/assets/images/**/*'],
    '/admin/**/*': ['./content/**/*', './package.json', './site.config.mjs'],
    '/api/dashboard/**/*': ['./content/**/*', './site.config.mjs'],
  },
  images: {
    // Vercel image optimisation is capped account wide, so the repo ships pre-compressed webp and serves it as is
    unoptimized: true,
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        // preview deployments and the vercel.app address must never be indexed
        source: '/:path*',
        has: [{ type: 'host', value: '(.*)\\.vercel\\.app' }],
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      { source: '/assets/images/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }] },
      { source: '/assets/:dir(css|js)/:file*', headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }] },
      { source: '/admin/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }, { key: 'Cache-Control', value: 'no-store' }] },
      { source: '/admin', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }, { key: 'Cache-Control', value: 'no-store' }] },
      { source: '/cms/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ]
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
