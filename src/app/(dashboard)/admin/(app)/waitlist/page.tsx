import { payloadClient, requireUser } from '@/dashboard/lib/server'
import { Waitlist, type Signup } from '@/dashboard/editors/Waitlist'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Waitlist' }

export default async function WaitlistPage() {
  await requireUser()
  const payload = await payloadClient()
  const res = await payload.find({ collection: 'signups', limit: 5000, depth: 0, sort: '-createdAt', pagination: false, overrideAccess: true })
  const rows: Signup[] = res.docs.map((d) => ({
    id: d.id, form: String(d.form), firstName: String(d.firstName ?? ''), lastName: String(d.lastName ?? ''), email: String(d.email ?? ''),
    phone: String(d.phone ?? ''), message: String(d.message ?? ''), page: String(d.page ?? ''), status: String(d.status ?? 'todo'),
    notes: String(d.notes ?? ''), emailStatus: String(d.emailStatus ?? 'sent'), createdAt: String(d.createdAt),
  }))
  return (
    <>
      <div className="pd-head">
        <div className="grow"><h1>Waitlist</h1><p className="pd-sub">Everyone who joined the founding patients waitlist, and messages from the contact page. Each one is also emailed to the practice.</p></div>
        <a className="btn" href="/api/dashboard/signups">{Icon_download()} Export to CSV</a>
      </div>
      <Waitlist initial={rows} />
    </>
  )
}

function Icon_download() {
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v12M7 11l5 5 5-5" /><path d="M4 20h16" /></svg>
}
