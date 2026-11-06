import { notFound } from 'next/navigation'
import { payloadClient, requireUser } from '@/dashboard/lib/server'
import { PageEditor, type LinkTarget } from '@/dashboard/editors/PageEditor'
import { linkedAnchors, loadChrome, loadPage, sectionsForEditor, settingsFromDashboard, titleFormat } from '@/dashboard/pages'
import { footerEditable, isCompliance } from '@/dashboard/render'
import { CHROME_SLUG, mediaUrl, type PageDoc } from '@/sitekit/sync'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await payloadClient()
  const d = await payload.findByID({ collection: 'pages', id, depth: 0, overrideAccess: true, select: { title: true } }).catch(() => null)
  return { title: d ? `Edit ${d.title}` : 'Page' }
}

export default async function EditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ section?: string; tab?: string }> }) {
  const u = await requireUser()
  const admin = u.role === 'admin'
  const { id } = await params
  const { section, tab } = await searchParams
  const payload = await payloadClient()
  const loaded = await loadPage(payload, id)
  if (!loaded) notFound()
  const { doc, page } = loaded
  const { chrome } = await loadChrome(payload)
  const settings = await settingsFromDashboard(payload)

  // where a button or link can point: this page's sections, the home page's sections, every page
  const all = await payload.find({ collection: 'pages', limit: 500, depth: 0, pagination: false, overrideAccess: true, select: { title: true, path: true, pageSlug: true, model: true }, sort: 'title' })
  const targets: LinkTarget[] = []
  const sectionTargets = (p: { sections: { key: string; label: string; attrs: Record<string, string | null>; template: string; hidden?: boolean }[] }, prefix: string, group: string) => {
    for (const s of p.sections) {
      if (s.attrs.id) targets.push({ group, label: s.label, href: `${prefix}#${s.attrs.id}` })
      if (/\sid="waitlist"/.test(s.template)) targets.push({ group, label: 'Waitlist form', href: `${prefix}#waitlist` })
    }
  }
  sectionTargets(page, '', 'Sections on this page')
  const homeDoc = (all.docs as unknown as PageDoc[]).find((d) => d.pageSlug === 'home')
  if (homeDoc && page.slug !== 'home' && homeDoc.model) sectionTargets(JSON.parse(homeDoc.model), '/', 'Home page sections')
  for (const d of all.docs as unknown as PageDoc[]) {
    if (d.pageSlug === CHROME_SLUG || d.pageSlug === 'not-found' || !d.path) continue
    targets.push({ group: 'Pages', label: d.title, href: d.path })
  }

  const og = doc.ogImage && typeof doc.ogImage === 'object' ? doc.ogImage : null
  return (
    <PageEditor
      id={doc.id}
      label={String(doc.title)}
      url={doc.pageSlug === 'not-found' ? null : doc.path ?? null}
      pagePath={page.path === '/404' ? '/' : page.path}
      sections={sectionsForEditor(page, admin)}
      menuAnchors={[...linkedAnchors(page)]}
      footer={(chrome.parts.footer?.fields ?? []).filter((f) => footerEditable(f, admin)).map((f) => ({ ...f, locked: !admin && isCompliance(f) }))}
      linkTargets={targets}
      isAdmin={admin}
      seo={{
        title: String(doc.metaTitle ?? ''),
        description: String(doc.metaDescription ?? ''),
        ogImage: og ? mediaUrl(og) ?? '' : '',
        ogImageMedia: og ? og.id : null,
        canonical: String(doc.canonical ?? ''),
        noindex: !!doc.noindex,
      }}
      defaultOg={settings.shareImage.path}
      defaultTitle={titleFormat().replace('Page name', String(doc.title))}
      lastmod={doc.updatedAt ? String(doc.updatedAt) : null}
      focusSection={section ?? null}
      startTab={tab === 'sections' || tab === 'seo' ? tab : 'content'}
    />
  )
}
