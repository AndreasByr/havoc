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

const { t } = useI18n();

const props = defineProps<{
  node: Node | null;
  nodes: Node[];
}>();

const emit = defineEmits<{
  (e: "update-node-data", nodeId: string, data: Record<string, unknown>): void;
  (e: "delete-node", nodeId: string): void;
  (e: "ungroup-node", nodeId: string): void;
  (e: "close"): void;
}>();

const inputTypeOptions = computed<{ value: FlowInputType; label: string }[]>(() => [
  { value: "short_text", label: t("applications.flowBuilder.inputTypes.shortText") },
  { value: "long_text", label: t("applications.flowBuilder.inputTypes.longText") },
  { value: "number", label: t("applications.flowBuilder.inputTypes.number") },
  { value: "email", label: t("applications.flowBuilder.inputTypes.email") },
  { value: "single_select_radio", label: t("applications.flowBuilder.inputTypes.radioSelect") },
  { value: "single_select_dropdown", label: t("applications.flowBuilder.inputTypes.dropdownSelect") },
  { value: "multi_select", label: t("applications.flowBuilder.inputTypes.multiSelectCheckboxes") },
  { value: "yes_no", label: t("applications.flowBuilder.inputTypes.yesNo") },
  { value: "date", label: t("applications.flowBuilder.inputTypes.date") },
  { value: "file_upload", label: t("applications.flowBuilder.inputTypes.fileUpload") },
  { value: "discord_username", label: t("applications.flowBuilder.inputTypes.discordUsername") },
]);

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
  const d = localData.value as FlowInputNodeData;
  if (!d.options) d.options = [];
  d.options.push({ id: `opt_${Date.now()}`, label: "" });
}

function removeOption(index: number) {
  const d = localData.value as FlowInputNodeData;
  d.options?.splice(index, 1);
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
  "yes_no"
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
          />
        </div>
        <div class="sidebar-field">
          <label class="sidebar-label">{{ t("applications.flowBuilder.sidebar.description") }}</label>
          <input
            v-model="(localData as FlowInputNodeData).description"
            class="input input-sm w-full"
            @blur="commitChanges"
          />
        </div>
        <div class="sidebar-field">
          <label class="sidebar-label">{{ t("applications.flowBuilder.sidebar.placeholder") }}</label>
          <input
            v-model="(localData as FlowInputNodeData).placeholder"
            class="input input-sm w-full"
            @blur="commitChanges"
          />
        </div>
        <label class="flex items-center gap-2 cursor-pointer sidebar-field">
          <input
            v-model="(localData as FlowInputNodeData).required"
            type="checkbox"
            class="toggle toggle-sm"
            @change="commitChanges"
          />
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
                />
                <button class="btn btn-ghost btn-sm" @click="removeOption(i); commitChanges()">
                  <Icon name="proicons:cancel" class="text-sm" />
                </button>
              </div>
            </div>
            <button class="btn btn-ghost btn-sm mt-1" @click="addOption">{{ t("applications.flowBuilder.sidebar.addOption") }}</button>
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
          />
        </div>
        <div class="sidebar-field">
          <label class="sidebar-label">{{ t("applications.flowBuilder.sidebar.ctaButtonUrl") }}</label>
          <input
            v-model="(localData as FlowInfoNodeData).ctaUrl"
            class="input input-sm w-full"
            @blur="commitChanges"
          />
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
          <input
            :value="((localData as FlowRoleAssignmentNodeData).roleIds || []).join(', ')"
            class="input input-sm w-full"
            placeholder="123456, 789012"
            @blur="(e) => { (localData as FlowRoleAssignmentNodeData).roleIds = (e.target as HTMLInputElement).value.split(',').map(s => s.trim()).filter(Boolean); commitChanges(); }"
          />
        </div>
        <div class="sidebar-field">
          <label class="sidebar-label">{{ t("applications.flowBuilder.sidebar.roleNames") }}</label>
          <input
            :value="((localData as FlowRoleAssignmentNodeData).roleNameSnapshots || []).join(', ')"
            class="input input-sm w-full"
            placeholder="Bewerber, Member"
            @blur="(e) => { (localData as FlowRoleAssignmentNodeData).roleNameSnapshots = (e.target as HTMLInputElement).value.split(',').map(s => s.trim()).filter(Boolean); commitChanges(); }"
          />
        </div>
      </template>

      <template v-if="nodeType === 'step_group'">
        <div class="sidebar-field">
          <label class="sidebar-label">{{ t("applications.flowBuilder.sidebar.groupTitle") }}</label>
          <input
            v-model="(localData as FlowStepGroupNodeData).title"
            class="input input-sm w-full"
            @blur="commitChanges"
          />
        </div>
        <div class="sidebar-field">
          <label class="sidebar-label">{{ t("applications.flowBuilder.sidebar.description2") }}</label>
          <input
            v-model="(localData as FlowStepGroupNodeData).description"
            class="input input-sm w-full"
            @blur="commitChanges"
          />
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
</style>
