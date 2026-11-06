import fs from 'node:fs'
import path from 'node:path'
import config from '../../site.config.mjs'

/** The values the site was approved with (site.config.mjs). */
export const DEFAULTS = config

export type SiteSettings = typeof config

/** The defaults with whatever the dashboard saved on top. One level merge for objects, arrays replaced wholesale. */
export function mergeSettings(saved: Record<string, unknown>): SiteSettings {
  const merged: Record<string, unknown> = JSON.parse(JSON.stringify(DEFAULTS))
  for (const [k, v] of Object.entries(saved || {})) {
    if (v === null || v === undefined) continue
    const base = (DEFAULTS as Record<string, unknown>)[k]
    if (base && typeof base === 'object' && !Array.isArray(base) && typeof v === 'object' && !Array.isArray(v)) {
      merged[k] = { ...(base as object), ...Object.fromEntries(Object.entries(v as object).filter(([, x]) => x !== null && x !== undefined)) }
    } else {
      merged[k] = v
    }
  }
  return merged as SiteSettings
}

let cache: SiteSettings | null = null

/** Site Settings as the build sees them: the defaults with content/site-settings.json on top. */
export function getSettings(): SiteSettings {
  if (cache) return cache
  const file = path.join(process.cwd(), 'content', 'site-settings.json')
  let saved: Record<string, unknown> = {}
  try {
    if (fs.existsSync(file)) saved = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>
  } catch {
    saved = {}
  }
  cache = mergeSettings(saved)
  return cache
}

export const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
