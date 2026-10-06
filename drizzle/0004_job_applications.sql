CREATE TABLE "job_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"company_name" text NOT NULL,
	"position" text NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"job_description" text DEFAULT '' NOT NULL,
	"salary_min" integer,
	"salary_max" integer,
	"salary_currency" char(3) DEFAULT 'USD' NOT NULL,
	"salary_period" text DEFAULT 'year' NOT NULL,
	"status" text DEFAULT 'saved' NOT NULL,
	"sort_order" double precision NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"external_id" text,
	"source_url" text,
	"notes" text DEFAULT '' NOT NULL,
	"applied_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_applications_salary_check" CHECK (("job_applications"."salary_min" IS NULL OR "job_applications"."salary_min" >= 0) AND ("job_applications"."salary_max" IS NULL OR "job_applications"."salary_max" >= 0) AND ("job_applications"."salary_min" IS NULL OR "job_applications"."salary_max" IS NULL OR "job_applications"."salary_min" <= "job_applications"."salary_max")),
	CONSTRAINT "job_applications_currency_check" CHECK ("job_applications"."salary_currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "job_applications_salary_period_check" CHECK ("job_applications"."salary_period" IN ('year', 'month', 'hour')),
	CONSTRAINT "job_applications_status_check" CHECK ("job_applications"."status" IN ('saved', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn')),
	CONSTRAINT "job_applications_source_check" CHECK ("job_applications"."source" IN ('manual', 'linkedin'))
);
--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_applications_board_idx" ON "job_applications" USING btree ("user_id","status","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "job_applications_external_idx" ON "job_applications" USING btree ("user_id","source","external_id") WHERE "job_applications"."external_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "job_applications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
		REVOKE ALL ON TABLE "job_applications" FROM anon;
	END IF;
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
		REVOKE ALL ON TABLE "job_applications" FROM authenticated;
	END IF;
END $$;
