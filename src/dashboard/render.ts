/**
 * Pages as HTML: the public site (scripts/render-site.ts) and the page editor's preview both use this,
 * so what the editor shows is what goes live (the GYA standard dashboard, after Coastal Dental, Precision
 * Dental, Tooth n Care and APE).
 *
 * In the editor every editable spot is marked:
 * - words become <pd-e data-pde="s:<section>|f3" data-t="text|rich">...</pd-e>, clicked to edit in place;
 *   practice details inside them ({{phone}}) are shaded chips that fill in from Site Settings;
 *   compliance wording carries data-lock and can only be changed by GYA;
 * - photos get data-pdi (the photo field) and data-pda (its description field);
 * - links get data-pdh (the address field);
 * - each section gets data-pds, and each repeating item data-pdr="L1:0", for the Sections tab.
 * Words inside <option>, <script>, <style>, <title>, <textarea> or an SVG drawing are not marked.
 *
 * With marking off, the page comes out exactly as the website serves it; scripts/qa-editor.ts proves the
 * markers change nothing else.
 */
import type { Chrome, Field, Page, Part } from '@/lib/parts'
import { FIELD, ITEM_MARK, fillTemplate, openTag, resolvedFields, visibleSections, withFocal, withNewTabs } from '@/lib/parts'
import { escHtml, finishPage, stripTracking } from '@/lib/staticSite'
import type { SiteSettings } from '@/lib/site'

const RAW = new Set(['script', 'style', 'title', 'textarea', 'option'])
const VOID = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'source', 'track', 'wbr'])

// ---------------------------------------------------------------- what an editor may change

const COMPLIANCE = /general dentist|registered specialist|research qualification|clinical assessment|pain-free|general in nature and does not constitute/i

/** Wording that is there to meet advertising rules: editors see it locked, GYA can change it. */
export function isCompliance(f: Pick<Field, 'type' | 'value'>): boolean {
  return (f.type === 'richtext' || f.type === 'text') && COMPLIANCE.test(f.value.replace(/<[^>]+>/g, ''))
}

/** Footer words: the tagline and copyright line for everyone; headings and link words are GYA's (like the menu). */
export function footerEditable(f: Pick<Field, 'label' | 'type'>, admin: boolean): boolean {
  if (admin) return f.type === 'richtext' || f.type === 'text'
  return f.label === 'Paragraph' || f.label === 'Words' || f.label === 'Fine print'
}

// ---------------------------------------------------------------- marking

/** Practice details inside words become shaded chips; tokens inside tags are left alone. */
function chips(v: string): string {
  return v
    .split(/(<[^>]*>)/)
    .map((seg) => (seg.startsWith('<') ? seg : seg.replace(/\{\{(\{?)(\w+)\}?\}\}/g, (m, triple: string, key: string) =>
      `<span class="pd-tok" contenteditable="false" data-pdt="${key}"${triple ? ' data-raw="1"' : ''}>${m}</span>`)))
    .join('')
}

export type MarkRule = { edit: (f: Field) => boolean; lock: (f: Field) => boolean }

/** Fill a template's {{fN}} placeholders with its values, marking each editable spot. */
export function markTemplate(template: string, scope: string, fields: Field[], rule: MarkRule): string {
  const byId = new Map(fields.map((f) => [f.id, f]))
  const value = (id: string) => byId.get(id)?.value ?? ''
  const ref = (id: string) => `${scope}|${id}`
  const counters: Record<string, number> = {}
  let pendingItem: string | null = null
  let svg = 0
  let out = ''
  let i = 0
  const n = template.length

  const text = (s: string) => s.replace(ITEM_MARK, (m) => {
    if (m.startsWith('{{[/')) return ''
    const id = m.slice(3, -3)
    pendingItem = `${id}:${counters[id] = (counters[id] ?? -1) + 1}`
    return ''
  }).replace(FIELD, (_m, id: string) => {
    const f = byId.get(id)
    if (!f) return ''
    const v = value(id)
    if (svg > 0 || (f.type !== 'richtext' && f.type !== 'text')) return v
    if (!rule.edit(f)) return v
    const lock = rule.lock(f) ? ' data-lock="1"' : ''
    return `<pd-e data-pde="${ref(id)}" data-t="${f.type === 'richtext' ? 'rich' : 'text'}"${lock}>${chips(v)}</pd-e>`
  })

  const tag = (t: string, name: string, closing: boolean) => {
    if (closing) return t
    const marks: string[] = []
    if (pendingItem) { marks.push(`data-pdr="${pendingItem}"`); pendingItem = null }
    const filled = t.replace(/([\w:-]+)=("([^"]*)"|'([^']*)')/g, (whole, attrName: string) => {
      if (!/\{\{f\d+\}\}/.test(whole)) return whole
      const a = attrName.toLowerCase()
      const id = [...whole.matchAll(FIELD)].map((m) => m[1])[0]
      const f = byId.get(id)
      if (f && svg === 0 && rule.edit(f)) {
        if (name === 'img' && a === 'src' && f.type === 'image') marks.push(`data-pdi="${ref(id)}"`)
        else if (name === 'img' && a === 'alt' && f.type === 'alt') marks.push(`data-pda="${ref(id)}"`)
        else if (name === 'a' && a === 'href' && f.type === 'href') marks.push(`data-pdh="${ref(id)}"`)
      }
      return whole.replace(FIELD, (_m, fid: string) => value(fid))
    })
    if (!marks.length) return filled
    return filled.replace(/^<([a-zA-Z][\w:-]*)/, `<$1 ${marks.join(' ')}`)
  }

  while (i < n) {
    const lt = template.indexOf('<', i)
    out += text(template.slice(i, lt < 0 ? n : lt))
    if (lt < 0) break
    if (template.startsWith('<!--', lt)) {
      const end = template.indexOf('-->', lt)
      const stop = end < 0 ? n : end + 3
      out += template.slice(lt, stop).replace(FIELD, (_m, id: string) => value(id))
      i = stop
      continue
    }
    const m = /^<(\/?)([a-zA-Z][\w:-]*)/.exec(template.slice(lt, lt + 64))
    if (!m) { out += '<'; i = lt + 1; continue }
    let j = lt + m[0].length
    let q: string | null = null
    while (j < n) {
      const c = template[j]
      if (q) { if (c === q) q = null } else if (c === '"' || c === "'") q = c
      else if (c === '>') break
      j++
    }
    const t = template.slice(lt, j + 1)
    const name = m[2].toLowerCase()
    const closing = m[1] === '/'
    out += tag(t, name, closing)
    i = j + 1
    if (closing) {
      if (name === 'svg' && svg > 0) svg--
      continue
    }
    if (name === 'svg' && !t.endsWith('/>')) svg++
    if (RAW.has(name)) {
      const close = template.toLowerCase().indexOf(`</${name}`, i)
      const stop = close < 0 ? n : close
      out += template.slice(i, stop).replace(FIELD, (_m, id: string) => value(id))
      i = stop
    }
  }
  return out
}

function partHtml(part: Part, inner: string, extra = ''): string {
  const open = openTag(part.tag, part.attrs, extra)
  if (VOID.has(part.tag)) return open
  return `${open}${inner}</${part.tag}>`
}

// ---------------------------------------------------------------- FAQ structured data

const FAQ_BLOCK = /<div class="faq">[\s\S]*?<div class="faq-a"[^>]*>[\s\S]*?<\/div>\s*<\/div>/g

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', rsquo: '’', lsquo: '‘', ndash: '\u2013', mdash: '\u2014', hellip: '\u2026' }
export function plain(s: string): string {
  return String(s ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e: string) => {
      if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
      return NAMED[e] ?? m
    })
    .replace(/\s+/g, ' ')
    .trim()
}

/** FAQPage structured data: as approved while the questions are unchanged, otherwise built from them. */
export function faqSchemaFor(page: Page, mainSource: string): string {
  const blocks = mainSource.match(FAQ_BLOCK) ?? []
  if (page.faqSchema && blocks.join('') === page.faqSchema.source) return page.faqSchema.literal
  if (!blocks.length) return ''
  const mainEntity = blocks.map((b) => {
    const q = /<span>([\s\S]*?)<\/span>/.exec(b)
    const answer = /<div class="faq-a"[^>]*>([\s\S]*?)<\/div>\s*<\/div>$/.exec(b)?.[1] ?? ''
    const text = [...answer.matchAll(/<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/g)].map((p) => plain(p[2])).filter(Boolean).join(' ')
    return { '@type': 'Question', name: plain(q ? q[1] : ''), acceptedAnswer: { '@type': 'Answer', text } }
  })
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity })}</script>`
}

// ---------------------------------------------------------------- the page

export type RenderOptions = {
  chrome: Chrome
  settings: SiteSettings
  /** mark every editable spot for the visual editor */
  editable?: boolean
  /** the person editing is GYA (locked wording and footer headings become editable) */
  admin?: boolean
  /** extra markup for the end of <head> (the editor's styles) */
  head?: string
  /** collects problems the build should stop on */
  errors?: string[]
}

/** The page before the practice details are filled in: what the v1.2.2 template held. */
export function pageTemplate(page: Page, o: Pick<RenderOptions, 'chrome' | 'editable' | 'admin'>): { html: string; main: string } {
  const sections = visibleSections(page)
  const plainMain = sections.map((s) => (s.before ?? '') + partHtml(s, fillTemplate(s.template, s.fields))).join('') + page.mainEnd
  const lockRule = (f: Field) => !o.admin && isCompliance(f)
  const main = o.editable
    ? sections.map((s) => (s.before ?? '') + partHtml(s,
      markTemplate(withFocal(withNewTabs(s.template, s.fields), s.fields), `s:${s.key}`, resolvedFields(s.fields), { edit: () => true, lock: lockRule }),
      ` data-pds="${escHtml(s.key)}"`)).join('') + page.mainEnd
    : plainMain

  const m = page.meta ?? {}
  const seo: Record<string, string> = {
    title: escHtml(m.title ?? ''),
    description: escHtml(m.description ?? ''),
    ogTitle: escHtml(m.ogTitle || m.title || ''),
    ogDescription: escHtml(m.ogDescription || m.description || ''),
  }
  let head = page.head.replace(/\{\{seo:([a-zA-Z]+)\}\}/g, (all, k: string) => seo[k] ?? all)
  head = head.replace('{{gen:faqSchema}}', () => faqSchemaFor(page, plainMain))

  const footerFields = resolvedFields(o.chrome.parts.footer?.fields ?? [])
  const footer = o.editable
    ? markTemplate(page.footer, 'c:footer', footerFields, {
      edit: (f) => footerEditable(f, !!o.admin), lock: lockRule,
    }).replace(/^<footer/, '<footer data-pdc="footer" data-pds="c:footer"')
    : fillTemplate(page.footer, footerFields)

  return { html: head + main + page.afterMain + footer + page.tail, main: plainMain }
}

/** A whole HTML document for the page: the public file, or the editor's preview with o.editable. */
export function renderPageHtml(page: Page, o: RenderOptions): string {
  const { html } = pageTemplate(page, o)
  let out = finishPage(html, page, o.settings, o.errors)
  if (o.editable) {
    // no Google Tag Manager, GA4 or Pixel in the dashboard: editing a page is not a visit
    out = stripTracking(out)
    // relative links and photos resolve against the page's own address, as on the website
    const base = page.path === '/404' ? '/' : page.path
    out = out.replace(/<head>/, `<head><base href="${escHtml(base)}">`)
    out = out.replace('<header class="masthead"', '<header class="masthead" data-pdc="header"')
  }
  if (o.head) out = out.replace('</head>', `${o.head}</head>`)
  return out
}

/** Styles that make the page editable without changing how it looks (colours from the Lava palette). */
export const EDIT_CSS = `<style id="pd-edit-css">
pd-e{outline:1px dashed transparent;outline-offset:3px;border-radius:2px;cursor:text;transition:outline-color .15s,background-color .15s}
pd-e:hover{outline-color:rgba(87,90,77,.75)}
pd-e:focus{outline:2px solid #575A4D;background-color:rgba(149,156,138,.16)}
pd-e:empty{display:inline-block;min-width:4ch}
pd-e:empty::before{content:'Add words';opacity:.45;font-style:italic}
pd-e[data-lock]{cursor:not-allowed}
pd-e[data-lock]:hover{outline-color:rgba(180,104,75,.8)}
.pd-tok{background:rgba(149,156,138,.32);border-radius:3px;padding:0 2px;cursor:pointer}
img[data-pdi]{cursor:pointer}
img[data-pdi]:hover{outline:3px solid rgba(87,90,77,.85);outline-offset:-3px}
img.pd-sel,img.pd-sel:hover{outline:3px solid #575A4D;outline-offset:-3px}
.pd-flash{animation:pdflash 1.4s ease}
@keyframes pdflash{0%,40%{box-shadow:inset 0 0 0 4px #575A4D}100%{box-shadow:inset 0 0 0 4px rgba(87,90,77,0)}}
.rise,.rise:not(.in){opacity:1!important;transform:none!important}
.anim{animation:none!important}
.faq-a{max-height:none!important}
.masthead{position:relative!important}
</style>`
