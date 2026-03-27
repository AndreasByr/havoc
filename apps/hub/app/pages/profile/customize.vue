<script setup lang="ts">
import AppearanceSwitcher from "../../components/layout/AppearanceSwitcher.vue";
import LanguageSwitcher from "../../components/layout/LanguageSwitcher.vue";
import { defaultAppearancePreference, normalizeAppearancePreference } from "../../../utils/appearance";
import type { EditableProfile } from "../../composables/useProfile";
import type { CustomFieldEntry } from "~/types/custom-fields";

definePageMeta({
  middleware: ["auth"],
});

const { logout } = useAuth();
const { fetchProfile, updateProfile, updateProfileDiscordRoles, uploadAvatar, removeAvatar } = useProfile();
const { t } = useI18n();
const toast = useState<string | null>("profile-toast", () => null);
const toastTimeout = ref<ReturnType<typeof setTimeout> | null>(null);

function showSavedToast() {
  if (toastTimeout.value) clearTimeout(toastTimeout.value);
  toast.value = "saved";
  toastTimeout.value = setTimeout(() => {
    toast.value = null;
    toastTimeout.value = null;
  }, 5000);
}

onBeforeRouteLeave(() => {
  toast.value = null;
  if (toastTimeout.value) {
    clearTimeout(toastTimeout.value);
    toastTimeout.value = null;
  }
});

const initial = (await fetchProfile()) || {
  profileName: "",
  ingameName: "",
  rufname: null,
  appearancePreference: defaultAppearancePreference,
  localePreference: null,
  displayNameTemplate: [],
  displayNameParts: undefined
};

const editable = ref<EditableProfile>({
  ...structuredClone(initial),
  appearancePreference: normalizeAppearancePreference(initial.appearancePreference, defaultAppearancePreference)
});

const displayNameTemplate = computed(() => initial.displayNameTemplate ?? []);

const { data: customFieldsData } = await useFetch<{ fields: CustomFieldEntry[] }>("/api/profile/custom-fields", {
  key: "profile-custom-fields"
});

const customFields = computed(() => customFieldsData.value?.fields ?? []);
const customFieldValues = ref<Record<string, unknown>>({});
watch(
  () => customFieldsData.value?.fields,
  (fields) => {
    if (!fields) return;
    const values: Record<string, unknown> = {};
    for (const field of fields) {
      values[field.key] = field.value ?? (field.inputType === "boolean" ? false : "");
    }
    customFieldValues.value = values;
  },
  { immediate: true }
);

const editableDiscordRoles = ref(
  (initial?.editableDiscordRoles || []).map((role) => ({ ...role }))
);
const selectedDiscordRoleIds = ref(
  editableDiscordRoles.value.filter((role) => role.selected).map((role) => role.discordRoleId)
);

const saveError = ref<string | null>(null);
const discordSyncWarningKey = ref<string | null>(null);
const saving = ref(false);
const roleSaving = ref(false);
const roleSaveError = ref<string | null>(null);
const customFieldSaving = ref(false);

const avatarSaving = ref(false);
const avatarError = ref<string | null>(null);
const avatarPreviewSrc = ref<string | null>(null);

const onAvatarFileSelected = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  avatarError.value = null;

  if (file.size > 5 * 1024 * 1024) {
    avatarError.value = t("profile.avatarTooLarge");
    return;
  }
  if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
    avatarError.value = t("profile.avatarInvalidType");
    return;
  }

  avatarPreviewSrc.value = URL.createObjectURL(file);
  avatarSaving.value = true;
  try {
    const data = await uploadAvatar(file);
    editable.value = { ...editable.value, avatarUrl: data.avatarUrl, avatarSource: data.avatarSource };
    avatarPreviewSrc.value = null;
    showSavedToast();
  } catch {
    avatarError.value = t("common.error");
    avatarPreviewSrc.value = null;
  } finally {
    avatarSaving.value = false;
    input.value = "";
  }
};

const onRemoveAvatar = async () => {
  avatarError.value = null;
  avatarSaving.value = true;
  try {
    const data = await removeAvatar();
    editable.value = { ...editable.value, avatarUrl: data.avatarUrl, avatarSource: data.avatarSource };
    showSavedToast();
  } catch {
    avatarError.value = t("common.error");
  } finally {
    avatarSaving.value = false;
  }
};

function getDiscordSyncWarningKey(profile: EditableProfile) {
  const sync = profile.discordSync;
  if (!sync || sync.nicknameUpdated) return null;
  if (sync.nicknameReason === "missing_permissions") return "profile.discordSyncWarning.missingPermissions";
  if (sync.nicknameReason === "member_not_manageable") return "profile.discordSyncWarning.memberNotManageable";
  if (sync.nicknameReason === "nickname_too_long") return "profile.discordSyncWarning.nicknameTooLong";
  return "profile.discordSyncWarning.generic";
}

const onSaveName = async () => {
  saveError.value = null;
  discordSyncWarningKey.value = null;
  saving.value = true;
  try {
    const data = await updateProfile({
      ...editable.value,
      appearancePreference: normalizeAppearancePreference(editable.value.appearancePreference, defaultAppearancePreference)
    });
    editable.value = {
      ...editable.value,
      ...data,
      appearancePreference: normalizeAppearancePreference(data.appearancePreference, defaultAppearancePreference)
    };
    discordSyncWarningKey.value = getDiscordSyncWarningKey(editable.value);
    showSavedToast();
  } catch {
    saveError.value = t("common.error");
  } finally {
    saving.value = false;
  }
};

const toggleDiscordRole = (discordRoleId: string) => {
  const idx = selectedDiscordRoleIds.value.indexOf(discordRoleId);
  if (idx === -1) {
    selectedDiscordRoleIds.value = [...selectedDiscordRoleIds.value, discordRoleId];
  } else {
    selectedDiscordRoleIds.value = selectedDiscordRoleIds.value.filter((id) => id !== discordRoleId);
  }
};

const onSaveDiscordRoles = async () => {
  roleSaveError.value = null;
  roleSaving.value = true;
  try {
    const data = await updateProfileDiscordRoles(selectedDiscordRoleIds.value);
    editableDiscordRoles.value = data.editableDiscordRoles;
    selectedDiscordRoleIds.value = data.editableDiscordRoles
      .filter((role) => role.selected)
      .map((role) => role.discordRoleId);
    showSavedToast();
  } catch {
    roleSaveError.value = t("common.error");
  } finally {
    roleSaving.value = false;
  }
};

const onSaveCustomFields = async () => {
  customFieldSaving.value = true;
  try {
    await $fetch("/api/profile/custom-fields", {
      method: "PUT",
      body: { values: customFieldValues.value }
    });
    showSavedToast();
  } catch {
    saveError.value = t("common.error");
  } finally {
    customFieldSaving.value = false;
  }
};
</script>

<template>
  <section class="space-y-8">
    <header class="space-y-2">
      <h1 class="text-2xl font-bold md:text-3xl">{{ $t("profile.customizeTitle") }}</h1>
    </header>

    <div v-if="toast === 'saved'" class="alert alert-success">
      {{ $t("profile.saveSuccess") }}
    </div>
    <div v-if="saveError" class="alert alert-error">{{ saveError }}</div>
    <div v-if="discordSyncWarningKey" class="alert alert-warning">{{ t(discordSyncWarningKey) }}</div>

    <!-- Section: Avatar -->
    <div class="space-y-4">
      <h2 class="text-xl font-bold">{{ $t("profile.avatarTitle") }}</h2>
      <div class="flex items-start gap-6">
        <div class="relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-[var(--color-surface-3)]">
          <img
            v-if="avatarPreviewSrc || editable.avatarUrl"
            :src="avatarPreviewSrc || editable.avatarUrl"
            alt=""
            class="h-full w-full object-cover"
          >
          <div v-else class="flex h-full w-full items-center justify-center text-2xl opacity-40">?</div>
        </div>
        <div class="space-y-3">
          <p class="text-sm opacity-75">{{ $t("profile.avatarHint") }}</p>
          <div class="flex flex-wrap gap-2">
            <label class="btn btn-primary btn-sm cursor-pointer">
              {{ $t("profile.avatarUpload") }}
              <input
                type="file"
                class="hidden"
                accept="image/png,image/jpeg,image/webp,image/gif"
                @change="onAvatarFileSelected"
              >
            </label>
            <UiButton
              v-if="editable.avatarSource === 'upload'"
              variant="secondary"
              size="sm"
              :disabled="avatarSaving"
              @click="onRemoveAvatar"
            >
              {{ $t("profile.avatarRestore") }}
            </UiButton>
          </div>
          <div v-if="avatarError" class="text-sm text-[var(--color-error)]">{{ avatarError }}</div>
        </div>
      </div>
    </div>

    <!-- Section: Display Name -->
    <div class="space-y-4">
      <h2 class="text-xl font-bold">{{ $t("profile.nameTitle") }}</h2>
      <ProfileEditor v-model="editable" :display-name-template="displayNameTemplate" :show-title="false" @submit="onSaveName" />
    </div>

    <!-- Section: Discord Roles -->
    <div v-if="editableDiscordRoles.length > 0" class="space-y-4">
      <h2 class="text-xl font-bold">{{ $t("profile.rolesTitle") }}</h2>
      <p class="text-sm opacity-75">{{ $t("profile.selectableDiscordRolesDescription") }}</p>
      <div v-if="roleSaveError" class="alert alert-error">{{ roleSaveError }}</div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="role in editableDiscordRoles"
          :key="role.discordRoleId"
          type="button"
          class="btn justify-start"
          :class="selectedDiscordRoleIds.includes(role.discordRoleId) ? 'btn-primary' : 'btn-secondary'"
          :aria-pressed="selectedDiscordRoleIds.includes(role.discordRoleId)"
          @click="toggleDiscordRole(role.discordRoleId)"
        >
          {{ role.name }}
        </button>
      </div>
      <div class="flex justify-end">
        <UiButton :disabled="roleSaving" @click="onSaveDiscordRoles">
          {{ roleSaving ? $t("common.loading") : $t("profile.saveDiscordRoles") }}
        </UiButton>
      </div>
    </div>

    <!-- Section: Appearance & Language -->
    <div class="space-y-4">
      <h2 class="text-xl font-bold">{{ $t("profile.designTitle") }}</h2>
      <div class="flex max-w-sm flex-col gap-4">
        <LanguageSwitcher />
        <AppearanceSwitcher v-model="editable.appearancePreference" />
      </div>
    </div>

    <!-- Section: Custom Fields -->
    <div v-if="customFields.length > 0" class="space-y-4">
      <h2 class="text-xl font-bold">{{ $t("profile.customFieldsTitle") }}</h2>
      <div class="space-y-4">
        <template v-for="field in customFields" :key="field.id">
          <template v-if="field.inputType === 'text'">
            <UiInput
              v-model="customFieldValues[field.key]"
              :label="field.label"
              :disabled="!field.canEdit"
            />
          </template>
          <template v-else-if="field.inputType === 'textarea'">
            <UiTextarea
              v-model="customFieldValues[field.key]"
              :label="field.label"
              :disabled="!field.canEdit"
              :rows="3"
            />
          </template>
          <template v-else-if="field.inputType === 'number'">
            <UiInput
              v-model.number="customFieldValues[field.key]"
              :label="field.label"
              type="number"
              :disabled="!field.canEdit"
            />
          </template>
          <template v-else-if="field.inputType === 'boolean'">
            <UiCheckbox
              v-model="customFieldValues[field.key]"
              :label="field.label"
              :disabled="!field.canEdit"
            />
          </template>
          <template v-else-if="field.inputType === 'select' && field.options">
            <UiSelect
              v-model="customFieldValues[field.key]"
              :label="field.label"
              :disabled="!field.canEdit"
            >
              <option value="">--</option>
              <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
            </UiSelect>
          </template>
          <template v-else-if="field.inputType === 'date'">
            <UiInput
              v-model="customFieldValues[field.key]"
              :label="field.label"
              type="date"
              :disabled="!field.canEdit"
            />
          </template>
          <template v-else-if="field.inputType === 'slider'">
            <div class="space-y-1">
              <label class="text-sm font-medium">{{ field.label }}</label>
              <input
                v-model.number="customFieldValues[field.key]"
                type="range"
                class="range range-primary w-full max-w-sm"
                :min="field.sliderMin ?? 0"
                :max="field.sliderMax ?? 100"
                :step="field.sliderStep ?? 1"
                :disabled="!field.canEdit"
              >
              <span class="text-sm opacity-70">{{ customFieldValues[field.key] }}</span>
            </div>
          </template>
          <p v-if="field.description" class="text-xs opacity-60">{{ field.description }}</p>
        </template>
      </div>
      <div class="flex justify-end">
        <UiButton :disabled="customFieldSaving" @click="onSaveCustomFields">
          {{ customFieldSaving ? $t("common.loading") : $t("common.save") }}
        </UiButton>
      </div>
    </div>

    <!-- Logout -->
    <div class="border-t border-line pt-6">
      <button class="btn btn-secondary" type="button" @click="logout">{{ $t("nav.logout") }}</button>
    </div>
  </section>
</template>
