import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, runTool } from "./http";
import { createBriefShape, editBriefShape } from "./brief-schema";

const uuid = (desc: string) => z.string().uuid().describe(desc);

export function registerTools(server: McpServer): void {
  // ── Reads ──────────────────────────────────────────────────────────────

  server.tool(
    "list_jobs",
    "List recent video jobs for the current organization (newest first).",
    {
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
    async ({ limit, status }) => {
      const q = new URLSearchParams({ limit: String(limit) });
      if (status) q.set("status", status);
      return runTool(() => apiGet(`/api/v1/jobs?${q.toString()}`));
    }
  );

  server.tool(
    "get_job_status",
    "Get detailed status for a job: runs, artifacts, verifications, plus the current video and thumbnail URLs.",
    { jobId: uuid("The job ID to check") },
    async ({ jobId }) =>
      runTool(() => apiGet(`/api/v1/jobs/${encodeURIComponent(jobId)}`))
  );

  server.tool(
    "get_video_state",
    "Get the materialized video state for a job (composition decisions: scenes, duration, aspect ratio, etc.).",
    { jobId: uuid("The job ID") },
    async ({ jobId }) =>
      runTool(() =>
        apiGet(`/api/v1/jobs/${encodeURIComponent(jobId)}/video-state`)
      )
  );

  server.tool(
    "get_job_metrics",
    "Get the latest platform engagement metric snapshots for a published job (newest first). Read-only.",
    {
      jobId: uuid("The job ID"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .default(10)
        .describe("Max metric snapshots (default 10, max 20)"),
    },
    async ({ jobId, limit }) =>
      runTool(() =>
        apiGet(
          `/api/v1/jobs/${encodeURIComponent(jobId)}/metrics?limit=${limit}`
        )
      )
  );

  server.tool(
    "get_cost_summary",
    "Query production infrastructure costs (Lambda, RunPod, R2, WaveSpeed, PoYo), optionally with reconciliation drift.",
    {
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
    async ({ since, provider, groupBy, includeReconciliation }) => {
      const q = new URLSearchParams({ provider, groupBy });
      if (since) q.set("since", since);
      if (includeReconciliation) q.set("includeReconciliation", "true");
      return runTool(() => apiGet(`/api/v1/cost-summary?${q.toString()}`));
    }
  );

  // ── Writes ─────────────────────────────────────────────────────────────

  server.tool(
    "create_video_brief",
    "Create a new video job from a structured brief and trigger the render pipeline. Returns the job and run IDs.",
    createBriefShape,
    async (input) => runTool(() => apiPost(`/api/v1/jobs`, input))
  );

  server.tool(
    "edit_video_brief",
    "Edit an existing job's brief (only provided fields change) and trigger a re-render. Returns the new run ID.",
    editBriefShape,
    async (input) => {
      const { jobId, ...patch } = input;
      return runTool(() =>
        apiPost(`/api/v1/jobs/${encodeURIComponent(jobId)}/brief`, patch)
      );
    }
  );

  server.tool(
    "approve_job",
    "Approve a rendered job so it becomes publishable (draft_ready/awaiting_review/needs_changes -> approved) and revoke active review links.",
    { jobId: uuid("The job ID to approve") },
    async ({ jobId }) =>
      runTool(() =>
        apiPost(`/api/v1/jobs/${encodeURIComponent(jobId)}/approve`, {})
      )
  );

  server.tool(
    "publish_job",
    "Publish an APPROVED job to its connected social destination via the gated publish API. All production gates run (paid plan, ownership, abuse, QA, disclosure, destination, rights, moderation). For YouTube pass youtubePrivacyStatus:'private' for safe runs.",
    {
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
        .describe("Set true when the job requires an AI synthetic-media disclosure."),
      confirmQaOverride: z
        .boolean()
        .optional()
        .describe("Set true to override a non-passing QA gate."),
    },
    async ({ jobId, ...rest }) =>
      // NOTE: publish is NOT under /api/v1 — it is the gated /api/jobs route.
      runTool(() => apiPost(`/api/jobs/${encodeURIComponent(jobId)}/publish`, rest))
  );

  // ── Account connection (headless OAuth device-pairing) ───────────────────

  server.tool(
    "connect_account",
    "Start connecting a social account headlessly (no local browser needed). Returns an approve URL + a short confirm code: open the URL in a browser signed in to Instavar, check the code matches THIS terminal, and approve. Then poll connect_account_status with the returned pairingId until it reports 'connected'.",
    {
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
    async ({ provider }) =>
      runTool(() => apiPost(`/api/v1/connect/start`, { provider }))
  );

  server.tool(
    "connect_account_status",
    "Poll a pending account connection started by connect_account. Returns status 'pending' | 'connected' | 'expired', plus the connected account label once connected.",
    { pairingId: uuid("The pairingId returned by connect_account") },
    async ({ pairingId }) =>
      runTool(() =>
        apiGet(
          `/api/v1/connect/poll?pairingId=${encodeURIComponent(pairingId)}`
        )
      )
  );
}
