import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exercises } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { searchExercises } from "@/lib/fitness/queries";
import { createCustomExerciseSchema } from "@/lib/validation/fitness";

export const GET = withApiErrors(async (req: Request) => {
  const userId = await requireUserId();
  const params = new URL(req.url).searchParams;

  const rows = await searchExercises(userId, {
    category: params.get("category") ?? undefined,
    muscleGroup: params.get("muscleGroup") ?? undefined,
    equipment: params.get("equipment") ?? undefined,
    search: params.get("q") ?? undefined,
  });

  return NextResponse.json({ exercises: rows });
});

export const POST = withApiErrors(async (req: Request) => {
  const userId = await requireUserId();
  const body = createCustomExerciseSchema.parse(await req.json());

  const [exercise] = await db
    .insert(exercises)
    .values({ ...body, isCustom: true, userId })
    .returning();

  return NextResponse.json({ exercise }, { status: 201 });
});
