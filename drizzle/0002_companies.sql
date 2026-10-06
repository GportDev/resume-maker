CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"website" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "companies_owner_name_idx" ON "companies" USING btree ("user_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "companies_id_owner_idx" ON "companies" USING btree ("id","user_id");--> statement-breakpoint
ALTER TABLE "experiences" ADD COLUMN "company_id" uuid;--> statement-breakpoint
INSERT INTO "companies" ("user_id", "name")
SELECT DISTINCT ON ("user_id", lower(btrim("company"))) "user_id", btrim("company")
FROM "experiences"
ORDER BY "user_id", lower(btrim("company")), "start_date" DESC, "created_at" DESC;--> statement-breakpoint
UPDATE "experiences" AS "e"
SET "company_id" = "c"."id"
FROM "companies" AS "c"
WHERE "c"."user_id" = "e"."user_id"
	AND lower("c"."name") = lower(btrim("e"."company"));--> statement-breakpoint
ALTER TABLE "experiences" ALTER COLUMN "company_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_company_owner_fk" FOREIGN KEY ("company_id","user_id") REFERENCES "public"."companies"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "experiences_company_id_idx" ON "experiences" USING btree ("company_id");--> statement-breakpoint
ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
		REVOKE ALL ON TABLE "companies" FROM anon;
	END IF;
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
		REVOKE ALL ON TABLE "companies" FROM authenticated;
	END IF;
END $$;
