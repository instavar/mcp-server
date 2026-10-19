export type StudioToolCapability =
  | "read"
  | "content_write"
  | "approval"
  | "external_connection"
  | "publish";

export type StudioToolCost = "none" | "possible_provider_cost";

export interface StudioToolDefinition {
  name: string;
  title: string;
  capability: StudioToolCapability;
  cost: StudioToolCost;
  surfaces: readonly ("remote" | "standalone")[];
}

/**
 * Canonical authenticated Studio MCP inventory.
 *
 * Keep this file inside the published package so the public mirror remains
 * self-contained. The protected remote server imports the same inventory.
 * Registration and wire-schema parity tests fail when either surface drifts.
 */
export const STUDIO_TOOL_CATALOG = [
  {
    name: "review_video_project",
    title: "Review an Instavar video",
    capability: "read",
    cost: "none",
    surfaces: ["remote"],
  },
  {
    name: "list_jobs",
    title: "List jobs",
    capability: "read",
    cost: "none",
    surfaces: ["remote", "standalone"],
  },
  {
    name: "get_job_status",
    title: "Get job status",
    capability: "read",
    cost: "none",
    surfaces: ["remote", "standalone"],
  },
  {
    name: "get_video_state",
    title: "Get video state",
    capability: "read",
    cost: "none",
    surfaces: ["remote", "standalone"],
  },
  {
    name: "diagnose_render",
    title: "Diagnose render",
    capability: "read",
    cost: "none",
    surfaces: ["remote", "standalone"],
  },
  {
    name: "get_job_metrics",
    title: "Get job metrics",
    capability: "read",
    cost: "none",
    surfaces: ["remote", "standalone"],
  },
  {
    name: "get_cost_summary",
    title: "Get cost summary",
    capability: "read",
    cost: "none",
    surfaces: ["remote", "standalone"],
  },
  {
    name: "inspect_workflow",
    title: "Inspect workflow",
    capability: "read",
    cost: "none",
    surfaces: ["remote", "standalone"],
  },
  {
    name: "inspect_design_document",
    title: "Inspect design document",
    capability: "read",
    cost: "none",
    surfaces: ["remote", "standalone"],
  },
  {
    name: "apply_design_actions",
    title: "Apply design actions",
    capability: "content_write",
    cost: "none",
    surfaces: ["remote", "standalone"],
  },
  {
    name: "create_video_brief",
    title: "Create video brief",
    capability: "content_write",
    cost: "possible_provider_cost",
    surfaces: ["remote", "standalone"],
  },
  {
    name: "edit_video_brief",
    title: "Edit video brief",
    capability: "content_write",
    cost: "possible_provider_cost",
    surfaces: ["remote", "standalone"],
  },
  {
    name: "draft_workflow",
    title: "Draft workflow",
    capability: "content_write",
    cost: "none",
    surfaces: ["remote", "standalone"],
  },
  {
    name: "patch_workflow",
    title: "Patch workflow",
    capability: "content_write",
    cost: "none",
    surfaces: ["remote", "standalone"],
  },
  {
    name: "validate_workflow",
    title: "Validate workflow",
    capability: "content_write",
    cost: "none",
    surfaces: ["remote", "standalone"],
  },
  {
    name: "preview_workflow",
    title: "Preview workflow",
    capability: "read",
    cost: "none",
    surfaces: ["remote", "standalone"],
  },
  {
    name: "compare_workflows",
    title: "Compare workflow versions",
    capability: "read",
    cost: "none",
    surfaces: ["remote", "standalone"],
  },
  {
    name: "approve_workflow",
    title: "Approve workflow",
    capability: "content_write",
    cost: "none",
    surfaces: ["remote", "standalone"],
  },
  {
    name: "retry_video_qa",
    title: "Retry video QA",
    capability: "content_write",
    cost: "possible_provider_cost",
    surfaces: ["remote", "standalone"],
  },
  {
    name: "audit_video_qa",
    title: "Audit video QA",
    capability: "content_write",
    cost: "possible_provider_cost",
    surfaces: ["remote", "standalone"],
  },
  {
    name: "regenerate_narration",
    title: "Regenerate narration",
    capability: "content_write",
    cost: "possible_provider_cost",
    surfaces: ["remote", "standalone"],
  },
  {
    name: "approve_job",
    title: "Approve job",
    capability: "approval",
    cost: "none",
    surfaces: ["remote", "standalone"],
  },
  {
    name: "publish_job",
    title: "Publish job",
    capability: "publish",
    cost: "none",
    surfaces: ["remote", "standalone"],
  },
  {
    name: "connect_account",
    title: "Connect social account",
    capability: "external_connection",
    cost: "none",
    surfaces: ["remote", "standalone"],
  },
  {
    name: "connect_account_status",
    title: "Check account connection",
    capability: "read",
    cost: "none",
    surfaces: ["remote", "standalone"],
  },
] as const satisfies readonly StudioToolDefinition[];

export type StudioToolName = (typeof STUDIO_TOOL_CATALOG)[number]["name"];

export const REMOTE_STUDIO_TOOL_NAMES = STUDIO_TOOL_CATALOG.filter((tool) =>
  tool.surfaces.some((surface) => surface === "remote")
).map((tool) => tool.name);

export const STANDALONE_STUDIO_TOOL_NAMES = STUDIO_TOOL_CATALOG.filter((tool) =>
  tool.surfaces.some((surface) => surface === "standalone")
).map((tool) => tool.name);

/**
 * Least-privilege Codex/Claude troubleshooting profile. New catalog entries do
 * not enter this allowlist automatically. Approval, account connection, and
 * publishing stay unavailable in everyday diagnostic sessions.
 */
export const TROUBLESHOOTING_STUDIO_TOOL_NAMES = [
  "review_video_project",
  "list_jobs",
  "get_job_status",
  "get_video_state",
  "diagnose_render",
  "get_job_metrics",
  "get_cost_summary",
  "inspect_workflow",
  "inspect_design_document",
  "apply_design_actions",
  "create_video_brief",
  "edit_video_brief",
  "draft_workflow",
  "patch_workflow",
  "validate_workflow",
  "preview_workflow",
  "compare_workflows",
  "approve_workflow",
  "retry_video_qa",
  "audit_video_qa",
  "regenerate_narration",
  "connect_account_status",
] as const satisfies readonly StudioToolName[];

export function getStudioToolDefinition(
  name: StudioToolName
): (typeof STUDIO_TOOL_CATALOG)[number] {
  const definition = STUDIO_TOOL_CATALOG.find((tool) => tool.name === name);
  if (!definition) {
    throw new Error(`Unknown Studio MCP tool: ${name}`);
  }
  return definition;
}

export function studioToolMetadata(name: StudioToolName) {
  const definition = getStudioToolDefinition(name);
  const readOnly = definition.capability === "read";
  const publish = definition.capability === "publish";
  const externalConnection = definition.capability === "external_connection";
  const destructive = publish || name === "approve_job";

  return {
    title: definition.title,
    annotations: {
      readOnlyHint: readOnly,
      destructiveHint: destructive,
      idempotentHint:
        readOnly ||
        definition.capability === "approval" ||
        name === "approve_workflow",
      openWorldHint: publish || externalConnection,
    },
  } as const;
}
