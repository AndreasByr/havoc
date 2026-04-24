import { eq } from "drizzle-orm";
import { applications, applicationFlows } from "@guildora/shared";
import type { ApplicationFlowSettings } from "@guildora/shared";
import { requireModeratorSession } from "../../../utils/auth";
import { requireRouterParam } from "../../../utils/http";
import { getDb } from "../../../utils/db";
import { sendDiscordDm, removeDiscordRolesFromBot } from "../../../utils/botSync";

export default defineEventHandler(async (event) => {
  const session = await requireModeratorSession(event);
  const applicationId = requireRouterParam(event, "applicationId", "Missing application ID.");
  const db = getDb();

  const [app] = await db
    .select()
    .from(applications)
    .where(eq(applications.id, applicationId))
    .limit(1);

  if (!app) {
    throw createError({ statusCode: 404, statusMessage: "Application not found." });
  }

  if (app.status !== "pending") {
    throw createError({ statusCode: 400, statusMessage: "Application is not pending." });
  }

  // Remove all roles that were assigned during this flow
  const assignedRoles = app.rolesAssigned as string[] | null;
  if (assignedRoles?.length) {
    try {
      await removeDiscordRolesFromBot(app.discordId, { roleIds: assignedRoles });
    } catch {
      // Non-blocking
    }
  }

  // Load flow for rejection DM
  const [flow] = await db
    .select()
    .from(applicationFlows)
    .where(eq(applicationFlows.id, app.flowId))
    .limit(1);

  const settings = flow?.settingsJson as ApplicationFlowSettings | undefined;

  // Send rejection DM
  if (settings?.messages.dmOnRejection) {
    sendDiscordDm(app.discordId, settings.messages.dmOnRejection).catch(() => {});
  }

  // Update application status
  await db
    .update(applications)
    .set({
      status: "rejected",
      reviewedBy: session.user.id,
      reviewedAt: new Date()
    })
    .where(eq(applications.id, applicationId));

  return { success: true };
});
