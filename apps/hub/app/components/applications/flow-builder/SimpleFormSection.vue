<script setup lang="ts">
import draggable from "vuedraggable";
import type { FlowInputType, FlowInputNodeData, FlowInfoNodeData, FlowRoleAssignmentNodeData, SimpleFormItem } from "@guildora/shared";

const { t } = useI18n();

const props = defineProps<{
  section: { id: string; title: string; items: SimpleFormItem[] };
  sectionIndex: number;
  isOnly: boolean;
}>();

const emit = defineEmits<{
  (e: "update-title", title: string): void;
  (e: "update-items", items: SimpleFormItem[]): void;
  (e: "delete" | "change"): void;
}>();

// Inline title editing
const editingTitle = ref(false);
const titleInput = ref<HTMLInputElement>();
const localTitle = ref(props.section.title);

watch(() => props.section.title, (v) => { localTitle.value = v; });

function startEditTitle() {
  localTitle.value = props.section.title;
  editingTitle.value = true;
  nextTick(() => titleInput.value?.focus());
}

function commitTitle() {
  editingTitle.value = false;
  emit("update-title", localTitle.value);
  emit("change");
}

// Drag & drop items
const localItems = computed({
  get: () => props.section.items,
  set: (val) => {
    emit("update-items", val);
    emit("change");
  }
});

// Add field
function onAddField(type: "input" | "info" | "role_assignment", inputType?: FlowInputType) {
  const id = `field_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  let data: FlowInputNodeData | FlowInfoNodeData | FlowRoleAssignmentNodeData;

  if (type === "input") {
    data = {
      inputType: inputType ?? "short_text",
      label: "",
      required: false
    } as FlowInputNodeData;
  } else if (type === "info") {
    data = { markdown: "" } as FlowInfoNodeData;
  } else {
    data = { roleIds: [], roleNameSnapshots: [] } as FlowRoleAssignmentNodeData;
  }

  const newItem: SimpleFormItem = { id, type, data };
  const updated = [...props.section.items, newItem];
  emit("update-items", updated);
  emit("change");
}

function onUpdateField(index: number, data: SimpleFormItem["data"]) {
  const updated = [...props.section.items];
  updated[index] = { ...updated[index], data };
  emit("update-items", updated);
  emit("change");
}

function onDeleteField(index: number) {
  const updated = props.section.items.filter((_, i) => i !== index);
  emit("update-items", updated);
  emit("change");
}

// Delete section confirmation
const confirmDelete = ref(false);

function requestDelete() {
  if (props.isOnly) return;
  confirmDelete.value = true;
}

function cancelDelete() {
  confirmDelete.value = false;
}

function doDelete() {
  confirmDelete.value = false;
  emit("delete");
}
</script>

<template>
  <div class="simple-section">
    <!-- Section header -->
    <div class="simple-section__header">
      <div class="simple-section__title-row">
        <input
          v-if="editingTitle"
          ref="titleInput"
          :value="localTitle"
          class="simple-section__title-input"
          @input="localTitle = ($event.target as HTMLInputElement).value"
          @blur="commitTitle"
          @keydown.enter="commitTitle"
        >
        <h3 v-else class="simple-section__title" @click="startEditTitle">
          {{ section.title || t("applications.flowBuilder.simpleMode.untitledSection") }}
          <Icon name="proicons:edit" class="simple-section__edit-icon" />
        </h3>
      </div>
      <button
        v-if="!isOnly"
        class="btn btn-ghost btn-xs"
        style="color: var(--color-error)"
        :title="t('applications.flowBuilder.simpleMode.deleteSection')"
        @click="requestDelete"
      >
        <Icon name="proicons:delete" class="text-sm" />
      </button>
    </div>

    <!-- Delete confirmation -->
    <div v-if="confirmDelete" class="simple-section__confirm-delete">
      <span class="text-sm">{{ t("applications.flowBuilder.simpleMode.deleteSectionConfirm") }}</span>
      <div class="flex gap-2 mt-2">
        <button class="btn btn-sm btn-error" @click="doDelete">{{ t("common.delete") }}</button>
        <button class="btn btn-sm btn-ghost" @click="cancelDelete">{{ t("common.cancel") }}</button>
      </div>
    </div>

    <!-- Fields list with drag & drop -->
    <draggable
      v-model="localItems"
      item-key="id"
      handle=".simple-field__handle"
      :animation="200"
      class="simple-section__fields"
    >
      <template #item="{ element, index }">
        <ApplicationsFlowBuilderSimpleFormField
          :item="element"
          @update="(data) => onUpdateField(index, data)"
          @delete="onDeleteField(index)"
        />
      </template>
    </draggable>

    <!-- Empty state -->
    <div v-if="section.items.length === 0" class="simple-section__empty">
      {{ t("applications.flowBuilder.simpleMode.emptySection") }}
    </div>

    <!-- Add field -->
    <ApplicationsFlowBuilderAddFieldDropdown @add="onAddField" />
  </div>
</template>

<style scoped>
.simple-section {
  background: var(--color-surface-1);
  border-radius: 1rem;
  box-shadow: var(--shadow-sm);
  padding: 1.25rem;
}

.simple-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.simple-section__title-row {
  flex: 1;
  min-width: 0;
}

.simple-section__title {
  font-size: 1.125rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}

.simple-section__edit-icon {
  opacity: 0;
  transition: opacity 0.15s;
  font-size: 0.875rem;
  color: var(--color-base-content-secondary);
}

.simple-section__title:hover .simple-section__edit-icon {
  opacity: 1;
}

.simple-section__title-input {
  font-size: 1.125rem;
  font-weight: 600;
  background: transparent;
  border: none;
  border-bottom: 2px solid var(--color-accent);
  outline: none;
  width: 100%;
  padding: 0 0 0.125rem;
  color: var(--color-base-content);
}

.simple-section__fields {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 0.5rem;
}

.simple-section__empty {
  text-align: center;
  padding: 1.5rem 1rem;
  font-size: 0.875rem;
  color: var(--color-base-content-secondary);
}

.simple-section__confirm-delete {
  padding: 0.75rem;
  margin-bottom: 0.75rem;
  border-radius: 0.5rem;
  background: var(--color-surface-2);
}
</style>
