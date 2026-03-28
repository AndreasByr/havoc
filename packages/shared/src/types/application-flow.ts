// ─── Flow Node & Edge Types ─────────────────────────────────────────────────

export type FlowInputType =
  | "short_text"
  | "long_text"
  | "number"
  | "email"
  | "single_select_radio"
  | "single_select_dropdown"
  | "multi_select"
  | "yes_no"
  | "date"
  | "file_upload"
  | "discord_username";

export type FlowNodeType =
  | "start"
  | "end"
  | "input"
  | "info"
  | "conditional_branch"
  | "abort"
  | "role_assignment"
  | "step_group";

export interface FlowNodePosition {
  x: number;
  y: number;
}

// ─── Per-Node Data Interfaces ───────────────────────────────────────────────

export interface FlowInputNodeData {
  inputType: FlowInputType;
  label: string;
  description?: string;
  placeholder?: string;
  required: boolean;
  /** For select/radio/checkbox types: the available options */
  options?: Array<{ id: string; label: string }>;
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    minValue?: number;
    maxValue?: number;
    integerOnly?: boolean;
    minSelections?: number;
    maxSelections?: number;
    maxFileSize?: number;
    allowedFileTypes?: string[];
    pastOnly?: boolean;
    futureOnly?: boolean;
  };
}

export interface FlowInfoNodeData {
  markdown: string;
  ctaLabel?: string;
  ctaUrl?: string;
  ctaLinkText?: string;
  ctaLinkUrl?: string;
}

export interface FlowConditionalBranchNodeData {
  /** Which input node's answer to branch on */
  sourceNodeId: string;
  /** Each branch maps an option to a specific output handle */
  branches: Array<{ optionId: string; label: string; handleId: string }>;
  /** Handle id for answers that don't match any branch */
  defaultHandleId?: string;
}

export interface FlowAbortNodeData {
  message: string;
}

export interface FlowRoleAssignmentNodeData {
  /** Array of Discord role IDs to assign when this node is in the traversed path */
  roleIds: string[];
  /** Snapshot of role names for display purposes */
  roleNameSnapshots: string[];
}

export interface FlowStepGroupNodeData {
  title: string;
  description?: string;
}

export type FlowNodeData =
  | FlowInputNodeData
  | FlowInfoNodeData
  | FlowConditionalBranchNodeData
  | FlowAbortNodeData
  | FlowRoleAssignmentNodeData
  | FlowStepGroupNodeData
  | Record<string, never>; // start/end nodes have empty data

// ─── Graph Structure ────────────────────────────────────────────────────────

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  position: FlowNodePosition;
  data: FlowNodeData;
  /** For nodes inside a StepGroup — references the group node's id */
  parentNode?: string;
  extent?: "parent";
  /** Persisted dimensions for resizable nodes (e.g. step_group) */
  width?: number;
  height?: number;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

export interface ApplicationFlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** Schema version for forward compatibility */
  version: number;
}

// ─── Flow Settings ──────────────────────────────────────────────────────────

export interface ApplicationFlowConcurrencySettings {
  /** Can a user apply again to this flow while they have an open application? */
  allowReapplyToSameFlow: boolean;
  /** Can a user apply to this flow while they have an open application on another flow? */
  allowCrossFlowApplications: boolean;
}

export interface ApplicationFlowSettings {
  embed: {
    channelId?: string;
    description?: string;
    buttonLabel?: string;
    color?: string;
  };
  roles: {
    /** Discord role IDs assigned when the applicant submits the form */
    onSubmission: string[];
    /** Discord role IDs assigned when a moderator approves the application */
    onApproval: string[];
  };
  /** Template composing Display Name fields, e.g. "{vorname} | {clan-tag}" */
  displayNameTemplate?: string;
  welcome: {
    channelId?: string;
    /** Supports {discordId} which renders as a Discord mention */
    messageTemplate?: string;
  };
  concurrency: ApplicationFlowConcurrencySettings;
  /** Days after which archived applications are auto-deleted (0 = keep forever) */
  archiveRetentionDays: number;
  /** When enabled, bot skips guild membership and existing member checks */
  testMode: boolean;
  /** Token validity in minutes (default 60) */
  tokenExpiryMinutes: number;
  messages: {
    /** Ephemeral message shown after clicking the embed button */
    ephemeralConfirmation?: string;
    /** Button label in the ephemeral message */
    ephemeralButtonLabel?: string;
    /** Page shown when the token has expired */
    tokenExpired?: string;
    /** DM sent to applicant on approval */
    dmOnApproval?: string;
    /** DM sent to applicant on rejection */
    dmOnRejection?: string;
    /** DM sent to moderators on new application */
    dmToModsOnSubmission?: string;
    /** Confirmation shown after successful submission */
    submissionConfirmation?: string;
  };
}

// ─── Linearized Flow (output of linearizeFlowGraph) ─────────────────────────

export type LinearizedStepType = "input" | "input_group" | "info" | "abort";

export interface LinearizedInputField {
  nodeId: string;
  inputType: FlowInputType;
  label: string;
  description?: string;
  placeholder?: string;
  required: boolean;
  options?: Array<{ id: string; label: string }>;
  validation?: FlowInputNodeData["validation"];
}

export interface LinearizedStep {
  type: LinearizedStepType;
  /** For single input: one field. For input_group: multiple fields. */
  fields?: LinearizedInputField[];
  /** For info steps */
  infoData?: FlowInfoNodeData;
  /** For abort steps */
  abortMessage?: string;
  /** The node IDs involved in this step (for answer mapping) */
  nodeIds: string[];
}

export interface LinearizedFlowResult {
  steps: LinearizedStep[];
  /** All role IDs collected from Role Assignment nodes in the traversed path */
  collectedRoleIds: string[];
  /** If the flow hits an abort node, this is the abort message */
  abortMessage?: string;
  /** Whether the flow reached a valid end */
  reachedEnd: boolean;
}

// ─── Status Enums (TypeScript mirrors of pgEnum) ────────────────────────────

export type ApplicationFlowStatus = "draft" | "active" | "inactive";
export type ApplicationStatus = "pending" | "approved" | "rejected";

// ─── Default Flow Graph ─────────────────────────────────────────────────────

export function createDefaultFlowGraph(): ApplicationFlowGraph {
  return {
    nodes: [
      { id: "start", type: "start", position: { x: 250, y: 50 }, data: {} },
      { id: "end", type: "end", position: { x: 250, y: 400 }, data: {} }
    ],
    edges: [{ id: "start-end", source: "start", target: "end" }],
    version: 1
  };
}

export function createDefaultFlowSettings(): ApplicationFlowSettings {
  return {
    embed: {},
    roles: { onSubmission: [], onApproval: [] },
    welcome: {},
    concurrency: {
      allowReapplyToSameFlow: false,
      allowCrossFlowApplications: true
    },
    archiveRetentionDays: 0,
    testMode: false,
    tokenExpiryMinutes: 60,
    messages: {}
  };
}
