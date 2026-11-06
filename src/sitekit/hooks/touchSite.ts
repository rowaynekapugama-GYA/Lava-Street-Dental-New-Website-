import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, GlobalAfterChangeHook } from 'payload'

/**
 * Records that something changed, so the Dashboard can show the
 * "changes waiting to publish" notice.
 */
async function touch(req: { payload: { updateGlobal: Function } }) {
  try {
    await req.payload.updateGlobal({
      slug: 'site-status',
      data: { lastChangedAt: new Date().toISOString() },
      depth: 0,
    })
  } catch {
    // never let bookkeeping stop a save
  }
}

// imports and the build's own bookkeeping pass context.skipTouch, so they never show "changes waiting"
export const touchSite: CollectionAfterChangeHook & CollectionAfterDeleteHook = async ({ req, context }) => {
  if ((context as { skipTouch?: boolean } | undefined)?.skipTouch) return
  await touch(req as never)
}

export const touchSiteGlobal: GlobalAfterChangeHook = async ({ req, doc, context }) => {
  if ((context as { skipTouch?: boolean } | undefined)?.skipTouch) return doc
  await touch(req as never)
  return doc
}
