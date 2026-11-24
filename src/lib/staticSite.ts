/**
 * Writing a page of the public site: the v1.2.2 build (tools/v122/build-v1.2.2.mjs) as a module, so the
 * deploy build (scripts/render-site.ts) and the dashboard's page preview produce the same HTML.
 *
 * 1. The page is put together from the content model (src/dashboard/render.ts).
 * 2. The practice details are filled in from Site Settings ({{phone}}, {{#preOpening}}...{{/preOpening}});
 *    anything whose value is empty is hidden.
 * 3. Canonical, Open Graph and Twitter tags go in place of the <!-- @seo --> marker, plus the Dentist
 *    structured data on the home, contact and location pages.
 * 4. Google Tag Manager, GA4 and the Meta Pixel are added only when their IDs are set. The demo and preview
 *    copies and the dashboard preview take them out again (stripTracking), so only the live domain loads them.
 *
 * Two switches from Site Settings act on the page before step 2 (v1.4.0), so they work on whatever wording
 * the dashboard holds, with no page edits:
 *    onlineBooking: with a booking link set, every booking button opens the booking portal in a new tab under
 *      its open-practice label ("Book an appointment"), in or out of opening-soon mode (bookingButtons).
 *    emailActive: while off, the public email address is treated as empty, so everything that depends on it
 *      is hidden, and the few sentences built around it fall back to the phone number (emailOffFallbacks).
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

/** The booking portal address, or '' unless online booking is switched on and the link is a real https address. */
export function bookingLink(s: SiteSettings): string {
  const url = String(s.bookingUrl || '').trim()
  return s.onlineBooking && /^https:\/\/[^\s"'<>]+$/.test(url) ? url : ''
}

/** The public email address, or '' while it is switched off (Site Settings > Email address is working). */
export const publicEmail = (s: SiteSettings) => (s.emailActive ? String(s.emails?.public || '').trim() : '')

// A booking button as every page has it: in opening-soon mode it goes to the waitlist form, otherwise to the
// contact page, and its label switches the same way.
const BOOK_BUTTON = /<a ([^>]*?)href="\{\{#preOpening\}\}[^"{}]*#waitlist\{\{\/preOpening\}\}\{\{\^preOpening\}\}[^"{}]*\{\{\/preOpening\}\}"([^>]*)>\{\{#preOpening\}\}(?:(?!<\/a>)[\s\S])*?\{\{\/preOpening\}\}\{\{\^preOpening\}\}((?:(?!<\/a>)[\s\S])*?)\{\{\/preOpening\}\}<\/a>/g

/**
 * Online booking on: every booking button opens the portal in a new tab, with its open-practice label.
 * Nothing else about opening-soon mode changes (the waitlist form and its own links stay).
 * data-book is what site.js reports as the book_online event.
 */
export function bookingButtons(template: string, s: SiteSettings): string {
  const url = bookingLink(s)
  if (!url) return template
  return template.replace(BOOK_BUTTON, (_all, before: string, after: string, label: string) =>
    `<a ${before}href="${escHtml(url)}" target="_blank" rel="noopener" data-book${after}>${label}</a>`)
}

const reEsc = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Email address switched off: the footer line and the structured data already disappear with an empty
 * address, the same rule as an empty phone number. These are the places written around the address:
 *   a list row holding the address (contact page, "Email")            the row goes
 *   a labelled line between line breaks (privacy contact, "Email:")    the line goes
 *   "... or email <address>" (contact page, feedback)                  those words go
 *   the forms' error hint "You can also email us at ... or call ..."   becomes "You can also call ..."
 *   any other sentence ending in the address ("get in touch at ...")   shows the phone number instead
 * In the page editor, words that hold the address cannot be clicked into while it is off, so saving a
 * page can never drop the address from them for good.
 */
export function emailOffFallbacks(template: string, address = ''): string {
  // the link as the pages have it, or with the address typed out (a paragraph edited in the dashboard)
  const addr = address ? `(?:\\{\\{email\\}\\}|${reEsc(address)})` : '\\{\\{email\\}\\}'
  const link = `<a\\b[^>]*href="mailto:${addr}"[^>]*>(?:<span class="pd-tok"[^>]*>)?${addr}(?:</span>)?</a>`
  const inside = (close: string) => `(?:(?!${close})[\\s\\S])*?`
  return template
    .replace(new RegExp(`<pd-e data-pde="[^"]*" data-t="(?:text|rich)"(?: data-lock="1")?>(${inside('</pd-e>')}${link}${inside('</pd-e>')})</pd-e>`, 'g'), '$1')
    .replace(new RegExp(`<li>${inside('</li>')}${link}${inside('</li>')}</li>`, 'g'), '')
    .replace(new RegExp(`<br>(?:(?!<br>|</p>|<p[\\s>])[\\s\\S])*?${link}(?=(?:\\{\\{#phone\\}\\})?<br>|</p>)`, 'g'), '')
    .replace(new RegExp(` or email ${link}`, 'g'), '')
    .replace(/ You can also email us at \{\{email\}\}\{\{#phone\}\} or call \{\{phone\}\}\{\{\/phone\}\}\./g, '{{#phone}} You can also call {{phone}}.{{/phone}}')
    .replace(new RegExp(link, 'g'), '{{#phone}}<a class="textlink" href="{{phoneHref}}">{{phone}}</a>{{/phone}}{{^phone}}<a class="textlink" href="/contact/">our contact page</a>{{/phone}}')
}

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
    email: publicEmail(s),
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

// ---------------------------------------------------------------- tracking

export const GTM_ID_RE = /^GTM-[A-Z0-9]+$/

/** The container ID from Site Settings, or '' when it is blank or not in the GTM-XXXXXXX format. */
export const gtmIdOf = (t: { gtmId?: string } | undefined) => {
  const id = String(t?.gtmId || '').trim().toUpperCase()
  return GTM_ID_RE.test(id) ? id : ''
}

/** Google Tag Manager for the top of <head>: the snippet Google issues for new containers, as supplied. */
export function gtmHead(id: string): string {
  return `<script async src="https://www.googletagmanager.com/gtm.js?id=${id}"></script>\n`
    + `<script>\n`
    + `  window.dataLayer = window.dataLayer || [];\n`
    + `  function gtag(){dataLayer.push(arguments);}\n`
    + `  gtag('js', new Date());\n`
    + `</script>\n`
}

/** Google Tag Manager for straight after <body> opens (browsers with JavaScript switched off). */
export function gtmBody(id: string): string {
  return `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${id}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>\n`
}

/**
 * Takes every tracking tag out of a finished page: Google Tag Manager (head and noscript), GA4 and the Meta
 * Pixel. Used for the demo and preview copies (scripts/render-site.ts) and the dashboard's page preview,
 * so test visits never reach Google Ads or Analytics.
 */
export function stripTracking(html: string): string {
  return html
    .replace(/<script async src="https:\/\/www\.googletagmanager\.com\/gtm\.js[^"]*"><\/script>\n?<script>\s*window\.dataLayer[\s\S]*?<\/script>\n?/g, '')
    .replace(/<noscript><iframe src="https:\/\/www\.googletagmanager\.com\/ns\.html[^"]*"[^>]*><\/iframe><\/noscript>\n?/g, '')
    .replace(/<script async src="https:\/\/www\.googletagmanager\.com\/gtag\/js[^"]*"><\/script>\n?<script>window\.dataLayer[\s\S]*?<\/script>\n?/g, '')
    .replace(/<script>!function\(f,b,e,v,n,t,s\)[\s\S]*?<\/script>\n?/g, '')
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
  let source = bookingButtons(template, s)
  if (!ctx.email) source = emailOffFallbacks(source, String(s.emails?.public || '').trim())
  let html = fillDetails(source, ctx, errors, page.file)
  if (page.file !== '404.html') {
    if (!SEO_MARK.test(html)) errors?.push(`${page.file}: missing the <!-- @seo --> marker in <head>`)
    html = html.replace(SEO_MARK, () => seoBlock(html, page, s, ctx))
  }
  const tags = analyticsTags(s.tracking)
  if (tags) html = html.replace('</head>', `${tags}</head>`)
  // Google Tag Manager: first thing in <head>, and the noscript straight after <body> opens
  const gtm = gtmIdOf(s.tracking)
  if (gtm) {
    html = html.replace(/<head>\n?/, (m) => `${m.endsWith('\n') ? m : `${m}\n`}${gtmHead(gtm)}`)
    html = html.replace(/<body\b[^>]*>\n?/, (m) => `${m.endsWith('\n') ? m : `${m}\n`}${gtmBody(gtm)}`)
  }
  return html
}
