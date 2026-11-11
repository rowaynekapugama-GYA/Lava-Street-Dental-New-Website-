/**
 * Production build (npm run build, which Vercel runs).
 *
 *   1. with a database: run migrations, load the website into the dashboard the first time, and pull
 *      whatever the dashboard holds into content/
 *   2. write the public pages from content/ into public/ and check them (scripts/render-site.ts)
 *   3. next build: the dashboard at /admin, Payload at /cms, the form and dashboard API routes
 *
 * The public pages are plain files and never talk to the database. Without DATABASE_URL, or if the
 * database cannot be reached, step 1 is skipped and the site is built from the files in the repository,
 * so the live site can never break because of the dashboard.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

// Vercel sets these for real. Locally they live in .env, which this script reads itself.
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)
    if (!match) continue
    const value = match[2].replace(/^["']|["']$/g, '')
    if (!process.env[match[1]]) process.env[match[1]] = value
  }
}

const run = (command, args) => {
  const res = spawnSync(command, args, { stdio: 'inherit', shell: false })
  if (res.status !== 0) process.exit(res.status ?? 1)
}
const quiet = (command, args) => spawnSync(command, args, { stdio: 'inherit', shell: false }).status

if (process.env.DATABASE_URL) {
  // Dashboard sessions are signed with PAYLOAD_SECRET. With a database attached and no proper secret,
  // sign-ins would be forgeable, so refuse to build rather than go live like that.
  const secret = process.env.PAYLOAD_SECRET || ''
  if (secret.length < 32) {
    console.error(
      '\n> stopped: DATABASE_URL is set but PAYLOAD_SECRET is missing or too short.\n'
        + '  Add PAYLOAD_SECRET in Vercel, Settings, Environment Variables: any random\n'
        + '  string of 32 characters or more. Then redeploy.\n',
    )
    process.exit(1)
  }
  console.log('> applying database migrations')
  if (quiet('npx', ['payload', 'migrate', '--force-accept-warning']) !== 0) {
    console.log('> the database could not be reached or migrated: building from the content files in the repository')
  } else {
    // the first build with a database loads the website into the dashboard by itself (same as Import;
    // it only adds what is missing, so it never overwrites anything saved in the dashboard)
    console.log('> loading the website into the dashboard if it is empty')
    if (quiet('npx', ['tsx', 'scripts/seed.ts', '--if-empty']) !== 0) {
      console.log('> could not load the website into the dashboard; GYA can press Import on the Dashboard')
    }
    // fills in anything a release adds to Site Settings while the dashboard field is still blank
    if (quiet('npx', ['tsx', 'scripts/content-fixes.ts']) !== 0) {
      console.log('> content fixes could not run; the site builds with the dashboard as it is')
    }
    console.log('> pulling content from the dashboard')
    if (quiet('npx', ['tsx', 'scripts/pull-content.ts']) !== 0) {
      console.log('> could not pull content, building from the files already in the repository')
    }
  }
} else {
  console.log('> no DATABASE_URL, building from the content files in the repository')
}

console.log('> writing and checking the public pages')
run('npx', ['tsx', 'scripts/render-site.ts'])

console.log('> building the dashboard')
run('npx', ['next', 'build'])
