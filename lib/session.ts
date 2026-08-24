import { auth } from "@/auth";

/**
 * Resolves the authenticated user's id for use in API routes / Server
 * Actions. Every DB query must be scoped with this id — never trust a
 * user_id supplied by the client. Throws if there is no session; callers in
 * routes should catch and return 401.
 */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new UnauthorizedError();
  }
  return session.user.id;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}
