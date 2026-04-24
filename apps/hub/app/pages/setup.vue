<script setup lang="ts">
definePageMeta({
  layout: "setup"
});

const { t } = useI18n();
const { loggedIn } = useUserSession();
const route = useRoute();
const config = useRuntimeConfig();

const currentStep = ref(0);
const totalSteps = 5;

// ─── Step 1: Community Info ────────────────────────────────────────────
const communityName = ref("");
const defaultLocale = ref<"en" | "de">("de");

// ─── Step 2: Platform Connection ───────────────────────────────────────
const platformType = ref<"discord" | "matrix">("discord");

// Discord fields
const discordBotToken = ref("");
const discordClientId = ref("");
const discordClientSecret = ref("");
const discordGuildId = ref("");
const discordBotUrl = ref("http://bot:3050");
const discordBotInternalToken = ref("");

// Matrix fields
const matrixHomeserverUrl = ref("");
const matrixAccessToken = ref("");
const matrixSpaceId = ref("");
const matrixBotUrl = ref("");
const matrixBotInternalToken = ref("");

const platformSaving = ref(false);
const platformError = ref("");
const platformSaved = ref(false);
const botReloadMessage = ref("");
const botReloadMessageType = ref<"success" | "warning" | "">("");

// ─── Step 3: Admin Login ───────────────────────────────────────────────
const completePending = ref(false);
const completeError = ref("");
const setupDone = ref(false);

// Detect return from OAuth callback
onMounted(async () => {
  if (route.query.step === "complete" && loggedIn.value) {
    currentStep.value = 3;
    await completeSetup();
  }
});

// ─── Computed ──────────────────────────────────────────────────────────
const hubUrl = computed(() => {
  const url = config.public.hubUrl;
  return typeof url === "string" ? url : "http://localhost:3003";
});

const expectedRedirectUri = computed(() => `${hubUrl.value}/api/auth/discord`);

const canSavePlatform = computed(() => {
  if (platformType.value === "discord") {
    return discordBotToken.value.trim() && discordClientId.value.trim()
      && discordClientSecret.value.trim() && discordGuildId.value.trim();
  }
  return matrixHomeserverUrl.value.trim() && matrixAccessToken.value.trim();
});

const loginUrl = computed(() => {
  const returnTo = encodeURIComponent("/setup?step=complete");
  if (platformType.value === "discord") {
    return `/api/auth/discord?returnTo=${returnTo}`;
  }
  return `/api/auth/matrix?returnTo=${returnTo}`;
});

// ─── Actions ───────────────────────────────────────────────────────────

function nextStep() {
  if (currentStep.value < totalSteps - 1) {
    currentStep.value++;
  }
}

function prevStep() {
  if (currentStep.value > 0) {
    currentStep.value--;
  }
}

async function savePlatform() {
  platformSaving.value = true;
  platformError.value = "";
  botReloadMessage.value = "";
  botReloadMessageType.value = "";

  try {
    const body: Record<string, unknown> = {
      platform: platformType.value,
      communityName: communityName.value.trim() || undefined,
      defaultLocale: defaultLocale.value
    };

    if (platformType.value === "discord") {
      body.credentials = {
        botToken: discordBotToken.value.trim(),
        clientId: discordClientId.value.trim(),
        clientSecret: discordClientSecret.value.trim(),
        guildId: discordGuildId.value.trim()
      };
      body.botInternalUrl = discordBotUrl.value.trim() || undefined;
      body.botInternalToken = discordBotInternalToken.value.trim() || undefined;
    } else {
      body.credentials = {
        homeserverUrl: matrixHomeserverUrl.value.trim(),
        accessToken: matrixAccessToken.value.trim(),
        spaceId: matrixSpaceId.value.trim()
      };
      body.botInternalUrl = matrixBotUrl.value.trim() || undefined;
      body.botInternalToken = matrixBotInternalToken.value.trim() || undefined;
    }

    await $fetch("/api/setup/platform", { method: "POST", body });
    platformSaved.value = true;

    if (platformType.value === "discord") {
      try {
        await $fetch("/api/setup/bot-reload", { method: "POST" });
        botReloadMessageType.value = "success";
        botReloadMessage.value = "Discord bot connected";
      } catch {
        botReloadMessageType.value = "warning";
        botReloadMessage.value = "Bot credentials saved. Restart the bot container to apply: docker compose restart bot";
      }
    }

    // Invalidate setup status cache so middleware knows setup is progressing
    const setupStatus = useState<{ needsSetup: boolean; hasPlatforms: boolean } | null>("setup-status");
    setupStatus.value = null;

    nextStep();
  } catch (error: unknown) {
    const fetchError = error as { data?: { statusMessage?: string }; message?: string };
    platformError.value = fetchError?.data?.statusMessage || fetchError?.message || t("setup.platform.error");
  } finally {
    platformSaving.value = false;
  }
}

async function completeSetup() {
  completePending.value = true;
  completeError.value = "";

  try {
    await $fetch("/api/setup/complete", { method: "POST" });
    setupDone.value = true;
    currentStep.value = 4;

    // Set flag for dashboard tour
    const setupJustCompleted = useState<boolean>("setup-just-completed", () => false);
    setupJustCompleted.value = true;

    // Clear setup status cache
    const setupStatus = useState<{ needsSetup: boolean; hasPlatforms: boolean } | null>("setup-status");
    setupStatus.value = null;
  } catch (error: unknown) {
    const fetchError = error as { data?: { statusMessage?: string }; message?: string };
    completeError.value = fetchError?.data?.statusMessage || fetchError?.message || "Setup completion failed.";
  } finally {
    completePending.value = false;
  }
}

function goToDashboard() {
  navigateTo("/dashboard");
}

// Step labels for progress indicator
const stepLabels = computed(() => [
  t("setup.steps.welcome"),
  t("setup.steps.community"),
  t("setup.steps.platform"),
  t("setup.steps.admin"),
  t("setup.steps.complete")
]);
</script>

<template>
  <div class="w-full max-w-2xl">
    <!-- Progress indicator -->
    <div class="mb-8 flex items-center justify-center gap-2">
      <template v-for="(label, index) in stepLabels" :key="index">
        <div
          class="flex items-center gap-1.5"
          :class="index <= currentStep ? 'opacity-100' : 'opacity-40'"
        >
          <div
            class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors"
            :class="index < currentStep ? 'bg-success text-success-content' : index === currentStep ? 'bg-accent text-accent-content' : 'bg-base-300 text-base-content/60'"
          >
            <Icon v-if="index < currentStep" name="proicons:checkmark" class="h-4 w-4" />
            <span v-else>{{ index + 1 }}</span>
          </div>
          <span class="hidden text-xs font-medium sm:inline">{{ label }}</span>
        </div>
        <div v-if="index < stepLabels.length - 1" class="h-px w-6 bg-base-content/20 sm:w-10" />
      </template>
    </div>

    <!-- Card container -->
    <div class="relative overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-2)] shadow-lg">
      <div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--color-accent-dark)] via-[var(--color-accent)] to-[var(--color-accent-light)]" />

      <div class="px-8 pb-8 pt-10">

        <!-- Step 0: Welcome -->
        <div v-if="currentStep === 0">
          <h1 class="text-2xl font-bold tracking-tight">{{ $t("setup.welcome.title") }}</h1>
          <p class="mt-2 text-sm text-[var(--color-text-secondary)]">{{ $t("setup.welcome.description") }}</p>

          <div class="mt-8 flex justify-end">
            <UiButton @click="nextStep">{{ $t("setup.welcome.continue") }}</UiButton>
          </div>
        </div>

        <!-- Step 1: Community Info -->
        <div v-else-if="currentStep === 1">
          <h2 class="text-xl font-bold">{{ $t("setup.community.title") }}</h2>
          <p class="mt-1 text-sm text-[var(--color-text-secondary)]">{{ $t("setup.community.description") }}</p>

          <div class="mt-6 space-y-4">
            <UiInput
              v-model="communityName"
              :label="$t('setup.community.nameLabel')"
              :placeholder="$t('setup.community.namePlaceholder')"
            />
            <div>
              <label class="label font-medium">{{ $t("setup.community.localeLabel") }}</label>
              <select v-model="defaultLocale" class="select select-bordered w-full max-w-xs mt-1">
                <option value="en">English</option>
                <option value="de">Deutsch</option>
              </select>
            </div>
          </div>

          <div class="mt-8 flex justify-between">
            <UiButton variant="ghost" @click="prevStep">{{ $t("setup.back") }}</UiButton>
            <UiButton @click="nextStep">{{ $t("setup.community.continue") }}</UiButton>
          </div>
        </div>

        <!-- Step 2: Platform Connection -->
        <div v-else-if="currentStep === 2">
          <h2 class="text-xl font-bold">{{ $t("setup.platform.title") }}</h2>
          <p class="mt-1 text-sm text-[var(--color-text-secondary)]">{{ $t("setup.platform.description") }}</p>

          <!-- Platform selector -->
          <div class="mt-6 flex gap-3">
            <button
              class="btn flex-1"
              :class="platformType === 'discord' ? 'btn-primary' : 'btn-outline'"
              @click="platformType = 'discord'"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
              </svg>
              Discord
            </button>
            <button
              class="btn flex-1"
              :class="platformType === 'matrix' ? 'btn-primary' : 'btn-outline'"
              @click="platformType = 'matrix'"
            >
              <Icon name="simple-icons:matrix" class="h-5 w-5" />
              Matrix
            </button>
          </div>

          <!-- Discord fields -->
          <div v-if="platformType === 'discord'" class="mt-6 space-y-4">
            <UiInput v-model="discordClientId" :label="$t('setup.platform.discord.clientId')" placeholder="123456789012345678" />
            <UiInput v-model="discordClientSecret" :label="$t('setup.platform.discord.clientSecret')" type="password" />
            <UiInput v-model="discordBotToken" :label="$t('setup.platform.discord.botToken')" type="password" />
            <UiInput v-model="discordGuildId" :label="$t('setup.platform.discord.guildId')" placeholder="123456789012345678" />

            <!-- Redirect URI hint -->
            <div class="rounded-xl bg-base-300/50 p-4">
              <p class="text-xs font-medium opacity-70">{{ $t("setup.platform.discord.redirectUriLabel") }}</p>
              <code class="mt-1 block break-all text-sm font-mono text-accent">{{ expectedRedirectUri }}</code>
              <p class="mt-1 text-xs opacity-50">{{ $t("setup.platform.discord.redirectUriHint") }}</p>
            </div>

            <div class="border-t border-base-content/10 pt-4">
              <p class="text-xs font-medium opacity-50 mb-3">{{ $t("setup.platform.botConnectionOptional") }}</p>
              <div class="space-y-3">
                <UiInput v-model="discordBotUrl" :label="$t('setup.platform.botUrl')" placeholder="http://bot:3050" />
                <UiInput v-model="discordBotInternalToken" :label="$t('setup.platform.botToken')" type="password" />
              </div>
            </div>
          </div>

          <!-- Matrix fields -->
          <div v-if="platformType === 'matrix'" class="mt-6 space-y-4">
            <UiInput v-model="matrixHomeserverUrl" :label="$t('setup.platform.matrix.homeserverUrl')" placeholder="https://matrix.example.org" />
            <UiInput v-model="matrixAccessToken" :label="$t('setup.platform.matrix.accessToken')" type="password" />
            <UiInput v-model="matrixSpaceId" :label="$t('setup.platform.matrix.spaceId')" placeholder="!abc:matrix.example.org" />

            <div class="border-t border-base-content/10 pt-4">
              <p class="text-xs font-medium opacity-50 mb-3">{{ $t("setup.platform.botConnectionOptional") }}</p>
              <div class="space-y-3">
                <UiInput v-model="matrixBotUrl" :label="$t('setup.platform.botUrl')" />
                <UiInput v-model="matrixBotInternalToken" :label="$t('setup.platform.botToken')" type="password" />
              </div>
            </div>
          </div>

          <div v-if="platformError" class="mt-4 rounded-lg bg-[var(--color-error)]/10 px-4 py-3 text-sm text-[var(--color-error)]">
            {{ platformError }}
          </div>

          <div
            v-if="botReloadMessage"
            class="mt-4 rounded-lg px-4 py-3 text-sm"
            :class="botReloadMessageType === 'success' ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]' : 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]'"
          >
            {{ botReloadMessage }}
          </div>

          <div class="mt-8 flex justify-between">
            <UiButton variant="ghost" @click="prevStep">{{ $t("setup.back") }}</UiButton>
            <UiButton :disabled="!canSavePlatform || platformSaving" @click="savePlatform">
              {{ platformSaving ? $t("setup.platform.saving") : $t("setup.platform.saveAndContinue") }}
            </UiButton>
          </div>
        </div>

        <!-- Step 3: Admin Login -->
        <div v-else-if="currentStep === 3 && !setupDone">
          <h2 class="text-xl font-bold">{{ $t("setup.admin.title") }}</h2>
          <p class="mt-1 text-sm text-[var(--color-text-secondary)]">{{ $t("setup.admin.description") }}</p>

          <div v-if="completePending" class="mt-8 flex flex-col items-center gap-4">
            <div class="loading loading-spinner loading-lg" />
            <p class="text-sm opacity-70">{{ $t("setup.admin.completing") }}</p>
          </div>

          <div v-else-if="completeError" class="mt-6">
            <div class="rounded-lg bg-[var(--color-error)]/10 px-4 py-3 text-sm text-[var(--color-error)]">
              {{ completeError }}
            </div>
            <div class="mt-4 flex justify-end">
              <UiButton @click="completeSetup">{{ $t("setup.admin.retry") }}</UiButton>
            </div>
          </div>

          <div v-else class="mt-8">
            <p class="mb-6 text-sm opacity-70">{{ $t("setup.admin.loginPrompt") }}</p>
            <a :href="loginUrl" class="btn btn-primary w-full gap-2.5 py-3 text-base">
              <svg v-if="platformType === 'discord'" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
              </svg>
              <Icon v-else name="simple-icons:matrix" class="h-5 w-5" />
              {{ platformType === "discord" ? $t("setup.admin.loginButton") : $t("setup.admin.loginButtonMatrix") }}
            </a>
          </div>
        </div>

        <!-- Step 4: Complete -->
        <div v-else-if="currentStep === 4 || setupDone">
          <div class="text-center">
            <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/20">
              <Icon name="proicons:checkmark" class="h-8 w-8 text-success" />
            </div>
            <h2 class="text-2xl font-bold">{{ $t("setup.complete.title") }}</h2>
            <p class="mt-2 text-sm text-[var(--color-text-secondary)]">{{ $t("setup.complete.description") }}</p>
          </div>

          <div class="mt-8 flex flex-col gap-3">
            <UiButton class="w-full" @click="goToDashboard">
              {{ $t("setup.complete.goToDashboard") }}
            </UiButton>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>
