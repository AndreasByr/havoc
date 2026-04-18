<script setup lang="ts">
import type {
  FlowInputNodeData,
  FlowInfoNodeData,
  FlowRoleAssignmentNodeData,
  FlowInputType,
  SimpleFormItem
} from "@guildora/shared";
import { useFieldEditor } from "~/composables/useFieldEditor";

const { t } = useI18n();
const {
  guildRoles,
  rolesLoading,
  inputTypeOptions,
  addOption,
  removeOption,
  toggleRole,
  roleName,
  toggleDiscordRoleOption,
  roleColorHex,
  hasOptions,
  hasDiscordRoleOptions
} = useFieldEditor();

const props = defineProps<{
  item: SimpleFormItem;
}>();

const emit = defineEmits<{
  (e: "update", data: SimpleFormItem["data"]): void;
  (e: "delete"): void;
}>();

const expanded = ref(false);
const roleDropdownOpen = ref(false);
const discordRoleDropdownOpen = ref(false);

function toggleExpand() {
  expanded.value = !expanded.value;
}

function commitChanges() {
  emit("update", { ...props.item.data } as SimpleFormItem["data"]);
}

// Input type badge label
const typeLabel = computed(() => {
  if (props.item.type === "info") return t("applications.flowBuilder.nodes.infoBlock");
  if (props.item.type === "role_assignment") return t("applications.flowBuilder.nodes.roleAssignment");
  const inputData = props.item.data as FlowInputNodeData;
  return inputTypeOptions.value.find((o) => o.value === inputData.inputType)?.label ?? inputData.inputType;
});

// Display label
const displayLabel = computed(() => {
  if (props.item.type === "input") {
    return (props.item.data as FlowInputNodeData).label || t("applications.flowBuilder.inputTypes.untitledField");
  }
  if (props.item.type === "info") {
    const md = (props.item.data as FlowInfoNodeData).markdown;
    return md ? md.slice(0, 60) + (md.length > 60 ? "…" : "") : t("applications.flowBuilder.nodes.infoBlock");
  }
  if (props.item.type === "role_assignment") {
    const d = props.item.data as FlowRoleAssignmentNodeData;
    return d.roleNameSnapshots?.length
      ? d.roleNameSnapshots.join(", ")
      : t("applications.flowBuilder.nodes.noRolesConfigured");
  }
  return "";
});

const isRequired = computed(() => {
  if (props.item.type !== "input") return false;
  return (props.item.data as FlowInputNodeData).required;
});

function handleToggleRole(roleId: string) {
  toggleRole(props.item.data as FlowRoleAssignmentNodeData, roleId);
  commitChanges();
}

function handleToggleDiscordRoleOption(roleId: string) {
  toggleDiscordRoleOption(props.item.data as FlowInputNodeData, roleId);
  commitChanges();
}

function handleAddOption() {
  addOption(props.item.data as FlowInputNodeData);
}

function handleRemoveOption(index: number) {
  removeOption(props.item.data as FlowInputNodeData, index);
  commitChanges();
}

function onClickOutsideRoles(e: MouseEvent) {
  if (!(e.target as HTMLElement).closest(".role-multiselect")) {
    roleDropdownOpen.value = false;
    discordRoleDropdownOpen.value = false;
  }
}

onMounted(() => document.addEventListener("click", onClickOutsideRoles));
onUnmounted(() => document.removeEventListener("click", onClickOutsideRoles));
</script>

<template>
  <div class="simple-field" :class="{ 'simple-field--expanded': expanded }">
    <!-- Collapsed header -->
    <div class="simple-field__header" @click="toggleExpand">
      <div class="simple-field__handle">
        <Icon name="proicons:grid-dots" />
      </div>
      <span class="simple-field__badge">{{ typeLabel }}</span>
      <span class="simple-field__label">{{ displayLabel }}</span>
      <span v-if="isRequired" class="simple-field__required">*</span>
      <div class="simple-field__actions">
        <button class="btn btn-ghost btn-xs" style="color: var(--color-error)" @click.stop="$emit('delete')">
          <Icon name="proicons:delete" class="text-sm" />
        </button>
      </div>
    </div>

    <!-- Expanded editor -->
    <div v-if="expanded" class="simple-field__body" @click.stop>
      <!-- Input node editing -->
      <template v-if="item.type === 'input'">
        <div class="field-row">
          <label class="field-label">{{ t("applications.flowBuilder.sidebar.inputType") }}</label>
          <select
            :value="(item.data as FlowInputNodeData).inputType"
            class="select select-sm w-full"
            @change="(item.data as FlowInputNodeData).inputType = ($event.target as HTMLSelectElement).value as FlowInputType; commitChanges()"
          >
            <option v-for="opt in inputTypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
        <div class="field-row">
          <label class="field-label">{{ t("applications.flowBuilder.sidebar.label") }}</label>
          <input v-model="(item.data as FlowInputNodeData).label" class="input input-sm w-full" @blur="commitChanges" >
        </div>
        <div class="field-row">
          <label class="field-label">{{ t("applications.flowBuilder.sidebar.description") }}</label>
          <input v-model="(item.data as FlowInputNodeData).description" class="input input-sm w-full" @blur="commitChanges" >
        </div>
        <div class="field-row">
          <label class="field-label">{{ t("applications.flowBuilder.sidebar.placeholder") }}</label>
          <input v-model="(item.data as FlowInputNodeData).placeholder" class="input input-sm w-full" @blur="commitChanges" >
        </div>
        <label class="flex items-center gap-2 cursor-pointer field-row">
          <input v-model="(item.data as FlowInputNodeData).required" type="checkbox" class="toggle toggle-sm" @change="commitChanges" >
          <span class="text-sm">{{ t("applications.flowBuilder.sidebar.required") }}</span>
        </label>

        <!-- Options for select types -->
        <template v-if="hasOptions((item.data as FlowInputNodeData).inputType)">
          <div class="field-row">
            <label class="field-label">{{ t("applications.flowBuilder.sidebar.options") }}</label>
            <div class="space-y-1">
              <div v-for="(opt, i) in (item.data as FlowInputNodeData).options" :key="i" class="flex items-center gap-1">
                <input v-model="opt.label" class="input input-sm flex-1" :placeholder="t('applications.flowBuilder.sidebar.optionLabel')" @blur="commitChanges" >
                <button class="btn btn-ghost btn-sm" @click="handleRemoveOption(i)">
                  <Icon name="proicons:cancel" class="text-sm" />
                </button>
              </div>
            </div>
            <button class="btn btn-ghost btn-sm mt-1" @click="handleAddOption">{{ t("applications.flowBuilder.sidebar.addOption") }}</button>
          </div>
        </template>

        <!-- Discord role options -->
        <template v-if="hasDiscordRoleOptions((item.data as FlowInputNodeData).inputType)">
          <div class="field-row">
            <label class="field-label">{{ t("applications.flowBuilder.sidebar.selectableRoles") }}</label>
            <div v-if="rolesLoading" class="text-xs" style="color: var(--color-base-content-secondary)">{{ t("common.loading") }}...</div>
            <div v-else class="role-multiselect" @click.stop>
              <button type="button" class="role-multiselect__trigger" @click="discordRoleDropdownOpen = !discordRoleDropdownOpen">
                <span v-if="((item.data as FlowInputNodeData).discordRoleOptions || []).length" class="role-multiselect__tags">
                  <span v-for="opt in (item.data as FlowInputNodeData).discordRoleOptions" :key="opt.roleId" class="role-multiselect__tag">
                    <span class="role-color-dot" :style="{ backgroundColor: roleColorHex(opt.color) }" />
                    {{ opt.name }}
                    <button type="button" class="role-multiselect__tag-remove" @click.stop="handleToggleDiscordRoleOption(opt.roleId)">&times;</button>
                  </span>
                </span>
                <span v-else class="role-multiselect__placeholder">{{ t("applications.flowBuilder.sidebar.selectRoles") }}</span>
              </button>
              <div v-if="discordRoleDropdownOpen" class="role-multiselect__dropdown">
                <label v-for="role in guildRoles" :key="role.id" class="role-multiselect__option">
                  <input type="checkbox" :checked="((item.data as FlowInputNodeData).discordRoleOptions || []).some((r) => r.roleId === role.id)" @change="handleToggleDiscordRoleOption(role.id)" >
                  <span class="role-color-dot" :style="{ backgroundColor: roleColorHex(role.color) }" />
                  {{ role.name }}
                </label>
              </div>
            </div>
          </div>
        </template>
      </template>

      <!-- Info node editing -->
      <template v-if="item.type === 'info'">
        <div class="field-row">
          <label class="field-label">{{ t("applications.flowBuilder.sidebar.markdownContent") }}</label>
          <textarea v-model="(item.data as FlowInfoNodeData).markdown" class="textarea textarea-sm w-full" rows="4" @blur="commitChanges" />
        </div>
        <div class="field-row">
          <label class="field-label">{{ t("applications.flowBuilder.sidebar.ctaButtonLabel") }}</label>
          <input v-model="(item.data as FlowInfoNodeData).ctaLabel" class="input input-sm w-full" @blur="commitChanges" >
        </div>
        <div class="field-row">
          <label class="field-label">{{ t("applications.flowBuilder.sidebar.ctaButtonUrl") }}</label>
          <input v-model="(item.data as FlowInfoNodeData).ctaUrl" class="input input-sm w-full" @blur="commitChanges" >
        </div>
      </template>

      <!-- Role assignment editing -->
      <template v-if="item.type === 'role_assignment'">
        <div class="field-row">
          <label class="field-label">{{ t("applications.flowBuilder.sidebar.roleIds") }}</label>
          <div v-if="rolesLoading" class="text-xs" style="color: var(--color-base-content-secondary)">{{ t("common.loading") }}...</div>
          <div v-else class="role-multiselect" @click.stop>
            <button type="button" class="role-multiselect__trigger" @click="roleDropdownOpen = !roleDropdownOpen">
              <span v-if="((item.data as FlowRoleAssignmentNodeData).roleIds || []).length" class="role-multiselect__tags">
                <span v-for="id in (item.data as FlowRoleAssignmentNodeData).roleIds" :key="id" class="role-multiselect__tag">
                  {{ roleName(id) }}
                  <button type="button" class="role-multiselect__tag-remove" @click.stop="handleToggleRole(id)">&times;</button>
                </span>
              </span>
              <span v-else class="role-multiselect__placeholder">{{ t("applications.flowBuilder.sidebar.selectRoles") }}</span>
            </button>
            <div v-if="roleDropdownOpen" class="role-multiselect__dropdown">
              <label v-for="role in guildRoles" :key="role.id" class="role-multiselect__option">
                <input type="checkbox" :checked="((item.data as FlowRoleAssignmentNodeData).roleIds || []).includes(role.id)" @change="handleToggleRole(role.id)" >
                {{ role.name }}
              </label>
              <div v-if="guildRoles.length === 0" class="text-xs p-2" style="color: var(--color-base-content-secondary)">
                {{ t("applications.flowBuilder.sidebar.noRolesAvailable") }}
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.simple-field {
  background: var(--color-surface-2);
  border-radius: 0.75rem;
  box-shadow: var(--shadow-sm);
  transition: box-shadow 0.15s;
}

.simple-field:hover {
  box-shadow: var(--shadow-md, 0 4px 6px -1px rgba(0,0,0,.1));
}

.simple-field--expanded {
  box-shadow: var(--shadow-md, 0 4px 6px -1px rgba(0,0,0,.1));
}

.simple-field__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  cursor: pointer;
  user-select: none;
}

.simple-field__handle {
  cursor: grab;
  color: var(--color-base-content-secondary);
  flex-shrink: 0;
}

.simple-field__handle:active {
  cursor: grabbing;
}

.simple-field__badge {
  flex-shrink: 0;
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  background: var(--color-surface-3);
  color: var(--color-base-content-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.simple-field__label {
  flex: 1;
  font-size: 0.875rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.simple-field__required {
  color: var(--color-error);
  font-weight: 600;
  flex-shrink: 0;
}

.simple-field__actions {
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s;
}

.simple-field:hover .simple-field__actions {
  opacity: 1;
}

.simple-field__body {
  padding: 0 0.75rem 0.75rem;
  border-top: 1px solid var(--color-line);
}

.field-row {
  margin-top: 0.625rem;
}

.field-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-base-content-secondary);
  margin-bottom: 0.25rem;
}

/* Role multiselect styles (shared with FlowNodeSidebar) */
.role-multiselect { position: relative; }
.role-multiselect__trigger {
  display: flex; align-items: center; gap: 0.5rem; width: 100%;
  min-height: 2.25rem; padding: 0.25rem 0.5rem; border-radius: 0.5rem;
  border: 1px solid var(--color-line); background: var(--color-surface-3);
  font-size: 0.875rem; cursor: pointer; text-align: left;
}
.role-multiselect__trigger:hover { border-color: var(--color-accent); }
.role-multiselect__tags { display: flex; flex-wrap: wrap; gap: 0.25rem; flex: 1; }
.role-multiselect__tag {
  display: inline-flex; align-items: center; gap: 0.25rem;
  padding: 0.125rem 0.5rem; border-radius: 0.375rem;
  background: var(--color-accent); color: var(--color-accent-content, #fff);
  font-size: 0.75rem; line-height: 1.5;
}
.role-multiselect__tag-remove { font-size: 0.875rem; line-height: 1; opacity: 0.7; cursor: pointer; }
.role-multiselect__tag-remove:hover { opacity: 1; }
.role-multiselect__placeholder { flex: 1; color: var(--color-base-content-secondary); }
.role-multiselect__dropdown {
  position: absolute; z-index: 50; top: 100%; left: 0; right: 0;
  margin-top: 0.25rem; max-height: 16rem; overflow-y: auto;
  border-radius: 0.5rem; border: 1px solid var(--color-line);
  background: var(--color-surface-3);
  box-shadow: var(--shadow-md, 0 4px 6px -1px rgba(0,0,0,.1));
}
.role-multiselect__option {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.5rem 0.75rem; font-size: 0.875rem; cursor: pointer;
}
.role-multiselect__option:hover { background: var(--color-surface-4, var(--color-surface-2)); }
.role-color-dot {
  display: inline-block; width: 0.75rem; height: 0.75rem;
  border-radius: 50%; flex-shrink: 0;
}
</style>
