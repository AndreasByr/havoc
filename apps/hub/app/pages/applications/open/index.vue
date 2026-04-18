<script setup lang="ts">
definePageMeta({
  middleware: ["moderator"],
});

const { t } = useI18n();

useCookie<string>("guildora_applications_last_path", { sameSite: "lax" }).value = "/applications/open";

type ApplicationItem = {
  id: string;
  flowId: string;
  flowName: string;
  discordId: string;
  discordUsername: string;
  discordAvatarUrl: string | null;
  displayNameComposed: string | null;
  hasPendingRoles: boolean;
  createdAt: string;
};

type NotificationItem = {
  flowId: string;
  flowName: string;
  enabled: boolean;
};

const { data, pending, error } = await useFetch<{ applications: ApplicationItem[] }>(
  "/api/applications/open"
);

const { data: notifData, refresh: refreshNotif } = await useFetch<{ flows: NotificationItem[] }>(
  "/api/applications/moderator-notifications"
);

const toggling = ref<string | null>(null);

async function toggleNotification(flowId: string, enabled: boolean) {
  toggling.value = flowId;
  try {
    await $fetch("/api/applications/moderator-notifications", {
      method: "PUT",
      body: { flowId, enabled }
    });
    await refreshNotif();
  } finally {
    toggling.value = null;
  }
}
</script>

<template>
  <section class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold">{{ t("applications.openApplications") }}</h1>
    </div>

    <!-- Notification toggles -->
    <div
      v-if="notifData?.flows?.length"
      class="rounded-xl p-4"
      style="background: var(--color-surface-2)"
    >
      <p class="text-sm font-medium mb-2" style="color: var(--color-base-content-secondary)">
        {{ t("applications.detail.notificationPreferences") }}
      </p>
      <div class="flex flex-wrap gap-3">
        <label
          v-for="item in notifData.flows"
          :key="item.flowId"
          class="flex items-center gap-2 text-sm cursor-pointer"
        >
          <input
            type="checkbox"
            class="toggle toggle-sm"
            :checked="item.enabled"
            :disabled="toggling === item.flowId"
            @change="toggleNotification(item.flowId, !item.enabled)"
          >
          <span>{{ item.flowName }}</span>
        </label>
      </div>
    </div>

    <div v-if="pending" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-md" />
    </div>
    <div v-else-if="error" class="alert alert-error">{{ t("common.error") }}</div>

    <div
      v-else-if="!data?.applications.length"
      class="flex flex-col items-center justify-center gap-3 py-16"
      style="color: var(--color-base-content-secondary)"
    >
      <Icon name="proicons:checkmark-circle" class="text-4xl opacity-40" />
      <p>{{ t("applications.empty.open") }}</p>
    </div>

    <div v-else class="space-y-3">
      <NuxtLink
        v-for="app in data.applications"
        :key="app.id"
        :to="`/applications/open/${app.id}`"
        class="application-card"
      >
        <div class="flex items-center gap-3">
          <img
            v-if="app.discordAvatarUrl"
            :src="app.discordAvatarUrl"
            class="w-10 h-10 rounded-full"
            alt=""
          >
          <div v-else class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold" style="background: var(--color-accent); color: var(--color-accent-content)">
            {{ app.discordUsername.slice(0, 2).toUpperCase() }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-medium" style="color: var(--color-base-content)">{{ app.discordUsername }}</p>
            <p class="text-sm" style="color: var(--color-base-content-secondary)">
              {{ app.flowName }} &middot; {{ new Date(app.createdAt).toLocaleDateString() }}
            </p>
          </div>
          <span
            v-if="app.hasPendingRoles"
            class="text-xs px-2 py-0.5 rounded"
            style="background: color-mix(in srgb, var(--color-warning) 15%, transparent); color: var(--color-warning)"
          >
            {{ t("applications.detail.pendingRoles") }}
          </span>
          <Icon name="proicons:arrow-right" />
        </div>
      </NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.application-card {
  display: block;
  border-radius: 0.75rem;
  padding: 1rem 1.25rem;
  background: var(--color-surface-2);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: box-shadow 0.15s;
}

.application-card:hover {
  box-shadow: var(--shadow-md);
}
</style>
