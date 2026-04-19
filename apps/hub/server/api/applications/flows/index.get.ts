import type { ApplicationFlowGraph, ApplicationFlowSettings } from "@guildora/shared";

import { requireModeratorSession } from "../../../utils/auth";
import { getDb } from "../../../utils/db";
import { listFlows, validateFlowActivation } from "../../../utils/application-flows";

export default defineEventHandler(async (event) => {
try {
  await requireModeratorSession(event);
  const db = getDb();
  const flows = await listFlows(db);

  return {
    flows: flows.map((flow) => ({
      id: flow.id,
      name: flow.name,
      status: flow.status,
      createdBy: flow.createdBy,
      createdAt: flow.createdAt,
      updatedAt: flow.updatedAt,
      warnings: validateFlowActivation(
        flow.flowJson as ApplicationFlowGraph,
        flow.settingsJson as ApplicationFlowSettings
      )
    }))
  };
} catch (error) {
  if (error && (error as any).statusCode) throw error;
  throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
}
});
