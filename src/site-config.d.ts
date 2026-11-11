declare module '*/site.config.mjs' {
  const config: {
    name: string
    siteUrl: string
    phone: string
    emails: { public: string; meg: string }
    address: { streetAddress: string; streetFallback: string; locality: string; region: string; postcode: string; country: string }
    hours: string[]
    hoursSchema: string[]
    openingDate: string
    preOpening: boolean
    paymentAccepted: string[]
    socials: { facebook: string; instagram: string; google: string }
    shareImage: { path: string; width: number; height: number; alt: string }
    logo: string
    areaServed: string[]
    postalAddress: string
    mapsUrl: string
    bookingUrl: string
    healthFunds: string
    tracking: { ga4: string; metaPixel: string; gtmId: string }
    formRecipients: string[]
    features: { blog: boolean; beforeAfter: boolean }
  }
  export default config
}
