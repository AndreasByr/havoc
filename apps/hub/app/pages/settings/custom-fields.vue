<script setup lang="ts">
import type { CustomFieldDefinition, CommunityTag } from "~/types/custom-fields";

definePageMeta({
  middleware: ["settings"],
});

const { t } = useI18n();
const lastPath = useCookie<string | null>("guildora_settings_last_path", { sameSite: "lax" });
lastPath.value = "/settings/custom-fields";

const inputTypeOptions = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Textarea" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "select", label: "Select" },
  { value: "multiselect", label: "Multiselect" },
  { value: "multiselect_search", label: "Multiselect (Search)" },
  { value: "slider", label: "Slider" },
  { value: "date", label: "Date" }
];

const { data, pending, refresh } = await useFetch<{ fields: CustomFieldDefinition[] }>("/api/admin/custom-fields", {
  key: "admin-custom-fields"
});

const { data: tagsData, refresh: refreshTags } = await useFetch<{ tags: CommunityTag[] }>("/api/mod/tags", {
  key: "admin-tags"
});

const fields = computed(() => data.value?.fields ?? []);
const tags = computed(() => tagsData.value?.tags ?? []);

const showForm = ref(false);
const editingField = ref<CustomFieldDefinition | null>(null);
const savePending = ref(false);
const saveError = ref("");
const saveSuccess = ref("");

const form = reactive({
  key: "",
  label: "",
  description: "",
  inputType: "text",
  options: "",
  sliderMin: 0,
  sliderMax: 100,
  sliderStep: 1,
  required: false,
  active: true,
  userCanView: false,
  userCanEdit: false,
  modCanView: false,
  modCanEdit: false,
  sortOrder: 0
});

const isSlider = computed(() => form.inputType === "slider");
const hasOptions = computed(() => ["select", "multiselect", "multiselect_search"].includes(form.inputType));

const resetForm = () => {
  form.key = "";
  form.label = "";
  form.description = "";
  form.inputType = "text";
  form.options = "";
  form.sliderMin = 0;
  form.sliderMax = 100;
  form.sliderStep = 1;
  form.required = false;
  form.active = true;
  form.userCanView = false;
  form.userCanEdit = false;
  form.modCanView = false;
  form.modCanEdit = false;
  form.sortOrder = 0;
};

const openCreate = () => {
  editingField.value = null;
  resetForm();
  showForm.value = true;
};

const openEdit = (field: CustomFieldDefinition) => {
  editingField.value = field;
  form.key = field.key;
  form.label = field.label;
  form.description = field.description ?? "";
  form.inputType = field.inputType;
  form.options = field.options?.join(", ") ?? "";
  form.sliderMin = field.sliderMin ?? 0;
  form.sliderMax = field.sliderMax ?? 100;
  form.sliderStep = field.sliderStep ?? 1;
  form.required = field.required;
  form.active = field.active;
  form.userCanView = field.userCanView;
  form.userCanEdit = field.userCanEdit;
  form.modCanView = field.modCanView;
  form.modCanEdit = field.modCanEdit;
  form.sortOrder = field.sortOrder;
  showForm.value = true;
};

const closeForm = () => {
  showForm.value = false;
  editingField.value = null;
  saveError.value = "";
};

const buildPayload = () => {
  const payload: Record<string, unknown> = {
    label: form.label,
    inputType: form.inputType,
    required: form.required,
    active: form.active,
    userCanView: form.userCanView,
    userCanEdit: form.userCanEdit,
    modCanView: form.modCanView,
    modCanEdit: form.modCanEdit,
    sortOrder: form.sortOrder
  };
  if (form.description) payload.description = form.description;
  if (!editingField.value) payload.key = form.key;
  if (hasOptions.value && form.options) {
    payload.options = form.options.split(",").map((o) => o.trim()).filter(Boolean);
  }
  if (isSlider.value) {
    payload.sliderMin = form.sliderMin;
    payload.sliderMax = form.sliderMax;
    payload.sliderStep = form.sliderStep;
  }
  return payload;
};

const saveField = async () => {
  saveError.value = "";
  savePending.value = true;
  try {
    if (editingField.value) {
      await $fetch(`/api/admin/custom-fields/${editingField.value.id}`, {
        method: "PUT",
        body: buildPayload()
      });
    } else {
      await $fetch("/api/admin/custom-fields", {
        method: "POST",
        body: buildPayload()
      });
    }
    saveSuccess.value = t("settings.customFieldSaved");
    closeForm();
    await refresh();
  } catch {
    saveError.value = t("settings.customFieldSaveError");
  } finally {
    savePending.value = false;
  }
};

const deleteField = async (field: CustomFieldDefinition) => {
  if (field.isDefault) return;
  if (!confirm(t("settings.customFieldDeleteConfirm"))) return;
  try {
    await $fetch(`/api/admin/custom-fields/${field.id}`, { method: "DELETE" });
    await refresh();
  } catch {
    saveError.value = t("settings.customFieldDeleteError");
  }
};

const deleteTag = async (tag: CommunityTag) => {
  if (!confirm(t("settings.tagDeleteConfirm", { name: tag.name }))) return;
  try {
    await $fetch(`/api/admin/tags/${tag.id}`, { method: "DELETE" });
    await refreshTags();
  } catch {
    saveError.value = t("settings.tagDeleteError");
  }
};
</script>

<template>
  <section class="space-y-6">
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div class="space-y-2">
        <h1 class="text-2xl font-bold md:text-3xl">{{ $t("settings.customFieldsTitle") }}</h1>
        <p class="opacity-80">{{ $t("settings.customFieldsDescription") }}</p>
      </div>
      <UiButton @click="openCreate">
        {{ $t("settings.customFieldCreate") }}
      </UiButton>
    </header>

    <div v-if="saveSuccess" class="alert alert-success">{{ saveSuccess }}</div>
    <div v-if="saveError && !showForm" class="alert alert-error">{{ saveError }}</div>

    <!-- Field List -->
    <div v-if="pending" class="loading loading-spinner loading-md" />
    <div v-else-if="fields.length === 0" class="alert alert-info">{{ $t("settings.customFieldsEmpty") }}</div>
    <div v-else class="space-y-4">
      <div
        v-for="field in fields"
        :key="field.id"
        class="rounded-2xl bg-base-200 p-4 shadow-md"
      >
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-semibold">{{ field.label }}</h3>
              <span v-if="field.isDefault" class="badge badge-outline badge-sm">{{ $t("settings.customFieldDefault") }}</span>
              <span v-if="!field.active" class="badge badge-warning badge-sm">{{ $t("settings.customFieldInactive") }}</span>
              <span v-if="field.required" class="badge badge-error badge-sm">{{ $t("settings.customFieldRequired") }}</span>
            </div>
            <p class="text-sm opacity-60">{{ field.key }} &middot; {{ field.inputType }}</p>
            <p v-if="field.description" class="mt-1 text-sm opacity-70">{{ field.description }}</p>
          </div>
          <div class="flex gap-2">
            <UiButton variant="ghost" size="sm" @click="openEdit(field)">
              {{ $t("common.edit") }}
            </UiButton>
            <UiButton
              v-if="!field.isDefault"
              variant="errorOutline"
              size="sm"
              @click="deleteField(field)"
            >
              {{ $t("common.delete") }}
            </UiButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Tags Section (for mod_tags default field) -->
    <div v-if="tags.length > 0" class="space-y-4">
      <h2 class="text-xl font-bold">{{ $t("settings.tagLibraryTitle") }}</h2>
      <div class="flex flex-wrap gap-2">
        <div
          v-for="tag in tags"
          :key="tag.id"
          class="flex items-center gap-1 rounded-lg bg-base-200 px-3 py-1"
        >
          <span class="text-sm">{{ tag.name }}</span>
          <button
            type="button"
            class="btn btn-ghost btn-xs"
            :aria-label="$t('common.delete')"
            @click="deleteTag(tag)"
          >
            <Icon name="proicons:cancel" class="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>

    <dialog class="modal" :class="{ 'modal-open': showForm }" :open="showForm">
      <div class="modal-box max-w-xl bg-surface-2 shadow-lg" @keydown.esc="closeForm">
        <button
          type="button"
          class="btn btn-ghost btn-circle btn-sm absolute right-3 top-3"
          :aria-label="$t('common.close')"
          @click="closeForm"
        >
          <Icon name="proicons:cancel" class="h-5 w-5" />
        </button>

        <UiModalTitle
          :title="editingField ? $t('settings.customFieldEdit') : $t('settings.customFieldCreate')"
          :subtitle="$t('settings.customFieldModalSubtitle')"
        />

        <div class="mt-6 space-y-6">
          <UiInput
            v-if="!editingField"
            v-model="form.key"
            :label="$t('settings.customFieldKey')"
            placeholder="my_field_key"
          />
          <UiInput v-model="form.label" :label="$t('settings.customFieldLabel')" />
          <UiTextarea v-model="form.description" :label="$t('settings.customFieldDescription')" :rows="2" />

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <UiSelect v-model="form.inputType" :label="$t('settings.customFieldInputType')">
              <option v-for="opt in inputTypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </UiSelect>
            <UiInput v-model.number="form.sortOrder" :label="$t('settings.customFieldSortOrder')" type="number" />
          </div>

          <UiTextarea
            v-if="hasOptions"
            v-model="form.options"
            :label="$t('settings.customFieldOptions')"
            :rows="3"
          />

          <div v-if="isSlider" class="grid grid-cols-3 gap-4">
            <UiInput v-model.number="form.sliderMin" label="Min" type="number" />
            <UiInput v-model.number="form.sliderMax" label="Max" type="number" />
            <UiInput v-model.number="form.sliderStep" label="Step" type="number" />
          </div>

          <div class="flex flex-wrap gap-x-8 gap-y-2">
            <UiCheckbox v-model="form.required" :label="$t('settings.customFieldRequired')" />
            <UiCheckbox v-model="form.active" :label="$t('settings.customFieldActive')" />
          </div>

          <div class="space-y-3">
            <h4 class="text-sm font-semibold text-base-content/70">{{ $t("settings.customFieldPermissions") }}</h4>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <UiCheckbox v-model="form.userCanView" :label="$t('settings.customFieldUserCanView')" />
              <UiCheckbox v-model="form.userCanEdit" :label="$t('settings.customFieldUserCanEdit')" />
              <UiCheckbox v-model="form.modCanView" :label="$t('settings.customFieldModCanView')" />
              <UiCheckbox v-model="form.modCanEdit" :label="$t('settings.customFieldModCanEdit')" />
            </div>
          </div>

          <div v-if="saveError" class="text-error text-sm">{{ saveError }}</div>
        </div>

        <div class="modal-action mt-6">
          <UiButton variant="secondary" @click="closeForm">{{ $t("common.cancel") }}</UiButton>
          <UiButton :disabled="savePending" @click="saveField">
            {{ savePending ? $t("common.loading") : $t("common.save") }}
          </UiButton>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="button" @click="closeForm">{{ $t("common.close") }}</button>
      </form>
    </dialog>
  </section>
</template>
