<script setup lang="ts">
definePageMeta({
  middleware: ["settings"],
});

type RetentionPolicy = {
  id: number;
  category: "voice_sessions" | "audit_logs" | "application_data" | "inactive_users";
  retentionDays: number;
  enabled: boolean;
  updatedAt: string;
};

type RetentionPoliciesResponse = {
  policies: RetentionPolicy[];
};

const { t } = useI18n();
const lastPath = useCookie<string | null>("guildora_settings_last_path", { sameSite: "lax" });
lastPath.value = "/settings/retention";

const { data: policiesData, refresh: refreshPolicies } = await useFetch<RetentionPoliciesResponse>(
  "/api/admin/retention-policies",
  { key: "admin-retention-policies" }
);

// Local editing state — keyed by category
const edits = ref<Record<string, { retentionDays: number; enabled: boolean }>>({});

watch(
  () => policiesData.value?.policies,
  (policies) => {
    if (!policies) return;
    const state: Record<string, { retentionDays: number; enabled: boolean }> = {};
    for (const p of policies) {
      state[p.category] = { retentionDays: p.retentionDays, enabled: p.enabled };
    }
    // Also seed defaults for categories not yet in DB
    const allCategories: Array<{ key: string; defaultDays: number }> = [
      { key: "voice_sessions", defaultDays: 90 },
      { key: "audit_logs", defaultDays: 365 },
      { key: "application_data", defaultDays: 365 },
      { key: "inactive_users", defaultDays: 180 }
    ];
    for (const cat of allCategories) {
      if (!state[cat.key]) {
        state[cat.key] = { retentionDays: cat.defaultDays, enabled: true };
      }
    }
    edits.value = state;
  },
  { immediate: true }
);

const categoryMeta = computed(() => [
  {
    key: "voice_sessions" as const,
    icon: "proicons:microphone",
    defaultDays: 90,
    description: t("settings.retention.categoryVoiceDesc")
  },
  {
    key: "audit_logs" as const,
    icon: "proicons:clipboard",
    defaultDays: 365,
    description: t("settings.retention.categoryAuditDesc")
  },
  {
    key: "application_data" as const,
    icon: "proicons:document",
    defaultDays: 365,
    description: t("settings.retention.categoryApplicationDesc")
  },
  {
    key: "inactive_users" as const,
    icon: "proicons:person-multiple",
    defaultDays: 180,
    description: t("settings.retention.categoryInactiveDesc")
  }
]);

const hasChanges = computed(() => {
  const original = policiesData.value?.policies ?? [];
  for (const cat of categoryMeta.value) {
    const orig = original.find((p) => p.category === cat.key);
    const edit = edits.value[cat.key];
    if (!edit) continue;
    if (!orig) {
      // New category — if values differ from defaults, it's a change
      if (edit.retentionDays !== cat.defaultDays || !edit.enabled) return true;
      continue;
    }
    if (orig.retentionDays !== edit.retentionDays || orig.enabled !== edit.enabled) return true;
  }
  return false;
});

const savePending = ref(false);
const saveError = ref("");
const saveSuccess = ref("");

const clearMessages = () => {
  saveError.value = "";
  saveSuccess.value = "";
};

const savePolicies = async () => {
  clearMessages();
  savePending.value = true;
  try {
    const policies = categoryMeta.value.map((cat) => {
      const edit = edits.value[cat.key];
      return {
        category: cat.key,
        retentionDays: edit?.retentionDays ?? cat.defaultDays,
        enabled: edit?.enabled ?? true
      };
    });
    await $fetch("/api/admin/retention-policies", {
      method: "PUT",
      body: { policies }
    });
    saveSuccess.value = t("settings.retention.saveSuccess");
    await refreshPolicies();
  } catch {
    saveError.value = t("settings.retention.saveError");
  } finally {
    savePending.value = false;
  }
};

const formatDays = (value: number) => {
  if (value >= 365) {
    const years = Math.round(value / 365 * 10) / 10;
    return t("settings.retention.years", { years });
  }
  return t("settings.retention.days", { days: value });
};
</script>

<template>
  <section class="space-y-6">
    <header class="space-y-2">
      <h1 class="text-2xl font-bold md:text-3xl">{{ $t("settings.retention.title") }}</h1>
      <p class="opacity-80">{{ $t("settings.retention.description") }}</p>
    </header>

    <!-- Retention Policies Table -->
    <div class="rounded-2xl bg-base-200 p-6 shadow-md">
      <div class="space-y-4">
        <!-- Header Row (desktop) -->
        <div class="hidden md:grid grid-cols-[1fr_140px_80px] gap-4 items-end text-xs font-semibold uppercase tracking-wider opacity-50 px-4 pb-2">
          <span>{{ $t("settings.retention.columnCategory") }}</span>
          <span>{{ $t("settings.retention.columnDays") }}</span>
          <span class="text-center">{{ $t("settings.retention.columnEnabled") }}</span>
        </div>

        <!-- Policy Rows -->
        <div
          v-for="cat in categoryMeta"
          :key="cat.key"
          class="rounded-xl bg-base-300 p-4"
        >
          <div class="grid grid-cols-1 md:grid-cols-[1fr_140px_80px] gap-4 items-center">
            <!-- Category Info -->
            <div class="flex items-start gap-3">
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-base-200">
                <Icon :name="cat.icon" class="text-lg opacity-70" />
              </div>
              <div class="min-w-0">
                <h3 class="font-semibold text-sm">{{ $t(`settings.retention.category${cat.key.charAt(0).toUpperCase() + cat.key.slice(1).replace(/_([a-z])/g, (_, c) => c.toUpperCase())}`) }}</h3>
                <p class="text-xs opacity-60 mt-0.5">{{ cat.description }}</p>
              </div>
            </div>

            <!-- Retention Days -->
            <div class="flex items-center gap-2">
              <UiInput
                :model-value="edits[cat.key]?.retentionDays ?? cat.defaultDays"
                type="number"
                size="sm"
                :min="1"
                :max="3650"
                class="w-24"
                @update:model-value="(v: string | number | null) => { if (edits[cat.key]) edits[cat.key]!.retentionDays = Math.max(1, Math.min(3650, Number(v) || 1)); }"
              />
              <span class="text-xs opacity-50 whitespace-nowrap">{{ $t("settings.retention.daysUnit") }}</span>
            </div>

            <!-- Enabled Toggle -->
            <div class="flex justify-center">
              <input
                type="checkbox"
                class="toggle toggle-sm"
                :checked="edits[cat.key]?.enabled ?? true"
                @change="(e: Event) => { if (edits[cat.key]) edits[cat.key]!.enabled = (e.target as HTMLInputElement).checked; }"
              >
            </div>
          </div>
        </div>

        <!-- Info Box -->
        <div class="rounded-xl bg-info/10 px-4 py-3 text-sm text-info flex items-start gap-2">
          <Icon name="proicons:info" class="text-base mt-0.5 shrink-0" />
          <span>{{ $t("settings.retention.infoNotice") }}</span>
        </div>

        <!-- Save -->
        <div class="flex items-center gap-4">
          <UiButton
            :disabled="savePending || !hasChanges"
            @click="savePolicies"
          >
            {{ savePending ? $t("common.loading") : $t("common.save") }}
          </UiButton>
          <span v-if="hasChanges" class="text-xs opacity-50">{{ $t("settings.retention.unsavedChanges") }}</span>
        </div>

        <div v-if="saveError" class="alert alert-error">{{ saveError }}</div>
        <div v-if="saveSuccess" class="alert alert-success">{{ saveSuccess }}</div>
      </div>
    </div>

    <!-- Current Values Summary -->
    <div v-if="policiesData?.policies?.length" class="rounded-2xl bg-base-200 p-6 shadow-md">
      <h2 class="text-sm font-semibold uppercase tracking-wider opacity-50 mb-3">
        {{ $t("settings.retention.currentConfig") }}
      </h2>
      <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="policy in policiesData.policies"
          :key="policy.category"
          class="flex items-center gap-3 rounded-xl bg-base-300 px-4 py-3"
        >
          <span
            class="h-2 w-2 rounded-full shrink-0"
            :class="policy.enabled ? 'bg-success' : 'bg-base-content/20'"
          />
          <div class="min-w-0">
            <p class="text-xs truncate opacity-60">
              {{ $t(`settings.retention.category${policy.category.charAt(0).toUpperCase() + policy.category.slice(1).replace(/_([a-z])/g, (_, c) => c.toUpperCase())}`) }}
            </p>
            <p class="text-sm font-medium">
              {{ policy.enabled ? formatDays(policy.retentionDays) : $t("settings.retention.disabled") }}
            </p>
          </div>
        </div>
      </div>
      <p class="text-xs opacity-40 mt-3">
        {{ $t("settings.retention.lastUpdated") }}
        {{ new Date(Math.max(...policiesData.policies.map((p) => new Date(p.updatedAt).getTime()))).toLocaleString() }}
      </p>
    </div>
  </section>
</template>
