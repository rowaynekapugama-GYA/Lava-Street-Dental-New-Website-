'use client'
/** The Pages list, as the Precision Dental reference: a search box, then each group of pages with Edit and View. */
import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { Icon } from '../ui/icons'
import { BRAND } from '../brand'

export type PageRow = { id: number | string; label: string; url: string; group: string; noindex: boolean; updatedAt: string }

const GROUP_ORDER = ['Main pages', 'Team', 'General dentistry', 'Dental implants', 'Restorative dentistry', 'Cosmetic dentistry',
  'Laser and digital dentistry', 'Areas we serve', 'Legal and other pages', 'Other']

const day = (d: string) => new Date(d).toLocaleDateString('en-AU', { timeZone: BRAND.timeZone, day: '2-digit', month: '2-digit', year: 'numeric' })

export function PagesList({ rows }: { rows: PageRow[] }) {
  const [q, setQ] = useState('')
  const groups = useMemo(() => {
    const m = new Map<string, PageRow[]>()
    for (const r of rows) {
      if (q && !`${r.label} ${r.url}`.toLowerCase().includes(q.toLowerCase())) continue
      const g = r.group || 'Other'
      m.set(g, [...(m.get(g) || []), r])
    }
    return [...m.entries()].sort((a, b) => GROUP_ORDER.indexOf(a[0]) - GROUP_ORDER.indexOf(b[0]))
  }, [rows, q])
  return (
    <>
      <input className="input find" placeholder="Find a page" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a page" />
      {groups.map(([g, list]) => (
        <section key={g} className="page-group" aria-label={g}>
          <h2 className="group-h">{g} ({list.length})</h2>
          <div className="page-rows">
            {list.map((r) => (
              <div className="page-row" key={String(r.id)}>
                <span className="nm"><Link href={`/admin/pages/${r.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>{r.label}</Link>
                  {r.noindex ? <span className="chip warn" style={{ marginLeft: 8 }}>Hidden from Google</span> : null}</span>
                <span className="url">{r.url || 'Shown for addresses that do not exist'}</span>
                <span className="upd">Updated {day(r.updatedAt)}</span>
                <Link className="btn small" href={`/admin/pages/${r.id}`}>Edit</Link>
                {r.url ? <a className="view" href={r.url} target="_blank" rel="noopener">{Icon.external()} View</a> : <span />}
              </div>
            ))}
          </div>
        </section>
      ))}
      {!groups.length ? <p className="empty">No pages match.</p> : null}
    </>
  )
}
