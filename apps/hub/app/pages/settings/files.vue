<script setup lang="ts">
definePageMeta({
  middleware: ["settings"]
});

const { t } = useI18n();
const { hasRole } = useAuth();
const lastPath = useCookie<string | null>("guildora_settings_last_path", { sameSite: "lax" });
lastPath.value = "/settings/files";

if (!hasRole("superadmin")) {
  navigateTo("/settings");
}

type MediaFile = {
  key: string;
  size: number;
  lastModified: string | null;
};

type FilesResponse = {
  status: { enabled: boolean; provider?: string; bucket?: string; region?: string; publicUrl?: string | null };
  files: Record<string, MediaFile[]>;
  cursor: string | null;
  totalSize: number;
  totalCount: number;
  listError?: string;
};

const { data, refresh } = await useFetch<FilesResponse>("/api/settings/files", {
  key: "settings-files"
});

const status = computed(() => data.value?.status);
const files = computed(() => data.value?.files);
const totalSize = computed(() => data.value?.totalSize ?? 0);
const totalCount = computed(() => data.value?.totalCount ?? 0);
const listError = computed(() => data.value?.listError);

const fileGroups = ["avatars", "theme", "applications", "cms", "other"] as const;

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

// Test connection
const testPending = ref(false);
const testResult = ref<{ ok: boolean; error?: string } | null>(null);

const onTestConnection = async () => {
  testPending.value = true;
  testResult.value = null;
  try {
    testResult.value = await $fetch<{ ok: boolean; error?: string }>("/api/settings/files/test-connection", {
      method: "POST"
    });
  } catch {
    testResult.value = { ok: false, error: t("common.error") };
  } finally {
    testPending.value = false;
  }
};

// Migrate
const migratePending = ref(false);
const migrateResult = ref<{ migrated: number; errors: string[] } | null>(null);

const onMigrate = async () => {
  migratePending.value = true;
  migrateResult.value = null;
  try {
    migrateResult.value = await $fetch<{ migrated: number; errors: string[] }>("/api/settings/files/migrate", {
      method: "POST"
    });
    await refresh();
  } catch {
    migrateResult.value = { migrated: 0, errors: [t("common.error")] };
  } finally {
    migratePending.value = false;
  }
};

// Delete single file
const deleteError = ref("");

const onDeleteFile = async (key: string) => {
  const name = key.split("/").pop() || key;
  if (!confirm(t("settingsFiles.confirmDelete", { name }))) return;
  deleteError.value = "";
  try {
    await $fetch(`/api/settings/files/${key}`, { method: "DELETE" });
    await refresh();
  } catch (error) {
    deleteError.value = (error as { statusMessage?: string })?.statusMessage || t("common.error");
  }
};

// Purge bucket
const purgeConfirmation = ref("");
const purgePending = ref(false);
const purgeError = ref("");

const onPurgeBucket = async () => {
  purgePending.value = true;
  purgeError.value = "";
  try {
    await $fetch("/api/settings/files/bucket", {
      method: "DELETE",
      body: { confirmation: purgeConfirmation.value }
    });
    purgeConfirmation.value = "";
    await refresh();
  } catch (error) {
    purgeError.value = (error as { statusMessage?: string })?.statusMessage || t("common.error");
  } finally {
    purgePending.value = false;
  }
};
</script>

<template>
  <section class="space-y-8">
    <header class="space-y-2">
      <h1 class="text-2xl font-bold md:text-3xl">{{ $t("settingsFiles.title") }}</h1>
    </header>

    <!-- Not configured state -->
    <div v-if="!status?.enabled" class="alert alert-warning">
      <div class="space-y-3">
        <p class="font-semibold">{{ $t("settingsFiles.notConfiguredTitle") }}</p>
        <p>{{ $t("settingsFiles.notConfiguredDescription") }}</p>
        <ul class="list-inside list-disc space-y-1 text-sm opacity-80">
          <li>{{ $t("settingsFiles.warningLoss") }}</li>
          <li>{{ $t("settingsFiles.warningScale") }}</li>
          <li>{{ $t("settingsFiles.warningBackup") }}</li>
        </ul>
        <div class="rounded bg-[var(--color-surface-3)] p-4 font-mono text-xs leading-relaxed">
          BUCKET_PROVIDER=s3<br>
          BUCKET_ENDPOINT=https://s3.eu-central-1.amazonaws.com<br>
          BUCKET_REGION=eu-central-1<br>
          BUCKET_NAME=guildora-media<br>
          BUCKET_ACCESS_KEY_ID=your-access-key<br>
          BUCKET_SECRET_ACCESS_KEY=your-secret-key
        </div>
        <p class="text-sm opacity-70">{{ $t("settingsFiles.restartHint") }}</p>
      </div>
    </div>

    <!-- Configured state -->
    <template v-else>
      <!-- Status card -->
      <div class="alert alert-success">
        <div>
          <p class="font-semibold">{{ $t("settingsFiles.activeTitle") }}</p>
          <div class="mt-2 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
            <span class="opacity-70">Provider:</span>
            <span>{{ status.provider }}</span>
            <span class="opacity-70">Bucket:</span>
            <span>{{ status.bucket }}</span>
            <span class="opacity-70">Region:</span>
            <span>{{ status.region }}</span>
            <template v-if="status.publicUrl">
              <span class="opacity-70">Public URL:</span>
              <span>{{ status.publicUrl }}</span>
            </template>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex flex-wrap gap-3">
        <UiButton :disabled="testPending" @click="onTestConnection">
          {{ testPending ? $t("common.loading") : $t("settingsFiles.testConnection") }}
        </UiButton>
        <UiButton variant="secondary" :disabled="migratePending" @click="onMigrate">
          {{ migratePending ? $t("common.loading") : $t("settingsFiles.migrateLocal") }}
        </UiButton>
      </div>

      <!-- List error (e.g. access denied) -->
      <div v-if="listError" class="alert alert-error">
        <div>
          <p class="font-semibold">{{ $t("settingsFiles.listErrorTitle") }}</p>
          <p class="mt-1 text-sm">{{ listError }}</p>
        </div>
      </div>

      <!-- Test result -->
      <div v-if="testResult" :class="testResult.ok ? 'alert alert-success' : 'alert alert-error'">
        {{ testResult.ok ? $t("settingsFiles.testSuccess") : testResult.error }}
      </div>

      <!-- Migrate result -->
      <div v-if="migrateResult" class="alert alert-info">
        {{ $t("settingsFiles.migrateResult", { count: migrateResult.migrated }) }}
        <ul v-if="migrateResult.errors.length" class="mt-2 list-disc pl-4 text-sm">
          <li v-for="err in migrateResult.errors" :key="err">{{ err }}</li>
        </ul>
      </div>

      <!-- Delete error -->
      <div v-if="deleteError" class="alert alert-error">
        <span>{{ deleteError }}</span>
      </div>

      <!-- File browser (grouped) -->
      <div v-for="group in fileGroups" :key="group" class="space-y-2">
        <template v-if="files?.[group]?.length">
          <h2 class="text-lg font-semibold">
            {{ $t(`settingsFiles.group.${group}`) }}
            <span class="badge badge-outline ml-2">{{ files[group].length }}</span>
          </h2>
          <div
            v-for="file in files[group]"
            :key="file.key"
            class="flex items-center justify-between rounded bg-[var(--color-surface-3)] p-3"
          >
            <div class="min-w-0">
              <span class="truncate text-sm font-medium">{{ file.key.split("/").pop() }}</span>
              <span class="ml-3 text-xs opacity-60">{{ formatBytes(file.size) }}</span>
            </div>
            <button class="btn btn-error btn-xs shrink-0" type="button" @click="onDeleteFile(file.key)">
              {{ $t("common.delete") }}
            </button>
          </div>
        </template>
      </div>

      <!-- Summary -->
      <div v-if="totalCount > 0" class="text-sm opacity-70">
        {{ $t("settingsFiles.summary", { count: totalCount, size: formatBytes(totalSize) }) }}
      </div>

      <!-- Danger zone -->
      <div class="border-t border-line pt-6">
        <h2 class="text-lg font-semibold text-[var(--color-error)]">{{ $t("settingsFiles.dangerZone") }}</h2>
        <p class="mt-2 text-sm opacity-75">{{ $t("settingsFiles.purgeWarning") }}</p>
        <div class="mt-3 flex items-end gap-3">
          <UiInput
            v-model="purgeConfirmation"
            :label="$t('settingsFiles.purgeConfirmLabel', { name: status.bucket })"
            size="sm"
            class="max-w-xs"
          />
          <UiButton
            variant="error"
            size="sm"
            :disabled="purgeConfirmation !== status.bucket || purgePending"
            @click="onPurgeBucket"
          >
            {{ $t("settingsFiles.purgeButton") }}
          </UiButton>
        </div>
        <div v-if="purgeError" class="alert alert-error mt-3">
          <span>{{ purgeError }}</span>
        </div>
      </div>
    </template>
  </section>
</template>
