<script setup lang="ts">
definePageMeta({
  middleware: ["moderator"],
});

const { t } = useI18n();
const router = useRouter();

useCookie<string>("guildora_applications_last_path", { sameSite: "lax" }).value = "/applications/flows";

type FlowValidationWarning = {
  key: string;
  category: "graph" | "settings" | "environment";
};

type FlowItem = {
  id: string;
  name: string;
  status: "draft" | "active" | "inactive";
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  warnings: FlowValidationWarning[];
};

type FlowsResponse = {
  flows: FlowItem[];
};

const { data, pending, error, refresh } = await useFetch<FlowsResponse>("/api/applications/flows");
const actionPending = ref(false);
const showNewFlowInput = ref(false);
const newFlowName = ref("");

const statusBadgeClass = (status: string) => {
  if (status === "active") return "flow-badge--active";
  if (status === "inactive") return "flow-badge--inactive";
  return "flow-badge--draft";
};

const createFlow = async () => {
  if (!newFlowName.value.trim()) return;
  actionPending.value = true;
  try {
    const result = await $fetch<{ flow: FlowItem }>("/api/applications/flows", {
      method: "POST",
      body: { name: newFlowName.value.trim() }
    });
    newFlowName.value = "";
    showNewFlowInput.value = false;
    await router.push(`/applications/flows/${result.flow.id}`);
  } finally {
    actionPending.value = false;
  }
};

const duplicateFlow = async (flowId: string) => {
  actionPending.value = true;
  try {
    await $fetch(`/api/applications/flows/${flowId}/duplicate`, { method: "POST" });
    await refresh();
  } finally {
    actionPending.value = false;
  }
};

const deleteFlow = async (flowId: string) => {
  actionPending.value = true;
  try {
    await $fetch(`/api/applications/flows/${flowId}`, { method: "DELETE" });
    await refresh();
  } finally {
    actionPending.value = false;
  }
};
</script>

<template>
  <section class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">{{ t("applications.flows") }}</h1>
        <p class="mt-1 text-sm" style="color: var(--color-base-content-secondary)">
          {{ t("applications.flowsDescription") }}
        </p>
      </div>
      <button
        class="btn btn-primary btn-sm"
        :disabled="actionPending"
        @click="showNewFlowInput = true"
      >
        {{ t("applications.actions.create") }}
      </button>
    </div>

    <!-- New flow input -->
    <div
      v-if="showNewFlowInput"
      class="flex items-center gap-3 rounded-xl p-4"
      style="background: var(--color-surface-2)"
    >
      <input
        v-model="newFlowName"
        type="text"
        class="input input-sm flex-1"
        :placeholder="t('applications.newFlow')"
        @keyup.enter="createFlow"
      />
      <button class="btn btn-primary btn-sm" :disabled="!newFlowName.trim() || actionPending" @click="createFlow">
        {{ t("applications.actions.create") }}
      </button>
      <button class="btn btn-ghost btn-sm" @click="showNewFlowInput = false; newFlowName = ''">
        {{ t("common.cancel") }}
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="pending" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-md" />
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="alert alert-error">{{ t("common.error") }}</div>

    <!-- Empty state -->
    <div
      v-else-if="!data?.flows.length"
      class="flex flex-col items-center justify-center gap-3 py-16 text-center"
      style="color: var(--color-base-content-secondary)"
    >
      <Icon name="proicons:checkmark-circle" class="text-4xl opacity-40" />
      <p>{{ t("applications.empty.flows") }}</p>
    </div>

    <!-- Flow list -->
    <div v-else class="space-y-3">
      <article
        v-for="flow in data.flows"
        :key="flow.id"
        class="flow-card"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <NuxtLink
                :to="`/applications/flows/${flow.id}`"
                class="text-lg font-semibold hover:underline"
                style="color: var(--color-base-content)"
              >
                {{ flow.name }}
              </NuxtLink>
              <span class="flow-badge" :class="statusBadgeClass(flow.status)">
                {{ t(`applications.status.${flow.status}`) }}
              </span>
            </div>
            <div v-if="flow.warnings.length > 0" class="flow-warnings">
              <div v-for="warning in flow.warnings" :key="warning.key" class="flow-warning">
                <Icon name="proicons:warning" class="flow-warning-icon" />
                <span>{{ t(`applications.warnings.${warning.key}`) }}</span>
              </div>
            </div>
            <p class="mt-1 text-sm" style="color: var(--color-base-content-secondary)">
              {{ new Date(flow.updatedAt).toLocaleDateString() }}
            </p>
          </div>
          <div class="flex gap-2">
            <NuxtLink
              :to="`/applications/flows/${flow.id}`"
              class="btn btn-outline btn-sm"
            >
              {{ t("applications.actions.edit") }}
            </NuxtLink>
            <NuxtLink
              :to="`/applications/flows/${flow.id}/settings`"
              class="btn btn-outline btn-sm"
            >
              {{ t("applications.actions.settings") }}
            </NuxtLink>
            <button
              class="btn btn-ghost btn-sm"
              :disabled="actionPending"
              @click="duplicateFlow(flow.id)"
            >
              {{ t("applications.actions.duplicate") }}
            </button>
            <button
              class="btn btn-error btn-outline btn-sm"
              :disabled="actionPending"
              @click="deleteFlow(flow.id)"
            >
              {{ t("applications.actions.delete") }}
            </button>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.flow-card {
  border-radius: 0.75rem;
  padding: 1rem 1.25rem;
  background: var(--color-surface-2);
  box-shadow: var(--shadow-sm);
}

.flow-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.flow-badge--draft {
  background: var(--color-surface-3);
  color: var(--color-base-content-secondary);
}

.flow-badge--active {
  background: color-mix(in srgb, var(--color-success) 15%, transparent);
  color: var(--color-success);
}

.flow-badge--inactive {
  background: color-mix(in srgb, var(--color-warning) 15%, transparent);
  color: var(--color-warning);
}

.flow-warnings {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.flow-warning {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  color: var(--color-warning);
}

.flow-warning-icon {
  flex-shrink: 0;
  font-size: 1rem;
}
</style>
