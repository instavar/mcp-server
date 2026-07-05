import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, runTool } from "./http";
import { createBriefShape, editBriefShape } from "./brief-schema";

const uuid = (desc: string) => z.string().uuid().describe(desc);

// Annotation shorthands. Per the MCP spec, destructiveHint defaults to true and
// openWorldHint defaults to true, so non-destructive writes and closed-API
// tools must say so explicitly. All tools talk only to the Instavar API (a
// closed system) except the two that reach external social platforms.
const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;
const SAFE_WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

export function registerTools(server: McpServer): void {
  // ── Reads ──────────────────────────────────────────────────────────────

  server.registerTool(
    "list_jobs",
    {
      title: "List jobs",
      description:
        "List recent video jobs for the current organization (newest first).",
      inputSchema: {
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
      },
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
        "Get detailed status for a job: runs, artifacts, verifications, plus the current video and thumbnail URLs.",
      inputSchema: { jobId: uuid("The job ID to check") },
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
        "Get the materialized video state for a job (composition decisions: scenes, duration, aspect ratio, etc.).",
      inputSchema: { jobId: uuid("The job ID") },
      annotations: READ_ONLY,
    },
    async ({ jobId }) =>
      runTool(() =>
        apiGet(`/api/v1/jobs/${encodeURIComponent(jobId)}/video-state`)
      )
  );

  server.registerTool(
    "get_job_metrics",
    {
      title: "Get job metrics",
      description:
        "Get the latest platform engagement metric snapshots for a published job (newest first). Read-only.",
      inputSchema: {
        jobId: uuid("The job ID"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .default(10)
          .describe("Max metric snapshots (default 10, max 20)"),
      },
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
        "Query production infrastructure costs (Lambda, RunPod, R2, WaveSpeed, PoYo), optionally with reconciliation drift.",
      inputSchema: {
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
      },
      annotations: READ_ONLY,
    },
    async ({ since, provider, groupBy, includeReconciliation }) => {
      const q = new URLSearchParams({ provider, groupBy });
      if (since) q.set("since", since);
      if (includeReconciliation) q.set("includeReconciliation", "true");
      return runTool(() => apiGet(`/api/v1/cost-summary?${q.toString()}`));
    }
  );

  // ── Writes ─────────────────────────────────────────────────────────────

  server.registerTool(
    "create_video_brief",
    {
      title: "Create video brief",
      description:
        "Create a new video job from a structured brief and trigger the render pipeline. Returns the job and run IDs.",
      inputSchema: createBriefShape,
      annotations: SAFE_WRITE,
    },
    async (input) => runTool(() => apiPost(`/api/v1/jobs`, input))
  );

  server.registerTool(
    "edit_video_brief",
    {
      title: "Edit video brief",
      description:
        "Edit an existing job's brief (only provided fields change). Changing the script, caption, title, lessonTitle, objective, steps, scenes or aspectRatio triggers a re-render and returns the new run ID; objective also re-routes the composition. Changing only publishTarget updates the job's target platform without re-rendering.",
      inputSchema: editBriefShape,
      annotations: SAFE_WRITE,
    },
    async (input) => {
      const { jobId, ...patch } = input;
      return runTool(() =>
        apiPost(`/api/v1/jobs/${encodeURIComponent(jobId)}/brief`, patch)
      );
    }
  );

  server.registerTool(
    "approve_job",
    {
      title: "Approve job",
      description:
        "Approve a rendered job so it becomes publishable (draft_ready/awaiting_review/needs_changes -> approved) and revoke active review links.",
      inputSchema: { jobId: uuid("The job ID to approve") },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
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
        "Publish an APPROVED job to its connected social destination via the gated publish API. All production gates run (paid plan, ownership, abuse, QA, disclosure, destination, rights, moderation). For YouTube pass youtubePrivacyStatus:'private' for safe runs.",
      inputSchema: {
        jobId: uuid("The approved job to publish"),
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
      },
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
      inputSchema: {
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
      },
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
      inputSchema: {
        pairingId: uuid("The pairingId returned by connect_account"),
      },
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
