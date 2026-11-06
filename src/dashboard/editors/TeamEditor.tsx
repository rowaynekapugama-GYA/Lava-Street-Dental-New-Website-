'use client'
/** Dr Meg's profile: the Meet Dr Meg section of the home page, as a form. */
import React, { useState } from 'react'
import Link from 'next/link'
import type { EField } from '../pages'
import { api } from '../lib/client'
import { textForEditing, textForSaving } from '../lib/text'
import { AutoTextarea, useUnsavedWarning } from '../ui/fields'
import { ImageSlot, FocalPicker } from '../ui/MediaPicker'
import { useToast } from '../ui/Toast'
import { Icon } from '../ui/icons'

export type TeamProfile = {
  pageId: number | string
  section: string
  list: string | null
  photo: EField | null
  alt: EField | null
  caption: EField | null
  bio: EField[]
  tags: EField[]
  fine: EField | null
}

const rootPath = (v: string) => (/^(https?:|\/)/.test(v) ? v : `/${v.replace(/^(\.\.\/)+/, '')}`)

/** "Dr Meg Takiguchi<span>Principal dentist</span>" as two boxes. */
const splitCaption = (v: string) => {
  const m = /^([\s\S]*?)<span>([\s\S]*)<\/span>$/.exec(v)
  return m ? { name: m[1], role: m[2] } : { name: v, role: '' }
}

export function TeamEditor({ profile, where, isAdmin }: { profile: TeamProfile; where: { label: string; href: string }[]; isAdmin: boolean }) {
  const toast = useToast()
  const [p, setP] = useState(profile)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  useUnsavedWarning(dirty)
  const cap = splitCaption(p.caption?.value ?? '')
  const change = (fn: (x: TeamProfile) => TeamProfile) => { setP(fn); setDirty(true) }

  async function save() {
    setBusy(true)
    const fields = [p.photo, p.alt, p.caption, ...p.bio, ...p.tags].filter(Boolean).map((f) => ({ id: f!.id, value: f!.value, media: f!.media ?? null }))
    try {
      await api(`/api/dashboard/pages/${p.pageId}`, { method: 'POST', body: { sections: [{ key: p.section, fields }] } })
      setDirty(false)
      toast('Saved. Press Publish website when you are ready for it to go live.', 'good')
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setBusy(false)
    }
  }

  async function tagOp(op: 'duplicate' | 'remove', index: number) {
    if (dirty) { toast('Save your changes first.', 'bad'); return }
    if (!p.list) return
    if (op === 'remove' && !window.confirm('Remove this credential tag?')) return
    setBusy(true)
    try {
      await api(`/api/dashboard/pages/${p.pageId}/items`, { method: 'POST', body: { section: p.section, list: p.list, op, index } })
      window.location.reload()
    } catch (e) {
      toast((e as Error).message, 'bad')
      setBusy(false)
    }
  }

  return (
    <div className="cols">
      <div>
        <div className="panel">
          <div className="panel-head"><h2>Dr Meg Takiguchi</h2><span className="chip grey">Principal dentist</span></div>
          {p.photo ? <ImageSlot label="Photo" value={rootPath(p.photo.value)} original={rootPath(p.photo.original ?? p.photo.value)}
            onChange={(v) => change((x) => ({ ...x, photo: { ...x.photo!, value: v.value, media: v.media ?? null } }))} /> : null}
          {p.photo?.media ? <FocalPicker mediaId={p.photo.media} src={rootPath(p.photo.value)} onSaved={() => toast('Focal point saved.', 'good')} /> : null}
          {p.alt ? (
            <div className="field">
              <label htmlFor="tm-alt">Photo description</label>
              <input id="tm-alt" className="input" value={textForEditing(p.alt.value)} onChange={(e) => change((x) => ({ ...x, alt: { ...x.alt!, value: textForSaving(e.target.value) } }))} />
            </div>
          ) : null}
          {p.caption ? (
            <div className="grid-2" style={{ gap: 12 }}>
              <div className="field">
                <label htmlFor="tm-name">Name</label>
                <input id="tm-name" className="input" value={textForEditing(cap.name)}
                  onChange={(e) => change((x) => ({ ...x, caption: { ...x.caption!, value: `${textForSaving(e.target.value)}<span>${cap.role}</span>` } }))} />
              </div>
              <div className="field">
                <label htmlFor="tm-role">Role</label>
                <input id="tm-role" className="input" value={textForEditing(cap.role)}
                  onChange={(e) => change((x) => ({ ...x, caption: { ...x.caption!, value: `${cap.name}<span>${textForSaving(e.target.value)}</span>` } }))} />
                <div className="help">Shown under her photo. A general dentist: never &quot;specialist&quot;.</div>
              </div>
            </div>
          ) : null}
          {p.bio.map((f, i) => (
            <div className="field" key={f.id}>
              <label htmlFor={`tm-bio-${i}`}>Bio, paragraph {i + 1}</label>
              <AutoTextarea id={`tm-bio-${i}`} value={textForEditing(f.value.replace(/<[^>]+>/g, ''))}
                onChange={(v) => change((x) => ({ ...x, bio: x.bio.map((b) => (b.id === f.id ? { ...b, value: textForSaving(v) } : b)) }))} />
            </div>
          ))}
          <div className="field">
            <span className="lab">Credential tags</span>
            <div className="items">
              {p.tags.map((t, i) => (
                <div className="item-row" key={t.id}>
                  <input className="input" aria-label={`Credential tag ${i + 1}`} value={textForEditing(t.value)}
                    onChange={(e) => change((x) => ({ ...x, tags: x.tags.map((g) => (g.id === t.id ? { ...g, value: textForSaving(e.target.value) } : g)) }))} />
                  <button type="button" className="btn small ghost icon-only" disabled={busy || p.tags.length <= 1} onClick={() => tagOp('remove', i)} aria-label={`Remove credential tag ${i + 1}`}>{Icon.trash()}</button>
                </div>
              ))}
            </div>
            <button type="button" className="btn small" disabled={busy} onClick={() => tagOp('duplicate', p.tags.length - 1)}>{Icon.plus()} Add a credential tag</button>
            <div className="help">Only qualifications and memberships the practice has confirmed. A new tag starts as a copy of the last one; change its words, then Save.</div>
          </div>
          {p.fine ? (
            <div className="field">
              <span className="lab">Fine print {p.fine.locked ? <span className="chip lock">{Icon.lock()} Locked</span> : null}</span>
              <p className="help" style={{ marginTop: 0 }}>{textForEditing(p.fine.value.replace(/<[^>]+>/g, ''))}</p>
              {p.fine.locked ? <p className="help">This wording is there to meet advertising rules. Ask GYA if it needs to change.</p> : <p className="help">GYA: change it in the page editor.</p>}
            </div>
          ) : null}
          <div className="savebar">
            <span className={`state${dirty ? ' dirty' : ''}`}>{dirty ? 'Unsaved changes' : 'No changes yet'}</span>
            <button className="btn primary" disabled={!dirty || busy} onClick={save}>{busy ? 'Saving...' : 'Save changes'}</button>
          </div>
        </div>
      </div>
      <div>
        <div className="panel sticky">
          <h2>Where she appears</h2>
          <ul className="list-plain">
            {where.map((w) => <li key={w.href}><span className="grow"><Link href={w.href}>{w.label}</Link></span>{Icon.chevron()}</li>)}
          </ul>
          <p className="help">This form changes the home page&apos;s Meet Dr Meg section. Her own page and the Meet the Team page have more detail; open them to change their words.</p>
          <p className="help">{isAdmin ? 'Adding a second practitioner needs an approved design for more than one. The team card list is locked to GYA in the page editor.' : 'To add another practitioner, ask GYA: it needs an approved design first.'}</p>
        </div>
      </div>
    </div>
  )
}
