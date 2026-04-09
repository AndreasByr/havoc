<script setup lang="ts">
const config = useRuntimeConfig();
const { loggedIn } = useUserSession();
const route = useRoute();

const showBanner = computed(() => {
  return config.public.authDevBypass === true && !loggedIn.value;
});

const devLoginUrl = computed(() => {
  const returnTo = encodeURIComponent(route.fullPath || "/dashboard");
  return `/api/auth/dev-login?returnTo=${returnTo}`;
});
</script>

<template>
  <div
    v-if="showBanner"
    class="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3"
  >
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2 text-sm text-warning">
        <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span class="font-medium">{{ $t("auth.devMode.bannerText") }}</span>
      </div>
      <a :href="devLoginUrl" class="btn btn-warning btn-sm">
        {{ $t("auth.devMode.loginButton") }}
      </a>
    </div>
  </div>
</template>
