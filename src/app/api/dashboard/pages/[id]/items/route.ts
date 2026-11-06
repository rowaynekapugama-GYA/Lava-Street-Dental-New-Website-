/**
 * Repeating items (care cards, questions, credential tags, timeline steps): add a copy, remove one, or
 * move one up or down. Saved straight away (not published). The editor asks for unsaved word changes to
 * be saved first, so nothing typed is lost.
 */
import { json, routeUser } from '@/dashboard/lib/routeAuth'
import { changeItems, loadPage, savePage } from '@/dashboard/pages'

export const dynamic = 'force-dynamic'

const OPS = new Set(['duplicate', 'remove', 'up', 'down'])

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { payload, user } = await routeUser(req)
  if (!user) return json(401, { error: 'Your session has ended. Please sign in again.' })
  const { id } = await params
  let body: { section?: string; list?: string; op?: string; index?: number }
  try { body = await req.json() } catch { return json(400, { error: 'Bad request' }) }
  if (!body.section || !body.list || !OPS.has(String(body.op)) || !Number.isInteger(body.index)) return json(400, { error: 'Bad request' })
  const loaded = await loadPage(payload, id)
  if (!loaded) return json(404, { error: 'This page no longer exists.' })
  const part = loaded.page.sections.find((s) => s.key === body.section)
  const list = part?.lists?.find((l) => l.id === body.list)
  if (!part || !list) return json(404, { error: 'That list is no longer on the page.' })
  if (list.adminOnly && user.role !== 'admin') return json(403, { error: `Adding or removing ${list.label.toLowerCase()} needs an approved design. Ask GYA.` })
  try {
    const next = changeItems(part, list.id, body.op as 'duplicate', body.index!)
    const page = { ...loaded.page, sections: loaded.page.sections.map((s) => (s.key === part.key ? next : s)) }
    await savePage(payload, loaded.doc, page, undefined, user.role === 'admin')
    return json(200, { ok: true, fields: next.fields.filter((f) => f.type !== 'srcset'), count: (next.template.match(new RegExp(`\\{\\{\\[${list.id}\\]\\}\\}`, 'g')) ?? []).length })
  } catch (e) {
    return json(400, { error: (e as Error).message })
  }
}
