/**
 * Between a page document in the database and what the page editor works on.
 *
 * The editor only ever sends back words, links, photo choices, the section order and hidden flags. Section
 * markup always comes from the database, so nothing typed in the dashboard can change the approved design.
 * The rules are checked here, on the server, for the preview and for saving alike:
 * - compliance wording (isCompliance) only changes for GYA;
 * - footer headings and link words only change for GYA (footerEditable), like the menu;
 * - words are cleaned to plain text, or to simple inline markup (bold, italic, links) where the design has it;
 * - a photo is the website's own or one from the Media Library, nothing else;
 * - the first section (the page header) always stays first.
 */
import type { Payload } from 'payload'
import type { Chrome, Field, ListDef, Page, Part } from '@/lib/parts'
import { FIELD } from '@/lib/parts'
import { getChrome, getSeoDefaults } from '@/lib/content'
import { mergeSettings, type SiteSettings } from '@/lib/site'
import { footerEditable, isCompliance } from '@/dashboard/render'
import {
  CHROME_SLUG, docToChrome, docToPage, mediaUrl, pageToDoc, photoMaps, resolvePhotos, settingsFileFromGlobal,
  type MediaDoc, type PageDoc, type PhotoMaps,
} from '@/sitekit/sync'

export type EField = Field & { locked?: boolean }
export type EList = ListDef & { count: number; items: string[] }
export type ESection = {
  key: string
  label: string
  kind: string
  hidden: boolean
  /** the page header: always first, never hidden */
  pinned: boolean
  /** the menu or a button elsewhere on the site jumps here */
  menuLinked: boolean
  anchor: string | null
  fields: EField[]
  lists: EList[]
}
export type SectionEdit = { key: string; hidden?: boolean; fields?: { id: string; value: string; media?: number | string | null }[] }
export type SharedEdit = { name: string; fields: { id: string; value: string }[] }

// ---------------------------------------------------------------- loading

export async function loadPage(payload: Payload, id: number | string): Promise<{ doc: PageDoc; page: Page; maps: PhotoMaps } | null> {
  const doc = await payload.findByID({ collection: 'pages', id, depth: 1, overrideAccess: true }).catch(() => null) as PageDoc | null
  if (!doc || doc.pageSlug === CHROME_SLUG || !doc.model) return null
  const maps = await photoMaps(payload)
  return { doc, page: docToPage(doc, maps), maps }
}

export async function loadChrome(payload: Payload): Promise<{ id: number | string | null; chrome: Chrome }> {
  const r = await payload.find({ collection: 'pages', where: { pageSlug: { equals: CHROME_SLUG } }, limit: 1, depth: 0, overrideAccess: true })
  const d = r.docs[0] as unknown as PageDoc | undefined
  return { id: d?.id ?? null, chrome: docToChrome(d, getChrome()) }
}

/** Site Settings as saved in the dashboard (the preview shows the practice details as they will go live). */
export async function settingsFromDashboard(payload: Payload): Promise<SiteSettings> {
  const g = await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }).catch(() => null)
  const s = mergeSettings(settingsFileFromGlobal(g as never))
  const seo = await payload.findGlobal({ slug: 'seo', depth: 1, overrideAccess: true }).catch(() => null) as { shareImage?: MediaDoc | null; shareImageAlt?: string } | null
  const share = seo?.shareImage && typeof seo.shareImage === 'object' ? seo.shareImage : null
  if (share && mediaUrl(share)) s.shareImage = { path: mediaUrl(share)!, width: share.width ?? 1200, height: share.height ?? 630, alt: seo?.shareImageAlt || share.alt || '' }
  return s
}

export function titleFormat(): string {
  return getSeoDefaults().titleFormat || 'Page name | Lava Street Dental'
}

// ---------------------------------------------------------------- the editor's view of a page

/** Section anchors that the menu or the site's buttons jump to (hiding them leaves those links going nowhere). */
export function linkedAnchors(page: Page): Set<string> {
  const out = new Set<string>()
  const header = page.head.slice(page.head.indexOf('<header'))
  for (const m of header.matchAll(/href="[^"]*?#([\w-]+)/g)) out.add(m[1])
  if (page.path === '/') out.add('waitlist') // every "Join the waitlist" button on the site lands here
  out.delete('main')
  return out
}

export function sectionsForEditor(page: Page, admin: boolean): ESection[] {
  const anchors = linkedAnchors(page)
  const ordered = page.order.filter((s) => s.startsWith('section:')).map((s) => page.sections[Number(s.slice(8))]).filter(Boolean)
  return ordered.map((s, i) => {
    const ids = [s.attrs.id, ...[...s.template.matchAll(/\sid="([\w-]+)"/g)].map((m) => m[1])].filter(Boolean) as string[]
    return {
      key: s.key,
      label: s.label || 'Section',
      kind: s.kind,
      hidden: !!s.hidden,
      pinned: i === 0,
      menuLinked: ids.some((x) => anchors.has(x)),
      anchor: s.attrs.id ?? null,
      fields: s.fields.filter((f) => f.type !== 'srcset').map((f) => ({ ...f, locked: !admin && isCompliance(f) })),
      lists: (s.lists ?? []).map((l) => {
        const items = itemSummaries(s, l.id)
        return { ...l, count: items.length, items }
      }),
    }
  })
}

export const countItems = (template: string, id: string) => (template.match(new RegExp(`\\{\\{\\[${id}\\]\\}\\}`, 'g')) ?? []).length

/** The first words of each item, so the Sections tab can name them ("Check-ups & gentle cleans"). */
function itemSummaries(s: Part, id: string): string[] {
  const byId = new Map(s.fields.map((f) => [f.id, f]))
  return [...s.template.matchAll(markers(id))].map((m, i) => {
    const words = [...m[0].matchAll(FIELD)].map((x) => byId.get(x[1])).filter((f) => f && (f.type === 'text' || f.type === 'richtext'))
      .map((f) => f!.value.replace(/<[^>]+>/g, '').replace(/\{\{\{?\w+\}?\}\}/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()).filter(Boolean)
    const name = words.find((w) => w.length > 3) ?? words[0]
    return name ? (name.length > 60 ? `${name.slice(0, 57)}...` : name) : `Item ${i + 1}`
  })
}

// ---------------------------------------------------------------- cleaning what the editor sends

const ALLOWED = new Set(['a', 'em', 'strong', 'b', 'i', 'br', 'span', 'sup', 'sub', 'small'])

const safeHref = (h: string) => {
  const v = h.trim()
  if (/^(javascript|data|vbscript):/i.test(v.replace(/\s+/g, ''))) return ''
  return v
}
const attrEsc = (v: string) => v.replace(/&(?![a-zA-Z]+;|#\d+;|#x[0-9a-fA-F]+;)/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/** Simple inline markup only: bold, italic, links, line breaks and the design's own spans. */
export function cleanRich(v: string): string {
  return String(v ?? '').replace(/<\/?([a-zA-Z][\w-]*)([^>]*)>/g, (whole, tag: string, attrs: string) => {
    const t = tag.toLowerCase()
    if (!ALLOWED.has(t)) return ''
    if (whole.startsWith('</')) return t === 'br' ? '' : `</${t}>`
    if (t === 'a') {
      const href = /\shref="([^"]*)"/i.exec(attrs)?.[1] ?? ''
      const ext = /^https?:\/\//i.test(href) && !/lavastreetdental\.com\.au/i.test(href)
      return `<a href="${attrEsc(safeHref(href))}"${ext ? ' target="_blank" rel="noopener"' : ''}>`
    }
    if (t === 'span') {
      const cls = /\sclass="([\w\s-]*)"/i.exec(attrs)?.[1]
      return cls ? `<span class="${cls}">` : '<span>'
    }
    return `<${t}>`
  })
}

/** Plain words: no markup at all, quotes left as typed. */
export const cleanText = (v: string) => String(v ?? '').replace(/<[^>]*>/g, '').replace(/&(?![a-zA-Z]+;|#\d+;|#x[0-9a-fA-F]+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** A photo description goes inside alt="...". */
export const cleanAlt = (v: string) => cleanText(v).replace(/"/g, '&quot;')

export const cleanHref = (v: string) => attrEsc(safeHref(String(v ?? '')))

/** The practice details tokens a value may hold ({{phone}}); anything else that looks like one is dropped. */
const TOKEN_OK = /^\{\{\{?(name|phone|phoneHref|email|streetAddress|addressStreet|addressLine|localityLine|hoursHtml|openingDate|mapQuery)\}?\}\}$/
function keepTokens(v: string): string {
  return v.replace(/\{\{[^}]*\}\}\}?/g, (t) => (TOKEN_OK.test(t) ? t : ''))
}

function cleanValue(f: Field, value: string): string {
  switch (f.type) {
    case 'richtext': return keepTokens(cleanRich(value))
    case 'text': return keepTokens(cleanText(value))
    case 'alt': return cleanAlt(value)
    case 'href': return cleanHref(value)
    default: return f.value
  }
}

// ---------------------------------------------------------------- applying edits

const cleanEdits = (raw: unknown): SectionEdit[] =>
  Array.isArray(raw)
    ? raw.filter((s) => s && typeof s.key === 'string').map((s) => ({
      key: String(s.key),
      hidden: typeof s.hidden === 'boolean' ? s.hidden : undefined,
      fields: Array.isArray(s.fields)
        ? s.fields
          .filter((f: unknown) => f && typeof (f as { id?: unknown }).id === 'string' && typeof (f as { value?: unknown }).value === 'string')
          .map((f: { id: string; value: string; media?: unknown }) => ({
            id: f.id, value: f.value, media: typeof f.media === 'number' || typeof f.media === 'string' ? f.media : null,
          }))
        : undefined,
    }))
    : []

function applyFields(part: Part, edits: SectionEdit['fields'], admin: boolean, maps: PhotoMaps): Part {
  if (!edits?.length) return part
  const vals = new Map(edits.map((f) => [f.id, f]))
  const fields = part.fields.map((f) => {
    const e = vals.get(f.id)
    if (!e || f.type === 'srcset') return f
    if (f.type === 'image') {
      if ((e.media ?? null) === (f.media ?? null)) return f
      const media = e.media ?? null
      if (media !== null && maps.byId.has(String(media))) return { ...f, media, value: mediaUrl(maps.byId.get(String(media))!) ?? f.value }
      return { ...f, media: null, value: f.original ?? f.value }
    }
    // only what was changed is cleaned, so untouched wording stays exactly as approved
    if (e.value === f.value) return f
    if (!admin && isCompliance(f)) return f
    const value = cleanValue(f, e.value)
    if (f.type === 'href') {
      const ext = /^https?:\/\//i.test(value) && !/lavastreetdental\.com\.au/i.test(value)
      return { ...f, value, ...(ext ? { newTab: true } : { newTab: undefined }) }
    }
    return { ...f, value }
  })
  return { ...part, fields: resolvePhotos(fields, maps) }
}

/** The page with the editor's changes on top (field values, order, hidden), checked against the rules. */
export function pageWithEdits(page: Page, rawEdits: unknown, admin: boolean, maps: PhotoMaps): Page {
  if (rawEdits === undefined) return page
  const edits = cleanEdits(rawEdits)
  const ordered = page.order.filter((s) => s.startsWith('section:')).map((s) => page.sections[Number(s.slice(8))]).filter(Boolean)
  const first = ordered[0]
  const byKey = new Map(ordered.map((p) => [p.key, p]))
  const apply = (base: Part, e: SectionEdit) => ({ ...applyFields(base, e.fields, admin, maps), hidden: base === first ? false : !!e.hidden })
  // the editor sends every section in its new order; a form that sends one section (Team) changes only that one
  const complete = ordered.every((p) => edits.some((e) => e.key === p.key))
  const next: Part[] = []
  if (complete) {
    for (const e of edits) {
      const base = byKey.get(e.key)
      if (!base) continue
      byKey.delete(e.key)
      next.push(apply(base, e))
    }
  } else {
    const byEdit = new Map(edits.map((e) => [e.key, e]))
    for (const p of ordered) {
      const e = byEdit.get(p.key)
      next.push(e ? apply(p, { ...e, hidden: e.hidden ?? !!p.hidden }) : p)
      byKey.delete(p.key)
    }
  }
  for (const p of byKey.values()) next.push(p)
  // the page header stays at the top whatever order arrives
  const sections = first ? [next.find((p) => p.key === first.key)!, ...next.filter((p) => p.key !== first.key)] : next
  return { ...page, sections, order: sections.map((_, i) => `section:${i}`) }
}

/** Footer words with the editor's changes, for the preview and for saving. */
export function chromeWithEdits(chrome: Chrome, raw: unknown, admin: boolean): { chrome: Chrome; changed: boolean } {
  const part = chrome.parts.footer
  if (!part || !Array.isArray(raw)) return { chrome, changed: false }
  const e = (raw as SharedEdit[]).find((x) => x && x.name === 'footer' && Array.isArray(x.fields))
  if (!e) return { chrome, changed: false }
  const vals = new Map(e.fields.filter((f) => typeof f?.id === 'string' && typeof f?.value === 'string').map((f) => [f.id, f.value]))
  let changed = false
  const fields = part.fields.map((f) => {
    if (!vals.has(f.id) || vals.get(f.id) === f.value || !footerEditable(f, admin) || (!admin && isCompliance(f))) return f
    const value = cleanValue(f, vals.get(f.id)!)
    if (value !== f.value) changed = true
    return { ...f, value }
  })
  return { chrome: { parts: { ...chrome.parts, footer: { ...part, fields } } }, changed }
}

// ---------------------------------------------------------------- saving

export async function savePage(payload: Payload, doc: PageDoc, page: Page, seo: Record<string, unknown> | undefined, admin: boolean) {
  const data = pageToDoc(page) as Record<string, unknown>
  // the columns keep the photo in use as a Media Library id
  if (seo) {
    // the share image lives in its own column once it is set here
    const model = JSON.parse(String(data.model))
    if (model.meta) delete model.meta.ogImage
    data.model = JSON.stringify(model)
    data.metaTitle = cleanSeo(seo.title, 120)
    data.metaDescription = cleanSeo(seo.description, 320)
    data.noindex = !!seo.noindex
    data.ogImage = seo.ogImageMedia ?? null
    if (admin && typeof seo.canonical === 'string') data.canonical = seo.canonical.trim()
    else delete data.canonical
  } else {
    delete data.metaTitle
    delete data.metaDescription
    delete data.noindex
    delete data.canonical
  }
  delete data.pageSlug
  delete data.title
  delete data.path
  delete data.group
  await payload.update({ collection: 'pages', id: doc.id, data: data as never, overrideAccess: true, depth: 0 })
}

const cleanSeo = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)

export async function saveChrome(payload: Payload, id: number | string, chrome: Chrome) {
  await payload.update({ collection: 'pages', id, data: { model: JSON.stringify(chrome.parts.footer) } as never, overrideAccess: true, depth: 0 })
}

// ---------------------------------------------------------------- repeating items

const markers = (id: string) => new RegExp(`\\{\\{\\[${id}\\]\\}\\}[\\s\\S]*?\\{\\{\\[\\/${id}\\]\\}\\}`, 'g')

/**
 * Add a copy of an item, remove one, or move one up or down. Copies get their own fields (same words to
 * start with) and their own element ids (a question's answer panel), so nothing on the page clashes.
 */
export function changeItems(part: Part, listId: string, op: 'duplicate' | 'remove' | 'up' | 'down', index: number): Part {
  const re = markers(listId)
  const found = [...part.template.matchAll(re)]
  if (!found.length || index < 0 || index >= found.length) throw new Error('That item is no longer on the page. Reload and try again.')
  const items = found.map((m) => m[0])
  const seps: string[] = []
  for (let i = 0; i < found.length - 1; i++) seps.push(part.template.slice(found[i].index! + found[i][0].length, found[i + 1].index!))
  const sep = seps[0] ?? '\n'
  const start = found[0].index!
  const end = found[found.length - 1].index! + found[found.length - 1][0].length
  let fields = [...part.fields]

  if (op === 'remove') {
    if (items.length <= 1) throw new Error('This list needs at least one item. Change its words instead.')
    items.splice(index, 1)
  } else if (op === 'up' || op === 'down') {
    const to = op === 'up' ? index - 1 : index + 1
    if (to < 0 || to >= items.length) return part
    ;[items[index], items[to]] = [items[to], items[index]]
  } else {
    let next = Math.max(0, ...fields.map((f) => Number(f.id.slice(1)) || 0))
    const remap = new Map<string, string>()
    let copy = items[index].replace(FIELD, (_m, id: string) => {
      if (!remap.has(id)) remap.set(id, `f${++next}`)
      return `{{${remap.get(id)}}}`
    })
    // element ids inside the copy, and what points at them, get a fresh suffix
    const taken = new Set([...part.template.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))
    for (const m of [...copy.matchAll(/\sid="([^"]+)"/g)]) {
      const old = m[1]
      let n = 2
      while (taken.has(`${old}-${n}`)) n++
      const fresh = `${old}-${n}`
      taken.add(fresh)
      copy = copy.replace(new RegExp(`(\\s(?:id|for|aria-controls|aria-labelledby|aria-describedby)=")${old}(")`, 'g'), `$1${fresh}$2`)
        .replace(new RegExp(`href="#${old}"`, 'g'), `href="#${fresh}"`)
    }
    const added: Field[] = []
    for (const [from, to] of remap) {
      const f = fields.find((x) => x.id === from)
      if (f) added.push({ ...f, id: to, ...(f.of && remap.has(f.of) ? { of: remap.get(f.of) } : {}) })
    }
    fields = [...fields, ...added]
    items.splice(index + 1, 0, copy)
  }

  const joined = items.map((it, i) => (i === 0 ? it : (seps[i - 1] ?? sep) + it)).join('')
  const template = part.template.slice(0, start) + joined + part.template.slice(end)
  // fields no longer on the page go
  const used = new Set([...template.matchAll(FIELD)].map((m) => m[1]))
  fields = fields.filter((f) => used.has(f.id))
  return { ...part, template, fields }
}
