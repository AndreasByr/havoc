<script setup lang="ts">
definePageMeta({
  middleware: ["admin"],
});

const lastPath = useCookie<string | null>("newguild_admin_last_path", { sameSite: "lax" });
lastPath.value = "/admin/apps";

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
    repositoryUrl: string | null;
    updatedAt: string;
    manifestValid: boolean;
  }>;
  stats: {
    installed: number;
    active: number;
  };
};

const { data, pending, error, refresh } = await useFetch<AdminAppsResponse>("/api/admin/apps");

const sideloadForm = reactive({
  githubUrl: "",
  activate: false
});

const sideloadError = ref<string | null>(null);

const sideload = async () => {
  sideloadError.value = null;
  try {
    await $fetch("/api/admin/apps/sideload", {
      method: "POST",
      body: {
        githubUrl: sideloadForm.githubUrl.trim(),
        activate: sideloadForm.activate
      }
    });
    sideloadForm.githubUrl = "";
    await refresh();
  } catch (e: unknown) {
    const msg = (e as { data?: { message?: string }; message?: string })?.data?.message
      ?? (e as { message?: string })?.message
      ?? t("adminApps.sideloadError");
    sideloadError.value = msg;
  }
};

const toggleStatus = async (appId: string, status: "active" | "inactive" | "error") => {
  const nextStatus = status === "active" ? "inactive" : "active";
  await $fetch(`/api/admin/apps/${appId}/status`, {
    method: "PUT",
    body: { status: nextStatus }
  });
  await refresh();
};

const removeApp = async (id: string) => {
  await $fetch(`/api/admin/apps/${id}`, {
    method: "DELETE"
  });
  await refresh();
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
        <h1 class="text-2xl font-bold md:text-3xl">{{ $t("adminApps.title") }}</h1>
        <p class="opacity-80">{{ $t("adminApps.description") }}</p>
      </div>
      <button class="btn btn-outline btn-sm" @click="refresh">{{ $t("adminApps.refresh") }}</button>
    </div>

    <div class="grid grid-cols-2 gap-3 md:gap-4">
      <div class="stat rounded-2xl bg-base-200 p-4 shadow-neu-raised-sm">
        <div class="stat-title text-xs md:text-sm">{{ $t("adminApps.installed") }}</div>
        <div class="stat-value text-lg text-primary md:text-xl">{{ data?.stats.installed || 0 }}</div>
      </div>
      <div class="stat rounded-2xl bg-base-200 p-4 shadow-neu-raised-sm">
        <div class="stat-title text-xs md:text-sm">{{ $t("adminApps.active") }}</div>
        <div class="stat-value text-lg text-success md:text-xl">{{ data?.stats.active || 0 }}</div>
      </div>
    </div>

    <div class="card bg-base-200">
      <div class="card-body gap-4">
        <h2 class="card-title">{{ $t("adminApps.sideloadTitle") }}</h2>
        <div class="grid gap-3 md:grid-cols-2">
          <UiRetroInput
            v-model="sideloadForm.githubUrl"
            :label="$t('adminApps.githubManifestUrl')"
            type="url"
            placeholder="https://github.com/owner/repo"
           
          />
          <UiRetroCheckbox
            v-model="sideloadForm.activate"
            :label="$t('adminApps.directActivate')"
            :description="$t('adminApps.directActivateDescription')"

            size="sm"
          />
        </div>
<p class="text-sm opacity-75">{{ $t("adminApps.allowedSources") }}</p>

        <p v-if="sideloadError" class="text-sm text-error">{{ sideloadError }}</p>

        <div class="flex justify-end">
          <button class="btn btn-primary" @click="sideload">{{ $t("adminApps.sideloadInstall") }}</button>
        </div>
      </div>
    </div>

    <div class="card bg-base-200">
      <div class="card-body">
        <h2 class="card-title">{{ $t("adminApps.installedAppsTitle") }}</h2>
        <div v-if="pending" class="loading loading-spinner loading-md" />
        <template v-else>
          <div v-if="error" class="alert alert-error">{{ $t("adminApps.loadError") }}</div>
          <div v-else-if="!(data?.apps || []).length" class="alert alert-info">{{ $t("adminApps.empty") }}</div>
          <div v-if="(data?.apps || []).length" class="space-y-4">
          <article
            v-for="app in data?.apps || []"
            :key="app.id"
            class="rounded-2xl bg-base-100 p-4 shadow-neu-raised-sm"
          >
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 class="text-lg font-semibold">{{ app.name }} <span class="opacity-60">({{ app.version }})</span></h3>
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

            <div class="mt-4 flex flex-wrap gap-2">
              <button class="btn btn-sm btn-outline" @click="toggleStatus(app.appId, app.status)">
                {{ app.status === "active" ? $t("adminApps.deactivate") : $t("adminApps.activate") }}
              </button>
              <button class="btn btn-sm btn-error btn-outline" @click="removeApp(app.id)">{{ $t("adminApps.delete") }}</button>
              <a v-if="app.repositoryUrl" class="btn btn-sm btn-ghost" :href="app.repositoryUrl" target="_blank" rel="noreferrer">
                {{ $t("adminApps.repository") }}
              </a>
            </div>
          </article>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>
