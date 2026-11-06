import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import sharp from 'sharp'

import { Users } from './sitekit/collections/Users'
import { Media } from './sitekit/collections/Media'
import { Pages } from './sitekit/collections/Pages'
import { Signups } from './sitekit/collections/Signups'
import { Redirects } from './sitekit/collections/Redirects'
import { SiteSettings } from './sitekit/globals/SiteSettings'
import { Seo } from './sitekit/globals/Seo'
import { SiteStatus } from './sitekit/globals/SiteStatus'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const origins = [
  process.env.NEXT_PUBLIC_SERVER_URL,
  process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
  process.env.VERCEL_BRANCH_URL && `https://${process.env.VERCEL_BRANCH_URL}`,
  process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
  'https://lavastreetdental.com.au',
  'https://www.lavastreetdental.com.au',
  'http://localhost:3000',
  'http://localhost:3100',
].filter(Boolean) as string[]

// Previews send their own API calls to their own address (cms-retrofit-static-sites.md, trap 5).
const serverURL = process.env.VERCEL_ENV === 'preview' ? '' : process.env.NEXT_PUBLIC_SERVER_URL || ''

export default buildConfig({
  serverURL,
  // The practice uses the GYA dashboard at /admin (src/app/(dashboard)). Payload's
  // own screens move to /cms and only GYA administrators can open them.
  routes: { admin: '/cms', api: '/api' },
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname, '..') },
    avatar: 'default',
    meta: {
      titleSuffix: ' - Lava Street Dental (GYA)',
      description: 'Advanced settings for the Lava Street Dental website. GYA only.',
    },
    components: {
      graphics: {
        Logo: '@/sitekit/admin/Logo#Logo',
        Icon: '@/sitekit/admin/Logo#Icon',
      },
    },
  },
  collections: [Pages, Signups, Media, Redirects, Users],
  globals: [SiteSettings, Seo, SiteStatus],
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL || '' },
    push: false,
    migrationDir: path.resolve(dirname, '../migrations'),
  }),
  plugins: [
    vercelBlobStorage({
      enabled: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      // the plugin's columns (prefix, _objectKey) are in the database schema with or without a token, so the
      // migrations match every environment (v1.3.1: the preview has a token, the first migration was made without)
      alwaysInsertFields: true,
      collections: { media: true },
      token: process.env.BLOB_READ_WRITE_TOKEN || '',
    }),
  ],
  cors: origins,
  csrf: origins,
  // Without PAYLOAD_SECRET a random secret is used, so sign-ins fail rather than become forgeable.
  secret: process.env.PAYLOAD_SECRET || `unset-${Math.random().toString(36).slice(2)}${Date.now()}`,
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  sharp,
  telemetry: false,
})
