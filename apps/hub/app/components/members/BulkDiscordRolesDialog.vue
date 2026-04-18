<script setup lang="ts">
interface DiscordGuildRole {
  id: string;
  name: string;
  position: number;
  managed: boolean;
  editable: boolean;
}

const props = defineProps<{
  open: boolean;
  selectedIds: string[];
}>();

const emit = defineEmits<{
  (event: "close" | "done"): void;
}>();

const { t } = useI18n();

const action = ref<"add" | "remove">("add");
const discordRoles = ref<DiscordGuildRole[]>([]);
const communityRoleMappedIds = ref(new Set<string>());
const selectedRoleIds = ref(new Set<string>());
const loading = ref(false);
const errorMessage = ref("");
const result = ref<{
  succeeded: string[];
  failed: { userId: string; error: string }[];
  skipped: string[];
} | null>(null);

const availableRoles = computed(() =>
  discordRoles.value
    .filter((r) => r.editable && !r.managed && !communityRoleMappedIds.value.has(r.id))
    .sort((a, b) => b.position - a.position)
);

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return;
    action.value = "add";
    selectedRoleIds.value = new Set();
    result.value = null;
    errorMessage.value = "";

    try {
      const [rolesData, communityData] = await Promise.all([
        $fetch<{ roles: DiscordGuildRole[] }>("/api/mod/discord-roles"),
        $fetch<{ communityRoles: { discordRoleId?: string | null }[] }>("/api/mod/community-roles")
      ]);
      discordRoles.value = rolesData.roles;
      const mapped = new Set<string>();
      for (const cr of communityData.communityRoles) {
        if (cr.discordRoleId) mapped.add(cr.discordRoleId);
      }
      communityRoleMappedIds.value = mapped;
    } catch {
      discordRoles.value = [];
    }
  }
);

function toggleRole(roleId: string) {
  const next = new Set(selectedRoleIds.value);
  if (next.has(roleId)) {
    next.delete(roleId);
  } else {
    next.add(roleId);
  }
  selectedRoleIds.value = next;
}

async function execute() {
  if (selectedRoleIds.value.size === 0 || props.selectedIds.length === 0) return;
  loading.value = true;
  errorMessage.value = "";
  try {
    result.value = await $fetch("/api/mod/users/batch-discord-roles", {
      method: "POST",
      body: {
        userIds: props.selectedIds,
        discordRoleIds: [...selectedRoleIds.value],
        action: action.value
      }
    });
  } catch {
    errorMessage.value = t("common.error");
  } finally {
    loading.value = false;
  }
}

function close() {
  if (result.value) {
    emit("done");
  } else {
    emit("close");
  }
}
</script>

<template>
  <dialog class="modal" :class="{ 'modal-open': open }" :open="open" @cancel.prevent="close">
    <div class="modal-box" role="dialog" aria-modal="true" style="max-width: 32rem;">
      <UiModalTitle
        :title="t('bulk.discordRolesTitle')"
        :subtitle="t('bulk.roleChangeSubtitle', { count: selectedIds.length })"
      />

      <template v-if="!result">
        <div class="mt-4 space-y-4">
          <!-- Action toggle -->
          <div class="flex gap-2">
            <button
              class="btn btn-sm"
              :class="action === 'add' ? 'btn-primary' : 'btn-ghost'"
              @click="action = 'add'"
            >
              {{ t("bulk.discordRolesAdd") }}
            </button>
            <button
              class="btn btn-sm"
              :class="action === 'remove' ? 'btn-error' : 'btn-ghost'"
              @click="action = 'remove'"
            >
              {{ t("bulk.discordRolesRemove") }}
            </button>
          </div>

          <!-- Role multi-select -->
          <div class="discord-role-list">
            <label
              v-for="role in availableRoles"
              :key="role.id"
              class="discord-role-list__item"
              :class="{ 'discord-role-list__item--selected': selectedRoleIds.has(role.id) }"
            >
              <input
                type="checkbox"
                :checked="selectedRoleIds.has(role.id)"
                class="discord-role-list__checkbox"
                @change="toggleRole(role.id)"
              >
              <span class="discord-role-list__name">{{ role.name }}</span>
            </label>
            <p v-if="availableRoles.length === 0" class="text-sm opacity-60 py-2">
              {{ t("bulk.noDiscordRoles") }}
            </p>
          </div>

          <p v-if="selectedRoleIds.size > 0" class="text-sm opacity-60">
            {{ t("bulk.discordRolesInfo", { roleCount: selectedRoleIds.size, userCount: selectedIds.length, action: t(action === 'add' ? 'bulk.discordRolesActionAdd' : 'bulk.discordRolesActionRemove') }) }}
          </p>

          <div v-if="errorMessage" class="alert alert-error">{{ errorMessage }}</div>
        </div>

        <div class="modal-action">
          <UiButton variant="ghost" @click="close">{{ t("common.cancel") }}</UiButton>
          <UiButton
            :variant="action === 'remove' ? 'error' : 'primary'"
            :disabled="selectedRoleIds.size === 0 || loading"
            @click="execute"
          >
            {{ loading ? t("common.loading") : t("bulk.executeDiscordRoles") }}
          </UiButton>
        </div>
      </template>

      <template v-else>
        <div class="mt-4 space-y-3">
          <div v-if="result.succeeded.length" class="alert alert-success">
            {{ t("bulk.succeededCount", { count: result.succeeded.length }) }}
          </div>
          <div v-if="result.skipped.length" class="alert alert-warning">
            {{ t("bulk.skippedCount", { count: result.skipped.length }) }}
          </div>
          <div v-if="result.failed.length" class="alert alert-error">
            {{ t("bulk.failedCount", { count: result.failed.length }) }}
          </div>
        </div>

        <div class="modal-action">
          <UiButton @click="close">{{ t("common.close") }}</UiButton>
        </div>
      </template>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button type="button" @click="close">Close</button>
    </form>
  </dialog>
</template>

<style scoped>
.discord-role-list {
  max-height: 16rem;
  overflow-y: auto;
  border-radius: 0.5rem;
  background: var(--color-surface-2);
  padding: 0.375rem;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.discord-role-list__item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.5rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background-color 0.1s;
}

.discord-role-list__item:hover {
  background: var(--color-surface-4);
}

.discord-role-list__item--selected {
  background: var(--color-surface-3);
}

.discord-role-list__checkbox {
  width: 1rem;
  height: 1rem;
  accent-color: var(--color-accent);
  flex-shrink: 0;
}

.discord-role-list__name {
  font-size: 0.875rem;
  color: var(--color-text-primary);
}
</style>
