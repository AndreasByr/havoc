<script setup lang="ts">
const props = defineProps<{
  open: boolean;
  selectedIds: string[];
  memberNames: Map<string, string>;
}>();

const emit = defineEmits<{
  (event: "close" | "done"): void;
}>();

const { t } = useI18n();

type Step = "review" | "confirm" | "result";
const step = ref<Step>("review");
const confirmInput = ref("");
const loading = ref(false);
const errorMessage = ref("");
const result = ref<{
  deleted: number;
  retained: number;
  conflicts: number;
  skipped: number;
  errors: { userId: string; error: string }[];
} | null>(null);

const confirmValid = computed(() => confirmInput.value.trim() === String(props.selectedIds.length));

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    step.value = "review";
    confirmInput.value = "";
    result.value = null;
    errorMessage.value = "";
  }
);

async function execute() {
  if (!confirmValid.value) return;
  loading.value = true;
  errorMessage.value = "";
  try {
    result.value = await $fetch("/api/admin/users/batch-delete", {
      method: "POST",
      body: { userIds: props.selectedIds }
    });
    step.value = "result";
  } catch {
    errorMessage.value = t("common.error");
  } finally {
    loading.value = false;
  }
}

function close() {
  if (result.value) {
    emit("done");
  } else {
    emit("close");
  }
}
</script>

<template>
  <dialog class="modal" :class="{ 'modal-open': open }" :open="open" @cancel.prevent="close">
    <div class="modal-box" role="dialog" aria-modal="true" style="max-width: 32rem;">
      <UiModalTitle :title="t('bulk.deleteTitle')" />

      <!-- Step 1: Review -->
      <template v-if="step === 'review'">
        <div class="mt-4 space-y-3">
          <div class="alert alert-error">
            {{ t("bulk.deleteWarning", { count: selectedIds.length }) }}
          </div>
          <ul class="bulk-member-list">
            <li v-for="id in selectedIds" :key="id" class="bulk-member-list__item">
              {{ memberNames.get(id) || id }}
            </li>
          </ul>
        </div>
        <div class="modal-action">
          <UiButton variant="ghost" @click="close">{{ t("common.cancel") }}</UiButton>
          <UiButton variant="error" @click="step = 'confirm'">{{ t("common.next") }}</UiButton>
        </div>
      </template>

      <!-- Step 2: Confirm -->
      <template v-else-if="step === 'confirm'">
        <div class="mt-4 space-y-4">
          <p class="text-sm">
            {{ t("bulk.confirmPrompt", { count: selectedIds.length }) }}
          </p>
          <UiInput
            v-model="confirmInput"
            :label="t('bulk.confirmLabel')"
            :placeholder="String(selectedIds.length)"
          />
          <div v-if="errorMessage" class="alert alert-error">{{ errorMessage }}</div>
        </div>
        <div class="modal-action">
          <UiButton variant="ghost" @click="step = 'review'">{{ t("common.previous") }}</UiButton>
          <UiButton variant="error" :disabled="!confirmValid || loading" @click="execute">
            {{ loading ? t("common.loading") : t("bulk.confirmDelete") }}
          </UiButton>
        </div>
      </template>

      <!-- Step 3: Result -->
      <template v-else>
        <div class="mt-4 space-y-3">
          <div v-if="result && result.deleted > 0" class="alert alert-success">
            {{ t("bulk.deletedCount", { count: result.deleted }) }}
          </div>
          <div v-if="result && result.retained > 0" class="alert alert-warning">
            {{ t("bulk.retainedCount", { count: result.retained }) }}
          </div>
          <div v-if="result && result.conflicts > 0" class="alert alert-warning">
            {{ t("bulk.conflictsCount", { count: result.conflicts }) }}
          </div>
          <div v-if="result && result.skipped > 0" class="alert alert-info">
            {{ t("bulk.skippedCount", { count: result.skipped }) }}
          </div>
          <div v-if="result && result.errors.length > 0" class="alert alert-error">
            {{ t("bulk.failedCount", { count: result.errors.length }) }}
          </div>
        </div>
        <div class="modal-action">
          <UiButton @click="close">{{ t("common.close") }}</UiButton>
        </div>
      </template>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button type="button" @click="close">Close</button>
    </form>
  </dialog>
</template>

<style scoped>
.bulk-member-list {
  max-height: 12rem;
  overflow-y: auto;
  border-radius: 0.5rem;
  background: var(--color-surface-2);
  padding: 0.5rem;
}

.bulk-member-list__item {
  padding: 0.35rem 0.5rem;
  font-size: 0.875rem;
  color: var(--color-text-primary);
  border-bottom: 1px solid var(--color-line);
}

.bulk-member-list__item:last-child {
  border-bottom: none;
}
</style>
