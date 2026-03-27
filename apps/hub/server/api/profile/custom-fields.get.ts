import { eq } from "drizzle-orm";
import { profiles } from "@guildora/shared";
import { requireSession } from "../../utils/auth";
import { loadActiveCustomFields, extractCustomFieldValues } from "../../utils/custom-fields";
import { getDb } from "../../utils/db";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);
  const db = getDb();

  const [allFields, profile] = await Promise.all([
    loadActiveCustomFields(db),
    db
      .select({ customFields: profiles.customFields })
      .from(profiles)
      .where(eq(profiles.userId, session.user.id))
      .limit(1)
      .then((rows) => rows[0] ?? null)
  ]);

  const profileCustomFields = (profile?.customFields ?? {}) as Record<string, unknown>;
  const fields = extractCustomFieldValues(allFields, profileCustomFields, false, "user");

  return { fields };
});
