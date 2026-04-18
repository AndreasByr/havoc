<script setup lang="ts">
definePageMeta({
  middleware: ["settings"],
});

const { t } = useI18n();

const lastPath = useCookie<string | null>("guildora_settings_last_path", { sameSite: "lax" });
lastPath.value = "/settings/permissions";

type PermissionRole = {
  id: number;
  name: string;
  level: number;
};

type CommunityRole = {
  id: number;
  name: string;
  description: string | null;
  permissionRoleName: string;
  sortOrder: number;
  discordRoleId: string | null;
  assignedUsers: number;
};

type DiscordRole = {
  id: string;
  name: string;
  position: number;
  managed: boolean;
  editable: boolean;
};

type AdminUser = {
  id: string;
  discordId: string;
  profileName: string;
  permissionRoles: string[];
  communityRole: string | null;
};

type ImportReport = {
  created: Array<{ userId: string; discordId: string; profileName: string }>;
  updated: Array<{ userId: string; discordId: string; profileName: string }>;
  conflicts: Array<{ discordId: string; profileName: string; communityRoleIds: number[] }>;
  orphanedCandidates: Array<{
    userId: string;
    discordId: string;
    profileName: string;
    communityRole: string | null;
    permissionRoles: string[];
  }>;
};

const actionError = ref("");
const actionSuccess = ref("");
const importResult = ref<ImportReport | null>(null);
const orphanSelection = ref<string[]>([]);
const removeAllDiscordRoles = ref(false);
const selectedUserId = ref("");
const selectedBulkRoleId = ref<number | null>(null);
const busy = reactive({
  savingRole: false,

  deletingRole: false,
  importing: false,
  deletingOrphans: false,
  deletingUser: false,
  deletingByRole: false
});

const newRoleForm = reactive({
  name: "",
  description: "",
  permissionRoleName: "user",
  sortOrder: 0,
  discordRoleId: ""
});

const roleEditRows = ref<Array<{
  id: number;
  name: string;
  description: string;
  permissionRoleName: string;
  sortOrder: number;
  discordRoleId: string;
  assignedUsers: number;
}>>([]);

const openRoleId = ref<number | null>(null);
const deleteRoleConfirm = reactive<{
  open: boolean;
  rowId: number | null;
}>({
  open: false,
  rowId: null
});

const { data: permissionData, pending: permissionPending, refresh: refreshPermissions } = await useFetch<{
  communityRoles: CommunityRole[];
  permissionRoles: PermissionRole[];
  hasActiveMappings: boolean;
}>("/api/admin/permissions");

const { data: discordRolesData, pending: discordRolesPending, refresh: refreshDiscordRoles } = await useFetch<{
  roles: DiscordRole[];
}>("/api/admin/discord/roles");

const { data: usersData, pending: usersPending, refresh: refreshUsers } = await useFetch<AdminUser[]>("/api/admin/users");

watch(
  () => permissionData.value?.communityRoles,
  (roles) => {
    roleEditRows.value = (roles || []).map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description || "",
      permissionRoleName: role.permissionRoleName,
      sortOrder: role.sortOrder,
      discordRoleId: role.discordRoleId || "",
      assignedUsers: role.assignedUsers
    }));
    const ids = roleEditRows.value.map((r) => r.id);
    if (openRoleId.value !== null && !ids.includes(openRoleId.value)) {
      openRoleId.value = null;
    }
    if (deleteRoleConfirm.rowId !== null && !ids.includes(deleteRoleConfirm.rowId)) {
      deleteRoleConfirm.open = false;
      deleteRoleConfirm.rowId = null;
    }
  },
  { immediate: true }
);

const usedDiscordRoleIds = computed(() => {
  return new Set(roleEditRows.value.map((r) => r.discordRoleId).filter(Boolean));
});

const availableDiscordRolesForCreate = computed(() => {
  return (discordRolesData.value?.roles || []).filter((r) => !usedDiscordRoleIds.value.has(r.id));
});

const availableDiscordRolesForEdit = (currentDiscordRoleId: string) => {
  return (discordRolesData.value?.roles || []).filter(
    (r) => r.id === currentDiscordRoleId || !usedDiscordRoleIds.value.has(r.id)
  );
};

const resetMessage = () => {
  actionError.value = "";
  actionSuccess.value = "";
};

const refreshAll = async () => {
  await Promise.all([refreshPermissions(), refreshDiscordRoles(), refreshUsers()]);
};

const createCommunityRole = async () => {
  resetMessage();
  busy.savingRole = true;
  try {
    await $fetch("/api/admin/community-roles", {
      method: "POST",
      body: {
        name: newRoleForm.name.trim(),
        description: newRoleForm.description.trim() || null,
        permissionRoleName: newRoleForm.permissionRoleName,
        sortOrder: Number(newRoleForm.sortOrder) || 0,
        discordRoleId: newRoleForm.discordRoleId.trim() || null
      }
    });
    newRoleForm.name = "";
    newRoleForm.description = "";
    newRoleForm.permissionRoleName = "user";
    newRoleForm.sortOrder = 0;
    newRoleForm.discordRoleId = "";
    await refreshPermissions();
    actionSuccess.value = t("adminPermissions.messages.roleCreated");
  } catch (error) {
    console.error(error);
    actionError.value = t("adminPermissions.errors.roleCreate");
  } finally {
    busy.savingRole = false;
  }
};

const saveCommunityRole = async (rowId: number) => {
  const row = roleEditRows.value.find((entry) => entry.id === rowId);
  if (!row) {
    return;
  }
  resetMessage();
  busy.savingRole = true;
  try {
    await $fetch(`/api/admin/community-roles/${row.id}`, {
      method: "PUT",
      body: {
        name: row.name.trim(),
        description: row.description.trim() || null,
        permissionRoleName: row.permissionRoleName,
        sortOrder: Number(row.sortOrder) || 0,
        discordRoleId: row.discordRoleId.trim() || null
      }
    });
    await refreshPermissions();
    actionSuccess.value = t("adminPermissions.messages.roleSaved");
  } catch (error) {
    console.error(error);
    actionError.value = t("adminPermissions.errors.roleSave");
  } finally {
    busy.savingRole = false;
  }
};

const deleteCommunityRole = async (rowId: number) => {
  resetMessage();
  busy.deletingRole = true;
  try {
    await $fetch(`/api/admin/community-roles/${rowId}`, { method: "DELETE" });
    await refreshPermissions();
    actionSuccess.value = t("adminPermissions.messages.roleDeleted");
    return true;
  } catch (error) {
    console.error(error);
    actionError.value = t("adminPermissions.errors.roleDelete");
    return false;
  } finally {
    busy.deletingRole = false;
  }
};

const toggleRoleAccordion = (rowId: number) => {
  openRoleId.value = openRoleId.value === rowId ? null : rowId;
};

const openDeleteRoleConfirm = (rowId: number) => {
  deleteRoleConfirm.open = true;
  deleteRoleConfirm.rowId = rowId;
};

const closeDeleteRoleConfirm = () => {
  if (busy.deletingRole) {
    return;
  }
  deleteRoleConfirm.open = false;
  deleteRoleConfirm.rowId = null;
};

const confirmDeleteRole = async () => {
  if (deleteRoleConfirm.rowId === null) {
    return;
  }
  const didDelete = await deleteCommunityRole(deleteRoleConfirm.rowId);
  if (didDelete) {
    closeDeleteRoleConfirm();
  }
};

const runGlobalImport = async () => {
  resetMessage();
  busy.importing = true;
  try {
    const result = await $fetch<ImportReport>("/api/admin/users/import", { method: "POST" });
    importResult.value = result;
    orphanSelection.value = result.orphanedCandidates.map((entry) => entry.userId);
    await refreshUsers();
    await refreshPermissions();
    actionSuccess.value = t("adminPermissions.messages.importDone");
  } catch (error) {
    console.error(error);
    actionError.value = t("adminPermissions.errors.importRun");
  } finally {
    busy.importing = false;
  }
};

const deleteOrphanedProfiles = async () => {
  if (orphanSelection.value.length === 0) {
    return;
  }
  resetMessage();
  busy.deletingOrphans = true;
  try {
    await $fetch("/api/admin/users/delete-orphaned", {
      method: "POST",
      body: {
        userIds: orphanSelection.value
      }
    });
    if (importResult.value) {
      importResult.value.orphanedCandidates = importResult.value.orphanedCandidates.filter(
        (entry) => !orphanSelection.value.includes(entry.userId)
      );
      orphanSelection.value = importResult.value.orphanedCandidates.map((entry) => entry.userId);
    }
    await refreshUsers();
    await refreshPermissions();
    actionSuccess.value = t("adminPermissions.messages.orphansDeleted");
  } catch (error) {
    console.error(error);
    actionError.value = t("adminPermissions.errors.orphanDelete");
  } finally {
    busy.deletingOrphans = false;
  }
};

const deleteSingleUser = async () => {
  if (!selectedUserId.value) {
    return;
  }
  resetMessage();
  busy.deletingUser = true;
  try {
    await $fetch(`/api/admin/users/${selectedUserId.value}`, {
      method: "DELETE",
      body: {
        removeAllDiscordRoles: removeAllDiscordRoles.value
      }
    });
    selectedUserId.value = "";
    removeAllDiscordRoles.value = false;
    await refreshAll();
    actionSuccess.value = t("adminPermissions.messages.userProcessed");
  } catch (error) {
    console.error(error);
    actionError.value = t("adminPermissions.errors.userProcess");
  } finally {
    busy.deletingUser = false;
  }
};

const deleteByCommunityRole = async () => {
  if (!selectedBulkRoleId.value) {
    return;
  }
  resetMessage();
  busy.deletingByRole = true;
  try {
    await $fetch(`/api/admin/users/by-community-role/${selectedBulkRoleId.value}`, {
      method: "DELETE"
    });
    await refreshAll();
    actionSuccess.value = t("adminPermissions.messages.bulkDeleted");
  } catch (error) {
    console.error(error);
    actionError.value = t("adminPermissions.errors.bulkDelete");
  } finally {
    busy.deletingByRole = false;
  }
};

const toggleOrphanSelection = (userId: string, checked: boolean) => {
  if (checked) {
    if (!orphanSelection.value.includes(userId)) {
      orphanSelection.value = [...orphanSelection.value, userId];
    }
    return;
  }
  orphanSelection.value = orphanSelection.value.filter((id) => id !== userId);
};

// ─── Membership Settings ─────────────────────────────────────────────────

type CleanupCondition = {
  type: "orphan" | "missingRole" | "loginInactive" | "voiceInactive";
  operator: "AND" | "OR";
};

type RoleCleanupConfig = {
  permissionRoleName: string;
  enabled: boolean;
  conditions: CleanupCondition[];
  cleanupRequiredRoleId?: string | null;
  cleanupInactiveDays?: number | null;
  cleanupNoVoiceDays?: number | null;
};

type MembershipSettingsData = {
  applicationsRequired: boolean;
  defaultCommunityRoleId: number | null;
  requiredLoginRoleId: string | null;
  autoSyncEnabled: boolean;
  autoSyncIntervalHours: number;
  autoSyncLastRun: string | null;
  autoCleanupEnabled: boolean;
  autoCleanupIntervalHours: number;
  autoCleanupLastRun: string | null;
  cleanupRoleConfigs: RoleCleanupConfig[];
  cleanupRoleWhitelist: string[];
  cleanupProtectModerators: boolean;
  communityRoles: Array<{ id: number; name: string }>;
  permissionRoles: Array<{ id: number; name: string; level: number }>;
  discordRoles: Array<{ id: string; name: string }>;
};

type CleanupLogEntry = {
  id: string;
  userId: string | null;
  discordId: string;
  discordUsername: string;
  reason: string;
  conditionsMatched: string[];
  rolesRemoved: string[];
  createdAt: string;
};

const { data: membershipData, refresh: refreshMembership } = await useFetch<MembershipSettingsData>(
  "/api/admin/membership-settings"
);

const membershipForm = reactive({
  applicationsRequired: true,
  defaultCommunityRoleId: null as number | null,
  requiredLoginRoleId: null as string | null,
  autoSyncEnabled: false,
  autoSyncIntervalHours: 24,
  autoCleanupEnabled: false,
  autoCleanupIntervalHours: 24,
  cleanupRoleConfigs: [] as RoleCleanupConfig[],
  cleanupRoleWhitelist: [] as string[],
  cleanupProtectModerators: true
});

const membershipSaving = ref(false);
const showCleanupLog = ref(false);
const cleanupLogEntries = ref<CleanupLogEntry[]>([]);
const cleanupLogLoading = ref(false);

// Sync form from loaded data
watch(
  () => membershipData.value,
  (data) => {
    if (!data) return;
    membershipForm.applicationsRequired = data.applicationsRequired;
    membershipForm.defaultCommunityRoleId = data.defaultCommunityRoleId;
    membershipForm.requiredLoginRoleId = data.requiredLoginRoleId;
    membershipForm.autoSyncEnabled = data.autoSyncEnabled;
    membershipForm.autoSyncIntervalHours = data.autoSyncIntervalHours;
    membershipForm.autoCleanupEnabled = data.autoCleanupEnabled;
    membershipForm.autoCleanupIntervalHours = data.autoCleanupIntervalHours;
    membershipForm.cleanupRoleConfigs = data.cleanupRoleConfigs?.length
      ? data.cleanupRoleConfigs.map((c) => ({ ...c, conditions: [...c.conditions] }))
      : [];
    membershipForm.cleanupRoleWhitelist = data.cleanupRoleWhitelist?.length ? [...data.cleanupRoleWhitelist] : [];
    membershipForm.cleanupProtectModerators = data.cleanupProtectModerators;
  },
  { immediate: true }
);

const intervalOptions = [6, 12, 24, 72, 168];

// Per-role cleanup config helpers
const getRoleConfig = (roleName: string): RoleCleanupConfig => {
  let config = membershipForm.cleanupRoleConfigs.find((c) => c.permissionRoleName === roleName);
  if (!config) {
    config = { permissionRoleName: roleName, enabled: false, conditions: [] };
    membershipForm.cleanupRoleConfigs.push(config);
  }
  return config;
};

const isRoleConditionEnabled = (roleName: string, type: string) =>
  getRoleConfig(roleName).conditions.some((c) => c.type === type);

const getRoleConditionOperator = (roleName: string, type: string) =>
  getRoleConfig(roleName).conditions.find((c) => c.type === type)?.operator ?? "OR";

const toggleRoleCondition = (roleName: string, type: CleanupCondition["type"], enabled: boolean) => {
  const config = getRoleConfig(roleName);
  if (enabled) {
    if (!config.conditions.some((c) => c.type === type)) {
      config.conditions.push({ type, operator: "OR" });
    }
  } else {
    config.conditions = config.conditions.filter((c) => c.type !== type);
  }
};

const setRoleConditionOperator = (roleName: string, type: string, operator: "AND" | "OR") => {
  const condition = getRoleConfig(roleName).conditions.find((c) => c.type === type);
  if (condition) condition.operator = operator;
};

const toggleWhitelistRole = (roleId: string, checked: boolean) => {
  if (checked) {
    if (!membershipForm.cleanupRoleWhitelist.includes(roleId)) {
      membershipForm.cleanupRoleWhitelist.push(roleId);
    }
  } else {
    membershipForm.cleanupRoleWhitelist = membershipForm.cleanupRoleWhitelist.filter((id) => id !== roleId);
  }
};

const formatRelativeTime = (isoString: string | null) => {
  if (!isoString) return t("membershipSettings.autoSync.never");
  const date = new Date(isoString);
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 48) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
};

const saveMembershipSettings = async () => {
  resetMessage();
  membershipSaving.value = true;
  try {
    await $fetch("/api/admin/membership-settings", {
      method: "PUT",
      body: { ...membershipForm }
    });
    await refreshMembership();
    actionSuccess.value = t("membershipSettings.messages.saved");
  } catch (err) {
    console.error(err);
    actionError.value = t("membershipSettings.messages.saveFailed");
  } finally {
    membershipSaving.value = false;
  }
};

const loadCleanupLog = async () => {
  cleanupLogLoading.value = true;
  try {
    const data = await $fetch<{ items: CleanupLogEntry[] }>("/api/admin/cleanup-log?limit=50");
    cleanupLogEntries.value = data.items;
  } catch (err) {
    console.error(err);
  } finally {
    cleanupLogLoading.value = false;
  }
};

const toggleCleanupLog = async () => {
  showCleanupLog.value = !showCleanupLog.value;
  if (showCleanupLog.value && cleanupLogEntries.value.length === 0) {
    await loadCleanupLog();
  }
};
</script>

<template>
  <section class="space-y-6">
    <header class="space-y-2">
      <h1 class="text-2xl font-bold md:text-3xl">{{ t("adminPermissions.title") }}</h1>
      <p class="opacity-80">{{ t("adminPermissions.description") }}</p>
    </header>

    <div v-if="actionError" class="alert alert-error">{{ actionError }}</div>
    <div v-if="actionSuccess" class="alert alert-success">{{ actionSuccess }}</div>

    <!-- ─── Membership Settings ────────────────────────────────────────── -->
    <div class="card bg-base-200">
      <div class="card-body space-y-5">
        <div>
          <h2 class="card-title">{{ t("membershipSettings.title") }}</h2>
          <p class="mt-1 text-sm opacity-75">{{ t("membershipSettings.description") }}</p>
        </div>

        <!-- Applications Required Toggle -->
        <UiCheckbox
          v-model="membershipForm.applicationsRequired"
          :label="t('membershipSettings.applicationsRequired')"
          :description="t('membershipSettings.applicationsRequiredHelp')"
        />

        <!-- Auto-Login Settings (visible when applications disabled) -->
        <div v-if="!membershipForm.applicationsRequired" class="space-y-4 rounded-2xl bg-base-100 p-4 md:p-5">
          <h3 class="text-sm font-semibold uppercase opacity-70">{{ t("membershipSettings.autoLogin.title") }}</h3>

          <UiSelect
            v-model="membershipForm.defaultCommunityRoleId"
            :label="t('membershipSettings.autoLogin.defaultRole')"
            :hint="t('membershipSettings.autoLogin.defaultRoleHelp')"
            required
          >
            <option :value="null" disabled>{{ t("membershipSettings.autoLogin.defaultRolePlaceholder") }}</option>
            <option v-for="role in membershipData?.communityRoles" :key="role.id" :value="role.id">
              {{ role.name }}
            </option>
          </UiSelect>

          <UiSelect
            v-model="membershipForm.requiredLoginRoleId"
            :label="t('membershipSettings.autoLogin.requiredDiscordRole')"
            :hint="t('membershipSettings.autoLogin.requiredDiscordRoleHelp')"
          >
            <option :value="null">{{ t("membershipSettings.autoLogin.nonePlaceholder") }}</option>
            <option v-for="role in membershipData?.discordRoles" :key="role.id" :value="role.id">
              {{ role.name }}
            </option>
          </UiSelect>
        </div>

        <!-- Auto-Sync -->
        <div class="space-y-4 rounded-2xl bg-base-100 p-4 md:p-5">
          <h3 class="text-sm font-semibold uppercase opacity-70">{{ t("membershipSettings.autoSync.title") }}</h3>

          <UiCheckbox
            v-model="membershipForm.autoSyncEnabled"
            :label="t('membershipSettings.autoSync.enabled')"
            :description="t('membershipSettings.autoSync.enabledHelp')"
          />

          <template v-if="membershipForm.autoSyncEnabled">
            <UiSelect
              v-model="membershipForm.autoSyncIntervalHours"
              :label="t('membershipSettings.autoSync.interval')"
            >
              <option v-for="hours in intervalOptions" :key="hours" :value="hours">
                {{ t(`membershipSettings.intervals.${hours}`) }}
              </option>
            </UiSelect>

            <p class="text-sm opacity-70">
              {{ t("membershipSettings.autoSync.lastRun") }}:
              <span class="font-medium">{{ formatRelativeTime(membershipData?.autoSyncLastRun ?? null) }}</span>
            </p>
          </template>
        </div>

        <!-- Auto-Cleanup -->
        <div class="space-y-4 rounded-2xl bg-base-100 p-4 md:p-5">
          <h3 class="text-sm font-semibold uppercase opacity-70">{{ t("membershipSettings.autoCleanup.title") }}</h3>

          <UiCheckbox
            v-model="membershipForm.autoCleanupEnabled"
            :label="t('membershipSettings.autoCleanup.enabled')"
            :description="t('membershipSettings.autoCleanup.enabledHelp')"
          />

          <template v-if="membershipForm.autoCleanupEnabled">
            <UiSelect
              v-model="membershipForm.autoCleanupIntervalHours"
              :label="t('membershipSettings.autoCleanup.interval')"
            >
              <option v-for="hours in intervalOptions" :key="hours" :value="hours">
                {{ t(`membershipSettings.intervals.${hours}`) }}
              </option>
            </UiSelect>

            <p class="text-sm opacity-70">
              {{ t("membershipSettings.autoCleanup.lastRun") }}:
              <span class="font-medium">{{ formatRelativeTime(membershipData?.autoCleanupLastRun ?? null) }}</span>
            </p>

            <!-- Per-Role Cleanup Configs -->
            <div class="space-y-3">
              <p class="text-sm font-medium">{{ t("membershipSettings.autoCleanup.conditions") }}</p>
              <p class="text-xs opacity-70">{{ t("membershipSettings.autoCleanup.perRoleHelp") }}</p>

              <div
                v-for="permRole in (membershipData?.permissionRoles ?? []).filter(r => r.name !== 'superadmin' && r.name !== 'admin')"
                :key="permRole.name"
                class="rounded-xl bg-base-200 p-3 space-y-3"
              >
                <!-- Role header with enable toggle -->
                <label class="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm"
                    :checked="getRoleConfig(permRole.name).enabled"
                    @change="getRoleConfig(permRole.name).enabled = ($event.target as HTMLInputElement).checked"
                  >
                  {{ permRole.name }}
                </label>

                <template v-if="getRoleConfig(permRole.name).enabled">
                  <!-- Orphan Check -->
                  <div class="ml-4 flex flex-wrap items-center gap-3">
                    <label class="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        class="checkbox checkbox-xs"
                        :checked="isRoleConditionEnabled(permRole.name, 'orphan')"
                        @change="toggleRoleCondition(permRole.name, 'orphan', ($event.target as HTMLInputElement).checked)"
                      >
                      {{ t("membershipSettings.autoCleanup.conditionOrphan") }}
                    </label>
                    <select
                      v-if="isRoleConditionEnabled(permRole.name, 'orphan')"
                      class="select select-bordered select-xs"
                      :value="getRoleConditionOperator(permRole.name, 'orphan')"
                      @change="setRoleConditionOperator(permRole.name, 'orphan', ($event.target as HTMLSelectElement).value as 'AND' | 'OR')"
                    >
                      <option value="OR">{{ t("membershipSettings.autoCleanup.operatorOr") }}</option>
                      <option value="AND">{{ t("membershipSettings.autoCleanup.operatorAnd") }}</option>
                    </select>
                  </div>

                  <!-- Missing Role Check -->
                  <div class="ml-4 flex flex-wrap items-center gap-3">
                    <label class="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        class="checkbox checkbox-xs"
                        :checked="isRoleConditionEnabled(permRole.name, 'missingRole')"
                        @change="toggleRoleCondition(permRole.name, 'missingRole', ($event.target as HTMLInputElement).checked)"
                      >
                      {{ t("membershipSettings.autoCleanup.conditionMissingRole") }}
                    </label>
                    <select
                      v-if="isRoleConditionEnabled(permRole.name, 'missingRole')"
                      class="select select-bordered select-xs"
                      :value="getRoleConditionOperator(permRole.name, 'missingRole')"
                      @change="setRoleConditionOperator(permRole.name, 'missingRole', ($event.target as HTMLSelectElement).value as 'AND' | 'OR')"
                    >
                      <option value="OR">{{ t("membershipSettings.autoCleanup.operatorOr") }}</option>
                      <option value="AND">{{ t("membershipSettings.autoCleanup.operatorAnd") }}</option>
                    </select>
                  </div>
                  <div v-if="isRoleConditionEnabled(permRole.name, 'missingRole')" class="ml-8">
                    <UiSelect
                      v-model="getRoleConfig(permRole.name).cleanupRequiredRoleId"
                      :label="t('membershipSettings.autoCleanup.requiredRole')"
                      size="sm"
                    >
                      <option :value="null" disabled>—</option>
                      <option v-for="dr in membershipData?.discordRoles" :key="dr.id" :value="dr.id">
                        {{ dr.name }}
                      </option>
                    </UiSelect>
                  </div>

                  <!-- Login Inactivity -->
                  <div class="ml-4 flex flex-wrap items-center gap-3">
                    <label class="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        class="checkbox checkbox-xs"
                        :checked="isRoleConditionEnabled(permRole.name, 'loginInactive')"
                        @change="toggleRoleCondition(permRole.name, 'loginInactive', ($event.target as HTMLInputElement).checked)"
                      >
                      {{ t("membershipSettings.autoCleanup.conditionLoginInactive") }}
                    </label>
                    <select
                      v-if="isRoleConditionEnabled(permRole.name, 'loginInactive')"
                      class="select select-bordered select-xs"
                      :value="getRoleConditionOperator(permRole.name, 'loginInactive')"
                      @change="setRoleConditionOperator(permRole.name, 'loginInactive', ($event.target as HTMLSelectElement).value as 'AND' | 'OR')"
                    >
                      <option value="OR">{{ t("membershipSettings.autoCleanup.operatorOr") }}</option>
                      <option value="AND">{{ t("membershipSettings.autoCleanup.operatorAnd") }}</option>
                    </select>
                  </div>
                  <div v-if="isRoleConditionEnabled(permRole.name, 'loginInactive')" class="ml-8">
                    <UiInput
                      v-model="getRoleConfig(permRole.name).cleanupInactiveDays"
                      :label="t('membershipSettings.autoCleanup.inactiveDays')"
                      type="number"
                      size="sm"
                      placeholder="30"
                    />
                  </div>

                  <!-- Voice Inactivity -->
                  <div class="ml-4 flex flex-wrap items-center gap-3">
                    <label class="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        class="checkbox checkbox-xs"
                        :checked="isRoleConditionEnabled(permRole.name, 'voiceInactive')"
                        @change="toggleRoleCondition(permRole.name, 'voiceInactive', ($event.target as HTMLInputElement).checked)"
                      >
                      {{ t("membershipSettings.autoCleanup.conditionVoiceInactive") }}
                    </label>
                    <select
                      v-if="isRoleConditionEnabled(permRole.name, 'voiceInactive')"
                      class="select select-bordered select-xs"
                      :value="getRoleConditionOperator(permRole.name, 'voiceInactive')"
                      @change="setRoleConditionOperator(permRole.name, 'voiceInactive', ($event.target as HTMLSelectElement).value as 'AND' | 'OR')"
                    >
                      <option value="OR">{{ t("membershipSettings.autoCleanup.operatorOr") }}</option>
                      <option value="AND">{{ t("membershipSettings.autoCleanup.operatorAnd") }}</option>
                    </select>
                  </div>
                  <div v-if="isRoleConditionEnabled(permRole.name, 'voiceInactive')" class="ml-8">
                    <UiInput
                      v-model="getRoleConfig(permRole.name).cleanupNoVoiceDays"
                      :label="t('membershipSettings.autoCleanup.voiceDays')"
                      type="number"
                      size="sm"
                      placeholder="14"
                    />
                  </div>
                </template>
              </div>
            </div>

            <!-- Role Whitelist -->
            <div v-if="membershipData?.discordRoles?.length" class="space-y-2">
              <p class="text-sm font-medium">{{ t("membershipSettings.autoCleanup.roleWhitelist") }}</p>
              <p class="text-xs opacity-70">{{ t("membershipSettings.autoCleanup.roleWhitelistHelp") }}</p>
              <div class="flex flex-wrap gap-2">
                <label
                  v-for="role in membershipData.discordRoles"
                  :key="role.id"
                  class="flex items-center gap-1.5 rounded-lg bg-base-200 px-2.5 py-1.5 text-xs"
                >
                  <input
                    type="checkbox"
                    class="checkbox checkbox-xs"
                    :checked="membershipForm.cleanupRoleWhitelist.includes(role.id)"
                    @change="toggleWhitelistRole(role.id, ($event.target as HTMLInputElement).checked)"
                  >
                  {{ role.name }}
                </label>
              </div>
            </div>

            <!-- Protect Moderators -->
            <UiCheckbox
              v-model="membershipForm.cleanupProtectModerators"
              :label="t('membershipSettings.autoCleanup.protectModerators')"
              :description="t('membershipSettings.autoCleanup.protectModeratorsHelp')"
            />

            <!-- Cleanup Log Toggle -->
            <div>
              <button class="btn btn-ghost btn-sm" @click="toggleCleanupLog">
                {{ showCleanupLog ? t("membershipSettings.cleanupLog.hideLog") : t("membershipSettings.cleanupLog.showLog") }}
              </button>

              <div v-if="showCleanupLog" class="mt-3">
                <div v-if="cleanupLogLoading" class="loading loading-spinner loading-sm" />
                <div v-else-if="cleanupLogEntries.length === 0" class="text-sm opacity-60">
                  {{ t("membershipSettings.cleanupLog.empty") }}
                </div>
                <div v-else class="overflow-x-auto">
                  <table class="table table-sm">
                    <thead>
                      <tr>
                        <th>{{ t("membershipSettings.cleanupLog.username") }}</th>
                        <th>{{ t("membershipSettings.cleanupLog.discordId") }}</th>
                        <th>{{ t("membershipSettings.cleanupLog.reason") }}</th>
                        <th>{{ t("membershipSettings.cleanupLog.date") }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="entry in cleanupLogEntries" :key="entry.id">
                        <td class="font-medium">{{ entry.discordUsername }}</td>
                        <td class="text-xs opacity-70">{{ entry.discordId }}</td>
                        <td class="text-xs">{{ entry.reason }}</td>
                        <td class="text-xs opacity-70">{{ new Date(entry.createdAt).toLocaleString() }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- Save Button -->
        <div class="flex justify-end">
          <UiButton :disabled="membershipSaving" @click="saveMembershipSettings">
            {{ membershipSaving ? t("common.loading") : t("common.save") }}
          </UiButton>
        </div>
      </div>
    </div>

    <!-- ─── Community Role Mapping (existing) ──────────────────────────── -->
    <div class="card bg-base-200">
      <div class="card-body space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="card-title">{{ t("adminPermissions.mapping.title") }}</h2>
          <button class="btn btn-sm btn-outline" :disabled="permissionPending || discordRolesPending" @click="refreshAll">
            {{ t("adminPermissions.mapping.refresh") }}
          </button>
        </div>

        <div v-if="permissionPending || discordRolesPending" class="loading loading-spinner loading-md" />

        <template v-else>
          <div class="rounded-2xl bg-base-100 p-4 md:p-5">
            <h3 class="text-sm font-semibold uppercase opacity-70">{{ t("adminPermissions.roles.newRoleTitle") }}</h3>
            <p class="mt-1 text-sm opacity-75">{{ t("adminPermissions.roles.newRoleDescription") }}</p>

            <div class="mt-4 grid gap-4 md:grid-cols-2">
              <div class="form-control gap-2">
                <div class="flex items-center gap-2">
                  <span class="label-text font-medium">{{ t("adminPermissions.roles.nameLabel") }}</span>
                  </div>
                <UiInput
                  v-model="newRoleForm.name"
                  :label="t('adminPermissions.roles.nameLabel')"
                  type="text"
                 
                  :aria-describedby="'new-role-name-help'"
                  :placeholder="t('adminPermissions.roles.nameLabel')"
                />
                <p id="new-role-name-help" class="text-xs opacity-70">{{ t("adminPermissions.roles.nameHelp") }}</p>
              </div>

              <div class="form-control gap-2 md:col-span-2">
                <div class="flex items-center gap-2">
                  <span class="label-text font-medium">{{ t("adminPermissions.roles.permissionRoleLabel") }}</span>
                </div>
                <div class="flex flex-wrap gap-2" role="radiogroup" :aria-describedby="'new-role-permission-help'">
                  <button
                    v-for="role in permissionData?.permissionRoles || []"
                    :key="role.id"
                    type="button"
                    class="btn justify-start"
                    :class="newRoleForm.permissionRoleName === role.name ? 'btn-primary' : 'btn-secondary'"
                    :aria-pressed="newRoleForm.permissionRoleName === role.name"
                    @click="newRoleForm.permissionRoleName = role.name"
                  >
                    {{ role.name }}
                  </button>
                </div>
                <p id="new-role-permission-help" class="text-xs opacity-70">{{ t("adminPermissions.roles.permissionRoleHelp") }}</p>
              </div>

              <div class="form-control gap-2">
                <div class="flex items-center gap-2">
                  <span class="label-text font-medium">{{ t("adminPermissions.roles.discordRoleLabel") }}</span>
                  </div>
                <UiSelect
                  v-model="newRoleForm.discordRoleId"
                  :label="t('adminPermissions.roles.discordRoleLabel')"
                 
                  :aria-describedby="'new-role-discord-help'"
                >
                  <option value="">{{ t("adminPermissions.roles.noneDiscordRole") }}</option>
                  <option v-for="role in availableDiscordRolesForCreate" :key="role.id" :value="role.id">
                    {{ role.name }} ({{ role.id }})
                  </option>
                </UiSelect>
                <p id="new-role-discord-help" class="text-xs opacity-70">{{ t("adminPermissions.roles.discordRoleHelp") }}</p>
              </div>

              <div class="form-control gap-2">
                <div class="flex items-center gap-2">
                  <span class="label-text font-medium">{{ t("adminPermissions.roles.sortOrderLabel") }}</span>
                  </div>
                <UiInput
                  v-model.number="newRoleForm.sortOrder"
                  :label="t('adminPermissions.roles.sortOrderLabel')"
                  type="number"
                 
                  min="0"
                  :aria-describedby="'new-role-sort-help'"
                />
                <p id="new-role-sort-help" class="text-xs opacity-70">{{ t("adminPermissions.roles.sortOrderHelp") }}</p>
              </div>

              <div class="form-control gap-2 md:col-span-2">
                <div class="flex items-center gap-2">
                  <span class="label-text font-medium">{{ t("adminPermissions.roles.descriptionLabel") }}</span>
                  </div>
                <UiTextarea
                  v-model="newRoleForm.description"
                  :label="t('adminPermissions.roles.descriptionLabel')"
                  :rows="3"

                  :maxlength="250"
                  :aria-describedby="'new-role-description-help'"
                  :placeholder="t('adminPermissions.roles.descriptionLabel')"
                />
                <p id="new-role-description-help" class="text-xs opacity-70">{{ t("adminPermissions.roles.descriptionHelp") }}</p>
              </div>
            </div>

            <div class="mt-4 flex justify-end">
              <button class="btn btn-primary btn-sm" :disabled="busy.savingRole" @click="createCommunityRole">
                {{ t("adminPermissions.roles.createButton") }}
              </button>
            </div>
          </div>

          <div class="space-y-4">
            <h3 class="text-sm font-semibold uppercase opacity-70">{{ t("adminPermissions.roles.editRolesTitle") }}</h3>

            <template v-if="roleEditRows.length">
              <article
                v-for="row in roleEditRows"
                :key="row.id"
                class="rounded-2xl bg-base-100 p-4 md:p-5"
              >
                <button
                  type="button"
                  class="flex w-full items-center justify-between gap-3 text-left"
                  :aria-expanded="openRoleId === row.id"
                  :aria-controls="`edit-role-panel-${row.id}`"
                  @click="toggleRoleAccordion(row.id)"
                >
                  <h4 class="text-sm font-semibold">
                    {{ t("adminPermissions.roles.editRoleTitle", { name: row.name || t("adminPermissions.roles.unnamedRole") }) }}
                  </h4>
                  <div class="flex items-center gap-2 text-xs opacity-70">
                    <span>{{ t("adminPermissions.roles.assignedUsersCount", { count: row.assignedUsers }) }}</span>
                    <Icon
                      :name="openRoleId === row.id ? 'proicons:chevron-up' : 'proicons:chevron-down'"
                      class="h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                  </div>
                </button>

                <div
                  v-show="openRoleId === row.id"
                  :id="`edit-role-panel-${row.id}`"
                  class="mt-4 grid gap-4 md:grid-cols-2"
                >
                  <div class="form-control gap-2">
                    <div class="flex items-center gap-2">
                      <span class="label-text font-medium">{{ t("adminPermissions.roles.nameLabel") }}</span>
                    </div>
                    <UiInput
                      v-model="row.name"
                      :label="t('adminPermissions.roles.nameLabel')"
                      type="text"
                     
                      :aria-describedby="`edit-role-${row.id}-name-help`"
                      :placeholder="t('adminPermissions.roles.nameLabel')"
                    />
                    <p :id="`edit-role-${row.id}-name-help`" class="text-xs opacity-70">{{ t("adminPermissions.roles.nameHelp") }}</p>
                  </div>

                  <div class="form-control gap-2 md:col-span-2">
                    <div class="flex items-center gap-2">
                      <span class="label-text font-medium">{{ t("adminPermissions.roles.permissionRoleLabel") }}</span>
                    </div>
                    <div class="flex flex-wrap gap-2" role="radiogroup" :aria-describedby="`edit-role-${row.id}-permission-help`">
                      <button
                        v-for="role in permissionData?.permissionRoles || []"
                        :key="role.id"
                        type="button"
                        class="btn justify-start"
                        :class="row.permissionRoleName === role.name ? 'btn-primary' : 'btn-secondary'"
                        :aria-pressed="row.permissionRoleName === role.name"
                        @click="row.permissionRoleName = role.name"
                      >
                        {{ role.name }}
                      </button>
                    </div>
                    <p :id="`edit-role-${row.id}-permission-help`" class="text-xs opacity-70">{{ t("adminPermissions.roles.permissionRoleHelp") }}</p>
                  </div>

                  <div class="form-control gap-2">
                    <div class="flex items-center gap-2">
                      <span class="label-text font-medium">{{ t("adminPermissions.roles.discordRoleLabel") }}</span>
                    </div>
                    <UiSelect
                      v-model="row.discordRoleId"
                      :label="t('adminPermissions.roles.discordRoleLabel')"
                     
                      :aria-describedby="`edit-role-${row.id}-discord-help`"
                    >
                      <option value="">{{ t("adminPermissions.roles.noneDiscordRole") }}</option>
                      <option v-for="role in availableDiscordRolesForEdit(row.discordRoleId)" :key="role.id" :value="role.id">
                        {{ role.name }}
                      </option>
                    </UiSelect>
                    <p :id="`edit-role-${row.id}-discord-help`" class="text-xs opacity-70">{{ t("adminPermissions.roles.discordRoleHelp") }}</p>
                  </div>

                  <div class="form-control gap-2">
                    <div class="flex items-center gap-2">
                      <span class="label-text font-medium">{{ t("adminPermissions.roles.sortOrderLabel") }}</span>
                    </div>
                    <UiInput
                      v-model.number="row.sortOrder"
                      :label="t('adminPermissions.roles.sortOrderLabel')"
                      type="number"
                     
                      min="0"
                      :aria-describedby="`edit-role-${row.id}-sort-help`"
                    />
                    <p :id="`edit-role-${row.id}-sort-help`" class="text-xs opacity-70">{{ t("adminPermissions.roles.sortOrderHelp") }}</p>
                  </div>

                  <div class="form-control gap-2 md:col-span-2">
                    <div class="flex items-center gap-2">
                      <span class="label-text font-medium">{{ t("adminPermissions.roles.descriptionLabel") }}</span>
                    </div>
                    <UiTextarea
                      v-model="row.description"
                      :label="t('adminPermissions.roles.descriptionLabel')"
                      :rows="3"

                      :maxlength="250"
                      :aria-describedby="`edit-role-${row.id}-description-help`"
                      :placeholder="t('adminPermissions.roles.descriptionLabel')"
                    />
                    <p :id="`edit-role-${row.id}-description-help`" class="text-xs opacity-70">{{ t("adminPermissions.roles.descriptionHelp") }}</p>
                  </div>

                  <div class="mt-2 flex justify-end gap-2 md:col-span-2">
                    <UiButton variant="success" size="sm" :disabled="busy.savingRole" @click="saveCommunityRole(row.id)">
                      {{ t("adminPermissions.roles.saveButton") }}
                    </UiButton>
                    <UiButton variant="error" size="sm" :disabled="busy.deletingRole" @click="openDeleteRoleConfirm(row.id)">
                      {{ t("adminPermissions.roles.deleteButton") }}
                    </UiButton>
                  </div>
                </div>
              </article>
            </template>
            <p v-else class="text-sm opacity-70">
              {{ t("adminPermissions.roles.noRolesYet") }}
            </p>
          </div>
        </template>
      </div>
    </div>

    <div class="card bg-base-200">
      <div class="card-body space-y-4">
        <h2 class="card-title">{{ t("adminPermissions.import.title") }}</h2>
        <div v-if="permissionData?.hasActiveMappings">
          <button class="btn btn-primary" :disabled="busy.importing" @click="runGlobalImport">
            {{ busy.importing ? t("adminPermissions.import.running") : t("adminPermissions.import.run") }}
          </button>
        </div>
        <div v-else class="alert alert-info">{{ t("adminPermissions.import.missingMapping") }}</div>

        <template v-if="importResult">
          <div class="grid gap-3 md:grid-cols-4">
            <div class="stat rounded-xl bg-base-100 p-3">
              <div class="stat-title text-xs">{{ t("adminPermissions.import.stats.created") }}</div>
              <div class="stat-value text-lg">{{ importResult.created.length }}</div>
            </div>
            <div class="stat rounded-xl bg-base-100 p-3">
              <div class="stat-title text-xs">{{ t("adminPermissions.import.stats.updated") }}</div>
              <div class="stat-value text-lg">{{ importResult.updated.length }}</div>
            </div>
            <div class="stat rounded-xl bg-base-100 p-3">
              <div class="stat-title text-xs">{{ t("adminPermissions.import.stats.conflicts") }}</div>
              <div class="stat-value text-lg">{{ importResult.conflicts.length }}</div>
            </div>
            <div class="stat rounded-xl bg-base-100 p-3">
              <div class="stat-title text-xs">{{ t("adminPermissions.import.stats.orphaned") }}</div>
              <div class="stat-value text-lg">{{ importResult.orphanedCandidates.length }}</div>
            </div>
          </div>

          <div v-if="importResult.conflicts.length > 0" class="rounded-xl bg-base-100 p-4">
            <h3 class="mb-2 text-sm font-semibold uppercase opacity-70">{{ t("adminPermissions.import.conflictsTitle") }}</h3>
            <ul class="space-y-1 text-sm">
              <li v-for="item in importResult.conflicts" :key="item.discordId">
                {{ item.profileName }} ({{ item.discordId }}) - {{ t("adminPermissions.import.conflictRoles") }}: {{ item.communityRoleIds.join(", ") }}
              </li>
            </ul>
          </div>

          <div v-if="importResult.orphanedCandidates.length > 0" class="rounded-xl bg-base-100 p-4">
            <div class="mb-3 flex items-center justify-between gap-2">
              <h3 class="text-sm font-semibold uppercase opacity-70">{{ t("adminPermissions.import.orphanedTitle") }}</h3>
              <button class="btn btn-sm btn-error" :disabled="busy.deletingOrphans || orphanSelection.length === 0" @click="deleteOrphanedProfiles">
                {{ busy.deletingOrphans ? t("adminPermissions.import.deletingOrphaned") : t("adminPermissions.import.deleteOrphaned") }}
              </button>
            </div>
            <div class="overflow-x-auto">
              <table class="table table-zebra">
                <thead>
                  <tr>
                    <th />
                    <th>{{ t("adminPermissions.import.table.name") }}</th>
                    <th>{{ t("adminPermissions.import.table.discordId") }}</th>
                    <th>{{ t("adminPermissions.import.table.communityRole") }}</th>
                    <th>{{ t("adminPermissions.import.table.permissionRoles") }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in importResult.orphanedCandidates" :key="item.userId">
                    <td>
                      <UiCheckbox
                        :model-value="orphanSelection.includes(item.userId)"
                        label="Select"
                        size="xs"
                       
                        @update:model-value="toggleOrphanSelection(item.userId, $event)"
                      />
                    </td>
                    <td>{{ item.profileName }}</td>
                    <td>{{ item.discordId }}</td>
                    <td>{{ item.communityRole || "-" }}</td>
                    <td>{{ item.permissionRoles.join(", ") || "-" }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
      </div>
    </div>

    <div class="card bg-base-200">
      <div class="card-body space-y-4">
        <h2 class="card-title">{{ t("adminPermissions.removeUsers.title") }}</h2>
        <div v-if="usersPending" class="loading loading-spinner loading-md" />
        <template v-else>
          <div class="grid gap-3 md:grid-cols-3">
            <UiSelect v-model="selectedUserId" :label="t('adminPermissions.removeUsers.singleUserPlaceholder')">
              <option value="">{{ t("adminPermissions.removeUsers.singleUserPlaceholder") }}</option>
              <option v-for="user in usersData || []" :key="user.id" :value="user.id">
                {{ user.profileName }} ({{ user.discordId }})
              </option>
            </UiSelect>
            <UiCheckbox
              v-model="removeAllDiscordRoles"
              :label="t('adminPermissions.removeUsers.removeDiscordRoles')"
              :description="t('adminPermissions.removeUsers.removeDiscordRoles')"
             
              size="sm"
            />
            <UiButton variant="error" :disabled="busy.deletingUser || !selectedUserId" @click="deleteSingleUser">
              {{ busy.deletingUser ? t("adminPermissions.removeUsers.processing") : t("adminPermissions.removeUsers.deleteSingle") }}
            </UiButton>
          </div>

          <div class="grid gap-3 md:grid-cols-2">
            <UiSelect
              v-model.number="selectedBulkRoleId"
              :label="t('adminPermissions.removeUsers.bulkRolePlaceholder')"
             
            >
              <option :value="null">{{ t("adminPermissions.removeUsers.bulkRolePlaceholder") }}</option>
              <option v-for="role in permissionData?.communityRoles || []" :key="role.id" :value="role.id">
                {{ role.name }}
              </option>
            </UiSelect>
            <UiButton variant="warning" :disabled="busy.deletingByRole || !selectedBulkRoleId" @click="deleteByCommunityRole">
              {{ busy.deletingByRole ? t("adminPermissions.removeUsers.processing") : t("adminPermissions.removeUsers.deleteByRole") }}
            </UiButton>
          </div>
        </template>
      </div>
    </div>

    <dialog class="modal" :class="{ 'modal-open': deleteRoleConfirm.open }" :open="deleteRoleConfirm.open">
      <div class="modal-box max-w-sm">
        <h3 class="text-lg font-bold">{{ t("adminPermissions.roles.deleteConfirmTitle") }}</h3>
        <p class="mt-2 opacity-80">{{ t("adminPermissions.roles.deleteConfirmMessage") }}</p>
        <div class="mt-4 flex justify-end gap-2">
          <UiButton variant="ghost" :disabled="busy.deletingRole" @click="closeDeleteRoleConfirm">
            {{ t("common.cancel") }}
          </UiButton>
          <UiButton variant="error" :disabled="busy.deletingRole" @click="confirmDeleteRole">
            {{ busy.deletingRole ? t("common.loading") : t("adminPermissions.roles.deleteConfirmLabel") }}
          </UiButton>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="button" :disabled="busy.deletingRole" @click="closeDeleteRoleConfirm">{{ t("common.close") }}</button>
      </form>
    </dialog>
  </section>
</template>
