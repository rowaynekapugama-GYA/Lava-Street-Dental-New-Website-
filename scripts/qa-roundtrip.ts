/**
 * Seed, pull, compare: the dashboard holds the website exactly. Needs DATABASE_URL pointing at an EMPTY
 * test database (never the live one): it imports content/ and pulls it back into a temporary folder.
 *
 *   DATABASE_URL=<an empty test database> npx tsx scripts/qa-roundtrip.ts
 */
import './load-env'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const run = (args: string[]) => {
  const r = spawnSync('npx', args, { encoding: 'utf8', env: process.env })
  if (r.status !== 0) { console.error(r.stdout, r.stderr); process.exit(1) }
}
run(['payload', 'migrate'])
run(['tsx', 'scripts/seed.ts'])
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'lsd-pull-'))
fs.mkdirSync(path.join(out, 'pages'))
run(['tsx', 'scripts/pull-content.ts', out])
const walk = (d: string, base = d): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(d, e.name), base) : [path.relative(base, path.join(d, e.name))])
const files = walk('content').sort()
let bad = 0
for (const f of files) {
  const a = fs.readFileSync(path.join('content', f), 'utf8')
  const p = path.join(out, f)
  if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== a) { console.log(`differs: ${f}`); bad++ }
}
console.log(`qa:roundtrip: ${files.length - bad} of ${files.length} content files identical after seed and pull`)
fs.rmSync(out, { recursive: true, force: true })
process.exit(bad ? 1 : 0)
