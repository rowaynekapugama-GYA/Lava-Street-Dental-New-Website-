/** Waitlist and enquiries as a CSV file for Excel (signed in only). */
import { routeUser } from '@/dashboard/lib/routeAuth'

export const dynamic = 'force-dynamic'

const cell = (v: unknown) => {
  const s = String(v ?? '').replace(/\r?\n/g, ' ')
  // a cell starting with = + - @ would run as a formula in Excel
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return /[",]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export async function GET(req: Request) {
  const { payload, user } = await routeUser(req)
  if (!user) return new Response('Please sign in again.', { status: 401 })
  const res = await payload.find({ collection: 'signups', limit: 10000, depth: 0, sort: '-createdAt', pagination: false, overrideAccess: true })
  const head = ['Received', 'Form', 'First name', 'Last name', 'Email', 'Mobile', 'Status', 'Notes', 'Message', 'Signed up on', 'Email to practice']
  const rows = res.docs.map((d) => [
    new Date(String(d.createdAt)).toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' }), d.form === 'enquiry' ? 'Enquiry' : 'Waitlist',
    d.firstName, d.lastName, d.email, d.phone, ({ todo: 'To do', contacted: 'Contacted', booked: 'Booked' } as Record<string, string>)[String(d.status)] ?? d.status,
    d.notes, d.message, d.page, d.emailStatus === 'failed' ? 'Not sent' : 'Sent',
  ].map(cell).join(','))
  const day = new Date().toISOString().slice(0, 10)
  return new Response(`﻿${[head.join(','), ...rows].join('\r\n')}\r\n`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="lava-street-dental-waitlist-${day}.csv"`,
      'cache-control': 'no-store',
    },
  })
}
