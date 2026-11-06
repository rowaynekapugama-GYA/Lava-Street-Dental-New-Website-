import type { CollectionConfig } from 'payload'
import { adminOrEditor, anyone } from '../access'
import { touchSite } from '../hooks/touchSite'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Image', plural: 'Media Library' },
  admin: {
    group: 'Website',
    description:
      'Every photo used on the site. Replacing an image here updates it everywhere it is used.',
  },
  access: { read: anyone, create: adminOrEditor, update: adminOrEditor, delete: adminOrEditor },
  upload: {
    mimeTypes: ['image/*'],
    // One resized master. Uploads are converted to WebP at 2400px and served
    // with next/image unoptimized, so they never hit the optimisation cap.
    formatOptions: { format: 'webp', options: { quality: 80 } },
    resizeOptions: { width: 2400, height: undefined, withoutEnlargement: true, fit: 'inside' },
    focalPoint: true,
    imageSizes: [{ name: 'thumb', width: 480, height: undefined, formatOptions: { format: 'webp', options: { quality: 75 } } }],
  },
  hooks: {
    // a new file for an existing photo: if it is one of the website's own photos, it now replaces it everywhere
    beforeChange: [({ data, operation, req }) => {
      if (operation === 'update' && req.file) data.replaced = true
      return data
    }],
    afterChange: [touchSite],
    afterDelete: [touchSite],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      label: 'Alt text',
      admin: {
        description:
          'Describe what is in the photo, for screen readers and search. Example: the reception desk at Lava Street Dental with the waiting chairs behind.',
      },
    },
    {
      name: 'builtIn',
      type: 'text',
      label: 'Website photo it came from',
      admin: { readOnly: true, description: 'Set when this is one of the photos the website shipped with. Replacing the file replaces that photo everywhere.' },
    },
    { name: 'replaced', type: 'checkbox', defaultValue: false, admin: { hidden: true } },
    {
      name: 'credit',
      type: 'text',
      label: 'Credit or source',
      admin: { description: 'Optional. Where the photo came from.' },
    },
  ],
}
