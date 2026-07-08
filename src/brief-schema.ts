import { z } from "zod";

/**
 * Structured video-brief schemas for the create/edit tools. Vendored to match
 * the `/api/v1` create + edit contract (and lib/video/brief-input-schema.ts in
 * the app) verbatim so the HTTP path is behavior-preserving.
 */

export const PUBLISH_TARGETS = [
  "linkedin",
  "x",
  "threads",
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
  "rednote",
  "lemon8",
] as const;

export const BRIEF_OBJECTIVES = [
  "build_log",
  "product_update",
  "launch_update",
  "faq",
  "explainer",
  "customer_story",
  "directions",
  "other",
] as const;

export const ASPECT_RATIOS = ["9:16", "4:5", "1:1", "16:9"] as const;

export const briefStepSchema = z.object({
  label: z.string(),
  latex: z.string().optional(),
  explanation: z.string().optional(),
});

export const briefSceneSchema = z.object({
  type: z.enum([
    "hero",
    "points",
    "equation",
    "metric-bars",
    "metric-compare",
    "timeline",
    "limit-cards",
    "slide",
    "caption-overlay",
    "cta",
    "progress-ring",
    "metric-counter",
    "callout",
    "step-pill",
    "cta-pulse",
    "video-window",
    "custom",
  ]),
  durationInFrames: z.number().optional(),
  narrationText: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  text: z.string().optional(),
  points: z.array(z.string()).optional(),
  latex: z.string().optional(),
  value: z.union([z.string(), z.number()]).optional(),
  max: z.number().optional(),
  label: z.string().optional(),
  unit: z.string().optional(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  decimals: z.number().optional(),
  color: z.string().optional(),
  tone: z.string().optional(),
  iconKey: z.string().optional(),
  stepNumber: z.number().optional(),
  totalSteps: z.number().optional(),
  items: z.array(z.object({ label: z.string(), value: z.number() })).optional(),
  src: z.string().optional(),
  caption: z.string().optional(),
  // A-roll generation (video-window scenes): source "generate" triggers
  // flag-gated WaveSpeed image/video gen server-side from generatePrompt;
  // "url" (default) uses src as-is. Kept in sync with the app's
  // briefSceneSchema - see the parity test in the app suite.
  source: z.enum(["url", "generate"]).optional(),
  generatePrompt: z.string().optional(),
});

/**
 * DirectionsWalkthrough "find-us" payload. Vendored to match
 * lib/video/brief-input-schema.ts `directionsBriefSchema` verbatim. Cue
 * `atSeconds` is on the realtime walk timeline (the adapter remaps it onto the
 * sped-up on-screen frames).
 */
export const directionsBriefSchema = z.object({
  subtitle: z.string().optional(),
  unitLabel: z.string().optional(),
  distanceTimeChip: z.string().optional(),
  clips: z
    .array(
      z.object({
        src: z.string(),
        trimStartSeconds: z.number().optional(),
        trimEndSeconds: z.number(),
        speed: z.number().optional(),
        mirrorFlip: z.boolean().optional(),
      })
    )
    .min(1),
  cues: z.array(
    z.object({
      atSeconds: z.number(),
      text: z.string(),
      arrow: z.enum(["left", "right", "forward"]).optional(),
      step: z.number().optional(),
    })
  ),
  outro: z
    .object({
      heading: z.string().optional(),
      body: z.array(z.string()).optional(),
      seconds: z.number().optional(),
    })
    .optional(),
  music: z
    .object({
      perSegment: z
        .array(
          z.object({
            src: z.string(),
            clipIndexStart: z.number().optional(),
            hotOffsetSeconds: z.number().optional(),
            volume: z.number().optional(),
          })
        )
        .optional(),
      crossfadeSeconds: z.number().optional(),
    })
    .optional(),
});

/** Raw shape for create_video_brief (passed to McpServer.tool). */
export const createBriefShape = {
  title: z.string().min(1).max(120).describe("Short title (max 120 chars)"),
  script: z.string().min(1).describe("Full narration script (sent to TTS)"),
  caption: z
    .string()
    .min(1)
    .describe("Social caption with hooks, hashtags, CTA"),
  publishTarget: z.enum(PUBLISH_TARGETS).describe("Target social platform"),
  objective: z
    .enum(BRIEF_OBJECTIVES)
    .describe("Content objective (drives composition routing)"),
  lessonTitle: z
    .string()
    .optional()
    .describe("Display title rendered inside the video"),
  steps: z
    .array(briefStepSchema)
    .optional()
    .describe("Structured steps for educational content (LaTeX)"),
  scenes: z
    .array(briefSceneSchema)
    .optional()
    .describe("Scene graph for the UniversalVideo composition"),
  // No zod .default() here: a default would materialize into the parsed tool
  // arguments and relay to /api/v1/jobs as if the caller stated it, corrupting
  // the resolution provenance the API echoes back. Unset must stay absent;
  // the API re-applies 9:16 server-side.
  aspectRatio: z
    .enum(ASPECT_RATIOS)
    .optional()
    .describe("Aspect ratio (defaults to 9:16 when omitted)"),
  compositionId: z
    .string()
    .optional()
    .describe("Remotion composition ID override (advanced)"),
  voiceId: z
    .string()
    .optional()
    .describe(
      "TTS narrator voice ID. Unknown IDs are rejected before rendering; when omitted, the org's saved voice preference or the system default is used and reported in the response's resolution block."
    ),
  directions: directionsBriefSchema
    .optional()
    .describe(
      "DirectionsWalkthrough 'find-us' payload: source clips (legs), decision-point cues on the realtime walk timeline, outro, and optional music. Set compositionId 'DirectionsWalkthrough' (or objective 'directions')."
    ),
};

/** Raw shape for edit_video_brief (jobId + the patchable brief fields). */
export const editBriefShape = {
  jobId: z.string().uuid().describe("The job to edit"),
  title: z.string().optional().describe("Updated title"),
  script: z.string().optional().describe("Updated narration script"),
  caption: z.string().optional().describe("Updated social caption"),
  lessonTitle: z.string().optional().describe("Updated lesson title"),
  steps: z
    .array(briefStepSchema)
    .optional()
    .describe("Updated steps (replaces the array)"),
  scenes: z
    .array(briefSceneSchema)
    .optional()
    .describe("Updated scenes (replaces the array)"),
  aspectRatio: z.enum(ASPECT_RATIOS).optional().describe("Updated aspect ratio"),
  objective: z
    .enum(BRIEF_OBJECTIVES)
    .optional()
    .describe(
      "Updated content objective. Re-routes the composition and triggers a re-render."
    ),
  publishTarget: z
    .enum(PUBLISH_TARGETS)
    .optional()
    .describe(
      "Updated target social platform. Distribution metadata only - does not trigger a re-render."
    ),
  voiceId: z
    .string()
    .optional()
    .describe(
      "Updated TTS narrator voice ID. Triggers a re-render with the new voice."
    ),
};
