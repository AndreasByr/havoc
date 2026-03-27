import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import type { GuildoraAppManifest } from "../types/app-manifest";
import type { LocaleCode } from "../types/locale";
import type { ApplicationFlowGraph, ApplicationFlowSettings } from "../types/application-flow";
import type { DisplayNameField } from "../types/profile";

export const absenceStatusEnum = pgEnum("absence_status", ["away", "maintenance"]);
export const appInstallStatusEnum = pgEnum("app_install_status", ["active", "inactive", "error"]);
export const appInstallSourceEnum = pgEnum("app_install_source", ["marketplace", "sideloaded"]);
export const appSubmissionStatusEnum = pgEnum("app_submission_status", ["pending", "approved", "rejected"]);
export const applicationFlowStatusEnum = pgEnum("application_flow_status", ["draft", "active", "inactive"]);
export const applicationStatusEnum = pgEnum("application_status", ["pending", "approved", "rejected"]);
export type ThemeContentTone = "light" | "dark";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  discordId: text("discord_id").notNull().unique(),
  email: text("email"),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  avatarSource: text("avatar_source"),
  primaryDiscordRoleName: text("primary_discord_role_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date())
});

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  absenceStatus: absenceStatusEnum("absence_status"),
  absenceMessage: text("absence_message"),
  absenceUntil: timestamp("absence_until", { withTimezone: true }),
  customFields: jsonb("custom_fields").$type<Record<string, unknown>>().default({}),
  localePreference: text("locale_preference").$type<LocaleCode | null>(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date())
});

export const permissionRoles = pgTable("permission_roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  level: integer("level").notNull().default(0)
});

export const communityRoles = pgTable("community_roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  discordRoleId: text("discord_role_id").unique(),
  permissionRoleId: integer("permission_role_id")
    .notNull()
    .references(() => permissionRoles.id, { onDelete: "restrict" }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date())
});

export const userPermissionRoles = pgTable(
  "user_permission_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    permissionRoleId: integer("permission_role_id")
      .notNull()
      .references(() => permissionRoles.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [primaryKey({ columns: [table.userId, table.permissionRoleId] })]
);

export const userCommunityRoles = pgTable("user_community_roles", {
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  communityRoleId: integer("community_role_id")
    .notNull()
    .references(() => communityRoles.id, { onDelete: "restrict" }),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull()
});

export const selectableDiscordRoles = pgTable("selectable_discord_roles", {
  discordRoleId: text("discord_role_id").primaryKey(),
  roleNameSnapshot: text("role_name_snapshot").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date())
});

export const userDiscordRoles = pgTable(
  "user_discord_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    discordRoleId: text("discord_role_id").notNull(),
    roleNameSnapshot: text("role_name_snapshot").notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.discordRoleId] }),
    index("user_discord_roles_discord_role_id_idx").on(table.discordRoleId)
  ]
);

export const voiceSessions = pgTable(
  "voice_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channelId: text("channel_id"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationMinutes: integer("duration_minutes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index("voice_sessions_open_started_idx").on(table.startedAt.desc()).where(sql`${table.endedAt} is null`),
    uniqueIndex("voice_sessions_one_open_per_user_idx").on(table.userId).where(sql`${table.endedAt} is null`)
  ]
);

export const profileChangeLogs = pgTable("profile_change_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  changeType: text("change_type").notNull(),
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  isGrowth: boolean("is_growth").default(false).notNull(),
  isDeparture: boolean("is_departure").default(false).notNull(),
  changedBy: uuid("changed_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const installedApps = pgTable("installed_apps", {
  id: uuid("id").primaryKey().defaultRandom(),
  appId: text("app_id").notNull().unique(),
  name: text("name").notNull(),
  version: text("version").notNull(),
  status: appInstallStatusEnum("status").notNull().default("inactive"),
  source: appInstallSourceEnum("source").notNull().default("sideloaded"),
  verified: boolean("verified").notNull().default(false),
  autoUpdate: boolean("auto_update").notNull().default(false),
  repositoryUrl: text("repository_url"),
  manifest: jsonb("manifest").$type<GuildoraAppManifest>().notNull(),
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  /** Transpiled CJS code bundles: filePath → CJS source string */
  codeBundle: jsonb("code_bundle").$type<Record<string, string>>().notNull().default({}),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  installedAt: timestamp("installed_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date())
});

export const appKv = pgTable(
  "app_kv",
  {
    appId: text("app_id").notNull(),
    key: text("key").notNull(),
    value: jsonb("value")
  },
  (table) => [
    primaryKey({ columns: [table.appId, table.key] }),
    index("app_kv_app_id_idx").on(table.appId)
  ]
);

export const appMarketplaceSubmissions = pgTable("app_marketplace_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  appId: text("app_id").notNull(),
  name: text("name").notNull(),
  version: text("version").notNull(),
  sourceUrl: text("source_url"),
  manifest: jsonb("manifest").$type<GuildoraAppManifest>().notNull(),
  status: appSubmissionStatusEnum("status").notNull().default("pending"),
  automatedChecks: jsonb("automated_checks").$type<Record<string, unknown>>().notNull().default({}),
  reviewNotes: text("review_notes"),
  submittedByUserId: uuid("submitted_by_user_id").references(() => users.id, { onDelete: "set null" }),
  reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date())
});

export const themeSettings = pgTable("theme_settings", {
  id: serial("id").primaryKey(),
  colorDominant: text("color_dominant").notNull().default("#141115"),
  colorSecondary: text("color_secondary").notNull().default("#ffffff"),
  colorAccent: text("color_accent").notNull().default("#ff206e"),
  colorAccentContentTone: text("color_accent_content_tone").$type<ThemeContentTone>().notNull().default("light"),
  colorInfo: text("color_info").notNull().default("#48beff"),
  colorInfoContentTone: text("color_info_content_tone").$type<ThemeContentTone>().notNull().default("dark"),
  colorSuccess: text("color_success").notNull().default("#0cf574"),
  colorSuccessContentTone: text("color_success_content_tone").$type<ThemeContentTone>().notNull().default("dark"),
  colorWarning: text("color_warning").notNull().default("#f18f01"),
  colorWarningContentTone: text("color_warning_content_tone").$type<ThemeContentTone>().notNull().default("light"),
  colorError: text("color_error").notNull().default("#bf211e"),
  colorErrorContentTone: text("color_error_content_tone").$type<ThemeContentTone>().notNull().default("light"),
  logoDataUrl: text("logo_data_url"),
  logoMimeType: text("logo_mime_type"),
  logoFileName: text("logo_file_name"),
  sidebarLogoSizePx: integer("sidebar_logo_size_px").default(60),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" })
});

export const cmsAccessSettings = pgTable("cms_access_settings", {
  id: serial("id").primaryKey(),
  allowModeratorAccess: boolean("allow_moderator_access").notNull().default(true),
  allowModeratorAppsAccess: boolean("allow_moderator_apps_access").notNull().default(true),
  modDeleteUsers: boolean("mod_delete_users").notNull().default(false),
  modManageApplications: boolean("mod_manage_applications").notNull().default(false),
  modAccessCommunitySettings: boolean("mod_access_community_settings").notNull().default(false),
  modAccessDesign: boolean("mod_access_design").notNull().default(false),
  modAccessApps: boolean("mod_access_apps").notNull().default(false),
  modAccessDiscordRoles: boolean("mod_access_discord_roles").notNull().default(false),
  modAccessCustomFields: boolean("mod_access_custom_fields").notNull().default(false),
  modAccessPermissions: boolean("mod_access_permissions").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" })
});

export const communitySettings = pgTable("community_settings", {
  id: serial("id").primaryKey(),
  communityName: text("community_name"),
  discordInviteCode: text("discord_invite_code"),
  defaultLocale: text("default_locale").$type<LocaleCode>().notNull().default("en"),
  displayNameTemplate: jsonb("display_name_template").$type<DisplayNameField[]>().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" })
});

// ─── Application Flow Tables ──────────────────────────────────────────────

export const applicationFlows = pgTable("application_flows", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  status: applicationFlowStatusEnum("status").notNull().default("draft"),
  flowJson: jsonb("flow_json").$type<ApplicationFlowGraph>().notNull(),
  draftFlowJson: jsonb("draft_flow_json").$type<ApplicationFlowGraph>(),
  settingsJson: jsonb("settings_json").$type<ApplicationFlowSettings>().notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date())
});

export const applicationFlowEmbeds = pgTable("application_flow_embeds", {
  id: uuid("id").primaryKey().defaultRandom(),
  flowId: uuid("flow_id")
    .notNull()
    .references(() => applicationFlows.id, { onDelete: "cascade" }),
  discordChannelId: text("discord_channel_id").notNull(),
  discordMessageId: text("discord_message_id"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date())
});

export const applicationTokens = pgTable(
  "application_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    flowId: uuid("flow_id")
      .notNull()
      .references(() => applicationFlows.id, { onDelete: "cascade" }),
    discordId: text("discord_id").notNull(),
    discordUsername: text("discord_username").notNull(),
    discordAvatarUrl: text("discord_avatar_url"),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index("application_tokens_flow_id_idx").on(table.flowId),
    index("application_tokens_discord_id_idx").on(table.discordId)
  ]
);

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    flowId: uuid("flow_id")
      .notNull()
      .references(() => applicationFlows.id, { onDelete: "cascade" }),
    discordId: text("discord_id").notNull(),
    discordUsername: text("discord_username").notNull(),
    discordAvatarUrl: text("discord_avatar_url"),
    answersJson: jsonb("answers_json").$type<Record<string, unknown>>().notNull(),
    status: applicationStatusEnum("status").notNull().default("pending"),
    rolesAssigned: jsonb("roles_assigned").$type<string[]>().default([]),
    pendingRoleAssignments: jsonb("pending_role_assignments").$type<string[]>().default([]),
    displayNameComposed: text("display_name_composed"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date())
  },
  (table) => [
    index("applications_flow_id_idx").on(table.flowId),
    index("applications_discord_id_idx").on(table.discordId),
    index("applications_status_idx").on(table.status)
  ]
);

export const applicationFileUploads = pgTable(
  "application_file_uploads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id").references(() => applications.id, { onDelete: "cascade" }),
    discordId: text("discord_id").notNull(),
    flowId: uuid("flow_id")
      .notNull()
      .references(() => applicationFlows.id, { onDelete: "cascade" }),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    storagePath: text("storage_path").notNull(),
    fileSize: integer("file_size").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [index("application_file_uploads_application_id_idx").on(table.applicationId)]
);

export const applicationModeratorNotifications = pgTable(
  "application_moderator_notifications",
  {
    flowId: uuid("flow_id")
      .notNull()
      .references(() => applicationFlows.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(true)
  },
  (table) => [primaryKey({ columns: [table.flowId, table.userId] })]
);

// ─── Community Custom Fields & Tags ──────────────────────────────────────

export const communityCustomFields = pgTable("community_custom_fields", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  description: text("description"),
  inputType: text("input_type").notNull(),
  options: jsonb("options").$type<string[]>(),
  sliderMin: integer("slider_min"),
  sliderMax: integer("slider_max"),
  sliderStep: integer("slider_step"),
  required: boolean("required").notNull().default(false),
  active: boolean("active").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  userCanView: boolean("user_can_view").notNull().default(false),
  userCanEdit: boolean("user_can_edit").notNull().default(false),
  modCanView: boolean("mod_can_view").notNull().default(false),
  modCanEdit: boolean("mod_can_edit").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date())
});

export const communityTags = pgTable("community_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" })
});

export const applicationAccessSettings = pgTable("application_access_settings", {
  id: serial("id").primaryKey(),
  allowModeratorAccess: boolean("allow_moderator_access").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" })
});

// ─── Relations ────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [users.id],
    references: [profiles.userId]
  }),
  permissionRoles: many(userPermissionRoles),
  communityRole: one(userCommunityRoles, {
    fields: [users.id],
    references: [userCommunityRoles.userId]
  }),
  discordRoles: many(userDiscordRoles),
  voiceSessions: many(voiceSessions),
  profileChangeLogs: many(profileChangeLogs),
  createdApps: many(installedApps),
  submittedAppSubmissions: many(appMarketplaceSubmissions, {
    relationName: "app_submission_submitter"
  }),
  reviewedAppSubmissions: many(appMarketplaceSubmissions, {
    relationName: "app_submission_reviewer"
  }),
  updatedCmsAccessSettings: many(cmsAccessSettings),
  createdApplicationFlows: many(applicationFlows),
  reviewedApplications: many(applications, { relationName: "application_reviewer" }),
  applicationModeratorNotifications: many(applicationModeratorNotifications),
  createdCommunityTags: many(communityTags)
}));

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id]
  }),
  changeLogs: many(profileChangeLogs)
}));

export const permissionRolesRelations = relations(permissionRoles, ({ many }) => ({
  userAssignments: many(userPermissionRoles),
  communityRoles: many(communityRoles)
}));

export const communityRolesRelations = relations(communityRoles, ({ one, many }) => ({
  permissionRole: one(permissionRoles, {
    fields: [communityRoles.permissionRoleId],
    references: [permissionRoles.id]
  }),
  userAssignments: many(userCommunityRoles)
}));

export const userPermissionRolesRelations = relations(userPermissionRoles, ({ one }) => ({
  user: one(users, {
    fields: [userPermissionRoles.userId],
    references: [users.id]
  }),
  permissionRole: one(permissionRoles, {
    fields: [userPermissionRoles.permissionRoleId],
    references: [permissionRoles.id]
  })
}));

export const userCommunityRolesRelations = relations(userCommunityRoles, ({ one }) => ({
  user: one(users, {
    fields: [userCommunityRoles.userId],
    references: [users.id]
  }),
  communityRole: one(communityRoles, {
    fields: [userCommunityRoles.communityRoleId],
    references: [communityRoles.id]
  })
}));

export const userDiscordRolesRelations = relations(userDiscordRoles, ({ one }) => ({
  user: one(users, {
    fields: [userDiscordRoles.userId],
    references: [users.id]
  })
}));

export const voiceSessionsRelations = relations(voiceSessions, ({ one }) => ({
  user: one(users, {
    fields: [voiceSessions.userId],
    references: [users.id]
  })
}));

export const profileChangeLogsRelations = relations(profileChangeLogs, ({ one }) => ({
  profile: one(profiles, {
    fields: [profileChangeLogs.profileId],
    references: [profiles.id]
  }),
  changedByUser: one(users, {
    fields: [profileChangeLogs.changedBy],
    references: [users.id]
  })
}));

export const installedAppsRelations = relations(installedApps, ({ one }) => ({
  createdByUser: one(users, {
    fields: [installedApps.createdBy],
    references: [users.id]
  })
}));

export const appMarketplaceSubmissionsRelations = relations(appMarketplaceSubmissions, ({ one }) => ({
  submittedByUser: one(users, {
    fields: [appMarketplaceSubmissions.submittedByUserId],
    references: [users.id],
    relationName: "app_submission_submitter"
  }),
  reviewedByUser: one(users, {
    fields: [appMarketplaceSubmissions.reviewedByUserId],
    references: [users.id],
    relationName: "app_submission_reviewer"
  })
}));

export const themeSettingsRelations = relations(themeSettings, ({ one }) => ({
  updatedByUser: one(users, {
    fields: [themeSettings.updatedBy],
    references: [users.id]
  })
}));

export const cmsAccessSettingsRelations = relations(cmsAccessSettings, ({ one }) => ({
  updatedByUser: one(users, {
    fields: [cmsAccessSettings.updatedBy],
    references: [users.id]
  })
}));

export const communitySettingsRelations = relations(communitySettings, ({ one }) => ({
  updatedByUser: one(users, {
    fields: [communitySettings.updatedBy],
    references: [users.id]
  })
}));

// ─── Community Custom Fields & Tags Relations ────────────────────────────

export const communityTagsRelations = relations(communityTags, ({ one }) => ({
  createdByUser: one(users, {
    fields: [communityTags.createdBy],
    references: [users.id]
  })
}));

// ─── Application Flow Relations ───────────────────────────────────────────

export const applicationFlowsRelations = relations(applicationFlows, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [applicationFlows.createdBy],
    references: [users.id]
  }),
  embeds: many(applicationFlowEmbeds),
  applications: many(applications),
  tokens: many(applicationTokens),
  fileUploads: many(applicationFileUploads),
  moderatorNotifications: many(applicationModeratorNotifications)
}));

export const applicationFlowEmbedsRelations = relations(applicationFlowEmbeds, ({ one }) => ({
  flow: one(applicationFlows, {
    fields: [applicationFlowEmbeds.flowId],
    references: [applicationFlows.id]
  })
}));

export const applicationTokensRelations = relations(applicationTokens, ({ one }) => ({
  flow: one(applicationFlows, {
    fields: [applicationTokens.flowId],
    references: [applicationFlows.id]
  })
}));

export const applicationsRelations = relations(applications, ({ one, many }) => ({
  flow: one(applicationFlows, {
    fields: [applications.flowId],
    references: [applicationFlows.id]
  }),
  reviewedByUser: one(users, {
    fields: [applications.reviewedBy],
    references: [users.id],
    relationName: "application_reviewer"
  }),
  fileUploads: many(applicationFileUploads)
}));

export const applicationFileUploadsRelations = relations(applicationFileUploads, ({ one }) => ({
  application: one(applications, {
    fields: [applicationFileUploads.applicationId],
    references: [applications.id]
  }),
  flow: one(applicationFlows, {
    fields: [applicationFileUploads.flowId],
    references: [applicationFlows.id]
  })
}));

export const applicationModeratorNotificationsRelations = relations(
  applicationModeratorNotifications,
  ({ one }) => ({
    flow: one(applicationFlows, {
      fields: [applicationModeratorNotifications.flowId],
      references: [applicationFlows.id]
    }),
    user: one(users, {
      fields: [applicationModeratorNotifications.userId],
      references: [users.id]
    })
  })
);

export const applicationAccessSettingsRelations = relations(applicationAccessSettings, ({ one }) => ({
  updatedByUser: one(users, {
    fields: [applicationAccessSettings.updatedBy],
    references: [users.id]
  })
}));
