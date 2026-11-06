/**
 * Everything client specific about the dashboard lives here and in the tokens at the top of
 * dashboard.css, so the rest of src/dashboard is the GYA standard dashboard unchanged from site to site.
 */
export const BRAND = {
  name: 'Lava Street Dental',
  domain: 'lavastreetdental.com.au',
  /** the site's own light wordmark (footer), for the dark sidebar and the sign in card's dark page */
  logoOnDark: '/assets/images/logo-light.svg',
  /** the dark wordmark, for light backgrounds */
  logo: '/assets/images/logo.svg',
  favicon: '/assets/icons/favicon.svg',
  /** for "Good morning" and the dates on the Waitlist */
  timeZone: 'Australia/Melbourne',
  /** shown in the Google preview while a description is being typed */
  phone: '03 5208 9006',
  /** the default share picture when a page sets none (site.config.mjs shareImage) */
  defaultOg: '/assets/images/og/lava-street-dental-reception-waiting-area.jpg',
} as const
