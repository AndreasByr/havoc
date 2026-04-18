<script setup lang="ts">
import type { DisplayNameField, RoleGroup } from "@guildora/shared";

definePageMeta({
  middleware: ["settings"],
});

type CommunitySettingsResponse = {
  communityName: string | null;
  discordInviteCode: string | null;
  defaultLocale: "en" | "de";
  displayNameTemplate: DisplayNameField[];
};

type GuildRole = {
  id: string;
  name: string;
  position: number;
  managed: boolean;
  editable: boolean;
};

type AdminDiscordRolesResponse = {
  guildRoles: GuildRole[];
  selectableRoleIds: string[];
  isSuperadmin: boolean;
};

const { t } = useI18n();
const lastPath = useCookie<string | null>("guildora_settings_last_path", { sameSite: "lax" });
lastPath.value = "/settings/community";

const { data: communitySettingsData, refresh: refreshCommunitySettings } = await useFetch<CommunitySettingsResponse>(
  "/api/admin/community-settings",
  { key: "admin-community-settings" }
);
const communityNameInput = ref("");
const discordInviteCodeInput = ref("");
const defaultLocaleInput = ref<"en" | "de">("en");
watch(
  () => communitySettingsData.value,
  (value) => {
    communityNameInput.value = value?.communityName ?? "";
    discordInviteCodeInput.value = value?.discordInviteCode ?? "";
    defaultLocaleInput.value = value?.defaultLocale === "de" ? "de" : "en";
  },
  { immediate: true }
);

const savePending = ref(false);
const saveError = ref("");
const saveSuccess = ref("");

const clearMessages = () => {
  saveError.value = "";
  saveSuccess.value = "";
};

const saveCommunitySettings = async () => {
  clearMessages();
  savePending.value = true;
  try {
    await $fetch("/api/admin/community-settings", {
      method: "PUT",
      body: {
        communityName: communityNameInput.value.trim() || null,
        discordInviteCode: discordInviteCodeInput.value.trim() || null,
        defaultLocale: defaultLocaleInput.value
      }
    });
    saveSuccess.value = t("settings.communitySaveSuccess");
    await refreshCommunitySettings();
    await clearNuxtData("internal-branding");
  } catch {
    saveError.value = t("settings.communitySaveError");
  } finally {
    savePending.value = false;
  }
};

// ─── Platform Connections ───────────────────────────────────────────────

type PlatformConnection = {
  id: string;
  platform: "discord" | "matrix";
  enabled: boolean;
  botInternalUrl: string | null;
  status: "connected" | "disconnected" | "error";
  statusMessage: string | null;
  lastHealthCheck: string | null;
  createdAt: string;
  updatedAt: string;
};

const { data: platformsData, refresh: refreshPlatforms } = await useFetch<{ platforms: PlatformConnection[] }>(
  "/api/admin/platforms",
  { key: "admin-platforms" }
);

const connectedPlatforms = computed(() => platformsData.value?.platforms ?? []);

const showPlatformEditDialog = ref(false);
const editingPlatform = ref<PlatformConnection | null>(null);
const platformEditPending = ref(false);
const platformEditError = ref("");
const platformEditSuccess = ref("");

// Discord edit fields
const pEditDiscordBotToken = ref("");
const pEditDiscordClientId = ref("");
const pEditDiscordClientSecret = ref("");
const pEditDiscordGuildId = ref("");
const pEditDiscordBotUrl = ref("");
const pEditDiscordBotInternalToken = ref("");

// Matrix edit fields
const pEditMatrixHomeserverUrl = ref("");
const pEditMatrixAccessToken = ref("");
const pEditMatrixSpaceId = ref("");
const pEditMatrixBotUrl = ref("");
const pEditMatrixBotInternalToken = ref("");

const platformTestPending = ref<string | null>(null);
const platformTestResult = ref<{ id: string; ok: boolean; message?: string } | null>(null);

const platformLabel = (platform: string) => platform === "discord" ? "Discord" : "Matrix";

const statusColor = (status: string) => {
  if (status === "connected") return "text-success";
  if (status === "error") return "text-error";
  return "text-warning";
};

const openPlatformEdit = (connection: PlatformConnection) => {
  platformEditError.value = "";
  platformEditSuccess.value = "";
  editingPlatform.value = connection;
  if (connection.platform === "discord") {
    pEditDiscordBotToken.value = "";
    pEditDiscordClientId.value = "";
    pEditDiscordClientSecret.value = "";
    pEditDiscordGuildId.value = "";
    pEditDiscordBotUrl.value = connection.botInternalUrl ?? "";
    pEditDiscordBotInternalToken.value = "";
  } else {
    pEditMatrixHomeserverUrl.value = "";
    pEditMatrixAccessToken.value = "";
    pEditMatrixSpaceId.value = "";
    pEditMatrixBotUrl.value = connection.botInternalUrl ?? "";
    pEditMatrixBotInternalToken.value = "";
  }
  showPlatformEditDialog.value = true;
};

const submitPlatformEdit = async () => {
  if (!editingPlatform.value) return;
  platformEditPending.value = true;
  platformEditError.value = "";

  try {
    const body: Record<string, unknown> = {};

    if (editingPlatform.value.platform === "discord") {
      if (pEditDiscordBotToken.value || pEditDiscordClientId.value || pEditDiscordClientSecret.value || pEditDiscordGuildId.value) {
        body.credentials = {
          botToken: pEditDiscordBotToken.value,
          clientId: pEditDiscordClientId.value,
          clientSecret: pEditDiscordClientSecret.value,
          guildId: pEditDiscordGuildId.value
        };
      }
      if (pEditDiscordBotUrl.value !== (editingPlatform.value.botInternalUrl ?? "")) {
        body.botInternalUrl = pEditDiscordBotUrl.value || null;
      }
      if (pEditDiscordBotInternalToken.value) {
        body.botInternalToken = pEditDiscordBotInternalToken.value;
      }
    } else {
      if (pEditMatrixHomeserverUrl.value || pEditMatrixAccessToken.value || pEditMatrixSpaceId.value) {
        body.credentials = {
          homeserverUrl: pEditMatrixHomeserverUrl.value,
          accessToken: pEditMatrixAccessToken.value,
          spaceId: pEditMatrixSpaceId.value
        };
      }
      if (pEditMatrixBotUrl.value !== (editingPlatform.value.botInternalUrl ?? "")) {
        body.botInternalUrl = pEditMatrixBotUrl.value || null;
      }
      if (pEditMatrixBotInternalToken.value) {
        body.botInternalToken = pEditMatrixBotInternalToken.value;
      }
    }

    if (Object.keys(body).length === 0) {
      showPlatformEditDialog.value = false;
      return;
    }

    await $fetch(`/api/admin/platforms/${editingPlatform.value.id}`, { method: "PUT", body });
    showPlatformEditDialog.value = false;
    editingPlatform.value = null;
    platformEditSuccess.value = t("settings.platforms.editSuccess");
    await refreshPlatforms();
  } catch (error: unknown) {
    const fetchError = error as { data?: { statusMessage?: string }; message?: string };
    platformEditError.value = fetchError?.data?.statusMessage || fetchError?.message || t("settings.platforms.editError");
  } finally {
    platformEditPending.value = false;
  }
};

const testPlatformConnection = async (connection: PlatformConnection) => {
  platformTestPending.value = connection.id;
  platformTestResult.value = null;
  try {
    const result = await $fetch<{ ok: boolean; status: string; message?: string }>(
      `/api/admin/platforms/${connection.id}/test`,
      { method: "POST" }
    );
    platformTestResult.value = { id: connection.id, ok: result.ok, message: result.message };
    await refreshPlatforms();
  } catch {
    platformTestResult.value = { id: connection.id, ok: false, message: "Request failed." };
  } finally {
    platformTestPending.value = null;
  }
};

// ─── Add Platform ─────────────────────────────────────────────────────

const discordConnection = computed(() => connectedPlatforms.value.find((p) => p.platform === "discord"));
const matrixConnection = computed(() => connectedPlatforms.value.find((p) => p.platform === "matrix"));

const showPlatformAddDialog = ref(false);
const addPlatformType = ref<"discord" | "matrix">("discord");
const platformAddPending = ref(false);
const platformAddError = ref("");

// Add form fields
const pAddDiscordBotToken = ref("");
const pAddDiscordClientId = ref("");
const pAddDiscordClientSecret = ref("");
const pAddDiscordGuildId = ref("");
const pAddDiscordBotUrl = ref("");
const pAddDiscordBotInternalToken = ref("");
const pAddMatrixHomeserverUrl = ref("");
const pAddMatrixAccessToken = ref("");
const pAddMatrixSpaceId = ref("");
const pAddMatrixBotUrl = ref("");
const pAddMatrixBotInternalToken = ref("");

const openPlatformAdd = (platform: "discord" | "matrix") => {
  platformAddError.value = "";
  platformEditSuccess.value = "";
  addPlatformType.value = platform;
  pAddDiscordBotToken.value = "";
  pAddDiscordClientId.value = "";
  pAddDiscordClientSecret.value = "";
  pAddDiscordGuildId.value = "";
  pAddDiscordBotUrl.value = "";
  pAddDiscordBotInternalToken.value = "";
  pAddMatrixHomeserverUrl.value = "";
  pAddMatrixAccessToken.value = "";
  pAddMatrixSpaceId.value = "";
  pAddMatrixBotUrl.value = "";
  pAddMatrixBotInternalToken.value = "";
  showPlatformAddDialog.value = true;
};

const submitPlatformAdd = async () => {
  platformAddPending.value = true;
  platformAddError.value = "";

  try {
    const body: Record<string, unknown> = { platform: addPlatformType.value };

    if (addPlatformType.value === "discord") {
      body.credentials = {
        botToken: pAddDiscordBotToken.value,
        clientId: pAddDiscordClientId.value,
        clientSecret: pAddDiscordClientSecret.value,
        guildId: pAddDiscordGuildId.value
      };
      body.botInternalUrl = pAddDiscordBotUrl.value || undefined;
      body.botInternalToken = pAddDiscordBotInternalToken.value || undefined;
    } else {
      body.credentials = {
        homeserverUrl: pAddMatrixHomeserverUrl.value,
        accessToken: pAddMatrixAccessToken.value,
        spaceId: pAddMatrixSpaceId.value
      };
      body.botInternalUrl = pAddMatrixBotUrl.value || undefined;
      body.botInternalToken = pAddMatrixBotInternalToken.value || undefined;
    }

    await $fetch("/api/admin/platforms", { method: "POST", body });
    showPlatformAddDialog.value = false;
    platformEditSuccess.value = t("settings.platforms.addSuccess");
    await refreshPlatforms();
  } catch (error: unknown) {
    const fetchError = error as { data?: { statusMessage?: string }; message?: string };
    platformAddError.value = fetchError?.data?.statusMessage || fetchError?.message || t("settings.platforms.editError");
  } finally {
    platformAddPending.value = false;
  }
};

// ─── Display Name Template ──────────────────────────────────────────────

const templateFields = ref<DisplayNameField[]>([]);

watch(
  () => communitySettingsData.value?.displayNameTemplate,
  (value) => {
    templateFields.value = (value ?? []).map((f) => ({ ...f }));
  },
  { immediate: true }
);

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[äö ü]/g, (c) => ({ "ä": "ae", "ö": "oe", "ü": "ue" }[c] ?? c))
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}

function addTemplateField() {
  if (templateFields.value.length >= 10) return;
  templateFields.value.push({
    key: "",
    label: "",
    type: "string",
    required: false
  });
}

function removeTemplateField(index: number) {
  templateFields.value.splice(index, 1);
}

function onLabelInput(index: number) {
  const field = templateFields.value[index];
  if (field && !field.key) {
    field.key = slugify(field.label);
  }
}

const templatePreview = computed(() => {
  if (templateFields.value.length === 0) return "";
  return templateFields.value.map((f) => f.label || "…").join(" | ");
});

const templateSavePending = ref(false);
const templateSaveError = ref("");
const templateSaveSuccess = ref("");

const clearTemplateMessages = () => {
  templateSaveError.value = "";
  templateSaveSuccess.value = "";
};

const saveDisplayNameTemplate = async () => {
  clearTemplateMessages();
  const fields = templateFields.value.filter((f) => f.label.trim() && f.key.trim());
  // Auto-generate keys for fields that lost theirs
  for (const field of fields) {
    if (!field.key) field.key = slugify(field.label);
  }
  // Check unique keys
  const keys = fields.map((f) => f.key);
  if (new Set(keys).size !== keys.length) {
    templateSaveError.value = t("settings.displayNameTemplate.duplicateKeys");
    return;
  }

  templateSavePending.value = true;
  try {
    await $fetch("/api/admin/community-settings", {
      method: "PUT",
      body: {
        communityName: communityNameInput.value.trim() || null,
        discordInviteCode: discordInviteCodeInput.value.trim() || null,
        defaultLocale: defaultLocaleInput.value,
        displayNameTemplate: fields
      }
    });
    templateSaveSuccess.value = t("settings.displayNameTemplate.saveSuccess");
    await refreshCommunitySettings();
  } catch {
    templateSaveError.value = t("settings.displayNameTemplate.saveError");
  } finally {
    templateSavePending.value = false;
  }
};

// ─── Discord Roles ──────────────────────────────────────────────────────

const { data: discordRolesData, pending: discordRolesPending, error: discordRolesError, refresh: refreshDiscordRoles } = useFetch<AdminDiscordRolesResponse>("/api/admin/discord-roles");

const selectedRoleIds = ref<string[]>([]);
const rolesSavePending = ref(false);
const rolesSaveError = ref("");
const rolesSaveSuccess = ref("");

const editableRoleIdSet = computed(() => {
  const rows = discordRolesData.value?.guildRoles || [];
  return new Set(rows.filter((role) => role.editable && !role.managed).map((role) => role.id));
});

const selectableRoles = computed(() => (discordRolesData.value?.guildRoles || []).filter((role) => role.editable && !role.managed));
const selectedCount = computed(() => selectedRoleIds.value.filter((roleId) => editableRoleIdSet.value.has(roleId)).length);

watch(
  () => [discordRolesData.value?.selectableRoleIds || [], discordRolesData.value?.guildRoles || []] as const,
  ([selectableIds, guildRoles]) => {
    const roleById = new Map(guildRoles.map((role) => [role.id, role]));
    selectedRoleIds.value = Array.from(
      new Set(
        selectableIds.filter((roleId) => {
          const role = roleById.get(roleId);
          return Boolean(role && role.editable && !role.managed);
        })
      )
    );
  },
  { immediate: true }
);

const clearRolesMessages = () => {
  rolesSaveError.value = "";
  rolesSaveSuccess.value = "";
};

const isRoleSelected = (roleId: string) => selectedRoleIds.value.includes(roleId);

const toggleRoleSelection = (roleId: string) => {
  if (!editableRoleIdSet.value.has(roleId)) return;
  if (isRoleSelected(roleId)) {
    selectedRoleIds.value = selectedRoleIds.value.filter((id) => id !== roleId);
  } else {
    selectedRoleIds.value = [...selectedRoleIds.value, roleId];
  }
};

const saveSelectableRoles = async () => {
  clearRolesMessages();
  rolesSavePending.value = true;
  try {
    const roleIds = selectedRoleIds.value.filter((roleId) => editableRoleIdSet.value.has(roleId));
    const result = await $fetch<{ selectableRoleIds: string[] }>("/api/admin/discord-roles", {
      method: "PUT",
      body: { discordRoleIds: roleIds }
    });
    selectedRoleIds.value = Array.from(new Set(result.selectableRoleIds));
    rolesSaveSuccess.value = t("adminDiscordRoles.saveSuccess");
    await refreshDiscordRoles();
  } catch {
    rolesSaveError.value = t("adminDiscordRoles.saveError");
  } finally {
    rolesSavePending.value = false;
  }
};

// ─── Role Groups ───────────────────────────────────────────────────────

type ChannelItem = { id: string; name: string; type: string; parentId: string | null };

const { data: roleGroupsData, refresh: refreshRoleGroups } = await useFetch<{ groups: RoleGroup[] }>("/api/admin/role-groups");
const { data: channelsData, error: channelsError, refresh: refreshChannels } = useFetch<{ channels: ChannelItem[] }>("/api/admin/discord-channels");

const textChannels = computed(() => (channelsData.value?.channels || []).filter((c) => c.type === "text"));

const roleGroupMessage = ref("");
const roleGroupMessageType = ref<"success" | "error">("success");

const showGroupEditor = ref(false);
const editingGroup = ref<RoleGroup | null>(null);
const groupNameInput = ref("");
const groupDescriptionInput = ref("");
const groupChannelIdInput = ref("");

// Role assignment per group
const groupRoleAssignments = ref<Array<{ discordRoleId: string; roleName: string; emoji: string }>>([]);

function openGroupEditor(group?: RoleGroup) {
  if (group) {
    editingGroup.value = group;
    groupNameInput.value = group.name;
    groupDescriptionInput.value = group.description || "";
    groupChannelIdInput.value = group.embed?.channelId || "";
    groupRoleAssignments.value = group.roles.map((r) => ({
      discordRoleId: r.discordRoleId,
      roleName: r.roleNameSnapshot,
      emoji: r.emoji || ""
    }));
  } else {
    editingGroup.value = null;
    groupNameInput.value = "";
    groupDescriptionInput.value = "";
    groupChannelIdInput.value = "";
    groupRoleAssignments.value = [];
  }
  showGroupEditor.value = true;
}

function closeGroupEditor() {
  showGroupEditor.value = false;
  editingGroup.value = null;
}

// Available selectable roles not yet in this group
const availableRolesForGroup = computed(() => {
  const assignedIds = new Set(groupRoleAssignments.value.map((r) => r.discordRoleId));
  return selectableRoles.value.filter((r) => selectedRoleIds.value.includes(r.id) && !assignedIds.has(r.id));
});

function addRoleToGroup(roleId: string) {
  const role = selectableRoles.value.find((r) => r.id === roleId);
  if (!role) return;
  groupRoleAssignments.value.push({
    discordRoleId: role.id,
    roleName: role.name,
    emoji: ""
  });
}

function removeRoleFromGroup(index: number) {
  groupRoleAssignments.value.splice(index, 1);
}

const groupSavePending = ref(false);

async function saveGroup() {
  groupSavePending.value = true;
  roleGroupMessage.value = "";
  try {
    if (editingGroup.value) {
      await $fetch(`/api/admin/role-groups/${editingGroup.value.id}`, {
        method: "PUT",
        body: {
          name: groupNameInput.value.trim(),
          description: groupDescriptionInput.value.trim() || null
        }
      });
      // Update roles
      await $fetch(`/api/admin/role-groups/${editingGroup.value.id}/roles`, {
        method: "PUT",
        body: {
          roles: groupRoleAssignments.value.map((r, i) => ({
            discordRoleId: r.discordRoleId,
            emoji: r.emoji.trim() || null,
            sortOrder: i
          }))
        }
      });
    } else {
      const result = await $fetch<{ group: { id: string } }>("/api/admin/role-groups", {
        method: "POST",
        body: {
          name: groupNameInput.value.trim(),
          description: groupDescriptionInput.value.trim() || null
        }
      });
      // Assign roles to new group
      if (groupRoleAssignments.value.length > 0) {
        await $fetch(`/api/admin/role-groups/${result.group.id}/roles`, {
          method: "PUT",
          body: {
            roles: groupRoleAssignments.value.map((r, i) => ({
              discordRoleId: r.discordRoleId,
              emoji: r.emoji.trim() || null,
              sortOrder: i
            }))
          }
        });
      }
    }
    roleGroupMessage.value = t("roleGroups.saveSuccess");
    roleGroupMessageType.value = "success";
    closeGroupEditor();
    await refreshRoleGroups();
  } catch {
    roleGroupMessage.value = t("roleGroups.saveError");
    roleGroupMessageType.value = "error";
  } finally {
    groupSavePending.value = false;
  }
}

async function deleteGroup(group: RoleGroup) {
  if (!confirm(t("roleGroups.deleteConfirm"))) return;
  roleGroupMessage.value = "";
  try {
    await $fetch(`/api/admin/role-groups/${group.id}`, { method: "DELETE" });
    roleGroupMessage.value = t("roleGroups.deleteSuccess");
    roleGroupMessageType.value = "success";
    await refreshRoleGroups();
  } catch {
    roleGroupMessage.value = t("roleGroups.deleteError");
    roleGroupMessageType.value = "error";
  }
}

const deployPending = ref<string | null>(null);

async function deployEmbed(group: RoleGroup) {
  if (!groupChannelIdInput.value && !group.embed?.channelId) return;
  deployPending.value = group.id;
  roleGroupMessage.value = "";
  try {
    const channelId = group.embed?.channelId || "";
    if (!channelId) {
      roleGroupMessage.value = t("roleGroups.deployError");
      roleGroupMessageType.value = "error";
      return;
    }
    await $fetch(`/api/admin/role-groups/${group.id}/embed/deploy`, {
      method: "POST",
      body: { channelId }
    });
    roleGroupMessage.value = t("roleGroups.deploySuccess");
    roleGroupMessageType.value = "success";
    await refreshRoleGroups();
  } catch {
    roleGroupMessage.value = t("roleGroups.deployError");
    roleGroupMessageType.value = "error";
  } finally {
    deployPending.value = null;
  }
}

async function deployEmbedFromEditor() {
  if (!groupChannelIdInput.value || !editingGroup.value) return;
  const groupId = editingGroup.value.id;
  const channelId = groupChannelIdInput.value;
  deployPending.value = groupId;
  roleGroupMessage.value = "";
  try {
    // Save first (this closes the editor and nulls editingGroup)
    await saveGroup();
    // Then deploy using captured values
    await $fetch(`/api/admin/role-groups/${groupId}/embed/deploy`, {
      method: "POST",
      body: { channelId }
    });
    roleGroupMessage.value = t("roleGroups.deploySuccess");
    roleGroupMessageType.value = "success";
    await refreshRoleGroups();
  } catch {
    roleGroupMessage.value = t("roleGroups.deployError");
    roleGroupMessageType.value = "error";
  } finally {
    deployPending.value = null;
  }
}

async function removeEmbed(group: RoleGroup) {
  roleGroupMessage.value = "";
  try {
    await $fetch(`/api/admin/role-groups/${group.id}/embed`, { method: "DELETE" });
    roleGroupMessage.value = t("roleGroups.removeEmbedSuccess");
    roleGroupMessageType.value = "success";
    await refreshRoleGroups();
  } catch {
    roleGroupMessage.value = t("roleGroups.removeEmbedError");
    roleGroupMessageType.value = "error";
  }
}
</script>

<template>
  <section class="space-y-6">
    <header class="space-y-2">
      <h1 class="text-2xl font-bold md:text-3xl">{{ $t("settings.communityTitle") }}</h1>
      <p class="opacity-80">{{ $t("settings.communityDescription") }}</p>
    </header>

    <div class="rounded-2xl bg-base-200 p-6 shadow-md">
      <div class="space-y-4">
        <div class="flex flex-wrap items-start gap-x-4 gap-y-6 md:items-end">
          <UiInput
            v-model="communityNameInput"
            class="w-full max-w-xl"
            :label="$t('settings.communityNameLabel')"
            :placeholder="$t('settings.communityNamePlaceholder')"
          />
          <UiInput
            v-model="discordInviteCodeInput"
            class="w-full max-w-xs"
            :label="$t('settings.discordInviteCodeLabel')"
            :placeholder="$t('settings.discordInviteCodePlaceholder')"
          />
          <UiSelect
            v-model="defaultLocaleInput"
            class="w-full max-w-xs"
            :label="$t('settings.defaultLocaleLabel')"
          >
            <option value="en">{{ $t("language.english") }}</option>
            <option value="de">{{ $t("language.german") }}</option>
          </UiSelect>
        </div>
        <p class="text-sm opacity-60">{{ $t("settings.discordInviteCodeDescription") }}</p>

        <div class="flex items-center gap-4">
          <UiButton
            :disabled="savePending"
            @click="saveCommunitySettings"
          >
            {{ savePending ? $t("common.loading") : $t("common.save") }}
          </UiButton>
        </div>

        <div v-if="saveError" class="alert alert-error">{{ saveError }}</div>
        <div v-if="saveSuccess" class="alert alert-success">{{ saveSuccess }}</div>
      </div>
    </div>

    <!-- Platform Connections -->
    <div class="mt-8 pt-6 border-t border-line">
      <h2 class="text-xl font-bold mb-2">{{ $t("settings.platforms.title") }}</h2>
      <p class="text-sm opacity-70 mb-4">{{ $t("settings.platforms.description") }}</p>
    </div>

    <div class="space-y-4">
      <div
        v-for="connection in connectedPlatforms"
        :key="connection.id"
        class="rounded-2xl bg-base-200 p-5 shadow-md space-y-3"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <Icon :name="connection.platform === 'discord' ? 'simple-icons:discord' : 'simple-icons:matrix'" class="text-2xl" />
            <div>
              <h3 class="font-semibold text-lg">{{ platformLabel(connection.platform) }}</h3>
              <span :class="statusColor(connection.status)" class="text-sm flex items-center gap-1">
                {{ connection.status === "connected" ? "●" : connection.status === "error" ? "✕" : "○" }}
                {{ connection.status }}
                <span v-if="connection.statusMessage" class="opacity-60">— {{ connection.statusMessage }}</span>
              </span>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <UiButton size="sm" variant="ghost" @click="openPlatformEdit(connection)">
              {{ $t("settings.platforms.edit") }}
            </UiButton>
            <UiButton
              size="sm"
              variant="ghost"
              :disabled="platformTestPending === connection.id"
              @click="testPlatformConnection(connection)"
            >
              {{ $t("settings.platforms.testConnection") }}
            </UiButton>
          </div>
        </div>

        <div
          v-if="platformTestResult?.id === connection.id"
          :class="platformTestResult.ok ? 'bg-success/10 text-success' : 'bg-error/10 text-error'"
          class="text-sm rounded-xl px-4 py-2"
        >
          {{ platformTestResult.ok ? $t("settings.platforms.testSuccess") : platformTestResult.message }}
        </div>

        <ClientOnly>
          <div class="text-xs opacity-40">
            {{ $t("settings.platforms.connectedSince") }}: {{ new Date(connection.createdAt).toLocaleDateString() }}
            <span v-if="connection.lastHealthCheck">
              · {{ $t("settings.platforms.lastCheck") }}: {{ new Date(connection.lastHealthCheck).toLocaleString() }}
            </span>
          </div>
        </ClientOnly>
      </div>

      <div v-if="connectedPlatforms.length === 0" class="rounded-2xl bg-base-200 p-6 shadow-md">
        <p class="text-sm opacity-60">{{ $t("settings.platforms.noPlatforms") }}</p>
      </div>

      <!-- Add Platform Buttons -->
      <div v-if="!discordConnection || !matrixConnection" class="flex gap-3">
        <UiButton
          v-if="!discordConnection"
          variant="outline"
          @click="openPlatformAdd('discord')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
          </svg>
          {{ $t("settings.platforms.addDiscord") }}
        </UiButton>
        <UiButton
          v-if="!matrixConnection"
          variant="outline"
          @click="openPlatformAdd('matrix')"
        >
          <Icon name="simple-icons:matrix" class="mr-2 h-4 w-4" />
          {{ $t("settings.platforms.addMatrix") }}
        </UiButton>
      </div>

      <div v-if="platformEditSuccess" class="alert alert-success">{{ platformEditSuccess }}</div>
    </div>

    <!-- Platform Edit Dialog -->
    <Teleport to="body">
      <div v-if="showPlatformEditDialog && editingPlatform" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="showPlatformEditDialog = false">
        <div class="bg-base-100 rounded-2xl p-6 w-full max-w-lg space-y-5 shadow-xl max-h-[90vh] overflow-y-auto">
          <UiModalTitle :title="$t('settings.platforms.editTitle', { platform: platformLabel(editingPlatform.platform) })" @close="showPlatformEditDialog = false" />

          <div class="rounded-xl bg-info/10 px-4 py-3 text-sm text-info">
            {{ $t("settings.platforms.editHint") }}
          </div>

          <!-- Discord Edit -->
          <template v-if="editingPlatform.platform === 'discord'">
            <UiInput v-model="pEditDiscordClientId" :label="$t('settings.platforms.discord.clientId')" :placeholder="$t('settings.platforms.editPlaceholder')" />
            <UiInput v-model="pEditDiscordClientSecret" :label="$t('settings.platforms.discord.clientSecret')" type="password" :placeholder="$t('settings.platforms.editPlaceholder')" />
            <UiInput v-model="pEditDiscordBotToken" :label="$t('settings.platforms.discord.botToken')" type="password" :placeholder="$t('settings.platforms.editPlaceholder')" />
            <UiInput v-model="pEditDiscordGuildId" :label="$t('settings.platforms.discord.guildId')" :placeholder="$t('settings.platforms.editPlaceholder')" />
            <div class="border-t border-base-content/10 pt-4 space-y-4">
              <UiInput v-model="pEditDiscordBotUrl" :label="$t('settings.platforms.botUrl')" placeholder="http://bot:3050" />
              <UiInput v-model="pEditDiscordBotInternalToken" :label="$t('settings.platforms.botToken')" type="password" :placeholder="$t('settings.platforms.editPlaceholder')" />
            </div>
          </template>

          <!-- Matrix Edit -->
          <template v-if="editingPlatform.platform === 'matrix'">
            <UiInput v-model="pEditMatrixHomeserverUrl" :label="$t('settings.platforms.matrix.homeserverUrl')" :placeholder="$t('settings.platforms.editPlaceholder')" />
            <UiInput v-model="pEditMatrixAccessToken" :label="$t('settings.platforms.matrix.accessToken')" type="password" :placeholder="$t('settings.platforms.editPlaceholder')" />
            <UiInput v-model="pEditMatrixSpaceId" :label="$t('settings.platforms.matrix.spaceId')" :placeholder="$t('settings.platforms.editPlaceholder')" />
            <div class="border-t border-base-content/10 pt-4 space-y-4">
              <UiInput v-model="pEditMatrixBotUrl" :label="$t('settings.platforms.botUrl')" />
              <UiInput v-model="pEditMatrixBotInternalToken" :label="$t('settings.platforms.botToken')" type="password" :placeholder="$t('settings.platforms.editPlaceholder')" />
            </div>
          </template>

          <div v-if="platformEditError" class="bg-error/10 text-error text-sm rounded-xl px-4 py-2">
            {{ platformEditError }}
          </div>

          <div class="flex gap-3 justify-end">
            <UiButton variant="ghost" @click="showPlatformEditDialog = false">{{ $t("common.cancel") }}</UiButton>
            <UiButton :disabled="platformEditPending" @click="submitPlatformEdit">
              {{ platformEditPending ? $t("common.loading") : $t("common.save") }}
            </UiButton>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Add Platform Dialog -->
    <Teleport to="body">
      <div v-if="showPlatformAddDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="showPlatformAddDialog = false">
        <div class="bg-base-100 rounded-2xl p-6 w-full max-w-lg space-y-5 shadow-xl max-h-[90vh] overflow-y-auto">
          <UiModalTitle :title="addPlatformType === 'discord' ? $t('settings.platforms.setupDiscord') : $t('settings.platforms.setupMatrix')" @close="showPlatformAddDialog = false" />

          <!-- Discord Add -->
          <template v-if="addPlatformType === 'discord'">
            <UiInput v-model="pAddDiscordClientId" :label="$t('settings.platforms.discord.clientId')" />
            <UiInput v-model="pAddDiscordClientSecret" :label="$t('settings.platforms.discord.clientSecret')" type="password" />
            <UiInput v-model="pAddDiscordBotToken" :label="$t('settings.platforms.discord.botToken')" type="password" />
            <UiInput v-model="pAddDiscordGuildId" :label="$t('settings.platforms.discord.guildId')" />
            <div class="border-t border-base-content/10 pt-4 space-y-4">
              <p class="text-xs font-medium opacity-50">{{ $t("setup.platform.botConnectionOptional") }}</p>
              <UiInput v-model="pAddDiscordBotUrl" :label="$t('settings.platforms.botUrl')" placeholder="http://bot:3050" />
              <UiInput v-model="pAddDiscordBotInternalToken" :label="$t('settings.platforms.botToken')" type="password" />
            </div>
          </template>

          <!-- Matrix Add -->
          <template v-if="addPlatformType === 'matrix'">
            <UiInput v-model="pAddMatrixHomeserverUrl" :label="$t('settings.platforms.matrix.homeserverUrl')" placeholder="https://matrix.example.org" />
            <UiInput v-model="pAddMatrixAccessToken" :label="$t('settings.platforms.matrix.accessToken')" type="password" />
            <UiInput v-model="pAddMatrixSpaceId" :label="$t('settings.platforms.matrix.spaceId')" placeholder="!abc:matrix.example.org" />
            <div class="border-t border-base-content/10 pt-4 space-y-4">
              <p class="text-xs font-medium opacity-50">{{ $t("setup.platform.botConnectionOptional") }}</p>
              <UiInput v-model="pAddMatrixBotUrl" :label="$t('settings.platforms.botUrl')" />
              <UiInput v-model="pAddMatrixBotInternalToken" :label="$t('settings.platforms.botToken')" type="password" />
            </div>
          </template>

          <div v-if="platformAddError" class="bg-error/10 text-error text-sm rounded-xl px-4 py-2">
            {{ platformAddError }}
          </div>

          <div class="flex gap-3 justify-end">
            <UiButton variant="ghost" @click="showPlatformAddDialog = false">{{ $t("common.cancel") }}</UiButton>
            <UiButton :disabled="platformAddPending" @click="submitPlatformAdd">
              {{ platformAddPending ? $t("common.loading") : $t("settings.platforms.connect") }}
            </UiButton>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Display Name Template -->
    <div class="mt-8 pt-6 border-t border-line">
      <h2 class="text-xl font-bold mb-2">{{ $t("settings.displayNameTemplate.title") }}</h2>
      <p class="text-sm opacity-70 mb-4">{{ $t("settings.displayNameTemplate.description") }}</p>
    </div>

    <div class="rounded-2xl bg-base-200 p-6 shadow-md">
      <div class="space-y-4">
        <div v-for="(field, index) in templateFields" :key="index" class="flex flex-wrap items-end gap-3 rounded-xl bg-base-300 p-4">
          <UiInput
            v-model="field.label"
            class="w-full max-w-xs"
            :label="$t('settings.displayNameTemplate.fieldLabel')"
            :placeholder="$t('settings.displayNameTemplate.fieldLabelPlaceholder')"
            @blur="onLabelInput(index)"
          />
          <UiInput
            v-model="field.key"
            class="w-full max-w-[10rem]"
            :label="$t('settings.displayNameTemplate.fieldKey')"
            placeholder="z_b_rufname"
          />
          <UiSelect
            v-model="field.type"
            class="w-full max-w-[8rem]"
            :label="$t('settings.displayNameTemplate.fieldType')"
          >
            <option value="string">{{ $t("settings.displayNameTemplate.typeString") }}</option>
            <option value="number">{{ $t("settings.displayNameTemplate.typeNumber") }}</option>
          </UiSelect>
          <label class="flex items-center gap-2 cursor-pointer pb-1">
            <input
              v-model="field.required"
              type="checkbox"
              class="toggle toggle-sm"
            >
            <span class="text-sm">{{ $t("settings.displayNameTemplate.fieldRequired") }}</span>
          </label>
          <button
            class="btn btn-ghost btn-sm text-error"
            type="button"
            @click="removeTemplateField(index)"
          >
            <Icon name="proicons:cancel" />
          </button>
        </div>

        <div class="flex items-center gap-4">
          <UiButton
            :disabled="templateFields.length >= 10"
            variant="secondary"
            @click="addTemplateField"
          >
            {{ $t("settings.displayNameTemplate.addField") }}
          </UiButton>
          <span v-if="templateFields.length >= 10" class="text-xs opacity-60">
            {{ $t("settings.displayNameTemplate.maxFields") }}
          </span>
        </div>

        <div v-if="templatePreview" class="text-sm">
          <span class="opacity-60">{{ $t("settings.displayNameTemplate.preview") }}</span>
          <span class="font-medium">{{ templatePreview }}</span>
        </div>

        <div class="flex items-center gap-4">
          <UiButton
            :disabled="templateSavePending"
            @click="saveDisplayNameTemplate"
          >
            {{ templateSavePending ? $t("common.loading") : $t("settings.displayNameTemplate.save") }}
          </UiButton>
        </div>

        <div v-if="templateSaveError" class="alert alert-error">{{ templateSaveError }}</div>
        <div v-if="templateSaveSuccess" class="alert alert-success">{{ templateSaveSuccess }}</div>
      </div>
    </div>

    <!-- Discord Roles -->
    <div class="mt-8 pt-6 border-t border-line">
      <h2 class="text-xl font-bold mb-2">{{ $t("adminDiscordRoles.selectableTitle") }}</h2>
      <p class="text-sm opacity-70 mb-4">{{ $t("adminDiscordRoles.helperText") }}</p>
    </div>

    <div class="rounded-2xl bg-base-200 p-6 shadow-md">
      <div class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="badge badge-outline">{{ t("adminDiscordRoles.selectedCount", { count: selectedCount }) }}</span>
          <div class="flex flex-wrap gap-2 ms-auto">
            <UiButton variant="secondary" :disabled="discordRolesPending" @click="refreshDiscordRoles">
              {{ $t("adminDiscordRoles.refresh") }}
            </UiButton>
            <UiButton :disabled="discordRolesPending || rolesSavePending" @click="saveSelectableRoles">
              {{ rolesSavePending ? $t("common.loading") : $t("common.save") }}
            </UiButton>
          </div>
        </div>

        <div v-if="discordRolesPending" class="loading loading-spinner loading-md" />
        <div v-else-if="discordRolesError" class="alert alert-warning">
          <span>{{ $t("adminDiscordRoles.botUnavailable") }}</span>
          <UiButton variant="secondary" size="sm" @click="refreshDiscordRoles">{{ $t("common.retry") }}</UiButton>
        </div>
        <div v-else-if="selectableRoles.length === 0" class="alert alert-info">{{ $t("adminDiscordRoles.empty") }}</div>
        <div v-else class="flex flex-wrap gap-2">
          <button
            v-for="role in selectableRoles"
            :key="role.id"
            class="btn justify-start"
            :class="isRoleSelected(role.id) ? 'btn-primary' : 'btn-secondary'"
            type="button"
            :aria-pressed="isRoleSelected(role.id)"
            @click="toggleRoleSelection(role.id)"
          >
            {{ role.name }}
          </button>
        </div>

        <div v-if="rolesSaveError" class="alert alert-error">{{ rolesSaveError }}</div>
        <div v-if="rolesSaveSuccess" class="alert alert-success">{{ rolesSaveSuccess }}</div>
      </div>
    </div>

    <!-- Role Groups -->
    <div class="mt-8 pt-6 border-t border-line">
      <h2 class="text-xl font-bold mb-2">{{ $t("roleGroups.title") }}</h2>
      <p class="text-sm opacity-70 mb-4">{{ $t("roleGroups.description") }}</p>
    </div>

    <div v-if="roleGroupMessage" :class="['alert', roleGroupMessageType === 'success' ? 'alert-success' : 'alert-error']">
      {{ roleGroupMessage }}
    </div>

    <!-- Group List -->
    <div class="space-y-4">
      <div v-if="!roleGroupsData?.groups?.length && !showGroupEditor" class="rounded-2xl bg-base-200 p-6 shadow-md">
        <p class="opacity-60">{{ $t("roleGroups.noGroups") }}</p>
      </div>

      <div
        v-for="group in roleGroupsData?.groups || []"
        :key="group.id"
        class="rounded-2xl bg-base-200 p-6 shadow-md"
      >
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 class="text-lg font-semibold">{{ group.name }}</h3>
            <p v-if="group.description" class="text-sm opacity-70 mt-1">{{ group.description }}</p>
            <div class="flex flex-wrap gap-2 mt-3">
              <span
                v-for="role in group.roles"
                :key="role.discordRoleId"
                class="badge badge-outline gap-1"
              >
                <span v-if="role.emoji">{{ role.emoji }}</span>
                {{ role.roleNameSnapshot }}
              </span>
              <span v-if="group.roles.length === 0" class="text-sm opacity-50">
                {{ $t("roleGroups.noRolesAssigned") }}
              </span>
            </div>
            <div class="mt-2">
              <span
                class="badge badge-sm"
                :class="group.embed?.messageId ? 'badge-success' : 'badge-neutral'"
              >
                {{ group.embed?.messageId ? $t("roleGroups.embedDeployed") : $t("roleGroups.embedNotDeployed") }}
              </span>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <UiButton
              v-if="group.embed?.messageId && group.embed?.channelId"
              variant="secondary"
              size="sm"
              :disabled="deployPending === group.id"
              @click="deployEmbed(group)"
            >
              {{ $t("roleGroups.updateEmbed") }}
            </UiButton>
            <UiButton
              v-if="group.embed?.messageId"
              variant="errorOutline"
              size="sm"
              @click="removeEmbed(group)"
            >
              {{ $t("roleGroups.removeEmbed") }}
            </UiButton>
            <UiButton variant="secondary" size="sm" @click="openGroupEditor(group)">
              {{ $t("roleGroups.editGroup") }}
            </UiButton>
            <UiButton variant="errorOutline" size="sm" @click="deleteGroup(group)">
              {{ $t("roleGroups.deleteGroup") }}
            </UiButton>
          </div>
        </div>
      </div>

      <UiButton variant="secondary" @click="openGroupEditor()">
        {{ $t("roleGroups.createGroup") }}
      </UiButton>
    </div>

    <!-- Group Editor Modal -->
    <dialog
      class="modal"
      :class="{ 'modal-open': showGroupEditor }"
      :open="showGroupEditor"
      @click.self="closeGroupEditor"
    >
      <div class="modal-box max-w-2xl">
        <UiModalTitle :title="editingGroup ? $t('roleGroups.editGroup') : $t('roleGroups.createGroup')" @close="closeGroupEditor" />

        <div class="space-y-4 mt-4">
          <UiInput
            v-model="groupNameInput"
            :label="$t('roleGroups.groupName')"
            :placeholder="$t('roleGroups.groupNamePlaceholder')"
          />
          <UiInput
            v-model="groupDescriptionInput"
            :label="$t('roleGroups.groupDescription')"
            :placeholder="$t('roleGroups.groupDescriptionPlaceholder')"
          />

          <!-- Role Assignment -->
          <div>
            <label class="label font-semibold">{{ $t("roleGroups.assignRoles") }}</label>
            <div class="space-y-2 mt-2">
              <div
                v-for="(assignment, index) in groupRoleAssignments"
                :key="assignment.discordRoleId"
                class="flex items-center gap-2 rounded-xl bg-base-300 p-3"
              >
                <span class="font-medium flex-1">{{ assignment.roleName }}</span>
                <input
                  v-model="assignment.emoji"
                  type="text"
                  class="input input-sm w-16 text-center"
                  :placeholder="$t('roleGroups.emojiPlaceholder')"
                  maxlength="4"
                >
                <button class="btn btn-ghost btn-sm text-error" type="button" @click="removeRoleFromGroup(index)">
                  <Icon name="proicons:cancel" />
                </button>
              </div>
            </div>
            <div v-if="availableRolesForGroup.length > 0" class="mt-3">
              <select
                class="select select-sm"
                @change="(e: Event) => { const val = (e.target as HTMLSelectElement).value; if (val) { addRoleToGroup(val); (e.target as HTMLSelectElement).value = ''; } }"
              >
                <option value="">+ Add role...</option>
                <option v-for="role in availableRolesForGroup" :key="role.id" :value="role.id">
                  {{ role.name }}
                </option>
              </select>
            </div>
          </div>

          <!-- Channel for Embed -->
          <div v-if="editingGroup">
            <div v-if="channelsError" class="alert alert-warning text-sm">
              <span>{{ $t("roleGroups.channelsLoadError") }}</span>
              <UiButton variant="secondary" size="sm" @click="refreshChannels">{{ $t("common.retry") }}</UiButton>
            </div>
            <UiSelect v-else v-model="groupChannelIdInput" :label="$t('roleGroups.selectChannel')">
              <option value="">—</option>
              <option v-for="ch in textChannels" :key="ch.id" :value="ch.id">
                #{{ ch.name }}
              </option>
            </UiSelect>
          </div>

          <!-- Actions -->
          <div class="flex flex-wrap gap-2 mt-4">
            <UiButton :disabled="groupSavePending || !groupNameInput.trim()" @click="saveGroup">
              {{ groupSavePending ? $t("common.loading") : $t("common.save") }}
            </UiButton>
            <UiButton
              v-if="editingGroup && groupChannelIdInput"
              variant="secondary"
              :disabled="deployPending === editingGroup?.id"
              @click="deployEmbedFromEditor"
            >
              {{ editingGroup?.embed?.messageId ? $t("roleGroups.updateEmbed") : $t("roleGroups.deployEmbed") }}
            </UiButton>
            <UiButton variant="ghost" @click="closeGroupEditor">
              {{ $t("common.cancel") }}
            </UiButton>
          </div>
        </div>
      </div>
    </dialog>
  </section>
</template>
