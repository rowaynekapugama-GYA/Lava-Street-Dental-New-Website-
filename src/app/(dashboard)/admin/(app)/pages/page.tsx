import { payloadClient, requireUser } from '@/dashboard/lib/server'
import { PagesList } from '@/dashboard/editors/Lists'
import { CHROME_SLUG } from '@/sitekit/sync'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Pages' }

export default async function Pages() {
  await requireUser()
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'pages', limit: 1000, depth: 0, overrideAccess: true, pagination: false,
    where: { pageSlug: { not_equals: CHROME_SLUG } },
    select: { title: true, path: true, pageSlug: true, group: true, noindex: true, updatedAt: true },
  })
  const rows = res.docs.map((d) => ({
    id: d.id,
    label: String(d.title),
    url: d.pageSlug === 'not-found' ? '' : String(d.path || ''),
    group: String(d.group || 'Main pages'),
    noindex: !!d.noindex,
    updatedAt: String(d.updatedAt),
  }))
  rows.sort((a, b) => (a.url === '/' ? -1 : b.url === '/' ? 1 : a.label.localeCompare(b.label)))
  return (
    <>
      <div className="pd-head"><div className="grow"><h1>Pages</h1><p className="pd-sub">Every page of the website. Open one to change its wording, photos, section order and SEO.</p></div></div>
      {!rows.length ? <p className="empty">The dashboard has no pages yet. GYA loads them with Import on the Dashboard.</p> : <PagesList rows={rows} />}
    </>
  )
}
