import { z } from "zod";
import { createError } from "h3";
import { applicationFlows, createDefaultFlowGraph, createDefaultSimpleFlowGraph, createDefaultFlowSettings  } from "@guildora/shared";
import type { EditorMode } from "@guildora/shared";
import { requireModeratorSession } from "../../../utils/auth";
import { readBodyWithSchema } from "../../../utils/http";
import { getDb } from "../../../utils/db";

const createFlowSchema = z.object({
  name: z.string().min(1).max(200),
  editorMode: z.enum(["simple", "advanced"]).optional().default("simple")
});

export default defineEventHandler(async (event) => {
try {
  const session = await requireModeratorSession(event);
  const body = await readBodyWithSchema(event, createFlowSchema, "Invalid flow name.");
  const db = getDb();

  const editorMode: EditorMode = body.editorMode;
  const flowJson = editorMode === "simple"
    ? createDefaultSimpleFlowGraph()
    : createDefaultFlowGraph();

  const [flow] = await db
    .insert(applicationFlows)
    .values({
      name: body.name,
      status: "draft",
      flowJson,
      editorMode,
      settingsJson: createDefaultFlowSettings(),
      createdBy: session.user.id
    })
    .returning();

  return { flow };
} catch (error) {
  if (error && (error as any).statusCode) throw error;
  throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
}
});
