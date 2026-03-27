<script setup lang="ts">
import type { DisplayNameField } from "@guildora/shared";

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

const { data: discordRolesData, pending: discordRolesPending, error: discordRolesError, refresh: refreshDiscordRoles } = await useFetch<AdminDiscordRolesResponse>("/api/admin/discord-roles");

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
            />
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
        <div v-else-if="discordRolesError" class="alert alert-error">{{ $t("adminDiscordRoles.loadError") }}</div>
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
  </section>
</template>
