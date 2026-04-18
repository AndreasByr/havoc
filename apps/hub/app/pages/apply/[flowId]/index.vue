<script setup lang="ts">
import type { ApplicationFlowGraph } from "@guildora/shared";

definePageMeta({
  layout: "apply",
});

const route = useRoute();
const flowId = route.params.flowId as string;
const { t } = useI18n();
const { user } = useAuth();

type CheckAccessResult =
  | { access: "granted"; flow: { id: string; name: string; flowJson: ApplicationFlowGraph; settings: { messages: { submissionConfirmation?: string } } }; user: { discordId: string; discordUsername: string; discordAvatarUrl: string | null } }
  | { access: "not_member"; discordInviteCode: string | null }
  | { access: "already_applied" };

const loading = ref(true);
const error = ref("");
const accessResult = ref<CheckAccessResult | null>(null);
const submitted = ref(false);
const submittedMessage = ref("");

onMounted(async () => {
  // If not logged in, redirect to OAuth with returnTo
  if (!user.value) {
    await navigateTo(`/api/auth/discord?returnTo=${encodeURIComponent(`/apply/${flowId}`)}`, { external: true });
    return;
  }

  try {
    const result = await $fetch<CheckAccessResult>(`/api/apply/${flowId}/check-access`);
    accessResult.value = result;
  } catch (err: unknown) {
    const e = err as { data?: { message?: string }; statusMessage?: string };
    error.value = e?.data?.message || e?.statusMessage || t("common.error");
  } finally {
    loading.value = false;
  }
});

function onSubmitted(result: { applicationId: string; message: string }) {
  submitted.value = true;
  submittedMessage.value = result.message;
}
</script>

<template>
  <div>
    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-16">
      <span class="loading loading-spinner loading-lg" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="apply-card">
      <div class="apply-status-container">
        <div class="apply-status-icon apply-status-icon--warning">
          <Icon name="proicons:warning" class="text-2xl" />
        </div>
        <h2 class="apply-status-title">{{ t("applications.applyNoToken.errorTitle") }}</h2>
        <p class="apply-status-message">{{ error }}</p>
      </div>
    </div>

    <!-- Not a guild member -->
    <div v-else-if="accessResult?.access === 'not_member'" class="apply-card">
      <div class="apply-status-container">
        <div class="apply-status-icon apply-status-icon--info">
          <Icon name="lucide:message-circle" class="text-2xl" />
        </div>
        <h2 class="apply-status-title">{{ t("applications.applyNoToken.joinDiscord") }}</h2>
        <p class="apply-status-message">{{ t("applications.applyNoToken.joinDiscordDesc") }}</p>
        <a
          v-if="accessResult.discordInviteCode"
          :href="`https://discord.gg/${accessResult.discordInviteCode}`"
          target="_blank"
          class="mt-4 inline-flex items-center gap-2 rounded-lg px-6 py-3 font-semibold text-white transition-colors"
          style="background: #5865F2"
        >
          <Icon name="lucide:external-link" class="h-4 w-4" />
          {{ t("applications.applyNoToken.joinDiscordButton") }}
        </a>
      </div>
    </div>

    <!-- Already applied -->
    <div v-else-if="accessResult?.access === 'already_applied'" class="apply-card">
      <div class="apply-status-container">
        <div class="apply-status-icon apply-status-icon--info">
          <Icon name="proicons:info" class="text-2xl" />
        </div>
        <h2 class="apply-status-title">{{ t("applications.applyNoToken.alreadyApplied") }}</h2>
        <p class="apply-status-message">{{ t("applications.applyNoToken.alreadyAppliedDesc") }}</p>
      </div>
    </div>

    <!-- Success -->
    <div v-else-if="submitted" class="apply-card">
      <div class="apply-status-container">
        <div class="apply-status-icon apply-status-icon--success">
          <Icon name="proicons:checkmark-circle" class="text-3xl" />
        </div>
        <h2 class="apply-status-title">
          {{ submittedMessage || t("applications.applySuccess") }}
        </h2>
        <p class="apply-status-message">
          {{ t("applications.applySuccessHint") }}
        </p>
      </div>
    </div>

    <!-- Application Form (access granted) -->
    <template v-else-if="accessResult?.access === 'granted'">
      <div class="apply-card">
        <!-- User info bar -->
        <div class="apply-user-bar">
          <img
            v-if="accessResult.user.discordAvatarUrl"
            :src="accessResult.user.discordAvatarUrl"
            class="apply-user-bar__avatar"
            alt=""
          >
          <div v-else class="apply-user-bar__avatar-fallback">
            {{ accessResult.user.discordUsername.slice(0, 2).toUpperCase() }}
          </div>
          <div>
            <p class="font-medium" style="color: var(--color-base-content)">
              {{ accessResult.user.discordUsername }}
            </p>
            <p class="text-sm" style="color: var(--color-base-content-secondary)">
              {{ accessResult.flow.name }}
            </p>
          </div>
        </div>

        <ApplicationsFormApplicationForm
          :flow-json="accessResult.flow.flowJson"
          token=""
          :flow-id="flowId"
          :discord-username="accessResult.user.discordUsername"
          @submitted="onSubmitted"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.apply-card {
  border-radius: 0.75rem;
  background: var(--color-surface-2);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.apply-user-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--color-line);
  background: var(--color-surface-3);
}

.apply-user-bar__avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  object-fit: cover;
}

.apply-user-bar__avatar-fallback {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent);
  color: var(--color-accent-content);
  font-size: 0.875rem;
  font-weight: 600;
}

.apply-status-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem 2rem;
  gap: 1rem;
}

.apply-status-icon {
  width: 4rem;
  height: 4rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.5rem;
}

.apply-status-icon--success {
  background: color-mix(in srgb, var(--color-success) 15%, transparent);
  color: var(--color-success);
}

.apply-status-icon--warning {
  background: color-mix(in srgb, var(--color-warning) 15%, transparent);
  color: var(--color-warning);
}

.apply-status-icon--info {
  background: color-mix(in srgb, var(--color-accent) 15%, transparent);
  color: var(--color-accent);
}

.apply-status-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-base-content);
  text-align: center;
}

.apply-status-message {
  font-size: 0.9375rem;
  color: var(--color-base-content-secondary);
  text-align: center;
  max-width: 28rem;
  line-height: 1.5;
}
</style>
