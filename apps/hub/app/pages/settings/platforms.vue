<script setup lang="ts">
definePageMeta({
  middleware: ["settings"],
});

type PlatformConnection = {
  id: string;
  platform: "discord" | "matrix";
  enabled: boolean;
  botInternalUrl: string | null;
  status: "connected" | "disconnected" | "error";
  statusMessage: string | null;
  lastHealthCheck: string | null;
  createdAt: string;
  updatedAt: string;
};

const { t } = useI18n();
const lastPath = useCookie<string | null>("guildora_settings_last_path", { sameSite: "lax" });
lastPath.value = "/settings/platforms";

const { data: platformsData, refresh: refreshPlatforms } = await useFetch<{ platforms: PlatformConnection[] }>(
  "/api/admin/platforms",
  { key: "admin-platforms" }
);

const platforms = computed(() => platformsData.value?.platforms ?? []);
const discordConnection = computed(() => platforms.value.find((p) => p.platform === "discord"));
const matrixConnection = computed(() => platforms.value.find((p) => p.platform === "matrix"));

// ─── Add Platform Dialog ────────────────────────────────────────────────

const showAddDialog = ref(false);
const addPlatformType = ref<"discord" | "matrix">("discord");
const addPending = ref(false);
const addError = ref("");

// Discord fields
const discordBotToken = ref("");
const discordClientId = ref("");
const discordClientSecret = ref("");
const discordGuildId = ref("");
const discordBotUrl = ref("");
const discordBotTokenField = ref("");

// Matrix fields
const matrixHomeserverUrl = ref("");
const matrixAccessToken = ref("");
const matrixSpaceId = ref("");
const matrixBotUrl = ref("");
const matrixBotTokenField = ref("");
const matrixExperimentalAck = ref(false);

const resetAddForm = () => {
  addError.value = "";
  discordBotToken.value = "";
  discordClientId.value = "";
  discordClientSecret.value = "";
  discordGuildId.value = "";
  discordBotUrl.value = "";
  discordBotTokenField.value = "";
  matrixHomeserverUrl.value = "";
  matrixAccessToken.value = "";
  matrixSpaceId.value = "";
  matrixBotUrl.value = "";
  matrixBotTokenField.value = "";
  matrixExperimentalAck.value = false;
};

const openAddDialog = (platform: "discord" | "matrix") => {
  resetAddForm();
  addPlatformType.value = platform;
  showAddDialog.value = true;
};

const submitAddPlatform = async () => {
  addPending.value = true;
  addError.value = "";

  try {
    const body: Record<string, unknown> = { platform: addPlatformType.value };

    if (addPlatformType.value === "discord") {
      body.credentials = {
        botToken: discordBotToken.value,
        clientId: discordClientId.value,
        clientSecret: discordClientSecret.value,
        guildId: discordGuildId.value,
      };
      body.botInternalUrl = discordBotUrl.value || undefined;
      body.botInternalToken = discordBotTokenField.value || undefined;
    } else {
      body.credentials = {
        homeserverUrl: matrixHomeserverUrl.value,
        accessToken: matrixAccessToken.value,
        spaceId: matrixSpaceId.value,
        experimentalAck: true,
      };
      body.botInternalUrl = matrixBotUrl.value || undefined;
      body.botInternalToken = matrixBotTokenField.value || undefined;
    }

    await $fetch("/api/admin/platforms", { method: "POST", body });
    showAddDialog.value = false;
    await refreshPlatforms();
  } catch (error: unknown) {
    const fetchError = error as { data?: { statusMessage?: string }; message?: string };
    addError.value = fetchError?.data?.statusMessage || fetchError?.message || "Failed to add platform.";
  } finally {
    addPending.value = false;
  }
};

// ─── Connection Test ────────────────────────────────────────────────────

const testPending = ref<string | null>(null);
const testResult = ref<{ id: string; ok: boolean; message?: string } | null>(null);

const testConnection = async (connection: PlatformConnection) => {
  testPending.value = connection.id;
  testResult.value = null;

  try {
    const result = await $fetch<{ ok: boolean; status: string; message?: string }>(
      `/api/admin/platforms/${connection.id}/test`,
      { method: "POST" }
    );
    testResult.value = { id: connection.id, ok: result.ok, message: result.message };
    await refreshPlatforms();
  } catch {
    testResult.value = { id: connection.id, ok: false, message: "Request failed." };
  } finally {
    testPending.value = null;
  }
};

// ─── Delete ─────────────────────────────────────────────────────────────

const deletePending = ref(false);

const deletePlatform = async (connection: PlatformConnection) => {
  if (!confirm(t("settings.platforms.confirmDelete", { platform: connection.platform }))) return;

  deletePending.value = true;
  try {
    await $fetch(`/api/admin/platforms/${connection.id}`, { method: "DELETE" });
    await refreshPlatforms();
  } catch {
    // ignore
  } finally {
    deletePending.value = false;
  }
};

// ─── Helpers ────────────────────────────────────────────────────────────

const statusColor = (status: string) => {
  if (status === "connected") return "text-success";
  if (status === "error") return "text-error";
  return "text-warning";
};

const statusIcon = (status: string) => {
  if (status === "connected") return "●";
  if (status === "error") return "✕";
  return "○";
};

const platformLabel = (platform: string) => {
  return platform === "discord" ? "Discord" : "Matrix";
};
</script>

<template>
  <div class="space-y-8">
    <div>
      <h2 class="text-xl font-semibold">{{ t("settings.platforms.title") }}</h2>
      <p class="text-sm opacity-60 mt-1">{{ t("settings.platforms.description") }}</p>
    </div>

    <!-- Connected Platforms -->
    <div class="space-y-4">
      <template v-for="connection in platforms" :key="connection.id">
        <div class="bg-base-200 rounded-2xl p-5 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <Icon :name="connection.platform === 'discord' ? 'simple-icons:discord' : 'simple-icons:matrix'" class="text-2xl" />
              <div>
                <h3 class="font-semibold text-lg">{{ platformLabel(connection.platform) }}</h3>
                <span :class="statusColor(connection.status)" class="text-sm flex items-center gap-1">
                  {{ statusIcon(connection.status) }}
                  {{ connection.status }}
                  <span v-if="connection.statusMessage" class="opacity-60">— {{ connection.statusMessage }}</span>
                </span>
              </div>
            </div>
            <div class="flex gap-2">
              <UiButton
                size="sm"
                variant="ghost"
                :loading="testPending === connection.id"
                @click="testConnection(connection)"
              >
                {{ t("settings.platforms.testConnection") }}
              </UiButton>
              <UiButton
                size="sm"
                variant="ghost"
                class="text-error"
                :loading="deletePending"
                @click="deletePlatform(connection)"
              >
                {{ t("settings.platforms.disconnect") }}
              </UiButton>
            </div>
          </div>

          <!-- Test result -->
          <div
            v-if="testResult?.id === connection.id"
            :class="testResult.ok ? 'bg-success/10 text-success' : 'bg-error/10 text-error'"
            class="text-sm rounded-xl px-4 py-2"
          >
            {{ testResult.ok ? t("settings.platforms.testSuccess") : testResult.message }}
          </div>

          <div class="text-xs opacity-40">
            {{ t("settings.platforms.connectedSince") }}: {{ new Date(connection.createdAt).toLocaleDateString() }}
            <span v-if="connection.lastHealthCheck">
              · {{ t("settings.platforms.lastCheck") }}: {{ new Date(connection.lastHealthCheck).toLocaleString() }}
            </span>
          </div>
        </div>
      </template>
    </div>

    <!-- Add Platform Buttons -->
    <div class="flex gap-3">
      <UiButton
        v-if="!discordConnection"
        variant="outline"
        @click="openAddDialog('discord')"
      >
        <Icon name="simple-icons:discord" class="mr-2" />
        {{ t("settings.platforms.addDiscord") }}
      </UiButton>
      <UiButton
        v-if="!matrixConnection"
        variant="outline"
        @click="openAddDialog('matrix')"
      >
        <Icon name="simple-icons:matrix" class="mr-2" />
        {{ t("settings.platforms.addMatrix") }}
      </UiButton>
    </div>

    <!-- Add Platform Dialog -->
    <Teleport to="body">
      <div v-if="showAddDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="showAddDialog = false">
        <div class="bg-base-100 rounded-2xl p-6 w-full max-w-lg space-y-5 shadow-xl">
          <UiModalTitle>
            {{ addPlatformType === "discord" ? t("settings.platforms.setupDiscord") : t("settings.platforms.setupMatrix") }}
          </UiModalTitle>

          <!-- Discord Form -->
          <template v-if="addPlatformType === 'discord'">
            <UiInput v-model="discordBotToken" :label="t('settings.platforms.discord.botToken')" type="password" />
            <UiInput v-model="discordClientId" :label="t('settings.platforms.discord.clientId')" />
            <UiInput v-model="discordClientSecret" :label="t('settings.platforms.discord.clientSecret')" type="password" />
            <UiInput v-model="discordGuildId" :label="t('settings.platforms.discord.guildId')" />
            <UiInput v-model="discordBotUrl" :label="t('settings.platforms.botUrl')" placeholder="http://bot:3050" />
            <UiInput v-model="discordBotTokenField" :label="t('settings.platforms.botToken')" type="password" />
          </template>

          <!-- Matrix Form -->
          <template v-if="addPlatformType === 'matrix'">
            <div class="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3">
              <div class="flex items-start gap-2 text-sm text-warning">
                <svg class="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <div class="space-y-1">
                  <p class="font-medium">{{ t('settings.platforms.matrix.experimentalWarning') }}</p>
                  <p class="text-xs text-warning/90">{{ t('settings.platforms.matrix.experimentalCaveats') }}</p>
                </div>
              </div>
            </div>
            <UiCheckbox
              v-model="matrixExperimentalAck"
              :label="t('settings.platforms.matrix.experimentalAck')"
              bare
            />
            <UiInput v-model="matrixHomeserverUrl" :label="t('settings.platforms.matrix.homeserverUrl')" placeholder="https://matrix.example.org" />
            <UiInput v-model="matrixAccessToken" :label="t('settings.platforms.matrix.accessToken')" type="password" />
            <UiInput v-model="matrixSpaceId" :label="t('settings.platforms.matrix.spaceId')" placeholder="!abc:matrix.example.org" />
            <UiInput v-model="matrixBotUrl" :label="t('settings.platforms.botUrl')" placeholder="http://matrix-bot:3051" />
            <UiInput v-model="matrixBotTokenField" :label="t('settings.platforms.botToken')" type="password" />
          </template>

          <div v-if="addError" class="bg-error/10 text-error text-sm rounded-xl px-4 py-2">
            {{ addError }}
          </div>

          <div class="flex gap-3 justify-end">
            <UiButton variant="ghost" @click="showAddDialog = false">{{ t("common.cancel") }}</UiButton>
            <UiButton
              :loading="addPending"
              :disabled="addPending || (addPlatformType === 'matrix' && !matrixExperimentalAck)"
              @click="submitAddPlatform"
            >
              {{ t("settings.platforms.connect") }}
            </UiButton>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
