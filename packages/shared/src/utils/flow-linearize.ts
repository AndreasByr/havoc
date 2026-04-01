import type {
  ApplicationFlowGraph,
  FlowNode,
  FlowEdge,
  FlowInputNodeData,
  FlowInfoNodeData,
  FlowAbortNodeData,
  FlowRoleAssignmentNodeData,
  FlowConditionalBranchNodeData,
  LinearizedFlowResult,
  LinearizedStep,
  LinearizedInputField
} from "../types/application-flow";

/**
 * Linearizes a flow graph into an ordered sequence of steps.
 *
 * Runs isomorphically (server + client). Takes the graph and optional current answers,
 * returns the step sequence for the path determined by the answers.
 *
 * - At conditional branches: evaluates against answers to pick the correct path
 * - Groups nodes within StepGroup into single steps
 * - Tracks Role Assignment nodes (invisible to user) — collects all roleIds from the traversed path
 * - Abort nodes terminate the sequence with a message flag
 */
export function linearizeFlowGraph(
  graph: ApplicationFlowGraph,
  answers?: Record<string, unknown>
): LinearizedFlowResult {
  const nodeMap = new Map<string, FlowNode>();
  for (const node of graph.nodes) {
    nodeMap.set(node.id, node);
  }

  // Build adjacency: source → edges (grouped by sourceHandle)
  const outgoingEdges = new Map<string, FlowEdge[]>();
  for (const edge of graph.edges) {
    const key = edge.source;
    if (!outgoingEdges.has(key)) {
      outgoingEdges.set(key, []);
    }
    outgoingEdges.get(key)!.push(edge);
  }

  // Find child nodes of step groups
  const stepGroupChildren = new Map<string, FlowNode[]>();
  for (const node of graph.nodes) {
    if (node.parentNode) {
      if (!stepGroupChildren.has(node.parentNode)) {
        stepGroupChildren.set(node.parentNode, []);
      }
      stepGroupChildren.get(node.parentNode)!.push(node);
    }
  }

  const steps: LinearizedStep[] = [];
  const collectedRoleIds: string[] = [];
  const visited = new Set<string>();
  let abortMessage: string | undefined;
  let reachedEnd = false;

  // Find start node
  const startNode = graph.nodes.find((n) => n.type === "start");
  if (!startNode) {
    return { steps: [], collectedRoleIds: [], reachedEnd: false };
  }

  let currentNodeId: string | null = startNode.id;

  while (currentNodeId && !visited.has(currentNodeId)) {
    visited.add(currentNodeId);
    const node = nodeMap.get(currentNodeId);
    if (!node) break;

    switch (node.type) {
      case "start": {
        // Just follow the edge to the next node
        currentNodeId = getNextNodeId(currentNodeId, outgoingEdges);
        break;
      }

      case "end": {
        reachedEnd = true;
        currentNodeId = null;
        break;
      }

      case "input": {
        // Check if this node is inside a step group — if so, skip (handled by group)
        if (node.parentNode) {
          currentNodeId = getNextNodeId(currentNodeId, outgoingEdges);
          break;
        }
        const field = nodeToInputField(node);
        if (field) {
          steps.push({
            type: "input",
            fields: [field],
            nodeIds: [node.id]
          });
        }
        currentNodeId = getNextNodeId(currentNodeId, outgoingEdges);
        break;
      }

      case "info": {
        const data = node.data as FlowInfoNodeData;
        steps.push({
          type: "info",
          infoData: data,
          nodeIds: [node.id]
        });
        currentNodeId = getNextNodeId(currentNodeId, outgoingEdges);
        break;
      }

      case "abort": {
        const data = node.data as FlowAbortNodeData;
        abortMessage = data.message;
        steps.push({
          type: "abort",
          abortMessage: data.message,
          nodeIds: [node.id]
        });
        currentNodeId = null;
        break;
      }

      case "role_assignment": {
        const data = node.data as FlowRoleAssignmentNodeData;
        if (data.roleIds) {
          collectedRoleIds.push(...data.roleIds);
        }
        currentNodeId = getNextNodeId(currentNodeId, outgoingEdges);
        break;
      }

      case "step_group": {
        const children = stepGroupChildren.get(node.id) ?? [];
        const fields: LinearizedInputField[] = [];
        const nodeIds: string[] = [node.id];

        // Sort children by Y position for consistent ordering
        const sortedChildren = [...children].sort(
          (a, b) => a.position.y - b.position.y
        );

        for (const child of sortedChildren) {
          nodeIds.push(child.id);
          if (child.type === "input") {
            const field = nodeToInputField(child);
            if (field) fields.push(field);
          }
          // Role assignment nodes inside groups
          if (child.type === "role_assignment") {
            const data = child.data as FlowRoleAssignmentNodeData;
            if (data.roleIds) {
              collectedRoleIds.push(...data.roleIds);
            }
          }
        }

        if (fields.length > 0) {
          steps.push({
            type: "input_group",
            fields,
            nodeIds
          });
        }
        currentNodeId = getNextNodeId(currentNodeId, outgoingEdges);
        break;
      }

      case "conditional_branch": {
        const data = node.data as FlowConditionalBranchNodeData;
        const branchEdges: FlowEdge[] = outgoingEdges.get(currentNodeId) ?? [];

        // Determine which branch to follow based on current answers
        let nextNodeId: string | null = null;

        if (answers && data.sourceNodeId) {
          const answer = answers[data.sourceNodeId];

          // Try to match answer to a branch
          for (const branch of data.branches) {
            const answerMatches =
              answer === branch.optionId ||
              (Array.isArray(answer) && answer.includes(branch.optionId));

            if (answerMatches) {
              // Find the edge with this handle
              const matchedEdge = branchEdges.find(
                (e: FlowEdge) => e.sourceHandle === branch.handleId
              );
              if (matchedEdge) {
                nextNodeId = matchedEdge.target;
                break;
              }
            }
          }

          // If no branch matched, try the default handle
          if (!nextNodeId && data.defaultHandleId) {
            const defaultEdge = branchEdges.find(
              (e: FlowEdge) => e.sourceHandle === data.defaultHandleId
            );
            if (defaultEdge) {
              nextNodeId = defaultEdge.target;
            }
          }
        }

        // If still no match (no answers provided or no matching branch),
        // follow the first available edge as a fallback
        if (!nextNodeId && branchEdges.length > 0) {
          nextNodeId = branchEdges[0].target;
        }

        currentNodeId = nextNodeId;
        break;
      }

      default:
        currentNodeId = getNextNodeId(currentNodeId, outgoingEdges);
        break;
    }
  }

  return { steps, collectedRoleIds, abortMessage, reachedEnd };
}

function getNextNodeId(
  currentNodeId: string,
  outgoingEdges: Map<string, FlowEdge[]>
): string | null {
  const edges = outgoingEdges.get(currentNodeId);
  if (!edges || edges.length === 0) return null;
  // For non-branching nodes, there should be exactly one outgoing edge
  return edges[0].target;
}

function nodeToInputField(node: FlowNode): LinearizedInputField | null {
  if (node.type !== "input") return null;
  const data = node.data as FlowInputNodeData;
  return {
    nodeId: node.id,
    inputType: data.inputType,
    label: data.label,
    description: data.description,
    placeholder: data.placeholder,
    required: data.required,
    options: data.options,
    discordRoleOptions: data.discordRoleOptions,
    validation: data.validation
  };
}
