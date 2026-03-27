<script setup lang="ts">
import type { ApplicationFlowSettings } from "@guildora/shared";

definePageMeta({
  middleware: ["moderator"],
});

const route = useRoute();
const flowId = route.params.flowId as string;
const { t } = useI18n();

type FlowResponse = {
  flow: {
    id: string;
    name: string;
    status: "draft" | "active" | "inactive";
    settingsJson: ApplicationFlowSettings;
    updatedAt: string;
  };
};

type GuildRole = {
  id: string;
  name: string;
  position: number;
  managed: boolean;
  editable: boolean;
};

const { data, pending, error, refresh } = await useFetch<FlowResponse>(`/api/applications/flows/${flowId}`);

const guildRoles = ref<GuildRole[]>([]);
const rolesLoading = ref(true);
onMounted(async () => {
  try {
    const result = await $fetch<{ guildRoles: GuildRole[] }>("/api/admin/discord-roles");
    guildRoles.value = result.guildRoles.filter((r) => !r.managed).sort((a, b) => b.position - a.position);
  } catch {
    // Non-critical
  } finally {
    rolesLoading.value = false;
  }
});

const saving = ref(false);
const saveError = ref("");

// Editable form state
const flowName = ref("");
const flowStatus = ref<"draft" | "active" | "inactive">("draft");
const settings = ref<ApplicationFlowSettings>({
  embed: {},
  roles: { onSubmission: [], onApproval: [] },
  welcome: {},
  concurrency: { allowReapplyToSameFlow: false, allowCrossFlowApplications: true },
  archiveRetentionDays: 0,
  testMode: false,
  tokenExpiryMinutes: 60,
  messages: {}
});

// Initialize from loaded data
watch(data, (d) => {
  if (d?.flow) {
    flowName.value = d.flow.name;
    flowStatus.value = d.flow.status;
    settings.value = { ...settings.value, ...d.flow.settingsJson };
  }
}, { immediate: true });

const save = async () => {
  saving.value = true;
  saveError.value = "";
  try {
    await $fetch(`/api/applications/flows/${flowId}`, {
      method: "PUT",
      body: {
        name: flowName.value,
        status: flowStatus.value,
        settingsJson: settings.value
      }
    });
    await refresh();
  } catch (err: unknown) {
    const e = err as { data?: { message?: string }; statusMessage?: string };
    saveError.value = e?.data?.message || e?.statusMessage || t("common.error");
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <section class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <NuxtLink to="/applications/flows" class="text-sm hover:underline" style="color: var(--color-accent)">
          &larr; {{ t("applications.flows") }}
        </NuxtLink>
        <h1 class="mt-1 text-2xl font-semibold">{{ t("applications.flowSettings") }}</h1>
      </div>
      <button class="btn btn-primary btn-sm" :disabled="saving" @click="save">
        {{ t("common.save") }}
      </button>
    </div>

    <div v-if="saveError" class="alert alert-error">{{ saveError }}</div>

    <div v-if="pending" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-md" />
    </div>
    <div v-else-if="error" class="alert alert-error">{{ t("common.error") }}</div>

    <template v-else-if="data?.flow">
      <!-- General -->
      <div class="settings-section">
        <h2 class="settings-section__title">{{ t("applications.settings.general") }}</h2>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">{{ t("applications.settings.name") }}</label>
            <input v-model="flowName" type="text" class="input input-sm w-full" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">{{ t("applications.settings.status") }}</label>
            <select v-model="flowStatus" class="select select-sm w-full">
              <option value="draft">{{ t("applications.status.draft") }}</option>
              <option value="active">{{ t("applications.status.active") }}</option>
              <option value="inactive">{{ t("applications.status.inactive") }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Discord Embed -->
      <div class="settings-section">
        <h2 class="settings-section__title">{{ t("applications.settings.discordEmbed") }}</h2>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">{{ t("applications.settings.channelId") }}</label>
            <input v-model="settings.embed.channelId" type="text" class="input input-sm w-full" placeholder="e.g. 123456789012345678" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">{{ t("applications.settings.embedDescription") }}</label>
            <textarea v-model="settings.embed.description" class="textarea textarea-sm w-full" rows="3" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">{{ t("applications.settings.buttonLabel") }}</label>
            <input v-model="settings.embed.buttonLabel" type="text" class="input input-sm w-full" :placeholder="t('applications.settings.applyNow')" />
          </div>
        </div>
      </div>

      <!-- Roles -->
      <div class="settings-section">
        <h2 class="settings-section__title">{{ t("applications.settings.roles") }}</h2>
        <p class="text-sm mb-3" style="color: var(--color-base-content-secondary)">
          {{ t("applications.settings.rolesDescription") }}
        </p>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">{{ t("applications.settings.onSubmission") }}</label>
            <div v-if="rolesLoading" class="text-sm" style="color: var(--color-base-content-secondary)">{{ t("applications.settings.loadingRoles") }}</div>
            <div v-else class="flex flex-wrap gap-2">
              <label
                v-for="role in guildRoles"
                :key="role.id"
                class="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm cursor-pointer"
                style="background: var(--color-surface-3)"
              >
                <input
                  type="checkbox"
                  :checked="settings.roles.onSubmission.includes(role.id)"
                  @change="
                    settings.roles.onSubmission.includes(role.id)
                      ? (settings.roles.onSubmission = settings.roles.onSubmission.filter((r) => r !== role.id))
                      : settings.roles.onSubmission.push(role.id)
                  "
                />
                {{ role.name }}
              </label>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">{{ t("applications.settings.onApproval") }}</label>
            <div v-if="rolesLoading" class="text-sm" style="color: var(--color-base-content-secondary)">{{ t("applications.settings.loadingRoles") }}</div>
            <div v-else class="flex flex-wrap gap-2">
              <label
                v-for="role in guildRoles"
                :key="role.id"
                class="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm cursor-pointer"
                style="background: var(--color-surface-3)"
              >
                <input
                  type="checkbox"
                  :checked="settings.roles.onApproval.includes(role.id)"
                  @change="
                    settings.roles.onApproval.includes(role.id)
                      ? (settings.roles.onApproval = settings.roles.onApproval.filter((r) => r !== role.id))
                      : settings.roles.onApproval.push(role.id)
                  "
                />
                {{ role.name }}
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Welcome -->
      <div class="settings-section">
        <h2 class="settings-section__title">{{ t("applications.settings.welcome") }}</h2>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">{{ t("applications.settings.welcomeChannelId") }}</label>
            <input v-model="settings.welcome.channelId" type="text" class="input input-sm w-full" :placeholder="t('applications.settings.channelId')" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">{{ t("applications.settings.welcomeMessageTemplate") }}</label>
            <textarea
              v-model="settings.welcome.messageTemplate"
              class="textarea textarea-sm w-full"
              rows="2"
              placeholder="Welcome {discordId}!"
            />
            <p class="mt-1 text-xs" style="color: var(--color-base-content-secondary)">
              {{ t("applications.settings.welcomeMessageHint") }}
            </p>
          </div>
        </div>
      </div>

      <!-- Behavior -->
      <div class="settings-section">
        <h2 class="settings-section__title">{{ t("applications.settings.behavior") }}</h2>
        <div class="space-y-4">
          <label class="flex items-center gap-3 cursor-pointer">
            <input v-model="settings.concurrency.allowReapplyToSameFlow" type="checkbox" class="toggle toggle-sm" />
            <span class="text-sm">{{ t("applications.settings.allowReapply") }}</span>
          </label>
          <label class="flex items-center gap-3 cursor-pointer">
            <input v-model="settings.concurrency.allowCrossFlowApplications" type="checkbox" class="toggle toggle-sm" />
            <span class="text-sm">{{ t("applications.settings.allowCrossFlow") }}</span>
          </label>
          <label class="flex items-center gap-3 cursor-pointer">
            <input v-model="settings.testMode" type="checkbox" class="toggle toggle-sm" />
            <span class="text-sm">{{ t("applications.settings.testMode") }}</span>
          </label>
          <div>
            <label class="block text-sm font-medium mb-1">{{ t("applications.settings.archiveRetention") }}</label>
            <input v-model.number="settings.archiveRetentionDays" type="number" class="input input-sm w-32" min="0" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">{{ t("applications.settings.tokenExpiry") }}</label>
            <input v-model.number="settings.tokenExpiryMinutes" type="number" class="input input-sm w-32" min="1" max="1440" />
          </div>
        </div>
      </div>

      <!-- Messages -->
      <div class="settings-section">
        <h2 class="settings-section__title">{{ t("applications.settings.discordMessages") }}</h2>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">{{ t("applications.settings.ephemeralConfirmation") }}</label>
            <input v-model="settings.messages.ephemeralConfirmation" type="text" class="input input-sm w-full" :placeholder="t('applications.settings.ephemeralConfirmationPlaceholder')" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">{{ t("applications.settings.ephemeralButtonLabel") }}</label>
            <input v-model="settings.messages.ephemeralButtonLabel" type="text" class="input input-sm w-full" :placeholder="t('applications.settings.ephemeralButtonLabelPlaceholder')" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">{{ t("applications.settings.tokenExpiredMessage") }}</label>
            <input v-model="settings.messages.tokenExpired" type="text" class="input input-sm w-full" :placeholder="t('applications.settings.tokenExpiredPlaceholder')" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">{{ t("applications.settings.dmOnApproval") }}</label>
            <textarea v-model="settings.messages.dmOnApproval" class="textarea textarea-sm w-full" rows="2" :placeholder="t('applications.settings.dmOnApprovalPlaceholder')" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">{{ t("applications.settings.dmOnRejection") }}</label>
            <textarea v-model="settings.messages.dmOnRejection" class="textarea textarea-sm w-full" rows="2" :placeholder="t('applications.settings.dmOnRejectionPlaceholder')" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">{{ t("applications.settings.dmToModerators") }}</label>
            <textarea v-model="settings.messages.dmToModsOnSubmission" class="textarea textarea-sm w-full" rows="2" :placeholder="t('applications.settings.dmToModeratorsPlaceholder')" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">{{ t("applications.settings.submissionConfirmation") }}</label>
            <input v-model="settings.messages.submissionConfirmation" type="text" class="input input-sm w-full" :placeholder="t('applications.settings.submissionConfirmationPlaceholder')" />
          </div>
        </div>
      </div>

      <!-- Save button at bottom -->
      <div class="flex justify-end pt-4">
        <button class="btn btn-primary" :disabled="saving" @click="save">
          {{ saving ? t("common.loading") : t("common.save") }}
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.settings-section {
  border-radius: 0.75rem;
  padding: 1.5rem;
  background: var(--color-surface-2);
  box-shadow: var(--shadow-sm);
}

.settings-section__title {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1rem;
}
</style>
