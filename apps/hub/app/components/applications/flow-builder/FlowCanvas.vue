<script setup lang="ts">
import { VueFlow, useVueFlow } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import { MiniMap } from "@vue-flow/minimap";
import type { Node, Edge, Connection } from "@vue-flow/core";
import { markRaw } from "vue";

import StartNode from "./nodes/StartNode.vue";
import EndNode from "./nodes/EndNode.vue";
import InputNode from "./nodes/InputNode.vue";
import InfoNode from "./nodes/InfoNode.vue";
import ConditionalBranchNode from "./nodes/ConditionalBranchNode.vue";
import AbortNode from "./nodes/AbortNode.vue";
import RoleAssignmentNode from "./nodes/RoleAssignmentNode.vue";
import StepGroupNode from "./nodes/StepGroupNode.vue";

const props = defineProps<{
  nodes: Node[];
  edges: Edge[];
}>();

const emit = defineEmits<{
  (e: "nodes-change", nodes: Node[]): void;
  (e: "edges-change", edges: Edge[]): void;
  (e: "node-click", node: Node): void;
  (e: "edge-click", edge: Edge): void;
  (e: "graph-change"): void;
}>();

const nodeTypes = {
  start: markRaw(StartNode),
  end: markRaw(EndNode),
  input: markRaw(InputNode),
  info: markRaw(InfoNode),
  conditional_branch: markRaw(ConditionalBranchNode),
  abort: markRaw(AbortNode),
  role_assignment: markRaw(RoleAssignmentNode),
  step_group: markRaw(StepGroupNode),
};

// Local writable refs for VueFlow (props are readonly)
const localNodes = ref<Node[]>([]);
const localEdges = ref<Edge[]>([]);

// Sync props → local refs
watch(() => props.nodes, (n) => { localNodes.value = [...n]; }, { immediate: true });
watch(() => props.edges, (e) => { localEdges.value = [...e]; }, { immediate: true });

const {
  onConnect,
  addEdges,
  addNodes,
  onNodesChange,
  onEdgesChange,
  onNodeClick,
  onEdgeClick,
  onNodeDragStop,
  screenToFlowCoordinate,
  findNode,
} = useVueFlow();

// Types that can be children of a step_group
const groupableTypes = new Set(["input"]);

/**
 * Find the step_group node that contains the given absolute flow position.
 * Returns the group node or undefined.
 */
function findContainingGroup(absolutePos: { x: number; y: number }, excludeNodeId?: string) {
  for (const n of localNodes.value) {
    if (n.type !== "step_group") continue;
    if (n.id === excludeNodeId) continue;
    const vfNode = findNode(n.id);
    if (!vfNode) continue;
    const w = vfNode.dimensions?.width ?? 220;
    const h = vfNode.dimensions?.height ?? 120;
    if (
      absolutePos.x >= n.position.x &&
      absolutePos.x <= n.position.x + w &&
      absolutePos.y >= n.position.y &&
      absolutePos.y <= n.position.y + h
    ) {
      return n;
    }
  }
  return undefined;
}

// Connect handler
onConnect((params: Connection) => {
  const edgeId = `e_${params.source}_${params.target}_${Date.now()}`;
  addEdges([{
    id: edgeId,
    source: params.source,
    target: params.target,
    sourceHandle: params.sourceHandle ?? undefined,
    targetHandle: params.targetHandle ?? undefined,
  }]);
  emit("graph-change");
});

// Change handlers
onNodesChange(() => {
  nextTick(() => {
    emit("nodes-change", localNodes.value);
    emit("graph-change");
  });
});

onEdgesChange(() => {
  nextTick(() => {
    emit("edges-change", localEdges.value);
    emit("graph-change");
  });
});

onNodeClick(({ node }: { node: Node }) => {
  emit("node-click", node);
});

onEdgeClick(({ edge }: { edge: Edge }) => {
  emit("edge-click", edge);
});

// Drag and drop from toolbar
function onDragOver(event: DragEvent) {
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
}

const { t } = useI18n();

function getDefaultDataForType(type: string): Record<string, unknown> {
  switch (type) {
    case "input":
      return { inputType: "short_text", label: t("applications.flowBuilder.sidebar.newField"), required: false, options: [] };
    case "info":
      return { markdown: "" };
    case "conditional_branch":
      return { sourceNodeId: "", branches: [] };
    case "abort":
      return { message: t("applications.flowBuilder.nodes.applicationAborted") };
    case "role_assignment":
      return { roleIds: [], roleNameSnapshots: [] };
    case "step_group":
      return { title: t("applications.flowBuilder.nodes.stepGroup") };
    case "end":
      return {};
    default:
      return {};
  }
}

function onDrop(event: DragEvent) {
  const nodeType = event.dataTransfer?.getData("application/vueflow-nodetype");
  if (!nodeType) return;

  const position = screenToFlowCoordinate({
    x: event.clientX,
    y: event.clientY,
  });

  const newNode: Node = {
    id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: nodeType,
    position,
    data: getDefaultDataForType(nodeType),
  };

  // If dropping a groupable node inside a step_group, make it a child
  if (groupableTypes.has(nodeType)) {
    const group = findContainingGroup(position);
    if (group) {
      newNode.parentNode = group.id;
      newNode.extent = "parent";
      // Convert to position relative to the group
      newNode.position = {
        x: position.x - group.position.x,
        y: position.y - group.position.y,
      };
    }
  }

  addNodes([newNode]);
  emit("node-click", newNode as Node);
  emit("graph-change");
}

// Handle dragging existing nodes into / out of step groups
onNodeDragStop(({ node }: { node: Node }) => {
  if (!groupableTypes.has(node.type!)) return;

  const vfNode = findNode(node.id);
  if (!vfNode) return;

  // Calculate absolute position (if inside a group, position is relative)
  let absolutePos = { ...node.position };
  if (node.parentNode) {
    const parentNode = findNode(node.parentNode);
    if (parentNode) {
      absolutePos = {
        x: node.position.x + parentNode.position.x,
        y: node.position.y + parentNode.position.y,
      };
    }
  }

  const group = findContainingGroup(absolutePos, node.id);

  if (group && node.parentNode !== group.id) {
    // Moved into a (different) group
    vfNode.parentNode = group.id;
    vfNode.extent = "parent";
    vfNode.position = {
      x: absolutePos.x - group.position.x,
      y: absolutePos.y - group.position.y,
    };
    emit("graph-change");
  } else if (!group && node.parentNode) {
    // Moved out of a group
    vfNode.parentNode = undefined;
    vfNode.extent = undefined;
    vfNode.position = absolutePos;
    emit("graph-change");
  }
});
</script>

<template>
  <div class="flow-canvas" @drop="onDrop" @dragover="onDragOver">
    <VueFlow
      v-model:nodes="localNodes"
      v-model:edges="localEdges"
      :node-types="nodeTypes"
      :default-viewport="{ zoom: 0.8, x: 50, y: 50 }"
      :min-zoom="0.2"
      :max-zoom="2"
      :delete-key-code="null"
      :edges-updatable="true"
      fit-view-on-init
      class="flow-canvas__vueflow"
    >
      <Background />
      <Controls />
      <MiniMap />
    </VueFlow>
  </div>
</template>

<style scoped>
.flow-canvas {
  flex: 1;
  height: 100%;
  position: relative;
}

.flow-canvas__vueflow {
  width: 100%;
  height: 100%;
}

.flow-canvas__vueflow :deep(.vue-flow__edge.selected .vue-flow__edge-path) {
  stroke: var(--color-error);
  stroke-width: 3;
}
</style>
