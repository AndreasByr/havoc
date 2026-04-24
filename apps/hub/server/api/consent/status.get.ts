import { privacyConsents } from "@guildora/shared";
import { eq, desc } from "drizzle-orm";
import { getDb } from "../../utils/db";

export default defineEventHandler(async (event) => {
  // Try to get the current user's session — allow anonymous access
  let userId: string | null = null;
  try {
    const session = await getUserSession(event) as { user?: { id?: string } } | null;
    if (session?.user?.id) {
      userId = session.user.id;
    }
  } catch {
    // Not authenticated — return no consent
  }

  if (!userId) {
    return { hasConsented: false, reason: "not_authenticated" };
  }

  const db = getDb();

  // Check if the user has any consent record
  const latest = await db
    .select({
      id: privacyConsents.id,
      acceptedAt: privacyConsents.acceptedAt,
      policyVersion: privacyConsents.policyVersion
    })
    .from(privacyConsents)
    .where(eq(privacyConsents.userId, userId))
    .orderBy(desc(privacyConsents.acceptedAt))
    .limit(1);

  if (latest.length === 0) {
    return { hasConsented: false, reason: "no_record" };
  }

  return {
    hasConsented: true,
    acceptedAt: latest[0].acceptedAt,
    policyVersion: latest[0].policyVersion
  };
});
