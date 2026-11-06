import type { GlobalConfig } from 'payload'
import { adminOnly, adminOrEditor } from '../access'
import { touchSiteGlobal } from '../hooks/touchSite'

/** Site-wide SEO settings. GYA only. */
export const Seo: GlobalConfig = {
  slug: 'seo',
  label: 'SEO defaults',
  access: { read: adminOrEditor, update: adminOnly },
  hooks: { afterChange: [touchSiteGlobal] },
  fields: [
    { name: 'shareImage', type: 'upload', relationTo: 'media', label: 'Default share image' },
    { name: 'shareImageAlt', type: 'text', label: 'Default share image description' },
    { name: 'titleFormat', type: 'text', label: 'Title format', admin: { description: 'Shown as a hint when a page title is written. Example: Page name | Lava Street Dental' } },
    { name: 'noindexSite', type: 'checkbox', label: 'Hide the whole website from search engines', defaultValue: false },
  ],
}
