import fs from 'node:fs'
import path from 'node:path'
import type { Chrome, Page, Redirect } from './parts'

export * from './parts'

export const CONTENT = () => path.join(process.cwd(), 'content')

function readJson<T>(rel: string, fallback?: T): T {
  const file = path.join(CONTENT(), rel)
  if (!fs.existsSync(file) && fallback !== undefined) return fallback
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T
}

export function allSlugs(): string[] {
  return fs.readdirSync(path.join(CONTENT(), 'pages')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort()
}

export function getPage(slug: string): Page | null {
  const file = path.join(CONTENT(), 'pages', `${slug}.json`)
  if (!fs.existsSync(file)) return null
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Page
}

export function getPages(): Page[] {
  return allSlugs().map((s) => getPage(s)!).filter(Boolean)
}

export function getChrome(): Chrome {
  return readJson<Chrome>('chrome.json')
}

export function getRedirects(): Redirect[] {
  return readJson<Redirect[]>('redirects.json', [])
}

/** Site-wide SEO settings the dashboard keeps (content/seo.json). */
export type SeoDefaults = { titleFormat?: string; noindexSite?: boolean }
export function getSeoDefaults(): SeoDefaults {
  return readJson<SeoDefaults>('seo.json', {})
}
