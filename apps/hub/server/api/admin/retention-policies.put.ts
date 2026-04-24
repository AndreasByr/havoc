import { z } from "zod";
import { eq } from "drizzle-orm";
import { retentionPolicies } from "@guildora/shared";
import { requireAdminSession } from "../../utils/auth";
import { getDb } from "../../utils/db";
import { readBodyWithSchema } from "../../utils/http";

const retentionPolicySchema = z.object({
  category: z.enum(["voice_sessions", "audit_logs", "application_data", "inactive_users"]),
  retentionDays: z.number().int().min(1).max(3650).optional(),
  enabled: z.boolean().optional()
});

const schema = z.object({
  policies: z.array(retentionPolicySchema).min(1)
});

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const parsed = await readBodyWithSchema(event, schema, "Invalid retention policy payload.");

  const db = getDb();
  const updated: Array<{
    id: number;
    category: string;
    retentionDays: number;
    enabled: boolean;
    updatedAt: Date;
  }> = [];

  for (const policy of parsed.policies) {
    // Check if a policy row exists for this category
    const [existing] = await db
      .select()
      .from(retentionPolicies)
      .where(eq(retentionPolicies.category, policy.category))
      .limit(1);

    if (existing) {
      const updateData: Record<string, unknown> = {};
      if (policy.retentionDays !== undefined) updateData.retentionDays = policy.retentionDays;
      if (policy.enabled !== undefined) updateData.enabled = policy.enabled;

      if (Object.keys(updateData).length > 0) {
        const [row] = await db
          .update(retentionPolicies)
          .set(updateData)
          .where(eq(retentionPolicies.category, policy.category))
          .returning({
            id: retentionPolicies.id,
            category: retentionPolicies.category,
            retentionDays: retentionPolicies.retentionDays,
            enabled: retentionPolicies.enabled,
            updatedAt: retentionPolicies.updatedAt
          });
        updated.push(row!);
        console.log(`[retention] Policy updated: category=${policy.category}, changes=${JSON.stringify(updateData)}`);
      } else {
        updated.push(existing);
      }
    } else {
      // Insert new policy row for this category
      const [row] = await db
        .insert(retentionPolicies)
        .values({
          category: policy.category,
          retentionDays: policy.retentionDays ?? 90,
          enabled: policy.enabled ?? true
        })
        .returning({
          id: retentionPolicies.id,
          category: retentionPolicies.category,
          retentionDays: retentionPolicies.retentionDays,
          enabled: retentionPolicies.enabled,
          updatedAt: retentionPolicies.updatedAt
        });
      updated.push(row!);
      console.log(`[retention] Policy created: category=${policy.category}, retentionDays=${policy.retentionDays ?? 90}, enabled=${policy.enabled ?? true}`);
    }
  }

  return { policies: updated };
});
