<script setup lang="ts">
definePageMeta({
  layout: "auth"
});

const route = useRoute();
const config = useRuntimeConfig();
const { t, te } = useI18n();
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
  <div class="mx-auto max-w-xl">
    <div class="card bg-base-200">
      <div class="card-body">
        <h1 class="card-title">{{ $t("auth.loginTitle") }}</h1>
        <p>{{ $t("auth.loginDescription") }}</p>

        <div v-if="loginError" class="rounded-lg bg-error/10 px-4 py-3 text-sm text-error">
          {{ loginError }}
        </div>

        <div class="card-actions flex-col gap-2">
          <a v-if="showDiscordLogin" class="btn btn-primary" :href="`/api/auth/discord?returnTo=${encodeURIComponent(returnTo)}`">
            <Icon name="simple-icons:discord" class="mr-2" />
            {{ $t("auth.loginWithDiscord") }}
          </a>
          <a v-if="hasMatrix" class="btn btn-secondary" :href="`/api/auth/matrix?returnTo=${encodeURIComponent(returnTo)}`">
            <Icon name="simple-icons:matrix" class="mr-2" />
            {{ $t("auth.loginWithMatrix") }}
          </a>
          <a v-if="showDevLogin" :href="devLoginUrl" class="btn btn-warning btn-outline btn-sm">
            {{ $t("auth.devMode.loginButton") }}
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
