import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, runTool } from "./http";
import { createBriefShape, editBriefShape } from "./brief-schema";
import { buildRenderDiagnosticSnapshot } from "./render-diagnostics";
import {
  applyDesignActionsToolSchema,
  inspectDesignDocumentToolSchema,
} from "./design-action-schema";

const uuid = (desc: string) => z.string().uuid().describe(desc);

// Annotation shorthands. Per the MCP spec, destructiveHint defaults to true and
// openWorldHint defaults to true, so non-destructive writes and closed-API
// tools must say so explicitly. All tools talk only to the Instavar API (a
// closed system) except the two that reach external social platforms.
const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;
const SAFE_WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

// Every tool takes a strict object, like the remote Studio tools in
// lib/mcp/remote/register-tools.ts: an unknown argument is rejected with a
// readable error instead of being silently dropped before the API call.
export function registerTools(server: McpServer): void {
  // ── Reads ──────────────────────────────────────────────────────────────

  server.registerTool(
    "list_jobs",
    {
      title: "List jobs",
      description:
        "List recent video jobs for the current organization (newest first). Start here to discover job IDs; for one job's full detail use get_job_status.",
      inputSchema: z
        .object({
          limit: z
            .number()
            .int()
            .min(1)
            .max(50)
            .default(10)
            .describe("Number of jobs to return (default 10, max 50)"),
          status: z
            .enum([
              "queued",
              "rendering",
              "draft_ready",
              "approved",
              "publish_requested",
              "publishing",
              "published",
              "failed",
            ])
            .optional()
            .describe("Filter by job status"),
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async ({ limit, status }) => {
      const q = new URLSearchParams({ limit: String(limit) });
      if (status) q.set("status", status);
      return runTool(() => apiGet(`/api/v1/jobs?${q.toString()}`));
    }
  );

  server.registerTool(
    "get_job_status",
    {
      title: "Get job status",
      description:
        "Get detailed status for a job: runs, artifacts, verifications, plus the current video and thumbnail URLs. The main polling target after create_video_brief or edit_video_brief; for post-publish engagement numbers use get_job_metrics instead.",
      inputSchema: z.object({ jobId: uuid("The job ID to check") }).strict(),
      annotations: READ_ONLY,
    },
    async ({ jobId }) =>
      runTool(() => apiGet(`/api/v1/jobs/${encodeURIComponent(jobId)}`))
  );

  server.registerTool(
    "get_video_state",
    {
      title: "Get video state",
      description:
        "Get the materialized video state for a job (composition decisions: scenes, duration, aspect ratio, etc.). Use it to inspect what the video contains; for pipeline progress and video URLs use get_job_status.",
      inputSchema: z.object({ jobId: uuid("The job ID") }).strict(),
      annotations: READ_ONLY,
    },
    async ({ jobId }) =>
      runTool(() =>
        apiGet(`/api/v1/jobs/${encodeURIComponent(jobId)}/video-state`)
      )
  );

  server.registerTool(
    "diagnose_render",
    {
      title: "Diagnose render",
      description:
        "Build one read-only troubleshooting snapshot from the current job status and video state. Reports run failures, artifact binding, duration evidence, retry recommendations, rights checks, and whether blank-frame or placeholder verification evidence exists. It does not visually inspect the video.",
      inputSchema: z.object({ jobId: uuid("The job ID to diagnose") }).strict(),
      annotations: READ_ONLY,
    },
    async ({ jobId }) =>
      runTool(async () => {
        const encodedJobId = encodeURIComponent(jobId);
        const [jobStatus, videoState] = await Promise.all([
          apiGet(`/api/v1/jobs/${encodedJobId}`),
          apiGet(`/api/v1/jobs/${encodedJobId}/video-state`),
        ]);
        return buildRenderDiagnosticSnapshot({ jobStatus, videoState });
      })
  );

  server.registerTool(
    "get_job_metrics",
    {
      title: "Get job metrics",
      description:
        "Get the latest platform engagement metric snapshots for a published job (newest first). Read-only. Only meaningful after publish_job; for render progress use get_job_status.",
      inputSchema: z
        .object({
          jobId: uuid("The job ID"),
          limit: z
            .number()
            .int()
            .min(1)
            .max(20)
            .default(10)
            .describe("Max metric snapshots (default 10, max 20)"),
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async ({ jobId, limit }) =>
      runTool(() =>
        apiGet(
          `/api/v1/jobs/${encodeURIComponent(jobId)}/metrics?limit=${limit}`
        )
      )
  );

  server.registerTool(
    "get_cost_summary",
    {
      title: "Get cost summary",
      description:
        "Query production infrastructure costs (Lambda, RunPod, R2, WaveSpeed, PoYo), optionally with reconciliation drift. This is spend data, not engagement — for a published job's audience numbers use get_job_metrics.",
      inputSchema: z
        .object({
          since: z
            .string()
            .optional()
            .describe("ISO date — only include events after this date"),
          provider: z
            .enum(["runpod", "lambda", "r2", "wavespeed", "poyo", "all"])
            .default("all")
            .describe("Filter by provider"),
          groupBy: z
            .enum(["provider", "job", "day"])
            .default("provider")
            .describe("How to aggregate the summary"),
          includeReconciliation: z
            .boolean()
            .default(false)
            .describe("Include account-wide reconciliation events"),
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async ({ since, provider, groupBy, includeReconciliation }) => {
      const q = new URLSearchParams({ provider, groupBy });
      if (since) q.set("since", since);
      if (includeReconciliation) q.set("includeReconciliation", "true");
      return runTool(() => apiGet(`/api/v1/cost-summary?${q.toString()}`));
    }
  );

  server.registerTool(
    "inspect_workflow",
    {
      title: "Inspect workflow",
      description:
        "Inspect the current Studio workflow and its version history for a job.",
      inputSchema: z.object({ jobId: uuid("The job ID") }).strict(),
      annotations: READ_ONLY,
    },
    async ({ jobId }) =>
      runTool(() =>
        apiGet(`/api/v1/jobs/${encodeURIComponent(jobId)}/workflow`)
      )
  );

  server.registerTool(
    "inspect_design_document",
    {
      title: "Inspect design document",
      description:
        "Inspect one versioned design document and its recent immutable version history. This tool never changes the document.",
      inputSchema: inspectDesignDocumentToolSchema,
      annotations: READ_ONLY,
    },
    async ({ projectId, documentId, includeVersions }) => {
      const query = new URLSearchParams({
        documentId,
        includeVersions: includeVersions ? "1" : "0",
      });
      return runTool(() =>
        apiGet(
          `/api/v1/projects/${encodeURIComponent(
            projectId
          )}/design?${query.toString()}`
        )
      );
    }
  );

  server.registerTool(
    "apply_design_actions",
    {
      title: "Apply design actions",
      description:
        "Apply a reviewed group of closed, invertible design actions to an expected document version. Inspect first. A stale version returns a readable conflict and does not overwrite customer work.",
      inputSchema: applyDesignActionsToolSchema,
      annotations: SAFE_WRITE,
    },
    async (input) =>
      runTool(() =>
        apiPost(
          `/api/v1/projects/${encodeURIComponent(input.projectId)}/design`,
          input
        )
      )
  );

  // ── Writes ─────────────────────────────────────────────────────────────

  server.registerTool(
    "create_video_brief",
    {
      title: "Create video brief",
      description:
        "Create a new video job from a structured brief and trigger the render pipeline. Returns the job and run IDs immediately; rendering continues asynchronously (typically a few minutes) — poll get_job_status until draft_ready. Requires a key with write scope. To change an existing job, use edit_video_brief instead of creating a duplicate.",
      // Strict like the remote Studio tool: an unsupported field such as a
      // framework choice is rejected instead of being stripped and rendered
      // with the default renderer.
      inputSchema: z.object(createBriefShape).strict(),
      annotations: SAFE_WRITE,
    },
    async (input) => runTool(() => apiPost(`/api/v1/jobs`, input))
  );

  server.registerTool(
    "edit_video_brief",
    {
      title: "Edit video brief",
      description:
        "Edit an existing job's brief (only provided fields change). Changing the script, caption, title, lessonTitle, objective, steps, scenes, aspectRatio or voiceId triggers a re-render and returns the new run ID; objective also re-routes the composition. Changing only publishTarget updates the job's target platform without re-rendering. For a brand-new video use create_video_brief.",
      inputSchema: z.object(editBriefShape).strict(),
      annotations: SAFE_WRITE,
    },
    async (input) => {
      const { jobId, ...patch } = input;
      return runTool(() =>
        apiPost(`/api/v1/jobs/${encodeURIComponent(jobId)}/brief`, patch)
      );
    }
  );

  const workflowWrite = (
    operation: string,
    jobId: string,
    payload: Record<string, unknown> = {}
  ) =>
    runTool(() =>
      apiPost(`/api/v1/jobs/${encodeURIComponent(jobId)}/workflow`, {
        operation,
        ...payload,
      })
    );

  server.registerTool(
    "draft_workflow",
    {
      title: "Draft workflow",
      description:
        "Create a durable Documentary Journey or Transformation Montage workflow version. Inspect first and pass its current version, or 0 only when no workflow exists.",
      inputSchema: z
        .object({
          jobId: uuid("The job ID"),
          expectedVersion: z
            .number()
            .int()
            .nonnegative()
            .describe("Use 0 when no workflow exists yet"),
          document: z
            .unknown()
            .describe("The complete Studio workflow document"),
        })
        .strict(),
      annotations: SAFE_WRITE,
    },
    async ({ jobId, expectedVersion, document }) =>
      workflowWrite("draft", jobId, { expectedVersion, document })
  );

  server.registerTool(
    "patch_workflow",
    {
      title: "Patch workflow",
      description:
        "Create a new workflow version by recursively merging a patch into the current version.",
      inputSchema: z
        .object({
          jobId: uuid("The job ID"),
          expectedVersion: z.number().int().positive(),
          patch: z.record(z.string(), z.unknown()),
        })
        .strict(),
      annotations: SAFE_WRITE,
    },
    async ({ jobId, expectedVersion, patch }) =>
      workflowWrite("patch", jobId, { expectedVersion, patch })
  );

  server.registerTool(
    "validate_workflow",
    {
      title: "Validate workflow",
      description:
        "Validate and compile the inspected workflow version without rendering or publishing it.",
      inputSchema: z
        .object({
          jobId: uuid("The job ID"),
          expectedVersion: z.number().int().positive(),
        })
        .strict(),
      annotations: SAFE_WRITE,
    },
    async ({ jobId, expectedVersion }) =>
      workflowWrite("validate", jobId, { expectedVersion })
  );

  server.registerTool(
    "preview_workflow",
    {
      title: "Preview workflow",
      description:
        "Return the current workflow's compiled UniversalVideo brief for a safe pre-render preview.",
      inputSchema: z.object({ jobId: uuid("The job ID") }).strict(),
      annotations: READ_ONLY,
    },
    async ({ jobId }) =>
      runTool(() =>
        apiGet(
          `/api/v1/jobs/${encodeURIComponent(jobId)}/workflow?operation=preview`
        )
      )
  );

  server.registerTool(
    "compare_workflows",
    {
      title: "Compare workflow versions",
      description: "Compare two durable workflow versions field by field.",
      inputSchema: z
        .object({
          jobId: uuid("The job ID"),
          fromVersion: z.number().int().positive(),
          toVersion: z.number().int().positive(),
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async ({ jobId, fromVersion, toVersion }) => {
      const query = new URLSearchParams({
        operation: "compare",
        fromVersion: String(fromVersion),
        toVersion: String(toVersion),
      });
      return runTool(() =>
        apiGet(
          `/api/v1/jobs/${encodeURIComponent(
            jobId
          )}/workflow?${query.toString()}`
        )
      );
    }
  );

  server.registerTool(
    "approve_workflow",
    {
      title: "Approve workflow",
      description:
        "Validate and approve the inspected workflow version. This does not approve or publish the video job.",
      inputSchema: z
        .object({
          jobId: uuid("The job ID"),
          expectedVersion: z.number().int().positive(),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ jobId, expectedVersion }) =>
      workflowWrite("approve", jobId, { expectedVersion })
  );

  server.registerTool(
    "retry_video_qa",
    {
      title: "Retry video QA",
      description:
        "Retry the default QA evaluator against the same current frozen video. Use only when get_job_status recommends retryTarget qa_only, or when QA is missing, unavailable, or parse-degraded. This does not regenerate media and cannot clear publish gates by itself.",
      inputSchema: z
        .object({
          jobId: uuid("The current job ID"),
          runId: uuid("The current render run ID"),
          videoArtifactId: uuid("The current frozen video artifact ID"),
        })
        .strict(),
      annotations: SAFE_WRITE,
    },
    async ({ jobId, runId, videoArtifactId }) =>
      runTool(() =>
        apiPost(`/api/v1/jobs/${encodeURIComponent(jobId)}/qa/retry`, {
          runId,
          videoArtifactId,
        })
      )
  );

  server.registerTool(
    "audit_video_qa",
    {
      title: "Audit video QA",
      description:
        "Run Qwen3.6-Plus as an advisory second evaluator against the same current frozen video. Use only on an explicit request for another model, second opinion, or evaluator escalation. The result is separate from default QA and has no publish-gate effect.",
      inputSchema: z
        .object({
          jobId: uuid("The current job ID"),
          runId: uuid("The current render run ID"),
          videoArtifactId: uuid("The current frozen video artifact ID"),
        })
        .strict(),
      annotations: SAFE_WRITE,
    },
    async ({ jobId, runId, videoArtifactId }) =>
      runTool(() =>
        apiPost(`/api/v1/jobs/${encodeURIComponent(jobId)}/qa/audit`, {
          runId,
          videoArtifactId,
        })
      )
  );

  server.registerTool(
    "regenerate_narration",
    {
      title: "Regenerate narration",
      description:
        "Regenerate narration from the unchanged durable brief and then regenerate its dependent video in a paid adaptation run. Use only on an explicit user request or when get_job_status recommends retryTarget tts. This is an audio_and_video cascade, consumes rerender quota, and requires fresh QA.",
      inputSchema: z
        .object({
          jobId: uuid("The current job ID"),
          sourceRunId: uuid("The current run ID"),
          trigger: z.enum(["user_requested", "verifier_recommendation"]),
        })
        .strict(),
      annotations: SAFE_WRITE,
    },
    async ({ jobId, sourceRunId, trigger }) =>
      runTool(() =>
        apiPost(
          `/api/v1/jobs/${encodeURIComponent(jobId)}/narration/regenerate`,
          { sourceRunId, trigger }
        )
      )
  );

  server.registerTool(
    "approve_job",
    {
      title: "Approve job",
      description:
        "Approve a rendered job so it becomes publishable (draft_ready/awaiting_review/needs_changes -> approved) and revoke active review links. Required before publish_job will accept the job.",
      inputSchema: z.object({ jobId: uuid("The job ID to approve") }).strict(),
      annotations: {
        readOnlyHint: false,
        // Approval revokes active review links, so this is not purely additive.
        destructiveHint: true,
        // Approving an already-approved job does not change state further.
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ jobId }) =>
      runTool(() =>
        apiPost(`/api/v1/jobs/${encodeURIComponent(jobId)}/approve`, {})
      )
  );

  server.registerTool(
    "publish_job",
    {
      title: "Publish job",
      description:
        "Publish an APPROVED job to its connected social destination via the gated publish API. All production gates run (paid plan, ownership, abuse, QA, disclosure, destination, rights, moderation). Requires a key with publish scope; the post goes live on the external platform and cannot be recalled by the API. For YouTube pass youtubePrivacyStatus:'private' for safe runs.",
      inputSchema: z
        .object({
          jobId: uuid("The approved job to publish"),
          xPreviewArtifactId: z
            .string()
            .min(1)
            .optional()
            .describe("X only. Exact reviewed video artifact ID."),
          xCaption: z
            .string()
            .trim()
            .min(1)
            .max(2_000)
            .optional()
            .describe("X only. Exact post text approved by the user."),
          xMadeWithAi: z
            .boolean()
            .optional()
            .describe("X only. Enable the Made with AI disclosure."),
          confirmXPublicPost: z
            .boolean()
            .optional()
            .describe(
              "True only after the user authorizes this public X post."
            ),
          confirmXAutomationPolicy: z
            .boolean()
            .optional()
            .describe(
              "True only after the user confirms the X automation policy."
            ),
          confirmXOriginalContent: z
            .boolean()
            .optional()
            .describe(
              "True only after the user confirms ownership or publishing rights."
            ),
          youtubePrivacyStatus: z
            .enum(["private", "unlisted", "public"])
            .optional()
            .describe("YouTube only. Use 'private' for safe dogfood runs."),
          tiktokPostMode: z
            .enum(["direct_publish", "draft_upload"])
            .optional()
            .describe("TikTok only. Use 'draft_upload' for safe dogfood runs."),
          connectedAccountDestinationId: z
            .string()
            .uuid()
            .optional()
            .describe(
              "Specific destination when the org has multiple accounts for the provider."
            ),
          confirmSyntheticDisclosure: z
            .boolean()
            .optional()
            .describe(
              "Set true when the job requires an AI synthetic-media disclosure."
            ),
          confirmQaOverride: z
            .boolean()
            .optional()
            .describe("Set true to override a non-passing QA gate."),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        // A live post on an external platform cannot be recalled by the API.
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ jobId, ...rest }) =>
      // NOTE: publish is NOT under /api/v1 — it is the gated /api/jobs route.
      runTool(() =>
        apiPost(`/api/jobs/${encodeURIComponent(jobId)}/publish`, rest)
      )
  );

  // ── Account connection (headless OAuth device-pairing) ───────────────────

  server.registerTool(
    "connect_account",
    {
      title: "Connect social account",
      description:
        "Start connecting a social account headlessly (no local browser needed). Returns an approve URL + a short confirm code: open the URL in a browser signed in to Instavar, check the code matches THIS terminal, and approve. Then poll connect_account_status with the returned pairingId until it reports 'connected'.",
      inputSchema: z
        .object({
          provider: z
            .enum([
              "youtube",
              "x",
              "tiktok",
              "linkedin",
              "facebook",
              "instagram",
              "threads",
            ])
            .describe("The social platform to connect"),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        // The pairing hands off to the platform's own OAuth flow.
        openWorldHint: true,
      },
    },
    async ({ provider }) =>
      runTool(() => apiPost(`/api/v1/connect/start`, { provider }))
  );

  server.registerTool(
    "connect_account_status",
    {
      title: "Check account connection",
      description:
        "Poll a pending account connection started by connect_account. Returns status 'pending' | 'connected' | 'expired', plus the connected account label once connected.",
      inputSchema: z
        .object({
          pairingId: uuid("The pairingId returned by connect_account"),
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async ({ pairingId }) =>
      runTool(() =>
        apiGet(
          `/api/v1/connect/poll?pairingId=${encodeURIComponent(pairingId)}`
        )
      )
  );
}
