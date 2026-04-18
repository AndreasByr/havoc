<script setup lang="ts">
import type { Node } from "@vue-flow/core";
import type {
  FlowInputNodeData,
  FlowInfoNodeData,
  FlowAbortNodeData,
  FlowRoleAssignmentNodeData,
  FlowStepGroupNodeData,
  FlowConditionalBranchNodeData,
  FlowInputType
} from "@guildora/shared";
import { useFieldEditor } from "~/composables/useFieldEditor";

const { t } = useI18n();
const fieldEditor = useFieldEditor();
const {
  guildRoles,
  rolesLoading,
  fetchGuildRoles,
  inputTypeOptions,
  roleColorHex
} = fieldEditor;

// Role multiselect dropdown state
const roleDropdownOpen = ref(false);

function toggleRoleDropdown() {
  roleDropdownOpen.value = !roleDropdownOpen.value;
}

function handleToggleRole(roleId: string) {
  fieldEditor.toggleRole(localData.value as FlowRoleAssignmentNodeData, roleId);
  commitChanges();
}

function roleName(roleId: string): string {
  return fieldEditor.roleName(roleId);
}

// Discord role input field dropdown state (separate from role_assignment dropdown)
const discordRoleInputDropdownOpen = ref(false);

function toggleDiscordRoleInputDropdown() {
  discordRoleInputDropdownOpen.value = !discordRoleInputDropdownOpen.value;
}

function handleToggleDiscordRoleOption(roleId: string) {
  fieldEditor.toggleDiscordRoleOption(localData.value as FlowInputNodeData, roleId);
  commitChanges();
}

function onClickOutsideRoles(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target.closest(".role-multiselect")) {
    roleDropdownOpen.value = false;
    discordRoleInputDropdownOpen.value = false;
  }
}

onMounted(async () => {
  document.addEventListener("click", onClickOutsideRoles);
  await fetchGuildRoles();
});

onUnmounted(() => {
  document.removeEventListener("click", onClickOutsideRoles);
});

const props = defineProps<{
  node: Node | null;
  nodes: Node[];
}>();

const emit = defineEmits<{
  (e: "update-node-data", nodeId: string, data: Record<string, unknown>): void;
  (e: "delete-node" | "ungroup-node", nodeId: string): void;
  (e: "close"): void;
}>();

// Reactive local copy of data for editing
const localData = ref<Record<string, unknown>>({});

watch(() => props.node, (n) => {
  if (n) {
    localData.value = JSON.parse(JSON.stringify(n.data || {}));
  }
}, { immediate: true, deep: true });

function commitChanges() {
  if (props.node) {
    emit("update-node-data", props.node.id, { ...localData.value });
  }
}

function addOption() {
  fieldEditor.addOption(localData.value as FlowInputNodeData);
}

function removeOption(index: number) {
  fieldEditor.removeOption(localData.value as FlowInputNodeData, index);
}

function addBranch() {
  const d = localData.value as FlowConditionalBranchNodeData;
  if (!d.branches) d.branches = [];
  const handleId = `branch_${Date.now()}`;
  d.branches.push({ optionId: "", label: "", handleId });
}

function removeBranch(index: number) {
  const d = localData.value as FlowConditionalBranchNodeData;
  d.branches?.splice(index, 1);
}

const nodeType = computed(() => props.node?.type || "");
const isEditable = computed(() => nodeType.value !== "start" && nodeType.value !== "end");

// --- Conditional branch helpers ---

const BRANCHABLE_INPUT_TYPES: FlowInputType[] = [
  "single_select_radio",
  "single_select_dropdown",
  "multi_select",
  "yes_no",
  "discord_role_single",
  "discord_role_multi"
];

const branchableNodes = computed(() => {
  return props.nodes
    .filter((n) => {
      if (n.type !== "input") return false;
      const data = n.data as FlowInputNodeData;
      return BRANCHABLE_INPUT_TYPES.includes(data.inputType);
    })
    .map((n) => {
      const data = n.data as FlowInputNodeData;
      const typeLabel = inputTypeOptions.value.find(
        (opt) => opt.value === data.inputType
      )?.label ?? data.inputType;
      return {
        nodeId: n.id,
        displayLabel: `${data.label || t("applications.flowBuilder.inputTypes.untitledField")} (${typeLabel})`,
      };
    });
});

function getOptionsForNode(nodeId: string): Array<{ id: string; label: string }> {
  const node = props.nodes.find((n) => n.id === nodeId);
  if (!node || node.type !== "input") return [];
  const data = node.data as FlowInputNodeData;

  if (data.inputType === "yes_no") {
    return [
      { id: "yes", label: t("applications.form.yes") },
      { id: "no", label: t("applications.form.no") }
    ];
  }

  if (data.inputType === "discord_role_single" || data.inputType === "discord_role_multi") {
    return (data.discordRoleOptions ?? []).map((r) => ({ id: r.roleId, label: r.name }));
  }

  return data.options ?? [];
}

function onSourceNodeChange(newSourceNodeId: string) {
  const d = localData.value as FlowConditionalBranchNodeData;
  d.sourceNodeId = newSourceNodeId;

  const options = getOptionsForNode(newSourceNodeId);
  const existingBranches = d.branches || [];
  const existingByOptionId = new Map(
    existingBranches.map((b) => [b.optionId, b])
  );

  d.branches = options.map((opt) => {
    const existing = existingByOptionId.get(opt.id);
    return {
      optionId: opt.id,
      label: opt.label,
      handleId: existing?.handleId ?? `branch_${Date.now()}_${opt.id}`
    };
  });

  commitChanges();
}
</script>

<template>
  <div v-if="node" class="flow-sidebar" @keydown.stop>
    <div class="flow-sidebar__header">
      <h3 class="text-sm font-semibold">{{ nodeType }}</h3>
      <div class="flex items-center gap-1">
        <button v-if="node.parentNode" class="btn btn-ghost btn-sm" :title="t('applications.flowBuilder.sidebar.removeFromGroup')" @click="emit('ungroup-node', node.id)">
          <Icon name="proicons:arrow-export" />
        </button>
        <button v-if="isEditable" class="btn btn-ghost btn-sm" style="color: var(--color-error)" :title="t('applications.flowBuilder.sidebar.deleteNode')" @click="emit('delete-node', node.id)">
          <Icon name="proicons:delete" />
        </button>
        <button class="btn btn-ghost btn-sm" @click="emit('close')">
          <Icon name="proicons:cancel" />
        </button>
      </div>
    </div>

    <div class="flow-sidebar__body">
      <template v-if="nodeType === 'input'">
        <div class="sidebar-field">
          <label class="sidebar-label">{{ t("applications.flowBuilder.sidebar.inputType") }}</label>
          <select
            v-model="(localData as FlowInputNodeData).inputType"
            class="select select-sm w-full"
            @change="commitChanges"
          >
            <option v-for="opt in inputTypeOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>
        <div class="sidebar-field">
          <label class="sidebar-label">{{ t("applications.flowBuilder.sidebar.label") }}</label>
          <input
            v-model="(localData as FlowInputNodeData).label"
            class="input input-sm w-full"
            @blur="commitChanges"
          >
        </div>
        <div class="sidebar-field">
          <label class="sidebar-label">{{ t("applications.flowBuilder.sidebar.description") }}</label>
          <input
            v-model="(localData as FlowInputNodeData).description"
            class="input input-sm w-full"
            @blur="commitChanges"
          >
        </div>
        <div class="sidebar-field">
          <label class="sidebar-label">{{ t("applications.flowBuilder.sidebar.placeholder") }}</label>
          <input
            v-model="(localData as FlowInputNodeData).placeholder"
            class="input input-sm w-full"
            @blur="commitChanges"
          >
        </div>
        <label class="flex items-center gap-2 cursor-pointer sidebar-field">
          <input
            v-model="(localData as FlowInputNodeData).required"
            type="checkbox"
            class="toggle toggle-sm"
            @change="commitChanges"
          >
          <span class="text-sm">{{ t("applications.flowBuilder.sidebar.required") }}</span>
        </label>

        <!-- Options for select types -->
        <template
          v-if="['single_select_radio', 'single_select_dropdown', 'multi_select'].includes((localData as FlowInputNodeData).inputType)"
        >
          <div class="sidebar-field">
            <label class="sidebar-label">{{ t("applications.flowBuilder.sidebar.options") }}</label>
            <div class="space-y-1">
              <div
                v-for="(opt, i) in (localData as FlowInputNodeData).options"
                :key="i"
                class="flex items-center gap-1"
              >
                <input
                  v-model="opt.label"
                  class="input input-sm flex-1"
                  :placeholder="t('applications.flowBuilder.sidebar.optionLabel')"
                  @blur="commitChanges"
                >
                <button class="btn btn-ghost btn-sm" @click="removeOption(i); commitChanges()">
                  <Icon name="proicons:cancel" class="text-sm" />
                </button>
              </div>
            </div>
            <button class="btn btn-ghost btn-sm mt-1" @click="addOption">{{ t("applications.flowBuilder.sidebar.addOption") }}</button>
          </div>
        </template>

        <!-- Discord role selection options -->
        <template
          v-if="['discord_role_single', 'discord_role_multi'].includes((localData as FlowInputNodeData).inputType)"
        >
          <div class="sidebar-field">
            <label class="sidebar-label">{{ t("applications.flowBuilder.sidebar.selectableRoles") }}</label>
            <div v-if="rolesLoading" class="text-xs" style="color: var(--color-base-content-secondary)">
              {{ t("common.loading") }}...
            </div>
            <div v-else class="role-multiselect" @click.stop>
              <button type="button" class="role-multiselect__trigger" @click="toggleDiscordRoleInputDropdown">
                <span v-if="((localData as FlowInputNodeData).discordRoleOptions || []).length" class="role-multiselect__tags">
                  <span v-for="opt in (localData as FlowInputNodeData).discordRoleOptions" :key="opt.roleId" class="role-multiselect__tag">
                    <span class="role-color-dot" :style="{ backgroundColor: roleColorHex(opt.color) }" />
                    <span v-if="opt.unicodeEmoji">{{ opt.unicodeEmoji }}</span>
                    {{ opt.name }}
                    <button type="button" class="role-multiselect__tag-remove" @click.stop="handleToggleDiscordRoleOption(opt.roleId)">&times;</button>
                  </span>
                </span>
                <span v-else class="role-multiselect__placeholder">{{ t("applications.flowBuilder.sidebar.selectRoles") }}</span>
                <svg class="role-multiselect__chevron" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>
              </button>
              <div v-if="discordRoleInputDropdownOpen" class="role-multiselect__dropdown">
                <label v-for="role in guildRoles" :key="role.id" class="role-multiselect__option">
                  <input type="checkbox" :checked="((localData as FlowInputNodeData).discordRoleOptions || []).some((r) => r.roleId === role.id)" @change="handleToggleDiscordRoleOption(role.id)" >
                  <span class="role-color-dot" :style="{ backgroundColor: roleColorHex(role.color) }" />
                  <span v-if="role.unicodeEmoji">{{ role.unicodeEmoji }}</span>
                  {{ role.name }}
                </label>
                <div v-if="guildRoles.length === 0" class="text-xs p-2" style="color: var(--color-base-content-secondary)">
                  {{ t("applications.flowBuilder.sidebar.noRolesAvailable") }}
                </div>
              </div>
            </div>
          </div>
        </template>

      </template>

      <template v-if="nodeType === 'info'">
        <div class="sidebar-field">
          <label class="sidebar-label">{{ t("applications.flowBuilder.sidebar.markdownContent") }}</label>
          <textarea
            v-model="(localData as FlowInfoNodeData).markdown"
            class="textarea textarea-sm w-full"
            rows="6"
            @blur="commitChanges"
          />
        </div>
        <div class="sidebar-field">
          <label class="sidebar-label">{{ t("applications.flowBuilder.sidebar.ctaButtonLabel") }}</label>
          <input
            v-model="(localData as FlowInfoNodeData).ctaLabel"
            class="input input-sm w-full"
            @blur="commitChanges"
          >
        </div>
        <div class="sidebar-field">
          <label class="sidebar-label">{{ t("applications.flowBuilder.sidebar.ctaButtonUrl") }}</label>
          <input
            v-model="(localData as FlowInfoNodeData).ctaUrl"
            class="input input-sm w-full"
            @blur="commitChanges"
          >
        </div>
      </template>

      <template v-if="nodeType === 'abort'">
        <div class="sidebar-field">
          <label class="sidebar-label">{{ t("applications.flowBuilder.sidebar.abortMessage") }}</label>
          <textarea
            v-model="(localData as FlowAbortNodeData).message"
            class="textarea textarea-sm w-full"
            rows="4"
            @blur="commitChanges"
          />
        </div>
      </template>

      <template v-if="nodeType === 'role_assignment'">
        <div class="sidebar-field">
          <label class="sidebar-label">{{ t("applications.flowBuilder.sidebar.roleIds") }}</label>
          <div v-if="rolesLoading" class="text-xs" style="color: var(--color-base-content-secondary)">
            {{ t("common.loading") }}...
          </div>
          <div v-else class="role-multiselect" @click.stop>
            <button type="button" class="role-multiselect__trigger" @click="toggleRoleDropdown">
              <span v-if="((localData as FlowRoleAssignmentNodeData).roleIds || []).length" class="role-multiselect__tags">
                <span v-for="id in (localData as FlowRoleAssignmentNodeData).roleIds" :key="id" class="role-multiselect__tag">
                  {{ roleName(id) }}
                  <button type="button" class="role-multiselect__tag-remove" @click.stop="handleToggleRole(id)">&times;</button>
                </span>
              </span>
              <span v-else class="role-multiselect__placeholder">{{ t("applications.flowBuilder.sidebar.selectRoles") }}</span>
              <svg class="role-multiselect__chevron" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>
            </button>
            <div v-if="roleDropdownOpen" class="role-multiselect__dropdown">
              <label v-for="role in guildRoles" :key="role.id" class="role-multiselect__option">
                <input type="checkbox" :checked="((localData as FlowRoleAssignmentNodeData).roleIds || []).includes(role.id)" @change="handleToggleRole(role.id)" >
                {{ role.name }}
              </label>
              <div v-if="guildRoles.length === 0" class="text-xs p-2" style="color: var(--color-base-content-secondary)">
                {{ t("applications.flowBuilder.sidebar.noRolesAvailable") }}
              </div>
            </div>
          </div>
        </div>
      </template>

      <template v-if="nodeType === 'step_group'">
        <div class="sidebar-field">
          <label class="sidebar-label">{{ t("applications.flowBuilder.sidebar.groupTitle") }}</label>
          <input
            v-model="(localData as FlowStepGroupNodeData).title"
            class="input input-sm w-full"
            @blur="commitChanges"
          >
        </div>
        <div class="sidebar-field">
          <label class="sidebar-label">{{ t("applications.flowBuilder.sidebar.description2") }}</label>
          <input
            v-model="(localData as FlowStepGroupNodeData).description"
            class="input input-sm w-full"
            @blur="commitChanges"
          >
        </div>
      </template>

      <template v-if="nodeType === 'conditional_branch'">
        <!-- Source Node Dropdown -->
        <div class="sidebar-field">
          <label class="sidebar-label">{{ t("applications.flowBuilder.sidebar.sourceNode") }}</label>
          <select
            :value="(localData as FlowConditionalBranchNodeData).sourceNodeId"
            class="select select-sm w-full"
            @change="onSourceNodeChange(($event.target as HTMLSelectElement).value)"
          >
            <option value="" disabled>
              {{ t("applications.flowBuilder.sidebar.selectSourceNode") }}
            </option>
            <option
              v-for="bn in branchableNodes"
              :key="bn.nodeId"
              :value="bn.nodeId"
            >
              {{ bn.displayLabel }}
            </option>
          </select>
          <p v-if="branchableNodes.length === 0" class="text-xs mt-1" style="color: var(--color-base-content-secondary)">
            {{ t("applications.flowBuilder.sidebar.noBranchableNodes") }}
          </p>
        </div>

        <!-- Branches -->
        <div class="sidebar-field">
          <label class="sidebar-label">{{ t("applications.flowBuilder.sidebar.branches") }}</label>
          <div v-if="(localData as FlowConditionalBranchNodeData).sourceNodeId" class="space-y-2">
            <div
              v-for="(branch, i) in (localData as FlowConditionalBranchNodeData).branches"
              :key="branch.handleId"
              class="flex items-center gap-1 rounded-lg px-2 py-1.5"
              style="background: var(--color-surface-3)"
            >
              <span class="text-sm flex-1 truncate" :title="branch.optionId">
                {{ branch.label || branch.optionId }}
              </span>
              <button class="btn btn-ghost btn-xs" @click="removeBranch(i); commitChanges()">
                <Icon name="proicons:cancel" class="text-xs" />
              </button>
            </div>
          </div>
          <p v-else class="text-xs" style="color: var(--color-base-content-secondary)">
            {{ t("applications.flowBuilder.sidebar.selectSourceFirst") }}
          </p>
          <button class="btn btn-ghost btn-sm mt-1" @click="addBranch">{{ t("applications.flowBuilder.sidebar.addBranch") }}</button>
        </div>
      </template>
    </div>

  </div>
</template>

<style scoped>
.flow-sidebar {
  width: 18rem;
  display: flex;
  flex-direction: column;
  background: var(--color-surface-2);
  border-left: 1px solid var(--color-line);
  overflow-y: auto;
  flex-shrink: 0;
}

.flow-sidebar__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-line);
}

.flow-sidebar__body {
  padding: 1rem;
  flex: 1;
  overflow-y: auto;
}

.sidebar-field {
  margin-bottom: 0.75rem;
}

.sidebar-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-base-content-secondary);
  margin-bottom: 0.25rem;
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

.role-color-dot {
  display: inline-block;
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>
