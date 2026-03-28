import { z } from "zod";

const roleListSchema = z.array(z.string().min(1).max(64)).default([]);

export const appManifestPermissionSchema = z.object({
  id: z.string().min(1).max(128),
  label: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  required: z.boolean().default(false)
});

export const appManifestNavigationRailItemSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  to: z.string().min(1).max(255),
  icon: z.string().min(1).max(255),
  order: z.number().int().min(0).default(0),
  requiredRoles: roleListSchema
});

export const appManifestNavigationPanelItemSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  to: z.string().min(1).max(255),
  icon: z.string().min(1).max(255).optional(),
  requiredRoles: roleListSchema
});

export const appManifestNavigationPanelGroupSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(120).optional(),
  railItemId: z.string().min(1).max(80),
  order: z.number().int().min(0).default(0),
  items: z.array(appManifestNavigationPanelItemSchema).default([])
});

export const appManifestNavigationSchema = z
  .object({
    rail: z.array(appManifestNavigationRailItemSchema).default([]),
    panelGroups: z.array(appManifestNavigationPanelGroupSchema).default([]),
    railEntry: z
      .object({
        id: z.string().min(1).max(80),
        label: z.string().min(1).max(120),
        icon: z.string().min(1).max(255),
        requiredRoles: roleListSchema
      })
      .optional(),
    panelEntries: z
      .array(
        z.object({
          id: z.string().min(1).max(80),
          label: z.string().min(1).max(120),
          to: z.string().min(1).max(255),
          icon: z.string().min(1).max(255).optional(),
          group: z.string().min(1).max(120).optional(),
          requiredRoles: roleListSchema
        })
      )
      .default([]),
    mountToCoreArea: z.string().min(1).max(80).optional()
  })
  .default({
    rail: [],
    panelGroups: [],
    panelEntries: []
  });

export const appManifestPageSchema = z.object({
  id: z.string().min(1).max(80),
  path: z.string().min(1).max(255),
  title: z.string().min(1).max(120),
  requiredRoles: roleListSchema,
  /** Relative path to the Vue SFC source file, e.g. "src/pages/index.vue" */
  component: z.string().min(1).max(255).optional()
});

export const appManifestApiRouteSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  path: z.string().min(1).max(255),
  handler: z.string().min(1).max(255),
  requiredRoles: roleListSchema
});

export const appManifestBotHookSchema = z.enum(["onRoleChange", "onMemberJoin", "onVoiceActivity", "onInteraction", "onMessage"]);

export const appManifestBotCommandSchema = z.object({
  name: z.string().regex(/^[-_a-z0-9]{1,32}$/, "Command name must be 1–32 lowercase letters, digits, dashes or underscores."),
  description: z.string().min(1).max(100),
  nameLocalizations: z.record(z.string()).optional(),
  descriptionLocalizations: z.record(z.string()).optional()
});

export const appManifestConfigFieldSchema = z.object({
  key: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  description: z.string().min(1).max(400).optional(),
  type: z.enum(["string", "number", "boolean", "select", "json"]),
  required: z.boolean().default(false),
  defaultValue: z.unknown().optional(),
  options: z.array(z.string()).default([])
});

export const appManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9._-]+$/, "Only lowercase letters, digits, dots, underscores and dashes are allowed."),
  name: z.string().min(1).max(120),
  version: z.string().min(1).max(40),
  author: z.string().min(1).max(120),
  description: z.string().min(1).max(1000),
  homepageUrl: z.string().url().optional(),
  repositoryUrl: z.string().url().optional(),
  license: z.string().max(80).optional(),
  permissions: z.array(appManifestPermissionSchema).default([]),
  navigation: appManifestNavigationSchema,
  pages: z.array(appManifestPageSchema).default([]),
  apiRoutes: z.array(appManifestApiRouteSchema).default([]),
  botHooks: z.array(appManifestBotHookSchema).default([]),
  botCommands: z.array(appManifestBotCommandSchema).default([]),
  configFields: z.array(appManifestConfigFieldSchema).default([]),
  includes: z.array(z.string().min(1).max(255)).max(50).default([]),
  requiredEnv: z.array(z.string().min(1).max(120)).default([]),
  installNotes: z.string().max(5000).optional(),
  migrations: z.array(z.string()).default([]),
  compatibility: z
    .object({
      core: z.object({
        minVersion: z.string().min(1).max(40),
        maxVersion: z.string().min(1).max(40).optional()
      })
    })
    .default({
      core: {
        minVersion: "0.1.0"
      }
    })
});

export type AppManifest = z.infer<typeof appManifestSchema>;
export type GuildoraAppManifest = AppManifest;
export type GuildoraAppRailNavigationItem = z.infer<typeof appManifestNavigationRailItemSchema>;
export type GuildoraAppPanelNavigationGroup = z.infer<typeof appManifestNavigationPanelGroupSchema>;
export type GuildoraAppBotHook = z.infer<typeof appManifestBotHookSchema>;
export type GuildoraAppBotCommand = z.infer<typeof appManifestBotCommandSchema>;

function normalizeManifest(manifest: AppManifest): AppManifest {
  if (manifest.navigation.rail.length === 0 && manifest.navigation.railEntry) {
    manifest.navigation.rail = [
      {
        id: manifest.navigation.railEntry.id,
        label: manifest.navigation.railEntry.label,
        to: manifest.navigation.panelEntries[0]?.to || `/apps/${manifest.id}`,
        icon: manifest.navigation.railEntry.icon,
        order: 999,
        requiredRoles: manifest.navigation.railEntry.requiredRoles
      }
    ];
  }

  if (manifest.navigation.panelGroups.length === 0 && manifest.navigation.panelEntries.length > 0) {
    manifest.navigation.panelGroups = [
      {
        id: "default",
        title: manifest.name,
        railItemId: manifest.navigation.rail[0]?.id || "default",
        order: 0,
        items: manifest.navigation.panelEntries.map((entry) => ({
          id: entry.id,
          label: entry.label,
          to: entry.to,
          icon: entry.icon,
          requiredRoles: entry.requiredRoles
        }))
      }
    ];
  }

  return manifest;
}

export function parseAppManifest(input: unknown) {
  const parsed = appManifestSchema.parse(input);
  return normalizeManifest(parsed);
}

export function safeParseAppManifest(input: unknown) {
  const parsed = appManifestSchema.safeParse(input);
  if (!parsed.success) {
    return parsed;
  }
  return {
    success: true as const,
    data: normalizeManifest(parsed.data)
  };
}
