import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder
} from "discord.js";
import { getBotMessages, interpolate, resolveBotLocale } from "../i18n/messages";
import type { BotCommand } from "../types";

export const setupCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setNameLocalizations({
      de: "einrichten"
    })
    .setDescription("Post or update the Guildora info embed")
    .setDescriptionLocalizations({
      de: "Erstellt oder aktualisiert das Guildora-Info-Embed"
    })
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setNameLocalizations({
          de: "kanal"
        })
        .setDescription("Target channel for the info embed")
        .setDescriptionLocalizations({
          de: "Zielkanal für das Info-Embed"
        })
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),
  async execute(interaction) {
    const locale = resolveBotLocale(interaction.locale || interaction.guildLocale);
    const messages = getBotMessages(locale);

    if (!interaction.inGuild() || !interaction.guild) {
      await interaction.reply({ ephemeral: true, content: messages.setup.serverOnly });
      return;
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        ephemeral: true,
        content: messages.setup.missingAdminPermission
      });
      return;
    }

    const configuredHubUrl = process.env.NUXT_PUBLIC_HUB_URL || "http://localhost:3003";
    const hubUrl = configuredHubUrl.replace(/\/+$/, "");
    const targetChannel =
      interaction.options.getChannel("channel", false, [ChannelType.GuildText]) ?? interaction.channel;

    if (!targetChannel || !("isTextBased" in targetChannel) || !targetChannel.isTextBased()) {
      await interaction.reply({
        ephemeral: true,
        content: messages.setup.invalidChannel
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(messages.setup.embedTitle)
      .setDescription(messages.setup.embedDescription)
      .addFields(
        {
          name: messages.setup.loginFieldName,
          value: messages.setup.loginFieldValue
        },
        {
          name: messages.setup.profileFieldName,
          value: messages.setup.profileFieldValue
        },
        {
          name: messages.setup.hintFieldName,
          value: messages.setup.hintFieldValue
        }
      );

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setLabel(messages.setup.buttonLabel).setStyle(ButtonStyle.Link).setURL(`${hubUrl}/dashboard`)
    );

    const message = await targetChannel.send({
      embeds: [embed],
      components: [actionRow]
    });

    await interaction.reply({
      ephemeral: true,
      content: interpolate(messages.setup.successReply, { channelId: targetChannel.id, messageId: message.id })
    });
  }
};
