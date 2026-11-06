'use client'
/**
 * The page editor, laid out like the Precision Dental and Coastal Dental dashboards: the page itself in the
 * middle, exactly as it looks on the website, where any words can be clicked and changed in place and any
 * photo clicked to replace it; a panel on the right with Content (the selected item and every photo on the
 * page), SEO, and Sections (drag to reorder, hide or show, repeating items, or a section as a form).
 * Desktop and Mobile switch the preview width. Save changes keeps the edits; Publish website puts them live.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { EField as F, ESection as Section } from '../pages'
import { api, mediaSrc } from '../lib/client'
import { cleanInlineHtml, linkForEditing, linkForSaving, textForEditing, textForSaving } from '../lib/text'
import { when } from '../lib/format'
import { AutoTextarea, Notice, useUnsavedWarning } from '../ui/fields'
import { ImageSlot, MediaPicker, FocalPicker, type MediaDoc } from '../ui/MediaPicker'
import { RichInline } from '../ui/RichInline'
import { SeoPanel, type SeoState } from '../ui/SeoPanel'
import { PublishButton } from '../ui/PublishButton'
import { useToast } from '../ui/Toast'
import { Icon } from '../ui/icons'
import { BRAND } from '../brand'

export type LinkTarget = { group: string; label: string; href: string }

export type PageEditorProps = {
  id: number | string
  label: string
  url: string | null
  /** the page's own address, for photos and links written relative to it */
  pagePath: string
  sections: Section[]
  /** anchors the menu or the site's buttons jump to */
  menuAnchors: string[]
  /** the footer words this person may change (shared by every page) */
  footer: F[]
  linkTargets: LinkTarget[]
  seo: SeoState
  isAdmin: boolean
  defaultOg: string
  defaultTitle: string
  lastmod: string | null
  focusSection?: string | null
  startTab?: 'content' | 'seo' | 'sections'
}

type Img = { ref: string; alt: string | null; link: string | null }
type Selected =
  | { kind: 'text'; ref: string; rich: boolean; heading: boolean; link: string | null; section: string | null }
  | { kind: 'link'; ref: string; words: string | null; section: string | null }
  | { kind: 'image'; ref: string; alt: string | null; link: string | null; section: string | null }
  | { kind: 'note'; title: string; body: React.ReactNode; lock?: boolean }
  | null

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))
const DESKTOP_WIDTH = 1280
const MOBILE_WIDTH = 390

const HELP = {
  alt: 'Describe the photo for someone who cannot see it. Leave it blank only if the photo is decoration.',
}

const LOCK_NOTE = 'This wording is there to meet advertising rules. Ask GYA if it needs to change.'

/** What the editor sends back: words, links and photo choices only. */
const edits = (sections: Section[]) =>
  sections.map((s) => ({ key: s.key, hidden: s.hidden, fields: s.fields.map((f) => ({ id: f.id, value: f.value, media: f.media ?? null })) }))

// ---------------------------------------------------------------- section forms (Sections tab)
function layoutFields(fields: F[]) {
  const counts: Record<string, number> = {}
  for (const f of fields) counts[f.label] = (counts[f.label] ?? 0) + 1
  const seen: Record<string, number> = {}
  return fields.map((f) => {
    if (counts[f.label] > 1 && f.type !== 'alt') {
      seen[f.label] = (seen[f.label] ?? 0) + 1
      return { f, label: `${f.label} ${seen[f.label]}` }
    }
    return { f, label: f.label }
  })
}

function FieldEditor({ f, label, onChange, prefix, abs }: { f: F; label: string; onChange: (patch: Partial<F>) => void; prefix: string; abs: (v: string) => string }) {
  const id = `fld-${prefix}-${f.id}`
  if (f.type === 'image') {
    return <ImageSlot label={label} value={abs(f.value)} original={abs(f.original ?? f.value)}
      onChange={(v) => onChange({ value: v.value, media: v.media ?? null })} />
  }
  if (f.locked) {
    return (
      <div className="field">
        <span className="lab">{label} <span className="chip lock">{Icon.lock()} Locked</span></span>
        <div className="help" style={{ marginTop: 0 }}>{textForEditing(f.value.replace(/<[^>]+>/g, ''))}</div>
        <div className="help">{LOCK_NOTE}</div>
      </div>
    )
  }
  if (f.type === 'richtext') {
    return (
      <div className="field">
        <label htmlFor={id}>{label}</label>
        <RichInline id={id} value={f.value} onChange={(html) => onChange({ value: html })} />
      </div>
    )
  }
  if (f.type === 'href') {
    return (
      <div className="field">
        <label htmlFor={id}>{label}</label>
        <input id={id} className="input" value={linkForEditing(f.value)} onChange={(e) => onChange({ value: linkForSaving(e.target.value) })} />
        <div className="help">A page on this website starts with /, for example /contact/. Other websites start with https://</div>
      </div>
    )
  }
  const text = textForEditing(f.value)
  const long = text.length > 70 || text.includes('\n')
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {long
        ? <AutoTextarea id={id} value={text} onChange={(v) => onChange({ value: textForSaving(v) })} />
        : <input id={id} className="input" value={text} onChange={(e) => onChange({ value: textForSaving(e.target.value) })} />}
      {f.type === 'alt' ? <div className="help">{HELP.alt}</div> : null}
    </div>
  )
}

function FieldsList({ fields, onField, prefix, abs }: { fields: F[]; onField: (id: string, patch: Partial<F>) => void; prefix: string; abs: (v: string) => string }) {
  const rows = useMemo(() => layoutFields(fields), [fields])
  if (!fields.length) return <p className="help">Nothing to edit in this section.</p>
  return <>{rows.map(({ f, label }) => <FieldEditor key={f.id} f={f} label={label} prefix={prefix} abs={abs} onChange={(p) => onField(f.id, p)} />)}</>
}

const sectionName = (s: Section) => s.label || 'Section'

function SectionRow({ s, open, onToggle, onShow, onHide, children, sortable }: {
  s: Section; open: boolean; onToggle: () => void; onShow: () => void; onHide?: () => void; children: React.ReactNode; sortable: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.key, disabled: !sortable })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const badge = s.pinned ? <span className="chip grey">Top</span> : s.menuLinked ? <span className="chip grey">In the menu</span> : null
  return (
    <div ref={setNodeRef} style={style} className={`sec${open ? ' open' : ''}${isDragging ? ' dragging' : ''}${s.hidden ? ' is-hidden' : ''}`}>
      <div className="sec-head" onClick={() => { onToggle(); onShow() }}>
        <button type="button" className="handle" aria-label={sortable ? `Drag to move ${sectionName(s)}` : 'This section stays at the top'}
          disabled={!sortable} {...(sortable ? attributes : {})} {...(sortable ? listeners : {})} onClick={(e) => e.stopPropagation()}>
          {Icon.grip()}
        </button>
        <span className="sec-title">{sectionName(s)}</span>
        {s.hidden ? <span className="chip warn">Hidden</span> : badge}
        {onHide ? (
          <button type="button" className="btn small ghost icon-only" onClick={(e) => { e.stopPropagation(); onHide() }}
            title={s.hidden ? 'Show this section on the page' : 'Hide this section from the page'} aria-label={s.hidden ? `Show ${sectionName(s)}` : `Hide ${sectionName(s)}`}>
            {s.hidden ? Icon.eye() : Icon.eyeOff()}
          </button>
        ) : null}
        <span className="chev">{Icon.chevron()}</span>
      </div>
      {open ? <div className="sec-body">{children}</div> : null}
    </div>
  )
}

/** Where a button or link goes: a section, a page, or another website. */
function LinkPicker({ value, onChange, targets, pagePath, id }: { value: string; onChange: (v: string) => void; targets: LinkTarget[]; pagePath: string; id: string }) {
  const norm = (h: string, base: string) => {
    try {
      const u = new URL(h.replace(/&amp;/g, '&'), `https://site.invalid${base}`)
      if (u.host !== 'site.invalid') return u.toString()
      return u.pathname.replace(/index\.html$/, '') + u.hash
    } catch { return h }
  }
  const current = norm(value, pagePath)
  const match = targets.find((t) => norm(t.href, pagePath) === current)
  const [custom, setCustom] = useState(!match)
  const groups = useMemo(() => {
    const m = new Map<string, LinkTarget[]>()
    for (const t of targets) m.set(t.group, [...(m.get(t.group) || []), t])
    return [...m.entries()]
  }, [targets])
  return (
    <div className="field link-pick">
      <label htmlFor={id}>Link goes to</label>
      <select id={id} className="select" value={custom ? '__custom' : match?.href ?? '__custom'}
        onChange={(e) => {
          if (e.target.value === '__custom') { setCustom(true); return }
          setCustom(false)
          onChange(e.target.value)
        }}>
        {groups.map(([g, list]) => (
          <optgroup key={g} label={g}>{list.map((t) => <option key={`${g}${t.href}`} value={t.href}>{t.label}</option>)}</optgroup>
        ))}
        <option value="__custom">Another website or address...</option>
      </select>
      {custom ? (
        <>
          <input className="input" aria-label="Web address" value={linkForEditing(value)} placeholder="https://"
            onChange={(e) => onChange(linkForSaving(e.target.value))} />
          <div className="help">Paste the full address. Links to other websites open in a new tab.</div>
        </>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------- the editor
export function PageEditor(props: PageEditorProps) {
  const toast = useToast()
  const [sections, setSections] = useState<Section[]>(() => clone(props.sections))
  const [footer, setFooter] = useState<F[]>(() => clone(props.footer))
  const [footerDirty, setFooterDirty] = useState(false)
  const [seo, setSeo] = useState<SeoState>(props.seo)
  const [open, setOpen] = useState<Set<string>>(new Set(props.focusSection && props.startTab === 'sections' ? [props.focusSection] : []))
  const [tab, setTab] = useState<'content' | 'seo' | 'sections'>(props.startTab ?? 'content')
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [selected, setSelected] = useState<Selected>(null)
  const [images, setImages] = useState<Img[]>([])
  const [loading, setLoading] = useState(true)
  const [previewError, setPreviewError] = useState('')
  const [pickFor, setPickFor] = useState<string | null>(null)
  const [itemBusy, setItemBusy] = useState(false)
  const [stage, setStage] = useState({ w: 0, h: 0 })
  useUnsavedWarning(dirty)

  const frame = useRef<HTMLIFrameElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const live = useRef({ sections, footer })
  live.current = { sections, footer }
  const keepScroll = useRef(0)
  const request = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const range = useRef<Range | null>(null)
  const selRef = useRef<string | null>(null)
  const saveRef = useRef<() => void>(() => {})

  /** Photos are written relative to the page (../assets/...); the dashboard shows them from the site root. */
  const abs = useCallback((v: string) => {
    const raw = String(v || '').replace(/&amp;/g, '&')
    if (!raw || /^(https?:|data:|\/)/i.test(raw)) return raw
    try { return new URL(raw, `https://site.invalid${props.pagePath}`).pathname } catch { return raw }
  }, [props.pagePath])

  useEffect(() => {
    document.body.classList.add('pe-full')
    return () => document.body.classList.remove('pe-full')
  }, [])

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setStage({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const touch = () => { setDirty(true); setSaved(false) }

  // ------------------------------------------------ field access by reference ("s:<section>|f3" or "c:footer|f1")
  const parseRef = (ref: string) => {
    const [scope, fid] = ref.split('|')
    return { shared: scope.startsWith('c:'), key: scope.slice(2), fid }
  }
  const getField = useCallback((ref: string): F | null => {
    const { shared, key, fid } = parseRef(ref)
    const list = shared ? live.current.footer : live.current.sections.find((s) => s.key === key)?.fields
    return list?.find((f) => f.id === fid) ?? null
  }, [])

  function setField(secKey: string, fid: string, patch: Partial<F>) {
    setSections((all) => all.map((s) => (s.key !== secKey ? s : { ...s, fields: s.fields.map((f) => (f.id === fid ? { ...f, ...patch } : f)) })))
    touch()
  }
  const setRef = (ref: string, patch: Partial<F>) => {
    const { shared, key, fid } = parseRef(ref)
    if (shared) {
      setFooter((all) => all.map((f) => (f.id === fid ? { ...f, ...patch } : f)))
      setFooterDirty(true)
      touch()
      return
    }
    setField(key, fid, patch)
  }
  const sharedEdits = () => [{ name: 'footer', fields: live.current.footer.map((f) => ({ id: f.id, value: f.value })) }]

  // ------------------------------------------------ the preview
  const refresh = useCallback(async () => {
    const n = ++request.current
    const win = frame.current?.contentWindow
    if (win) keepScroll.current = win.scrollY
    setLoading(true)
    try {
      const res = await fetch('/admin/preview/edit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: props.id, sections: edits(live.current.sections), shared: sharedEdits() }),
      })
      const html = await res.text()
      if (n !== request.current) return
      if (!res.ok) {
        let msg = 'The preview could not be loaded.'
        try { msg = JSON.parse(html).error || msg } catch { /* not JSON */ }
        setPreviewError(msg)
        setLoading(false)
        return
      }
      setPreviewError('')
      if (frame.current) frame.current.srcdoc = html
    } catch {
      if (n === request.current) { setPreviewError('The preview could not be loaded. Check your internet connection.'); setLoading(false) }
    }
  }, [props.id])

  const [tick, setTick] = useState(0)
  const bump = useCallback(() => setTick((t) => t + 1), [])
  const scheduleRefresh = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(bump, 400)
  }, [bump])

  useEffect(() => { refresh() }, [refresh, tick])

  const doc = () => frame.current?.contentDocument ?? null
  const focused = useRef(false)

  function markSelected(ref: string | null) {
    selRef.current = ref
    const d = doc()
    if (!d) return
    d.querySelectorAll('.pd-sel').forEach((el) => el.classList.remove('pd-sel'))
    if (ref) d.querySelectorAll(`img[data-pdi="${CSS_escape(ref)}"]`).forEach((el) => el.classList.add('pd-sel'))
  }

  const sectionOf = (el: Element): string | null => {
    const host = el.closest('[data-pds]')
    if (!host) return null
    const k = host.getAttribute('data-pds') || ''
    if (k.startsWith('c:')) return 'Footer'
    const s = live.current.sections.find((x) => x.key === k)
    if (!s) return null
    const words = (el.textContent || '').replace(/\s+/g, ' ').trim()
    return words ? `${sectionName(s)}: ${words.slice(0, 40)}` : sectionName(s)
  }

  function readEditable(el: HTMLElement): string {
    const c = el.cloneNode(true) as HTMLElement
    // practice details go back to the token they came from
    c.querySelectorAll('.pd-tok').forEach((t) => {
      const key = t.getAttribute('data-pdt')
      const raw = t.getAttribute('data-raw') === '1'
      t.replaceWith(c.ownerDocument.createTextNode(raw ? `{{{${key}}}}` : `{{${key}}}`))
    })
    if (el.getAttribute('data-t') === 'rich') return cleanInlineHtml(c)
    return textForSaving(c.textContent || '')
  }

  function scrollToSection(s: Section) {
    const d = doc()
    if (!d) return
    const el = d.querySelector(`[data-pds="${CSS_escape(s.key)}"]`) as HTMLElement | null
    if (!el) {
      if (s.hidden) toast('This section is hidden, so it is not on the page. Press the eye to show it.', 'bad')
      return
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.classList.remove('pd-flash')
    void el.offsetWidth
    el.classList.add('pd-flash')
  }

  const details = <p><b>Edit this in Practice details.</b> The phone number, email, street address, opening hours and opening date come from <a href="/admin/settings">Site Settings</a>, so they stay the same everywhere on the website.</p>

  function noteFor(target: Element): Selected {
    const link = target.closest('a')
    const href = link?.getAttribute('href') || ''
    if (/^(tel:|mailto:)/.test(href)) return { kind: 'note', title: 'Practice details', body: details }
    if (target.closest('[data-pdc="header"]')) {
      return { kind: 'note', title: 'Menu', body: <p>The menu is the same on every page and is set by GYA. Ask GYA if a menu item needs to change.</p> }
    }
    if (target.closest('[data-pdc="footer"]')) {
      return { kind: 'note', title: 'Footer', body: <><p>The footer is the same on every page. Its tagline and copyright line can be clicked and changed here.</p>{details}<p>The footer links are set by GYA.</p></> }
    }
    if (link && link.closest('[data-pds]')) {
      return { kind: 'note', title: 'Button', body: <p>This button follows the website&apos;s opening mode: it says &quot;Join the waitlist&quot; until the practice opens, then switches to booking by itself. Its words can be clicked and changed here; where it goes is set by GYA.</p> }
    }
    if (target.closest('form')) {
      return { kind: 'note', title: 'Waitlist form', body: <p>Sign-ups from this form arrive under <a href="/admin/waitlist">Waitlist</a> and by email. The button words and the line under the button can be clicked and changed here.</p> }
    }
    if (target.closest('iframe, .map-embed')) {
      return { kind: 'note', title: 'Map', body: <p>The map shows the street address in <a href="/admin/settings">Site Settings</a>.</p> }
    }
    return null
  }

  // ------------------------------------------------ wire up the page once it has loaded
  function onFrameLoad() {
    const d = doc()
    const win = frame.current?.contentWindow
    if (!d || !win || !d.body) return
    setLoading(false)
    win.scrollTo(0, keepScroll.current)
    if (props.focusSection && !focused.current) {
      focused.current = true
      const target = live.current.sections.find((x) => x.key === props.focusSection)
      if (target) setTimeout(() => scrollToSection(target), 150)
    }

    d.querySelectorAll('a, img').forEach((el) => el.setAttribute('draggable', 'false'))
    d.querySelectorAll<HTMLElement>('pd-e').forEach((el) => {
      if (el.hasAttribute('data-lock')) return
      const rich = el.getAttribute('data-t') === 'rich'
      if (rich) el.contentEditable = 'true'
      else {
        try { el.contentEditable = 'plaintext-only' } catch { el.contentEditable = 'true' }
        if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true'
      }
      el.spellcheck = true
    })

    const list: Img[] = []
    const seen = new Set<string>()
    d.querySelectorAll('img[data-pdi]').forEach((img) => {
      const ref = img.getAttribute('data-pdi') || ''
      if (seen.has(ref)) return
      seen.add(ref)
      list.push({ ref, alt: img.getAttribute('data-pda'), link: img.closest('a[data-pdh]')?.getAttribute('data-pdh') ?? null })
    })
    setImages(list)
    markSelected(selRef.current)

    d.addEventListener('click', (e) => {
      const t = e.target as Element
      if (!t || !t.closest) return
      const link = t.closest('a')
      if (link) e.preventDefault()
      const tok = t.closest('.pd-tok')
      const ed = t.closest('pd-e') as HTMLElement | null
      const img = t.closest('img[data-pdi]')
        ?? (!ed && !tok && !link && !t.closest('button, input, select, textarea, label')
          ? d.elementsFromPoint((e as MouseEvent).clientX, (e as MouseEvent).clientY).find((el) => el.matches('img[data-pdi]')) ?? null
          : null)
      if (tok) {
        e.stopPropagation()
        setSelected({ kind: 'note', title: 'Practice details', body: details })
        setTab('content')
        return
      }
      if (ed?.hasAttribute('data-lock')) {
        e.stopPropagation()
        setSelected({ kind: 'note', title: 'Locked wording', lock: true, body: <p>{LOCK_NOTE}</p> })
        setTab('content')
        return
      }
      if (ed) {
        e.stopPropagation()
        const ref = ed.getAttribute('data-pde') || ''
        const host = ed.parentElement?.closest('h1, h2, h3, h4')
        markSelected(null)
        const linkRef = ed.closest('a[data-pdh]')?.getAttribute('data-pdh') ?? null
        if (linkRef) setSelected({ kind: 'link', ref: linkRef, words: ref, section: sectionOf(ed) })
        else setSelected({ kind: 'text', ref, rich: ed.getAttribute('data-t') === 'rich', heading: !!host, link: null, section: sectionOf(ed) })
        setTab('content')
        return
      }
      if (img) {
        e.stopPropagation()
        e.preventDefault()
        const ref = img.getAttribute('data-pdi') || ''
        markSelected(ref)
        setSelected({ kind: 'image', ref, alt: img.getAttribute('data-pda'), link: img.closest('a[data-pdh]')?.getAttribute('data-pdh') ?? null, section: sectionOf(img) })
        setTab('content')
        return
      }
      const pdh = link?.getAttribute('data-pdh')
      if (pdh) {
        e.stopPropagation()
        setSelected({ kind: 'link', ref: pdh, words: link?.querySelector('pd-e')?.getAttribute('data-pde') ?? null, section: sectionOf(link!) })
        setTab('content')
        return
      }
      const note = noteFor(t)
      if (note) {
        e.stopPropagation()
        setSelected(note)
        setTab('content')
      }
    }, true)

    d.addEventListener('submit', (e) => e.preventDefault(), true)

    d.addEventListener('input', (e) => {
      const el = (e.target as Element)?.closest?.('pd-e') as HTMLElement | null
      if (!el || el.hasAttribute('data-lock')) return
      const ref = el.getAttribute('data-pde') || ''
      d.querySelectorAll<HTMLElement>('pd-e').forEach((o) => { if (o !== el && o.getAttribute('data-pde') === ref) o.innerHTML = el.innerHTML })
      setRef(ref, { value: readEditable(el) })
    }, true)

    d.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveRef.current(); return }
      const el = (e.target as Element)?.closest?.('pd-e') as HTMLElement | null
      if (!el) return
      if (e.key === 'Escape') { el.blur(); return }
      // the design decides the type: no bold or underline shortcuts
      if ((e.metaKey || e.ctrlKey) && ['b', 'u'].includes(e.key.toLowerCase())) { e.preventDefault(); return }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i' && !el.innerHTML.includes('<em')) { e.preventDefault(); return }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (e.shiftKey && el.getAttribute('data-t') === 'rich' && el.innerHTML.includes('<br')) d.execCommand('insertLineBreak')
      }
      if (e.key === ' ') e.stopPropagation()
    }, true)
    d.addEventListener('keyup', (e) => {
      if ((e.target as Element)?.closest?.('pd-e') && e.key === ' ') { e.stopPropagation(); e.preventDefault() }
    }, true)

    d.addEventListener('paste', (e) => {
      const el = (e.target as Element)?.closest?.('pd-e')
      if (!el) return
      e.preventDefault()
      const text = (e.clipboardData?.getData('text/plain') || '').replace(/\s*\n\s*/g, ' ')
      d.execCommand('insertText', false, text)
    }, true)

    d.addEventListener('selectionchange', () => {
      const s = d.getSelection()
      if (s && s.rangeCount && (s.anchorNode?.parentElement?.closest('pd-e'))) range.current = s.getRangeAt(0).cloneRange()
    })
  }

  /** Italic on a selection, only inside headings that already use an italic accent word. */
  function italic() {
    const d = doc()
    const win = frame.current?.contentWindow
    if (!d || !win || !range.current) { toast('Select some words in the heading first.', 'bad'); return }
    const host = range.current.startContainer.parentElement?.closest('pd-e') as HTMLElement | null
    if (!host) return
    win.focus()
    host.focus()
    const s = d.getSelection()
    s?.removeAllRanges()
    s?.addRange(range.current)
    d.execCommand('styleWithCSS', false, 'false')
    d.execCommand('italic')
    // browsers write <i>; the design's accent is <em>
    host.querySelectorAll('i').forEach((i) => { const em = d.createElement('em'); em.innerHTML = i.innerHTML; i.replaceWith(em) })
    host.dispatchEvent(new Event('input', { bubbles: true }))
  }

  // ------------------------------------------------ save
  async function save() {
    if (!dirty || saving) return
    setSaving(true)
    try {
      await api(`/api/dashboard/pages/${props.id}`, { method: 'POST', body: { sections: edits(sections), seo, ...(footerDirty ? { shared: sharedEdits() } : {}) } })
      setDirty(false)
      setFooterDirty(false)
      setSaved(true)
      toast('Saved. Press Publish website when you are ready for it to go live.', 'good')
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setSaving(false)
    }
  }
  saveRef.current = save

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveRef.current() } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // ------------------------------------------------ sections tab
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const pinned = sections.filter((s) => s.pinned)
  const movable = sections.filter((s) => !s.pinned)

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = movable.findIndex((s) => s.key === active.id)
    const to = movable.findIndex((s) => s.key === over.id)
    setSections([...pinned, ...arrayMove(movable, from, to)])
    touch()
    bump()
  }
  const toggle = (k: string) => setOpen((o) => { const n = new Set(o); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const hide = (s: Section) => {
    if (!s.hidden && s.menuLinked && !window.confirm('This section is linked from the menu. Hiding it will leave that menu link going nowhere. Hide it anyway?')) return
    setSections((all) => all.map((x) => (x.key === s.key ? { ...x, hidden: !x.hidden } : x)))
    touch()
    bump()
  }

  async function itemOp(s: Section, list: string, op: 'duplicate' | 'remove' | 'up' | 'down', index: number) {
    if (dirty) { toast('Save your changes first, then change the items.', 'bad'); return }
    if (op === 'remove' && !window.confirm('Remove this item from the page?')) return
    setItemBusy(true)
    try {
      await api(`/api/dashboard/pages/${props.id}/items`, { method: 'POST', body: { section: s.key, list, op, index } })
      window.location.href = `/admin/pages/${props.id}?tab=sections&section=${encodeURIComponent(s.key)}`
    } catch (e) {
      toast((e as Error).message, 'bad')
      setItemBusy(false)
    }
  }

  const renderBody = (s: Section) => (
    <>
      {s.lists.map((l) => {
        const locked = l.adminOnly && !props.isAdmin
        return (
          <div className="items" key={l.id}>
            <div className="items-head">{Icon.list()}<span className="grow">{l.label} ({l.count})</span>{locked ? <span className="chip grey">GYA</span> : null}</div>
            {l.items.map((name, i) => (
              <div className="item-row" key={i}>
                <span className="grow" title={name}>{name}</span>
                {locked ? null : (
                  <>
                    <button type="button" className="btn small ghost icon-only" disabled={itemBusy || i === 0} onClick={() => itemOp(s, l.id, 'up', i)} aria-label={`Move ${l.item.toLowerCase()} ${i + 1} up`}>{Icon.arrowUp()}</button>
                    <button type="button" className="btn small ghost icon-only" disabled={itemBusy || i === l.count - 1} onClick={() => itemOp(s, l.id, 'down', i)} aria-label={`Move ${l.item.toLowerCase()} ${i + 1} down`}>{Icon.arrowDown()}</button>
                    <button type="button" className="btn small ghost icon-only" disabled={itemBusy} onClick={() => itemOp(s, l.id, 'duplicate', i)} aria-label={`Duplicate ${l.item.toLowerCase()} ${i + 1}`} title="Duplicate">{Icon.copy()}</button>
                    <button type="button" className="btn small ghost icon-only" disabled={itemBusy || l.count <= 1} onClick={() => itemOp(s, l.id, 'remove', i)} aria-label={`Remove ${l.item.toLowerCase()} ${i + 1}`} title="Remove">{Icon.trash()}</button>
                  </>
                )}
              </div>
            ))}
            {locked ? <p className="help" style={{ padding: '0 10px 8px' }}>Adding another needs an approved design. Ask GYA.</p>
              : <p className="help" style={{ padding: '0 10px 8px' }}>Duplicate an item to add a new one, then change its words on the page.</p>}
          </div>
        )
      })}
      <FieldsList prefix={s.key} fields={s.fields} abs={abs} onField={(fid, p) => { setField(s.key, fid, p); scheduleRefresh() }} />
    </>
  )

  // ------------------------------------------------ panel pieces
  const altInput = (ref: string | null, id: string) => {
    if (!ref) return null
    const f = getField(ref)
    if (!f) return null
    return (
      <div className="field">
        <label htmlFor={id}>Photo description</label>
        <input id={id} className="input" value={textForEditing(f.value)} placeholder="What the photo shows"
          onChange={(e) => { setRef(ref, { value: textForSaving(e.target.value) }); doc()?.querySelectorAll(`img[data-pda="${CSS_escape(ref)}"]`).forEach((im) => im.setAttribute('alt', e.target.value)) }} />
        <div className="help">{HELP.alt}</div>
      </div>
    )
  }

  const linkInput = (ref: string | null, id: string) => {
    if (!ref) return null
    const f = getField(ref)
    if (!f) return null
    return <LinkPicker id={id} value={f.value} targets={props.linkTargets} pagePath={props.pagePath}
      onChange={(v) => { setRef(ref, { value: v }); doc()?.querySelectorAll(`a[data-pdh="${CSS_escape(ref)}"]`).forEach((a) => a.setAttribute('href', v.replace(/&amp;/g, '&'))) }} />
  }

  const applyPhoto = (ref: string, d: MediaDoc) => {
    setRef(ref, { value: mediaSrc(d), media: d.id })
    const img = doc()?.querySelector(`img[data-pdi="${CSS_escape(ref)}"]`)
    const altRef = img?.getAttribute('data-pda')
    if (altRef && d.alt) setRef(altRef, { value: textForSaving(d.alt) })
    bump()
    toast('Photo replaced. Press Save changes to keep it.', 'good')
  }

  const selectImage = (im: Img) => {
    markSelected(im.ref)
    setSelected({ kind: 'image', ref: im.ref, alt: im.alt, link: im.link, section: null })
    const el = doc()?.querySelector(`img[data-pdi="${CSS_escape(im.ref)}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const closeBtn = (fn = () => setSelected(null)) => <button className="btn small ghost" onClick={fn} aria-label="Close">&times;</button>

  const selectionCard = () => {
    if (!selected) return null
    if (selected.kind === 'note') {
      return (
        <div className={`pe-card${selected.lock ? ' locked' : ''}`}>
          <div className="pe-card-head"><b>{selected.lock ? <>{Icon.lock()} </> : null}{selected.title}</b>{closeBtn()}</div>
          {selected.body}
        </div>
      )
    }
    if (selected.kind === 'text') {
      const f = getField(selected.ref)
      const canItalic = selected.heading && !!f && /<em\b/.test(f.value)
      return (
        <div className="pe-card">
          <div className="pe-card-head"><b>Editing words</b>{selected.section ? <span className="chip grey" title={selected.section}>{selected.section}</span> : null}{closeBtn()}</div>
          {selected.ref.startsWith('c:') ? <p className="help">This is part of the footer, which is the same on every page. A change here updates all of them.</p> : null}
          {canItalic ? (
            <div className="pe-format" role="toolbar" aria-label="Formatting">
              <button type="button" className="btn small" onMouseDown={(e) => e.preventDefault()} onClick={italic}><i>I</i> Italic accent</button>
            </div>
          ) : null}
          <p className="help">Type straight onto the page. Press Esc when you are done with this part.</p>
        </div>
      )
    }
    if (selected.kind === 'link') {
      return (
        <div className="pe-card">
          <div className="pe-card-head"><b>Button or link</b>{selected.section ? <span className="chip grey" title={selected.section}>{selected.section}</span> : null}{closeBtn()}</div>
          {selected.words ? <p className="help">Change the words by typing on the page. Choose where it goes here.</p> : null}
          {linkInput(selected.ref, 'pe-sel-link')}
        </div>
      )
    }
    const f = getField(selected.ref)
    return (
      <div className="pe-card">
        <div className="pe-card-head"><b>Photo</b>{selected.section ? <span className="chip grey" title={selected.section}>{selected.section}</span> : null}{closeBtn(() => { setSelected(null); markSelected(null) })}</div>
        {f ? <ImageSlot label="Photo" value={abs(f.value)} original={abs(f.original ?? f.value)}
          onChange={(v) => { setRef(selected.ref, { value: v.value, media: v.media ?? null }); bump() }} /> : null}
        {f?.media ? <FocalPicker mediaId={f.media} src={abs(f.value)} onSaved={() => { toast('Focal point saved. Press Publish website to put it live.', 'good'); bump() }} /> : null}
        {altInput(selected.alt, 'pe-sel-alt')}
        {linkInput(selected.link, 'pe-sel-imglink')}
      </div>
    )
  }

  const status = saving ? 'Saving...' : dirty ? 'Unsaved changes' : saved ? 'All changes saved' : 'No changes yet'
  const width = device === 'desktop' ? DESKTOP_WIDTH : MOBILE_WIDTH
  const scale = stage.w ? Math.min(1, stage.w / width) : 1
  const frameHeight = stage.h ? Math.max(200, stage.h / scale) : 800

  return (
    <div className="pe">
      <div className="pe-bar">
        <a className="btn" href="/admin/pages">&larr; Pages</a>
        <h1 className="pe-title" title={props.url ? `${BRAND.domain}${props.url}` : undefined}>{props.label}</h1>
        <div className="pe-seg" role="group" aria-label="Preview size">
          <button type="button" className={device === 'desktop' ? 'on' : ''} aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}>Desktop</button>
          <button type="button" className={device === 'mobile' ? 'on' : ''} aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}>Mobile</button>
        </div>
        <span className={`pe-status${dirty ? ' warn' : saved ? ' good' : ''}`} aria-live="polite">{status}</span>
        {props.url ? <a className="btn" href={props.url} target="_blank" rel="noopener">{Icon.external()} View</a> : null}
        <button className="btn primary" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving...' : 'Save changes'}</button>
        <PublishButton />
      </div>

      <div className="pe-body">
        <div className={`pe-stage ${device}`} ref={stageRef}>
          <div className="pe-frame" style={{ width: width * scale }}>
            <iframe ref={frame} title={`Editing ${props.label}`} onLoad={onFrameLoad}
              style={{ width, height: frameHeight, transform: `scale(${scale})` }} />
          </div>
          {loading ? <div className="pe-loading" role="status">Updating the preview...</div> : null}
          {previewError ? <div className="pe-error"><Notice tone="bad" icon={Icon.warn()}><p>{previewError}</p><button className="btn small" onClick={() => refresh()}>Try again</button></Notice></div> : null}
        </div>

        <aside className="pe-panel" aria-label="Page settings">
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'content'} className={tab === 'content' ? 'on' : ''} onClick={() => setTab('content')}>Content</button>
            <button role="tab" aria-selected={tab === 'seo'} className={tab === 'seo' ? 'on' : ''} onClick={() => setTab('seo')}>SEO</button>
            <button role="tab" aria-selected={tab === 'sections'} className={tab === 'sections' ? 'on' : ''} onClick={() => setTab('sections')}>Sections</button>
          </div>
          <div className="pe-scroll">
            {tab === 'content' ? (
              <>
                <div className="pe-tip">
                  <p><b>Click any words on the page</b> to change them in place.</p>
                  <p><b>Click any photo</b> to replace it.</p>
                  <p>Press <b>Save changes</b> when you are done, then <b>Publish website</b> to put it live.</p>
                </div>
                {selectionCard()}
                <details className="pe-rules">
                  <summary>Advertising rules for dental websites</summary>
                  <ul>
                    <li>No testimonials or reviews about clinical care.</li>
                    <li>No &quot;pain-free&quot;, &quot;guaranteed&quot;, &quot;best&quot; or &quot;expert&quot; claims.</li>
                    <li>Do not describe Dr Meg as a specialist. Her PhD is a research qualification, not a dental specialist registration.</li>
                    <li>Keep the &quot;clinical assessment&quot; wording wherever a treatment is described.</li>
                    <li>Any founding patient offer must state the price, what is included and the dates it runs.</li>
                  </ul>
                </details>
                <h3 className="pe-h">Photos on this page ({images.length})</h3>
                {!images.length && !loading ? <p className="help">This page has no photos that can be changed here.</p> : null}
                <div className="pe-imgs">
                  {images.map((im, i) => {
                    const f = getField(im.ref)
                    const alt = im.alt ? getField(im.alt) : null
                    const src = abs(f?.value || '')
                    return (
                      <div key={im.ref} className={`pe-img${selected?.kind === 'image' && selected.ref === im.ref ? ' on' : ''}`}>
                        <button type="button" className="pe-thumb" onClick={() => selectImage(im)} aria-label={`Show photo ${i + 1} on the page`}>
                          {src ? <img src={src} alt="" loading="lazy" /> : null}
                        </button>
                        {alt ? (
                          <input className="input" aria-label={`Description of photo ${i + 1}`} value={textForEditing(alt.value)} placeholder="Describe the photo"
                            onChange={(e) => { setRef(im.alt!, { value: textForSaving(e.target.value) }); doc()?.querySelectorAll(`img[data-pda="${CSS_escape(im.alt!)}"]`).forEach((x) => x.setAttribute('alt', e.target.value)) }} />
                        ) : <span className="help grow">No description needed</span>}
                        <button type="button" className="btn small" onClick={() => setPickFor(im.ref)}>Replace</button>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : null}
            {tab === 'seo' ? (
              <SeoPanel seo={seo} onChange={(s) => { setSeo(s); touch() }} url={props.url || '/'} defaultOg={props.defaultOg}
                titleHint={props.defaultTitle} showCanonical={props.isAdmin} />
            ) : null}
            {tab === 'sections' ? (
              <>
                <p className="help" style={{ marginBottom: 12 }}>Drag the dots to change the order. The eye hides or shows a section. Click a section to jump to it; open it to change its items or edit everything in it as a form. Anchors stay with their sections, so the menu keeps working in any order.</p>
                {dirty ? <Notice tone="warn" icon={Icon.warn()}><p>Save your changes before adding, moving or removing items.</p></Notice> : null}
                <div className="sections">
                  {pinned.map((s) => (
                    <SectionRow key={s.key} s={s} open={open.has(s.key)} onToggle={() => toggle(s.key)} onShow={() => scrollToSection(s)} sortable={false}>{renderBody(s)}</SectionRow>
                  ))}
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={movable.map((s) => s.key)} strategy={verticalListSortingStrategy}>
                      {movable.map((s) => (
                        <SectionRow key={s.key} s={s} sortable open={open.has(s.key)} onToggle={() => toggle(s.key)} onShow={() => scrollToSection(s)} onHide={() => hide(s)}>{renderBody(s)}</SectionRow>
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>
              </>
            ) : null}
            {props.lastmod ? <p className="help" style={{ marginTop: 14 }}>Last saved {when(props.lastmod)}.</p> : null}
          </div>
        </aside>
      </div>
      {pickFor ? <MediaPicker onClose={() => setPickFor(null)} onPick={(d) => { const r = pickFor; setPickFor(null); applyPhoto(r, d) }} /> : null}
    </div>
  )
}

/** CSS.escape for attribute selectors, kept local so it works in every browser the dashboard supports. */
function CSS_escape(s: string): string {
  return s.replace(/["\\]/g, '\\$&')
}
