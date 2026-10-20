import { HttpError } from "@/lib/api-utils";
import { getUserTracks } from "@/lib/music/queries";
import { candidateLines, librarySummary, parseIntent, parseJson, resolvePicks, shortlist, type MixIntent } from "@/lib/music/ai-candidates";
import type { Track } from "@/lib/music/types";

// AI mixes through OpenRouter (openrouter.ai — one API key, many models).
// Two short calls: understand the request, then curate from a shortlist of
// the user's own songs (lib/music/ai-candidates.ts). The model never invents
// songs: it can only pick numbers from the list it's given.

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "anthropic/claude-sonnet-5.5";
const FALLBACK_MODEL = "openrouter/auto";

export function openRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

type Message = { role: "system" | "user"; content: string };

async function complete(messages: Message[], maxTokens: number): Promise<unknown> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new HttpError(503, "OpenRouter isn't connected");
  const preferred = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;

  for (const model of preferred === FALLBACK_MODEL ? [preferred] : [preferred, FALLBACK_MODEL]) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://tyalprince.vercel.app",
        "X-Title": "Life OS Music",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(40_000),
      cache: "no-store",
    });
    if (res.status === 401) throw new HttpError(502, "OpenRouter rejected the API key — check OPENROUTER_API_KEY.");
    if (res.status === 402) throw new HttpError(502, "Your OpenRouter account is out of credits.");
    if (res.status === 429) throw new HttpError(429, "OpenRouter is rate-limiting requests — try again in a minute.");
    // An unknown or unavailable model: try OpenRouter's automatic model choice once.
    if ((res.status === 400 || res.status === 404) && model !== FALLBACK_MODEL) continue;
    if (!res.ok) throw new HttpError(502, `OpenRouter error (${res.status}).`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return parseJson(data.choices?.[0]?.message?.content ?? "");
  }
  throw new HttpError(502, "OpenRouter couldn't run the request.");
}

const INTENT_PROMPT = `You turn a listener's playlist request into search criteria for their personal music library.
Reply with one JSON object only, using these keys (omit or null when not implied):
{
  "genres": string[]            // genre words as they'd appear in tags, e.g. "R&B", "Hip-Hop", "Rock", "Soul"
  "yearFrom": number|null, "yearTo": number|null   // only if the request implies an era ("90s" → 1990–1999)
  "artists": string[]           // artists that fit, from the library summary or your own knowledge
  "excludeArtists": string[]
  "songs": [{"title": string, "artist": string}]   // up to 40 specific songs you know fit the request
  "energy": "low"|"medium"|"high"|null
  "tempoMin": number|null, "tempoMax": number|null // BPM, only if the request implies pace
  "likedOnly": boolean, "minStars": 0-5
  "keywords": string[]          // words likely in matching titles, e.g. "rain", "summer", "love"
}
Be generous with genres, artists and songs so there are plenty of candidates; the library may not contain everything you name.`;

const CURATE_PROMPT = `You are a DJ building a playlist from the listener's own library.
Choose ONLY from the numbered candidates. Reply with one JSON object only:
{"name": string (short, catchy), "description": string (one sentence), "picks": number[] (candidate numbers, in play order)}
Rules: pick exactly the requested number of songs if enough fit, fewer if not — never pad with songs that don't fit.
Order for flow (energy, tempo and mood should move smoothly). Avoid more than 2 songs by the same artist unless the request is about that artist.
Prefer songs that truly match the request over loosely related ones; ♥ and ★ mark songs the listener loves.`;

export type AiMix = { name: string; description: string; trackIds: string[]; intent: MixIntent; considered: number };

/** Builds a playlist for a free-text request from the user's own library. */
export async function generateAiMix(userId: string, prompt: string, count: number): Promise<AiMix> {
  const tracks = (await getUserTracks(userId)) as unknown as Track[];
  if (tracks.length < 5) throw new HttpError(400, "Add some songs to your library first.");

  const intent = parseIntent(
    await complete(
      [
        { role: "system", content: INTENT_PROMPT },
        { role: "user", content: `Library:\n${librarySummary(tracks)}\n\nRequest: ${prompt}\nPlaylist length: ${count} songs.` },
      ],
      1200,
    ),
  );

  const candidates = shortlist(tracks, intent, Math.max(120, Math.min(250, count * 4)));
  if (!candidates.length) throw new HttpError(422, "Nothing in your library matches that — try loosening the request.");

  const reply = (await complete(
    [
      { role: "system", content: CURATE_PROMPT },
      { role: "user", content: `Request: ${prompt}\nSongs wanted: ${count}\n\nCandidates:\n${candidateLines(candidates)}` },
    ],
    1500,
  )) as { name?: unknown; description?: unknown; picks?: unknown } | null;

  let picked = resolvePicks(reply?.picks, candidates, count);
  // If the curator came back empty, fall back to the best-scoring candidates.
  if (!picked.length) picked = candidates.slice(0, count).map((c) => c.track);

  const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  return {
    name: text(reply?.name, 80) ?? prompt.slice(0, 60),
    description: text(reply?.description, 300) ?? `Made from: “${prompt.slice(0, 200)}”`,
    trackIds: picked.map((t) => t.id),
    intent,
    considered: candidates.length,
  };
}
