import { z } from "zod";
import { eq, and, inArray } from "drizzle-orm";
import {
  applicationFlows,
  applications,
  applicationFileUploads,
  applicationModeratorNotifications,
  users
} from "@guildora/shared";
import type { ApplicationFlowSettings, ApplicationFlowGraph } from "@guildora/shared";
import { linearizeFlowGraph } from "@guildora/shared";
import { verifyAndLoadToken, markTokenUsed } from "../../../utils/application-tokens";
import { requireRouterParam, readBodyWithSchema } from "../../../utils/http";
import { getDb } from "../../../utils/db";
import {
  addDiscordRolesToMember,
  sendDiscordDm
} from "../../../utils/botSync";

const bodySchema = z.object({
  token: z.string().min(1),
  answers: z.record(z.unknown()),
  fileUploadIds: z.array(z.string().uuid()).optional().default([])
});

export default defineEventHandler(async (event) => {
  const flowId = requireRouterParam(event, "flowId", "Missing flow ID.");
  const body = await readBodyWithSchema(event, bodySchema, "Invalid submission payload.");

  const verified = await verifyAndLoadToken(body.token);
  if (!verified) {
    throw createError({ statusCode: 401, statusMessage: "Invalid or expired token." });
  }
  if (verified.flowId !== flowId) {
    throw createError({ statusCode: 400, statusMessage: "Token does not match this flow." });
  }

  const db = getDb();

  const [flow] = await db
    .select()
    .from(applicationFlows)
    .where(eq(applicationFlows.id, flowId))
    .limit(1);

  if (!flow || flow.status !== "active") {
    throw createError({ statusCode: 404, statusMessage: "Flow not found or inactive." });
  }

  const settings = flow.settingsJson as ApplicationFlowSettings;
  const graph = flow.flowJson as ApplicationFlowGraph;

  // Race condition guard for concurrent applications
  if (!settings.concurrency.allowReapplyToSameFlow) {
    const [existing] = await db
      .select({ id: applications.id })
      .from(applications)
      .where(and(
        eq(applications.flowId, flowId),
        eq(applications.discordId, verified.discordId),
        eq(applications.status, "pending")
      ))
      .limit(1);

    if (existing) {
      throw createError({ statusCode: 409, statusMessage: "You already have an open application." });
    }
  }

  const linearized = linearizeFlowGraph(graph, body.answers);

  // Validate required fields
  for (const step of linearized.steps) {
    if (step.type === "abort") {
      throw createError({ statusCode: 400, statusMessage: "Application was aborted." });
    }
    if (step.fields) {
      for (const field of step.fields) {
        if (field.required) {
          const answer = body.answers[field.nodeId];
          if (answer === undefined || answer === null || answer === "") {
            throw createError({
              statusCode: 400,
              statusMessage: `Field "${field.label}" is required.`
            });
          }
        }
      }
    }
  }

  // Collect all roles: on-submission + role assignment nodes in traversed path
  const allRoleIds = [
    ...new Set([
      ...(settings.roles.onSubmission || []),
      ...(linearized.collectedRoleIds || [])
    ])
  ];

  // Insert application
  const [application] = await db.insert(applications).values({
    flowId,
    discordId: verified.discordId,
    discordUsername: verified.discordUsername,
    discordAvatarUrl: verified.discordAvatarUrl,
    answersJson: body.answers,
    status: "pending",
    rolesAssigned: [],
    pendingRoleAssignments: []
  }).returning();

  // Link file uploads + mark token used in parallel
  await Promise.all([
    body.fileUploadIds.length > 0
      ? db.update(applicationFileUploads)
          .set({ applicationId: application.id })
          .where(and(
            inArray(applicationFileUploads.id, body.fileUploadIds),
            eq(applicationFileUploads.discordId, verified.discordId)
          ))
      : Promise.resolve(),
    markTokenUsed(verified.tokenId)
  ]);

  // Assign roles via bot bridge (non-blocking for response)
  const assignedRoleIds: string[] = [];
  const pendingRoleAssignments: string[] = [];

  if (allRoleIds.length > 0) {
    try {
      const result = await addDiscordRolesToMember(verified.discordId, allRoleIds);
      if (result?.addedRoleIds) {
        assignedRoleIds.push(...result.addedRoleIds);
      }
    } catch {
      pendingRoleAssignments.push(...allRoleIds);
    }
  }

  // Update application with role results
  await db.update(applications)
    .set({ rolesAssigned: assignedRoleIds, pendingRoleAssignments })
    .where(eq(applications.id, application.id));

  // Send moderator DM notifications (fire-and-forget, don't block response)
  const modNotifications = await db
    .select({ userId: applicationModeratorNotifications.userId })
    .from(applicationModeratorNotifications)
    .where(and(
      eq(applicationModeratorNotifications.flowId, flowId),
      eq(applicationModeratorNotifications.enabled, true)
    ));

  if (modNotifications.length > 0) {
    const modUserIds = modNotifications.map((n) => n.userId);
    const modUsers = await db
      .select({ id: users.id, discordId: users.discordId })
      .from(users)
      .where(inArray(users.id, modUserIds));

    const dmMessage = settings.messages.dmToModsOnSubmission
      || `A new application has been submitted by ${verified.discordUsername}.`;

    // Fire all DMs concurrently, non-blocking
    Promise.all(
      modUsers
        .filter((u) => u.discordId)
        .map((u) => sendDiscordDm(u.discordId, dmMessage).catch(() => {}))
    ).catch(() => {});
  }

  return {
    success: true,
    applicationId: application.id,
    message: settings.messages.submissionConfirmation || "Your application has been submitted successfully!"
  };
});
