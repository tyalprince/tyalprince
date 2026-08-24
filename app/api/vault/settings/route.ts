import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { vaultSettings } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { withApiErrors } from "@/lib/api-utils";
import { getVaultSettings } from "@/lib/vault/queries";
import { createVaultSettingsSchema } from "@/lib/validation/vault";

export const GET = withApiErrors(async () => {
  const userId = await requireUserId();
  const settings = await getVaultSettings(userId);
  return NextResponse.json({ settings });
});

// Creates vault settings on first-time master-password setup. The salt and
// verifier blob are generated client-side from the master password — the
// server just stores them; it never sees the master password or the key.
export const POST = withApiErrors(async (req: Request) => {
  const userId = await requireUserId();

  const existing = await getVaultSettings(userId);
  if (existing) {
    return NextResponse.json(
      { error: "Vault is already set up." },
      { status: 409 },
    );
  }

  const body = createVaultSettingsSchema.parse(await req.json());

  const [settings] = await db
    .insert(vaultSettings)
    .values({ userId, ...body })
    .returning();

  return NextResponse.json({ settings }, { status: 201 });
});
