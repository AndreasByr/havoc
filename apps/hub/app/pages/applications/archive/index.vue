<script setup lang="ts">
definePageMeta({
  middleware: ["moderator"],
});

const { t } = useI18n();

useCookie<string>("guildora_applications_last_path", { sameSite: "lax" }).value = "/applications/archive";

type ArchiveItem = {
  id: string;
  flowId: string;
  flowName: string;
  discordUsername: string;
  discordAvatarUrl: string | null;
  status: string;
  reviewedAt: string | null;
  createdAt: string;
};

const search = ref("");
const statusFilter = ref("");

const { data, pending, error } = await useFetch<{ applications: ArchiveItem[] }>(
  "/api/applications/archive",
  {
    query: computed(() => ({
      search: search.value || undefined,
      status: statusFilter.value || undefined
    }))
  }
);
</script>

<template>
  <section class="space-y-6">
    <h1 class="text-2xl font-semibold">{{ t("applications.archive") }}</h1>

    <!-- Filters -->
    <div class="flex flex-wrap gap-3">
      <input
        v-model="search"
        type="text"
        class="input input-sm w-64"
        placeholder="Search by username..."
      >
      <select v-model="statusFilter" class="select select-sm">
        <option value="">All</option>
        <option value="approved">{{ t("applications.status.approved") }}</option>
        <option value="rejected">{{ t("applications.status.rejected") }}</option>
      </select>
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
      <p>{{ t("applications.empty.archive") }}</p>
    </div>

    <div v-else class="space-y-3">
      <NuxtLink
        v-for="app in data.applications"
        :key="app.id"
        :to="`/applications/archive/${app.id}`"
        class="archive-card"
      >
        <div class="flex items-center gap-3">
          <img
            v-if="app.discordAvatarUrl"
            :src="app.discordAvatarUrl"
            class="w-8 h-8 rounded-full"
            alt=""
          >
          <div class="flex-1 min-w-0">
            <p class="font-medium text-sm" style="color: var(--color-base-content)">{{ app.discordUsername }}</p>
            <p class="text-xs" style="color: var(--color-base-content-secondary)">
              {{ app.flowName }} &middot; {{ new Date(app.createdAt).toLocaleDateString() }}
            </p>
          </div>
          <span
            class="text-xs font-medium px-2 py-0.5 rounded"
            :style="{
              background: app.status === 'approved'
                ? 'color-mix(in srgb, var(--color-success) 15%, transparent)'
                : 'color-mix(in srgb, var(--color-error) 15%, transparent)',
              color: app.status === 'approved' ? 'var(--color-success)' : 'var(--color-error)'
            }"
          >
            {{ t(`applications.status.${app.status}`) }}
          </span>
        </div>
      </NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.archive-card {
  display: block;
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--color-surface-2);
  box-shadow: var(--shadow-sm);
  transition: box-shadow 0.15s;
}

.archive-card:hover {
  box-shadow: var(--shadow-md);
}
</style>
