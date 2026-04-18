<script setup lang="ts">
import type { LinearizedInputField } from "@guildora/shared";

const props = defineProps<{
  field: LinearizedInputField;
  modelValue: unknown;
  token?: string;
  flowId?: string;
  discordUsername?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: unknown): void;
}>();

const { t } = useI18n();

const value = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v)
});

const yesNoOptions = computed(() => [
  { id: "yes", label: t("applications.form.yes") },
  { id: "no", label: t("applications.form.no") }
]);

const effectiveOptions = computed(() => {
  if (props.field.inputType === "yes_no") return yesNoOptions.value;
  return props.field.options || [];
});

function roleColorHex(color: number): string {
  return color === 0 ? "#99aab5" : `#${color.toString(16).padStart(6, "0")}`;
}

// Multi-select helpers
function isChecked(optionId: string): boolean {
  return Array.isArray(value.value) && (value.value as string[]).includes(optionId);
}

function toggleOption(optionId: string) {
  const current = Array.isArray(value.value) ? [...(value.value as string[])] : [];
  const idx = current.indexOf(optionId);
  if (idx >= 0) {
    current.splice(idx, 1);
  } else {
    current.push(optionId);
  }
  value.value = current;
}

// File upload state
const uploading = ref(false);
const uploadError = ref("");

async function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || !props.token || !props.flowId) return;

  uploading.value = true;
  uploadError.value = "";

  const formData = new FormData();
  formData.append("token", props.token);
  formData.append("file", file);

  try {
    const result = await $fetch<{ uploadId: string }>(`/api/apply/${props.flowId}/upload`, {
      method: "POST",
      body: formData
    });
    value.value = result.uploadId;
  } catch (err: unknown) {
    const e = err as { data?: { message?: string }; statusMessage?: string };
    uploadError.value = e?.data?.message || e?.statusMessage || "Upload failed";
  } finally {
    uploading.value = false;
  }
}

// Pre-fill discord username
onMounted(() => {
  if (props.field.inputType === "discord_username" && !value.value && props.discordUsername) {
    value.value = props.discordUsername;
  }
});
</script>

<template>
  <div class="form-field">
    <label class="form-field__label">
      {{ field.label }}
      <span v-if="field.required" class="form-field__required">*</span>
    </label>
    <p v-if="field.description" class="form-field__description">{{ field.description }}</p>

    <!-- Short Text / Email / Discord Username / Display Name -->
    <input
      v-if="['short_text', 'email', 'discord_username', 'display_name'].includes(field.inputType)"
      v-model="value"
      :type="field.inputType === 'email' ? 'email' : 'text'"
      class="input w-full"
      :placeholder="field.placeholder"
      :required="field.required"
    >

    <!-- Long Text -->
    <textarea
      v-else-if="field.inputType === 'long_text'"
      v-model="value"
      class="textarea w-full"
      :placeholder="field.placeholder"
      :required="field.required"
      rows="4"
    />

    <!-- Number -->
    <input
      v-else-if="field.inputType === 'number'"
      v-model.number="value"
      type="number"
      class="input w-full"
      :placeholder="field.placeholder"
      :required="field.required"
      :min="field.validation?.minValue"
      :max="field.validation?.maxValue"
    >

    <!-- Date -->
    <input
      v-else-if="field.inputType === 'date'"
      v-model="value"
      type="date"
      class="input w-full"
      :required="field.required"
    >

    <!-- Single Select Radio / Yes-No -->
    <div
      v-else-if="field.inputType === 'single_select_radio' || field.inputType === 'yes_no'"
      class="form-field__options"
    >
      <label
        v-for="opt in effectiveOptions"
        :key="opt.id"
        class="form-field__radio-item"
      >
        <input
          type="radio"
          :name="`field_${field.nodeId}`"
          :value="opt.id"
          :checked="value === opt.id"
          class="radio"
          @change="value = opt.id"
        >
        <span>{{ opt.label }}</span>
      </label>
    </div>

    <!-- Single Select Dropdown -->
    <select
      v-else-if="field.inputType === 'single_select_dropdown'"
      v-model="value"
      class="select w-full"
      :required="field.required"
    >
      <option value="" disabled>{{ field.placeholder || t('applications.form.select') }}</option>
      <option v-for="opt in effectiveOptions" :key="opt.id" :value="opt.id">
        {{ opt.label }}
      </option>
    </select>

    <!-- Multi Select (Checkboxes) -->
    <div
      v-else-if="field.inputType === 'multi_select'"
      class="form-field__options"
    >
      <label
        v-for="opt in effectiveOptions"
        :key="opt.id"
        class="form-field__checkbox-item"
      >
        <input
          type="checkbox"
          :checked="isChecked(opt.id)"
          class="checkbox"
          @change="toggleOption(opt.id)"
        >
        <span>{{ opt.label }}</span>
      </label>
    </div>

    <!-- Discord Role Single Select (Radio) -->
    <div
      v-else-if="field.inputType === 'discord_role_single'"
      class="form-field__options"
    >
      <label
        v-for="opt in (field.discordRoleOptions || [])"
        :key="opt.roleId"
        class="form-field__radio-item"
      >
        <input
          type="radio"
          :name="`field_${field.nodeId}`"
          :value="opt.roleId"
          :checked="value === opt.roleId"
          class="radio"
          @change="value = opt.roleId"
        >
        <span class="role-color-dot" :style="{ backgroundColor: roleColorHex(opt.color) }" />
        <span v-if="opt.unicodeEmoji">{{ opt.unicodeEmoji }}</span>
        <span>{{ opt.name }}</span>
      </label>
    </div>

    <!-- Discord Role Multi Select (Checkboxes) -->
    <div
      v-else-if="field.inputType === 'discord_role_multi'"
      class="form-field__options"
    >
      <label
        v-for="opt in (field.discordRoleOptions || [])"
        :key="opt.roleId"
        class="form-field__checkbox-item"
      >
        <input
          type="checkbox"
          :checked="isChecked(opt.roleId)"
          class="checkbox"
          @change="toggleOption(opt.roleId)"
        >
        <span class="role-color-dot" :style="{ backgroundColor: roleColorHex(opt.color) }" />
        <span v-if="opt.unicodeEmoji">{{ opt.unicodeEmoji }}</span>
        <span>{{ opt.name }}</span>
      </label>
    </div>

    <!-- File Upload -->
    <div v-else-if="field.inputType === 'file_upload'">
      <input
        type="file"
        class="file-input w-full"
        accept=".jpg,.jpeg,.png,.pdf"
        @change="handleFileUpload"
      >
      <p v-if="uploading" class="text-sm mt-1" style="color: var(--color-base-content-secondary)">
        {{ t("applications.form.uploading") }}
      </p>
      <p v-if="uploadError" class="text-sm mt-1" style="color: var(--color-error)">
        {{ uploadError }}
      </p>
      <p v-if="value && !uploading" class="text-sm mt-1" style="color: var(--color-success)">
        {{ t("applications.form.fileUploaded") }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.form-field {
  margin-bottom: 1.5rem;
}

.form-field__label {
  display: block;
  font-size: 0.9375rem;
  font-weight: 600;
  margin-bottom: 0.375rem;
  color: var(--color-base-content);
}

.form-field__required {
  color: var(--color-error);
}

.form-field__description {
  font-size: 0.8125rem;
  color: var(--color-base-content-secondary);
  margin-bottom: 0.5rem;
}

.form-field__options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-field__radio-item,
.form-field__checkbox-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
}

.role-color-dot {
  display: inline-block;
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>
