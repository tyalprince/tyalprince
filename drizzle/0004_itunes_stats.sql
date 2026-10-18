ALTER TABLE "music_tracks" ADD COLUMN "rating" integer;--> statement-breakpoint
ALTER TABLE "music_tracks" ADD COLUMN "skip_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "music_tracks" ADD COLUMN "added_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "music_tracks" ADD COLUMN "imported_play_count" integer DEFAULT 0 NOT NULL;