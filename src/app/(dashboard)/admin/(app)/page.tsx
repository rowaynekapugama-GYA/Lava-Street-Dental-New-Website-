import Link from 'next/link'
import { payloadClient, requireUser, siteStatus } from '@/dashboard/lib/server'
import { PublishButton } from '@/dashboard/ui/PublishButton'
import { Icon } from '@/dashboard/ui/icons'
import { ImportButtons } from '@/dashboard/editors/ImportButtons'
import { BRAND } from '@/dashboard/brand'
import { settingsFromDashboard } from '@/dashboard/pages'
import { openingChecklist } from '@/dashboard/checklist'
import { CHROME_SLUG } from '@/sitekit/sync'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Dashboard' }

const fmt = (d: string | Date) => new Date(d).toLocaleString('en-AU', { timeZone: BRAND.timeZone, day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-AU', { timeZone: BRAND.timeZone, hour: 'numeric', hour12: false }).format(new Date()))
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

const STATUS: Record<string, [string, string]> = { todo: ['To do', 'warn'], contacted: ['Contacted', 'grey'], booked: ['Booked', 'good'] }

export default async function Home() {
  const u = await requireUser()
  const payload = await payloadClient()
  const status = await siteStatus(payload)
  const notChrome = { pageSlug: { not_equals: CHROME_SLUG } }
  const pageCount = (await payload.count({ collection: 'pages', where: notChrome, overrideAccess: true })).totalDocs
  const home = await payload.find({ collection: 'pages', where: { pageSlug: { equals: 'home' } }, limit: 1, depth: 0, overrideAccess: true, select: { pageSlug: true } })
  const homeId = home.docs[0]?.id
  const empty = pageCount === 0
  const count = async (where: object) => (await payload.count({ collection: 'signups', where: where as never, overrideAccess: true })).totalDocs
  const signups = await count({ form: { equals: 'waitlist' } })
  const toDo = await count({ status: { equals: 'todo' } })
  const photos = (await payload.count({ collection: 'media', overrideAccess: true })).totalDocs
  const latest = await payload.find({ collection: 'signups', limit: 5, sort: '-createdAt', depth: 0, overrideAccess: true })
  const recent = await payload.find({ collection: 'pages', where: notChrome, limit: 5, sort: '-updatedAt', depth: 0, overrideAccess: true, select: { title: true, updatedAt: true } })
  const settings = await settingsFromDashboard(payload)
  const checklist = empty ? [] : await openingChecklist(payload, settings)
  const name = (u.name || u.email.split('@')[0]).split(/\s+/)[0]

  return (
    <>
      <div className="panel welcome">
        <h1>{greeting()}, <em>{name}</em></h1>
        <p style={{ marginTop: 8 }}>This is where you keep the {BRAND.name} website up to date. Change wording and photos, fill in practice details, then press Publish website.</p>
        <div className="actions" style={{ marginTop: 16 }}>
          <PublishButton />
          <a className="btn" href="/" target="_blank" rel="noopener">{Icon.external()} View the website</a>
        </div>
      </div>

      {empty ? (
        <div className="notice warn">{Icon.warn()}<div className="grow">
          <p><b>The dashboard has no pages yet.</b> {u.role === 'admin' ? 'Load the website into it with Import below.' : 'Please ask GYA to finish setting it up.'}</p>
        </div></div>
      ) : status.waiting ? (
        <div className="notice warn">{Icon.warn()}<div className="grow">
          <p><b>You have changes waiting to publish.</b> They are saved in the dashboard but are not on the website yet.</p>
          <p className="help" style={{ margin: 0 }}>Last change {status.lastChangedAt ? fmt(status.lastChangedAt) : ''}.</p>
        </div><PublishButton /></div>
      ) : (
        <div className="notice good">{Icon.check()}<div className="grow">
          <p><b>Nothing to publish right now.</b> {status.lastPublishedAt ? `The website was last published ${fmt(status.lastPublishedAt)}${status.lastPublishedBy ? ` by ${status.lastPublishedBy}` : ''}.` : 'The website matches the dashboard.'}</p>
        </div></div>
      )}
      {!status.hookConfigured ? (
        <div className="notice info">{Icon.info()}<div className="grow"><p>Publishing is not switched on yet. GYA will finish setting it up; your changes are saved in the meantime.</p></div></div>
      ) : null}

      {checklist.length ? (
        <div className="panel" id="checklist">
          <div className="panel-head"><h2>Before opening day</h2><span className="chip warn">{checklist.length} to do</span></div>
          <p className="help" style={{ marginTop: -4 }}>Still showing as a placeholder on the website, or not filled in yet. Each one drops off this list once it is done.</p>
          <ul className="checklist">
            {checklist.map((c, i) => (
              <li key={i}><span className="dot" aria-hidden="true" />
                <span className="grow"><b>{c.label}</b><br /><span className="help">{c.detail}</span></span>
                {c.gya && u.role !== 'admin' ? <span className="chip grey">GYA</span> : <Link className="btn small" href={c.href}>Fill in</Link>}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="stat-row" style={{ marginBottom: 18 }}>
        <div className="stat"><b>{signups}</b><span>Waitlist sign-ups</span></div>
        <div className="stat"><b>{toDo}</b><span>To follow up</span></div>
        <div className="stat"><b>{photos}</b><span>Photos in library</span></div>
        <div className="stat"><b>{checklist.length}</b><span>Details still to fill in</span></div>
      </div>

      <div className="panel">
        <h2>Quick actions</h2>
        <div className="quick">
          <Link href={homeId ? `/admin/pages/${homeId}` : '/admin/pages'}>{Icon.pages()}<span>Edit the homepage<small>Wording, photos and sections</small></span></Link>
          <Link href="/admin/settings">{Icon.settings()}<span>Fill in practice details<small>Address, phone, hours, opening date</small></span></Link>
          <Link href="/admin/media">{Icon.media()}<span>Upload photos<small>Add to the Media Library</small></span></Link>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-head"><h2>Latest waitlist sign-ups</h2><Link className="btn small" href="/admin/waitlist">See all</Link></div>
          {!latest.docs.length ? <p className="empty">No sign-ups yet. People who join the waitlist on the website appear here.</p> : (
            <ul className="list-plain">
              {latest.docs.map((d) => {
                const st = STATUS[String(d.status)] ?? STATUS.todo
                return (
                  <li key={String(d.id)}><span className="grow"><b>{[d.firstName, d.lastName].filter(Boolean).join(' ')}</b>{d.form === 'enquiry' ? <span className="help"> &middot; Enquiry</span> : null}<br />
                    <span className="help">{fmt(String(d.createdAt))}{d.phone ? ` · ${d.phone}` : ''}</span></span>
                    <span className={`chip ${st[1]}`}>{st[0]}</span></li>
                )
              })}
            </ul>
          )}
        </div>
        <div className="panel">
          <h2>Recently edited</h2>
          {!recent.docs.length ? <p className="empty">Nothing yet.</p> : (
            <ul className="list-plain">
              {recent.docs.map((r) => (
                <li key={String(r.id)}><span className="grow"><Link href={`/admin/pages/${r.id}`}>{String(r.title)}</Link><br /><span className="help">Page &middot; {fmt(String(r.updatedAt))}</span></span></li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {u.role === 'admin' ? (
        <div className="panel">
          <h2>Import (GYA only)</h2>
          <p className="help">Loads the website from the repository into the dashboard: the pages, footer, practice details and redirects, then the website&apos;s photos into the Media Library. Safe to run again: anything already in the dashboard is kept. Reset puts every page back to how the repository has it.</p>
          <ImportButtons empty={empty} />
        </div>
      ) : null}
    </>
  )
}
