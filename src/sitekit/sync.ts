/**
 * Between the content files (content/) and the dashboard's database.
 *
 *   import (seed):  content/pages/*.json, chrome.json, Site Settings, redirects  ->  Postgres
 *   pull (build):   Postgres  ->  the same files, which scripts/render-site.ts turns into the website
 *
 * Seed then pull gives the files back unchanged (scripts/qa-roundtrip.ts), which is how the build from the
 * database is proven to match the build from the files.
 */
import type { Payload } from 'payload'
import type { Chrome, Field, Page, Redirect } from '@/lib/parts'
import { DEFAULTS, type SiteSettings } from '@/lib/site'

export type MediaDoc = {
  id: number | string
  url?: string | null
  filename?: string | null
  alt?: string | null
  builtIn?: string | null
  replaced?: boolean | null
  focalX?: number | null
  focalY?: number | null
  width?: number | null
  height?: number | null
  sizes?: { thumb?: { url?: string | null } }
}

export type PageDoc = {
  id: number | string
  pageSlug: string
  title: string
  path?: string | null
  group?: string | null
  metaTitle?: string | null
  metaDescription?: string | null
  ogImage?: MediaDoc | number | string | null
  noindex?: boolean | null
  canonical?: string | null
  model?: string | null
  updatedAt?: string
}

/** Page minus the parts kept as their own columns. */
type Model = Omit<Page, 'slug' | 'name' | 'path' | 'group'>

/** Root-relative for files Payload serves itself, absolute for Vercel Blob. */
export function mediaUrl(d: MediaDoc | number | string | null | undefined): string | null {
  if (!d || typeof d !== 'object') return null
  const raw = d.url || (d.filename ? `/api/media/file/${d.filename}` : '')
  if (!raw) return null
  if (/^https?:\/\//i.test(raw) && !raw.includes('/api/media/')) return raw
  const u = new URL(raw, 'http://local.invalid')
  return u.pathname.replace(/\/+$/, '') + u.search
}

/** A website photo path without its ../ prefix: assets/images/dr-meg.webp */
export const builtInKey = (p: string) => String(p || '').replace(/^(\.\.\/)+|^\//, '')

const relId = (v: unknown): number | string | null =>
  v && typeof v === 'object' ? ((v as { id?: number | string }).id ?? null) : ((v as number | string | null) ?? null)

// ---------------------------------------------------------------- pages

export function pageToDoc(page: Page): Omit<PageDoc, 'id'> {
  const { slug, name, path, group, meta, ...rest } = page
  const { title, description, noindex, canonical, ...otherMeta } = meta ?? {}
  const model: Model = { ...rest, meta: otherMeta }
  return {
    pageSlug: slug,
    title: name,
    path,
    group: group ?? null,
    metaTitle: title ?? '',
    metaDescription: description ?? '',
    noindex: !!noindex,
    canonical: canonical ?? '',
    model: JSON.stringify(model),
  }
}

export type PhotoMaps = { byId: Map<string, MediaDoc>; replacedBuiltIn: Map<string, string> }

export async function photoMaps(payload: Payload): Promise<PhotoMaps> {
  const res = await payload.find({ collection: 'media', limit: 2000, depth: 0, pagination: false, overrideAccess: true })
  const byId = new Map<string, MediaDoc>()
  const replacedBuiltIn = new Map<string, string>()
  for (const d of res.docs as unknown as MediaDoc[]) {
    byId.set(String(d.id), d)
    const url = mediaUrl(d)
    if (d.builtIn && d.replaced && url) replacedBuiltIn.set(builtInKey(d.builtIn), url)
  }
  return { byId, replacedBuiltIn }
}

/** Image fields with their current photo: a library choice, a replaced website photo, or the original. */
export function resolvePhotos(fields: Field[], maps: PhotoMaps): Field[] {
  return fields.map((f) => {
    if (f.type !== 'image') return f
    const original = f.original ?? f.value
    if (f.media !== undefined && f.media !== null && f.media !== '') {
      const d = maps.byId.get(String(f.media))
      const url = d ? mediaUrl(d) : null
      if (url) {
        const focal = d && typeof d.focalX === 'number' && typeof d.focalY === 'number' && (Math.round(d.focalX) !== 50 || Math.round(d.focalY) !== 50)
          ? `${Math.round(d.focalX)}% ${Math.round(d.focalY)}%` : undefined
        return { ...f, value: url, original, ...(focal ? { focal } : { focal: undefined }) }
      }
      return { ...f, media: null, value: original, original }
    }
    const replaced = maps.replacedBuiltIn.get(builtInKey(original))
    return { ...f, value: replaced ?? original, original }
  })
}

export function docToPage(doc: PageDoc, maps?: PhotoMaps): Page {
  const model = JSON.parse(doc.model || '{}') as Model
  const og = doc.ogImage && typeof doc.ogImage === 'object' ? mediaUrl(doc.ogImage) : null
  const meta = {
    ...(model.meta ?? {}),
    title: doc.metaTitle ?? '',
    description: doc.metaDescription ?? '',
    ...(og ? { ogImage: og } : {}),
    ...(doc.noindex ? { noindex: true } : {}),
    ...(doc.canonical ? { canonical: doc.canonical } : {}),
  }
  const sections = (model.sections ?? []).map((s) => ({ ...s, fields: maps ? resolvePhotos(s.fields, maps) : s.fields }))
  // keys in the same order as the content files
  return {
    slug: doc.pageSlug,
    name: doc.title,
    path: doc.path ?? '',
    file: model.file,
    group: doc.group ?? undefined,
    meta,
    head: model.head,
    sections,
    order: model.order,
    mainEnd: model.mainEnd,
    afterMain: model.afterMain,
    footer: model.footer,
    tail: model.tail,
    ...(model.faqSchema ? { faqSchema: model.faqSchema } : {}),
  } as Page
}

/** The content file layout of a page (meta keys in their file order, nothing empty). */
export function pageForFile(p: Page): Page {
  const m = p.meta ?? {}
  const meta: Page['meta'] = {}
  if (m.title !== undefined) meta.title = m.title
  if (m.description !== undefined) meta.description = m.description
  if (m.ogTitle) meta.ogTitle = m.ogTitle
  if (m.ogDescription) meta.ogDescription = m.ogDescription
  if (m.ogImage) meta.ogImage = m.ogImage
  if (m.canonical) meta.canonical = m.canonical
  if (m.noindex) meta.noindex = true
  const out: Record<string, unknown> = { slug: p.slug, name: p.name, path: p.path, file: p.file, group: p.group, meta, head: p.head }
  if (p.faqSchema) out.faqSchema = p.faqSchema
  Object.assign(out, {
    sections: p.sections.map((s) => {
      const o: Record<string, unknown> = { key: s.key, kind: s.kind, label: s.label, tag: s.tag, attrs: s.attrs, before: s.before, template: s.template, fields: s.fields.map(fieldForFile) }
      if (s.lists?.length) o.lists = s.lists
      if (s.hidden) o.hidden = true
      return o
    }),
    order: p.order, mainEnd: p.mainEnd, afterMain: p.afterMain, footer: p.footer, tail: p.tail,
  })
  return out as Page
}

/** A field as the content files keep it: the photo in use, the original it shipped with. */
export function fieldForFile(f: Field): Field {
  const o: Field = { id: f.id, label: f.label, type: f.type, value: f.value }
  if (f.original !== undefined) o.original = f.original
  if (f.media !== undefined && f.media !== null && f.media !== '') o.media = f.media
  if (f.width !== undefined) o.width = f.width
  if (f.height !== undefined) o.height = f.height
  if (f.of !== undefined) o.of = f.of
  if (f.newTab) o.newTab = true
  if (f.focal) o.focal = f.focal
  return o
}

// ---------------------------------------------------------------- the footer

export const CHROME_SLUG = '_chrome-footer'

export function chromeToDoc(chrome: Chrome): Omit<PageDoc, 'id'> {
  return { pageSlug: CHROME_SLUG, title: 'Footer', path: '', group: 'Shared', metaTitle: '', metaDescription: '', noindex: false, canonical: '', model: JSON.stringify(chrome.parts.footer) }
}

export function docToChrome(doc: PageDoc | null | undefined, fallback: Chrome): Chrome {
  if (!doc?.model) return fallback
  return { parts: { ...fallback.parts, footer: JSON.parse(doc.model) } }
}

// ---------------------------------------------------------------- Site Settings

type G = Record<string, any>
const lines = (a: unknown): string[] => (Array.isArray(a) ? a.map((x) => String(x?.line ?? x?.email ?? '').trim()).filter(Boolean) : [])
const rows = (a: string[] | undefined, key = 'line') => (a ?? []).map((v) => ({ [key]: v }))

export function globalFromSettings(s: SiteSettings): G {
  return {
    name: s.name, phone: s.phone, publicEmail: s.emails.public,
    streetAddress: s.address.streetAddress, locality: s.address.locality, region: s.address.region, postcode: s.address.postcode,
    postalAddress: s.postalAddress, mapsUrl: s.mapsUrl,
    hours: rows(s.hours), hoursSchema: rows(s.hoursSchema), openingDate: s.openingDate,
    socials: { ...s.socials }, bookingUrl: s.bookingUrl, healthFunds: s.healthFunds,
    siteUrl: s.siteUrl, preOpening: s.preOpening, paymentAccepted: rows(s.paymentAccepted),
    formRecipients: rows(s.formRecipients, 'email'), tracking: { ...s.tracking }, features: { ...s.features },
  }
}

/** What content/site-settings.json holds: only values that differ from site.config.mjs, in its shape. */
export function settingsFileFromGlobal(g: G | null | undefined): Record<string, unknown> {
  if (!g) return {}
  const str = (v: unknown) => (v === null || v === undefined ? undefined : String(v))
  const full: Record<string, unknown> = {
    name: str(g.name),
    siteUrl: str(g.siteUrl),
    phone: str(g.phone),
    emails: g.publicEmail !== undefined ? { public: str(g.publicEmail) ?? '' } : undefined,
    address: {
      streetAddress: str(g.streetAddress), locality: str(g.locality), region: str(g.region), postcode: str(g.postcode),
    },
    hours: g.hours !== undefined ? lines(g.hours) : undefined,
    hoursSchema: g.hoursSchema !== undefined ? lines(g.hoursSchema) : undefined,
    openingDate: str(g.openingDate),
    preOpening: typeof g.preOpening === 'boolean' ? g.preOpening : undefined,
    paymentAccepted: g.paymentAccepted !== undefined ? lines(g.paymentAccepted) : undefined,
    socials: g.socials ? { instagram: str(g.socials.instagram) ?? '', facebook: str(g.socials.facebook) ?? '', google: str(g.socials.google) ?? '' } : undefined,
    postalAddress: str(g.postalAddress),
    mapsUrl: str(g.mapsUrl),
    bookingUrl: str(g.bookingUrl),
    healthFunds: str(g.healthFunds),
    tracking: g.tracking ? { ga4: str(g.tracking.ga4) ?? '', metaPixel: str(g.tracking.metaPixel) ?? '', gtmId: str(g.tracking.gtmId) ?? '' } : undefined,
    formRecipients: g.formRecipients !== undefined ? lines(g.formRecipients) : undefined,
    features: g.features ? { blog: !!g.features.blog, beforeAfter: !!g.features.beforeAfter } : undefined,
  }
  // keep only what differs from the approved defaults, so an untouched dashboard writes {}
  const out: Record<string, unknown> = {}
  const D = DEFAULTS as unknown as Record<string, unknown>
  for (const [k, v] of Object.entries(full)) {
    if (v === undefined) continue
    const base = D[k]
    if (v && typeof v === 'object' && !Array.isArray(v) && base && typeof base === 'object' && !Array.isArray(base)) {
      const diff: Record<string, unknown> = {}
      for (const [kk, vv] of Object.entries(v as object)) {
        if (vv === undefined) continue
        if (JSON.stringify(vv) !== JSON.stringify((base as Record<string, unknown>)[kk])) diff[kk] = vv
      }
      if (Object.keys(diff).length) out[k] = diff
    } else if (JSON.stringify(v) !== JSON.stringify(base)) {
      out[k] = v
    }
  }
  return out
}

// ---------------------------------------------------------------- redirects

export type RedirectDoc = { from: string; to: string; type?: string | null }
export const redirectFromDoc = (d: RedirectDoc): Redirect => ({ from: d.from, to: d.to, type: d.type === 'temporary' ? 'temporary' : 'permanent' })

export { relId }
