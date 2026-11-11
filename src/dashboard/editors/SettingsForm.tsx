'use client'
/**
 * Site Settings. Practice details for everyone; brand, form recipients, tracking and site switches for GYA.
 * Only settings the website uses are shown, and each says where it appears, so nothing changed here is
 * silently ignored. A detail left empty is hidden on the website (never shown as a placeholder).
 */
import React, { useState } from 'react'
import { api } from '../lib/client'
import { Notice, TextArea, TextInput, Toggle, useUnsavedWarning } from '../ui/fields'
import { PublishButton } from '../ui/PublishButton'
import { useToast } from '../ui/Toast'
import { Icon } from '../ui/icons'

export type SettingsState = {
  name: string
  phone: string
  publicEmail: string
  streetAddress: string
  locality: string
  region: string
  postcode: string
  postalAddress: string
  mapsUrl: string
  hours: string[]
  openingDate: string
  socials: { instagram: string; facebook: string; google: string }
  bookingUrl: string
  healthFunds: string
  // GYA
  siteUrl: string
  preOpening: boolean
  hoursSchema: string[]
  paymentAccepted: string[]
  formRecipients: string[]
  tracking: { ga4: string; metaPixel: string; gtmId: string }
  features: { blog: boolean; beforeAfter: boolean }
}

export type BrandInfo = { logo: string; logoOnDark: string; colours: [string, string, string][] }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PH = 'Still showing as a placeholder on the website'

function Panel({ id, title, intro, children }: { id: string; title: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel" id={id}>
      <h2>{title}</h2>
      {intro ? <p className="help" style={{ marginTop: 4, marginBottom: 14 }}>{intro}</p> : null}
      {children}
    </section>
  )
}

function Lines({ label, help, value, onChange, id, placeholder }: { label: string; help?: React.ReactNode; value: string[]; onChange: (v: string[]) => void; id: string; placeholder?: string }) {
  return (
    <div className="field" id={id}>
      <span className="lab">{label}</span>
      {value.map((line, i) => (
        <div className="actions" key={i} style={{ marginBottom: 6, flexWrap: 'nowrap' }}>
          <input className="input" aria-label={`${label}, line ${i + 1}`} value={line} placeholder={placeholder}
            onChange={(e) => onChange(value.map((x, j) => (j === i ? e.target.value : x)))} />
          <button type="button" className="btn small ghost icon-only" aria-label={`Remove line ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>{Icon.trash()}</button>
        </div>
      ))}
      <button type="button" className="btn small" onClick={() => onChange([...value, ''])}>{Icon.plus()} Add a line</button>
      {help ? <div className="help">{help}</div> : null}
    </div>
  )
}

export function SettingsForm({ initial, isAdmin, brand }: { initial: SettingsState; isAdmin: boolean; brand: BrandInfo }) {
  const toast = useToast()
  const [s, setS] = useState<SettingsState>(initial)
  const [tab, setTab] = useState<'details' | 'gya'>('details')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  useUnsavedWarning(dirty)
  const set = (patch: Partial<SettingsState>) => { setS((x) => ({ ...x, ...patch })); setDirty(true) }
  const empty = (v: string | string[]) => (Array.isArray(v) ? !v.filter((x) => x.trim()).length : !v.trim())
  const ph = (v: string | string[], extra?: React.ReactNode) => (empty(v) ? <><span className="chip warn">{PH}</span> {extra}</> : extra)
  const gtmBad = !!s.tracking.gtmId.trim() && !/^GTM-[A-Z0-9]+$/.test(s.tracking.gtmId.trim().toUpperCase())

  async function save() {
    if (s.publicEmail.trim() && !EMAIL.test(s.publicEmail.trim())) { toast('The email address does not look right.', 'bad'); return }
    if (s.phone.trim() && !/\d{6,}/.test(s.phone.replace(/\D/g, ''))) { toast('The phone number does not look right.', 'bad'); return }
    for (const [label, v] of [['Booking link', s.bookingUrl], ['Google Maps link', s.mapsUrl], ['Instagram link', s.socials.instagram], ['Facebook link', s.socials.facebook], ['Google Business Profile link', s.socials.google]] as const) {
      if (v.trim() && !/^https:\/\//.test(v.trim())) { toast(`The ${label} should start with https://`, 'bad'); return }
    }
    const badEmail = s.formRecipients.find((e) => e.trim() && !EMAIL.test(e.trim()))
    if (badEmail) { toast(`This address does not look right: ${badEmail}`, 'bad'); return }
    if (isAdmin && gtmBad) { toast('The Google Tag Manager ID should look like GTM-ML7789N3.', 'bad'); return }
    setBusy(true)
    const lines = (a: string[]) => a.map((x) => x.trim()).filter(Boolean).map((line) => ({ line }))
    const body: Record<string, unknown> = {
      name: s.name.trim(), phone: s.phone.trim(), publicEmail: s.publicEmail.trim() || null,
      streetAddress: s.streetAddress.trim(), locality: s.locality.trim(), postcode: s.postcode.trim(),
      postalAddress: s.postalAddress.trim(), mapsUrl: s.mapsUrl.trim(), hours: lines(s.hours), openingDate: s.openingDate.trim(),
      socials: { instagram: s.socials.instagram.trim(), facebook: s.socials.facebook.trim(), google: s.socials.google.trim() },
      bookingUrl: s.bookingUrl.trim(), healthFunds: s.healthFunds.trim(),
    }
    if (isAdmin) {
      Object.assign(body, {
        region: s.region.trim(), siteUrl: s.siteUrl.trim().replace(/\/+$/, ''), preOpening: s.preOpening, hoursSchema: lines(s.hoursSchema),
        paymentAccepted: lines(s.paymentAccepted), formRecipients: s.formRecipients.map((x) => x.trim()).filter(Boolean).map((email) => ({ email })),
        tracking: { ga4: s.tracking.ga4.trim(), metaPixel: s.tracking.metaPixel.trim(), gtmId: s.tracking.gtmId.trim().toUpperCase() },
      })
    }
    try {
      await api('/api/globals/site-settings', { method: 'POST', body })
      setDirty(false)
      toast('Saved. Press Publish website when you are ready for it to go live.', 'good')
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {isAdmin ? (
        <div className="tabs" role="tablist" style={{ marginBottom: 16 }}>
          <button role="tab" aria-selected={tab === 'details'} className={tab === 'details' ? 'on' : ''} onClick={() => setTab('details')}>Practice details</button>
          <button role="tab" aria-selected={tab === 'gya'} className={tab === 'gya' ? 'on' : ''} onClick={() => setTab('gya')}>Brand, forms and tracking (GYA)</button>
        </div>
      ) : null}

      {tab === 'details' ? (
        <>
          <Panel id="details" title="Practice details" intro="These fill in everywhere they appear: the header phone, every call button, the opening timeline, the footer's Visit column, the contact page and the business details Google reads. Leave a detail empty to hide it on the website.">
            <TextInput id="name" label="Practice name" value={s.name} onChange={(v) => set({ name: v })} />
            <div className="grid-2" style={{ gap: 14 }}>
              <TextInput id="phone" label="Phone" value={s.phone} onChange={(v) => set({ phone: v })} placeholder="03 5208 9006"
                help={ph(s.phone, 'Type it the way it should be shown. Call buttons and phone links are hidden while this is empty.')} />
              <TextInput id="publicEmail" type="email" label="Email" value={s.publicEmail} onChange={(v) => set({ publicEmail: v })}
                help={ph(s.publicEmail, 'Shown in the footer and on the contact page.')} />
            </div>
            <TextInput id="streetAddress" label="Street address" value={s.streetAddress} onChange={(v) => set({ streetAddress: v })} placeholder="116 Lava Street"
              help={ph(s.streetAddress, 'While empty the website says "Lava Street, Warrnambool" and the map is hidden.')} />
            <div className="grid-3">
              <TextInput id="locality" label="Suburb or town" value={s.locality} onChange={(v) => set({ locality: v })} />
              {isAdmin ? <TextInput id="region" label="State" value={s.region} onChange={(v) => set({ region: v })} /> : <div className="field"><span className="lab">State</span><p>{s.region}</p></div>}
              <TextInput id="postcode" label="Postcode" value={s.postcode} onChange={(v) => set({ postcode: v })} />
            </div>
            <TextInput id="postalAddress" label="Postal address" value={s.postalAddress} onChange={(v) => set({ postalAddress: v })}
              help="Only if post goes somewhere else. Not shown on the website yet." />
            <TextInput id="mapsUrl" label="Google Maps link" value={s.mapsUrl} onChange={(v) => set({ mapsUrl: v })} placeholder="https://maps.google.com/..."
              help="Kept for a directions link. The contact page map is drawn from the street address." />
          </Panel>

          <Panel id="opening" title="Opening hours and opening date">
            <Lines id="hours" label="Opening hours" value={s.hours} onChange={(v) => set({ hours: v })} placeholder="Monday to Thursday: 8:30am to 5:30pm"
              help={ph(s.hours, 'One line each, exactly as they should read on the website. Shown in the footer and on the contact page.')} />
            <TextInput id="openingDate" label="Opening date" value={s.openingDate} onChange={(v) => set({ openingDate: v })} placeholder="December 2026"
              help={ph(s.openingDate, 'Shown at the top of the home page and as step 3 of the opening timeline. While empty they say "Opening soon".')} />
            {isAdmin ? null : <p className="help">When the practice opens, GYA switches the website from waitlist to booking for you.</p>}
          </Panel>

          <Panel id="social" title="Social links and booking">
            <TextInput id="instagram" label="Instagram" value={s.socials.instagram} onChange={(v) => set({ socials: { ...s.socials, instagram: v } })} placeholder="https://www.instagram.com/..."
              help={ph(s.socials.instagram, 'Not yet created? Leave it empty. Google reads it from the website.')} />
            <TextInput id="facebook" label="Facebook" value={s.socials.facebook} onChange={(v) => set({ socials: { ...s.socials, facebook: v } })} placeholder="https://www.facebook.com/..."
              help={ph(s.socials.facebook, 'Not yet created? Leave it empty.')} />
            <TextInput id="google" label="Google Business Profile" value={s.socials.google} onChange={(v) => set({ socials: { ...s.socials, google: v } })} />
            <TextInput id="bookingUrl" label="Booking link" value={s.bookingUrl} onChange={(v) => set({ bookingUrl: v })} placeholder="https://"
              help="For after opening, once online booking is set up. Not shown on the website yet." />
            <TextArea label="Health funds and HICAPS" value={s.healthFunds} onChange={(v) => set({ healthFunds: v })}
              help="Leave empty until the practice confirms its health fund arrangements. Not shown on the website yet; the pages' own wording covers payments today." />
          </Panel>
        </>
      ) : (
        <>
          <Panel id="mode" title="Opening mode">
            <Toggle label="Opening soon (waitlist) mode" checked={s.preOpening} onChange={(v) => set({ preOpening: v })}
              help="On: every booking button says Join the waitlist and goes to the waitlist form. Off: they switch back to Book an appointment and the contact page. Switch off on opening day, then Publish website." />
            <Lines id="hoursSchema" label="Opening hours for Google" value={s.hoursSchema} onChange={(v) => set({ hoursSchema: v })} placeholder="Mo,Tu,We,Fr 08:30-17:30"
              help="The same hours in the format search engines read (schema.org). Update them with the hours above." />
            <Lines id="paymentAccepted" label="Payments accepted (for Google)" value={s.paymentAccepted} onChange={(v) => set({ paymentAccepted: v })} />
            <TextInput id="siteUrl" label="Website address" value={s.siteUrl} onChange={(v) => set({ siteUrl: v })}
              help="The live domain, used for canonical tags, share links and the sitemap. No slash at the end." />
          </Panel>
          <Panel id="forms" title="Form recipients" intro="Waitlist sign-ups and contact enquiries are emailed to these addresses (SMTP2GO). FORM_TO in Vercel, if set, wins over this list. Empty uses info@lavastreetdental.com.au and rowayne@gyaclients.com. Every one is also copied to brett@generateyouraudience.com (FORM_CC in Vercel changes that).">
            <Lines id="formRecipients" label="Send form emails to" value={s.formRecipients} onChange={(v) => set({ formRecipients: v })} placeholder="info@lavastreetdental.com.au" help="Add the practice's SmileOx intake address here once it is known." />
          </Panel>
          <Panel id="tracking" title="Tracking">
            <div className="grid-2" style={{ gap: 14 }}>
              <TextInput label="GA4 measurement ID" value={s.tracking.ga4} onChange={(v) => set({ tracking: { ...s.tracking, ga4: v } })} placeholder="G-XXXXXXXXXX" />
              <TextInput label="Meta Pixel ID" value={s.tracking.metaPixel} onChange={(v) => set({ tracking: { ...s.tracking, metaPixel: v } })} placeholder="Numbers only" />
              <TextInput id="gtmId" label="Google Tag Manager ID" value={s.tracking.gtmId} onChange={(v) => set({ tracking: { ...s.tracking, gtmId: v } })} placeholder="GTM-XXXXXXX"
                help={gtmBad ? 'Use the container ID from Google Tag Manager: GTM- followed by letters and numbers.' : 'The Google Ads container. Blank turns it off, but the next build puts GTM-ML7789N3 back unless GYA also removes it from the code.'} />
            </div>
            <p className="help">Added to every page of the live domain only once filled in, never to the demo address, previews or this dashboard. The privacy policy names Google; add Meta to it before switching the Pixel on. If Google Tag Manager also loads GA4, clear the GA4 field here so page views are not counted twice.</p>
          </Panel>
          <Panel id="brand" title="Brand" intro="The logo and colours are part of the approved design and come from the website's own files. They are shown here for reference; GYA changes them in the code so every page stays consistent.">
            <div className="actions" style={{ marginBottom: 14 }}>
              <span style={{ background: '#F4F1EA', padding: 12, borderRadius: 10 }}><img src={brand.logo} alt="Lava Street Dental logo" style={{ height: 44 }} /></span>
              <span style={{ background: '#292826', padding: 12, borderRadius: 10 }}><img src={brand.logoOnDark} alt="Lava Street Dental logo for dark backgrounds" style={{ height: 44 }} /></span>
            </div>
            <div className="actions">
              {brand.colours.map(([name, hex, use]) => (
                <span key={hex} className="chip grey" title={use} style={{ gap: 6, display: 'inline-flex', alignItems: 'center' }}>
                  <span style={{ width: 14, height: 14, borderRadius: 4, background: hex, border: '1px solid rgb(0 0 0 / .15)' }} />{name} {hex}
                </span>
              ))}
            </div>
          </Panel>
          <Panel id="features" title="Switched off for now">
            <Notice tone="info" icon={Icon.info()}>
              <p><b>Blog posts</b> and <b>Before &amp; After</b> stay off: the site has no approved blog or gallery design yet, and clinical photos need the practice&apos;s patient consent process confirmed first. GYA builds them before they are switched on.</p>
            </Notice>
            <p className="help">Blog: {s.features.blog ? 'on' : 'off'}. Before &amp; After: {s.features.beforeAfter ? 'on' : 'off'}.</p>
          </Panel>
        </>
      )}

      <div className="savebar panel" style={{ margin: 0 }}>
        <span className={`state${dirty ? ' dirty' : ''}`}>{dirty ? 'Unsaved changes' : 'No changes yet'}</span>
        <button className="btn primary" disabled={!dirty || busy} onClick={save}>{busy ? 'Saving...' : 'Save changes'}</button>
        <PublishButton />
      </div>
    </>
  )
}
