CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"ai_provider" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_settings_ai_provider_check" CHECK ("user_settings"."ai_provider" IN ('anthropic', 'openai'))
);
--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_api_credentials" ADD CONSTRAINT "user_api_credentials_provider_check" CHECK ("user_api_credentials"."provider" IN ('anthropic', 'openai'));--> statement-breakpoint
ALTER TABLE "user_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
		REVOKE ALL ON TABLE "user_settings" FROM anon;
	END IF;
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
		REVOKE ALL ON TABLE "user_settings" FROM authenticated;
	END IF;
END $$;