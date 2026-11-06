import { payloadClient, requireUser } from '@/dashboard/lib/server'
import { Shell } from '@/dashboard/ui/Shell'
import { features } from '@/dashboard/lib/features'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser()
  const payload = await payloadClient()
  const toDo = (await payload.count({ collection: 'signups', where: { status: { equals: 'todo' } }, overrideAccess: true }).catch(() => ({ totalDocs: 0 }))).totalDocs
  return <Shell user={{ name: u.name, email: u.email, role: u.role }} toDo={toDo} features={await features(payload)}>{children}</Shell>
}
