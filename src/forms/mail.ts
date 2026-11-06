/**
 * Shared helpers for the website forms (/api/waitlist/ and /api/enquiry/), ported from the v1.2.2 Vercel
 * functions (api/_lib/forms.js) unchanged in behaviour.
 *
 * Email goes through the SMTP2GO HTTP API (v3), the same relay as the other GYA sites. Environment
 * variables, set in Vercel > Settings > Environment Variables:
 *   SMTP2GO_API_KEY  SMTP2GO API key (required; the forms answer 503 without it)
 *   FORM_FROM        sender on the SMTP2GO-verified domain, for example
 *                    "Lava Street Dental <hello@lavastreetdental.com.au>"
 *   FORM_TO          optional: recipients, separated by commas. Otherwise the list in Site Settings
 *                    (dashboard, GYA only), then FALLBACK_TO below.
 *   SMTP2GO_ENDPOINT optional: override the API address (testing only)
 */
import type { SiteSettings } from '@/lib/site'

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i

export const clean = (v: unknown, max = 200) =>
  String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)

export const cleanMultiline = (v: unknown, max = 2000) =>
  String(v ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim().slice(0, max)

export const isEmail = (v: string) => v.length <= 254 && EMAIL_RE.test(v)

/** Australian numbers: mobiles (04) and landlines (02, 03, 07, 08), with or without +61. */
export function auPhone(v: unknown): string {
  let d = String(v ?? '').replace(/[\s().-]/g, '')
  if (d.startsWith('+61')) d = '0' + d.slice(3)
  else if (d.startsWith('61') && d.length === 11) d = '0' + d.slice(2)
  if (!/^0[2-478]\d{8}$/.test(d)) return ''
  return d.startsWith('04') ? `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}`
}

export const escapeHtml = (v: unknown) =>
  String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

// Best-effort rate limit: 5 submissions per address per 10 minutes, per function instance.
const WINDOW_MS = 10 * 60 * 1000
const LIMIT = 5
const hits = new Map<string, number[]>()
export function rateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 5000) for (const [key, times] of hits) if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key)
  return recent.length > LIMIT
}

export const clientIp = (req: Request) =>
  String(req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown').split(',')[0].trim()

/** Honeypot and timing: people do not fill the hidden field, or submit within two seconds of loading. */
export function looksLikeBot(body: Record<string, unknown>): boolean {
  if (clean(body.company)) return true
  const started = Number(body.startedAt)
  return Number.isFinite(started) && started > 0 && Date.now() - started < 2000
}

export async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const text = await req.text()
    if (!text) return {}
    const b = JSON.parse(text)
    return b && typeof b === 'object' ? b : {}
  } catch {
    return null
  }
}

export const send = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })

/** Recipients when neither FORM_TO nor Site Settings name any: the practice inbox and GYA. */
export const FALLBACK_TO = ['info@lavastreetdental.com.au', 'rowayne@gyaclients.com']
const FALLBACK_FROM = 'Lava Street Dental <hello@lavastreetdental.com.au>'

export type MailSettings = { ok: boolean; apiKey: string; to: string[]; from: string; endpoint: string }

export function mailSettings(s?: SiteSettings): MailSettings {
  const apiKey = String(process.env.SMTP2GO_API_KEY || '').trim()
  const listed = String(process.env.FORM_TO || '').split(',').map((x) => x.trim()).filter(Boolean)
  const fromSettings = (s?.formRecipients ?? []).map((x) => String(x).trim()).filter(isEmail)
  const to = listed.length ? listed : fromSettings.length ? fromSettings : FALLBACK_TO
  const from = String(process.env.FORM_FROM || '').trim() || FALLBACK_FROM
  const endpoint = String(process.env.SMTP2GO_ENDPOINT || '').trim() || 'https://api.smtp2go.com/v3/email/send'
  return { ok: Boolean(apiKey), apiKey, to, from, endpoint }
}

export type Message = { to: string[]; reply_to?: string; subject: string; html: string; text: string }

export async function sendEmail(settings: MailSettings, message: Message) {
  const r = await fetch(settings.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Smtp2go-Api-Key': settings.apiKey },
    body: JSON.stringify({
      sender: settings.from,
      to: message.to,
      subject: message.subject,
      html_body: message.html,
      text_body: message.text,
      custom_headers: message.reply_to ? [{ header: 'Reply-To', value: message.reply_to }] : [],
    }),
  })
  const data = (await r.json().catch(() => ({}))) as { data?: { failed?: number; error?: string } }
  // SMTP2GO can answer 200 with failures listed, so check both.
  if (!r.ok || !data.data || (data.data.failed ?? 0) > 0 || data.data.error) {
    throw new Error(`SMTP2GO ${r.status}: ${JSON.stringify(data.data || data).slice(0, 300)}`)
  }
  return data.data
}

export function practiceFor(s: SiteSettings) {
  const site = String(s.siteUrl).replace(/\/+$/, '')
  const a = s.address
  return {
    name: s.name,
    phone: s.phone,
    email: s.emails.public,
    address: [a.streetAddress || a.streetFallback, `${a.locality} ${a.region} ${a.postcode}`].join(', '),
    openingDate: s.openingDate,
    site,
    privacyUrl: `${site}/privacy-policy/`,
  }
}

export function emailHtml(title: string, paragraphs: string[], footer = ''): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#292826">${p}</p>`).join('')
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#F4F1EA;font-family:Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #BDB4A3;border-radius:12px">
<tr><td style="padding:28px 28px 8px"><p style="margin:0 0 20px;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:#575A4D">Lava Street Dental</p>
<h1 style="margin:0 0 18px;font-size:22px;font-weight:500;color:#292826">${title}</h1>${body}</td></tr>
<tr><td style="padding:0 28px 24px;font-size:13px;line-height:1.6;color:#575A4D">${footer}</td></tr></table></body></html>`
}

export function detailsTable(rows: [string, string][]): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:15px;color:#292826">${rows
    .map(([k, v]) => `<tr><td style="padding:6px 16px 6px 0;color:#575A4D;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:6px 0;vertical-align:top">${v}</td></tr>`)
    .join('')}</table>`
}

export const melbourneTime = () =>
  new Intl.DateTimeFormat('en-AU', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Australia/Melbourne' }).format(new Date())

/** Which page a form was sent from, as a site path (the Referer header). */
export function pageFrom(req: Request): string {
  try {
    const ref = req.headers.get('referer')
    return ref ? new URL(ref).pathname : ''
  } catch {
    return ''
  }
}
