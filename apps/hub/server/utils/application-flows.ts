import { eq, desc, and } from "drizzle-orm";
import {
  applicationFlows,
  applicationFlowEmbeds,
  applications,
  type GuildoraDatabase
} from "@guildora/shared";
import type {
  ApplicationFlowGraph,
  ApplicationFlowSettings,
  ApplicationFlowStatus
} from "@guildora/shared";

export async function getFlowById(db: GuildoraDatabase, flowId: string) {
  const [flow] = await db
    .select()
    .from(applicationFlows)
    .where(eq(applicationFlows.id, flowId))
    .limit(1);
  return flow ?? null;
}

export async function listFlows(db: GuildoraDatabase) {
  return db.select().from(applicationFlows).orderBy(desc(applicationFlows.updatedAt));
}

export async function getActiveEmbedForFlow(db: GuildoraDatabase, flowId: string) {
  const [embed] = await db
    .select()
    .from(applicationFlowEmbeds)
    .where(eq(applicationFlowEmbeds.flowId, flowId))
    .orderBy(desc(applicationFlowEmbeds.updatedAt))
    .limit(1);
  return embed ?? null;
}

export async function countPendingApplicationsForFlow(db: GuildoraDatabase, flowId: string) {
  const rows = await db
    .select({ id: applications.id })
    .from(applications)
    .where(and(eq(applications.flowId, flowId), eq(applications.status, "pending")));
  return rows.length;
}

// ─── Activation Validation ──────────────────────────────────────────────────

export interface FlowValidationWarning {
  key: string;
  category: "graph" | "settings" | "environment";
}

export function validateFlowActivation(
  graph: ApplicationFlowGraph,
  settings: ApplicationFlowSettings
): FlowValidationWarning[] {
  const warnings: FlowValidationWarning[] = [];

  const graphErrors = validateFlowGraph(graph);
  if (graphErrors.length > 0) {
    warnings.push({ key: "invalidGraph", category: "graph" });
  }

  if (!settings.embed.channelId) {
    warnings.push({ key: "missingChannelId", category: "settings" });
  }

  if (!process.env.APPLICATION_TOKEN_SECRET) {
    warnings.push({ key: "missingTokenSecret", category: "environment" });
  }

  if (!process.env.NUXT_PUBLIC_HUB_URL) {
    warnings.push({ key: "missingHubUrl", category: "environment" });
  }

  return warnings;
}

/**
 * Validates the basic structure of a flow graph.
 * Returns an array of error messages (empty = valid).
 */
export function validateFlowGraph(graph: ApplicationFlowGraph): string[] {
  const errors: string[] = [];

  if (!graph.nodes || !Array.isArray(graph.nodes)) {
    errors.push("Flow graph must contain a nodes array.");
    return errors;
  }

  if (!graph.edges || !Array.isArray(graph.edges)) {
    errors.push("Flow graph must contain an edges array.");
    return errors;
  }

  const startNodes = graph.nodes.filter((n) => n.type === "start");
  const endNodes = graph.nodes.filter((n) => n.type === "end");

  if (startNodes.length !== 1) {
    errors.push("Flow must have exactly one start node.");
  }

  if (endNodes.length < 1) {
    errors.push("Flow must have at least one end node.");
  }

  // Check for orphan nodes (no incoming or outgoing edges, excluding start/end)
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  const connectedNodes = new Set<string>();
  for (const edge of graph.edges) {
    connectedNodes.add(edge.source);
    connectedNodes.add(edge.target);
  }

  for (const node of graph.nodes) {
    if (node.type === "start" || node.parentNode) continue;
    if (!connectedNodes.has(node.id)) {
      errors.push(`Node "${node.id}" is disconnected from the flow.`);
    }
  }

  return errors;
}

/**
 * Handles embed lifecycle when flow status changes.
 * Called from the flow PUT endpoint.
 */
export async function handleFlowStatusChange(
  db: GuildoraDatabase,
  flowId: string,
  oldStatus: ApplicationFlowStatus,
  newStatus: ApplicationFlowStatus,
  settings: ApplicationFlowSettings
): Promise<{ embedPosted?: boolean; embedRemoved?: boolean; error?: string }> {
  // Active → post embed
  if (newStatus === "active" && oldStatus !== "active") {
    if (!settings.embed.channelId) {
      return { error: "Cannot activate flow: no Discord channel configured for the embed." };
    }

    try {
      const { postApplicationEmbed } = await import("./botSync");
      const result = await postApplicationEmbed(flowId, settings.embed.channelId, {
        description: settings.embed.description,
        buttonLabel: settings.embed.buttonLabel,
        color: settings.embed.color
      });

      if (result?.messageId) {
        // Upsert embed record
        const existingEmbed = await getActiveEmbedForFlow(db, flowId);
        if (existingEmbed) {
          await db
            .update(applicationFlowEmbeds)
            .set({
              discordChannelId: settings.embed.channelId,
              discordMessageId: result.messageId,
              active: true,
              updatedAt: new Date()
            })
            .where(eq(applicationFlowEmbeds.id, existingEmbed.id));
        } else {
          await db.insert(applicationFlowEmbeds).values({
            flowId,
            discordChannelId: settings.embed.channelId,
            discordMessageId: result.messageId,
            active: true
          });
        }
      }

      return { embedPosted: true };
    } catch (err) {
      console.error("[application-flows] Failed to post embed:", err);
      return { error: "Failed to post Discord embed. Flow remains in draft." };
    }
  }

  // Inactive/Draft (from active) → remove embed
  if (oldStatus === "active" && newStatus !== "active") {
    try {
      const embed = await getActiveEmbedForFlow(db, flowId);
      if (embed?.discordMessageId && embed.active) {
        const { deleteApplicationEmbed } = await import("./botSync");
        await deleteApplicationEmbed(embed.discordChannelId, embed.discordMessageId);
        await db
          .update(applicationFlowEmbeds)
          .set({ active: false, updatedAt: new Date() })
          .where(eq(applicationFlowEmbeds.id, embed.id));
      }
      return { embedRemoved: true };
    } catch (err) {
      console.error("[application-flows] Failed to remove embed:", err);
      // Non-blocking: flow status still changes
      return { embedRemoved: false };
    }
  }

  return {};
}

/**
 * Updates the existing Discord embed in-place when embed-relevant fields change on an active flow.
 */
export async function handleEmbedFieldUpdate(
  db: GuildoraDatabase,
  flowId: string,
  settings: ApplicationFlowSettings
): Promise<void> {
  const embed = await getActiveEmbedForFlow(db, flowId);
  if (!embed?.discordMessageId || !embed.active) return;

  try {
    const { patchApplicationEmbed } = await import("./botSync");
    await patchApplicationEmbed(embed.discordChannelId, embed.discordMessageId, {
      description: settings.embed.description,
      buttonLabel: settings.embed.buttonLabel,
      color: settings.embed.color
    });
  } catch (err) {
    console.error("[application-flows] Failed to update embed:", err);
  }
}
