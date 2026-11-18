import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_tour_sessions_startsat_tz" AS ENUM('Asia/Seoul');
  CREATE TYPE "public"."enum_tour_sessions_endsat_tz" AS ENUM('Asia/Seoul');
  CREATE TYPE "public"."enum_tour_sessions_status" AS ENUM('open', 'closed');
  CREATE TYPE "public"."enum_applications_status" AS ENUM('pending', 'confirmed', 'cancelled');
  CREATE TYPE "public"."enum_admin_audit_logs_action" AS ENUM('application.status_change', 'application.requests_delete', 'session.participants_csv');
  CREATE TYPE "public"."enum_admin_audit_logs_from_status" AS ENUM('pending', 'confirmed', 'cancelled');
  CREATE TYPE "public"."enum_admin_audit_logs_to_status" AS ENUM('pending', 'confirmed', 'cancelled');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
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
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"prefix" varchar DEFAULT '',
  	"_objectkey" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric
  );
  
  CREATE TABLE "tours" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"summary" varchar NOT NULL,
  	"description" varchar NOT NULL,
  	"hero_image_id" integer,
  	"duration_minutes" numeric NOT NULL,
  	"meeting_point" varchar NOT NULL,
  	"price_note" varchar NOT NULL,
  	"published" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "tour_sessions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tour_id" integer NOT NULL,
  	"starts_at" timestamp(3) with time zone NOT NULL,
  	"startsat_tz" "enum_tour_sessions_startsat_tz" DEFAULT 'Asia/Seoul' NOT NULL,
  	"ends_at" timestamp(3) with time zone NOT NULL,
  	"endsat_tz" "enum_tour_sessions_endsat_tz" DEFAULT 'Asia/Seoul' NOT NULL,
  	"capacity" numeric NOT NULL,
  	"status" "enum_tour_sessions_status" DEFAULT 'open' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "applications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"session_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"phone" varchar NOT NULL,
  	"party_size" numeric NOT NULL,
  	"requests" varchar,
  	"requests_deleted_at" timestamp(3) with time zone,
  	"status" "enum_applications_status" DEFAULT 'pending' NOT NULL,
  	"reference_code" varchar NOT NULL,
  	"privacy_consent_at" timestamp(3) with time zone NOT NULL,
  	"privacy_policy_version" varchar NOT NULL,
  	"requests_consent_at" timestamp(3) with time zone,
  	"age_confirmed_at" timestamp(3) with time zone,
  	"cancelled_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "application_attempts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key_hash" varchar NOT NULL,
  	"attempted_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "admin_audit_logs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"action" "enum_admin_audit_logs_action" NOT NULL,
  	"actor_id" numeric,
  	"occurred_at" timestamp(3) with time zone NOT NULL,
  	"application_id" numeric,
  	"reference_code" varchar,
  	"session_id" numeric,
  	"from_status" "enum_admin_audit_logs_from_status",
  	"to_status" "enum_admin_audit_logs_to_status",
  	"row_count" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
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
  	"users_id" integer,
  	"media_id" integer,
  	"tours_id" integer,
  	"tour_sessions_id" integer,
  	"applications_id" integer,
  	"application_attempts_id" integer,
  	"admin_audit_logs_id" integer
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
  
  CREATE TABLE "home_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hero_image_id" integer,
  	"headline" varchar,
  	"intro" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tours" ADD CONSTRAINT "tours_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tour_sessions" ADD CONSTRAINT "tour_sessions_tour_id_tours_id_fk" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "applications" ADD CONSTRAINT "applications_session_id_tour_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."tour_sessions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tours_fk" FOREIGN KEY ("tours_id") REFERENCES "public"."tours"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tour_sessions_fk" FOREIGN KEY ("tour_sessions_id") REFERENCES "public"."tour_sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_applications_fk" FOREIGN KEY ("applications_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_application_attempts_fk" FOREIGN KEY ("application_attempts_id") REFERENCES "public"."application_attempts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_admin_audit_logs_fk" FOREIGN KEY ("admin_audit_logs_id") REFERENCES "public"."admin_audit_logs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_settings" ADD CONSTRAINT "home_settings_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE UNIQUE INDEX "tours_slug_idx" ON "tours" USING btree ("slug");
  CREATE INDEX "tours_hero_image_idx" ON "tours" USING btree ("hero_image_id");
  CREATE INDEX "tours_updated_at_idx" ON "tours" USING btree ("updated_at");
  CREATE INDEX "tours_created_at_idx" ON "tours" USING btree ("created_at");
  CREATE INDEX "tour_sessions_tour_idx" ON "tour_sessions" USING btree ("tour_id");
  CREATE INDEX "tour_sessions_updated_at_idx" ON "tour_sessions" USING btree ("updated_at");
  CREATE INDEX "tour_sessions_created_at_idx" ON "tour_sessions" USING btree ("created_at");
  CREATE INDEX "applications_session_idx" ON "applications" USING btree ("session_id");
  CREATE INDEX "applications_status_idx" ON "applications" USING btree ("status");
  CREATE UNIQUE INDEX "applications_reference_code_idx" ON "applications" USING btree ("reference_code");
  CREATE INDEX "applications_updated_at_idx" ON "applications" USING btree ("updated_at");
  CREATE INDEX "applications_created_at_idx" ON "applications" USING btree ("created_at");
  CREATE INDEX "application_attempts_key_hash_idx" ON "application_attempts" USING btree ("key_hash");
  CREATE INDEX "application_attempts_attempted_at_idx" ON "application_attempts" USING btree ("attempted_at");
  CREATE INDEX "application_attempts_updated_at_idx" ON "application_attempts" USING btree ("updated_at");
  CREATE INDEX "application_attempts_created_at_idx" ON "application_attempts" USING btree ("created_at");
  CREATE INDEX "admin_audit_logs_occurred_at_idx" ON "admin_audit_logs" USING btree ("occurred_at");
  CREATE INDEX "admin_audit_logs_session_id_idx" ON "admin_audit_logs" USING btree ("session_id");
  CREATE INDEX "admin_audit_logs_updated_at_idx" ON "admin_audit_logs" USING btree ("updated_at");
  CREATE INDEX "admin_audit_logs_created_at_idx" ON "admin_audit_logs" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_tours_id_idx" ON "payload_locked_documents_rels" USING btree ("tours_id");
  CREATE INDEX "payload_locked_documents_rels_tour_sessions_id_idx" ON "payload_locked_documents_rels" USING btree ("tour_sessions_id");
  CREATE INDEX "payload_locked_documents_rels_applications_id_idx" ON "payload_locked_documents_rels" USING btree ("applications_id");
  CREATE INDEX "payload_locked_documents_rels_application_attempts_id_idx" ON "payload_locked_documents_rels" USING btree ("application_attempts_id");
  CREATE INDEX "payload_locked_documents_rels_admin_audit_logs_id_idx" ON "payload_locked_documents_rels" USING btree ("admin_audit_logs_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "home_settings_hero_image_idx" ON "home_settings" USING btree ("hero_image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "tours" CASCADE;
  DROP TABLE "tour_sessions" CASCADE;
  DROP TABLE "applications" CASCADE;
  DROP TABLE "application_attempts" CASCADE;
  DROP TABLE "admin_audit_logs" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "home_settings" CASCADE;
  DROP TYPE "public"."enum_tour_sessions_startsat_tz";
  DROP TYPE "public"."enum_tour_sessions_endsat_tz";
  DROP TYPE "public"."enum_tour_sessions_status";
  DROP TYPE "public"."enum_applications_status";
  DROP TYPE "public"."enum_admin_audit_logs_action";
  DROP TYPE "public"."enum_admin_audit_logs_from_status";
  DROP TYPE "public"."enum_admin_audit_logs_to_status";`)
}
