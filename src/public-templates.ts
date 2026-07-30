import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const TEMPLATE_REPOSITORY = "https://github.com/instavar/remotion-templates";
const TEMPLATE_ENDPOINT = "https://instavar.com/api/mcp/templates";
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
    },
  ];
  if (args.templateId === "qa-ad" || args.templateId === "social-remix") {
    scenes.push({
      id: "source-video",
      kind: "video-window",
      content: { src: args.mediaSrc ?? "public/replace-with-your-video.mp4" },
    });
  }
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
  });
  scenes.push({
    id: "cta",
    kind: "cta",
    content: { line1: "Replace with the next action" },
  });
  return {
    schemaVersion: "1.0",
    id: slugify(args.title),
    templateFamily: args.templateId,
    meta: { title: args.title, tags: [] },
    target: { aspect: args.aspect, fps: 30, durationMode: "auto" },
    style: {
      theme: "default",
      variant: "default",
      safeAreaProfile: "metaSafe",
    },
    audio: { ducking: true },
    assets: {},
    scenes,
  };
}

export function registerPublicTemplateTools(server: McpServer): void {
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
          localFeatures: [
            "template discovery",
            "VideoSpec schema and examples",
            "deterministic scaffolding",
            "local render instructions",
            "render error diagnosis",
          ],
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
        "npm run video:validate -- path/to/video.video.json",
        "npm run video:preview -- path/to/video.video.json",
        "npm run video:render -- path/to/video.video.json",
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
