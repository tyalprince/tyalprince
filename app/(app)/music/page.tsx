import { MusicApp } from "@/components/music/music-app";

export default async function MusicPage({ searchParams }: { searchParams: Promise<{ playlist?: string }> }) {
  const { playlist } = await searchParams;
  // /music?playlist=<id> (e.g. from the dashboard) opens that playlist.
  return <MusicApp initialPlaylistId={typeof playlist === "string" ? playlist : null} />;
}
