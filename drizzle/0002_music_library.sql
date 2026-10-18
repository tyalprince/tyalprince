CREATE TABLE "music_playlist_tracks" (
	"playlist_id" uuid NOT NULL,
	"track_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "music_playlist_tracks_playlist_id_position_pk" PRIMARY KEY("playlist_id","position")
);
--> statement-breakpoint
CREATE TABLE "music_playlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"kind" text DEFAULT 'manual' NOT NULL,
	"recipe" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "music_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"content_hash" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"title" text NOT NULL,
	"artist" text,
	"album_artist" text,
	"album" text,
	"genre" text,
	"year" integer,
	"track_number" integer,
	"disc_number" integer,
	"duration_seconds" numeric(10, 2),
	"bitrate" integer,
	"artwork_key" text,
	"features" jsonb,
	"feature_vector" jsonb,
	"liked" boolean DEFAULT false NOT NULL,
	"play_count" integer DEFAULT 0 NOT NULL,
	"last_played_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "music_playlist_tracks" ADD CONSTRAINT "music_playlist_tracks_playlist_id_music_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."music_playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_playlist_tracks" ADD CONSTRAINT "music_playlist_tracks_track_id_music_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."music_tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_playlists" ADD CONSTRAINT "music_playlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_tracks" ADD CONSTRAINT "music_tracks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "music_playlist_tracks_track_id_idx" ON "music_playlist_tracks" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "music_playlists_user_id_idx" ON "music_playlists" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "music_tracks_user_id_idx" ON "music_tracks" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "music_tracks_user_hash_idx" ON "music_tracks" USING btree ("user_id","content_hash");