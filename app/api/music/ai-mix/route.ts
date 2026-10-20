import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { generateAiMix, openRouterConfigured } from "@/lib/music/ai-mix";

// Two model calls; most finish in 5–20 seconds.
export const maxDuration = 60;

const bodySchema = z.object({
  prompt: z.string().trim().min(3).max(500),
  count: z.number().int().min(5).max(100).default(25),
});

/** Whether AI mixes are set up (OPENROUTER_API_KEY). */
export const GET = withApiErrors(async () => {
  await requireUserId();
  return NextResponse.json({ configured: openRouterConfigured() });
});

/** Builds a playlist from a free-text request, using only songs in the user's library. */
export const POST = withApiErrors(async (req: Request) => {
  const userId = await requireUserId();
  const { prompt, count } = bodySchema.parse(await req.json());
  return NextResponse.json(await generateAiMix(userId, prompt, count));
});
