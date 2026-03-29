<script setup lang="ts">
const props = defineProps<{
  open: boolean;
  selectedIds: string[];
}>();

const emit = defineEmits<{
  (event: "close"): void;
  (event: "done"): void;
}>();

const { t } = useI18n();

const targetRoleId = ref<number | null>(null);
const communityRoles = ref<{ id: number; name: string; permissionRoleName: string }[]>([]);
const loading = ref(false);
const result = ref<{
  succeeded: string[];
  failed: { userId: string; error: string }[];
  skippedSuperadmins: string[];
} | null>(null);
const errorMessage = ref("");

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return;
    targetRoleId.value = null;
    result.value = null;
    errorMessage.value = "";
    try {
      const data = await $fetch<{ communityRoles: { id: number; name: string; permissionRoleName: string }[] }>("/api/mod/community-roles");
      communityRoles.value = data.communityRoles;
    } catch {
      communityRoles.value = [];
    }
  }
);

async function execute() {
  if (!targetRoleId.value || props.selectedIds.length === 0) return;
  loading.value = true;
  errorMessage.value = "";
  try {
    result.value = await $fetch("/api/mod/users/batch-community-role", {
      method: "POST",
      body: {
        userIds: props.selectedIds,
        communityRoleId: targetRoleId.value
      }
    });
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
    <div class="modal-box" role="dialog" aria-modal="true">
      <UiModalTitle :title="t('bulk.roleChangeTitle')" :subtitle="t('bulk.roleChangeSubtitle', { count: selectedIds.length })" />

      <template v-if="!result">
        <div class="mt-4 space-y-4">
          <UiSelect v-model.number="targetRoleId" :label="t('bulk.targetRole')">
            <option :value="null" disabled>{{ t("bulk.selectRole") }}</option>
            <option v-for="role in communityRoles" :key="role.id" :value="role.id">
              {{ role.name }}
            </option>
          </UiSelect>

          <p class="text-sm opacity-60">{{ t("bulk.superadminHint") }}</p>

          <div v-if="errorMessage" class="alert alert-error">{{ errorMessage }}</div>
        </div>

        <div class="modal-action">
          <UiButton variant="ghost" @click="close">{{ t("common.cancel") }}</UiButton>
          <UiButton :disabled="!targetRoleId || loading" @click="execute">
            {{ loading ? t("common.loading") : t("bulk.executeRoleChange") }}
          </UiButton>
        </div>
      </template>

      <template v-else>
        <div class="mt-4 space-y-3">
          <div v-if="result.succeeded.length" class="alert alert-success">
            {{ t("bulk.succeededCount", { count: result.succeeded.length }) }}
          </div>
          <div v-if="result.skippedSuperadmins.length" class="alert alert-warning">
            {{ t("bulk.skippedSuperadmins", { count: result.skippedSuperadmins.length }) }}
          </div>
          <div v-if="result.failed.length" class="alert alert-error">
            {{ t("bulk.failedCount", { count: result.failed.length }) }}
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
