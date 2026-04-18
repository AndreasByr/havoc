<script setup lang="ts">
import type { CustomFieldEntry, CommunityTag } from "~/types/custom-fields";
import { type DisplayNameField, parseWithTemplate } from "@guildora/shared";

const props = defineProps<{
  open: boolean;
  pending: boolean;
  error: string | null;
  memberId: string | null;
  profile: {
    profileName: string;
    ingameName: string;
    rufname: string | null;
    permissionRoles: string[];
    communityRole: string | null;
    editableDiscordRoles?: Array<{ discordRoleId: string; name: string; selected: boolean }>;
    voiceSummary?: {
      minutes7d: number;
      minutes14d: number;
      minutes28d: number;
      hours7d: number;
      label: string;
    };
  } | null;
}>();

const emit = defineEmits<{
  (event: "close" | "saved"): void;
}>();

const closeButtonRef = ref<HTMLButtonElement | null>(null);
const previousBodyOverflow = ref<string | null>(null);
const lastFocusedElement = ref<HTMLElement | null>(null);
const { t } = useI18n();
const { user, hasRole } = useAuth();

const isStaff = computed(() => hasRole("moderator"));
const isAdmin = computed(() => hasRole("admin"));
const canDeleteUsers = computed(() => {
  if (isAdmin.value) return true;
  const moderationRights = (user.value as Record<string, unknown> | null)?.moderationRights as Record<string, boolean> | undefined;
  return hasRole("moderator") && moderationRights?.modDeleteUsers === true;
});

const isEditMode = ref(false);
const editSaving = ref(false);
const editError = ref<string | null>(null);
const deleteConfirmOpen = ref(false);
const deletePending = ref(false);

const editName = ref("");
const editRufname = ref("");
const displayNameTemplate = ref<DisplayNameField[]>([]);
const displayNameParts = ref<Record<string, string>>({});
const customFields = ref<CustomFieldEntry[]>([]);
const customFieldValues = ref<Record<string, unknown>>({});
const availableCommunityRoles = ref<{ id: number; name: string; permissionRoleName: string }[]>([]);
const selectedCommunityRoleId = ref<number | null>(null);
const initialCommunityRoleId = ref<number | null>(null);

const isSuperadminTarget = computed(() => props.profile?.permissionRoles?.includes("superadmin") ?? false);
const canChangeRole = computed(() => isAdmin.value && !isSuperadminTarget.value);
const communityTags = ref<CommunityTag[]>([]);
const tagSearch = ref("");
const tagSearchResults = computed(() => {
  if (!tagSearch.value.trim()) return communityTags.value;
  const q = tagSearch.value.toLowerCase();
  return communityTags.value.filter((t) => t.name.toLowerCase().includes(q));
});

const modNoteMeta = computed(() => {
  const vals = customFieldValues.value;
  if (!vals.mod_note_last_edited_by) return null;
  return {
    editedBy: vals.mod_note_last_edited_by as string,
    editedAt: vals.mod_note_last_edited_at as string
  };
});

const enterEditMode = async () => {
  if (!props.memberId || !isStaff.value) return;
  editError.value = null;
  editName.value = props.profile?.ingameName ?? "";
  editRufname.value = props.profile?.rufname ?? "";

  try {
    const fetches: [
      Promise<{ fields: CustomFieldEntry[] }>,
      Promise<{ tags: CommunityTag[] }>,
      Promise<{ communityRoles: { id: number; name: string; permissionRoleName: string }[] }> | null,
      Promise<{ displayNameTemplate: DisplayNameField[] }>
    ] = [
      $fetch<{ fields: CustomFieldEntry[] }>(`/api/mod/users/${props.memberId}/custom-fields`),
      $fetch<{ tags: CommunityTag[] }>("/api/mod/tags"),
      isAdmin.value
        ? $fetch<{ communityRoles: { id: number; name: string; permissionRoleName: string }[] }>("/api/mod/community-roles")
        : null,
      $fetch<{ displayNameTemplate: DisplayNameField[] }>("/api/community-settings/display-name-template")
    ];
    const [cfData, tagsData, rolesData, templateData] = await Promise.all(fetches);
    displayNameTemplate.value = templateData.displayNameTemplate ?? [];
    if (displayNameTemplate.value.length > 0) {
      displayNameParts.value = parseWithTemplate(props.profile?.profileName ?? "", displayNameTemplate.value);
    }
    customFields.value = cfData.fields;
    communityTags.value = tagsData.tags;
    if (rolesData) {
      availableCommunityRoles.value = rolesData.communityRoles;
      const match = rolesData.communityRoles.find((r) => r.name === props.profile?.communityRole);
      selectedCommunityRoleId.value = match?.id ?? null;
      initialCommunityRoleId.value = match?.id ?? null;
    }
    const vals: Record<string, unknown> = {};
    for (const f of cfData.fields) {
      vals[f.key] = f.value ?? (f.inputType === "boolean" ? false : "");
    }
    customFieldValues.value = vals;
  } catch {
    editError.value = t("common.error");
    return;
  }

  isEditMode.value = true;
};

const cancelEdit = () => {
  isEditMode.value = false;
  editError.value = null;
};

const saveEdit = async () => {
  if (!props.memberId) return;
  editSaving.value = true;
  editError.value = null;
  try {
    if (displayNameTemplate.value.length > 0) {
      await $fetch(`/api/mod/users/${props.memberId}/profile`, {
        method: "PUT",
        body: { ingameName: editName.value, rufname: editRufname.value || null, displayNameParts: displayNameParts.value }
      });
    } else {
      await $fetch(`/api/mod/users/${props.memberId}/profile`, {
        method: "PUT",
        body: { ingameName: editName.value, rufname: editRufname.value || null }
      });
    }

    const editableValues: Record<string, unknown> = {};
    for (const f of customFields.value) {
      if (f.canEdit) {
        editableValues[f.key] = customFieldValues.value[f.key];
      }
    }
    await $fetch(`/api/mod/users/${props.memberId}/custom-fields`, {
      method: "PUT",
      body: { values: editableValues }
    });

    if (canChangeRole.value && selectedCommunityRoleId.value && selectedCommunityRoleId.value !== initialCommunityRoleId.value) {
      await $fetch(`/api/mod/users/${props.memberId}/community-role`, {
        method: "PUT",
        body: { communityRoleId: selectedCommunityRoleId.value }
      });
    }

    isEditMode.value = false;
    emit("saved");
  } catch {
    editError.value = t("common.error");
  } finally {
    editSaving.value = false;
  }
};

const deleteUser = async () => {
  if (!props.memberId) return;
  deletePending.value = true;
  try {
    await $fetch(`/api/admin/users/${props.memberId}`, { method: "DELETE" });
    deleteConfirmOpen.value = false;
    isEditMode.value = false;
    emit("close");
  } catch {
    editError.value = t("common.error");
  } finally {
    deletePending.value = false;
  }
};

const addTag = async (tagName: string) => {
  const currentTags = (customFieldValues.value.mod_tags as string[] | undefined) ?? [];
  if (currentTags.includes(tagName)) return;

  const existing = communityTags.value.find((t) => t.name === tagName);
  if (!existing) {
    const created = await $fetch<{ tag: CommunityTag }>("/api/mod/tags", { method: "POST", body: { name: tagName } });
    communityTags.value = [...communityTags.value, created.tag ?? { id: tagName, name: tagName }];
  }
  customFieldValues.value = {
    ...customFieldValues.value,
    mod_tags: [...currentTags, tagName]
  };
  tagSearch.value = "";
};

const removeTag = (tagName: string) => {
  const currentTags = (customFieldValues.value.mod_tags as string[] | undefined) ?? [];
  customFieldValues.value = {
    ...customFieldValues.value,
    mod_tags: currentTags.filter((t) => t !== tagName)
  };
};

watch(
  () => props.open,
  async (isOpen) => {
    if (!import.meta.client) return;
    if (isOpen) {
      lastFocusedElement.value = document.activeElement as HTMLElement | null;
      previousBodyOverflow.value = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      isEditMode.value = false;
      await nextTick();
      closeButtonRef.value?.focus();
      return;
    }
    document.body.style.overflow = previousBodyOverflow.value ?? "";
    previousBodyOverflow.value = null;
    lastFocusedElement.value?.focus();
  }
);

onBeforeUnmount(() => {
  if (!import.meta.client) return;
  document.body.style.overflow = previousBodyOverflow.value ?? "";
});
</script>

<template>
  <dialog class="modal" :class="{ 'modal-open': open }" :open="open" @cancel.prevent="emit('close')">
    <div class="modal-box member-modal" role="dialog" aria-modal="true" @keydown.esc="emit('close')">
      <!-- Header Actions -->
      <div class="member-modal__actions">
        <button
          v-if="isStaff && !isEditMode && profile"
          type="button"
          class="btn btn-ghost btn-circle btn-sm"
          :aria-label="$t('common.edit')"
          @click="enterEditMode"
        >
          <Icon name="proicons:pencil" class="h-4 w-4" />
        </button>
        <button
          ref="closeButtonRef"
          type="button"
          class="btn btn-ghost btn-circle btn-sm"
          :aria-label="$t('common.close')"
          @click="emit('close')"
        >
          <Icon name="proicons:cancel" class="h-5 w-5" />
        </button>
      </div>

      <!-- Content -->
      <div class="member-modal__content">
        <div v-if="pending" class="member-modal__loading">
          <div class="loading loading-spinner loading-md" />
        </div>
        <div v-else-if="error" class="alert alert-error">{{ error }}</div>

        <!-- View Mode -->
        <template v-else-if="profile && !isEditMode">
          <ProfileCard :profile="profile" />
          <!-- Custom fields view for staff -->
          <template v-if="isStaff && customFields.length > 0">
            <div class="mt-4 space-y-2">
              <template v-for="field in customFields" :key="field.id">
                <div v-if="field.value != null && field.value !== ''" class="text-sm">
                  <span class="font-medium opacity-70">{{ field.label }}:</span>
                  <span class="ml-1">{{ Array.isArray(field.value) ? (field.value as string[]).join(', ') : field.value }}</span>
                </div>
              </template>
            </div>
          </template>
        </template>

        <!-- Edit Mode -->
        <template v-else-if="profile && isEditMode">
          <div class="space-y-4">
            <h3 class="text-lg font-bold">{{ $t("common.edit") }}</h3>

            <div v-if="editError" class="alert alert-error">{{ editError }}</div>

            <!-- Template-based name fields -->
            <template v-if="displayNameTemplate.length > 0">
              <UiInput
                v-for="field in displayNameTemplate"
                :key="field.key"
                :model-value="displayNameParts[field.key] ?? ''"
                :label="field.label"
                :required="field.required"
                @update:model-value="(val: string) => displayNameParts = { ...displayNameParts, [field.key]: val }"
              />
            </template>
            <!-- Legacy name fields -->
            <template v-else>
              <UiInput v-model="editName" :label="$t('profile.ingameName')" />
              <UiInput v-model="editRufname" :label="$t('profile.rufname')" />
            </template>

            <!-- Community Role -->
            <UiSelect
              v-if="canChangeRole && availableCommunityRoles.length"
              v-model.number="selectedCommunityRoleId"
              :label="$t('profile.communityRole')"
            >
              <option v-for="role in availableCommunityRoles" :key="role.id" :value="role.id">
                {{ role.name }}
              </option>
            </UiSelect>

            <!-- Custom Fields -->
            <template v-for="field in customFields" :key="field.id">
              <template v-if="field.key === 'mod_tags'">
                <!-- Tags -->
                <div class="space-y-2">
                  <label class="text-sm font-medium">{{ field.label }}</label>
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="tag in ((customFieldValues.mod_tags as string[]) ?? [])"
                      :key="tag"
                      class="inline-flex items-center gap-1 rounded-lg bg-accent/20 px-2 py-0.5 text-sm"
                    >
                      {{ tag }}
                      <button type="button" class="opacity-60 hover:opacity-100" @click="removeTag(tag)">
                        <Icon name="proicons:cancel" class="h-3 w-3" />
                      </button>
                    </span>
                  </div>
                  <div class="relative">
                    <UiInput
                      v-model="tagSearch"
                      :label="$t('settings.tagLibraryTitle')"
                      :placeholder="$t('settings.tagLibraryTitle')"
                      @keydown.enter.prevent="tagSearch.trim() && addTag(tagSearch.trim())"
                    />
                    <div v-if="tagSearch.trim()" class="absolute z-10 mt-1 w-full rounded-lg bg-base-200 p-2 shadow-md">
                      <button
                        v-for="tag in tagSearchResults"
                        :key="tag.id"
                        type="button"
                        class="block w-full rounded px-2 py-1 text-left text-sm hover:bg-base-content/10"
                        @click="addTag(tag.name)"
                      >
                        {{ tag.name }}
                      </button>
                      <button
                        v-if="!communityTags.some((t) => t.name === tagSearch.trim())"
                        type="button"
                        class="block w-full rounded px-2 py-1 text-left text-sm font-medium text-accent hover:bg-base-content/10"
                        @click="addTag(tagSearch.trim())"
                      >
                        + {{ tagSearch.trim() }}
                      </button>
                    </div>
                  </div>
                </div>
              </template>
              <template v-else-if="field.key === 'mod_note'">
                <!-- Mod Note -->
                <div class="space-y-1">
                  <UiTextarea
                    v-model="customFieldValues[field.key]"
                    :label="field.label"
                    :disabled="!field.canEdit"
                    :rows="3"
                  />
                  <p v-if="modNoteMeta" class="text-xs opacity-50">
                    {{ $t("common.edit") }}: {{ modNoteMeta.editedAt }}
                  </p>
                </div>
              </template>
              <template v-else-if="field.canEdit">
                <template v-if="field.inputType === 'text'">
                  <UiInput v-model="customFieldValues[field.key]" :label="field.label" />
                </template>
                <template v-else-if="field.inputType === 'textarea'">
                  <UiTextarea v-model="customFieldValues[field.key]" :label="field.label" :rows="3" />
                </template>
                <template v-else-if="field.inputType === 'number'">
                  <UiInput v-model.number="customFieldValues[field.key]" :label="field.label" type="number" />
                </template>
                <template v-else-if="field.inputType === 'boolean'">
                  <UiCheckbox v-model="customFieldValues[field.key]" :label="field.label" />
                </template>
                <template v-else-if="field.inputType === 'select' && field.options">
                  <UiSelect v-model="customFieldValues[field.key]" :label="field.label">
                    <option value="">--</option>
                    <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
                  </UiSelect>
                </template>
              </template>
            </template>

            <!-- Footer -->
            <div class="flex items-center justify-between gap-4 pt-4">
              <div>
                <UiButton
                  v-if="canDeleteUsers"
                  variant="error"
                  size="sm"
                  @click="deleteConfirmOpen = true"
                >
                  {{ $t("common.delete") }}
                </UiButton>
              </div>
              <div class="flex gap-2">
                <UiButton variant="ghost" @click="cancelEdit">{{ $t("common.cancel") }}</UiButton>
                <UiButton :disabled="editSaving" @click="saveEdit">
                  {{ editSaving ? $t("common.loading") : $t("common.save") }}
                </UiButton>
              </div>
            </div>
          </div>
        </template>

        <div v-else class="alert alert-info">{{ t("common.notFound") }}</div>
      </div>
    </div>

    <form method="dialog" class="modal-backdrop">
      <button type="button" @click="emit('close')">{{ $t("common.close") }}</button>
    </form>

    <!-- Delete Confirmation -->
    <dialog class="modal" :class="{ 'modal-open': deleteConfirmOpen }" :open="deleteConfirmOpen">
      <div class="modal-box max-w-sm bg-base-200 shadow-md">
        <h3 class="text-lg font-bold">{{ $t("common.confirm") }}</h3>
        <p class="mt-2 opacity-80">{{ $t("settings.modRightDeleteUsersDesc") }}</p>
        <div class="mt-4 flex justify-end gap-2">
          <UiButton variant="ghost" @click="deleteConfirmOpen = false">{{ $t("common.cancel") }}</UiButton>
          <UiButton variant="error" :disabled="deletePending" @click="deleteUser">
            {{ deletePending ? $t("common.loading") : $t("common.delete") }}
          </UiButton>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="button" @click="deleteConfirmOpen = false">{{ $t("common.close") }}</button>
      </form>
    </dialog>
  </dialog>
</template>

<style scoped>
.member-modal {
  max-width: 36rem;
  background-color: var(--color-surface-3);
  --color-field-bg: var(--color-surface-5);
  box-shadow: var(--shadow-lg);
  border-radius: 1rem;
  padding: 2rem;
  position: relative;
}

.member-modal__actions {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  display: flex;
  gap: 0.25rem;
  color: var(--color-text-secondary);
}

.member-modal__actions button:hover {
  color: var(--color-text-primary);
}

.member-modal__content {
  min-height: 6rem;
}

.member-modal__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 8rem;
}
</style>
