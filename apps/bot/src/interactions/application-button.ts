import crypto from "node:crypto";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, type ButtonInteraction, type Client } from "discord.js";
import { eq, and } from "drizzle-orm";
import { applicationFlows, applications, applicationTokens } from "@guildora/shared";
import type { ApplicationFlowSettings } from "@guildora/shared";
import { getDb } from "../utils/db";
import { logger } from "../utils/logger";
import { signTokenId } from "../utils/application-tokens";

/**
 * Handles the "Apply" button interaction on application embed messages.
 * Button customId format: application_apply_{flowId}
 */
export async function handleApplicationButtonInteraction(
  interaction: ButtonInteraction,
  client: Client
): Promise<void> {
  const customId = interaction.customId;
  if (!customId.startsWith("application_apply_")) return;

  const flowId = customId.replace("application_apply_", "");
  const db = getDb();

  // Load flow
  const [flow] = await db
    .select()
    .from(applicationFlows)
    .where(eq(applicationFlows.id, flowId))
    .limit(1);

  if (!flow || flow.status !== "active") {
    await interaction.reply({ ephemeral: true, content: "This application is currently not available." });
    return;
  }

  const settings = flow.settingsJson as ApplicationFlowSettings;
  const discordId = interaction.user.id;
  const guildId = interaction.guildId;

  // Test mode skips checks
  if (!settings.testMode) {
    // Check guild membership
    if (!guildId || !interaction.member) {
      await interaction.reply({ ephemeral: true, content: "You must be in the server to apply." });
      return;
    }

    // Check if user already has the "on approval" role (= already a member)
    if (settings.roles.onApproval.length > 0 && interaction.member.roles) {
      const memberRoles = interaction.member.roles;
      const roleCache = "cache" in memberRoles ? memberRoles.cache : null;
      if (roleCache) {
        const hasApprovalRole = settings.roles.onApproval.some((roleId) => roleCache.has(roleId));
        if (hasApprovalRole) {
          await interaction.reply({ ephemeral: true, content: "You are already a member." });
          return;
        }
      }
    }
  }

  // Check concurrent application settings
  const concurrency = settings.concurrency;

  if (!concurrency.allowReapplyToSameFlow) {
    const [existingSameFlow] = await db
      .select()
      .from(applications)
      .where(and(
        eq(applications.flowId, flowId),
        eq(applications.discordId, discordId),
        eq(applications.status, "pending")
      ))
      .limit(1);

    if (existingSameFlow) {
      await interaction.reply({ ephemeral: true, content: "You already have an open application for this flow." });
      return;
    }
  }

  if (!concurrency.allowCrossFlowApplications) {
    const [existingAnyFlow] = await db
      .select()
      .from(applications)
      .where(and(
        eq(applications.discordId, discordId),
        eq(applications.status, "pending")
      ))
      .limit(1);

    if (existingAnyFlow) {
      await interaction.reply({ ephemeral: true, content: "You already have an open application." });
      return;
    }
  }

  // Generate token
  const tokenSecret = process.env.APPLICATION_TOKEN_SECRET;
  const hubUrl = process.env.NUXT_PUBLIC_HUB_URL;

  if (!tokenSecret || !hubUrl) {
    logger.error("APPLICATION_TOKEN_SECRET or NUXT_PUBLIC_HUB_URL not configured.");
    await interaction.reply({ ephemeral: true, content: "The application system is currently being set up. Please try again later or contact a server moderator." });
    return;
  }

  const expiryMinutes = settings.tokenExpiryMinutes || 60;
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  // Generate token ID upfront so we can sign before inserting (single DB write)
  const tokenId = crypto.randomUUID();
  const signedToken = signTokenId(tokenId, expiresAt, tokenSecret);

  await db.insert(applicationTokens).values({
    id: tokenId,
    flowId,
    discordId,
    discordUsername: interaction.user.username,
    discordAvatarUrl: interaction.user.displayAvatarURL({ extension: "png", size: 256 }) || null,
    token: signedToken,
    expiresAt
  });

  const applyUrl = `${hubUrl}/apply/${flowId}/${signedToken}`;
  const ephemeralText = settings.messages.ephemeralConfirmation || "Click the button below to open the application form.";
  const buttonLabel = settings.messages.ephemeralButtonLabel || "Open Application";

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel(buttonLabel)
      .setStyle(ButtonStyle.Link)
      .setURL(applyUrl)
  );

  await interaction.reply({
    ephemeral: true,
    content: ephemeralText,
    components: [row]
  });
}
