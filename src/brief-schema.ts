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

export const REFERENCE_ROLES = [
  "identity",
  "appearance",
  "motion",
  "composition",
  "camera",
  "environment",
  "style",
] as const;

const optionalDirectionText = z.string().trim().min(1).max(500).optional();

export const visualDirectionSchema = z.object({
  communicationJob: optionalDirectionText,
  emotionalTarget: optionalDirectionText,
  attentionPath: z
    .object({
      first: optionalDirectionText,
      next: optionalDirectionText,
      proof: optionalDirectionText,
    })
    .optional(),
  visualLanguage: z
    .object({
      space: optionalDirectionText,
      line: optionalDirectionText,
      shape: optionalDirectionText,
      tone: optionalDirectionText,
      color: optionalDirectionText,
      movement: optionalDirectionText,
      rhythm: optionalDirectionText,
    })
    .optional(),
  camera: z
    .object({
      shotSize: optionalDirectionText,
      angle: optionalDirectionText,
      movement: optionalDirectionText,
      lens: optionalDirectionText,
    })
    .optional(),
});

export const generationContractSchema = z.object({
  globalInvariants: z
    .array(z.string().trim().min(1).max(300))
    .max(20)
    .optional(),
  shotDelta: z.string().trim().min(1).max(500).optional(),
  referenceBindings: z
    .array(
      z.object({
        assetId: z.string().trim().min(1).max(200),
        roles: z.array(z.enum(REFERENCE_ROLES)).min(1).max(7),
      })
    )
    .max(20)
    .optional(),
  prohibitedChanges: z
    .array(z.string().trim().min(1).max(300))
    .max(20)
    .optional(),
  reviewCriteria: z.array(z.string().trim().min(1).max(300)).max(20).optional(),
});

export const REGION_NAMES = [
  "background",
  "left-half",
  "right-half",
  "figure-center",
  "corner-inset",
  "lower-third",
] as const;

export const ASSET_ROLES = [
  "background",
  "figure",
  "inset",
  "lower-third",
  "diagram-node",
] as const;

export const assetSlotStyleSchema = z
  .object({
    opacity: z.number().min(0).max(1).optional(),
    fit: z.enum(["cover", "contain"]).optional(),
    z: z.number().optional(),
  })
  .strict();

export const assetSlotSchema = z
  .object({
    id: z.string().min(1),
    sceneId: z.string().min(1).optional(),
    region: z.enum(REGION_NAMES),
    role: z.enum(ASSET_ROLES),
    kind: z.enum(["image", "video"]),
    source: z.enum(["auto", "stock", "generate"]),
    intent: z.string(),
    style: assetSlotStyleSchema.optional(),
    timing: z
      .object({
        fromPct: z.number().min(0).max(1).optional(),
        toPct: z.number().min(0).max(1).optional(),
      })
      .strict()
      .optional(),
    url: z.string().url().optional(),
  })
  .strict();

export const briefStepSchema = z.object({
  label: z.string(),
  latex: z.string().optional(),
  explanation: z.string().optional(),
});

export const briefAudioLayerSchema = z.object({
  id: z.string().min(1),
  src: z.string().url(),
  startFrame: z.number().int().nonnegative().default(0),
  durationInFrames: z.number().int().positive().optional(),
  volume: z.number().min(0).max(1).default(1),
  fadeFrames: z.number().int().nonnegative().default(0),
  role: z.enum(["music", "foley", "transition", "effect"]),
});

export const protectedRegionEffectSchema = z
  .object({
    id: z.string().min(1).max(80),
    kind: z.literal("border-glint"),
    coordinateSpace: z.literal("output-frame-v1").default("output-frame-v1"),
    region: z.object({
      leftPercent: z.number().min(0).max(100),
      topPercent: z.number().min(0).max(100),
      widthPercent: z.number().positive().max(100),
      heightPercent: z.number().positive().max(100),
    }),
    startFrame: z.number().int().nonnegative().default(0),
    endFrame: z.number().int().positive(),
    speedUpFrame: z.number().int().nonnegative().optional(),
    color: z.string().max(64).default("#ffffff"),
    thicknessPercent: z.number().positive().max(20).default(3),
  })
  .superRefine((effect, context) => {
    if (effect.region.leftPercent + effect.region.widthPercent > 100) {
      context.addIssue({
        code: "custom",
        message: "Protected region exceeds the output frame width.",
        path: ["region", "widthPercent"],
      });
    }
    if (effect.region.topPercent + effect.region.heightPercent > 100) {
      context.addIssue({
        code: "custom",
        message: "Protected region exceeds the output frame height.",
        path: ["region", "heightPercent"],
      });
    }
    if (effect.endFrame <= effect.startFrame) {
      context.addIssue({
        code: "custom",
        message: "Effect endFrame must be after startFrame.",
        path: ["endFrame"],
      });
    }
    if (
      effect.speedUpFrame !== undefined &&
      (effect.speedUpFrame < effect.startFrame ||
        effect.speedUpFrame >= effect.endFrame)
    ) {
      context.addIssue({
        code: "custom",
        message: "speedUpFrame must fall inside the effect window.",
        path: ["speedUpFrame"],
      });
    }
  });

export const beatVisualRequestSchema = z
  .object({
    intent: z.string().trim().min(1).optional(),
    media: z.enum(["still", "motion"]).default("still"),
    source: z.enum(["auto", "stock", "generate"]).default("auto"),
  })
  .strict();

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
    "source-clip",
    "source-image",
    "route-card",
    "video-window",
    "image-window",
    "custom",
  ]),
  durationInFrames: z.number().optional(),
  narrationText: z.string().optional(),
  visualResolution: beatVisualRequestSchema.optional(),
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
  generationContract: generationContractSchema.optional(),
  trimStartSeconds: z.number().nonnegative().optional(),
  trimEndSeconds: z.number().positive().optional(),
  playbackRate: z.number().min(0.25).max(8).optional(),
  objectFit: z.enum(["cover", "contain"]).optional(),
  objectPosition: z.string().optional(),
  scaleFrom: z.number().min(0.5).max(2).optional(),
  scaleTo: z.number().min(0.5).max(2).optional(),
  panFromX: z.number().min(-50).max(50).optional(),
  panToX: z.number().min(-50).max(50).optional(),
  panFromY: z.number().min(-50).max(50).optional(),
  panToY: z.number().min(-50).max(50).optional(),
  routeFrom: z.string().optional(),
  routeTo: z.string().optional(),
  routeLabel: z.string().optional(),
  overlayKind: z.enum(["none", "hook", "stage", "end-card"]).optional(),
  overlayPosition: z.enum(["center", "top", "bottom"]).optional(),
  accentColor: z.string().optional(),
  overlayBackgroundColor: z.string().optional(),
  cutFlash: z.boolean().optional(),
  muted: z.boolean().optional(),
  protectedRegionEffects: z
    .array(protectedRegionEffectSchema)
    .max(4)
    .optional(),
  flashAtFrame: z.number().int().nonnegative().optional(),
  flashDurationFrames: z.number().int().positive().max(15).optional(),
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
  publishTargets: z
    .array(z.enum(PUBLISH_TARGETS))
    .max(9)
    .optional()
    .describe("All allowed social destinations for this video"),
  objective: z
    .enum(BRIEF_OBJECTIVES)
    .describe("Content objective (drives composition routing)"),
  targetDurationSeconds: z
    .number()
    .int()
    .min(5)
    .max(600)
    .optional()
    .describe("Requested final video duration in seconds"),
  narrationMode: z
    .enum(["tts", "off"])
    .optional()
    .describe("Disable synthesized narration for source-audio or silent work"),
  lessonTitle: z
    .string()
    .optional()
    .describe("Display title rendered inside the video"),
  visualDirection: visualDirectionSchema
    .optional()
    .describe(
      "Whole-video communication, attention, visual-language, and camera direction."
    ),
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
  assetSlots: z
    .array(assetSlotSchema)
    .optional()
    .describe(
      "Optional storyboard asset slots: region-placed image/video assets or placeholders attached to the whole video or a specific scene."
    ),
  audioLayers: z
    .array(briefAudioLayerSchema)
    .optional()
    .describe("Optional typed music, Foley, transition, and effect layers."),
};

/** Raw shape for edit_video_brief (jobId + the patchable brief fields). */
export const editBriefShape = {
  jobId: z.string().uuid().describe("The job to edit"),
  title: z.string().optional().describe("Updated title"),
  script: z.string().optional().describe("Updated narration script"),
  caption: z.string().optional().describe("Updated social caption"),
  lessonTitle: z.string().optional().describe("Updated lesson title"),
  narrationMode: z
    .enum(["tts", "off"])
    .optional()
    .describe("Updated synthesized narration mode"),
  visualDirection: visualDirectionSchema
    .optional()
    .describe("Updated whole-video visual direction"),
  steps: z
    .array(briefStepSchema)
    .optional()
    .describe("Updated steps (replaces the array)"),
  scenes: z
    .array(briefSceneSchema)
    .optional()
    .describe("Updated scenes (replaces the array)"),
  aspectRatio: z
    .enum(ASPECT_RATIOS)
    .optional()
    .describe("Updated aspect ratio"),
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
  publishTargets: z
    .array(z.enum(PUBLISH_TARGETS))
    .max(9)
    .optional()
    .describe("Replacement allowed social destination list"),
  targetDurationSeconds: z
    .number()
    .int()
    .min(5)
    .max(600)
    .optional()
    .describe("Updated final video duration in seconds"),
  voiceId: z
    .string()
    .optional()
    .describe(
      "Updated TTS narrator voice ID. Triggers a re-render with the new voice."
    ),
  assetSlots: z
    .array(assetSlotSchema)
    .optional()
    .describe(
      "Replacement storyboard asset slots. Omit to preserve existing slots; pass [] to clear them."
    ),
  audioLayers: z
    .array(briefAudioLayerSchema)
    .optional()
    .describe(
      "Replacement typed audio layers. Omit to preserve existing layers; pass [] to clear them."
    ),
};
