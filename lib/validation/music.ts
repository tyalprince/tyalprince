import { z } from "zod";

const hash = z.string().regex(/^[a-f0-9]{64}$/, "Expected a SHA-256 hex digest");

export const uploadRequestSchema = z.object({
  files: z
    .array(
      z.object({
        contentHash: hash,
        fileName: z.string().min(1).max(500),
        size: z.number().int().positive().max(2_000_000_000),
        mimeType: z.string().max(100),
      }),
    )
    .min(1)
    .max(50),
});

export const artworkRequestSchema = z.object({
  hash,
  ext: z.enum(["jpg", "png", "webp"]),
});

const features = z.object({
  tempo: z.number().min(0).max(400),
  pulse: z.number().min(0).max(1),
  key: z.number().int().min(0).max(11),
  mode: z.number().int().min(0).max(1),
  keyConfidence: z.number().min(0).max(1),
  loudness: z.number().min(-200).max(10),
  energy: z.number().min(0).max(1),
  dynamics: z.number().min(0).max(1),
  brightness: z.number().min(0).max(30000),
  flatness: z.number().min(0).max(1),
  zcr: z.number().min(0).max(1),
});

const optText = (max: number) => z.string().trim().max(max).nullable().optional();
const optInt = (min: number, max: number) => z.number().int().min(min).max(max).nullable().optional();

export const createTrackSchema = z.object({
  contentHash: hash,
  fileName: z.string().min(1).max(500),
  fileSize: z.number().int().positive().max(2_000_000_000),
  mimeType: z.string().max(100),
  title: z.string().trim().min(1).max(500),
  artist: optText(500),
  albumArtist: optText(500),
  album: optText(500),
  genre: optText(200),
  year: optInt(1000, 3000),
  trackNumber: optInt(0, 10000),
  discNumber: optInt(0, 1000),
  durationSeconds: z.number().min(0).max(24 * 3600).nullable().optional(),
  bitrate: optInt(0, 100_000_000),
  artworkKey: z.string().max(300).nullable().optional(),
  features: features.nullable().optional(),
  featureVector: z.array(z.number().min(0).max(1)).max(32).nullable().optional(),
  releaseDate: z.string().regex(/^\d{4}(-\d{2}-\d{2})?$/).nullable().optional(),
  composer: optText(500),
  lyricist: optText(500),
  producer: optText(500),
  label: optText(500),
  copyright: optText(500),
  lyrics: z.string().max(20000).nullable().optional(),
});

export const updateTrackSchema = z.object({
  liked: z.boolean().optional(),
  title: z.string().trim().min(1).max(500).optional(),
  artist: optText(500),
  album: optText(500),
  genre: optText(200),
  year: optInt(1000, 3000),
  rating: z.number().int().min(0).max(100).multipleOf(20).nullable().optional(),
});

export const playlistSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  kind: z.enum(["manual", "generated"]).default("manual"),
  recipe: z.record(z.string(), z.unknown()).nullable().optional(),
  trackIds: z.array(z.uuid()).max(5000).default([]),
});

export const updatePlaylistSchema = playlistSchema.partial().omit({ kind: true });

/** Ratings, plays etc. carried over from an iTunes library export, matched to tracks by the client. */
export const itunesStatsSchema = z.object({
  stats: z
    .array(
      z.object({
        id: z.uuid(),
        rating: z.number().int().min(0).max(100).nullable(),
        playCount: z.number().int().min(0).max(1_000_000),
        skipCount: z.number().int().min(0).max(1_000_000),
        lastPlayedAt: z.iso.datetime({ offset: true }).nullable(),
        addedAt: z.iso.datetime({ offset: true }).nullable(),
        loved: z.boolean(),
      }),
    )
    .min(1)
    .max(500),
});

export const mergeDuplicatesSchema = z.object({
  groups: z
    .array(z.object({ keepId: z.string().uuid(), removeIds: z.array(z.string().uuid()).min(1).max(20) }))
    .min(1)
    .max(100),
});
