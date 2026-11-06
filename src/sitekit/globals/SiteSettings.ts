import type { GlobalConfig } from 'payload'
import { adminFieldOnly, adminOrEditor } from '../access'
import { touchSiteGlobal } from '../hooks/touchSite'

const gya = { read: adminFieldOnly, update: adminFieldOnly }
const gyaUpdate = { update: adminFieldOnly }

/**
 * Practice details and site switches. Mirrors site.config.mjs (the approved defaults): the build merges
 * these on top (content/site-settings.json), and every page, the footer, the structured data and the
 * sitemap follow. Fields marked GYA are hidden from the practice.
 */
export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Site Settings',
  access: { read: adminOrEditor, update: adminOrEditor },
  hooks: { afterChange: [touchSiteGlobal] },
  fields: [
    { name: 'name', type: 'text', label: 'Practice name' },
    { name: 'phone', type: 'text', label: 'Phone' },
    { name: 'publicEmail', type: 'email', label: 'Email' },
    { name: 'streetAddress', type: 'text', label: 'Street address' },
    { name: 'locality', type: 'text', label: 'Suburb or town' },
    { name: 'region', type: 'text', label: 'State', access: gyaUpdate },
    { name: 'postcode', type: 'text', label: 'Postcode' },
    { name: 'postalAddress', type: 'text', label: 'Postal address' },
    { name: 'mapsUrl', type: 'text', label: 'Google Maps link' },
    { name: 'hours', type: 'array', label: 'Opening hours', fields: [{ name: 'line', type: 'text', required: true }] },
    { name: 'hoursSchema', type: 'array', label: 'Opening hours for Google', access: gya, fields: [{ name: 'line', type: 'text', required: true }] },
    { name: 'openingDate', type: 'text', label: 'Opening date' },
    {
      name: 'socials', type: 'group', label: 'Social links',
      fields: [
        { name: 'instagram', type: 'text' },
        { name: 'facebook', type: 'text' },
        { name: 'google', type: 'text', label: 'Google Business Profile' },
      ],
    },
    { name: 'bookingUrl', type: 'text', label: 'Booking link' },
    { name: 'healthFunds', type: 'textarea', label: 'Health funds and HICAPS' },
    // GYA only
    { name: 'siteUrl', type: 'text', label: 'Website address', access: gya },
    { name: 'preOpening', type: 'checkbox', label: 'Opening soon mode', access: gya },
    { name: 'paymentAccepted', type: 'array', access: gya, fields: [{ name: 'line', type: 'text', required: true }] },
    { name: 'formRecipients', type: 'array', label: 'Form emails go to', access: gya, fields: [{ name: 'email', type: 'email', required: true }] },
    {
      name: 'tracking', type: 'group', access: gya,
      fields: [{ name: 'ga4', type: 'text', label: 'GA4 measurement ID' }, { name: 'metaPixel', type: 'text', label: 'Meta Pixel ID' }],
    },
    {
      name: 'features', type: 'group', access: gya,
      fields: [
        { name: 'blog', type: 'checkbox', label: 'Blog', defaultValue: false },
        { name: 'beforeAfter', type: 'checkbox', label: 'Before and after gallery', defaultValue: false },
      ],
    },
  ],
}
