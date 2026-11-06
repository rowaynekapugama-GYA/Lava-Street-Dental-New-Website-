'use client'
/** Site-wide SEO settings (GYA only): the default share image, the title format and hiding the whole site. */
import React, { useState } from 'react'
import { api } from '../lib/client'
import { ImageSlot } from '../ui/MediaPicker'
import { Toggle } from '../ui/fields'
import { useToast } from '../ui/Toast'

type S = { shareImage: string; shareImageMedia: number | string | null; shareImageAlt: string; titleFormat: string; noindexSite: boolean }

export function SeoDefaultsForm({ initial, siteDefault }: { initial: S; siteDefault: string }) {
  const toast = useToast()
  const [s, setS] = useState(initial)
  const [busy, setBusy] = useState(false)
  async function save() {
    setBusy(true)
    try {
      await api('/api/globals/seo', { method: 'POST', body: { shareImage: s.shareImageMedia, shareImageAlt: s.shareImageAlt, titleFormat: s.titleFormat, noindexSite: s.noindexSite } })
      toast('Saved. Press Publish website when you are ready for it to go live.', 'good')
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="panel" style={{ marginTop: 18 }}>
      <h2>Defaults for the whole site (GYA only)</h2>
      <ImageSlot label="Default share image" value={s.shareImage || siteDefault} original={siteDefault}
        onChange={(v) => setS({ ...s, shareImage: v.media ? v.value : '', shareImageMedia: v.media })} />
      <div className="field">
        <label htmlFor="sd-alt">Default share image description</label>
        <input id="sd-alt" className="input" value={s.shareImageAlt} onChange={(e) => setS({ ...s, shareImageAlt: e.target.value })} placeholder="Reception and waiting area at Lava Street Dental, Warrnambool" />
      </div>
      <div className="field">
        <label htmlFor="sd-format">Title format</label>
        <input id="sd-format" className="input" value={s.titleFormat} onChange={(e) => setS({ ...s, titleFormat: e.target.value })} placeholder="Page name | Lava Street Dental" />
        <div className="help">Shown as a hint while a page title is written. Each page keeps the title written for it.</div>
      </div>
      <Toggle label="Hide the whole website from search engines" checked={s.noindexSite} onChange={(v) => setS({ ...s, noindexSite: v })}
        help="For emergencies only. Every page asks search engines not to list it, and the sitemap is emptied." />
      <div className="actions"><button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Save'}</button></div>
    </div>
  )
}
