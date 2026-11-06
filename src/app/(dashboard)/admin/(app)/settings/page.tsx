import { payloadClient, requireUser } from '@/dashboard/lib/server'
import { SettingsForm, type BrandInfo } from '@/dashboard/editors/SettingsForm'
import { settingsFromDashboard } from '@/dashboard/pages'
import { BRAND } from '@/dashboard/brand'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Site Settings' }

const COLOURS: BrandInfo['colours'] = [
  ['Mine shaft', '#292826', 'Text, footer, dark sections'],
  ['Fuscous grey (olive)', '#575A4D', 'Buttons, links'],
  ['Santa Fe (clay)', '#B4684B', 'Accent only'],
  ['Lemon grass (sage)', '#959C8A', 'Shapes, secondary panels'],
  ['Malta', '#BDB4A3', 'Borders and dividers'],
  ['Pearl bush', '#EAE2D6', 'Cards, light sections'],
  ['Background', '#F4F1EA', 'Page background'],
]

export default async function SettingsPage() {
  const u = await requireUser()
  const isAdmin = u.role === 'admin'
  const payload = await payloadClient()
  const m = await settingsFromDashboard(payload)
  return (
    <>
      <div className="pd-head"><div className="grow"><h1>Site Settings</h1><p className="pd-sub">Practice details and the options that apply to the whole website.</p></div></div>
      <SettingsForm isAdmin={isAdmin} brand={{ logo: BRAND.logo, logoOnDark: BRAND.logoOnDark, colours: COLOURS }} initial={{
        name: m.name, phone: m.phone, publicEmail: m.emails.public, streetAddress: m.address.streetAddress, locality: m.address.locality,
        region: m.address.region, postcode: m.address.postcode, postalAddress: m.postalAddress, mapsUrl: m.mapsUrl, hours: [...m.hours],
        openingDate: m.openingDate, socials: { instagram: m.socials.instagram, facebook: m.socials.facebook, google: m.socials.google },
        bookingUrl: m.bookingUrl, healthFunds: m.healthFunds,
        siteUrl: isAdmin ? m.siteUrl : '', preOpening: m.preOpening, hoursSchema: isAdmin ? [...m.hoursSchema] : [],
        paymentAccepted: isAdmin ? [...m.paymentAccepted] : [], formRecipients: isAdmin ? [...m.formRecipients] : [],
        tracking: isAdmin ? { ...m.tracking } : { ga4: '', metaPixel: '' }, features: { ...m.features },
      }} />
    </>
  )
}
