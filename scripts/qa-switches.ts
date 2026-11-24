/**
 * The Site Settings switches, in every combination: opening-soon mode, online booking buttons and whether
 * the email address is working (the last two added in v1.4.0). Renders content/ eight times and checks that
 * each switch changes what it should and nothing else.
 *
 *   npm run qa:switches
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import config from '../site.config.mjs'

const root = process.cwd()
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lsd-switches-'))
const portal = String(config.bookingUrl)
const address = String(config.emails.public)
let bad = 0
const fail = (what: string) => { bad++; console.log(`  x ${what}`) }

type State = { preOpening: boolean; onlineBooking: boolean; emailActive: boolean }
const name = (s: State) => `${s.preOpening ? 'opening soon' : 'open'}, booking ${s.onlineBooking ? 'on' : 'off'}, email ${s.emailActive ? 'on' : 'off'}`
const key = (s: State) => `${+s.preOpening}${+s.onlineBooking}${+s.emailActive}`

const walk = (d: string, base = d): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(d, e.name), base) : [path.relative(base, path.join(d, e.name))])

const out = new Map<string, Map<string, string>>()
const states: State[] = []
for (const preOpening of [true, false]) for (const onlineBooking of [true, false]) for (const emailActive of [true, false]) states.push({ preOpening, onlineBooking, emailActive })

for (const s of states) {
  const dir = path.join(tmp, key(s))
  const r = spawnSync('npx', ['tsx', 'scripts/render-site.ts', dir], { cwd: root, encoding: 'utf8', env: { ...process.env, LSD_QA_SETTINGS: JSON.stringify(s) } })
  if (r.status !== 0) { console.log(`${name(s)}: the render failed\n${r.stdout}\n${r.stderr}`); bad++; continue }
  if (!/Render OK: 0 errors, 0 warnings\./.test(r.stdout)) fail(`${name(s)}: the render reported warnings`)
  const pages = new Map<string, string>()
  for (const f of walk(dir)) if (f.endsWith('.html') && !f.startsWith('_demo')) pages.set(f, fs.readFileSync(path.join(dir, f), 'utf8'))
  out.set(key(s), pages)
}

const BUTTON = /<a class="btn[^"]*"[^>]*>[^<]*<\/a>/g
const BOOKED = /<a [^>]*\bdata-book\b[^>]*>([^<]*)<\/a>/g
const mainOf = (html: string) => /<main[\s\S]*<\/main>/.exec(html)?.[0] ?? ''

for (const s of states) {
  const pages = out.get(key(s))
  if (!pages) continue
  console.log(`${name(s)}`)
  let booked = 0
  let waitlist = 0
  for (const [f, html] of pages) {
    const links = [...html.matchAll(BOOKED)]
    booked += links.length
    waitlist += (html.match(/<a class="btn btn-(?:primary|outline)" href="[^"]*#waitlist">/g) || []).length
    for (const m of links) {
      if (!m[0].includes(`href="${portal}"`) || !m[0].includes('target="_blank" rel="noopener"')) fail(`${f}: a booking button is not a new-tab link to the portal`)
      if (!/^Book /.test(m[1])) fail(`${f}: booking button reads "${m[1]}"`)
    }
    if (s.onlineBooking && links.length < 2) fail(`${f}: the header and the mobile menu should each have a booking button`)
    if (/emergency-dental-care/.test(f)) {
      if (mainOf(html).includes('data-book')) fail(`${f}: the emergency page must not have a booking button in the page`)
      if (!html.includes('Emergency appointments cannot be booked online.')) fail(`${f}: "Emergency appointments cannot be booked online." is missing`)
    }
    if (f === 'index.html') {
      if (!html.includes('id="heroForm"')) fail('index.html: the waitlist form is missing')
      if (s.preOpening && !html.includes('href="#waitlist"')) fail('index.html: the links down to the waitlist form are missing')
    }
    if (f === 'contact/index.html' && !html.includes('id="enquiryForm"')) fail('contact/index.html: the enquiry form is missing')
    const hasAddress = html.includes(address)
    if (s.emailActive && !hasAddress) fail(`${f}: the email address is missing`)
    if (!s.emailActive) {
      if (hasAddress) fail(`${f}: still shows ${address}`)
      if (html.includes('mailto:')) fail(`${f}: still has an email link`)
      if (/"email":/.test(html)) fail(`${f}: structured data still has an email`)
      if (/email us at/.test(html)) fail(`${f}: a form hint still offers the email address`)
    }
    if (!html.includes('03 5208 9006')) fail(`${f}: the phone number is missing`)
  }
  if (s.onlineBooking && (booked !== 99 || waitlist !== 0)) fail(`expected 99 booking buttons and none to the waitlist form, got ${booked} and ${waitlist}`)
  if (!s.onlineBooking && (booked !== 0 || waitlist !== (s.preOpening ? 99 : 0))) fail(`expected no portal links and ${s.preOpening ? 99 : 0} waitlist buttons, got ${booked} and ${waitlist}`)
  console.log(`  ${booked} buttons open the portal, ${waitlist} go to the waitlist form, email ${s.emailActive ? 'shown' : 'hidden on all pages'}`)
}

// each switch changes only its own thing
const differs = (a: Map<string, string>, b: Map<string, string>, norm: (h: string) => string) => [...a.keys()].filter((f) => norm(a.get(f)!) !== norm(b.get(f) ?? ''))
const noButtons = (h: string) => h.replace(BUTTON, '')
for (const preOpening of [true, false]) for (const emailActive of [true, false]) {
  const on = out.get(key({ preOpening, onlineBooking: true, emailActive }))
  const off = out.get(key({ preOpening, onlineBooking: false, emailActive }))
  if (!on || !off) continue
  const d = differs(on, off, noButtons)
  if (d.length) fail(`online booking changes more than the buttons on: ${d.join(', ')}`)
}
for (const preOpening of [true, false]) for (const onlineBooking of [true, false]) {
  const on = out.get(key({ preOpening, onlineBooking, emailActive: true }))
  const off = out.get(key({ preOpening, onlineBooking, emailActive: false }))
  if (!on || !off) continue
  // only pages with wording written around the address may differ beyond the footer line and the structured data
  const norm = (h: string) => h
    .replace(/<li><a href="mailto:[^"]*">[^<]*<\/a><\/li>/g, '')
    .replace(/"email":"[^"]*",/g, '')
    .replace(/^\s+$/gm, '')
  const d = differs(on, off, norm).sort()
  const expected = ['contact/index.html', 'index.html', 'meet-the-team/our-support-team/index.html', 'privacy-policy/index.html']
  if (JSON.stringify(d) !== JSON.stringify(expected)) fail(`switching the email off changed wording on: ${d.join(', ')} (expected ${expected.join(', ')})`)
}

console.log(bad ? `qa:switches: ${bad} problem(s)` : 'qa:switches: all 8 combinations of opening-soon mode, online booking and the email switch are right.')
fs.rmSync(tmp, { recursive: true, force: true })
process.exit(bad ? 1 : 0)
