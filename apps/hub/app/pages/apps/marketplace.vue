<script setup lang="ts">
definePageMeta({
  middleware: ["auth"],
});

// Set last path for apps index redirect
const lastPath = useCookie<string | null>("guildora_apps_last_path", { sameSite: "lax" });
lastPath.value = "/apps/marketplace";

const { t } = useI18n();

// Fetch marketplace apps from hub proxy
const { data: response, error, pending, refresh } = await useFetch<{ items: MarketplaceApp[] }>("/api/admin/marketplace/apps", {
  headers: {
    // Session cookie is automatically included
  },
});

interface MarketplaceApp {
  id: string;
  name: string;
  description: string;
  thumbnailUrl?: string;
  developer?: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
  version?: string;
  tags?: string[];
}

// Modal state
const selectedAppId = ref<string | null>(null);
const showModal = computed({
  get: () => selectedAppId.value !== null,
  set: (value) => {
    if (!value) selectedAppId.value = null;
  },
});

function openAppDetail(appId: string) {
  selectedAppId.value = appId;
}

function closeModal() {
  selectedAppId.value = null;
}

function handleInstalled() {
  // Refresh the list to update install counts
  refresh();
  // Optionally navigate to the apps overview
  navigateTo("/apps");
}
</script>

<template>
  <div class="min-h-[calc(100vh-4rem)] p-6">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-2xl font-semibold text-[--color-text-primary]">
          {{ t('marketplace.title') }}
        </h1>
      </div>

      <!-- Loading State -->
      <div v-if="pending" class="flex items-center justify-center py-20">
        <div class="text-[--color-text-secondary]">
          {{ t('marketplace.loading') }}
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="flex flex-col items-center justify-center py-20 gap-4">
        <div class="text-[--color-text-secondary]">
          {{ t('marketplace.error') }}
        </div>
        <UiButton variant="primary" size="sm" @click="refresh()">
          {{ t('marketplace.retry') }}
        </UiButton>
      </div>

      <!-- Empty State -->
      <div v-else-if="!response?.items?.length" class="flex items-center justify-center py-20">
        <div class="text-[--color-text-secondary]">
          {{ t('marketplace.empty') }}
        </div>
      </div>

      <!-- App Card Grid -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="app in response.items"
          :key="app.id"
          class="bg-[--color-surface-1] rounded-xl p-4 cursor-pointer hover:bg-[--color-surface-2] transition-colors"
          @click="openAppDetail(app.id)"
        >
          <!-- Thumbnail -->
          <div class="aspect-video bg-[--color-surface-2] rounded-lg mb-4 overflow-hidden flex items-center justify-center">
            <img
              v-if="app.thumbnailUrl"
              :src="app.thumbnailUrl"
              :alt="app.name"
              class="w-full h-full object-cover"
            >
            <div v-else class="text-[--color-text-secondary] text-4xl">
              📦
            </div>
          </div>

          <!-- App Info -->
          <h3 class="font-medium text-[--color-text-primary] mb-2">
            {{ app.name }}
          </h3>
          <p class="text-sm text-[--color-text-secondary] line-clamp-2">
            {{ app.description }}
          </p>

          <!-- Developer & Tags -->
          <div v-if="app.developer || app.tags?.length" class="mt-3 flex items-center gap-2 flex-wrap">
            <img
              v-if="app.developer?.avatarUrl"
              :src="app.developer.avatarUrl"
              :alt="app.developer.username"
              class="w-5 h-5 rounded-full"
            >
            <span v-if="app.developer" class="text-xs text-[--color-text-secondary]">
              {{ t('marketplace.detail.by') }} {{ app.developer.username }}
            </span>
            <UiTag v-for="tag in app.tags?.slice(0, 2)" :key="tag" size="xs" variant="secondary">
              {{ tag }}
            </UiTag>
          </div>
        </div>
      </div>
    </div>

    <!-- Detail Modal -->
    <MarketplaceAppDetailModal
      v-if="selectedAppId"
      :app-id="selectedAppId"
      :visible="showModal"
      @close="closeModal"
      @installed="handleInstalled"
    />
  </div>
</template>
