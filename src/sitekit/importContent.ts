/**
 * Import: load the website's content files into the dashboard (the Import button, `npm run seed`, and the
 * first build with an empty database). Adds what is missing and never overwrites anything saved in the
 * dashboard, unless `overwrite` is set (GYA: "Start again from the website files").
 */
import type { Payload } from 'payload'
import { getChrome, getPages, getRedirects } from '@/lib/content'
import { getSettings } from '@/lib/site'
import { CHROME_SLUG, chromeToDoc, globalFromSettings, pageToDoc } from './sync'

export type ImportResult = { pages: number; updated: number; redirects: number; settings: boolean }

export async function importContent(payload: Payload, opts: { overwrite?: boolean } = {}): Promise<ImportResult> {
  const result: ImportResult = { pages: 0, updated: 0, redirects: 0, settings: false }
  const ctx = { context: { skipTouch: true } }
  const docs = [...getPages().map(pageToDoc), chromeToDoc(getChrome())]
  for (const data of docs) {
    const found = await payload.find({ collection: 'pages', where: { pageSlug: { equals: data.pageSlug } }, limit: 1, depth: 0, overrideAccess: true })
    if (found.docs[0]) {
      if (!opts.overwrite) continue
      await payload.update({ collection: 'pages', id: found.docs[0].id, data: data as never, overrideAccess: true, depth: 0, ...ctx })
      result.updated++
    } else {
      await payload.create({ collection: 'pages', data: data as never, overrideAccess: true, depth: 0, ...ctx })
      result.pages++
    }
  }
  for (const r of getRedirects()) {
    const found = await payload.find({ collection: 'redirects', where: { from: { equals: r.from } }, limit: 1, depth: 0, overrideAccess: true })
    if (found.docs[0]) continue
    await payload.create({ collection: 'redirects', data: { from: r.from, to: r.to, type: r.type } as never, overrideAccess: true, depth: 0, ...ctx })
    result.redirects++
  }
  const status = await payload.findGlobal({ slug: 'site-status', depth: 0, overrideAccess: true }) as { imported?: boolean }
  if (!status?.imported || opts.overwrite) {
    await payload.updateGlobal({ slug: 'site-settings', data: globalFromSettings(getSettings()) as never, overrideAccess: true, depth: 0, ...ctx })
    result.settings = true
  }
  await payload.updateGlobal({ slug: 'site-status', data: { imported: true } as never, overrideAccess: true, depth: 0 })
  return result
}

export const chromeSlug = CHROME_SLUG
