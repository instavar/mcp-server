import { z } from "zod";

/**
 * Framework-independent content contract for the paired template catalogue.
 *
 * It is a strict profile of the public VideoSpec 1.0 used by
 * github.com/instavar/remotion-templates. A document that passes is valid
 * VideoSpec 1.0 and renders the same way in Remotion (the public templates)
 * and HyperFrames (hyperframes-videospec.ts). Fields that VideoSpec accepts
 * but neither renderer honours are rejected with a reason instead of being
 * dropped, so the framework stays a realisation choice.
 */
export const PAIRED_VIDEOSPEC_CONTRACT = "paired-videospec/v1";
export const PAIRED_TEMPLATE_FAMILIES = [
  "qa-ad",
  "proof-walkthrough",
  "announcement-brief",
  "social-remix",
  "finance-brief",
] as const;
export const PAIRED_SCENE_KINDS = [
  "hero",
  "statement",
  // The public renderer draws custom as a statement card; so does HyperFrames.
  "custom",
  "mechanism",
  "points",
  "equation",
  "video-window",
  "cta",
] as const;
// Whole frame rates HyperFrames 0.8.143 renders locally; Remotion takes any.
export const PAIRED_FPS = { min: 1, max: 240 } as const;
export const PAIRED_LIMITS = {
  scenes: 24,
  sceneDurationMs: 300_000,
  totalDurationMs: 20 * 60 * 1000,
} as const;

export type PairedFps = number;
export type PairedSceneKind = (typeof PAIRED_SCENE_KINDS)[number];
export type PairedIssue = { path: string; code: string; message: string };
export type QualityNote = {
  level: "warning" | "info";
  code: string;
  message: string;
};

const text = (max: number) =>
  z
    .string()
    .max(max)
    .refine((value) => value.trim().length > 0, "Must not be blank.");
// Media must be a local file the user places in public/, in both frameworks.
const mediaPath = (extensions: readonly string[]) =>
  z
    .string()
    .max(200)
    .refine(
      (value) =>
        /^public\/(?:[A-Za-z0-9_-][A-Za-z0-9._-]*\/)*[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(
          value
        ) &&
        !value.split("/").includes("..") &&
        extensions.some((extension) => value.toLowerCase().endsWith(extension)),
      `Use a local file under public/ ending in ${extensions.join(
        ", "
      )}. Remote URLs and other paths are not supported by the paired templates.`
    );
const videoPath = mediaPath([".mp4"]);
const audioPath = mediaPath([".wav", ".mp3", ".m4a"]);

const contentSchemas: Record<PairedSceneKind, z.ZodTypeAny> = {
  hero: z
    .object({
      title: text(160).optional(),
      line1: text(160).optional(),
      subtitle: text(400).optional(),
      line2: text(400).optional(),
      footer: text(120).optional(),
    })
    .strict(),
  statement: z
    .object({
      title: text(160).optional(),
      line1: text(160).optional(),
      subtitle: text(400).optional(),
      line2: text(400).optional(),
      label: text(60).optional(),
    })
    .strict(),
  custom: z
    .object({
      title: text(160).optional(),
      line1: text(160).optional(),
      subtitle: text(400).optional(),
      line2: text(400).optional(),
      label: text(60).optional(),
    })
    .strict(),
  // The public renderer reads only title here and invents copy for missing
  // before/after states, so all three are required.
  mechanism: z
    .object({
      title: text(160),
      subtitle: text(400).optional(),
      label: text(60).optional(),
      before: text(80),
      after: text(80),
    })
    .strict(),
  points: z
    .object({
      title: text(160).optional(),
      line1: text(160).optional(),
      subtitle: text(400).optional(),
      label: text(60).optional(),
      points: z.array(text(160)).max(8).default([]),
    })
    .strict(),
  equation: z
    .object({
      title: text(160),
      latexBlocks: z.array(text(400)).min(1).max(6),
    })
    .strict(),
  "video-window": z
    .object({
      title: text(160),
      src: videoPath,
    })
    .strict(),
  cta: z
    .object({
      title: text(160).optional(),
      line1: text(160).optional(),
      subtitle: text(400).optional(),
      line2: text(400).optional(),
    })
    .strict(),
};

const narrationTimingSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    source: z.literal("segmented-synthesis"),
    durationMs: z.number().int().positive().max(PAIRED_LIMITS.totalDurationMs),
    segments: z
      .array(
        z
          .object({
            sceneId: z.string().min(1).max(80),
            startMs: z.number().int().nonnegative(),
            endMs: z.number().int().positive(),
            durationMs: z.number().int().positive(),
          })
          .strict()
      )
      .min(1)
      .max(PAIRED_LIMITS.scenes),
  })
  .strict();

const sceneSchema = z
  .object({
    id: z.string().min(1).max(80),
    kind: z.string(),
    content: z.record(z.unknown()),
    timing: z
      .object({
        durationMs: z
          .number()
          .int()
          .positive()
          .max(PAIRED_LIMITS.sceneDurationMs)
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const specShape = z
  .object({
    schemaVersion: z.literal("1.0"),
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{2,80}$/),
    templateFamily: z.enum(PAIRED_TEMPLATE_FAMILIES),
    meta: z
      .object({
        title: z.string().min(1).max(160),
        description: z.string().max(500).optional(),
        tags: z.array(z.string().max(40)).max(20).default([]),
      })
      .strict(),
    target: z
      .object({
        aspect: z.enum(["9:16", "4:5", "1:1"]),
        fps: z.number().int().positive().default(30),
        durationMode: z.enum(["auto", "fixed"]).default("auto"),
        fixedDurationSec: z
          .number()
          .positive()
          .max(PAIRED_LIMITS.totalDurationMs / 1000)
          .optional(),
      })
      .strict(),
    style: z
      .object({
        theme: z
          .enum(["default", "editorial-light", "editorial-dark", "clinical"])
          .default("default"),
        variant: z.string().default("default"),
        safeAreaProfile: z.enum(["baseline", "metaSafe"]).default("baseline"),
        showSceneLabels: z.boolean().default(false),
      })
      .strict()
      .default({}),
    audio: z
      .object({
        mode: z.enum(["auto", "narration", "music", "silent"]).default("auto"),
        narrationText: z.string().max(10_000).optional(),
        narrationSrc: audioPath.optional(),
        narrationTiming: narrationTimingSchema.optional(),
        narrationVolume: z.number().min(0).max(1).default(1),
        musicSrc: audioPath.optional(),
        musicVolume: z.number().min(0).max(1).default(0.16),
        ducking: z.boolean().default(true),
      })
      .strict()
      .default({}),
    assets: z
      .object({
        logoSrc: z.string().optional(),
        posterSrc: z.string().optional(),
      })
      .strict()
      .default({}),
    scenes: z.array(sceneSchema).min(1).max(PAIRED_LIMITS.scenes),
  })
  .strict();

type SpecShape = z.infer<typeof specShape>;
export type PairedScene = {
  id: string;
  kind: PairedSceneKind;
  content: Record<string, unknown>;
  timing?: { durationMs?: number };
};
export type PairedVideoSpec = Omit<SpecShape, "scenes" | "target"> & {
  target: Omit<SpecShape["target"], "fps"> & { fps: PairedFps };
  scenes: PairedScene[];
};

export type TimelineScene = {
  index: number;
  id: string;
  kind: PairedSceneKind;
  startFrame: number;
  durationInFrames: number;
  /** Frames actually shown; the public renderer cuts scenes at the end. */
  visibleFrames: number;
};
export type PairedTimeline = {
  fps: PairedFps;
  width: number;
  height: number;
  durationInFrames: number;
  scenes: TimelineScene[];
};

export const DIMENSIONS = {
  "9:16": { width: 1080, height: 1920 },
  "4:5": { width: 1080, height: 1350 },
  "1:1": { width: 1080, height: 1080 },
} as const;

/** Mirrors remotion-templates sceneDurationMs and durationInFrames. */
export function pairedTimeline(spec: PairedVideoSpec): PairedTimeline {
  const fps = spec.target.fps;
  const sceneMs = (scene: PairedScene) =>
    spec.audio.narrationTiming?.segments.find(
      (segment) => segment.sceneId === scene.id
    )?.durationMs ??
    scene.timing?.durationMs ??
    3000;
  const totalMs = spec.scenes.reduce((sum, scene) => sum + sceneMs(scene), 0);
  const durationInFrames =
    spec.target.durationMode === "fixed" && spec.target.fixedDurationSec
      ? Math.max(1, Math.round(spec.target.fixedDurationSec * fps))
      : Math.max(1, Math.round((totalMs / 1000) * fps));
  let cursor = 0;
  const scenes = spec.scenes.map((scene, index) => {
    const frames = Math.max(1, Math.round((sceneMs(scene) / 1000) * fps));
    const startFrame = cursor;
    cursor += frames;
    return {
      index,
      id: scene.id,
      kind: scene.kind,
      startFrame,
      durationInFrames: frames,
      visibleFrames: Math.max(
        0,
        Math.min(frames, durationInFrames - startFrame)
      ),
    };
  });
  return { fps, ...DIMENSIONS[spec.target.aspect], durationInFrames, scenes };
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Port of remotion-templates src/quality.ts. Errors block both frameworks. */
function qualityReview(spec: PairedVideoSpec): {
  errors: PairedIssue[];
  notes: QualityNote[];
} {
  const errors: PairedIssue[] = [];
  const notes: QualityNote[] = [];
  spec.scenes.forEach((scene, index) => {
    if (scene.kind === "custom")
      notes.push({
        level: "warning",
        code: "custom-renders-as-statement",
        message: `Scene ${
          index + 1
        } is custom. Both frameworks draw it as a statement card; no custom code runs.`,
      });
  });
  const audio = spec.audio;
  const audible =
    audio.mode === "narration" ||
    audio.mode === "music" ||
    (audio.mode === "auto" && Boolean(audio.narrationSrc || audio.musicSrc));
  if (audio.mode === "narration" && !audio.narrationSrc)
    errors.push({
      path: "audio.narrationSrc",
      code: "narration-source-missing",
      message:
        "audio.mode is narration, but audio.narrationSrc is missing. Add an existing audio file.",
    });
  if (audio.mode === "music" && !audio.musicSrc)
    errors.push({
      path: "audio.musicSrc",
      code: "music-source-missing",
      message: "audio.mode is music, but audio.musicSrc is missing.",
    });
  if (audio.narrationText && !audio.narrationSrc) {
    if (audio.mode === "silent")
      notes.push({
        level: "warning",
        code: "narration-text-not-rendered",
        message:
          "Narration text exists without narrationSrc. Written narration is not audible until audio is generated or attached.",
      });
    else
      errors.push({
        path: "audio.narrationText",
        code: "narration-text-not-rendered",
        message:
          "Narration text exists without narrationSrc. Written narration is not audible until audio is generated or attached.",
      });
  }
  if (audio.narrationTiming) {
    const ids = spec.scenes.map((scene) => scene.id);
    const timed = audio.narrationTiming.segments.map((item) => item.sceneId);
    if (
      ids.length !== timed.length ||
      ids.some((id, index) => timed[index] !== id)
    )
      errors.push({
        path: "audio.narrationTiming.segments",
        code: "narration-timing-scene-mismatch",
        message:
          "Narration timing must contain exactly one ordered segment for every scene.",
      });
  }
  if (!audible)
    notes.push({
      level: "info",
      code: "intentional-silence",
      message:
        "No audible audio is configured. Set audio.mode to silent only when this is intentional.",
    });
  if (spec.style.showSceneLabels)
    notes.push({
      level: "warning",
      code: "debug-labels-visible",
      message:
        "Scene-kind labels are visible. Keep showSceneLabels false for audience-facing renders.",
    });
  spec.scenes.forEach((scene, index) => {
    const title =
      stringValue(scene.content.title) || stringValue(scene.content.line1);
    const label = stringValue(scene.content.label);
    const at = `scenes.${index}`;
    if (!title)
      errors.push({
        path: `${at}.content.title`,
        code: "scene-title-missing",
        message: `Scene ${index + 1} (${scene.id}) has no title or line1.`,
      });
    if (title.length > 82)
      notes.push({
        level: "warning",
        code: "headline-too-long",
        message: `Scene ${index + 1} headline has ${
          title.length
        } characters. Prefer 82 or fewer.`,
      });
    if (title.length >= 12 && title === title.toUpperCase())
      notes.push({
        level: "warning",
        code: "all-caps-headline",
        message: `Scene ${
          index + 1
        } uses an all-caps headline. Use sentence case for editorial hierarchy.`,
      });
    if (label && label === label.toUpperCase())
      notes.push({
        level: "warning",
        code: "all-caps-label",
        message: `Scene ${
          index + 1
        } uses an all-caps label. Remove it or use sentence case only when it adds meaning.`,
      });
    if (
      label &&
      ["hero", "custom", "points", "cta"].includes(label.toLowerCase())
    )
      errors.push({
        path: `${at}.content.label`,
        code: "implementation-label",
        message: `Scene ${
          index + 1
        } exposes the implementation label "${label}". Remove it from audience-facing copy.`,
      });
    const points = Array.isArray(scene.content.points)
      ? (scene.content.points as string[])
      : [];
    if (points.length > 4)
      notes.push({
        level: "warning",
        code: "too-many-points",
        message: `Scene ${index + 1} has ${
          points.length
        } points. Prefer four or fewer.`,
      });
    if (points.some((point) => point.length > 58))
      notes.push({
        level: "warning",
        code: "point-too-long",
        message: `Scene ${
          index + 1
        } contains a point longer than 58 characters.`,
      });
  });
  const kinds = new Set(spec.scenes.map((scene) => scene.kind));
  if (spec.scenes.length >= 4 && kinds.size < 3)
    notes.push({
      level: "warning",
      code: "weak-scene-differentiation",
      message:
        "Four or more scenes use fewer than three layout kinds. Add visual structure instead of repeating text slides.",
    });
  return { errors, notes };
}

function zodIssues(error: z.ZodError, prefix = ""): PairedIssue[] {
  return error.issues.map((issue) => ({
    path: [prefix, ...issue.path.map(String)].filter(Boolean).join("."),
    code:
      issue.code === "unrecognized_keys"
        ? "unsupported-field"
        : "invalid-videospec",
    message:
      issue.code === "unrecognized_keys"
        ? `${issue.message}. Neither paired renderer reads these fields; remove them rather than expecting them to render.`
        : issue.message,
  }));
}

export type PairedValidation =
  | {
      ok: true;
      spec: PairedVideoSpec;
      timeline: PairedTimeline;
      qualityNotes: QualityNote[];
    }
  | { ok: false; issues: PairedIssue[] };

/**
 * Validate a VideoSpec for the paired catalogue. The same verdict applies to
 * both frameworks; nothing here depends on the requested framework.
 */
export function validatePairedVideoSpec(raw: unknown): PairedValidation {
  const parsed = specShape.safeParse(raw);
  if (!parsed.success) return { ok: false, issues: zodIssues(parsed.error) };
  const shape = parsed.data;
  const issues: PairedIssue[] = [];
  const reject = (path: string, code: string, message: string) =>
    issues.push({ path, code, message });

  if (shape.target.fps > PAIRED_FPS.max)
    reject(
      "target.fps",
      "unsupported-fps",
      `Paired templates render at whole frame rates from ${PAIRED_FPS.min} to ${PAIRED_FPS.max} fps, the range the HyperFrames renderer accepts.`
    );
  if (shape.target.durationMode === "fixed" && !shape.target.fixedDurationSec)
    reject(
      "target.fixedDurationSec",
      "fixed-duration-missing",
      "durationMode fixed needs fixedDurationSec; the public renderer would otherwise fall back to automatic duration."
    );
  if (shape.target.durationMode === "auto" && shape.target.fixedDurationSec)
    reject(
      "target.fixedDurationSec",
      "fixed-duration-unused",
      "fixedDurationSec is ignored unless durationMode is fixed. Remove it or set durationMode to fixed."
    );
  if (shape.style.variant !== "default")
    reject(
      "style.variant",
      "unsupported-style-variant",
      "Only the default variant exists. The public renderer ignores other variant values."
    );
  if (shape.style.safeAreaProfile !== "baseline")
    reject(
      "style.safeAreaProfile",
      "unsupported-safe-area",
      "Neither renderer applies a metaSafe layout; it renders exactly like baseline. Set baseline so the document does not promise safe-area handling."
    );
  for (const key of ["logoSrc", "posterSrc"] as const)
    if (shape.assets[key] !== undefined)
      reject(
        `assets.${key}`,
        "unsupported-asset",
        `assets.${key} is not rendered by either framework. Remove it.`
      );
  // Same integrity rules as the public NarrationTimingManifestSchema, so a
  // document never passes here and then fails in the Remotion templates.
  const narrationTiming = shape.audio.narrationTiming;
  if (narrationTiming) {
    let previousEnd = 0;
    const timedIds = new Set<string>();
    narrationTiming.segments.forEach((segment, index) => {
      const at = `audio.narrationTiming.segments.${index}`;
      if (timedIds.has(segment.sceneId))
        reject(
          `${at}.sceneId`,
          "invalid-videospec",
          "Narration timing scene IDs must be unique."
        );
      timedIds.add(segment.sceneId);
      if (segment.startMs !== previousEnd)
        reject(
          `${at}.startMs`,
          "invalid-videospec",
          "Narration timing segments must be contiguous."
        );
      if (segment.durationMs !== segment.endMs - segment.startMs)
        reject(
          `${at}.durationMs`,
          "invalid-videospec",
          "Narration timing duration must equal endMs minus startMs."
        );
      previousEnd = segment.endMs;
    });
    if (previousEnd !== narrationTiming.durationMs)
      reject(
        "audio.narrationTiming.durationMs",
        "invalid-videospec",
        "Narration timing duration must end with the final segment."
      );
  }
  if (
    shape.audio.mode === "silent" &&
    (shape.audio.narrationSrc || shape.audio.musicSrc)
  )
    reject(
      "audio.mode",
      "audio-mode-conflict",
      "audio.mode is silent, but an audio source is set and would still play. Remove the source or change the mode."
    );

  const ids = new Set<string>();
  const scenes: PairedScene[] = [];
  shape.scenes.forEach((scene, index) => {
    const at = `scenes.${index}`;
    if (ids.has(scene.id))
      reject(`${at}.id`, "duplicate-scene-id", "Scene IDs must be unique.");
    ids.add(scene.id);
    if (!(PAIRED_SCENE_KINDS as readonly string[]).includes(scene.kind)) {
      reject(
        `${at}.kind`,
        "invalid-videospec",
        `Unknown scene kind ${JSON.stringify(scene.kind)}.`
      );
      return;
    }
    const kind = scene.kind as PairedSceneKind;
    const content = contentSchemas[kind].safeParse(scene.content);
    if (!content.success) {
      issues.push(...zodIssues(content.error, `${at}.content`));
      return;
    }
    const value = content.data as Record<string, unknown>;
    for (const [first, second] of [
      ["title", "line1"],
      ["subtitle", "line2"],
    ])
      if (value[first] !== undefined && value[second] !== undefined)
        reject(
          `${at}.content.${second}`,
          "ambiguous-copy-field",
          `Supply ${first} or ${second}, not both; the renderer shows only ${first}.`
        );
    if (kind === "equation") {
      const blocks = value.latexBlocks as string[];
      if (new Set(blocks).size !== blocks.length)
        reject(
          `${at}.content.latexBlocks`,
          "duplicate-equation",
          "Equation blocks must be unique."
        );
    }
    scenes.push({ ...scene, kind, content: value });
  });
  if (issues.length) return { ok: false, issues };

  const spec = { ...shape, scenes } as PairedVideoSpec;
  const quality = qualityReview(spec);
  issues.push(...quality.errors);
  const timeline = pairedTimeline(spec);
  const sceneFrames = timeline.scenes.reduce(
    (sum, scene) => sum + scene.durationInFrames,
    0
  );
  if (
    timeline.durationInFrames / timeline.fps >
    PAIRED_LIMITS.totalDurationMs / 1000
  )
    reject(
      "scenes",
      "duration-too-long",
      "Paired templates are limited to 20 minutes."
    );
  if (
    spec.target.durationMode === "fixed" &&
    timeline.durationInFrames < sceneFrames
  )
    reject(
      "target.fixedDurationSec",
      "fixed-duration-truncates",
      `fixedDurationSec gives ${timeline.durationInFrames} frames but the scenes need ${sceneFrames}; later scenes would be cut off.`
    );
  const hidden = timeline.scenes.find((scene) => scene.visibleFrames === 0);
  if (hidden)
    reject(
      `scenes.${hidden.index}.timing`,
      "scene-not-visible",
      "Frame rounding leaves this scene no visible frames. Lengthen the scene durations."
    );
  if (issues.length) return { ok: false, issues };
  return { ok: true, spec, timeline, qualityNotes: quality.notes };
}
