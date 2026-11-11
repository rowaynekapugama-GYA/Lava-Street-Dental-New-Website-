/**
 * Proves the content model gives the approved site back: renders content/ as committed and compares every
 * file with what the v1.2.2 build (tools/v122) writes from the original templates. Run it on the release
 * as delivered; once the dashboard has changed the content, the pages differ on purpose.
 *
 *   npm run qa:parity
 *
 * Only the <lastmod> dates in sitemap.xml may differ (they are the build date), and Google Tag Manager (v1.3.4,
 * not in v1.2.2) is taken out of this release's pages before comparing. render-site.ts checks it is on
 * every live page exactly once.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { stripTracking } from '../src/lib/staticSite'

const root = process.cwd()
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lsd-parity-'))

// the v1.2.2 build, as it was: src/, scripts/build.mjs and site.config.mjs side by side
const ref = path.join(tmp, 'v122')
fs.mkdirSync(path.join(ref, 'scripts'), { recursive: true })
fs.cpSync(path.join(root, 'tools', 'v122', 'src'), path.join(ref, 'src'), { recursive: true })
fs.cpSync(path.join(root, 'public'), path.join(ref, 'src'), {
  recursive: true,
  filter: (p) => !/\.html$|sitemap\.xml$|robots\.txt$|\.generated\.json$/.test(p),
})
fs.copyFileSync(path.join(root, 'tools', 'v122', 'build-v1.2.2.mjs'), path.join(ref, 'scripts', 'build.mjs'))
fs.copyFileSync(path.join(root, 'site.config.mjs'), path.join(ref, 'site.config.mjs'))
const a = spawnSync('node', ['scripts/build.mjs'], { cwd: ref, encoding: 'utf8' })
if (a.status !== 0) { console.error(a.stdout, a.stderr); process.exit(1) }

// this release, from content/ as committed (no dashboard changes: content/site-settings.json is {})
const mine = path.join(tmp, 'mine')
const b = spawnSync('npx', ['tsx', 'scripts/render-site.ts', mine], { cwd: root, encoding: 'utf8' })
if (b.status !== 0) { console.error(b.stdout, b.stderr); process.exit(1) }

const walk = (d: string, base = d): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(d, e.name), base) : [path.relative(base, path.join(d, e.name))])
const want = walk(path.join(ref, 'dist')).filter((f) => /\.(html|xml|txt)$/.test(f)).sort()
let bad = 0
for (const f of want) {
  const x = fs.readFileSync(path.join(ref, 'dist', f), 'utf8')
  const p = path.join(mine, f)
  if (!fs.existsSync(p)) { console.log(`missing: ${f}`); bad++; continue }
  let y = fs.readFileSync(p, 'utf8')
  if (f.endsWith('.html')) y = stripTracking(y)
  const norm = (s: string) => (f === 'sitemap.xml' ? s.replace(/<lastmod>[^<]*<\/lastmod>/g, '') : s)
  if (norm(x) !== norm(y)) {
    bad++
    let i = 0
    const xn = norm(x), yn = norm(y)
    while (i < xn.length && xn[i] === yn[i]) i++
    console.log(`differs: ${f} at ${i}\n  v1.2.2: ${JSON.stringify(xn.slice(Math.max(0, i - 60), i + 80))}\n  now:    ${JSON.stringify(yn.slice(Math.max(0, i - 60), i + 80))}`)
  }
}
console.log(`qa:parity: ${want.length - bad} of ${want.length} files identical to the v1.2.2 build`)
fs.rmSync(tmp, { recursive: true, force: true })
process.exit(bad ? 1 : 0)
