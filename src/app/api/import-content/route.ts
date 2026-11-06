import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { importContent } from '@/sitekit/importContent'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The Import button (GYA). Loads the website's pages, footer, practice details and redirects into the
 * dashboard. Safe to run more than once: it skips anything already there unless ?overwrite=1 is passed,
 * which puts every page back to how the repository has it. Same code as `npm run seed`.
 */
export async function POST(req: NextRequest) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })
  if ((user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Only GYA can import the website.' }, { status: 403 })
  }
  const overwrite = req.nextUrl.searchParams.get('overwrite') === '1'
  const r = await importContent(payload, { overwrite })
  return NextResponse.json({
    message: `Import finished. ${r.pages} pages added${r.updated ? `, ${r.updated} put back to the website files` : ''}, ${r.redirects} redirects.`,
  })
}
