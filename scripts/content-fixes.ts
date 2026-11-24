/**
 * Build step: one-off fixes to what the dashboard holds, run before the content is pulled (scripts/build.mjs).
 * Each fix only fills something that is blank or still has its old wording, so nothing the practice or GYA
 * typed is ever overwritten, and each prints one line in the build log.
 *
 *   npx tsx scripts/content-fixes.ts
 */
import './load-env'

import { getPayload } from 'payload'
import config from '@payload-config'
import { DEFAULTS, mergeSettings } from '../src/lib/site'
import { bookingLink } from '../src/lib/staticSite'
import { settingsFileFromGlobal } from '../src/sitekit/sync'
import type { Part } from '../src/lib/parts'

type Tracking = { ga4?: string | null; metaPixel?: string | null; gtmId?: string | null }

/**
 * v1.3.4: Google Tag Manager for the Google Ads campaign. The live Site Settings come from the database,
 * where the new field starts blank, so the container from site.config.mjs is filled in once. A different
 * ID typed in the dashboard is left alone. To remove GTM later, blank it in site.config.mjs as well as in
 * the dashboard, or the next build fills it in again.
 */
async function applyGtmContainer(payload: Awaited<ReturnType<typeof getPayload>>) {
  const container = String(DEFAULTS.tracking?.gtmId || '').trim()
  if (!container) {
    console.log('[content-fixes] Google Tag Manager: no container in site.config.mjs, nothing to fill in')
    return
  }
  const g = (await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true })) as { tracking?: Tracking }
  const current = String(g?.tracking?.gtmId || '').trim()
  if (current === container) {
    console.log(`[content-fixes] Google Tag Manager container ${container} already in Site Settings`)
    return
  }
  if (current) {
    console.log(`[content-fixes] Google Tag Manager: Site Settings has ${current}, left as it is`)
    return
  }
  await payload.updateGlobal({
    slug: 'site-settings',
    data: { tracking: { ga4: g?.tracking?.ga4 ?? '', metaPixel: g?.tracking?.metaPixel ?? '', gtmId: container } },
    depth: 0,
    overrideAccess: true,
    context: { skipTouch: true },
  })
  console.log(`[content-fixes] Google Tag Manager container ${container} added to Site Settings`)
}

type P = Awaited<ReturnType<typeof getPayload>>
const quiet = { depth: 0, overrideAccess: true, context: { skipTouch: true } } as const

/**
 * v1.4.0: the online booking portal Dr Meg supplied (23 Nov 2026). Fills Site Settings > Booking link
 * once while it is blank; a different link typed in the dashboard is left alone. The buttons use it only
 * while Online booking buttons is on, which the second line reports.
 */
async function applyBookingLink(payload: P) {
  const link = String(DEFAULTS.bookingUrl || '').trim()
  const g = (await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true })) as { bookingUrl?: string | null }
  const current = String(g?.bookingUrl || '').trim()
  if (!link) console.log('[content-fixes] Booking link: none in site.config.mjs, nothing to fill in')
  else if (current === link) console.log('[content-fixes] Booking link already in Site Settings')
  else if (current) console.log(`[content-fixes] Booking link: Site Settings has a different link (${current}), left as it is`)
  else {
    await payload.updateGlobal({ slug: 'site-settings', data: { bookingUrl: link } as never, ...quiet })
    console.log(`[content-fixes] Booking link added to Site Settings: ${link}`)
  }
  const after = (await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true })) as unknown as Record<string, unknown>
  const s = mergeSettings(settingsFileFromGlobal(after as never))
  const from = (v: unknown) => (typeof v === 'boolean' ? 'set in the dashboard' : 'site.config.mjs default, not yet saved in the dashboard')
  console.log(`[content-fixes] Online booking buttons: ${bookingLink(s) ? 'on' : s.onlineBooking ? 'on, but there is no booking link, so the buttons are unchanged' : 'off'} (${from(after.onlineBooking)})`)
  console.log(`[content-fixes] Email address is working: ${s.emailActive ? 'yes' : `no, ${s.emails.public} is hidden and form emails go to ${s.emails.meg}`} (${from(after.emailActive)})`)
}

// ---------------------------------------------------------------- v1.4.0: staff bios (Dr Meg, 23 Nov 2026)

const BIO_PAGE = 'meet-the-team--our-support-team'
const OLD_JAIMEE = 'With over six years of experience as a dental assistant, I hold both my Certificate III and Certificate IV in Dental Assisting and have a genuine passion for helping patients feel comfortable and confident in their smiles. I love being part of a team that makes a positive difference in people’s lives and helping patients feel at ease throughout their dental journey. Having lived in different places, I’ve always enjoyed experiencing new surroundings and embracing new adventures. I’m very excited to explore everything Warrnambool has to offer and to make it my home!'
const OLD_DILLA = 'Dilla’s bio is coming soon.'
const NEW_JAIMEE = [
  'Jaimee has over six years of experience as a dental assistant and holds both a Certificate III and a Certificate IV in Dental Assisting. She’s passionate about helping patients feel at ease during their visits and confident in their smiles. She enjoys being part of a team that makes a positive difference in patients’ lives.',
  'Having lived in different places, Jaimee enjoys exploring new surroundings and embracing new adventures. She’s excited to discover everything Warrnambool has to offer and make it her home.',
]
const NEW_DILLA = [
  'Originally from Indonesia, Dilla is a qualified dental assistant with years of hands-on experience. She brings a warm, welcoming presence to the treatment room and helps patients feel relaxed, heard and well cared for from the moment they arrive.',
  'Dilla trained under Dr Meg while they worked together in Western Australia. She knows how Dr Meg works and can anticipate what she needs chairside, helping appointments run smoothly.',
  'Whether she’s assisting chairside or working behind the scenes, Dilla aims to make each dental visit as comfortable and stress-free as possible.',
]
const BIO_TODO = '<!-- TODO: replace this line with Dilla\'s bio when the client supplies it. -->'

type Model = { sections?: Part[] }
const words = (v: string) => v.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

/**
 * Puts one new bio in place of its old wording: the first paragraph goes into the field that held the old
 * bio, and the others are added as new paragraphs straight after it, in the same card. Returns what happened.
 */
function replaceBio(model: Model, who: string, oldText: string, paragraphs: string[]): 'replaced' | 'already' | string {
  const all = (model.sections ?? []).flatMap((s) => s.fields.map((f) => ({ s, f })))
  if (all.some(({ f }) => f.value === paragraphs[0])) return 'already'
  const hit = all.find(({ f }) => f.value === oldText)
  if (!hit) {
    // someone has rewritten it in the dashboard: find it by the card it sits in, for the build log
    const card = all.find(({ f }) => f.type === 'richtext' && words(f.value).startsWith(who))
    if (!card) return '(no bio found on the page)'
    const rest = card.s.fields.slice(card.s.fields.indexOf(card.f) + 1)
    const stop = rest.findIndex((f) => f.type !== 'richtext' || f.label === 'Small heading')
    return (stop < 0 ? rest : rest.slice(0, stop)).map((f) => words(f.value)).filter(Boolean).join(' / ') || '(empty)'
  }
  const { s, f } = hit
  const slot = `<p>{{${f.id}}}</p>`
  if (!s.template.includes(slot)) return `(the page layout around ${who}'s bio has changed)`
  let next = Math.max(0, ...s.fields.map((x) => Number(/^f(\d+)$/.exec(x.id)?.[1] ?? 0))) + 1
  const added = paragraphs.slice(1).map((value) => ({ id: `f${next++}`, label: 'Paragraph', type: 'richtext' as const, value }))
  s.template = s.template.replace(BIO_TODO, '').replace(slot, slot + added.map((x) => `<p>{{${x.id}}}</p>`).join(''))
  f.value = paragraphs[0]
  s.fields.push(...added)
  return 'replaced'
}

/** The bios Dr Meg sent, into the dashboard's copy of Our Support Team, only where the old wording still stands. */
async function applyStaffBios(payload: P) {
  const found = await payload.find({ collection: 'pages', where: { pageSlug: { equals: BIO_PAGE } }, limit: 1, depth: 0, overrideAccess: true })
  const doc = found.docs[0] as unknown as { id: number | string; model?: string | null } | undefined
  if (!doc?.model) { console.log('[content-fixes] Staff bios: the Our Support Team page is not in the dashboard, nothing to do'); return }
  const model = JSON.parse(doc.model) as Model
  const results: [string, string][] = [
    ['Jaimee', replaceBio(model, 'Jaimee', OLD_JAIMEE, NEW_JAIMEE)],
    ['Dilla', replaceBio(model, 'Dilla', OLD_DILLA, NEW_DILLA)],
  ]
  if (results.some(([, r]) => r === 'replaced')) {
    await payload.update({ collection: 'pages', id: doc.id, data: { model: JSON.stringify(model) } as never, ...quiet })
  }
  for (const [who, r] of results) {
    if (r === 'replaced') console.log(`[content-fixes] Staff bios: ${who}'s new bio is now on Our Support Team`)
    else if (r === 'already') console.log(`[content-fixes] Staff bios: ${who}'s new bio already in place`)
    else console.log(`[content-fixes] Staff bios: ${who}'s bio was changed in the dashboard, so it was left as it is. It reads: ${r}`)
  }
}

/**
 * v1.4.0: the striped "IMAGE: Support team portrait" box on Meet the Team was showing to visitors. It is
 * switched off (the hidden attribute) until the team photos arrive; the box and its words stay in the page.
 */
async function hideTeamPortraitBox(payload: P) {
  const box = '<div class="img-ph tall" role="img"'
  const found = await payload.find({ collection: 'pages', where: { pageSlug: { equals: 'meet-the-team' } }, limit: 1, depth: 0, overrideAccess: true })
  const doc = found.docs[0] as unknown as { id: number | string; model?: string | null } | undefined
  if (!doc?.model) return
  const model = JSON.parse(doc.model) as Model
  let changed = 0
  for (const s of model.sections ?? []) {
    if (!s.template.includes(box)) continue
    s.template = s.template.split(box).join('<div class="img-ph tall" hidden role="img"')
    changed++
  }
  if (!changed) { console.log('[content-fixes] Meet the Team: no visible placeholder image box'); return }
  await payload.update({ collection: 'pages', id: doc.id, data: { model: JSON.stringify(model) } as never, ...quiet })
  console.log('[content-fixes] Meet the Team: the placeholder "Support team portrait" box is hidden until the photos arrive')
}

async function main() {
  const payload = await getPayload({ config })
  const status = (await payload.findGlobal({ slug: 'site-status', depth: 0, overrideAccess: true })) as { imported?: boolean }
  if (status?.imported !== true) {
    console.log('[content-fixes] the website is not in the dashboard yet, nothing to fix (the repository files are used)')
    process.exit(0)
  }
  await applyGtmContainer(payload)
  await applyBookingLink(payload)
  await applyStaffBios(payload)
  await hideTeamPortraitBox(payload)
  process.exit(0)
}

main().catch((e) => {
  console.error('[content-fixes] failed:', (e as Error).message)
  process.exit(1)
})
