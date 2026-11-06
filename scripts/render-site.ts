/**
 * Build step: write the public site from content/ into public/.
 *
 *   content/pages/*.json + content/chrome.json + Site Settings  ->  public/index.html, public/about/index.html, ...
 *   sitemap.xml and robots.txt for the canonical domain
 *   src/generated/site-routes.json (the addresses and redirects src/proxy.ts serves)
 *
 * Then checks every page the way the v1.2.2 build did. Problems that would break the site stop the build
 * (the live site then stays as it was). Things the practice can cause by typing (a duplicate page title, a
 * link to a page that does not exist) are reported as warnings so a publish still goes through.
 *
 * `npm run render -- <folder>` writes to another folder instead (the parity check uses it).
 */
import './load-env'
import fs from 'node:fs'
import path from 'node:path'
import { getChrome, getPages, getRedirects, getSeoDefaults } from '../src/lib/content'
import { getSettings } from '../src/lib/site'
import { siteOrigin, urlFor } from '../src/lib/staticSite'
import { renderPageHtml } from '../src/dashboard/render'

const root = process.cwd()
const out = path.resolve(process.argv[2] || path.join(root, 'public'))
const manifestPath = path.join(out, '.generated.json')

const settings = getSettings()
const seo = getSeoDefaults()
const chrome = getChrome()
const pages = getPages()
const errors: string[] = []
const warnings: string[] = []
const notices: string[] = []

const origin = siteOrigin(settings)
if (!/^https:\/\/[^/]+$/.test(origin)) errors.push(`Site Settings: siteUrl must look like https://example.com.au (got "${settings.siteUrl}")`)
const phone = String(settings.phone || '').trim()
if (phone && !/\d{6,}/.test(phone.replace(/\D/g, ''))) errors.push(`Site Settings: phone must be a number or empty, not "${phone}"`)

const files = new Map<string, string>()
for (const page of pages) files.set(page.file, renderPageHtml(page, { chrome, settings, errors }))

const indexed = pages
  .filter((p) => p.file !== '404.html' && !p.meta?.noindex)
  .map((p) => p.file)
  .sort((x, y) => (x === 'index.html' ? -1 : y === 'index.html' ? 1 : x.localeCompare(y)))
const today = new Date().toISOString().slice(0, 10)
files.set('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
  + (seo.noindexSite ? '' : indexed.map((rel) => `  <url><loc>${urlFor(settings, rel)}</loc><lastmod>${today}</lastmod></url>`).join('\n') + '\n')
  + `</urlset>\n`)
files.set('robots.txt', seo.noindexSite ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`)

// ---------------------------------------------------------------- checks (as the v1.2.2 build)
const j = (...p: string[]) => p.join('')
const BANNED: [RegExp, string, boolean][] = [
  [new RegExp(j('lavastreetdental', '\\.com(?!\\.au)'), 'i'), 'practice domain without .au', true],
  [new RegExp(j('vercel', '\\.app'), 'i'), 'hard-coded Vercel preview address', true],
  [new RegExp(j('lor', 'em'), 'i'), 'dummy Latin filler text', false],
  [new RegExp(j('\\bT', 'BA\\b')), 'to-be-announced placeholder', false],
]
const exists = (rel: string) => files.has(rel) || fs.existsSync(path.join(out, rel)) || fs.existsSync(path.join(root, 'public', rel))
const titles = new Map<string, string[]>()
const descs = new Map<string, string[]>()

for (const page of pages) {
  const rel = page.file
  const s = files.get(rel)!
  if (/\{\{\{?[#^/]?\w+\}\}/.test(s)) errors.push(`${rel}: unrendered {{ }} token`)
  for (const [re, what, fatal] of BANNED) if (re.test(s)) (fatal ? errors : warnings).push(`${rel}: ${what}`)
  if (!page.meta?.noindex && !seo.noindexSite && new RegExp(j('no', 'index'), 'i').test(s)) errors.push(`${rel}: robots no-index directive`)
  if (/\[(PHONE NUMBER|EMAIL ADDRESS|STREET ADDRESS|OPENING HOURS|OPENING DATE)[^\]]*\]/.test(s)) warnings.push(`${rel}: contact placeholder left in`)
  const h1 = (s.match(/<h1[\s>]/g) || []).length
  if (h1 !== 1) warnings.push(`${rel}: ${h1} <h1> elements (expected exactly 1)`)
  const title = (s.match(/<title>([\s\S]*?)<\/title>/) || [])[1]
  const desc = (s.match(/<meta name="description" content="([^"]*)">/) || [])[1]
  if (!title) warnings.push(`${rel}: missing <title>`)
  if (!desc) warnings.push(`${rel}: missing meta description`)
  if (rel !== '404.html') {
    if (title) titles.set(title, [...(titles.get(title) || []), rel])
    if (desc) descs.set(desc, [...(descs.get(desc) || []), rel])
    const canon = (s.match(/<link rel="canonical"/g) || []).length
    if (canon !== 1) errors.push(`${rel}: ${canon} canonical tags (expected 1)`)
  }
  for (const block of s.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || []) {
    const body = block.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')
    try { JSON.parse(body) } catch (e) { errors.push(`${rel}: invalid JSON-LD (${(e as Error).message})`) }
    if (/\[[A-Z][A-Z ]{3,}/.test(body)) warnings.push(`${rel}: placeholder text inside JSON-LD`)
  }
  for (const tag of s.match(/<img\b[^>]*>/g) || []) {
    if (!/\swidth="\d+"/.test(tag) || !/\sheight="\d+"/.test(tag)) errors.push(`${rel}: <img> without width and height: ${tag.slice(0, 90)}`)
  }
  const refs = [...s.matchAll(/\s(?:href|src)="([^"]+)"/g)].map((m) => m[1])
  for (const m of s.matchAll(/\ssrcset="([^"]+)"/g)) refs.push(...m[1].split(',').map((x) => x.trim().split(/\s+/)[0]))
  for (const ref of refs) {
    if (/^(https?:|mailto:|tel:|#|data:|\/api\/media\/)/.test(ref)) continue
    let clean = ref.split('#')[0].split('?')[0]
    try { clean = decodeURI(clean) } catch { /* keep as is */ }
    if (!clean) continue
    let target = clean.startsWith('/') ? clean.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(rel), clean))
    if (target === '' || target === '.' || target.endsWith('/')) target = `${target === '.' ? '' : target}index.html`
    else if (!path.posix.extname(target)) target = `${target}/index.html`
    if (!exists(target)) warnings.push(`${rel}: broken link or file "${ref}"`)
  }
  const visible = s.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '')
  for (const m of visible.matchAll(/\[[A-Z][^\]<]{2,}\]/g)) notices.push(`${rel}: ${m[0].slice(0, 90)}`)
}
for (const [t, list] of titles) if (list.length > 1) warnings.push(`duplicate <title> "${t}" on ${list.join(', ')}`)
for (const [d, list] of descs) if (list.length > 1) warnings.push(`duplicate meta description on ${list.join(', ')}`)
for (const p of [settings.shareImage.path, settings.logo]) {
  if (!/^https?:/.test(p) && !exists(p.replace(/^\//, ''))) errors.push(`Site Settings reference a missing file: ${p}`)
}

// ---------------------------------------------------------------- write
if (errors.length) {
  console.error(`\nBUILD FAILED: ${errors.length} error(s)`)
  for (const e of errors) console.error(`  x ${e}`)
  process.exit(1)
}
const previous: string[] = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : []
for (const f of previous) if (!files.has(f) && fs.existsSync(path.join(out, f))) fs.unlinkSync(path.join(out, f))
for (const [f, html] of files) {
  const p = path.join(out, f)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, html)
}
fs.writeFileSync(manifestPath, JSON.stringify([...files.keys()].sort(), null, 1) + '\n')

if (out === path.join(root, 'public')) {
  const routes = pages.filter((p) => p.file !== '404.html').map((p) => p.path).sort()
  fs.mkdirSync(path.join(root, 'src', 'generated'), { recursive: true })
  fs.writeFileSync(path.join(root, 'src', 'generated', 'site-routes.json'), JSON.stringify({ routes, redirects: getRedirects() }, null, 1) + '\n')
}

console.log(`render: ${pages.length} pages for ${origin} into ${path.relative(root, out) || '.'}`)
console.log(`Phone: ${phone || '(empty, phone links hidden)'}   Email: ${settings.emails?.public || '(empty)'}   Hours: ${settings.hours?.length ? settings.hours.join('; ') : '(empty, hidden)'}`)
console.log(`sitemap.xml: ${seo.noindexSite ? 0 : indexed.length} URLs   robots.txt: ${seo.noindexSite ? 'site hidden from search engines' : 'indexing allowed'}`)
if (notices.length) {
  console.log(`\nContent notices: ${notices.length} editorial placeholder(s) still visible, for the client to supply:`)
  for (const n of notices) console.log(`  - ${n}`)
}
if (warnings.length) {
  console.log(`\nWarnings: ${warnings.length} (the site still builds; fix these in the dashboard)`)
  for (const w of warnings) console.log(`  ! ${w}`)
}
console.log(`\nRender OK: 0 errors, ${warnings.length} warnings.`)
