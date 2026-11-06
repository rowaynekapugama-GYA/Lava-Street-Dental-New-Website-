/**
 * Build step: write what the dashboard holds into content/, which scripts/render-site.ts turns into the site.
 *
 *   npm run pull                 from the database in DATABASE_URL
 *   npm run pull -- <folder>     write into another folder (the round-trip check uses it)
 *
 * Until the website has been imported into the dashboard, nothing is written: the files in the repository
 * stay the only source, so an empty database can never empty the website.
 */
import './load-env'

import fs from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getChrome } from '../src/lib/content'
import {
  CHROME_SLUG, docToChrome, docToPage, mediaUrl, pageForFile, photoMaps, redirectFromDoc, settingsFileFromGlobal,
  type MediaDoc, type PageDoc, type RedirectDoc,
} from '../src/sitekit/sync'

const OUT = path.resolve(process.argv[2] || path.join(process.cwd(), 'content'))

function write(rel: string, data: unknown) {
  const file = path.join(OUT, rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(data, null, 1)}\n`)
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('pull: no DATABASE_URL, leaving the content files as they are')
    process.exit(0)
  }
  const payload = await getPayload({ config })
  const status = (await payload.findGlobal({ slug: 'site-status', depth: 0, overrideAccess: true })) as { imported?: boolean }
  const res = await payload.find({ collection: 'pages', limit: 500, depth: 1, pagination: false, overrideAccess: true })
  const docs = res.docs as unknown as PageDoc[]
  const pages = docs.filter((d) => d.pageSlug !== CHROME_SLUG)
  if (!pages.length || status?.imported !== true) {
    console.log('pull: the website has not been imported into the dashboard yet, building from the files in the repository')
    process.exit(0)
  }

  const maps = await photoMaps(payload)
  const wanted = new Set<string>()
  for (const d of pages) {
    const page = docToPage(d, maps)
    write(`pages/${page.slug}.json`, pageForFile(page))
    wanted.add(`${page.slug}.json`)
  }
  // pages removed in the dashboard (GYA only) leave the site too
  const dir = path.join(OUT, 'pages')
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.json') && !wanted.has(f)) fs.unlinkSync(path.join(dir, f))

  const chrome = docToChrome(docs.find((d) => d.pageSlug === CHROME_SLUG), getChrome())
  write('chrome.json', chrome)

  const g = await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true })
  const settings = settingsFileFromGlobal(g as never)
  const seo = (await payload.findGlobal({ slug: 'seo', depth: 1, overrideAccess: true })) as {
    shareImage?: MediaDoc | null; shareImageAlt?: string | null; titleFormat?: string | null; noindexSite?: boolean | null
  }
  const share = seo?.shareImage && typeof seo.shareImage === 'object' ? seo.shareImage : null
  if (share && mediaUrl(share)) {
    settings.shareImage = {
      path: mediaUrl(share), width: share.width ?? 1200, height: share.height ?? 630,
      alt: seo.shareImageAlt || share.alt || '',
    }
  }
  write('site-settings.json', settings)
  write('seo.json', { ...(seo?.titleFormat ? { titleFormat: seo.titleFormat } : {}), ...(seo?.noindexSite ? { noindexSite: true } : {}) })

  const r = await payload.find({ collection: 'redirects', limit: 1000, depth: 0, pagination: false, overrideAccess: true, sort: 'createdAt' })
  write('redirects.json', (r.docs as unknown as RedirectDoc[]).map(redirectFromDoc))

  console.log(`pull: ${pages.length} pages, the footer, Site Settings, SEO and ${r.docs.length} redirects written to ${path.relative(process.cwd(), OUT) || '.'}`)
  process.exit(0)
}

void main()
