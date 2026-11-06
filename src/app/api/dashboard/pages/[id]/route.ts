/**
 * Save changes from the page editor: words, links, photo choices, the section order, hidden sections,
 * the SEO settings and the footer words. The section markup is whatever the database already holds, and
 * every value goes through the same rules as the preview (src/dashboard/pages.ts).
 */
import { json, routeUser } from '@/dashboard/lib/routeAuth'
import { chromeWithEdits, loadChrome, loadPage, pageWithEdits, saveChrome, savePage } from '@/dashboard/pages'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { payload, user } = await routeUser(req)
  if (!user) return json(401, { error: 'Your session has ended. Please sign in again.' })
  const { id } = await params
  let body: { sections?: unknown; seo?: Record<string, unknown>; shared?: unknown }
  try { body = await req.json() } catch { return json(400, { error: 'Bad request' }) }
  const admin = user.role === 'admin'
  const loaded = await loadPage(payload, id)
  if (!loaded) return json(404, { error: 'This page no longer exists.' })
  try {
    const page = pageWithEdits(loaded.page, body.sections, admin, loaded.maps)
    await savePage(payload, loaded.doc, page, body.seo, admin)
    if (body.shared !== undefined) {
      const { id: chromeId, chrome } = await loadChrome(payload)
      const r = chromeWithEdits(chrome, body.shared, admin)
      if (r.changed && chromeId !== null) await saveChrome(payload, chromeId, r.chrome)
    }
  } catch (e) {
    return json(400, { error: (e as Error).message || 'The page could not be saved.' })
  }
  return json(200, { ok: true })
}
