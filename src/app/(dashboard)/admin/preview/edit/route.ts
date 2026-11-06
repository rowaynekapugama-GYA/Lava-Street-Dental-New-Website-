/**
 * The live preview inside the page editor: the page as it would go live with the editor's unsaved
 * changes, with every editable spot marked (src/dashboard/render.ts). Signed in users only; nothing is
 * saved. Section markup always comes from the database; only words, links, photos, order and hidden
 * state come from the editor, checked by the same rules as saving.
 */
import { json, routeUser } from '@/dashboard/lib/routeAuth'
import { chromeWithEdits, loadChrome, loadPage, pageWithEdits, settingsFromDashboard } from '@/dashboard/pages'
import { EDIT_CSS, renderPageHtml } from '@/dashboard/render'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { payload, user } = await routeUser(req)
  if (!user) return json(401, { error: 'Please sign in again.' })
  let body: { id?: number | string; sections?: unknown; shared?: unknown }
  try { body = await req.json() } catch { return json(400, { error: 'Bad request' }) }
  if (body.id === undefined || body.id === null) return json(400, { error: 'Bad request' })
  const admin = user.role === 'admin'
  const loaded = await loadPage(payload, body.id)
  if (!loaded) return json(404, { error: 'This page no longer exists.' })
  const page = pageWithEdits(loaded.page, body.sections, admin, loaded.maps)
  const { chrome } = chromeWithEdits((await loadChrome(payload)).chrome, body.shared, admin)
  const html = renderPageHtml(page, { chrome, settings: await settingsFromDashboard(payload), editable: true, admin, head: EDIT_CSS })
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex, nofollow', 'cache-control': 'no-store' },
  })
}
