<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";
import type { NodeProps } from "@vue-flow/core";
import type { FlowInputNodeData } from "@guildora/shared";

const props = defineProps<NodeProps>();

const { t } = useI18n();
const data = computed(() => props.data as FlowInputNodeData);

const inputTypeI18nMap: Record<string, string> = {
  short_text: "shortText",
  long_text: "longText",
  number: "number",
  email: "email",
  single_select_radio: "radioSelect",
  single_select_dropdown: "dropdown",
  multi_select: "multiSelect",
  yes_no: "yesNo",
  date: "date",
  file_upload: "fileUpload",
  discord_username: "discordUsername"
};

const inputTypeLabel = computed(() => {
  const key = inputTypeI18nMap[data.value.inputType];
  return key ? t(`applications.flowBuilder.inputTypes.${key}`) : data.value.inputType;
});
</script>

<template>
  <div class="flow-node flow-node--input">
    <Handle v-if="!parentNode" type="target" :position="Position.Top" />
    <div class="flow-node__header">
      <span class="flow-node__type-badge">{{ inputTypeLabel }}</span>
      <span v-if="data.required" class="flow-node__required">*</span>
    </div>
    <div class="flow-node__label">{{ data.label || t("applications.flowBuilder.inputTypes.untitledField") }}</div>
    <Handle v-if="!parentNode" type="source" :position="Position.Bottom" />
  </div>
</template>

<style scoped>
.flow-node--input {
  min-width: 180px;
  padding: 0.75rem;
  border-radius: 0.75rem;
  background: var(--color-surface-2);
  box-shadow: var(--shadow-sm);
}

.flow-node__header {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-bottom: 0.375rem;
}

.flow-node__type-badge {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 0.0625rem 0.375rem;
  border-radius: 0.25rem;
  background: color-mix(in srgb, var(--color-accent) 15%, transparent);
  color: var(--color-accent);
}

.flow-node__required {
  color: var(--color-error);
  font-weight: 700;
}

.flow-node__label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-base-content);
}
</style>
