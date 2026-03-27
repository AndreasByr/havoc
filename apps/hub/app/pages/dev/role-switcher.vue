<script setup lang="ts">
definePageMeta({
  middleware: ["dev"],
});

const lastPath = useCookie<string | null>("guildora_dev_last_path", { sameSite: "lax" });
lastPath.value = "/dev/role-switcher";

type SessionUserShape = {
  id: string;
  profileName?: string;
  communityRole?: string | null;
  permissionRoles?: string[];
  roles?: string[];
};

const { t } = useI18n();
const { user } = useUserSession();

const search = ref("");
const selectedPermissionRole = ref("ALL");
const selectedCommunityRole = ref("ALL");

const {
  users,
  loadingUsers,
  switchingUserId,
  restoring,
  error,
  isDevEnabled,
  isAllowed,
  originalUserId,
  fetchUsers,
  switchUser,
  restoreUser
} = useDevRoleSwitcher();

const currentUser = computed(() => (user.value as SessionUserShape | null) || null);
const currentPermissionRoles = computed(() => currentUser.value?.permissionRoles ?? currentUser.value?.roles ?? []);
const isSuperadmin = computed(() => currentPermissionRoles.value.includes("superadmin"));

const selfImportPending = ref(false);
const selfImportError = ref("");
const selfImportSuccess = ref("");

const permissionRoleOptions = computed(() => {
  const roles = new Set<string>();
  for (const item of users.value) {
    for (const role of item.permissionRoles) {
      roles.add(role);
    }
  }
  return ["ALL", ...Array.from(roles).sort((a, b) => a.localeCompare(b))];
});

const communityRoleOptions = computed(() => {
  const roles = new Set<string>();
  for (const item of users.value) {
    if (item.communityRole) {
      roles.add(item.communityRole);
    }
  }
  return ["ALL", ...Array.from(roles).sort((a, b) => a.localeCompare(b))];
});

const filteredUsers = computed(() => {
  const term = search.value.trim().toLowerCase();
  return users.value.filter((entry) => {
    const matchesSearch = term.length === 0
      || entry.profileName.toLowerCase().includes(term)
      || entry.id.toLowerCase().includes(term)
      || entry.discordId.toLowerCase().includes(term);
    const matchesPermissionRole = selectedPermissionRole.value === "ALL"
      || entry.permissionRoles.includes(selectedPermissionRole.value);
    const matchesCommunityRole = selectedCommunityRole.value === "ALL"
      || entry.communityRole === selectedCommunityRole.value;
    return matchesSearch && matchesPermissionRole && matchesCommunityRole;
  });
});

const runSelfImport = async () => {
  if (!isSuperadmin.value) return;
  selfImportError.value = "";
  selfImportSuccess.value = "";
  selfImportPending.value = true;
  try {
    await $fetch("/api/admin/discord-roles/self-import", { method: "POST" });
    selfImportSuccess.value = t("adminDiscordRoles.selfImportSuccess");
  } catch (err) {
    console.error(err);
    selfImportError.value = t("adminDiscordRoles.selfImportError");
  } finally {
    selfImportPending.value = false;
  }
};

onMounted(async () => {
  if (isAllowed.value) {
    await fetchUsers();
  }
});
</script>

<template>
  <section class="space-y-6">
    <header class="space-y-2">
      <h1 class="text-2xl font-bold md:text-3xl">{{ t("devRoleSwitcher.title") }}</h1>
      <p class="text-sm text-base-content/70">{{ t("devRoleSwitcher.description") }}</p>
    </header>

    <div v-if="!isDevEnabled" class="alert alert-warning">
      <span>{{ t("devRoleSwitcher.description") }}</span>
    </div>

    <div v-else-if="!isAllowed" class="alert alert-error">
      <span>{{ t("common.forbidden") }}</span>
    </div>

    <template v-else>
      <div v-if="isSuperadmin" class="card border border-line bg-base-200 shadow-md">
        <div class="card-body space-y-3">
          <h2 class="card-title text-base">{{ t("adminDiscordRoles.superadminTitle") }}</h2>
          <p class="text-sm text-base-content/70">{{ t("adminDiscordRoles.superadminDescription") }}</p>
          <div v-if="selfImportError" class="alert alert-error text-sm">{{ selfImportError }}</div>
          <div v-if="selfImportSuccess" class="alert alert-success text-sm">{{ selfImportSuccess }}</div>
          <div class="flex justify-end">
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              :disabled="selfImportPending"
              @click="runSelfImport"
            >
              {{ selfImportPending ? t("common.loading") : t("adminDiscordRoles.selfImportButton") }}
            </button>
          </div>
        </div>
      </div>

      <div class="grid gap-4 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div class="card border border-line bg-base-200 shadow-md">
          <div class="card-body space-y-4">
            <div>
              <h2 class="card-title text-base">{{ currentUser?.profileName || "-" }}</h2>
              <p class="text-xs text-base-content/70">{{ currentPermissionRoles.join(", ") || "-" }}</p>
              <p v-if="originalUserId" class="mt-2 text-xs text-info">{{ t("devRoleSwitcher.originalUser", { id: originalUserId }) }}</p>
            </div>

            <button
              type="button"
              class="btn btn-outline btn-sm"
              :disabled="!originalUserId || restoring"
              @click="restoreUser"
            >
              {{ restoring ? t("common.loading") : t("devRoleSwitcher.restoreButton") }}
            </button>
          </div>
        </div>

        <div class="card border border-line bg-base-200 shadow-md">
          <div class="card-body gap-4">
            <div class="grid w-full gap-2 md:grid-cols-3">
              <UiInput
                v-model="search"
                size="sm"
                :label="t('devRoleSwitcher.searchPlaceholder')"
                :placeholder="t('devRoleSwitcher.searchPlaceholder')"
                type="search"
              />
              <UiSelect
                v-model="selectedPermissionRole"
                size="sm"
                :label="t('devRoleSwitcher.allPermissionRoles')"
              >
                <option v-for="role in permissionRoleOptions" :key="role" :value="role">
                  {{ role === "ALL" ? t("devRoleSwitcher.allPermissionRoles") : role }}
                </option>
              </UiSelect>
              <UiSelect
                v-model="selectedCommunityRole"
                size="sm"
                :label="t('devRoleSwitcher.allCommunityRoles')"
              >
                <option v-for="role in communityRoleOptions" :key="role" :value="role">
                  {{ role === "ALL" ? t("devRoleSwitcher.allCommunityRoles") : role }}
                </option>
              </UiSelect>
            </div>

            <p v-if="error" class="alert alert-error text-sm">{{ error }}</p>
            <p v-if="loadingUsers" class="text-sm text-base-content/70">{{ t("common.loading") }}</p>
            <p v-else-if="filteredUsers.length === 0" class="text-sm text-base-content/70">{{ t("devRoleSwitcher.noUsers") }}</p>

            <ul v-else class="space-y-2">
              <li
                v-for="entry in filteredUsers"
                :key="entry.id"
                class="rounded-xl border border-line bg-base-100 px-4 py-3"
              >
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium">{{ entry.profileName }}</p>
                    <p class="truncate text-xs text-base-content/70">{{ entry.id }}</p>
                    <p class="truncate text-xs text-base-content/70">{{ entry.discordId }}</p>
                    <p class="truncate text-xs text-base-content/70">
                      {{ entry.communityRole || "-" }} | {{ entry.permissionRoles.join(", ") || "-" }}
                    </p>
                  </div>
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    :disabled="switchingUserId === entry.id || currentUser?.id === entry.id"
                    @click="switchUser(entry.id)"
                  >
                    {{ switchingUserId === entry.id ? t("common.loading") : t("devRoleSwitcher.switchButton") }}
                  </button>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>
