<script setup lang="ts">
const props = defineProps<{
  appId: string;
  visible: boolean;
}>();

const emit = defineEmits<{
  close: [];
  installed: [];
}>();

const { t } = useI18n();

// Install state
const installing = ref(false);
const installError = ref<string | null>(null);

async function install() {
  installing.value = true;
  installError.value = null;

  try {
    const response = await $fetch<{ ok: boolean; appId: string }>("/api/admin/marketplace/install", {
      method: "POST",
      body: { appId: props.appId },
    });

    if (response.ok) {
      emit("installed");
      emit("close");
    }
  } catch (err: any) {
    installError.value = err.data?.message || t("marketplace.detail.installError");
  } finally {
    installing.value = false;
  }
}

// Fetch app details when modal becomes visible and we have an appId
const { data: app, pending, error } = await useFetch<MarketplaceAppDetail>(`/api/admin/marketplace/apps/${props.appId}`, {
  immediate: false,
});

interface MarketplaceAppDetail {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  thumbnailUrl?: string;
  images?: { src: string; alt?: string }[];
  developer?: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
  version?: string;
  tags?: string[];
  category?: string;
  installCount?: number;
}

// Watch for visibility changes to fetch data
watch(
  () => props.visible,
  async (isVisible) => {
    if (isVisible && props.appId) {
      await refresh();
    }
  },
  { immediate: true }
);

async function refresh() {
  if (props.appId) {
    await useFetch(`/api/admin/marketplace/apps/${props.appId}`, {
      onResponse({ response }) {
        if (response.ok) {
          // @ts-ignore - TypeScript doesn't know about the reactive response
          app.value = response._data;
        }
      },
    });
  }
}

function handleClose() {
  emit("close");
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      @click.self="handleClose"
    >
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/60" @click="handleClose" />

      <!-- Modal Content -->
      <div class="relative bg-[--color-surface-0] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <!-- Close Button -->
        <button
          class="absolute top-4 right-4 z-10 p-2 rounded-lg bg-[--color-surface-2] hover:bg-[--color-surface-3] transition-colors"
          @click="handleClose"
        >
          <span class="sr-only">{{ t('marketplace.detail.close') }}</span>
          <svg class="w-5 h-5 text-[--color-text-secondary]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <!-- Loading State -->
        <div v-if="pending" class="flex items-center justify-center py-20">
          <div class="text-[--color-text-secondary]">
            {{ t('marketplace.loading') }}
          </div>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="flex items-center justify-center py-20">
          <div class="text-[--color-text-secondary]">
            {{ t('marketplace.error') }}
          </div>
        </div>

        <!-- App Detail Content -->
        <div v-else-if="app" class="overflow-y-auto">
          <!-- Hero Section -->
          <div class="relative">
            <div class="aspect-video bg-[--color-surface-2]">
              <img
                v-if="app.thumbnailUrl"
                :src="app.thumbnailUrl"
                :alt="app.name"
                class="w-full h-full object-cover"
              />
              <div v-else class="w-full h-full flex items-center justify-center text-6xl">
                📦
              </div>
            </div>
          </div>

          <!-- Content -->
          <div class="p-6">
            <!-- Header -->
            <div class="flex items-start justify-between gap-4 mb-6">
              <div>
                <h2 class="text-xl font-semibold text-[--color-text-primary] mb-2">
                  {{ app.name }}
                </h2>
                <div class="flex items-center gap-3 text-sm text-[--color-text-secondary]">
                  <!-- Developer -->
                  <div v-if="app.developer" class="flex items-center gap-2">
                    <img
                      v-if="app.developer.avatarUrl"
                      :src="app.developer.avatarUrl"
                      :alt="app.developer.username"
                      class="w-5 h-5 rounded-full"
                    />
                    <span>{{ t('marketplace.detail.by') }} {{ app.developer.username }}</span>
                  </div>
                  <!-- Version -->
                  <div v-if="app.version">
                    {{ t('marketplace.detail.version') }} {{ app.version }}
                  </div>
                  <!-- Install Count -->
                  <div v-if="app.installCount">
                    {{ app.installCount }} installs
                  </div>
                </div>
              </div>

              <!-- Install Button -->
              <UiButton
                variant="primary"
                :loading="installing"
                :disabled="installing"
                @click="install"
              >
                {{ installing ? t('marketplace.detail.installing') : t('marketplace.detail.install') }}
              </UiButton>
            </div>

            <!-- Install Error -->
            <p v-if="installError" class="text-sm text-red-400 mt-2">
              {{ installError }}
            </p>

            <!-- Tags -->
            <div v-if="app.tags?.length" class="flex gap-2 mb-6 flex-wrap">
              <UiTag v-for="tag in app.tags" :key="tag" variant="secondary">
                {{ tag }}
              </UiTag>
            </div>

            <!-- Image Gallery -->
            <div v-if="app.images?.length" class="mb-6">
              <h3 class="text-sm font-medium text-[--color-text-secondary] mb-3">
                {{ t('marketplace.detail.gallery') }}
              </h3>
              <div class="flex gap-3 overflow-x-auto pb-2">
                <div
                  v-for="(img, idx) in app.images"
                  :key="idx"
                  class="flex-shrink-0 w-48 h-28 rounded-lg overflow-hidden bg-[--color-surface-2]"
                >
                  <img
                    :src="img.src"
                    :alt="img.alt || `Screenshot ${idx + 1}`"
                    class="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>

            <!-- Description -->
            <div>
              <h3 class="text-sm font-medium text-[--color-text-secondary] mb-3">
                {{ t('marketplace.detail.description') }}
              </h3>
              <div class="text-[--color-text-primary] whitespace-pre-wrap">
                {{ app.longDescription || app.description }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
