/**
 * Writing a page of the public site: the v1.2.2 build (tools/v122/build-v1.2.2.mjs) as a module, so the
 * deploy build (scripts/render-site.ts) and the dashboard's page preview produce the same HTML.
 *
 * 1. The page is put together from the content model (src/dashboard/render.ts).
 * 2. The practice details are filled in from Site Settings ({{phone}}, {{#preOpening}}...{{/preOpening}});
 *    anything whose value is empty is hidden.
 * 3. Canonical, Open Graph and Twitter tags go in place of the <!-- @seo --> marker, plus the Dentist
 *    structured data on the home, contact and location pages.
 * 4. GA4 and the Meta Pixel are added only when their IDs are set.
 */
import type { Page } from './parts'
import type { SiteSettings } from './site'

export const escHtml = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const escJson = (v: unknown) => JSON.stringify(String(v ?? '')).slice(1, -1)

export function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '')
  if (!digits) return ''
  if (digits.startsWith('+')) return `tel:${digits}`
  if (/^(13|18)\d+$/.test(digits)) return `tel:${digits}`
  if (digits.startsWith('0')) return `tel:+61${digits.slice(1)}`
  return `tel:${digits}`
}

export type Ctx = Record<string, string>

/** The values the page tokens resolve to. Same names as the v1.2.2 build, plus localityLine (footer). */
export function ctxFor(s: SiteSettings): Ctx {
  const a = s.address
  const phone = String(s.phone || '').trim()
  const hours = (s.hours || []).map((h) => String(h).trim()).filter(Boolean)
  const addressStreet = String(a.streetAddress || '').trim() || a.streetFallback
  return {
    name: s.name,
    phone,
    phoneHref: telHref(phone),
    email: String(s.emails?.public || '').trim(),
    streetAddress: String(a.streetAddress || '').trim(),
    addressStreet,
    addressLine: `${addressStreet}, ${a.locality} ${a.region} ${a.postcode}`,
    localityLine: `${a.locality} ${a.region} ${a.postcode}`,
    hours: hours.length ? 'yes' : '',
    hoursHtml: hours.map(escHtml).join('<br>'),
    openingDate: String(s.openingDate || '').trim(),
    preOpening: s.preOpening ? 'yes' : '',
    mapQuery: encodeURIComponent(`${addressStreet}, ${a.locality} ${a.region} ${a.postcode}`),
  }
}

/** The token names, for the dashboard (shaded practice details) and the checks. */
export const CTX_KEYS = ['name', 'phone', 'phoneHref', 'email', 'streetAddress', 'addressStreet', 'addressLine', 'localityLine',
  'hours', 'hoursHtml', 'openingDate', 'preOpening', 'mapQuery'] as const

const SECTION = /\{\{([#^])(\w+)\}\}([\s\S]*?)\{\{\/\2\}\}/

/** {{#key}}..{{/key}}, {{^key}}..{{/key}}, {{{raw}}} and {{escaped}}, exactly as the v1.2.2 build did it. */
export function mustache(text: string, ctx: Ctx, json = false, errors?: string[], file = ''): string {
  let s = text
  let m: RegExpExecArray | null
  while ((m = SECTION.exec(s))) {
    const [all, kind, key, body] = m
    if (!(key in ctx)) errors?.push(`${file}: unknown section {{${kind}${key}}}`)
    const on = Boolean(ctx[key])
    s = s.replace(all, () => ((kind === '#' ? on : !on) ? body : ''))
  }
  s = s.replace(/\{\{\{(\w+)\}\}\}/g, (all, key: string) => {
    if (!(key in ctx)) errors?.push(`${file}: unknown value {{{${key}}}}`)
    return json ? escJson(ctx[key] ?? '') : String(ctx[key] ?? '')
  })
  s = s.replace(/\{\{(\w+)\}\}/g, (all, key: string) => {
    if (!(key in ctx)) errors?.push(`${file}: unknown value {{${key}}}`)
    return json ? escJson(ctx[key] ?? '') : escHtml(ctx[key] ?? '')
  })
  return s
}

/** Structured data blocks get JSON escaping, everything else HTML escaping. */
export function fillDetails(html: string, ctx: Ctx, errors?: string[], file = ''): string {
  return html
    .split(/(<script type="application\/ld\+json">[\s\S]*?<\/script>)/)
    .map((part) => mustache(part, ctx, part.startsWith('<script type="application/ld+json">'), errors, file))
    .join('')
}

// ---------------------------------------------------------------- SEO tags

export const siteOrigin = (s: SiteSettings) => String(s.siteUrl || '').replace(/\/+$/, '')

export function urlFor(s: SiteSettings, file: string): string {
  const origin = siteOrigin(s)
  if (file === 'index.html') return `${origin}/`
  return `${origin}/${file.replace(/index\.html$/, '')}`
}

const abs = (origin: string, p: string) => (/^https?:\/\//i.test(p) ? p : origin + (p.startsWith('/') ? p : `/${p}`))

export function dentistJsonLd(s: SiteSettings, ctx: Ctx): string {
  const origin = siteOrigin(s)
  const a = s.address
  const sameAs = Object.values(s.socials || {}).map((v) => String(v).trim()).filter(Boolean)
  const address = {
    '@type': 'PostalAddress',
    ...(ctx.streetAddress ? { streetAddress: ctx.streetAddress } : {}),
    addressLocality: a.locality,
    addressRegion: a.region,
    postalCode: a.postcode,
    addressCountry: a.country,
  }
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Dentist',
    '@id': `${origin}/#dentist`,
    name: s.name,
    url: `${origin}/`,
    image: `${origin}${s.shareImage.path}`,
    logo: `${origin}${s.logo}`,
    ...(ctx.email ? { email: ctx.email } : {}),
    ...(ctx.phone ? { telephone: ctx.phoneHref.replace(/^tel:/, '') } : {}),
    address,
    areaServed: (s.areaServed || []).map((n) => ({ '@type': 'City', name: n })),
    ...((s.hoursSchema || []).length ? { openingHours: s.hoursSchema } : {}),
    ...((s.paymentAccepted || []).length ? { paymentAccepted: s.paymentAccepted.join(', ') } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  }
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`
}

export function seoBlock(html: string, page: Page, s: SiteSettings, ctx: Ctx): string {
  const m = page.meta || {}
  const url = m.canonical || urlFor(s, page.file)
  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || ''
  const desc = (html.match(/<meta name="description" content="([^"]*)">/) || [])[1] || ''
  const ogTitle = (html.match(/<meta property="og:title" content="([^"]*)">/) || [])[1]
  const ogDesc = (html.match(/<meta property="og:description" content="([^"]*)">/) || [])[1]
  const origin = siteOrigin(s)
  const custom = m.ogImage ? abs(origin, m.ogImage) : ''
  const img = custom || `${origin}${s.shareImage.path}`
  const imgAlt = escHtml(custom ? (m.ogTitle || m.title || s.name) : s.shareImage.alt)
  const lines = [
    `<link rel="canonical" href="${escHtml(url)}">`,
    ...(m.noindex ? ['<meta name="robots" content="noindex, follow">'] : []),
    ...(ogTitle ? [] : [`<meta property="og:title" content="${title}">`]),
    ...(ogDesc ? [] : [`<meta property="og:description" content="${desc}">`]),
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${escHtml(url)}">`,
    `<meta property="og:site_name" content="${escHtml(s.name)}">`,
    `<meta property="og:locale" content="en_AU">`,
    `<meta property="og:image" content="${escHtml(img)}">`,
    ...(custom ? [] : [
      `<meta property="og:image:width" content="${s.shareImage.width}">`,
      `<meta property="og:image:height" content="${s.shareImage.height}">`,
    ]),
    `<meta property="og:image:alt" content="${imgAlt}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${ogTitle || title}">`,
    `<meta name="twitter:description" content="${ogDesc || desc}">`,
    `<meta name="twitter:image" content="${escHtml(img)}">`,
    `<meta name="twitter:image:alt" content="${imgAlt}">`,
  ]
  // Dentist structured data on the home page, the contact page and the location pages.
  if (page.file === 'index.html' || page.file === 'contact/index.html' || /^dentist-[^/]+\/index\.html$/.test(page.file)) lines.push(dentistJsonLd(s, ctx))
  return lines.join('\n')
}

/** GA4 and the Meta Pixel, only when their IDs are filled in (Site Settings, GYA only). */
export function analyticsTags(t: { ga4?: string; metaPixel?: string } | undefined): string {
  const ga = String(t?.ga4 || '').trim()
  const px = String(t?.metaPixel || '').trim()
  let out = ''
  if (/^G-[A-Z0-9]+$/.test(ga)) {
    out += `<script async src="https://www.googletagmanager.com/gtag/js?id=${ga}"></script>\n`
      + `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${ga}');</script>\n`
  }
  if (/^\d{6,20}$/.test(px)) {
    out += `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${px}');fbq('track','PageView');</script>\n`
  }
  return out
}

const SEO_MARK = /<!-- @seo:[^>]*-->/

/** The finished page: details filled in, SEO tags added, tracking added when set. */
export function finishPage(template: string, page: Page, s: SiteSettings, errors?: string[]): string {
  const ctx = ctxFor(s)
  let html = fillDetails(template, ctx, errors, page.file)
  if (page.file !== '404.html') {
    if (!SEO_MARK.test(html)) errors?.push(`${page.file}: missing the <!-- @seo --> marker in <head>`)
    html = html.replace(SEO_MARK, () => seoBlock(html, page, s, ctx))
  }
  const tags = analyticsTags(s.tracking)
  if (tags) html = html.replace('</head>', `${tags}</head>`)
  return html
}
