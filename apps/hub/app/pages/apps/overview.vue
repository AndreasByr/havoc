<script setup lang="ts">
definePageMeta({
  middleware: ["moderator"],
});

const lastPath = useCookie<string | null>("guildora_apps_last_path", { sameSite: "lax" });
lastPath.value = "/apps/overview";

const { t } = useI18n();

type AdminAppsResponse = {
  apps: Array<{
    id: string;
    appId: string;
    name: string;
    version: string;
    status: "active" | "inactive" | "error";
    source: "marketplace" | "sideloaded";
    verified: boolean;
    autoUpdate: boolean;
    repositoryUrl: string | null;
    updatedAt: string;
    manifestValid: boolean;
  }>;
  stats: {
    installed: number;
    active: number;
  };
};

type UpdateCheckResponse = {
  updates: Array<{
    appId: string;
    remoteVersion: string | null;
    updateAvailable: boolean;
    checkError?: boolean;
  }>;
};

const { data, pending, error, refresh } = await useFetch<AdminAppsResponse>("/api/admin/apps");

const updateCheckData = ref<UpdateCheckResponse | null>(null);
const updateCheckPending = ref(false);
const actionPending = ref(false);

const updateInfoByAppId = computed(() =>
  Object.fromEntries((updateCheckData.value?.updates ?? []).map((u) => [u.appId, u]))
);

const fetchUpdateCheck = async () => {
  updateCheckPending.value = true;
  try {
    updateCheckData.value = await $fetch<UpdateCheckResponse>("/api/admin/apps/update-check");
  } catch {
    // Non-critical
  } finally {
    updateCheckPending.value = false;
  }
};

onMounted(() => {
  fetchUpdateCheck();
});

const toggleStatus = async (appId: string, status: "active" | "inactive" | "error") => {
  actionPending.value = true;
  try {
    const nextStatus = status === "active" ? "inactive" : "active";
    await $fetch(`/api/admin/apps/${appId}/status`, {
      method: "PUT",
      body: { status: nextStatus }
    });
    await Promise.all([refresh(), refreshNuxtData("sidebar-navigation")]);
  } catch {
    await refresh();
  } finally {
    actionPending.value = false;
  }
};

const updateApp = async (appId: string) => {
  actionPending.value = true;
  try {
    await $fetch(`/api/admin/apps/${appId}/update`, { method: "POST" });
    await Promise.all([refresh(), refreshNuxtData("sidebar-navigation")]);
    await fetchUpdateCheck();
  } finally {
    actionPending.value = false;
  }
};

const reinstallApp = async (appId: string) => {
  actionPending.value = true;
  try {
    await $fetch(`/api/admin/apps/${appId}/update`, { method: "POST" });
    await Promise.all([refresh(), refreshNuxtData("sidebar-navigation")]);
    await fetchUpdateCheck();
  } finally {
    actionPending.value = false;
  }
};

const toggleAutoUpdate = async (appId: string, current: boolean) => {
  actionPending.value = true;
  try {
    await $fetch(`/api/admin/apps/${appId}/auto-update`, {
      method: "PUT",
      body: { autoUpdate: !current }
    });
    await refresh();
  } finally {
    actionPending.value = false;
  }
};

const removeApp = async (id: string) => {
  actionPending.value = true;
  try {
    await $fetch(`/api/admin/apps/${id}`, {
      method: "DELETE"
    });
    await refreshNuxtData("sidebar-navigation");
    window.location.reload();
  } catch {
    actionPending.value = false;
  }
};

const statusLabel = (status: "active" | "inactive" | "error") => {
  if (status === "active") {
    return t("adminApps.statusActive");
  }
  if (status === "inactive") {
    return t("adminApps.statusInactive");
  }
  return t("adminApps.statusError");
};

const sourceLabel = (source: "marketplace" | "sideloaded") => {
  return source === "marketplace" ? t("adminApps.sourceMarketplace") : t("adminApps.sourceSideloaded");
};
</script>

<template>
  <section class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold md:text-3xl">{{ $t("adminApps.overviewTitle") }}</h1>
        <p class="opacity-80">{{ $t("adminApps.overviewDescription") }}</p>
      </div>
      <button class="btn btn-outline btn-sm" @click="refresh">{{ $t("adminApps.refresh") }}</button>
    </div>

    <div class="grid grid-cols-2 gap-3 md:gap-4">
      <div class="stat rounded-2xl bg-base-200 p-4 shadow-sm">
        <div class="stat-title text-xs md:text-sm">{{ $t("adminApps.installed") }}</div>
        <div class="stat-value text-lg text-primary md:text-xl">{{ data?.stats.installed || 0 }}</div>
      </div>
      <div class="stat rounded-2xl bg-base-200 p-4 shadow-sm">
        <div class="stat-title text-xs md:text-sm">{{ $t("adminApps.active") }}</div>
        <div class="stat-value text-lg text-success md:text-xl">{{ data?.stats.active || 0 }}</div>
      </div>
    </div>

    <div class="card bg-base-200">
      <div class="card-body relative">
        <div
          v-if="actionPending"
          class="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-base-200/60"
        >
          <span class="loading loading-spinner loading-lg" />
        </div>

        <h2 class="card-title">
          {{ $t("adminApps.installedAppsTitle") }}
          <span v-if="updateCheckPending" class="loading loading-spinner loading-xs ml-2" />
        </h2>
        <div v-if="pending" class="loading loading-spinner loading-md" />
        <template v-else>
          <div v-if="error" class="alert alert-error">{{ $t("adminApps.loadError") }}</div>
          <div v-else-if="!(data?.apps || []).length" class="alert alert-info">{{ $t("adminApps.empty") }}</div>
          <div v-if="(data?.apps || []).length" class="space-y-4">
            <article
              v-for="app in data?.apps || []"
              :key="app.id"
              class="rounded-2xl bg-base-100 p-4 shadow-sm"
            >
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 class="text-lg font-semibold">
                    {{ app.name }}
                    <span class="opacity-60">({{ app.version }})</span>
                    <span
                      v-if="updateInfoByAppId[app.appId]?.updateAvailable"
                      class="badge badge-warning ml-2"
                    >
                      {{ $t("adminApps.updateAvailable", { version: updateInfoByAppId[app.appId]?.remoteVersion }) }}
                    </span>
                  </h3>
                  <p class="text-sm opacity-75">{{ $t("adminApps.appId") }}: {{ app.appId }}</p>
                </div>
                <div class="flex flex-wrap gap-2">
                  <span class="badge" :class="app.status === 'active' ? 'badge-success' : app.status === 'error' ? 'badge-error' : 'badge-ghost'">
                    {{ statusLabel(app.status) }}
                  </span>
                  <span v-if="!app.manifestValid" class="badge badge-error">{{ $t("adminApps.incompatible") }}</span>
                  <span class="badge" :class="app.verified ? 'badge-success' : 'badge-warning'">
                    {{ app.verified ? $t("adminApps.verified") : $t("adminApps.unverified") }}
                  </span>
                  <span class="badge badge-outline">{{ sourceLabel(app.source) }}</span>
                </div>
              </div>

              <div class="mt-4 flex flex-wrap items-center gap-2">
                <button class="btn btn-sm btn-outline" :disabled="actionPending" @click="toggleStatus(app.appId, app.status)">
                  {{ app.status === "active" ? $t("adminApps.deactivate") : $t("adminApps.activate") }}
                </button>
                <button
                  v-if="app.source === 'sideloaded' && updateInfoByAppId[app.appId]?.updateAvailable"
                  class="btn btn-sm btn-warning"
                  :disabled="actionPending"
                  @click="updateApp(app.appId)"
                >
                  {{ $t("adminApps.updateNow") }}
                </button>
                <button
                  v-if="app.source === 'sideloaded' && app.repositoryUrl"
                  class="btn btn-sm btn-outline"
                  :disabled="actionPending"
                  @click="reinstallApp(app.appId)"
                >
                  {{ $t("adminApps.reinstall") }}
                </button>
                <button class="btn btn-sm btn-error btn-outline" :disabled="actionPending" @click="removeApp(app.id)">{{ $t("adminApps.delete") }}</button>
                <a v-if="app.repositoryUrl" class="btn btn-sm btn-ghost" :href="app.repositoryUrl" target="_blank" rel="noreferrer">
                  {{ $t("adminApps.repository") }}
                </a>
                <label v-if="app.source === 'sideloaded'" class="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    class="toggle toggle-sm"
                    :checked="app.autoUpdate"
                    :disabled="actionPending"
                    @change="toggleAutoUpdate(app.appId, app.autoUpdate)"
                  />
                  {{ $t("adminApps.autoUpdate") }}
                </label>
              </div>
            </article>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>
