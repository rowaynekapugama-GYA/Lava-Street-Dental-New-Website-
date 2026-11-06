import { payloadClient, requireUser } from '@/dashboard/lib/server'
import { SeoOverview } from '@/dashboard/editors/SeoOverview'
import { SeoDefaultsForm } from '@/dashboard/editors/SeoDefaultsForm'
import { CHROME_SLUG, mediaUrl, type MediaDoc, type PageDoc } from '@/sitekit/sync'
import { settingsFromDashboard } from '@/dashboard/pages'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'SEO' }

export default async function Seo() {
  const u = await requireUser()
  const payload = await payloadClient()
  const settings = await settingsFromDashboard(payload)
  const pages = await payload.find({ collection: 'pages', where: { pageSlug: { not_in: [CHROME_SLUG, 'not-found'] } }, limit: 1000, depth: 1, overrideAccess: true, sort: 'title', pagination: false,
    select: { title: true, path: true, pageSlug: true, metaTitle: true, metaDescription: true, ogImage: true, canonical: true, noindex: true } })
  const rows = (pages.docs as unknown as PageDoc[]).map((d) => {
    const og = d.ogImage && typeof d.ogImage === 'object' ? d.ogImage as MediaDoc : null
    return {
      kind: 'page' as const, id: d.id, label: String(d.title), url: String(d.path), live: true, defaultOg: settings.shareImage.path,
      seo: { title: String(d.metaTitle ?? ''), description: String(d.metaDescription ?? ''), ogImage: og ? mediaUrl(og) ?? '' : '', ogImageMedia: og?.id ?? null, canonical: String(d.canonical ?? ''), noindex: !!d.noindex },
    }
  })
  rows.sort((a, b) => (a.url === '/' ? -1 : b.url === '/' ? 1 : a.label.localeCompare(b.label)))
  const g = u.role === 'admin' ? await payload.findGlobal({ slug: 'seo', depth: 1, overrideAccess: true }) as { shareImage?: MediaDoc | null; shareImageAlt?: string; titleFormat?: string; noindexSite?: boolean } : null
  return (
    <>
      <div className="pd-head"><div className="grow"><h1>SEO</h1><p className="pd-sub">How each page appears in Google. Titles work best between 30 and 60 characters, descriptions between 70 and 155.</p></div></div>
      <SeoOverview initial={rows} />
      {g ? (
        <SeoDefaultsForm initial={{
          shareImage: g.shareImage && typeof g.shareImage === 'object' ? mediaUrl(g.shareImage) ?? '' : '',
          shareImageMedia: g.shareImage && typeof g.shareImage === 'object' ? g.shareImage.id : null,
          shareImageAlt: g.shareImageAlt ?? '', titleFormat: g.titleFormat ?? '', noindexSite: !!g.noindexSite,
        }} siteDefault={settings.shareImage.path} />
      ) : null}
    </>
  )
}
