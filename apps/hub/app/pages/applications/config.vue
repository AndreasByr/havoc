<script setup lang="ts">
definePageMeta({
  middleware: ["admin"],
});

const { t } = useI18n();

useCookie<string>("guildora_applications_last_path", { sameSite: "lax" }).value = "/applications/config";

type ConfigResponse = {
  notificationOverview: Array<{
    flowId: string;
    flowName: string;
    moderators: Array<{ userId: string; displayName: string }>;
  }>;
};

const { data, pending, error } = await useFetch<ConfigResponse>("/api/applications/config");

// Cleanup trigger
const cleanupPending = ref(false);
const cleanupResult = ref<{ deletedApplications: number; deletedTokens: number } | null>(null);

const runCleanup = async () => {
  cleanupPending.value = true;
  cleanupResult.value = null;
  try {
    const result = await $fetch<{ deletedApplications: number; deletedTokens: number }>(
      "/api/applications/archive/cleanup",
      { method: "POST" }
    );
    cleanupResult.value = result;
  } finally {
    cleanupPending.value = false;
  }
};
</script>

<template>
  <section class="space-y-6">
    <h1 class="text-2xl font-semibold">{{ t("applications.config") }}</h1>

    <div v-if="pending" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-md" />
    </div>
    <div v-else-if="error" class="alert alert-error">{{ t("common.error") }}</div>

    <template v-else>
      <!-- Notification Overview -->
      <div class="config-section">
        <h2 class="config-section__title">{{ t("applications.configPage.moderatorNotifications") }}</h2>
        <p class="text-sm mb-3" style="color: var(--color-base-content-secondary)">
          {{ t("applications.configPage.moderatorNotificationsDescription") }}
        </p>
        <div v-if="data?.notificationOverview.length" class="space-y-3">
          <div
            v-for="item in data.notificationOverview"
            :key="item.flowId"
            class="rounded-lg p-3"
            style="background: var(--color-surface-3)"
          >
            <p class="font-medium text-sm mb-1">{{ item.flowName }}</p>
            <div v-if="item.moderators.length" class="flex flex-wrap gap-2">
              <span
                v-for="mod in item.moderators"
                :key="mod.userId"
                class="text-xs px-2 py-0.5 rounded"
                style="background: var(--color-surface-2)"
              >
                {{ mod.displayName }}
              </span>
            </div>
            <p v-else class="text-xs" style="color: var(--color-base-content-secondary)">
              {{ t("applications.configPage.noModsSubscribed") }}
            </p>
          </div>
        </div>
        <p v-else class="text-sm" style="color: var(--color-base-content-secondary)">
          {{ t("applications.configPage.noFlowsYet") }}
        </p>
      </div>

      <!-- Archive Cleanup -->
      <div class="config-section">
        <h2 class="config-section__title">{{ t("applications.configPage.archiveCleanup") }}</h2>
        <p class="text-sm mb-3" style="color: var(--color-base-content-secondary)">
          {{ t("applications.configPage.archiveCleanupDescription") }}
        </p>
        <button
          class="btn btn-outline btn-sm"
          :disabled="cleanupPending"
          @click="runCleanup"
        >
          {{ cleanupPending ? t("applications.configPage.cleaningUp") : t("applications.configPage.runCleanup") }}
        </button>
        <div v-if="cleanupResult" class="mt-2 text-sm" style="color: var(--color-success)">
          {{ t("applications.configPage.cleanupResult", { apps: cleanupResult.deletedApplications, tokens: cleanupResult.deletedTokens }) }}
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.config-section {
  border-radius: 0.75rem;
  padding: 1.5rem;
  background: var(--color-surface-2);
  box-shadow: var(--shadow-sm);
}

.config-section__title {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1rem;
}
</style>
