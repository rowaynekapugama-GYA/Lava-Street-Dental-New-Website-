/**
 * Keeps each form submission in the dashboard (Waitlist), best effort: without a database, or if the
 * database is briefly unavailable, the email still goes out and the visitor sees no error.
 */
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { getSettings, mergeSettings, type SiteSettings } from '@/lib/site'
import { settingsFileFromGlobal } from '@/sitekit/sync'

async function payloadOrNull(): Promise<Payload | null> {
  if (!process.env.DATABASE_URL) return null
  try { return await getPayload({ config }) } catch { return null }
}

/** Practice details as published, with the dashboard's latest on top when it can be reached. */
export async function formSettings(): Promise<{ payload: Payload | null; settings: SiteSettings }> {
  const payload = await payloadOrNull()
  if (!payload) return { payload: null, settings: getSettings() }
  try {
    const g = await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true })
    return { payload, settings: mergeSettings(settingsFileFromGlobal(g as never)) }
  } catch {
    return { payload, settings: getSettings() }
  }
}

export async function storeSignup(payload: Payload | null, data: Record<string, unknown>): Promise<number | string | null> {
  if (!payload) return null
  try {
    const doc = await payload.create({ collection: 'signups', data: data as never, overrideAccess: true, depth: 0 })
    return doc.id
  } catch (e) {
    console.error('forms: could not keep the submission in the dashboard', (e as Error).message)
    return null
  }
}

export async function markEmailFailed(payload: Payload | null, id: number | string | null) {
  if (!payload || id === null) return
  try { await payload.update({ collection: 'signups', id, data: { emailStatus: 'failed' } as never, overrideAccess: true, depth: 0 }) } catch { /* bookkeeping only */ }
}
