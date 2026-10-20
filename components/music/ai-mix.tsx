"use client";

import { useEffect, useState } from "react";
import { Check, Play, RefreshCw, Save, Sparkles, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { usePlayer } from "./player-context";
import { useLibrary } from "./library-context";
import { TrackList } from "./track-list";
import { totalDurationSeconds } from "@/lib/music/similarity";
import { formatTime, plural, type Track } from "@/lib/music/types";

const EXAMPLES = [
  "90s R&B slow jams for a rainy night",
  "Hype gym hip-hop, nothing slow",
  "Sunday morning coffee — soulful and mellow",
  "Throwback party: 2000s club bangers",
  "Songs like EPMD and Gang Starr but more laid back",
  "Road trip singalongs from the 80s and 90s",
];

type Result = { name: string; description: string; trackIds: string[]; considered: number };

/**
 * Describe a playlist in your own words; an AI model (via OpenRouter) picks
 * and orders songs from your library to fit it.
 */
export function AiMix({ count, onDetails }: { count: number; onDetails: (t: Track) => void }) {
  const library = useLibrary();
  const player = usePlayer();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [lastPrompt, setLastPrompt] = useState("");
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ configured: boolean }>("/api/music/ai-mix")
      .then((r) => setConfigured(r.configured))
      .catch(() => setConfigured(false));
  }, []);

  const tracks = (result?.trackIds ?? []).flatMap((id) => library.byId.get(id) ?? []);

  async function generate(text = prompt) {
    const request = text.trim();
    if (request.length < 3) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const r = await apiFetch<Result>("/api/music/ai-mix", { method: "POST", body: JSON.stringify({ prompt: request, count }) });
      setResult(r);
      setName(r.name);
      setLastPrompt(request);
      setHistoryId(null);
      // Keep every AI mix in history so it can be found again later.
      library
        .createPlaylist({
          name: r.name,
          description: r.description,
          trackIds: r.trackIds,
          kind: "history",
          recipe: { source: "ai", prompt: request },
        })
        .then((p) => setHistoryId(p.id))
        .catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't make that playlist.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!tracks.length) return;
    if (historyId) {
      await library.keepMix(historyId, name.trim() || result?.name);
      setSaved(true);
      return;
    }
    await library.createPlaylist({
      name: name.trim() || result?.name || "AI mix",
      description: result?.description,
      trackIds: tracks.map((t) => t.id),
      kind: "generated",
      recipe: { source: "ai", prompt: lastPrompt },
    });
    setSaved(true);
  }

  if (configured === false) return <OpenRouterSetup />;

  return (
    <section className="space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/40 p-4 dark:border-indigo-900 dark:bg-indigo-950/20">
      <div>
        <h3 className="flex items-center gap-1.5 font-semibold">
          <Wand2 className="h-4 w-4 text-indigo-500" />
          Describe a playlist
        </h3>
        <p className="text-xs text-neutral-500">
          Say what you&apos;re in the mood for — era, vibe, activity, artists it should sound like. AI picks and orders
          songs from your library ({plural(count, "song")}).
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          generate();
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. late-night 90s R&B, smooth and slow"
          maxLength={500}
          className="min-w-0 flex-1"
        />
        <Button type="submit" disabled={busy || prompt.trim().length < 3 || configured === null}>
          <Sparkles className={cn("h-4 w-4", busy && "animate-pulse")} />
          {busy ? "Making…" : "Make playlist"}
        </Button>
      </form>
      {!result && !busy && (
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => {
                setPrompt(ex);
                generate(ex);
              }}
              className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-600 hover:border-indigo-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
            >
              {ex}
            </button>
          ))}
        </div>
      )}
      {busy && <p className="text-xs text-neutral-500">Reading your library and picking songs… this takes about 10–20 seconds.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && !busy && (
        <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Playlist name" className="font-medium" />
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{result.description}</p>
          <p className="text-xs text-neutral-500">
            {plural(tracks.length, "song")} · {formatTime(totalDurationSeconds(tracks))} · chosen from{" "}
            {plural(result.considered, "candidate")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => player.play(tracks)} disabled={!tracks.length}>
              <Play className="h-4 w-4" />
              Play
            </Button>
            <Button variant="secondary" onClick={save} disabled={!tracks.length || saved}>
              {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {saved ? "Saved to playlists" : "Save as playlist"}
            </Button>
            <Button variant="ghost" onClick={() => generate(lastPrompt)}>
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
          </div>
          <TrackList tracks={tracks} onDetails={onDetails} empty="Nothing matched — try a broader description." />
        </div>
      )}
    </section>
  );
}

function OpenRouterSetup() {
  return (
    <section className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/40">
      <p className="flex items-center gap-1.5 font-semibold">
        <Wand2 className="h-4 w-4" />
        Connect OpenRouter for AI playlists
      </p>
      <ol className="list-decimal space-y-1 pl-5 text-xs text-neutral-700 dark:text-neutral-300">
        <li>
          Sign in at{" "}
          <a href="https://openrouter.ai" target="_blank" rel="noreferrer" className="underline">
            openrouter.ai
          </a>
          , add a few dollars of credit, and create an API key (Keys → Create key).
        </li>
        <li>
          In Vercel → Settings → Environment Variables, add <code>OPENROUTER_API_KEY</code> with that key (optionally{" "}
          <code>OPENROUTER_MODEL</code> to pick a model), then redeploy.
        </li>
      </ol>
    </section>
  );
}
