import { z } from "zod";
import { eq } from "drizzle-orm";
import { applicationFlows } from "@guildora/shared";
import type { ApplicationFlowGraph, ApplicationFlowSettings, ApplicationFlowStatus } from "@guildora/shared";
import { requireModeratorSession } from "../../../utils/auth";
import { readBodyWithSchema, requireRouterParam } from "../../../utils/http";
import { getDb } from "../../../utils/db";
import {
  getFlowById,
  validateFlowActivation,
  handleFlowStatusChange,
  handleEmbedFieldUpdate
} from "../../../utils/application-flows";

const updateFlowSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(["draft", "active", "inactive"]).optional(),
  flowJson: z.any().optional(),
  settingsJson: z.any().optional(),
  action: z.enum(["publish", "discard"]).optional()
});

export default defineEventHandler(async (event) => {
  await requireModeratorSession(event);
  const flowId = requireRouterParam(event, "flowId", "Missing flow ID.");
  const body = await readBodyWithSchema(event, updateFlowSchema, "Invalid flow payload.");
  const db = getDb();

  const flow = await getFlowById(db, flowId);
  if (!flow) {
    throw createError({ statusCode: 404, statusMessage: "Flow not found." });
  }

  if (body.action === "publish") {
    const draftJson = (flow as Record<string, unknown>).draftFlowJson as ApplicationFlowGraph | null;
    if (!draftJson) {
      throw createError({ statusCode: 400, statusMessage: "No unpublished changes to publish." });
    }
    await db
      .update(applicationFlows)
      .set({ flowJson: draftJson, draftFlowJson: null, updatedAt: new Date() })
      .where(eq(applicationFlows.id, flowId));

    const updated = await getFlowById(db, flowId);
    return { flow: updated };
  }

  if (body.action === "discard") {
    await db
      .update(applicationFlows)
      .set({ draftFlowJson: null, updatedAt: new Date() })
      .where(eq(applicationFlows.id, flowId));

    const updated = await getFlowById(db, flowId);
    return { flow: updated };
  }

  const oldStatus = flow.status as ApplicationFlowStatus;
  const newStatus = (body.status ?? oldStatus) as ApplicationFlowStatus;
  const newSettings = (body.settingsJson ?? flow.settingsJson) as ApplicationFlowSettings;
  const newFlowJson = (body.flowJson ?? flow.flowJson) as ApplicationFlowGraph;

  if (newStatus === "active" && body.status === "active") {
    const warnings = validateFlowActivation(newFlowJson, newSettings);
    if (warnings.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: `Cannot activate flow: ${warnings[0].key}`,
        data: { warnings }
      });
    }
  }

  if (body.status && body.status !== oldStatus) {
    const result = await handleFlowStatusChange(db, flowId, oldStatus, newStatus, newSettings);
    if (result.error) {
      throw createError({ statusCode: 400, statusMessage: result.error });
    }
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) updateData.name = body.name;
  if (body.status !== undefined) updateData.status = body.status;
  if (body.settingsJson !== undefined) updateData.settingsJson = newSettings;

  if (body.flowJson !== undefined && !body.status) {
    updateData.draftFlowJson = newFlowJson;
  }
  if (body.flowJson !== undefined && body.status) {
    updateData.flowJson = newFlowJson;
  }

  await db
    .update(applicationFlows)
    .set(updateData)
    .where(eq(applicationFlows.id, flowId));

  if (newStatus === "active" && body.settingsJson && !body.status) {
    const oldSettings = flow.settingsJson as ApplicationFlowSettings;
    const embedFieldsChanged =
      oldSettings.embed.description !== newSettings.embed.description ||
      oldSettings.embed.buttonLabel !== newSettings.embed.buttonLabel ||
      oldSettings.embed.color !== newSettings.embed.color;

    if (embedFieldsChanged) {
      await handleEmbedFieldUpdate(db, flowId, newSettings);
    }
  }

  const updated = await getFlowById(db, flowId);
  return { flow: updated };
});
