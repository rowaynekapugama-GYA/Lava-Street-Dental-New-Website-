/** Where each Media Library photo is used, so unused photos can be deleted and used ones replaced instead. */
import { json, routeUser } from '@/dashboard/lib/routeAuth'
import { builtInKey, CHROME_SLUG, type MediaDoc, type PageDoc } from '@/sitekit/sync'
import type { Page } from '@/lib/parts'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { payload, user } = await routeUser(req)
  if (!user) return json(401, { error: 'Please sign in again.' })
  const media = (await payload.find({ collection: 'media', limit: 2000, depth: 0, pagination: false, overrideAccess: true, select: { builtIn: true } })).docs as unknown as MediaDoc[]
  const pages = (await payload.find({ collection: 'pages', limit: 500, depth: 0, pagination: false, overrideAccess: true, select: { title: true, pageSlug: true, model: true, ogImage: true } })).docs as unknown as PageDoc[]
  const seo = await payload.findGlobal({ slug: 'seo', depth: 0, overrideAccess: true }).catch(() => null) as { shareImage?: number | string | null } | null
  const usage: Record<string, string[]> = {}
  const add = (id: number | string, where: string) => { const k = String(id); usage[k] = [...new Set([...(usage[k] ?? []), where])] }
  const byBuiltIn = new Map(media.filter((m) => m.builtIn).map((m) => [builtInKey(m.builtIn!), m.id]))
  for (const d of pages) {
    if (d.pageSlug === CHROME_SLUG || !d.model) continue
    if (d.ogImage) add(typeof d.ogImage === 'object' ? (d.ogImage as MediaDoc).id : d.ogImage, `${d.title} (share image)`)
    const model = JSON.parse(d.model) as Pick<Page, 'sections'>
    for (const s of model.sections ?? []) {
      for (const f of s.fields) {
        if (f.type !== 'image') continue
        if (f.media) add(f.media, d.title)
        else if (f.original && byBuiltIn.has(builtInKey(f.original))) add(byBuiltIn.get(builtInKey(f.original))!, d.title)
      }
    }
  }
  if (seo?.shareImage) add(seo.shareImage, 'Default share image')
  return json(200, { usage })
}
