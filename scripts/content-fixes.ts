/**
 * Build step: one-off fixes to what the dashboard holds, run before the content is pulled (scripts/build.mjs).
 * Each fix only fills something that is blank, so nothing the practice or GYA typed is ever overwritten,
 * and each prints one line in the build log.
 *
 *   npx tsx scripts/content-fixes.ts
 */
import './load-env'

import { getPayload } from 'payload'
import config from '@payload-config'
import { DEFAULTS } from '../src/lib/site'

type Tracking = { ga4?: string | null; metaPixel?: string | null; gtmId?: string | null }

/**
 * v1.3.4: Google Tag Manager for the Google Ads campaign. The live Site Settings come from the database,
 * where the new field starts blank, so the container from site.config.mjs is filled in once. A different
 * ID typed in the dashboard is left alone. To remove GTM later, blank it in site.config.mjs as well as in
 * the dashboard, or the next build fills it in again.
 */
async function applyGtmContainer(payload: Awaited<ReturnType<typeof getPayload>>) {
  const container = String(DEFAULTS.tracking?.gtmId || '').trim()
  if (!container) {
    console.log('[content-fixes] Google Tag Manager: no container in site.config.mjs, nothing to fill in')
    return
  }
  const g = (await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true })) as { tracking?: Tracking }
  const current = String(g?.tracking?.gtmId || '').trim()
  if (current === container) {
    console.log(`[content-fixes] Google Tag Manager container ${container} already in Site Settings`)
    return
  }
  if (current) {
    console.log(`[content-fixes] Google Tag Manager: Site Settings has ${current}, left as it is`)
    return
  }
  await payload.updateGlobal({
    slug: 'site-settings',
    data: { tracking: { ga4: g?.tracking?.ga4 ?? '', metaPixel: g?.tracking?.metaPixel ?? '', gtmId: container } },
    depth: 0,
    overrideAccess: true,
    context: { skipTouch: true },
  })
  console.log(`[content-fixes] Google Tag Manager container ${container} added to Site Settings`)
}

async function main() {
  const payload = await getPayload({ config })
  const status = (await payload.findGlobal({ slug: 'site-status', depth: 0, overrideAccess: true })) as { imported?: boolean }
  if (status?.imported !== true) {
    console.log('[content-fixes] the website is not in the dashboard yet, nothing to fix (the repository files are used)')
    process.exit(0)
  }
  await applyGtmContainer(payload)
  process.exit(0)
}

main().catch((e) => {
  console.error('[content-fixes] failed:', (e as Error).message)
  process.exit(1)
})
