<script setup lang="ts">
import type { DisplayNameField } from "@guildora/shared";

interface EditableProfile {
  profileName: string;
  ingameName: string;
  rufname: string | null;
  displayNameParts?: Record<string, string>;
}

const props = withDefaults(defineProps<{
  modelValue: EditableProfile;
  displayNameTemplate?: DisplayNameField[];
  showTitle?: boolean;
}>(), {
  showTitle: true
});

const emit = defineEmits<{
  "update:modelValue": [EditableProfile];
  submit: [];
}>();

const localProfile = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value)
});

const hasTemplate = computed(() => (props.displayNameTemplate ?? []).length > 0);

function updatePart(key: string, value: string) {
  const parts = { ...(localProfile.value.displayNameParts ?? {}) };
  parts[key] = value;
  localProfile.value = { ...localProfile.value, displayNameParts: parts };
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="$emit('submit')">
    <h2 v-if="props.showTitle" class="text-xl font-semibold">{{ $t("profile.title") }}</h2>

    <!-- Template-based dynamic fields -->
    <template v-if="hasTemplate">
      <UiInput
        v-for="field in displayNameTemplate"
        :key="field.key"
        :model-value="localProfile.displayNameParts?.[field.key] ?? ''"
        :label="field.label"
        :required="field.required"
        :maxlength="60"
        :type="field.type === 'number' ? 'number' : 'text'"
        @update:model-value="updatePart(field.key, String($event ?? ''))"
      />
    </template>

    <!-- Legacy two-field layout -->
    <template v-else>
      <UiInput
        v-model="localProfile.ingameName"
        :label="$t('profile.ingameName')"
        :required="true"
        :maxlength="60"
      />

      <UiInput
        v-model="localProfile.rufname"
        :label="$t('profile.rufname')"
        :maxlength="60"
      />
    </template>

    <div class="flex justify-end">
      <button type="submit" class="btn btn-primary">{{ $t("common.save") }}</button>
    </div>
  </form>
</template>
