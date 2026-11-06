/**
 * The content model the public site is built from (content/pages/*.json, content/chrome.json).
 *
 * A page is its head (everything up to <main id="main">, with the SEO values as {{seo:...}} tokens), its
 * sections, the footer and what follows it. Each section is its own approved markup with every editable value
 * replaced by a {{fN}} placeholder, plus the values (Heading, Paragraph, Photo, Button link ...). Repeating
 * items (cards, questions, tags, steps) sit between {{[Ln]}} and {{[/Ln]}} so they can be added, copied,
 * moved and removed; those markers never reach the website.
 *
 * Practice details stay as the site's own tokens ({{phone}}, {{#preOpening}}...{{/preOpening}}) and are
 * filled from Site Settings when the page is written (src/lib/staticSite.ts), so an unedited page comes out
 * byte for byte as approved (scripts/qa-parity.ts).
 */

/** srcset: the sizes a photo comes in; follows its photo (`of`) and drops back to the one file once replaced. */
export type FieldType = 'richtext' | 'text' | 'href' | 'image' | 'alt' | 'srcset'

export type Field = {
  id: string
  label: string
  type: FieldType
  value: string
  /** image: the photo the site shipped with (a path inside public/) */
  original?: string
  /** image: the Media Library photo chosen instead, if any */
  media?: number | string | null
  /** srcset: the photo field it belongs to */
  of?: string
  width?: string | null
  height?: string | null
  /** href: set when the dashboard pointed the link at another website, so it opens in a new tab */
  newTab?: boolean
  /** image: the focal point chosen for a Media Library photo, "40% 30%" */
  focal?: string
}

export type ListDef = {
  id: string
  /** "Care cards" */
  label: string
  /** "Card" */
  item: string
  /** only GYA adds or removes these (team cards need an approved design for more people) */
  adminOnly?: boolean
}

export type Part = {
  key: string
  kind: string
  label: string
  tag: string
  attrs: Record<string, string | null>
  /** whitespace before the section in the page source; travels with it when sections are moved */
  before?: string
  template: string
  fields: Field[]
  lists?: ListDef[]
  hidden?: boolean
}

export type PageMeta = {
  title?: string
  description?: string
  /** share title and description when they differ from the page title and description */
  ogTitle?: string
  ogDescription?: string
  /** a site path or full URL; blank uses the default share picture */
  ogImage?: string
  canonical?: string
  noindex?: boolean
}

export type Page = {
  slug: string
  name: string
  path: string
  /** the page's file in the site, e.g. about/index.html */
  file: string
  group?: string
  meta: PageMeta
  /** <!DOCTYPE html> to <main id="main">, with {{seo:...}} and {{gen:faqSchema}} */
  head: string
  sections: Part[]
  order: string[]
  /** between the last section and </main> */
  mainEnd: string
  /** from </main> up to the footer */
  afterMain: string
  /** this page's footer with the shared footer words as {{fN}} (content/chrome.json) */
  footer: string
  /** after </footer>: scripts */
  tail: string
  /** FAQ structured data as approved, used while the questions on the page are unchanged */
  faqSchema?: { literal: string; source: string }
}

export type Chrome = { parts: Record<string, Pick<Part, 'key' | 'kind' | 'label' | 'fields'>> }

export type Redirect = { from: string; to: string; type: 'permanent' | 'temporary' }

export const ITEM_MARK = /\{\{\[\/?L\d+\]\}\}/g
export const FIELD = /\{\{(f\d+)\}\}/g

/** Field values as the page shows them: a photo's sizes follow the photo once it has been replaced. */
export function resolvedFields(fields: Field[]): Field[] {
  const byId = new Map(fields.map((f) => [f.id, f]))
  return fields.map((f) => {
    if (f.type !== 'srcset' || !f.of) return f
    const img = byId.get(f.of)
    if (!img || img.original === undefined || img.value === img.original) return f
    return { ...f, value: img.value }
  })
}

/** Links the dashboard pointed at another website open in a new tab. */
export function withNewTabs(template: string, fields: Field[]): string {
  let out = template
  for (const f of fields) {
    if (f.type !== 'href' || !f.newTab) continue
    out = out.replace(new RegExp(`<a\\b([^>]*?)href="\\{\\{${f.id}\\}\\}"([^>]*)>`, 'g'), (whole, a: string, b: string) =>
      /\starget=/.test(a + b) ? whole : `<a${a}href="{{${f.id}}}" target="_blank"${/\srel=/.test(a + b) ? '' : ' rel="noopener"'}${b}>`)
  }
  return out
}

/** A Media Library photo's focal point decides which part of it shows when the slot crops it. */
export function withFocal(template: string, fields: Field[]): string {
  let out = template
  for (const f of fields) {
    if (f.type !== 'image' || !f.focal || !/^\d{1,3}(\.\d+)?% \d{1,3}(\.\d+)?%$/.test(f.focal)) continue
    out = out.replace(new RegExp(`<img\\b[^>]*src="\\{\\{${f.id}\\}\\}"[^>]*>`, 'g'), (tag) => {
      if (/\sstyle="[^"]*--pos/.test(tag)) return tag.replace(/(--pos(?:-m)?:\s*)[^;"]+/g, `$1${f.focal}`)
      if (/\sstyle="/.test(tag)) return tag.replace(/\sstyle="/, ` style="object-position: ${f.focal}; `)
      return tag.replace(/^<img\b/, `<img style="object-position: ${f.focal}"`)
    })
  }
  return out
}

/** Substitute field values into a template; repeating-item markers are dropped. */
export function fillTemplate(template: string, fields: Field[]): string {
  const byId = new Map(resolvedFields(fields).map((f) => [f.id, f.value ?? '']))
  return withFocal(withNewTabs(template, fields), fields).replace(ITEM_MARK, '').replace(FIELD, (m, id: string) => (byId.has(id) ? byId.get(id)! : ''))
}

export function openTag(tag: string, attrs: Record<string, string | null>, extra = ''): string {
  let out = `<${tag}`
  for (const [k, v] of Object.entries(attrs)) out += v === null ? ` ${k}` : ` ${k}="${v}"`
  return `${out}${extra}>`
}

/** The sections in page order, without hidden ones. */
export function visibleSections(page: Page): Part[] {
  const out: Part[] = []
  for (const step of page.order) {
    if (!step.startsWith('section:')) continue
    const s = page.sections[Number(step.slice(8))]
    if (s && !s.hidden) out.push(s)
  }
  return out
}
