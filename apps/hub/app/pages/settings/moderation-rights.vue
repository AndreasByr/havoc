<script setup lang="ts">
definePageMeta({
  middleware: ["settings"],
});

const { t } = useI18n();
const lastPath = useCookie<string | null>("guildora_settings_last_path", { sameSite: "lax" });
lastPath.value = "/settings/moderation-rights";

type ModerationRights = {
  modDeleteUsers: boolean;
  modManageApplications: boolean;
  modAccessCommunitySettings: boolean;
  modAccessDesign: boolean;
  modAccessApps: boolean;
  modAccessDiscordRoles: boolean;
  modAccessCustomFields: boolean;
  modAccessPermissions: boolean;
  allowModeratorAccess: boolean;
  allowModeratorAppsAccess: boolean;
};

const { data, pending } = await useFetch<{ rights: ModerationRights }>("/api/admin/moderation-rights", {
  key: "admin-moderation-rights"
});

const form = reactive<ModerationRights>({
  modDeleteUsers: false,
  modManageApplications: false,
  modAccessCommunitySettings: false,
  modAccessDesign: false,
  modAccessApps: false,
  modAccessDiscordRoles: false,
  modAccessCustomFields: false,
  modAccessPermissions: false,
  allowModeratorAccess: true,
  allowModeratorAppsAccess: true
});

watch(
  () => data.value?.rights,
  (rights) => {
    if (!rights) return;
    form.modDeleteUsers = rights.modDeleteUsers;
    form.modManageApplications = rights.modManageApplications;
    form.modAccessCommunitySettings = rights.modAccessCommunitySettings;
    form.modAccessDesign = rights.modAccessDesign;
    form.modAccessApps = rights.modAccessApps;
    form.modAccessDiscordRoles = rights.modAccessDiscordRoles;
    form.modAccessCustomFields = rights.modAccessCustomFields;
    form.modAccessPermissions = rights.modAccessPermissions;
    form.allowModeratorAccess = rights.allowModeratorAccess;
    form.allowModeratorAppsAccess = rights.allowModeratorAppsAccess;
  },
  { immediate: true }
);

const savePending = ref(false);
const saveError = ref("");
const saveSuccess = ref("");

const save = async () => {
  saveError.value = "";
  saveSuccess.value = "";
  savePending.value = true;
  try {
    await $fetch("/api/admin/moderation-rights", {
      method: "PUT",
      body: { ...form }
    });
    saveSuccess.value = t("settings.moderationRightsSaved");
  } catch {
    saveError.value = t("settings.moderationRightsSaveError");
  } finally {
    savePending.value = false;
  }
};

const allRights = computed(() => [
  { key: "modDeleteUsers" as const, label: t("settings.modRightDeleteUsers"), description: t("settings.modRightDeleteUsersDesc") },
  { key: "modManageApplications" as const, label: t("settings.modRightManageApplications"), description: t("settings.modRightManageApplicationsDesc") },
  { key: "modAccessCommunitySettings" as const, label: t("settings.modRightCommunitySettings"), description: t("settings.modRightCommunitySettingsDesc") },
  { key: "modAccessCustomFields" as const, label: t("settings.modRightCustomFields"), description: t("settings.modRightCustomFieldsDesc") },
  { key: "modAccessPermissions" as const, label: t("settings.modRightPermissions"), description: t("settings.modRightPermissionsDesc") },
  { key: "modAccessDesign" as const, label: t("settings.modRightDesign"), description: t("settings.modRightDesignDesc") },
  { key: "modAccessApps" as const, label: t("settings.modRightApps"), description: t("settings.modRightAppsDesc") },
  { key: "modAccessDiscordRoles" as const, label: t("settings.modRightDiscordRoles"), description: t("settings.modRightDiscordRolesDesc") },
  { key: "allowModeratorAccess" as const, label: t("settings.modRightLandingPage"), description: t("settings.modRightLandingPageDesc") },
  { key: "allowModeratorAppsAccess" as const, label: t("settings.modRightAppsArea"), description: t("settings.modRightAppsAreaDesc") }
]);
</script>

<template>
  <section class="space-y-6">
    <header class="space-y-2">
      <h1 class="text-2xl font-bold md:text-3xl">{{ $t("settings.moderationRightsTitle") }}</h1>
      <p class="opacity-80">{{ $t("settings.moderationRightsDescription") }}</p>
    </header>

    <div v-if="pending" class="loading loading-spinner loading-md" />
    <template v-else>
      <div class="space-y-4">
        <div
          v-for="item in allRights"
          :key="item.key"
          class="rounded-2xl bg-base-200 p-4 shadow-md"
        >
          <div class="flex items-center justify-between gap-4">
            <div>
              <h3 class="font-semibold">{{ item.label }}</h3>
              <p class="text-sm opacity-70">{{ item.description }}</p>
            </div>
            <UiCheckbox v-model="form[item.key]" label="" bare />
          </div>
        </div>
      </div>

      <div class="flex items-center gap-4">
        <UiButton :disabled="savePending" @click="save">
          {{ savePending ? $t("common.loading") : $t("common.save") }}
        </UiButton>
      </div>

      <div v-if="saveError" class="alert alert-error">{{ saveError }}</div>
      <div v-if="saveSuccess" class="alert alert-success">{{ saveSuccess }}</div>
    </template>
  </section>
</template>
