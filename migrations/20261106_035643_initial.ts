import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_signups_form" AS ENUM('waitlist', 'enquiry');
  CREATE TYPE "public"."enum_signups_status" AS ENUM('todo', 'contacted', 'booked');
  CREATE TYPE "public"."enum_signups_email_status" AS ENUM('sent', 'failed');
  CREATE TYPE "public"."enum_redirects_type" AS ENUM('permanent', 'temporary');
  CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'editor');
  CREATE TABLE "pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"page_slug" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"path" varchar,
  	"group" varchar,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"og_image_id" integer,
  	"noindex" boolean DEFAULT false,
  	"canonical" varchar,
  	"model" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "signups" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"form" "enum_signups_form" DEFAULT 'waitlist' NOT NULL,
  	"first_name" varchar,
  	"last_name" varchar,
  	"email" varchar NOT NULL,
  	"phone" varchar,
  	"message" varchar,
  	"page" varchar,
  	"consent" boolean DEFAULT false,
  	"status" "enum_signups_status" DEFAULT 'todo' NOT NULL,
  	"notes" varchar,
  	"email_status" "enum_signups_email_status" DEFAULT 'sent',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"built_in" varchar,
  	"replaced" boolean DEFAULT false,
  	"credit" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumb_url" varchar,
  	"sizes_thumb_width" numeric,
  	"sizes_thumb_height" numeric,
  	"sizes_thumb_mime_type" varchar,
  	"sizes_thumb_filesize" numeric,
  	"sizes_thumb_filename" varchar
  );
  
  CREATE TABLE "redirects" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"from" varchar NOT NULL,
  	"to" varchar NOT NULL,
  	"type" "enum_redirects_type" DEFAULT 'permanent',
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"role" "enum_users_role" DEFAULT 'editor' NOT NULL,
  	"must_change_password" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"pages_id" integer,
  	"signups_id" integer,
  	"media_id" integer,
  	"redirects_id" integer,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "site_settings_hours" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"line" varchar NOT NULL
  );
  
  CREATE TABLE "site_settings_hours_schema" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"line" varchar NOT NULL
  );
  
  CREATE TABLE "site_settings_payment_accepted" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"line" varchar NOT NULL
  );
  
  CREATE TABLE "site_settings_form_recipients" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL
  );
  
  CREATE TABLE "site_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"phone" varchar,
  	"public_email" varchar,
  	"street_address" varchar,
  	"locality" varchar,
  	"region" varchar,
  	"postcode" varchar,
  	"postal_address" varchar,
  	"maps_url" varchar,
  	"opening_date" varchar,
  	"socials_instagram" varchar,
  	"socials_facebook" varchar,
  	"socials_google" varchar,
  	"booking_url" varchar,
  	"health_funds" varchar,
  	"site_url" varchar,
  	"pre_opening" boolean,
  	"tracking_ga4" varchar,
  	"tracking_meta_pixel" varchar,
  	"features_blog" boolean DEFAULT false,
  	"features_before_after" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "seo" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"share_image_id" integer,
  	"share_image_alt" varchar,
  	"title_format" varchar,
  	"noindex_site" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "site_status" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"last_changed_at" timestamp(3) with time zone,
  	"last_published_at" timestamp(3) with time zone,
  	"last_publish_by" varchar,
  	"imported" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "pages" ADD CONSTRAINT "pages_og_image_id_media_id_fk" FOREIGN KEY ("og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_signups_fk" FOREIGN KEY ("signups_id") REFERENCES "public"."signups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_redirects_fk" FOREIGN KEY ("redirects_id") REFERENCES "public"."redirects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_hours" ADD CONSTRAINT "site_settings_hours_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_hours_schema" ADD CONSTRAINT "site_settings_hours_schema_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_payment_accepted" ADD CONSTRAINT "site_settings_payment_accepted_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_form_recipients" ADD CONSTRAINT "site_settings_form_recipients_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "seo" ADD CONSTRAINT "seo_share_image_id_media_id_fk" FOREIGN KEY ("share_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "pages_page_slug_idx" ON "pages" USING btree ("page_slug");
  CREATE INDEX "pages_og_image_idx" ON "pages" USING btree ("og_image_id");
  CREATE INDEX "pages_updated_at_idx" ON "pages" USING btree ("updated_at");
  CREATE INDEX "pages_created_at_idx" ON "pages" USING btree ("created_at");
  CREATE INDEX "signups_form_idx" ON "signups" USING btree ("form");
  CREATE INDEX "signups_status_idx" ON "signups" USING btree ("status");
  CREATE INDEX "signups_updated_at_idx" ON "signups" USING btree ("updated_at");
  CREATE INDEX "signups_created_at_idx" ON "signups" USING btree ("created_at");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumb_sizes_thumb_filename_idx" ON "media" USING btree ("sizes_thumb_filename");
  CREATE UNIQUE INDEX "redirects_from_idx" ON "redirects" USING btree ("from");
  CREATE INDEX "redirects_updated_at_idx" ON "redirects" USING btree ("updated_at");
  CREATE INDEX "redirects_created_at_idx" ON "redirects" USING btree ("created_at");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("pages_id");
  CREATE INDEX "payload_locked_documents_rels_signups_id_idx" ON "payload_locked_documents_rels" USING btree ("signups_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_redirects_id_idx" ON "payload_locked_documents_rels" USING btree ("redirects_id");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "site_settings_hours_order_idx" ON "site_settings_hours" USING btree ("_order");
  CREATE INDEX "site_settings_hours_parent_id_idx" ON "site_settings_hours" USING btree ("_parent_id");
  CREATE INDEX "site_settings_hours_schema_order_idx" ON "site_settings_hours_schema" USING btree ("_order");
  CREATE INDEX "site_settings_hours_schema_parent_id_idx" ON "site_settings_hours_schema" USING btree ("_parent_id");
  CREATE INDEX "site_settings_payment_accepted_order_idx" ON "site_settings_payment_accepted" USING btree ("_order");
  CREATE INDEX "site_settings_payment_accepted_parent_id_idx" ON "site_settings_payment_accepted" USING btree ("_parent_id");
  CREATE INDEX "site_settings_form_recipients_order_idx" ON "site_settings_form_recipients" USING btree ("_order");
  CREATE INDEX "site_settings_form_recipients_parent_id_idx" ON "site_settings_form_recipients" USING btree ("_parent_id");
  CREATE INDEX "seo_share_image_idx" ON "seo" USING btree ("share_image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "pages" CASCADE;
  DROP TABLE "signups" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "redirects" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "site_settings_hours" CASCADE;
  DROP TABLE "site_settings_hours_schema" CASCADE;
  DROP TABLE "site_settings_payment_accepted" CASCADE;
  DROP TABLE "site_settings_form_recipients" CASCADE;
  DROP TABLE "site_settings" CASCADE;
  DROP TABLE "seo" CASCADE;
  DROP TABLE "site_status" CASCADE;
  DROP TYPE "public"."enum_signups_form";
  DROP TYPE "public"."enum_signups_status";
  DROP TYPE "public"."enum_signups_email_status";
  DROP TYPE "public"."enum_redirects_type";
  DROP TYPE "public"."enum_users_role";`)
}
