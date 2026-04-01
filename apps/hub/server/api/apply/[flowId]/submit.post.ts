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
  removeDiscordRolesFromBot,
  sendDiscordDm,
  createDiscordChannel,
  createDiscordThread,
  sendChannelMessage
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

  // Collect applicant-selected role IDs from discord_role_single/multi fields
  const applicantSelectedRoleIds: string[] = [];
  for (const step of linearized.steps) {
    if (!step.fields) continue;
    for (const field of step.fields) {
      if (field.inputType !== "discord_role_single" && field.inputType !== "discord_role_multi") continue;
      const answer = body.answers[field.nodeId];
      if (!answer) continue;
      const allowedIds = new Set((field.discordRoleOptions ?? []).map((r) => r.roleId));
      const selected = Array.isArray(answer) ? answer as string[] : [answer as string];
      for (const id of selected) {
        if (!allowedIds.has(id)) {
          throw createError({ statusCode: 400, statusMessage: `Invalid role selection for "${field.label}".` });
        }
        applicantSelectedRoleIds.push(id);
      }
    }
  }

  // Collect all roles: on-submission + role assignment nodes + applicant selections
  const allRoleIds = [
    ...new Set([
      ...(settings.roles.onSubmission || []),
      ...(linearized.collectedRoleIds || []),
      ...applicantSelectedRoleIds
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

  // Remove roles on submission
  const removeOnSubmission = settings.roles.removeOnSubmission || [];
  if (removeOnSubmission.length > 0) {
    try {
      await removeDiscordRolesFromBot(verified.discordId, { roleIds: removeOnSubmission });
    } catch {
      // Non-blocking
    }
  }

  // Update application with role results
  await db.update(applications)
    .set({ rolesAssigned: assignedRoleIds, pendingRoleAssignments })
    .where(eq(applications.id, application.id));

  // Create ticket channel/thread if enabled
  if (settings.ticket?.enabled) {
    const ticketName = (settings.ticket.nameTemplate || "{username}-bewerbung")
      .replace("{username}", verified.discordUsername)
      .replace("{applicationId}", application.id.substring(0, 8))
      .slice(0, 100);

    let ticketChannelId: string | null = null;

    try {
      if (settings.ticket.type === "thread" && settings.ticket.parentChannelId) {
        const result = await createDiscordThread(
          settings.ticket.parentChannelId,
          ticketName,
          { type: "private", memberUserIds: [verified.discordId] }
        );
        ticketChannelId = result?.threadId ?? null;
      } else if (settings.ticket.type === "channel" && settings.ticket.parentCategoryId) {
        // Build permission overwrites: allow applicant + access roles
        const VIEW_SEND = "3072"; // ViewChannel (1024) + SendMessages (2048)
        const overwrites: Array<{ id: string; type: number; allow: string; deny: string }> = [
          { id: verified.discordId, type: 1, allow: VIEW_SEND, deny: "0" }
        ];
        for (const roleId of (settings.ticket.accessRoleIds || [])) {
          overwrites.push({ id: roleId, type: 0, allow: VIEW_SEND, deny: "0" });
        }
        const result = await createDiscordChannel(
          ticketName,
          "text",
          settings.ticket.parentCategoryId,
          { denyEveryone: true, permissionOverwrites: overwrites }
        );
        ticketChannelId = result?.channelId ?? null;
      }

      if (ticketChannelId) {
        await db.update(applications)
          .set({ ticketChannelId })
          .where(eq(applications.id, application.id));

        if (settings.ticket.initialMessage) {
          const msg = settings.ticket.initialMessage
            .replace("{discordId}", `<@${verified.discordId}>`)
            .replace("{username}", verified.discordUsername);
          sendChannelMessage(ticketChannelId, msg).catch(() => {});
        }
      }
    } catch {
      // Ticket creation is non-blocking
    }
  }

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
