import fs from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { getPages } from '@/lib/content'
import { builtInKey } from '@/sitekit/sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Copies the photos already on the website into the Media Library (GYA, once), each described the way
 * the website describes it, so they can be reused and so "Replace" on one of them replaces that photo on
 * every page. Safe to run more than once: photos already there are skipped.
 */
export async function POST() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })
  if ((user as { role?: string }).role !== 'admin') return NextResponse.json({ error: 'Only GYA can do this.' }, { status: 403 })

  // every website photo, with the first description the site gives it
  const photos = new Map<string, string>()
  for (const page of getPages()) {
    for (const s of page.sections) {
      for (const f of s.fields) {
        if (f.type !== 'image' || !f.original) continue
        const key = builtInKey(f.original)
        if (photos.has(key)) continue
        const tag = s.template.match(new RegExp(`<img\\b[^>]*src="\\{\\{${f.id}\\}\\}"[^>]*>`))?.[0] ?? ''
        const altId = /alt="\{\{(f\d+)\}\}"/.exec(tag)?.[1]
        const alt = s.fields.find((x) => x.id === altId)?.value || path.basename(key, path.extname(key)).replace(/[-_]+/g, ' ')
        photos.set(key, alt.replace(/&amp;/g, '&').replace(/&quot;/g, '"'))
      }
    }
  }

  let added = 0
  let skipped = 0
  const failed: string[] = []
  for (const [key, alt] of photos) {
    const filePath = path.join(process.cwd(), 'public', key)
    if (!fs.existsSync(filePath)) { failed.push(key); continue }
    const existing = await payload.find({ collection: 'media', where: { builtIn: { equals: key } }, limit: 1, depth: 0, overrideAccess: true })
    if (existing.docs[0]) { skipped++; continue }
    try {
      await payload.create({ collection: 'media', data: { alt: alt.slice(0, 250), builtIn: key } as never, filePath, overrideAccess: true, depth: 0, context: { skipTouch: true } })
      added++
    } catch {
      failed.push(key)
    }
  }
  return NextResponse.json({
    message: `${added} website photos added to the Media Library${skipped ? `, ${skipped} were already there` : ''}${failed.length ? `. Could not add: ${failed.join(', ')}` : ''}.`,
  })
}
