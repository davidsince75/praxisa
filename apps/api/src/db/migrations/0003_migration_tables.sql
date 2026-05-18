CREATE TYPE "public"."migration_batch_status" AS ENUM('draft', 'validating', 'validated', 'loading', 'loaded', 'failed');
--> statement-breakpoint
CREATE TYPE "public"."migration_row_status" AS ENUM('pending', 'accepted', 'rejected', 'loaded');
--> statement-breakpoint
CREATE TYPE "public"."migration_issue_severity" AS ENUM('error', 'warning');
--> statement-breakpoint
CREATE TABLE "migration_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_file" text NOT NULL,
	"sha256" text,
	"row_count" integer DEFAULT 0 NOT NULL,
	"status" "migration_batch_status" DEFAULT 'draft' NOT NULL,
	"errors_count" integer DEFAULT 0 NOT NULL,
	"warnings_count" integer DEFAULT 0 NOT NULL,
	"imported_by" uuid NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "migration_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"row_ref" text NOT NULL,
	"raw_data" jsonb NOT NULL,
	"normalized_data" jsonb,
	"status" "migration_row_status" DEFAULT 'pending' NOT NULL,
	"target_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "migration_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"row_id" uuid,
	"severity" "migration_issue_severity" NOT NULL,
	"rule_id" text NOT NULL,
	"field" text,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "migration_batches" ADD CONSTRAINT "migration_batches_imported_by_users_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "migration_rows" ADD CONSTRAINT "migration_rows_batch_id_migration_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."migration_batches"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "migration_rows" ADD CONSTRAINT "migration_rows_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "migration_issues" ADD CONSTRAINT "migration_issues_batch_id_migration_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."migration_batches"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "migration_issues" ADD CONSTRAINT "migration_issues_row_id_migration_rows_id_fk" FOREIGN KEY ("row_id") REFERENCES "public"."migration_rows"("id") ON DELETE no action ON UPDATE no action;
