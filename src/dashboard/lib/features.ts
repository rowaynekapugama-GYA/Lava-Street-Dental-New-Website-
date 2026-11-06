import type { Payload } from 'payload'
import { DEFAULTS } from '@/lib/site'

/** Dashboard features that wait for an approved design: off until GYA switches them on in Site Settings. */
export async function features(payload: Payload): Promise<{ blog: boolean; beforeAfter: boolean }> {
  const g = await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }).catch(() => null) as { features?: { blog?: boolean; beforeAfter?: boolean } } | null
  return {
    blog: g?.features?.blog ?? DEFAULTS.features.blog,
    beforeAfter: g?.features?.beforeAfter ?? DEFAULTS.features.beforeAfter,
  }
}
