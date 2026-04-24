import { privacyConsents } from "@guildora/shared";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getRequestIP } from "h3";
import { getDb } from "../../utils/db";
import { readBodyWithSchema } from "../../utils/http";
import { checkRateLimit, getRateLimitKey } from "../../utils/rate-limit";
import crypto from "crypto";

const bodySchema = z.object({
  policyVersion: z.string().min(1).max(50)
});

export default defineEventHandler(async (event) => {
  checkRateLimit(getRateLimitKey(event, "consent"), { windowMs: 60000, max: 20 });

  const body = await readBodyWithSchema(
    event,
    bodySchema,
    "Invalid consent payload: policyVersion is required."
  );

  // Resolve userId from session if authenticated, null for anonymous visitors
  let userId: string | null = null;
  try {
    const session = await getUserSession(event) as { user?: { id?: string } } | null;
    if (session?.user?.id) {
      userId = session.user.id;
    }
  } catch {
    // Not authenticated — anonymous consent is allowed
  }

  // Hash the IP for privacy — never store raw IPs
  const rawIp = getRequestIP(event, { xForwardedFor: true }) ?? null;
  const ipHash = rawIp
    ? crypto.createHash("sha256").update(rawIp).digest("hex")
    : null;

  const db = getDb();

  // Check if this user already consented to this policy version
  // For authenticated users, deduplicate by userId + policyVersion
  // For anonymous, allow recording (deduplicated client-side via cookie)
  if (userId) {
    const existing = await db
      .select({ id: privacyConsents.id })
      .from(privacyConsents)
      .where(
        and(
          eq(privacyConsents.userId, userId),
          eq(privacyConsents.policyVersion, body.policyVersion)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Already consented — return success idempotently
      return { success: true, alreadyConsented: true };
    }
  }

  const [inserted] = await db
    .insert(privacyConsents)
    .values({
      userId,
      policyVersion: body.policyVersion,
      ipHash
    })
    .returning({ id: privacyConsents.id, acceptedAt: privacyConsents.acceptedAt });

  console.log(`[consent] Recorded consent: userId=${userId ?? "anonymous"}, policyVersion=${body.policyVersion}, ipHash=${ipHash ? "present" : "null"}`);

  return { success: true, id: inserted.id, acceptedAt: inserted.acceptedAt };
});
