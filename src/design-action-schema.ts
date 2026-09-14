import { z } from "zod";

const id = z.string().min(1).max(120);
const point = z
  .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
  .strict();
const polygonShape = z
  .object({
    kind: z.literal("polygon"),
    points: z.array(point).min(3).max(512),
  })
  .strict();
const rasterShape = z
  .object({
    kind: z.literal("raster"),
    source: z
      .object({
        assetId: id,
        expectedSha256: z.string().regex(/^[a-f0-9]{64}$/),
        sourceRange: z
          .object({
            startFrame: z.number().int().nonnegative(),
            endFrame: z.number().int().positive(),
          })
          .strict()
          .optional(),
      })
      .strict(),
    widthPx: z.number().int().positive().max(8192),
    heightPx: z.number().int().positive().max(8192),
  })
  .strict();
const shape = z.discriminatedUnion("kind", [polygonShape, rasterShape]);
const mask = z
  .object({
    id,
    shape,
    operation: z.enum(["add", "subtract"]),
    inverted: z.boolean().default(false),
    feather: z.number().finite().nonnegative().max(0.25).default(0),
    allowedSupportMargin: z
      .number()
      .finite()
      .nonnegative()
      .max(0.25)
      .default(0),
    reviewState: z.enum(["draft", "approved", "rejected"]),
    provenance: z
      .object({
        kind: z.enum(["manual", "imported", "model-proposed"]),
        sourceAssetId: id.optional(),
        modelId: z.string().min(1).max(160).optional(),
      })
      .strict(),
  })
  .strict();
const transform = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
    rotationDegrees: z.number().min(-360).max(360),
    opacity: z.number().min(0).max(1),
  })
  .strict();
const colourParameters = {
  exposure: z.number().finite().min(-2).max(2).default(0),
  contrast: z.number().finite().min(0.5).max(2).default(1),
  saturation: z.number().finite().min(0).max(2).default(1),
  temperature: z.number().finite().min(-1).max(1).default(0),
  tint: z.number().finite().min(-1).max(1).default(0),
};
const effect = z
  .object({
    id,
    kind: z.literal("local-colour"),
    version: z.literal(1),
    maskId: id,
    ...colourParameters,
  })
  .strict();
const motionPath = z
  .object({
    id,
    kind: z.literal("cubic-bezier"),
    startFrame: z.number().int().nonnegative(),
    endFrame: z.number().int().positive(),
    start: point,
    control1: point,
    control2: point,
    end: point,
    easing: z.enum(["linear", "ease-in", "ease-out", "ease-in-out"]),
    orientToPath: z.boolean().default(false),
  })
  .strict();
const region = z
  .object({ id, shape, label: z.string().min(1).max(160) })
  .strict();
const base = { actionId: id, sceneId: id };

export const vendoredDesignActionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...base,
      kind: z.literal("set-layer-transform"),
      layerId: id,
      transform,
    })
    .strict(),
  z
    .object({
      ...base,
      kind: z.literal("set-local-colour-effect"),
      effectId: id,
      parameters: z.object(colourParameters).strict(),
    })
    .strict(),
  z.object({ ...base, kind: z.literal("create-mask"), mask }).strict(),
  z.object({ ...base, kind: z.literal("set-mask"), maskId: id, mask }).strict(),
  z
    .object({
      ...base,
      kind: z.literal("set-mask-review-state"),
      maskId: id,
      reviewState: z.enum(["draft", "approved", "rejected"]),
    })
    .strict(),
  z.object({ ...base, kind: z.literal("delete-mask"), maskId: id }).strict(),
  z
    .object({
      ...base,
      kind: z.literal("attach-effect"),
      effect,
      layerIds: z.array(id).min(1).max(50),
    })
    .strict(),
  z
    .object({ ...base, kind: z.literal("remove-effect"), effectId: id })
    .strict(),
  z
    .object({
      ...base,
      kind: z.literal("set-layer-text"),
      layerId: id,
      text: z.string().max(10_000),
    })
    .strict(),
  z
    .object({
      ...base,
      kind: z.literal("set-layer-visibility"),
      layerId: id,
      visible: z.boolean(),
    })
    .strict(),
  z
    .object({
      ...base,
      kind: z.literal("set-layer-locked"),
      layerId: id,
      locked: z.boolean(),
    })
    .strict(),
  z
    .object({
      ...base,
      kind: z.literal("set-layer-mask-ids"),
      layerId: id,
      maskIds: z.array(id).max(16),
    })
    .strict(),
  z
    .object({
      ...base,
      kind: z.literal("set-layer-order"),
      orderedLayerIds: z.array(id).min(1).max(500),
    })
    .strict(),
  z
    .object({
      ...base,
      kind: z.literal("set-motion-path"),
      path: motionPath,
      layerIds: z.array(id).max(50).default([]),
    })
    .strict(),
  z
    .object({ ...base, kind: z.literal("remove-motion-path"), pathId: id })
    .strict(),
  z
    .object({ ...base, kind: z.literal("set-protected-region"), region })
    .strict(),
  z
    .object({
      ...base,
      kind: z.literal("remove-protected-region"),
      regionId: id,
    })
    .strict(),
]);

export const inspectDesignDocumentToolSchema = z
  .object({
    projectId: z.string().uuid(),
    documentId: z.string().uuid(),
    includeVersions: z.boolean().default(true),
  })
  .strict();

export const applyDesignActionsToolSchema = z
  .object({
    projectId: z.string().uuid(),
    documentId: z.string().uuid(),
    actionGroupId: z.string().min(1).max(120),
    expectedVersion: z.number().int().positive(),
    actions: z.array(vendoredDesignActionSchema).min(1).max(50),
    clientCreatedAt: z.string().datetime(),
  })
  .strict();
