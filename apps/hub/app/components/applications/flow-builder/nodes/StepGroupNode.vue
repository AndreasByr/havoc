<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";
import type { NodeProps } from "@vue-flow/core";
import { NodeResizer } from "@vue-flow/node-resizer";
import type { FlowStepGroupNodeData } from "@guildora/shared";

const props = defineProps<NodeProps>();

const { t } = useI18n();
const data = computed(() => props.data as FlowStepGroupNodeData);
</script>

<template>
  <div class="flow-node flow-node--group">
    <NodeResizer min-width="280" min-height="150" />
    <Handle type="target" :position="Position.Top" />
    <div class="flow-node__header">
      <span class="flow-node__type-badge flow-node__type-badge--group">{{ t("applications.flowBuilder.nodes.stepGroup") }}</span>
    </div>
    <div class="flow-node__label">{{ data.title || t("applications.flowBuilder.nodes.stepGroup") }}</div>
    <p v-if="data.description" class="flow-node__desc">{{ data.description }}</p>
    <!-- Child nodes are rendered inside by Vue Flow's parentNode mechanism -->
    <Handle type="source" :position="Position.Bottom" />
  </div>
</template>

<style scoped>
.flow-node--group {
  min-width: 280px;
  min-height: 150px;
  width: 100%;
  height: 100%;
  padding: 0.75rem;
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--color-surface-2) 20%, transparent);
  border: 2px dashed var(--color-line);
}

.flow-node__header {
  margin-bottom: 0.375rem;
}

.flow-node__type-badge--group {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  padding: 0.0625rem 0.375rem;
  border-radius: 0.25rem;
  background: var(--color-surface-3);
  color: var(--color-base-content-secondary);
}

.flow-node__label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-base-content);
}

.flow-node__desc {
  font-size: 0.75rem;
  color: var(--color-base-content-secondary);
  margin-top: 0.25rem;
}
</style>

<style>
/* NodeResizer styles (unscoped so the component can pick them up) */
.vue-flow__node-step_group .vue-flow__resize-control {
  border: none;
  background: transparent;
}
.vue-flow__node-step_group .vue-flow__resize-control.handle {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-accent, #7c3aed);
  border: 2px solid var(--color-surface-1, #1a1a2e);
}
</style>
