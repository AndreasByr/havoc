import { ref, computed } from "vue";
import type { ApplicationFlowGraph, FlowNode, FlowEdge, EditorMode, SimpleFormSection } from "@guildora/shared";
import { flowGraphToSections, sectionsToFlowGraph, canConvertToSimple } from "@guildora/shared";
import type { Node, Edge } from "@vue-flow/core";

type SaveStatus = "idle" | "saving" | "saved" | "error";
type PublishStatus = "idle" | "publishing" | "published" | "error";

export function useFlowBuilder(flowId: string) {
  const nodes = ref<Node[]>([]);
  const edges = ref<Edge[]>([]);
  const saveStatus = ref<SaveStatus>("idle");
  const saveError = ref("");
  const publishStatus = ref<PublishStatus>("idle");
  const hasUnpublishedChanges = ref(false);
  const undoStack = ref<string[]>([]);
  const redoStack = ref<string[]>([]);
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  let skipSnapshot = false;

  // ─── Simple Mode State ──────────────────────────────────────────────
  const editorMode = ref<EditorMode>("simple");
  const sections = ref<SimpleFormSection[]>([]);

  function flowNodesToVueFlowNodes(flowNodes: FlowNode[]): Node[] {
    return flowNodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
      parentNode: n.parentNode,
      extent: n.extent,
      ...(n.width != null ? { style: { width: `${n.width}px`, height: `${n.height}px` } } : {})
    }));
  }

  function flowEdgesToVueFlowEdges(flowEdges: FlowEdge[]): Edge[] {
    return flowEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      label: e.label
    }));
  }

  function vueFlowNodesToFlowNodes(vfNodes: Node[]): FlowNode[] {
    return vfNodes.map((n) => ({
      id: n.id,
      type: (n.type || "default") as FlowNode["type"],
      position: n.position,
      data: n.data || {},
      ...(n.parentNode ? { parentNode: n.parentNode } : {}),
      ...(n.extent ? { extent: n.extent as "parent" } : {}),
      ...(n.dimensions?.width ? { width: n.dimensions.width, height: n.dimensions.height } : {})
    }));
  }

  function vueFlowEdgesToFlowEdges(vfEdges: Edge[]): FlowEdge[] {
    return vfEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
      ...(e.targetHandle ? { targetHandle: e.targetHandle } : {}),
      ...(e.label ? { label: String(e.label) } : {})
    }));
  }

  function loadGraph(graph: ApplicationFlowGraph) {
    skipSnapshot = true;
    nodes.value = flowNodesToVueFlowNodes(graph.nodes);
    edges.value = flowEdgesToVueFlowEdges(graph.edges);
    skipSnapshot = false;
    // Reset undo/redo
    undoStack.value = [];
    redoStack.value = [];
    pushSnapshot();
  }

  function toFlowGraph(): ApplicationFlowGraph {
    return {
      nodes: vueFlowNodesToFlowNodes(nodes.value),
      edges: vueFlowEdgesToFlowEdges(edges.value),
      version: 1
    };
  }

  function pushSnapshot() {
    const snapshot = JSON.stringify({ nodes: nodes.value, edges: edges.value });
    undoStack.value.push(snapshot);
    if (undoStack.value.length > 50) {
      undoStack.value.shift();
    }
    redoStack.value = [];
  }

  function undo() {
    if (undoStack.value.length <= 1) return;
    const current = undoStack.value.pop()!;
    redoStack.value.push(current);
    const prev = undoStack.value[undoStack.value.length - 1];
    const { nodes: n, edges: e } = JSON.parse(prev);
    skipSnapshot = true;
    nodes.value = n;
    edges.value = e;
    skipSnapshot = false;
    scheduleSave();
  }

  function redo() {
    if (redoStack.value.length === 0) return;
    const next = redoStack.value.pop()!;
    undoStack.value.push(next);
    const { nodes: n, edges: e } = JSON.parse(next);
    skipSnapshot = true;
    nodes.value = n;
    edges.value = e;
    skipSnapshot = false;
    scheduleSave();
  }

  const canUndo = computed(() => undoStack.value.length > 1);
  const canRedo = computed(() => redoStack.value.length > 0);

  function scheduleSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveStatus.value = "idle";
    hasUnpublishedChanges.value = true;
    saveTimeout = setTimeout(async () => {
      saveStatus.value = "saving";
      saveError.value = "";
      try {
        await $fetch(`/api/applications/flows/${flowId}`, {
          method: "PUT",
          body: { flowJson: toFlowGraph() }
        });
        saveStatus.value = "saved";
        setTimeout(() => {
          if (saveStatus.value === "saved") saveStatus.value = "idle";
        }, 2000);
      } catch (err) {
        saveStatus.value = "error";
        saveError.value = "Failed to save";
        console.error("[flow-builder] Save failed:", err);
      }
    }, 2000);
  }

  function onGraphChange() {
    if (skipSnapshot) return;
    pushSnapshot();
    scheduleSave();
  }

  async function publishChanges() {
    publishStatus.value = "publishing";
    try {
      const result = await $fetch<{ flow: Record<string, unknown> }>(`/api/applications/flows/${flowId}`, {
        method: "PUT",
        body: { action: "publish" }
      });
      publishStatus.value = "published";
      hasUnpublishedChanges.value = false;
      setTimeout(() => {
        if (publishStatus.value === "published") publishStatus.value = "idle";
      }, 2000);
      return result;
    } catch (err) {
      publishStatus.value = "error";
      console.error("[flow-builder] Publish failed:", err);
      throw err;
    }
  }

  async function discardChanges() {
    try {
      const result = await $fetch<{ flow: { flowJson: ApplicationFlowGraph; draftFlowJson: ApplicationFlowGraph | null } }>(`/api/applications/flows/${flowId}`, {
        method: "PUT",
        body: { action: "discard" }
      });
      // Reload the published flowJson into the builder
      if (result.flow?.flowJson) {
        loadGraph(result.flow.flowJson);
      }
      hasUnpublishedChanges.value = false;
      return result;
    } catch (err) {
      console.error("[flow-builder] Discard failed:", err);
      throw err;
    }
  }

  function generateNodeId(): string {
    return `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function generateEdgeId(source: string, target: string): string {
    return `e_${source}_${target}_${Math.random().toString(36).slice(2, 6)}`;
  }

  // ─── Simple Mode Operations ─────────────────────────────────────────

  function loadSimpleMode(graph: ApplicationFlowGraph) {
    const result = flowGraphToSections(graph);
    if (result) {
      sections.value = result;
    } else {
      // Fallback: create a single empty section
      sections.value = [{
        id: `group_${Date.now()}`,
        title: "Section 1",
        items: []
      }];
    }
  }

  function onSimpleSectionsChange() {
    // Convert sections to graph, update nodes/edges, then trigger save
    const graph = sectionsToFlowGraph(sections.value);
    skipSnapshot = true;
    nodes.value = flowNodesToVueFlowNodes(graph.nodes);
    edges.value = flowEdgesToVueFlowEdges(graph.edges);
    skipSnapshot = false;
    pushSnapshot();
    scheduleSave();
  }

  const simpleCompatibility = computed(() => {
    const graph = toFlowGraph();
    return canConvertToSimple(graph);
  });

  async function switchToAdvanced() {
    editorMode.value = "advanced";
    try {
      await $fetch(`/api/applications/flows/${flowId}`, {
        method: "PUT",
        body: { editorMode: "advanced" }
      });
    } catch (err) {
      console.error("[flow-builder] Failed to persist editor mode:", err);
    }
  }

  async function switchToSimple() {
    const graph = toFlowGraph();
    const check = canConvertToSimple(graph);
    if (!check.compatible) return false;

    const result = flowGraphToSections(graph);
    if (!result) return false;

    sections.value = result;
    editorMode.value = "simple";
    try {
      await $fetch(`/api/applications/flows/${flowId}`, {
        method: "PUT",
        body: { editorMode: "simple" }
      });
    } catch (err) {
      console.error("[flow-builder] Failed to persist editor mode:", err);
    }
    return true;
  }

  return {
    nodes,
    edges,
    saveStatus,
    saveError,
    publishStatus,
    hasUnpublishedChanges,
    canUndo,
    canRedo,
    loadGraph,
    toFlowGraph,
    undo,
    redo,
    onGraphChange,
    scheduleSave,
    publishChanges,
    discardChanges,
    generateNodeId,
    generateEdgeId,
    // Simple Mode
    editorMode,
    sections,
    loadSimpleMode,
    onSimpleSectionsChange,
    simpleCompatibility,
    switchToAdvanced,
    switchToSimple
  };
}
