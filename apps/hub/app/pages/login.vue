<script setup lang="ts">
definePageMeta({
  layout: "bare"
});

const route = useRoute();
const config = useRuntimeConfig();
const { t, te } = useI18n();
const { loggedIn } = useUserSession();

const returnTo = computed(() => {
  const rawValue = typeof route.query.returnTo === "string" ? route.query.returnTo : "/dashboard";
  let value = rawValue;
  try {
    value = decodeURIComponent(rawValue);
  } catch {
    value = rawValue;
  }
  return (value.startsWith("/") && !value.startsWith("//")) ? value : "/dashboard";
});

// Redirect already authenticated users
if (loggedIn.value) {
  await navigateTo(returnTo.value, { replace: true });
}

const loginError = computed(() => {
  const code = typeof route.query.error === "string" ? route.query.error : null;
  if (!code) return null;
  const key = `auth.errors.${code}`;
  return te(key) ? t(key) : t("auth.errors.unknown");
});

const showDevLogin = computed(() => config.public.authDevBypass === true);

const devLoginUrl = computed(() => {
  return `/api/auth/dev-login?returnTo=${encodeURIComponent(returnTo.value)}`;
});

// Fetch available auth platforms
const { data: authPlatforms } = await useFetch<{ discord: boolean; matrix: boolean }>(
  "/api/auth/platforms",
  { key: "auth-platforms" }
);

// Show Discord by default (backward compat: Discord-only communities don't need platform_connections)
const hasDiscord = computed(() => authPlatforms.value?.discord !== false);
const hasMatrix = computed(() => authPlatforms.value?.matrix === true);
// If no platform data loaded yet or no platforms configured, show Discord button as fallback
const showDiscordLogin = computed(() => !authPlatforms.value || hasDiscord.value);
</script>

<template>
  <div class="w-full max-w-md">
    <DevLoginBanner class="mb-4" />

    <div class="relative overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-2)] shadow-lg">
      <!-- Decorative accent gradient -->
      <div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--color-accent-dark)] via-[var(--color-accent)] to-[var(--color-accent-light)]" />

      <div class="px-8 pb-8 pt-10">
        <!-- Heading -->
        <h1 class="text-2xl font-bold tracking-tight">{{ $t("auth.loginTitle") }}</h1>
        <p class="mt-2 text-sm text-[var(--color-text-secondary)]">{{ $t("auth.loginDescription") }}</p>

        <!-- Error -->
        <div v-if="loginError" class="mt-5 rounded-lg bg-[var(--color-error)]/10 px-4 py-3 text-sm text-[var(--color-error)]">
          {{ loginError }}
        </div>

        <!-- Discord Login Button -->
        <a
          v-if="showDiscordLogin"
          :href="`/api/auth/discord?returnTo=${encodeURIComponent(returnTo)}`"
          class="btn btn-primary mt-6 w-full gap-2.5 py-3 text-base"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
          </svg>
          {{ $t("auth.loginWithDiscord") }}
        </a>

        <!-- Matrix Login Button -->
        <a
          v-if="hasMatrix"
          :href="`/api/auth/matrix?returnTo=${encodeURIComponent(returnTo)}`"
          class="btn btn-secondary mt-3 w-full gap-2.5 py-3 text-base"
        >
          <Icon name="simple-icons:matrix" class="h-5 w-5" />
          {{ $t("auth.loginWithMatrix") }}
        </a>

        <!-- Dev Login Button -->
        <a v-if="showDevLogin" :href="devLoginUrl" class="btn btn-warning btn-outline btn-sm mt-4 w-full">
          {{ $t("auth.devMode.loginButton") }}
        </a>
      </div>
    </div>
  </div>
</template>
