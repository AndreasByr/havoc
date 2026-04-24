<script setup lang="ts">
const { t } = useI18n();

const CONSENT_COOKIE = "guildora_consent_accepted";
const POLICY_VERSION = "1.0";

const consentCookie = useCookie(CONSENT_COOKIE, {
  maxAge: 60 * 60 * 24 * 365, // 1 year
  path: "/",
  sameSite: "lax",
});

const visible = ref(false);
const loading = ref(true);

onMounted(async () => {
  // 1. Check existing cookie — fast path, no API call needed
  if (consentCookie.value === "1") {
    loading.value = false;
    return;
  }

  // 2. Check consent status via web proxy API (covers authenticated users
  //    who accepted on another device/browser)
  try {
    const status = await $fetch<{ hasConsented: boolean }>("/api/consent/status");

    if (status.hasConsented) {
      consentCookie.value = "1";
      loading.value = false;
      return;
    }
  } catch {
    // API unreachable or anonymous — proceed to show banner
  }

  // 3. No consent found — show banner
  loading.value = false;
  visible.value = true;
  console.log("[cookie-consent] Banner displayed");
});

async function accept() {
  try {
    await $fetch("/api/consent", {
      method: "POST",
      body: { policyVersion: POLICY_VERSION },
    });
    console.log("[cookie-consent] Consent recorded via API");
  } catch (e) {
    // Even if API fails, still set cookie so user isn't blocked
    console.warn("[cookie-consent] Failed to record consent via API:", e);
  }

  consentCookie.value = "1";
  visible.value = false;
}
</script>

<template>
  <Transition name="cookie-banner">
    <div
      v-if="visible"
      class="fixed inset-x-0 bottom-0 z-50 p-4"
      role="dialog"
      aria-label="Cookie consent"
    >
      <div class="mx-auto flex max-w-4xl flex-col items-center gap-3 rounded-xl bg-surface-3 px-5 py-4 shadow-lg sm:flex-row sm:gap-4">
        <p class="flex-1 text-center text-sm text-[var(--color-text-secondary)] sm:text-left">
          {{ t("cookieConsent.message") }}
          <NuxtLink
            to="/privacy"
            class="underline transition-colors hover:text-[var(--color-text-primary)]"
          >
            {{ t("cookieConsent.privacyLink") }}
          </NuxtLink>
        </p>
        <button
          class="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-dark focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface-3"
          :aria-label="t('cookieConsent.accept')"
          @click="accept"
        >
          {{ t("cookieConsent.accept") }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.cookie-banner-enter-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.cookie-banner-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.cookie-banner-enter-from {
  transform: translateY(100%);
  opacity: 0;
}
.cookie-banner-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
