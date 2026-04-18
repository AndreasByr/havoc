<script setup lang="ts">
import type { SimpleFormSection } from "@guildora/shared";

const { t } = useI18n();

type SaveStatus = "idle" | "saving" | "saved" | "error";
type PublishStatus = "idle" | "publishing" | "published" | "error";

const props = defineProps<{
  sections: SimpleFormSection[];
  saveStatus: SaveStatus;
  publishStatus: PublishStatus;
  hasUnpublishedChanges: boolean;
  canUndo: boolean;
  canRedo: boolean;
}>();

const emit = defineEmits<{
  (e: "update:sections", sections: SimpleFormSection[]): void;
  (e: "change" | "undo" | "redo" | "publish" | "discard"): void;
}>();

const confirmDiscard = ref(false);

// Section management
function addSection() {
  const id = `group_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const updated = [...props.sections, {
    id,
    title: `${t("applications.flowBuilder.simpleMode.sectionTitle")} ${props.sections.length + 1}`,
    items: []
  }];
  emit("update:sections", updated);
  emit("change");
}

function updateSectionTitle(index: number, title: string) {
  const updated = [...props.sections];
  updated[index] = { ...updated[index], title };
  emit("update:sections", updated);
}

function updateSectionItems(index: number, items: SimpleFormSection["items"]) {
  const updated = [...props.sections];
  updated[index] = { ...updated[index], items };
  emit("update:sections", updated);
}

function deleteSection(index: number) {
  const updated = props.sections.filter((_, i) => i !== index);
  emit("update:sections", updated);
  emit("change");
}

function onSectionChange() {
  emit("change");
}

function handleDiscard() {
  confirmDiscard.value = false;
  emit("discard");
}
</script>

<template>
  <div class="simple-builder">
    <!-- Toolbar strip -->
    <div class="simple-builder__toolbar">
      <div class="simple-builder__toolbar-left">
        <button class="btn btn-ghost btn-sm" :disabled="!canUndo" :title="t('applications.flowBuilder.toolbar.undoTooltip')" @click="$emit('undo')">
          <Icon name="proicons:undo" />
        </button>
        <button class="btn btn-ghost btn-sm" :disabled="!canRedo" :title="t('applications.flowBuilder.toolbar.redoTooltip')" @click="$emit('redo')">
          <Icon name="proicons:redo" />
        </button>
        <span v-if="saveStatus === 'saving'" class="toolbar-status">{{ t("applications.flowBuilder.toolbar.saving") }}...</span>
        <span v-else-if="saveStatus === 'saved'" class="toolbar-status toolbar-status--success">{{ t("applications.flowBuilder.toolbar.saved") }}</span>
        <span v-else-if="saveStatus === 'error'" class="toolbar-status toolbar-status--error">{{ t("applications.flowBuilder.toolbar.saveFailed") }}</span>
      </div>
      <div class="simple-builder__toolbar-right">
        <template v-if="hasUnpublishedChanges">
          <span class="text-xs" style="color: var(--color-warning)">{{ t("applications.flowBuilder.toolbar.unpublishedChanges") }}</span>
          <button class="btn btn-ghost btn-sm" @click="confirmDiscard = true">
            {{ t("applications.flowBuilder.toolbar.discard") }}
          </button>
          <button
            class="btn btn-sm"
            style="background: var(--color-accent); color: var(--color-accent-content)"
            :disabled="publishStatus === 'publishing'"
            @click="$emit('publish')"
          >
            {{ publishStatus === "publishing" ? t("applications.flowBuilder.toolbar.publishing") : t("applications.flowBuilder.toolbar.publish") }}
          </button>
        </template>
      </div>
    </div>

    <!-- Discard confirmation -->
    <div v-if="confirmDiscard" class="simple-builder__discard-bar">
      <span class="text-sm">{{ t("applications.flowBuilder.toolbar.confirmDiscard") }}</span>
      <div class="flex gap-2">
        <button class="btn btn-sm btn-error" @click="handleDiscard">{{ t("applications.flowBuilder.toolbar.discard") }}</button>
        <button class="btn btn-sm btn-ghost" @click="confirmDiscard = false">{{ t("common.cancel") }}</button>
      </div>
    </div>

    <!-- Sections list -->
    <div class="simple-builder__content">
      <ApplicationsFlowBuilderSimpleFormSection
        v-for="(section, index) in sections"
        :key="section.id"
        :section="section"
        :section-index="index"
        :is-only="sections.length === 1"
        @update-title="(title) => updateSectionTitle(index, title)"
        @update-items="(items) => updateSectionItems(index, items)"
        @delete="deleteSection(index)"
        @change="onSectionChange"
      />

      <button class="simple-builder__add-section" @click="addSection">
        <Icon name="proicons:plus" />
        {{ t("applications.flowBuilder.simpleMode.addSection") }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.simple-builder {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.simple-builder__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--color-line);
  background: var(--color-surface-1);
  flex-shrink: 0;
}

.simple-builder__toolbar-left {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.simple-builder__toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.toolbar-status {
  font-size: 0.75rem;
  color: var(--color-base-content-secondary);
  margin-left: 0.5rem;
}

.toolbar-status--success {
  color: var(--color-success);
}

.toolbar-status--error {
  color: var(--color-error);
}

.simple-builder__discard-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 1rem;
  background: var(--color-surface-2);
  border-bottom: 1px solid var(--color-line);
}

.simple-builder__content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 48rem;
  margin: 0 auto;
  width: 100%;
}

.simple-builder__add-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  color: var(--color-accent);
  border: 2px dashed var(--color-line);
  border-radius: 1rem;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.simple-builder__add-section:hover {
  border-color: var(--color-accent);
  background: var(--color-surface-1);
}
</style>
