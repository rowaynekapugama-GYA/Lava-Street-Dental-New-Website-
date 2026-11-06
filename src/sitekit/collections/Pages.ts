import type { CollectionConfig } from 'payload'
import { adminOnly, adminFieldOnly, adminOrEditor } from '../access'
import { touchSite } from '../hooks/touchSite'

/**
 * One document per page of the website (and `_chrome-footer` for the footer words shared by every page).
 *
 * `model` holds the page's content model as JSON text (src/lib/parts.ts): the approved markup of each
 * section with {{fN}} placeholders, and the values. Only GYA can write it through Payload's own API; the
 * practice saves through the page editor (src/app/api/dashboard/pages), which changes words, links,
 * photos, order and hidden sections and nothing else, so nothing typed in the dashboard can change the
 * approved design. SEO values are kept as their own columns for the SEO overview.
 */
export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: { singular: 'Page', plural: 'Pages' },
  admin: {
    group: 'Website',
    useAsTitle: 'title',
    defaultColumns: ['title', 'path', 'updatedAt'],
    description: 'Every page of the website. The practice edits these at /admin/pages.',
  },
  access: { read: adminOrEditor, create: adminOnly, update: adminOrEditor, delete: adminOnly },
  hooks: { afterChange: [touchSite], afterDelete: [touchSite] },
  fields: [
    { name: 'pageSlug', type: 'text', required: true, unique: true, index: true, access: { update: adminFieldOnly } },
    { name: 'title', type: 'text', required: true, label: 'Page name', access: { update: adminFieldOnly } },
    { name: 'path', type: 'text', label: 'Web address', access: { update: adminFieldOnly } },
    { name: 'group', type: 'text', access: { update: adminFieldOnly } },
    { name: 'metaTitle', type: 'text', label: 'SEO title' },
    { name: 'metaDescription', type: 'textarea', label: 'SEO description' },
    { name: 'ogImage', type: 'upload', relationTo: 'media', label: 'Share image' },
    { name: 'noindex', type: 'checkbox', label: 'Hide from Google', defaultValue: false },
    { name: 'canonical', type: 'text', label: 'Canonical address', access: { update: adminFieldOnly } },
    { name: 'model', type: 'code', admin: { language: 'json' }, access: { update: adminFieldOnly } },
  ],
}
