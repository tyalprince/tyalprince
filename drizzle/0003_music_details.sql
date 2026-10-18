ALTER TABLE "music_tracks" ADD COLUMN "release_date" text;--> statement-breakpoint
ALTER TABLE "music_tracks" ADD COLUMN "composer" text;--> statement-breakpoint
ALTER TABLE "music_tracks" ADD COLUMN "lyricist" text;--> statement-breakpoint
ALTER TABLE "music_tracks" ADD COLUMN "producer" text;--> statement-breakpoint
ALTER TABLE "music_tracks" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "music_tracks" ADD COLUMN "copyright" text;--> statement-breakpoint
ALTER TABLE "music_tracks" ADD COLUMN "lyrics" text;--> statement-breakpoint
ALTER TABLE "music_tracks" ADD COLUMN "synced_lyrics" text;--> statement-breakpoint
ALTER TABLE "music_tracks" ADD COLUMN "lyrics_source" text;--> statement-breakpoint
ALTER TABLE "music_tracks" ADD COLUMN "lyrics_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "music_tracks" ADD COLUMN "enriched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "music_tracks" ADD COLUMN "external" jsonb;