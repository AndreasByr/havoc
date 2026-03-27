import { eq, and, isNull } from "drizzle-orm";
import { applicationTokens } from "@guildora/shared";
import { verifyTokenSignature } from "@guildora/shared/utils/application-tokens";
import { getDb } from "./db";

export type VerifiedToken = {
  tokenId: string;
  flowId: string;
  discordId: string;
  discordUsername: string;
  discordAvatarUrl: string | null;
  expiresAt: Date;
};

export async function verifyAndLoadToken(signedToken: string): Promise<VerifiedToken | null> {
  const secret = process.env.APPLICATION_TOKEN_SECRET;
  if (!secret) {
    console.error("[application-tokens] APPLICATION_TOKEN_SECRET not configured");
    return null;
  }

  const verified = verifyTokenSignature(signedToken, secret);
  if (!verified) return null;

  const now = new Date();
  if (verified.expiresAt < now) return null;

  const db = getDb();
  const [row] = await db
    .select()
    .from(applicationTokens)
    .where(
      and(
        eq(applicationTokens.id, verified.tokenId),
        isNull(applicationTokens.usedAt)
      )
    )
    .limit(1);

  if (!row) return null;
  if (row.expiresAt < now) return null;

  return {
    tokenId: row.id,
    flowId: row.flowId,
    discordId: row.discordId,
    discordUsername: row.discordUsername,
    discordAvatarUrl: row.discordAvatarUrl,
    expiresAt: row.expiresAt
  };
}

export async function markTokenUsed(tokenId: string): Promise<void> {
  const db = getDb();
  await db
    .update(applicationTokens)
    .set({ usedAt: new Date() })
    .where(eq(applicationTokens.id, tokenId));
}
