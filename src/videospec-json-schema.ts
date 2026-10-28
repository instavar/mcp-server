/**
 * The one advertised VideoSpec 1.0 JSON Schema for the npm package and the
 * hosted template MCP. It describes remotion-templates src/schema.ts at
 * f294daf. The two surfaces previously kept separate copies that disagreed:
 * the hosted copy omitted the statement and mechanism scene kinds, the audio
 * volumes and showSceneLabels, and the npm copy omitted assets, which its own
 * scaffold emits.
 */
export const VIDEO_SPEC_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://instavar.com/schemas/video-spec-1.0.json",
  title: "Instavar VideoSpec",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "id",
    "templateFamily",
    "meta",
    "target",
    "scenes",
  ],
  properties: {
    schemaVersion: { const: "1.0" },
    id: { type: "string", pattern: "^[a-z0-9][a-z0-9-]{2,80}$" },
    templateFamily: {
      enum: [
        "qa-ad",
        "proof-walkthrough",
        "announcement-brief",
        "social-remix",
        "finance-brief",
      ],
    },
    meta: {
      type: "object",
      additionalProperties: false,
      required: ["title"],
      properties: {
        title: { type: "string", minLength: 1 },
        description: { type: "string" },
        tags: { type: "array", items: { type: "string" }, default: [] },
      },
    },
    target: {
      type: "object",
      additionalProperties: false,
      required: ["aspect"],
      properties: {
        aspect: { enum: ["9:16", "4:5", "1:1"] },
        fps: { type: "integer", minimum: 1, default: 30 },
        durationMode: { enum: ["auto", "fixed"], default: "auto" },
        fixedDurationSec: { type: "number", exclusiveMinimum: 0 },
      },
    },
    style: {
      type: "object",
      additionalProperties: false,
      properties: {
        theme: {
          enum: ["default", "editorial-light", "editorial-dark", "clinical"],
          default: "default",
        },
        variant: { type: "string", default: "default" },
        safeAreaProfile: {
          enum: ["baseline", "metaSafe"],
          default: "baseline",
        },
        showSceneLabels: { type: "boolean", default: false },
      },
    },
    audio: {
      type: "object",
      additionalProperties: false,
      properties: {
        mode: {
          enum: ["auto", "narration", "music", "silent"],
          default: "auto",
        },
        narrationText: { type: "string" },
        narrationSrc: { type: "string" },
        narrationVolume: {
          type: "number",
          minimum: 0,
          maximum: 1,
          default: 1,
        },
        musicSrc: { type: "string" },
        musicVolume: {
          type: "number",
          minimum: 0,
          maximum: 1,
          default: 0.16,
        },
        ducking: { type: "boolean", default: true },
        narrationTiming: {
          type: "object",
          additionalProperties: false,
          required: ["schemaVersion", "source", "durationMs", "segments"],
          properties: {
            schemaVersion: { const: "1.0" },
            source: { const: "segmented-synthesis" },
            durationMs: { type: "integer", minimum: 1, maximum: 1_200_000 },
            segments: {
              type: "array",
              minItems: 1,
              maxItems: 24,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["sceneId", "startMs", "endMs", "durationMs"],
                properties: {
                  sceneId: { type: "string", minLength: 1, maxLength: 80 },
                  startMs: { type: "integer", minimum: 0 },
                  endMs: { type: "integer", minimum: 1 },
                  durationMs: { type: "integer", minimum: 1 },
                },
              },
            },
          },
        },
      },
    },
    assets: {
      type: "object",
      additionalProperties: false,
      properties: {
        logoSrc: { type: "string" },
        posterSrc: { type: "string" },
      },
    },
    scenes: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "kind", "content"],
        properties: {
          id: { type: "string", minLength: 1 },
          kind: {
            enum: [
              "hero",
              "statement",
              "mechanism",
              "points",
              "equation",
              "video-window",
              "cta",
              "custom",
            ],
          },
          content: { type: "object" },
          timing: {
            type: "object",
            additionalProperties: false,
            properties: {
              durationMs: { type: "integer", exclusiveMinimum: 0 },
            },
          },
        },
      },
    },
  },
} as const;
