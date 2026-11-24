// v1.4.0: Site Settings > Online booking buttons, and Email address is working. Both start empty (no default), so
// site.config.mjs decides until GYA saves a choice in the dashboard. IF NOT EXISTS so a rerun is harmless.
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "online_booking" boolean;
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "email_active" boolean;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "online_booking";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "email_active";`)
}
