import { PAIRED_ANNOUNCEMENT_CAPABILITY } from "./paired-announcement";
import { registerPairedAnnouncement } from "./paired-announcement";
import {
  CREATIVE_GUIDE_INDEX,
  registerCreativeGuides,
} from "./creative-guides";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const TEMPLATE_REPOSITORY = "https://github.com/instavar/remotion-templates";
const TEMPLATE_ENDPOINT = "https://instavar.com/api/mcp/templates";
const VOICE_STUDIO_URL = "https://instavar.com/voice";
const templateIds = [
  "qa-ad",
  "proof-walkthrough",
  "announcement-brief",
  "social-remix",
  "finance-brief",
] as const;
const templateIdSchema = z.enum(templateIds);
const aspectSchema = z.enum(["9:16", "4:5", "1:1"]);
type TemplateId = (typeof templateIds)[number];
type Aspect = "9:16" | "4:5" | "1:1";

const templates = [
  {
    id: "qa-ad",
    name: "Question and answer ad",
    description:
      "A short video with a hook, source-video window, explanation points, and call to action.",
    aspects: ["9:16", "4:5", "1:1"],
  },
  {
    id: "proof-walkthrough",
    name: "Proof walkthrough",
    description:
      "A paced explanation for equations, worked reasoning, and a final takeaway.",
    aspects: ["9:16", "4:5", "1:1"],
  },
  {
    id: "announcement-brief",
    name: "Announcement brief",
    description:
      "A concise announcement with a headline, supporting points, optional media, and next action.",
    aspects: ["9:16", "4:5", "1:1"],
  },
  {
    id: "social-remix",
    name: "Social remix",
    description:
      "A caption-forward treatment that frames an existing clip with a hook, context, and call to action.",
    aspects: ["9:16", "4:5", "1:1"],
  },
  {
    id: "finance-brief",
    name: "Data and finance brief",
    description:
      "An editorial brief for comparisons, numeric highlights, evidence, caveats, and a recommendation.",
    aspects: ["9:16", "4:5", "1:1"],
  },
] as const;

const videoSpecSchema = {
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
    templateFamily: { enum: templateIds },
    meta: {
      type: "object",
      required: ["title"],
      properties: {
        title: { type: "string", minLength: 1 },
        description: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
      },
    },
    target: {
      type: "object",
      required: ["aspect", "fps", "durationMode"],
      properties: {
        aspect: { enum: ["9:16", "4:5", "1:1"] },
        fps: { type: "integer", minimum: 1 },
        durationMode: { enum: ["auto", "fixed"] },
        fixedDurationSec: { type: "number", exclusiveMinimum: 0 },
      },
    },
    audio: {
      type: "object",
      properties: {
        mode: { enum: ["auto", "narration", "music", "silent"] },
        narrationText: { type: "string" },
        narrationSrc: { type: "string" },
        narrationVolume: { type: "number", minimum: 0, maximum: 1 },
        musicSrc: { type: "string" },
        musicVolume: { type: "number", minimum: 0, maximum: 1 },
        ducking: { type: "boolean" },
        narrationTiming: {
          type: "object",
          required: ["schemaVersion", "source", "durationMs", "segments"],
          properties: {
            schemaVersion: { const: "1.0" },
            source: { const: "segmented-synthesis" },
            durationMs: { type: "integer", minimum: 1 },
            segments: {
              type: "array",
              minItems: 1,
              maxItems: 24,
              items: {
                type: "object",
                required: ["sceneId", "startMs", "endMs", "durationMs"],
                properties: {
                  sceneId: { type: "string", minLength: 1 },
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
    scenes: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
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
          timing: { type: "object" },
        },
      },
    },
    style: {
      type: "object",
      properties: {
        theme: {
          enum: ["default", "editorial-light", "editorial-dark", "clinical"],
        },
        variant: { type: "string" },
        safeAreaProfile: { enum: ["baseline", "metaSafe"] },
        showSceneLabels: { type: "boolean", default: false },
      },
    },
  },
} as const;

const annotations = {
  readOnlyHint: true,
  openWorldHint: false,
  destructiveHint: false,
} as const;

function result(
  value: Record<string, unknown>,
  summary: string
): CallToolResult {
  return {
    structuredContent: value,
    content: [{ type: "text", text: summary }],
  };
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return slug.length >= 3 ? slug : "new-video";
}

export function scaffoldVideoSpec(args: {
  templateId: TemplateId;
  title: string;
  aspect: Aspect;
  mediaSrc?: string;
}): Record<string, unknown> {
  const scenes: Record<string, unknown>[] = [
    {
      id: "hero",
      kind: "hero",
      content: {
        title: args.title,
        subtitle: "Replace with a concise promise",
      },
      timing: { durationMs: 4000 },
    },
  ];
  if (args.templateId === "qa-ad" || args.templateId === "social-remix") {
    scenes.push({
      id: "source-video",
      kind: "video-window",
      content: {
        title: "See it in context",
        src: args.mediaSrc ?? "public/replace-with-your-video.mp4",
      },
      timing: { durationMs: 7000 },
    });
  }
  if (args.templateId === "announcement-brief") {
    scenes.push(
      {
        id: "context",
        kind: "statement",
        content: {
          title: "Name the change",
          subtitle: "Explain why it matters in one sentence",
        },
        timing: { durationMs: 6000 },
      },
      {
        id: "mechanism",
        kind: "mechanism",
        content: {
          title: "Show how the change happens",
          before: "Before",
          after: "After",
        },
        timing: { durationMs: 7000 },
      },
      {
        id: "outcomes",
        kind: "points",
        content: {
          title: "What changes",
          points: ["First outcome", "Second outcome", "Third outcome"],
        },
        timing: { durationMs: 7000 },
      }
    );
  } else {
    scenes.push({
      id: args.templateId === "proof-walkthrough" ? "working" : "key-points",
      kind: args.templateId === "proof-walkthrough" ? "equation" : "points",
      content:
        args.templateId === "proof-walkthrough"
          ? {
              title: "Work through the idea",
              latexBlocks: ["x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}"],
            }
          : {
              title: "Key points",
              points: [
                "Replace with evidence",
                "Replace with explanation",
                "Replace with takeaway",
              ],
            },
      timing: { durationMs: 8000 },
    });
  }
  scenes.push({
    id: "cta",
    kind: "cta",
    content: { line1: "Replace with the next action" },
    timing: {
      durationMs: args.templateId === "announcement-brief" ? 6000 : 5000,
    },
  });
  return {
    schemaVersion: "1.0",
    id: slugify(args.title),
    templateFamily: args.templateId,
    meta: { title: args.title, tags: [] },
    target: { aspect: args.aspect, fps: 30, durationMode: "auto" },
    style: {
      theme:
        args.templateId === "announcement-brief"
          ? "editorial-light"
          : "default",
      variant: "default",
      safeAreaProfile: "metaSafe",
      showSceneLabels: false,
    },
    audio: {
      mode: "silent",
      narrationText: "",
      narrationVolume: 1,
      musicVolume: 0.16,
      ducking: true,
    },
    assets: {},
    scenes,
  };
}

export function registerPublicTemplateTools(server: McpServer): void {
  registerCreativeGuides(server);
  registerPairedAnnouncement(server);
  server.registerTool(
    "get_capabilities",
    {
      title: "Get video capabilities",
      description:
        "Call first. Reports free local features and optional account features.",
      inputSchema: {},
      annotations,
    },
    async () =>
      result(
        {
          authentication: "optional",
          apiKeyConfigured: Boolean(process.env.INSTAVAR_API_KEY?.trim()),
          repository: TEMPLATE_REPOSITORY,
          endpoint: TEMPLATE_ENDPOINT,
          creativeGuides: CREATIVE_GUIDE_INDEX,
          pairedAnnouncement: PAIRED_ANNOUNCEMENT_CAPABILITY,
          localFeatures: [
            "template discovery",
            "VideoSpec schema and examples",
            "deterministic scaffolding",
            "local render instructions",
            "render error diagnosis",
            "keyless on-device narration with scene timing",
            "every-scene preview frames",
            "post-render audible-audio verification",
          ],
          narration: {
            url: VOICE_STUDIO_URL,
            cost: "free",
            apiKeyRequired: false,
            guidance:
              "Write one paragraph per scene. Download the WAV and timing manifest, then apply both before rendering.",
          },
          accountFeatures: [
            "managed rendering and storage",
            "workflow review and approval",
            "social publishing and metrics",
          ],
        },
        process.env.INSTAVAR_API_KEY?.trim()
          ? "Free local tools and authenticated Instavar Studio tools are available."
          : "Free local tools are available. Add INSTAVAR_API_KEY to unlock hosted Studio tools."
      )
  );

  server.registerTool(
    "list_templates",
    {
      title: "List Remotion templates",
      description:
        "List public templates, optionally filtered by aspect ratio.",
      inputSchema: { aspect: aspectSchema.optional() },
      annotations,
    },
    async ({ aspect }) => {
      const filtered = aspect
        ? templates.filter((template) => template.aspects.includes(aspect))
        : templates;
      return result(
        { templates: filtered },
        filtered
          .map((template) => `${template.id}: ${template.description}`)
          .join("\n")
      );
    }
  );

  server.registerTool(
    "get_template",
    {
      title: "Get Remotion template",
      description: "Get one public template contract.",
      inputSchema: { templateId: templateIdSchema },
      annotations,
    },
    async ({ templateId }) => {
      const template = templates.find((item) => item.id === templateId);
      return result(
        { template },
        `${template?.name ?? templateId}\n${template?.description ?? ""}`
      );
    }
  );

  server.registerTool(
    "get_video_schema",
    {
      title: "Get VideoSpec schema",
      description: "Return the public VideoSpec JSON Schema.",
      inputSchema: {},
      annotations,
    },
    async () =>
      result(
        { schemaVersion: "1.0", jsonSchema: videoSpecSchema },
        "VideoSpec schema version 1.0."
      )
  );

  server.registerTool(
    "get_example",
    {
      title: "Get VideoSpec example",
      description: "Return a starter example for one template.",
      inputSchema: { templateId: templateIdSchema },
      annotations,
    },
    async ({ templateId }) =>
      result(
        {
          templateId,
          spec: scaffoldVideoSpec({
            templateId,
            title: `Example ${templateId}`,
            aspect: "9:16",
          }),
        },
        `Example VideoSpec for ${templateId}.`
      )
  );

  server.registerTool(
    "scaffold_video_spec",
    {
      title: "Scaffold VideoSpec",
      description:
        "Return a deterministic VideoSpec skeleton without writing files.",
      inputSchema: {
        templateId: templateIdSchema,
        title: z.string().min(1).max(160),
        aspect: aspectSchema.default("9:16"),
        mediaSrc: z.string().min(1).max(500).optional(),
      },
      annotations,
    },
    async (args) => {
      const spec = scaffoldVideoSpec(args);
      return result(
        { spec, filename: `${String(spec.id)}.video.json` },
        "Starter VideoSpec created. Replace placeholder copy and media."
      );
    }
  );

  server.registerTool(
    "get_render_instructions",
    {
      title: "Get local render instructions",
      description:
        "Return clone, install, validate, preview, and render commands.",
      inputSchema: {
        client: z.enum(["codex", "claude-code", "manual"]).default("manual"),
      },
      annotations,
    },
    async ({ client }) => {
      const commands = [
        `git clone ${TEMPLATE_REPOSITORY}.git`,
        "cd remotion-templates",
        "npm install",
        `# Generate one narration paragraph per scene at ${VOICE_STUDIO_URL}`,
        "npm run video:timing -- path/to/video.video.json --audio public/generated/narration.wav --manifest path/to/narration.timing.json",
        "npm run video:validate -- path/to/video.video.json",
        "npm run video:preview -- path/to/video.video.json",
        "npm run video:render -- path/to/video.video.json",
        "npm run video:qa -- path/to/video.video.json path/to/video.mp4",
      ];
      return result(
        { repository: TEMPLATE_REPOSITORY, client, commands },
        commands.join("\n")
      );
    }
  );

  server.registerTool(
    "diagnose_render_error",
    {
      title: "Diagnose render error",
      description: "Classify a local validation or render error.",
      inputSchema: { errorText: z.string().min(1).max(10_000) },
      annotations,
    },
    async ({ errorText }) => {
      const text = errorText.toLowerCase();
      const code =
        text.includes("enoent") || text.includes("not found")
          ? "missing-file"
          : text.includes("ffmpeg") || text.includes("codec")
          ? "media-codec"
          : text.includes("schema") ||
            text.includes("invalid") ||
            text.includes("zod")
          ? "invalid-video-spec"
          : text.includes("chrome") || text.includes("browser")
          ? "browser-runtime"
          : "unknown-render-error";
      return result(
        {
          code,
          nextStep:
            "Run validation first, confirm Node 22 or newer, and retry with the smallest included example.",
        },
        `Diagnosis: ${code}.`
      );
    }
  );
}
