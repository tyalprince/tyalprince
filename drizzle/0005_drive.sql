CREATE TABLE "drive_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"parent_id" uuid,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"object_key" text,
	"size" bigint DEFAULT 0 NOT NULL,
	"content_type" text,
	"thumbnail_key" text,
	"upload_id" text,
	"uploaded_at" timestamp with time zone,
	"starred" boolean DEFAULT false NOT NULL,
	"trashed_at" timestamp with time zone,
	"share_token" text,
	"share_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drive_items" ADD CONSTRAINT "drive_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_items" ADD CONSTRAINT "drive_items_parent_id_drive_items_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."drive_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "drive_items_user_parent_idx" ON "drive_items" USING btree ("user_id","parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "drive_items_share_token_idx" ON "drive_items" USING btree ("share_token");