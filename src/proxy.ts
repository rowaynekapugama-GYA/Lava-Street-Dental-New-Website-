/**
 * Public addresses for the static pages, the way the v1.2.2 vercel.json served them (clean URLs with a
 * trailing slash), plus the redirects (content/redirects.json, edited in the dashboard by GYA).
 *
 *   /about            -> 308 /about/
 *   /about/index.html -> 308 /about/   (the pages link to each other as about/index.html)
 *   /about/           -> serves public/about/index.html (written by scripts/render-site.ts)
 *   anything else        -> the site's own 404 page, with a 404 status
 *
 * /admin, /cms, /api and /_next are left to Next.js and Payload.
 *
 * Search engines: only the live domain (Site Settings > Website address, and its www form) may be indexed.
 * Any other address, such as lava-street-dental.vercel.app or a Vercel preview, gets the noindex copies
 * in public/_demo/ (no canonical, no structured data), an empty sitemap, a crawlable robots.txt and an
 * X-Robots-Tag: noindex, nofollow header on every response. See README, "Search engines".
 */
import { NextResponse, type NextRequest } from 'next/server'
import site from './generated/site-routes.json'

const ROUTES = new Set<string>(site.routes)
type R = { from: string; to: string; type?: string }
const norm = (p: string) => '/' + p.trim().replace(/^https?:\/\/[^/]+/i, '').replace(/^\/+/, '').replace(/\/+$/, '') + '/'
const REDIRECTS = new Map<string, R>((site.redirects as R[]).filter((r) => r.from && r.to).map((r) => [norm(r.from), r]))

const APP = /^\/(admin|cms|api|_next)(\/|$)/
const INDEX_HOSTS = new Set<string>(((site as { indexHosts?: string[] }).indexHosts ?? []).map((h) => h.toLowerCase()))
const NOINDEX = 'noindex, nofollow'

/** The live domain may be indexed; every other address may not. */
const isLive = (req: NextRequest) => INDEX_HOSTS.has(String(req.headers.get('host') || '').toLowerCase().replace(/:\d+$/, ''))

function tagged<T extends NextResponse>(res: T, live: boolean): T {
  if (!live) res.headers.set('X-Robots-Tag', NOINDEX)
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|assets/).*)'],
}

export async function proxy(req: NextRequest) {
  const live = isLive(req)
  return tagged(await route(req, live), live)
}

async function route(req: NextRequest, live: boolean): Promise<NextResponse> {
  const url = req.nextUrl
  const p = url.pathname
  const demo = live ? '' : '/_demo'
  // the demo copies never show on the live domain (on other addresses they are noindex like everything else)
  if (live && /^\/_demo(\/|$)/.test(p)) return notFound(req, live)

  // Payload's own create first user screen is never used: the first login is made on /admin/login.
  if (p.startsWith('/cms/create-first-user') && process.env.ALLOW_FIRST_USER !== 'true') {
    return new NextResponse('Not found', { status: 404, headers: { 'x-robots-tag': 'noindex' } })
  }
  // the waitlist and contact forms post to /api/waitlist/ and /api/enquiry/ with a trailing slash
  if (/^\/api\/(waitlist|enquiry)\/$/.test(p)) {
    return NextResponse.rewrite(new URL(p.slice(0, -1) + url.search, url.origin))
  }
  if (p === '/admin/') return NextResponse.redirect(new URL('/admin' + url.search, url.origin), 308)
  if (APP.test(p)) return NextResponse.next()

  const r = REDIRECTS.get(p.endsWith('/') ? p : p + '/')
  if (r) {
    const dest = /^https?:\/\//i.test(r.to) ? r.to : new URL(r.to, url.origin).toString()
    return NextResponse.redirect(dest, r.type === 'temporary' ? 307 : 308)
  }

  if (/\/index\.html$/i.test(p)) {
    const clean = p.slice(0, -'index.html'.length)
    if (ROUTES.has(clean)) return NextResponse.redirect(new URL(clean + url.search, url.origin), 308)
    return NextResponse.next()
  }
  if (!live && (p === '/sitemap.xml' || p === '/robots.txt')) return NextResponse.rewrite(new URL(demo + p, url.origin))
  if (/\.[a-z0-9]{1,6}$/i.test(p)) return NextResponse.next()   // files: sitemap.xml, robots.txt, icon.svg ...

  if (!p.endsWith('/')) return NextResponse.redirect(new URL(p + '/' + url.search, url.origin), 308)
  if (ROUTES.has(p)) return NextResponse.rewrite(new URL(demo + (p === '/' ? '/index.html' : p + 'index.html') + url.search, url.origin))
  return notFound(req, live)
}

async function notFound(req: NextRequest, live: boolean): Promise<NextResponse> {
  try {
    const res = await fetch(new URL(live ? '/404.html' : '/_demo/404.html', req.nextUrl.origin))
    if (res.ok) {
      return new NextResponse(await res.text(), {
        status: 404,
        headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' },
      })
    }
  } catch { /* fall through */ }
  return new NextResponse('Page not found', { status: 404, headers: { 'x-robots-tag': 'noindex' } })
}
