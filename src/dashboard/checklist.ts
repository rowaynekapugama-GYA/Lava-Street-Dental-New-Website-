/**
 * "Before opening day": everything still showing as a placeholder on the website, or still empty in the
 * practice details, each with a link straight to where it is filled in. Worked out from the dashboard's
 * own data every time the Dashboard opens, so items drop off as they are done.
 */
import type { Payload } from 'payload'
import type { SiteSettings } from '@/lib/site'
import { CHROME_SLUG, type PageDoc } from '@/sitekit/sync'
import type { Page } from '@/lib/parts'

export type CheckItem = { label: string; detail: string; href: string; gya?: boolean }

const PLACEHOLDER = /\[[A-Z][^\]<]{2,}\]|IMAGE:[^<]*|Compliance note \(must appear on page\):/

export async function openingChecklist(payload: Payload, s: SiteSettings): Promise<CheckItem[]> {
  const out: CheckItem[] = []
  const need = (ok: unknown, label: string, field: string, detail = 'Still empty, so the website leaves it out.') => {
    if (!ok || (Array.isArray(ok) && !ok.length)) out.push({ label, detail, href: `/admin/settings#${field}` })
  }
  need(s.address.streetAddress, 'Street address', 'streetAddress', `The website shows "${s.address.streetFallback}" until it is filled in.`)
  need(s.phone, 'Phone number', 'phone', 'Call buttons and phone links are hidden until it is filled in.')
  need(s.emails.public, 'Email address', 'publicEmail')
  need(s.hours, 'Opening hours', 'hours', 'The hours line is hidden until they are filled in.')
  need(s.openingDate, 'Opening date', 'openingDate', 'The home page says "Opening soon" until it is filled in.')
  need(s.socials.instagram, 'Instagram link', 'instagram', 'Add it once the account exists. Google reads it from the website.')
  need(s.socials.facebook, 'Facebook link', 'facebook', 'Add it once the page exists. Google reads it from the website.')

  // placeholders in the page wording
  const res = await payload.find({ collection: 'pages', limit: 500, depth: 0, pagination: false, overrideAccess: true, select: { title: true, pageSlug: true, model: true } })
  for (const d of res.docs as unknown as PageDoc[]) {
    if (d.pageSlug === CHROME_SLUG || !d.model) continue
    const model = JSON.parse(d.model) as Pick<Page, 'sections'>
    if (d.pageSlug === 'privacy-policy') continue
    for (const sec of model.sections ?? []) {
      if (sec.hidden) continue
      for (const f of sec.fields) {
        if (f.type !== 'text' && f.type !== 'richtext') continue
        const m = PLACEHOLDER.exec(f.value.replace(/<[^>]+>/g, ''))
        if (!m) continue
        const gya = /Compliance note/.test(m[0])
        out.push({
          label: `${d.title}: ${gya ? 'compliance label' : 'placeholder'}`,
          detail: m[0].replace(/\s+/g, ' ').slice(0, 110),
          href: `/admin/pages/${d.id}?section=${encodeURIComponent(sec.key)}`,
          gya,
        })
      }
    }
  }
  // the privacy policy must exist and be linked before the waitlist collects details
  const privacy = (res.docs as unknown as PageDoc[]).find((d) => d.pageSlug === 'privacy-policy')
  if (!privacy) out.push({ label: 'Privacy policy', detail: 'The waitlist collects names, emails and mobiles, so a privacy policy page is needed. Ask GYA.', href: '/admin/pages', gya: true })
  return out
}
