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

type GuildChannel = {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
};

const { data, pending, error, refresh } = await useFetch<FlowResponse>(`/api/applications/flows/${flowId}`);

const guildRoles = ref<GuildRole[]>([]);
const rolesLoading = ref(true);
const guildChannels = ref<GuildChannel[]>([]);
const channelsLoading = ref(true);

onMounted(async () => {
  const rolesPromise = $fetch<{ guildRoles: GuildRole[] }>("/api/admin/discord-roles")
    .then((result) => {
      guildRoles.value = result.guildRoles.filter((r) => !r.managed).sort((a, b) => b.position - a.position);
    })
    .catch(() => {})
    .finally(() => { rolesLoading.value = false; });

  const channelsPromise = $fetch<{ channels: GuildChannel[] }>("/api/admin/discord-channels")
    .then((result) => {
      guildChannels.value = result.channels;
    })
    .catch(() => {})
    .finally(() => { channelsLoading.value = false; });

  await Promise.all([rolesPromise, channelsPromise]);
});

const textChannels = computed(() => {
  const categories = new Map<string | null, GuildChannel[]>();
  for (const ch of guildChannels.value) {
    if (ch.type !== "text") continue;
    const parent = ch.parentId || null;
    if (!categories.has(parent)) categories.set(parent, []);
    categories.get(parent)!.push(ch);
  }
  return { categories, all: guildChannels.value };
});

const categoryChannels = computed(() =>
  guildChannels.value.filter((ch) => ch.type === "category")
);

const categoryName = (parentId: string | null) => {
  if (!parentId) return null;
  const cat = guildChannels.value.find((ch) => ch.id === parentId && ch.type === "category");
  return cat?.name ?? null;
};

const saving = ref(false);
const saveError = ref("");

// Editable form state
const flowName = ref("");
const flowStatus = ref<"draft" | "active" | "inactive">("draft");
const settings = ref<ApplicationFlowSettings>({
  embed: {},
  roles: { onSubmission: [], removeOnSubmission: [], onApproval: [], removeOnApproval: [] },
  welcome: {},
  concurrency: { allowReapplyToSameFlow: false, allowCrossFlowApplications: true },
  archiveRetentionDays: 0,
  testMode: false,
  tokenExpiryMinutes: 60,
  messages: {},
  ticket: { enabled: false, type: "thread", accessRoleIds: [] }
});

// Initialize from loaded data
watch(data, (d) => {
  if (d?.flow) {
    flowName.value = d.flow.name;
    flowStatus.value = d.flow.status;
    settings.value = { ...settings.value, ...d.flow.settingsJson };
    if (!settings.value.ticket) {
      settings.value.ticket = { enabled: false, type: "thread", accessRoleIds: [] };
    }
  }
}, { immediate: true });

// Role multiselect dropdown state
const openDropdown = ref<string | null>(null);

function toggleDropdown(key: string) {
  openDropdown.value = openDropdown.value === key ? null : key;
}

function toggleRoleIn(arr: string[], roleId: string): string[] {
  return arr.includes(roleId) ? arr.filter((r) => r !== roleId) : [...arr, roleId];
}

function roleName(roleId: string): string {
  return guildRoles.value.find((r) => r.id === roleId)?.name ?? roleId;
}

// Close dropdown on outside click
function onClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target.closest(".role-multiselect")) {
    openDropdown.value = null;
  }
}

onMounted(() => {
  document.addEventListener("click", onClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("click", onClickOutside);
});

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
            <input v-model="flowName" type="text" class="input input-sm w-full" >
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

      <!-- Discord -->
      <div class="settings-section">
        <h2 class="settings-section__title">Discord</h2>

        <!-- Embed -->
        <h3 class="text-sm font-semibold mb-2 mt-4">{{ t("applications.settings.discordEmbed") }}</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">{{ t("applications.settings.channelId") }}</label>
            <select v-if="!channelsLoading && guildChannels.length" v-model="settings.embed.channelId" class="select select-sm w-full">
              <option value="">{{ t("applications.settings.selectChannel") }}</option>
              <template v-for="[parentId, channels] in textChannels.categories" :key="parentId ?? '_none'">
                <optgroup v-if="categoryName(parentId)" :label="categoryName(parentId)!">
                  <option v-for="ch in channels" :key="ch.id" :value="ch.id"># {{ ch.name }}</option>
                </optgroup>
                <template v-else>
                  <option v-for="ch in channels" :key="ch.id" :value="ch.id"># {{ ch.name }}</option>
                </template>
              </template>
            </select>
            <div v-else-if="channelsLoading" class="text-sm" style="color: var(--color-base-content-secondary)">{{ t("applications.settings.loadingChannels") }}</div>
            <input v-else v-model="settings.embed.channelId" type="text" class="input input-sm w-full" placeholder="e.g. 123456789012345678" >
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">{{ t("applications.settings.embedDescription") }}</label>
            <textarea v-model="settings.embed.description" class="textarea textarea-sm w-full" rows="3" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">{{ t("applications.settings.buttonLabel") }}</label>
            <input v-model="settings.embed.buttonLabel" type="text" class="input input-sm w-full" :placeholder="t('applications.settings.applyNow')" >
          </div>
        </div>

        <div class="settings-section__divider" />

        <!-- Welcome -->
        <h3 class="text-sm font-semibold mb-2">{{ t("applications.settings.welcome") }}</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">{{ t("applications.settings.welcomeChannelId") }}</label>
            <select v-if="!channelsLoading && guildChannels.length" v-model="settings.welcome.channelId" class="select select-sm w-full">
              <option value="">{{ t("applications.settings.selectChannel") }}</option>
              <template v-for="[parentId, channels] in textChannels.categories" :key="parentId ?? '_none'">
                <optgroup v-if="categoryName(parentId)" :label="categoryName(parentId)!">
                  <option v-for="ch in channels" :key="ch.id" :value="ch.id"># {{ ch.name }}</option>
                </optgroup>
                <template v-else>
                  <option v-for="ch in channels" :key="ch.id" :value="ch.id"># {{ ch.name }}</option>
                </template>
              </template>
            </select>
            <div v-else-if="channelsLoading" class="text-sm" style="color: var(--color-base-content-secondary)">{{ t("applications.settings.loadingChannels") }}</div>
            <input v-else v-model="settings.welcome.channelId" type="text" class="input input-sm w-full" :placeholder="t('applications.settings.channelId')" >
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

        <div class="settings-section__divider" />

        <!-- Messages -->
        <h3 class="text-sm font-semibold mb-2">{{ t("applications.settings.discordMessages") }}</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">{{ t("applications.settings.ephemeralConfirmation") }}</label>
            <input v-model="settings.messages.ephemeralConfirmation" type="text" class="input input-sm w-full" :placeholder="t('applications.settings.ephemeralConfirmationPlaceholder')" >
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">{{ t("applications.settings.ephemeralButtonLabel") }}</label>
            <input v-model="settings.messages.ephemeralButtonLabel" type="text" class="input input-sm w-full" :placeholder="t('applications.settings.ephemeralButtonLabelPlaceholder')" >
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">{{ t("applications.settings.tokenExpiredMessage") }}</label>
            <input v-model="settings.messages.tokenExpired" type="text" class="input input-sm w-full" :placeholder="t('applications.settings.tokenExpiredPlaceholder')" >
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
            <input v-model="settings.messages.submissionConfirmation" type="text" class="input input-sm w-full" :placeholder="t('applications.settings.submissionConfirmationPlaceholder')" >
          </div>
        </div>
      </div>

      <!-- Roles -->
      <div class="settings-section">
        <h2 class="settings-section__title">{{ t("applications.settings.roles") }}</h2>
        <p class="text-sm mb-3" style="color: var(--color-base-content-secondary)">
          {{ t("applications.settings.rolesDescription") }}
        </p>
        <div class="space-y-6">
          <!-- On Submission -->
          <div class="space-y-3">
            <h3 class="text-sm font-semibold">{{ t("applications.settings.onSubmission") }}</h3>
            <!-- Assign -->
            <div>
              <label class="block text-xs font-medium mb-1" style="color: var(--color-base-content-secondary)">{{ t("applications.settings.assignRoles") }}</label>
              <div v-if="rolesLoading" class="text-sm" style="color: var(--color-base-content-secondary)">{{ t("applications.settings.loadingRoles") }}</div>
              <div v-else class="role-multiselect" @click.stop>
                <button type="button" class="role-multiselect__trigger" @click="toggleDropdown('submit-assign')">
                  <span v-if="settings.roles.onSubmission.length" class="role-multiselect__tags">
                    <span v-for="id in settings.roles.onSubmission" :key="id" class="role-multiselect__tag">
                      {{ roleName(id) }}
                      <button type="button" class="role-multiselect__tag-remove" @click.stop="settings.roles.onSubmission = toggleRoleIn(settings.roles.onSubmission, id)">&times;</button>
                    </span>
                  </span>
                  <span v-else class="role-multiselect__placeholder">{{ t("applications.settings.selectRoles") }}</span>
                  <svg class="role-multiselect__chevron" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>
                </button>
                <div v-if="openDropdown === 'submit-assign'" class="role-multiselect__dropdown">
                  <label v-for="role in guildRoles" :key="role.id" class="role-multiselect__option">
                    <input type="checkbox" :checked="settings.roles.onSubmission.includes(role.id)" @change="settings.roles.onSubmission = toggleRoleIn(settings.roles.onSubmission, role.id)" >
                    {{ role.name }}
                  </label>
                </div>
              </div>
            </div>
            <!-- Remove -->
            <div>
              <label class="block text-xs font-medium mb-1" style="color: var(--color-base-content-secondary)">{{ t("applications.settings.removeRoles") }}</label>
              <div v-if="rolesLoading" class="text-sm" style="color: var(--color-base-content-secondary)">{{ t("applications.settings.loadingRoles") }}</div>
              <div v-else class="role-multiselect" @click.stop>
                <button type="button" class="role-multiselect__trigger" @click="toggleDropdown('submit-remove')">
                  <span v-if="(settings.roles.removeOnSubmission ?? []).length" class="role-multiselect__tags">
                    <span v-for="id in (settings.roles.removeOnSubmission ?? [])" :key="id" class="role-multiselect__tag">
                      {{ roleName(id) }}
                      <button type="button" class="role-multiselect__tag-remove" @click.stop="settings.roles.removeOnSubmission = toggleRoleIn(settings.roles.removeOnSubmission ?? [], id)">&times;</button>
                    </span>
                  </span>
                  <span v-else class="role-multiselect__placeholder">{{ t("applications.settings.selectRoles") }}</span>
                  <svg class="role-multiselect__chevron" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>
                </button>
                <div v-if="openDropdown === 'submit-remove'" class="role-multiselect__dropdown">
                  <label v-for="role in guildRoles" :key="role.id" class="role-multiselect__option">
                    <input type="checkbox" :checked="(settings.roles.removeOnSubmission ?? []).includes(role.id)" @change="settings.roles.removeOnSubmission = toggleRoleIn(settings.roles.removeOnSubmission ?? [], role.id)" >
                    {{ role.name }}
                  </label>
                </div>
              </div>
            </div>
          </div>
          <!-- On Approval -->
          <div class="space-y-3">
            <h3 class="text-sm font-semibold">{{ t("applications.settings.onApproval") }}</h3>
            <!-- Assign -->
            <div>
              <label class="block text-xs font-medium mb-1" style="color: var(--color-base-content-secondary)">{{ t("applications.settings.assignRoles") }}</label>
              <div v-if="rolesLoading" class="text-sm" style="color: var(--color-base-content-secondary)">{{ t("applications.settings.loadingRoles") }}</div>
              <div v-else class="role-multiselect" @click.stop>
                <button type="button" class="role-multiselect__trigger" @click="toggleDropdown('approve-assign')">
                  <span v-if="settings.roles.onApproval.length" class="role-multiselect__tags">
                    <span v-for="id in settings.roles.onApproval" :key="id" class="role-multiselect__tag">
                      {{ roleName(id) }}
                      <button type="button" class="role-multiselect__tag-remove" @click.stop="settings.roles.onApproval = toggleRoleIn(settings.roles.onApproval, id)">&times;</button>
                    </span>
                  </span>
                  <span v-else class="role-multiselect__placeholder">{{ t("applications.settings.selectRoles") }}</span>
                  <svg class="role-multiselect__chevron" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>
                </button>
                <div v-if="openDropdown === 'approve-assign'" class="role-multiselect__dropdown">
                  <label v-for="role in guildRoles" :key="role.id" class="role-multiselect__option">
                    <input type="checkbox" :checked="settings.roles.onApproval.includes(role.id)" @change="settings.roles.onApproval = toggleRoleIn(settings.roles.onApproval, role.id)" >
                    {{ role.name }}
                  </label>
                </div>
              </div>
            </div>
            <!-- Remove -->
            <div>
              <label class="block text-xs font-medium mb-1" style="color: var(--color-base-content-secondary)">{{ t("applications.settings.removeRoles") }}</label>
              <div v-if="rolesLoading" class="text-sm" style="color: var(--color-base-content-secondary)">{{ t("applications.settings.loadingRoles") }}</div>
              <div v-else class="role-multiselect" @click.stop>
                <button type="button" class="role-multiselect__trigger" @click="toggleDropdown('approve-remove')">
                  <span v-if="(settings.roles.removeOnApproval ?? []).length" class="role-multiselect__tags">
                    <span v-for="id in (settings.roles.removeOnApproval ?? [])" :key="id" class="role-multiselect__tag">
                      {{ roleName(id) }}
                      <button type="button" class="role-multiselect__tag-remove" @click.stop="settings.roles.removeOnApproval = toggleRoleIn(settings.roles.removeOnApproval ?? [], id)">&times;</button>
                    </span>
                  </span>
                  <span v-else class="role-multiselect__placeholder">{{ t("applications.settings.selectRoles") }}</span>
                  <svg class="role-multiselect__chevron" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>
                </button>
                <div v-if="openDropdown === 'approve-remove'" class="role-multiselect__dropdown">
                  <label v-for="role in guildRoles" :key="role.id" class="role-multiselect__option">
                    <input type="checkbox" :checked="(settings.roles.removeOnApproval ?? []).includes(role.id)" @change="settings.roles.removeOnApproval = toggleRoleIn(settings.roles.removeOnApproval ?? [], role.id)" >
                    {{ role.name }}
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Ticket -->
      <div class="settings-section">
        <h2 class="settings-section__title">{{ t("applications.settings.ticket") }}</h2>
        <p class="text-sm mb-3" style="color: var(--color-base-content-secondary)">
          {{ t("applications.settings.ticketDescription") }}
        </p>
        <div class="space-y-4">
          <label class="flex items-center gap-3 cursor-pointer">
            <input v-model="settings.ticket!.enabled" type="checkbox" class="toggle toggle-sm" >
            <span class="text-sm">{{ t("applications.settings.ticketEnabled") }}</span>
          </label>

          <template v-if="settings.ticket?.enabled">
            <!-- Ticket Type -->
            <div>
              <label class="block text-sm font-medium mb-1">{{ t("applications.settings.ticketType") }}</label>
              <select v-model="settings.ticket!.type" class="select select-sm w-full">
                <option value="thread">{{ t("applications.settings.ticketTypeThread") }}</option>
                <option value="channel">{{ t("applications.settings.ticketTypeChannel") }}</option>
              </select>
            </div>

            <!-- Thread: Parent Channel -->
            <div v-if="settings.ticket!.type === 'thread'">
              <label class="block text-sm font-medium mb-1">{{ t("applications.settings.ticketParentChannel") }}</label>
              <select v-if="!channelsLoading && guildChannels.length" v-model="settings.ticket!.parentChannelId" class="select select-sm w-full">
                <option value="">{{ t("applications.settings.selectChannel") }}</option>
                <template v-for="[parentId, channels] in textChannels.categories" :key="parentId ?? '_none'">
                  <optgroup v-if="categoryName(parentId)" :label="categoryName(parentId)!">
                    <option v-for="ch in channels" :key="ch.id" :value="ch.id"># {{ ch.name }}</option>
                  </optgroup>
                  <template v-else>
                    <option v-for="ch in channels" :key="ch.id" :value="ch.id"># {{ ch.name }}</option>
                  </template>
                </template>
              </select>
              <div v-else-if="channelsLoading" class="text-sm" style="color: var(--color-base-content-secondary)">{{ t("applications.settings.loadingChannels") }}</div>
            </div>

            <!-- Channel: Parent Category -->
            <div v-if="settings.ticket!.type === 'channel'">
              <label class="block text-sm font-medium mb-1">{{ t("applications.settings.ticketParentCategory") }}</label>
              <select v-if="!channelsLoading && categoryChannels.length" v-model="settings.ticket!.parentCategoryId" class="select select-sm w-full">
                <option value="">{{ t("applications.settings.selectChannel") }}</option>
                <option v-for="cat in categoryChannels" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
              </select>
              <div v-else-if="channelsLoading" class="text-sm" style="color: var(--color-base-content-secondary)">{{ t("applications.settings.loadingChannels") }}</div>
            </div>

            <!-- Access Roles -->
            <div>
              <label class="block text-sm font-medium mb-1">{{ t("applications.settings.ticketAccessRoles") }}</label>
              <p class="text-xs mb-1" style="color: var(--color-base-content-secondary)">{{ t("applications.settings.ticketAccessRolesHint") }}</p>
              <div v-if="rolesLoading" class="text-sm" style="color: var(--color-base-content-secondary)">{{ t("applications.settings.loadingRoles") }}</div>
              <div v-else class="role-multiselect" @click.stop>
                <button type="button" class="role-multiselect__trigger" @click="toggleDropdown('ticket-access')">
                  <span v-if="settings.ticket!.accessRoleIds.length" class="role-multiselect__tags">
                    <span v-for="id in settings.ticket!.accessRoleIds" :key="id" class="role-multiselect__tag">
                      {{ roleName(id) }}
                      <button type="button" class="role-multiselect__tag-remove" @click.stop="settings.ticket!.accessRoleIds = toggleRoleIn(settings.ticket!.accessRoleIds, id)">&times;</button>
                    </span>
                  </span>
                  <span v-else class="role-multiselect__placeholder">{{ t("applications.settings.selectRoles") }}</span>
                  <svg class="role-multiselect__chevron" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>
                </button>
                <div v-if="openDropdown === 'ticket-access'" class="role-multiselect__dropdown">
                  <label v-for="role in guildRoles" :key="role.id" class="role-multiselect__option">
                    <input type="checkbox" :checked="settings.ticket!.accessRoleIds.includes(role.id)" @change="settings.ticket!.accessRoleIds = toggleRoleIn(settings.ticket!.accessRoleIds, role.id)" >
                    {{ role.name }}
                  </label>
                </div>
              </div>
            </div>

            <!-- Name Template -->
            <div>
              <label class="block text-sm font-medium mb-1">{{ t("applications.settings.ticketNameTemplate") }}</label>
              <input v-model="settings.ticket!.nameTemplate" type="text" class="input input-sm w-full" :placeholder="t('applications.settings.ticketNameTemplatePlaceholder')" >
              <p class="mt-1 text-xs" style="color: var(--color-base-content-secondary)">{{ t("applications.settings.ticketNameTemplateHint") }}</p>
            </div>

            <!-- Initial Message -->
            <div>
              <label class="block text-sm font-medium mb-1">{{ t("applications.settings.ticketInitialMessage") }}</label>
              <textarea v-model="settings.ticket!.initialMessage" class="textarea textarea-sm w-full" rows="2" :placeholder="t('applications.settings.ticketInitialMessagePlaceholder')" />
              <p class="mt-1 text-xs" style="color: var(--color-base-content-secondary)">{{ t("applications.settings.ticketInitialMessageHint") }}</p>
            </div>
          </template>
        </div>
      </div>

      <!-- Behavior -->
      <div class="settings-section">
        <h2 class="settings-section__title">{{ t("applications.settings.behavior") }}</h2>
        <div class="space-y-4">
          <label class="flex items-center gap-3 cursor-pointer">
            <input v-model="settings.concurrency.allowReapplyToSameFlow" type="checkbox" class="toggle toggle-sm" >
            <span class="text-sm">{{ t("applications.settings.allowReapply") }}</span>
          </label>
          <label class="flex items-center gap-3 cursor-pointer">
            <input v-model="settings.concurrency.allowCrossFlowApplications" type="checkbox" class="toggle toggle-sm" >
            <span class="text-sm">{{ t("applications.settings.allowCrossFlow") }}</span>
          </label>
          <label class="flex items-center gap-3 cursor-pointer">
            <input v-model="settings.testMode" type="checkbox" class="toggle toggle-sm" >
            <span class="text-sm">{{ t("applications.settings.testMode") }}</span>
          </label>
          <div>
            <label class="block text-sm font-medium mb-1">{{ t("applications.settings.archiveRetention") }}</label>
            <input v-model.number="settings.archiveRetentionDays" type="number" class="input input-sm w-32" min="0" >
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">{{ t("applications.settings.tokenExpiry") }}</label>
            <input v-model.number="settings.tokenExpiryMinutes" type="number" class="input input-sm w-32" min="1" max="1440" >
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

.settings-section__divider {
  border-top: 1px solid var(--color-line);
  margin: 1.25rem 0;
}

.role-multiselect {
  position: relative;
}

.role-multiselect__trigger {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  min-height: 2.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.5rem;
  border: 1px solid var(--color-line);
  background: var(--color-surface-3);
  font-size: 0.875rem;
  cursor: pointer;
  text-align: left;
}

.role-multiselect__trigger:hover {
  border-color: var(--color-accent);
}

.role-multiselect__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  flex: 1;
}

.role-multiselect__tag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  border-radius: 0.375rem;
  background: var(--color-accent);
  color: var(--color-accent-content, #fff);
  font-size: 0.75rem;
  line-height: 1.5;
}

.role-multiselect__tag-remove {
  font-size: 0.875rem;
  line-height: 1;
  opacity: 0.7;
  cursor: pointer;
}

.role-multiselect__tag-remove:hover {
  opacity: 1;
}

.role-multiselect__placeholder {
  flex: 1;
  color: var(--color-base-content-secondary);
}

.role-multiselect__chevron {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  color: var(--color-base-content-secondary);
}

.role-multiselect__dropdown {
  position: absolute;
  z-index: 50;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 0.25rem;
  max-height: 16rem;
  overflow-y: auto;
  border-radius: 0.5rem;
  border: 1px solid var(--color-line);
  background: var(--color-surface-3);
  box-shadow: var(--shadow-md, 0 4px 6px -1px rgba(0,0,0,.1));
}

.role-multiselect__option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  cursor: pointer;
}

.role-multiselect__option:hover {
  background: var(--color-surface-4, var(--color-surface-2));
}
</style>
