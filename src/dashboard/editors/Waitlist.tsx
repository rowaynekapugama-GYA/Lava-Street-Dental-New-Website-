'use client'
/** Waitlist sign-ups and contact enquiries: follow up, note, export, remove. */
import React, { useMemo, useState } from 'react'
import { api } from '../lib/client'
import { useToast } from '../ui/Toast'
import { Icon } from '../ui/icons'
import { BRAND } from '../brand'

export type Signup = {
  id: number | string; form: string; firstName: string; lastName: string; email: string; phone: string; message: string
  page: string; status: string; notes: string; emailStatus: string; createdAt: string
}

const STATUS = [['todo', 'To do'], ['contacted', 'Contacted'], ['booked', 'Booked']] as const
const fmt = (d: string) => new Date(d).toLocaleString('en-AU', { timeZone: BRAND.timeZone, day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })

export function Waitlist({ initial }: { initial: Signup[] }) {
  const toast = useToast()
  const [rows, setRows] = useState(initial)
  const [form, setForm] = useState<'waitlist' | 'enquiry' | 'all'>('waitlist')
  const [status, setStatus] = useState<string>('all')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | number | null>(null)
  const shown = useMemo(() => rows.filter((r) => (form === 'all' || r.form === form) && (status === 'all' || r.status === status)
    && (!q || `${r.firstName} ${r.lastName} ${r.email} ${r.phone}`.toLowerCase().includes(q.toLowerCase()))), [rows, form, status, q])
  const enquiries = rows.filter((r) => r.form === 'enquiry').length

  async function update(r: Signup, patch: Partial<Signup>) {
    setRows((all) => all.map((x) => (x.id === r.id ? { ...x, ...patch } : x)))
    try {
      await api(`/api/signups/${r.id}`, { method: 'PATCH', body: patch })
      if (patch.status) toast('Updated.', 'good')
    } catch (e) {
      toast((e as Error).message, 'bad')
    }
  }
  async function remove(r: Signup) {
    if (!window.confirm(`Remove ${r.firstName} ${r.lastName} (${r.email}) from the dashboard? This cannot be undone. Use it when someone asks to be taken off the list.`)) return
    try {
      await api(`/api/signups/${r.id}`, { method: 'DELETE' })
      setRows((all) => all.filter((x) => x.id !== r.id))
      toast('Removed.', 'good')
    } catch (e) {
      toast((e as Error).message, 'bad')
    }
  }

  return (
    <>
      <div className="signup-filters" role="group" aria-label="Show">
        <button type="button" className={`btn small${form === 'waitlist' ? ' on' : ''}`} aria-pressed={form === 'waitlist'} onClick={() => setForm('waitlist')}>Waitlist ({rows.length - enquiries})</button>
        <button type="button" className={`btn small${form === 'enquiry' ? ' on' : ''}`} aria-pressed={form === 'enquiry'} onClick={() => setForm('enquiry')}>Enquiries ({enquiries})</button>
        <button type="button" className={`btn small${form === 'all' ? ' on' : ''}`} aria-pressed={form === 'all'} onClick={() => setForm('all')}>All</button>
        <span style={{ width: 12 }} />
        <select className="select" style={{ width: 'auto' }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="all">Any status</option>
          {STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input className="input" style={{ width: 240 }} placeholder="Find a name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a name or email" />
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Received</th><th>Name</th><th>Email</th><th>Mobile</th><th>Status</th><th /></tr></thead>
          <tbody>
            {shown.map((r) => (
              <React.Fragment key={String(r.id)}>
                <tr>
                  <td className="muted" style={{ whiteSpace: 'nowrap' }}>{fmt(r.createdAt)}</td>
                  <td><b>{r.firstName} {r.lastName}</b>{r.form === 'enquiry' ? <span className="chip grey" style={{ marginLeft: 6 }}>Enquiry</span> : null}
                    {r.emailStatus === 'failed' ? <span className="chip warn" style={{ marginLeft: 6 }} title="The email to the practice did not go. The details are here.">Email not sent</span> : null}</td>
                  <td><a href={`mailto:${r.email}`}>{r.email}</a></td>
                  <td>{r.phone ? <a href={`tel:${r.phone.replace(/\s+/g, '')}`}>{r.phone}</a> : <span className="muted">Not given</span>}</td>
                  <td>
                    <select className="select" value={r.status} onChange={(e) => update(r, { status: e.target.value })} aria-label={`Status for ${r.firstName} ${r.lastName}`}>
                      {STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn small" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>{open === r.id ? 'Close' : 'Notes'}</button>
                  </td>
                </tr>
                {open === r.id ? (
                  <tr><td colSpan={6} style={{ background: 'var(--pd-panel)' }}>
                    {r.message ? <div className="field"><span className="lab">Message</span><p style={{ whiteSpace: 'pre-wrap' }}>{r.message}</p></div> : null}
                    <p className="help">Signed up on {r.page || 'the website'}.</p>
                    <div className="field">
                      <label htmlFor={`n-${r.id}`}>Notes for the team</label>
                      <textarea id={`n-${r.id}`} className="textarea notes" defaultValue={r.notes} onBlur={(e) => { if (e.target.value !== r.notes) update(r, { notes: e.target.value }) }} />
                      <div className="help">Saved when you click away. For follow-up only: no health information.</div>
                    </div>
                    <button className="btn small danger" onClick={() => remove(r)}>{Icon.trash()} Remove this person</button>
                  </td></tr>
                ) : null}
              </React.Fragment>
            ))}
            {!shown.length ? <tr><td colSpan={6} className="empty">{rows.length ? 'Nobody matches.' : 'No sign-ups yet. People who join the waitlist on the website appear here.'}</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  )
}
