import { payloadClient, requireUser } from '@/dashboard/lib/server'
import { loadPage } from '@/dashboard/pages'
import { isCompliance } from '@/dashboard/render'
import { TeamEditor, type TeamProfile } from '@/dashboard/editors/TeamEditor'
import type { PageDoc } from '@/sitekit/sync'
import { FIELD } from '@/lib/parts'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Team' }

/**
 * Dr Meg's profile, as the home page's Meet Dr Meg section holds it: photo, name and role, bio and
 * credential tags. Saving here changes that section; her profile page and the Meet the Team page are
 * edited in the page editor (linked below the form).
 */
export default async function Team() {
  const u = await requireUser()
  const admin = u.role === 'admin'
  const payload = await payloadClient()
  const find = async (slug: string) => (await payload.find({ collection: 'pages', where: { pageSlug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true, select: { title: true } })).docs[0] as unknown as PageDoc | undefined
  const homeDoc = await find('home')
  const loaded = homeDoc ? await loadPage(payload, homeDoc.id) : null
  const sec = loaded?.page.sections.find((s) => s.key === 'welcome')
  let profile: TeamProfile | null = null
  if (loaded && sec) {
    const ids = (frag: string) => [...frag.matchAll(FIELD)].map((m) => m[1])
    const byId = new Map(sec.fields.map((f) => [f.id, f]))
    const media = sec.template.slice(sec.template.indexOf('welcome-media'), sec.template.indexOf('</figure>'))
    const meg = sec.template.slice(sec.template.indexOf('class="meg"'))
    const chips = meg.slice(meg.indexOf('class="chips"'), meg.indexOf('</ul>'))
    const list = sec.lists?.find((l) => chips.includes(`{{[${l.id}]}}`))
    const photo = ids(media).map((id) => byId.get(id)).find((f) => f?.type === 'image')
    const alt = ids(media).map((id) => byId.get(id)).find((f) => f?.type === 'alt')
    const caption = ids(media).map((id) => byId.get(id)).find((f) => f?.type === 'richtext')
    const bio = ids(meg.slice(0, meg.indexOf('class="chips"'))).map((id) => byId.get(id)!).filter((f) => f && f.label === 'Paragraph')
    const tags = ids(chips).map((id) => byId.get(id)!).filter(Boolean)
    const fine = ids(meg).map((id) => byId.get(id)!).find((f) => f && f.label === 'Fine print')
    profile = {
      pageId: loaded.doc.id,
      section: sec.key,
      list: list?.id ?? null,
      photo: photo ?? null,
      alt: alt ?? null,
      caption: caption ?? null,
      bio,
      tags,
      fine: fine ? { ...fine, locked: !admin && isCompliance(fine) } : null,
    }
  }
  const team = await find('meet-the-team')
  const megPage = await find('meet-the-team--dr-meg-takiguchi')
  const where = [
    homeDoc ? { label: 'Home page, Meet Dr Meg', href: `/admin/pages/${homeDoc.id}?section=welcome` } : null,
    megPage ? { label: 'Dr Meg Takiguchi (her own page)', href: `/admin/pages/${megPage.id}` } : null,
    team ? { label: 'Meet the Team page', href: `/admin/pages/${team.id}` } : null,
  ].filter(Boolean) as { label: string; href: string }[]
  return (
    <>
      <div className="pd-head"><div className="grow"><h1>Team</h1><p className="pd-sub">The people the website introduces. Credentials come from the practice only: never add or upgrade one, and never describe Dr Meg as a specialist.</p></div></div>
      {profile ? <TeamEditor profile={profile} where={where} isAdmin={admin} /> : <p className="empty">The dashboard has no pages yet. GYA loads them with Import on the Dashboard.</p>}
    </>
  )
}
