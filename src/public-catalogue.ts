import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { CAROUSEL_ARCHETYPES, getArchetype } from "./carousel/archetypes";
import { validateCarouselDeck } from "./carousel/deck-contract";
import { CREATIVE_GUIDE_INDEX } from "./creative-guides";
import { VIDEO_SPEC_JSON_SCHEMA } from "./videospec-json-schema";

/**
 * The account-free template tools shared by the npm package and the hosted
 * endpoint. Both surfaces register them from here, so names, input schemas,
 * descriptions and outputs cannot drift apart.
 */
export const TEMPLATE_REPOSITORY =
  "https://github.com/instavar/remotion-templates";
export const VOICE_STUDIO_URL = "https://instavar.com/voice";

export type PublicTemplateId =
  | "qa-ad"
  | "proof-walkthrough"
  | "announcement-brief"
  | "social-remix"
  | "finance-brief";
export type PublicCarouselTemplateId =
  | "listicle"
  | "manifesto"
  | "before-after"
  | "value-first-reveal";
type Aspect = "9:16" | "4:5" | "1:1";

export interface PublicVideoTemplate {
  id: PublicTemplateId;
  name: string;
  description: string;
  aspects: readonly Aspect[];
  requiredSceneKinds: readonly string[];
  optionalSceneKinds: readonly string[];
  exampleId: string;
}

export const PUBLIC_VIDEO_TEMPLATES: readonly PublicVideoTemplate[] = [
  {
    id: "qa-ad",
    name: "Question and answer ad",
    description:
      "Start with a question, then answer it with a clip and clear points.",
    aspects: ["9:16", "4:5", "1:1"],
    requiredSceneKinds: ["hero", "video-window", "cta"],
    optionalSceneKinds: ["points"],
    exampleId: "qa-ad-starter",
  },
  {
    id: "proof-walkthrough",
    name: "Proof walkthrough",
    description:
      "Explain a calculation or claim step by step, then end with the takeaway.",
    aspects: ["9:16", "4:5", "1:1"],
    requiredSceneKinds: ["hero", "equation"],
    optionalSceneKinds: ["points", "cta"],
    exampleId: "proof-walkthrough-starter",
  },
  {
    id: "announcement-brief",
    name: "Announcement brief",
    description:
      "Announce something new with a headline, proof, and next step.",
    aspects: ["9:16", "4:5", "1:1"],
    requiredSceneKinds: ["hero", "points"],
    optionalSceneKinds: ["statement", "mechanism", "video-window", "cta"],
    exampleId: "announcement-brief-starter",
  },
  {
    id: "social-remix",
    name: "Social remix",
    description: "Turn an existing clip into a caption-led social post.",
    aspects: ["9:16", "4:5", "1:1"],
    requiredSceneKinds: ["hero", "video-window", "cta"],
    optionalSceneKinds: ["points"],
    exampleId: "social-remix-starter",
  },
  {
    id: "finance-brief",
    name: "Data and finance brief",
    description:
      "Compare key numbers, show the evidence, and give a recommendation.",
    aspects: ["9:16", "4:5", "1:1"],
    requiredSceneKinds: ["hero", "points"],
    optionalSceneKinds: ["equation", "cta"],
    exampleId: "finance-brief-starter",
  },
];

export function findPublicTemplate(
  id: string
): PublicVideoTemplate | undefined {
  return PUBLIC_VIDEO_TEMPLATES.find((template) => template.id === id);
}

export const aspectSchema = z.enum(["9:16", "4:5", "1:1"]);
export const storyboardBriefSchema = z.string().min(8).max(600);
export const templateIdSchema = z.enum([
  "qa-ad",
  "proof-walkthrough",
  "announcement-brief",
  "social-remix",
  "finance-brief",
]);
// Planning metadata stays outside VideoSpec until hosted capability is confirmed.
export const acceptedDesignSchema = z.object({
  style: z.string().min(1).max(600),
  durationSeconds: z.number().positive().max(300),
  audio: z.enum(["silent", "narration", "music"]),
  illustration: z.string().min(1).max(600),
  exclusions: z.array(z.string().min(1).max(200)).max(20),
  preview: z.literal("dark-cafe").optional(),
});
export type AcceptedDesign = z.infer<typeof acceptedDesignSchema>;
export const carouselTemplateIdSchema = z.enum([
  "listicle",
  "manifesto",
  "before-after",
  "value-first-reveal",
]);

/**
 * A visual preview bound to accepted copy. Only the hosted planner widget can
 * show one, so the npm package passes none and omits acceptedPreview.
 */
export type AcceptedPreviewBuilder = (args: {
  title?: string;
  body?: string;
  cta?: string;
  aspect: string;
  acceptedDesign?: AcceptedDesign;
}) => unknown;

const PUBLIC_CAROUSEL_DECK_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Instavar CarouselDeck",
  type: "object",
  required: ["slides"],
  properties: {
    aspect: { enum: ["4:5", "1:1", "9:16"] },
    visualStyle: { enum: ["editorial", "native-photo"] },
    handle: { type: "string", maxLength: 40 },
    showPageNumber: { type: "boolean" },
    slides: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: {
        type: "object",
        required: ["kind"],
        properties: {
          kind: { enum: ["cover", "statement", "list", "takeaway"] },
          title: { type: "string" },
          statement: { type: "string" },
          subtitle: { type: "string" },
          accent: { type: "string" },
          footnote: { type: "string" },
          cta: { type: "string" },
          items: { type: "array", items: { type: "string" }, maxItems: 5 },
          image: {
            type: "object",
            required: ["src", "alt", "provenance"],
            properties: {
              src: { type: "string" },
              alt: { type: "string" },
              provenance: {
                enum: ["user-owned", "licensed-stock", "ai-generated"],
              },
            },
          },
        },
      },
    },
  },
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

// Off by default: with the paired catalogue off, every family is Remotion-only.
function withFrameworks<T extends object>(template: T, paired: boolean) {
  return paired
    ? { ...template, frameworks: ["remotion", "hyperframes"] as const }
    : template;
}

/**
 * The starter VideoSpec. Its scenes follow the public renderer's own scaffold
 * script; supplied body and CTA replace placeholders, and an announcement body
 * appears exactly once.
 */
export function scaffoldVideoSpec(
  args: {
    templateId: PublicTemplateId;
    title: string;
    aspect: Aspect;
    mediaSrc?: string;
    body?: string;
    cta?: string;
  },
  options: { pairedTemplates?: boolean } = {}
): Record<string, unknown> {
  const announcement = args.templateId === "announcement-brief";
  const scenes: Record<string, unknown>[] = [
    {
      id: "hero",
      kind: "hero",
      content: {
        title: args.title,
        ...(announcement && args.body
          ? {}
          : { subtitle: args.body ?? "Replace with a concise promise" }),
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
  if (announcement && args.body) {
    scenes.push({
      id: "key-points",
      kind: "points",
      content: { title: args.body, points: [] },
      timing: { durationMs: 7000 },
    });
  } else if (announcement) {
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
  } else if (args.templateId === "proof-walkthrough") {
    scenes.push({
      id: "working",
      kind: "equation",
      content: {
        title: "Work through the idea",
        latexBlocks: ["x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}"],
      },
      timing: { durationMs: 8000 },
    });
  } else {
    scenes.push({
      id: "key-points",
      kind: "points",
      content: args.body
        ? { title: args.body, points: [args.body] }
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
    content: { line1: args.cta ?? "Replace with the next action" },
    timing: { durationMs: announcement ? 6000 : 5000 },
  });
  return {
    schemaVersion: "1.0",
    id: slugify(args.title),
    templateFamily: args.templateId,
    meta: { title: args.title, tags: [] },
    target: { aspect: args.aspect, fps: 30, durationMode: "auto" },
    style: {
      theme: announcement ? "editorial-light" : "default",
      variant: "default",
      // Neither renderer applies metaSafe; the paired contract rejects it.
      safeAreaProfile: options.pairedTemplates ? "baseline" : "metaSafe",
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

type StoryboardKind =
  | "question-answer"
  | "procedure"
  | "announcement"
  | "source-remix"
  | "data-brief";

const HEALTH_OR_SAFETY_PATTERN =
  /\b(cpr|first aid|medical|medicine|medication|symptom|emergency|safety)\b/i;

function titleFromBrief(brief: string): string {
  const concise = brief
    .trim()
    .replace(
      /^(?:please\s+)?(?:make|create|show|teach|explain)\s+(?:me\s+)?(?:a\s+)?(?:video\s+)?(?:about\s+)?/i,
      ""
    )
    .replace(/^tell me\s+/i, "")
    .replace(/\s+/g, " ")
    .replace(/[.?!]+$/, "");
  if (!concise) return "A clear video";
  return concise.charAt(0).toUpperCase() + concise.slice(1);
}

function recommendStoryboardStructure(brief: string): {
  templateId: PublicTemplateId;
  kind: StoryboardKind;
} {
  const mediaIntent = brief.replace(
    /\b(?:no|without|avoid)\s+(?:(?:any|source|stock|automatic|supplied)\s+)?(?:clips?|footage|b-?roll)\b/gi,
    ""
  );
  if (/\b(clip|footage|reel|remix|repurpose)\b/i.test(mediaIntent)) {
    return { templateId: "social-remix", kind: "source-remix" };
  }
  if (
    /\b(data|numbers?|metric|finance|financial|compare|comparison)\b/i.test(
      brief
    )
  ) {
    return { templateId: "finance-brief", kind: "data-brief" };
  }
  if (/\b(announce(?:ment)?|launch|new|opening|release)\b/i.test(brief)) {
    return { templateId: "announcement-brief", kind: "announcement" };
  }
  if (
    /\b(how\s+to|how\s+do\s+(?:i|you|we)|steps?|step-by-step|recipe|cook|slice|chop|dice|peel|prepare|assemble|install|set\s+up|fold|tie)\b/i.test(
      brief
    )
  ) {
    return { templateId: "qa-ad", kind: "procedure" };
  }
  return { templateId: "qa-ad", kind: "question-answer" };
}

function storyboardFrames(args: {
  title: string;
  templateId: PublicTemplateId;
  kind: StoryboardKind;
}) {
  if (args.kind === "procedure" && args.templateId === "qa-ad") {
    return [
      [
        "Prepare the setup",
        "Show the tools, ingredients, and safe starting position.",
      ],
      [
        "Show the key action",
        "Use a close, readable view of the movement the viewer must copy.",
      ],
      [
        "Show the result",
        "End on the finished outcome and the one safety point to remember.",
      ],
    ].map(([title, purpose], index) => ({
      id: `beat-${index + 1}`,
      title,
      purpose,
      visualBrief: `${title} for ${args.title}. Editorial composition, one clear subject, generous negative space, no words, numbers, logos, or interface elements.`,
      alt: `${title}: a proposed visual beat for ${args.title}.`,
      asset: { kind: "image", state: "proposed" as const },
    }));
  }

  const frameCopy = {
    "qa-ad": [
      [
        "Open with the question",
        "Make the viewer recognise the problem or curiosity.",
      ],
      ["Show the answer", "Show the one idea that resolves it."],
      ["Leave one next step", "End with the takeaway the viewer can use."],
    ],
    "proof-walkthrough": [
      [
        "Set the scene",
        "Establish the ingredients, tools, or starting condition.",
      ],
      [
        "Show the essential move",
        "Show the central action in a close, readable moment.",
      ],
      [
        "Land the outcome",
        "Show the finished result and the one idea to remember.",
      ],
    ],
    "announcement-brief": [
      [
        "Lead with the news",
        "Make the new thing unmistakable at first glance.",
      ],
      ["Show the proof", "Show the detail that makes the announcement matter."],
      ["Give the next step", "End with a simple, concrete invitation."],
    ],
    "social-remix": [
      [
        "Find the strongest moment",
        "Open on the most recognisable moment in the supplied clip.",
      ],
      [
        "Add the context",
        "Use a second visual beat to make the point clear without stopping the clip.",
      ],
      [
        "End before it drags",
        "Leave one memorable line or image as the viewer scrolls on.",
      ],
    ],
    "finance-brief": [
      ["Name the decision", "Establish the question behind the numbers."],
      [
        "Make the evidence visible",
        "Show the comparison or trend as a simple visual fact.",
      ],
      [
        "State the recommendation",
        "End with the decision the evidence supports.",
      ],
    ],
  } as const;

  return frameCopy[args.templateId].map(([title, purpose], index) => ({
    id: `beat-${index + 1}`,
    title,
    purpose,
    visualBrief: `${title} for ${args.title}. Editorial composition, one clear subject, generous negative space, no words, numbers, logos, or interface elements.`,
    alt: `${title}: a proposed visual beat for ${args.title}.`,
    asset: { kind: "image", state: "proposed" as const },
  }));
}

export type StoryboardArgs = {
  brief: string;
  templateId?: PublicTemplateId;
  aspect: Aspect;
  title?: string;
  body?: string;
  cta?: string;
  acceptedDesign?: AcceptedDesign;
};

export function proposeVideoStoryboard(
  args: StoryboardArgs,
  acceptedPreview?: AcceptedPreviewBuilder
): Record<string, unknown> {
  const title = args.title ?? titleFromBrief(args.brief);
  const recommendation = recommendStoryboardStructure(args.brief);
  const templateId = args.templateId ?? recommendation.templateId;
  const kind = recommendation.kind;
  const template = findPublicTemplate(templateId)!;
  const reviewRequired = HEALTH_OR_SAFETY_PATTERN.test(args.brief);
  const isProcedure = kind === "procedure" && templateId === "qa-ad";
  return {
    version: "1.0",
    brief: args.brief.trim(),
    title,
    ...(args.body ? { body: args.body } : {}),
    ...(args.cta ? { cta: args.cta } : {}),
    aspect: args.aspect,
    ...(args.acceptedDesign
      ? {
          acceptedDesign: args.acceptedDesign,
          acceptedPreview: acceptedPreview?.({ ...args, title }),
        }
      : {}),
    template: {
      id: template.id,
      name: isProcedure ? "Visual how-to" : template.name,
      reason: isProcedure
        ? "Show a physical process as clear visual steps, then the usable outcome."
        : template.description,
      variant: isProcedure ? "procedural" : "default",
    },
    visualDirection: {
      communicationJob: "Make the subject and sequence clear at a glance.",
      style:
        args.acceptedDesign?.style ??
        "Editorial, minimal, and scene-led rather than text-led.",
      factualReviewRequired: reviewRequired,
    },
    frames: storyboardFrames({ title, templateId, kind }),
    imageGeneration: {
      state: "not-generated",
      notice:
        "These are visual briefs, not generated images. GPT-Image-2 drafts require an explicit, signed-in Studio generation step with cost and provenance controls.",
    },
  };
}

export function runProposeVideoStoryboardTool(
  args: StoryboardArgs,
  acceptedPreview?: AcceptedPreviewBuilder
): CallToolResult {
  const storyboard = proposeVideoStoryboard(args, acceptedPreview);
  return result(
    { storyboard },
    "A three-beat visual storyboard is ready. It is a proposal only: no images were generated, no project was saved, and no render was started."
  );
}

export function runListCarouselTemplatesTool(): CallToolResult {
  const templates = CAROUSEL_ARCHETYPES.map(({ id, label, blurb }) => ({
    id,
    name: label,
    description: blurb,
    defaultAspect: "4:5",
    visualStyle: "editorial",
  }));
  return result(
    { templates, creativeGuides: CREATIVE_GUIDE_INDEX },
    templates
      .map((template) => `${template.id}: ${template.description}`)
      .join("\n")
  );
}

export function runGetCarouselSchemaTool(): CallToolResult {
  return result(
    { schemaVersion: "1.0", jsonSchema: PUBLIC_CAROUSEL_DECK_JSON_SCHEMA },
    "CarouselDeck schema version 1.0. Text, branding, numbering, and layout remain deterministic."
  );
}

export function runScaffoldCarouselDeckTool(args: {
  templateId: PublicCarouselTemplateId;
  hook: string;
  points: string[];
  payoff: string;
  subtitle?: string;
  cta?: string;
  handle?: string;
  aspect: "4:5" | "1:1" | "9:16";
}): CallToolResult {
  const archetype = getArchetype(args.templateId);
  if (!archetype) {
    return {
      isError: true,
      content: [{ type: "text", text: "Unknown carousel template." }],
    };
  }
  const deck = archetype.build({
    hook: args.hook,
    subtitle: args.subtitle,
    points: args.points,
    payoff: args.payoff,
    cta: args.cta,
    handle: args.handle,
  });
  deck.aspect = args.aspect;
  const validation = validateCarouselDeck(deck);
  if (!validation.ok) {
    return {
      isError: true,
      structuredContent: { issues: validation.issues },
      content: [
        {
          type: "text",
          text: `Carousel deck is invalid: ${validation.issues.join("; ")}`,
        },
      ],
    };
  }
  return result(
    {
      schemaVersion: "1.0",
      templateId: args.templateId,
      deck,
      validation,
    },
    `A ${validation.slideCount}-slide ${args.templateId} deck is ready for local rendering. Review every claim and add only rights-cleared images.`
  );
}

export function runListTemplatesTool(
  args: { aspect?: Aspect },
  paired: boolean
): CallToolResult {
  const templates = args.aspect
    ? PUBLIC_VIDEO_TEMPLATES.filter((template) =>
        template.aspects.includes(args.aspect!)
      )
    : PUBLIC_VIDEO_TEMPLATES;
  return result(
    {
      templates: templates.map((template) =>
        withFrameworks({ ...template }, paired)
      ),
    },
    templates
      .map((template) => `${template.id}: ${template.description}`)
      .join("\n")
  );
}

export function runGetTemplateTool(
  args: { templateId: PublicTemplateId },
  paired: boolean
): CallToolResult {
  const template = findPublicTemplate(args.templateId);
  if (!template) {
    return {
      isError: true,
      content: [{ type: "text", text: "Unknown template." }],
    };
  }
  return result(
    { template: withFrameworks({ ...template }, paired) },
    `${template.name}\n${template.description}`
  );
}

export function runGetVideoSchemaTool(): CallToolResult {
  return result(
    { schemaVersion: "1.0", jsonSchema: VIDEO_SPEC_JSON_SCHEMA },
    "VideoSpec schema version 1.0. Use only published template and scene identifiers."
  );
}

export type ScaffoldToolArgs = {
  templateId: PublicTemplateId;
  title: string;
  brief?: string;
  aspect: Aspect;
  mediaSrc?: string;
  body?: string;
  cta?: string;
  acceptedDesign?: AcceptedDesign;
};

export function runScaffoldVideoSpecTool(
  args: ScaffoldToolArgs,
  paired: boolean,
  acceptedPreview?: AcceptedPreviewBuilder
): CallToolResult {
  const spec = scaffoldVideoSpec(args, { pairedTemplates: paired });
  return result(
    {
      spec,
      filename: `${String(spec.id)}.video.json`,
      planningContext: {
        brief: args.brief,
        title: args.title,
        body: args.body,
        cta: args.cta,
        aspect: args.aspect,
        templateId: args.templateId,
        acceptedDesign: args.acceptedDesign,
        acceptedPreview: acceptedPreview?.(args),
      },
    },
    `Starter VideoSpec created for ${args.templateId}. Replace placeholder copy and media before rendering.`
  );
}

export function runGetExampleTool(
  args: { templateId: PublicTemplateId },
  paired: boolean
): CallToolResult {
  const spec = scaffoldVideoSpec(
    {
      templateId: args.templateId,
      title: `Example ${args.templateId}`,
      aspect: "9:16",
    },
    { pairedTemplates: paired }
  );
  return result(
    { templateId: args.templateId, spec },
    `Example VideoSpec for ${args.templateId}.`
  );
}

export function runGetRenderInstructionsTool(args: {
  client: "codex" | "claude-code" | "manual";
}): CallToolResult {
  const commands = [
    `git clone ${TEMPLATE_REPOSITORY}.git`,
    "cd remotion-templates",
    "npm install",
    `# Generate narration at ${VOICE_STUDIO_URL}, with one paragraph per scene`,
    "npm run video:timing -- path/to/video.video.json --audio public/generated/narration.wav --manifest path/to/narration.timing.json",
    "npm run video:validate -- path/to/video.video.json",
    "npm run video:preview -- path/to/video.video.json",
    "npm run video:render -- path/to/video.video.json",
    "npm run video:qa -- path/to/video.video.json path/to/video.mp4",
  ];
  const guidance =
    args.client === "codex"
      ? "Ask Codex to clone the repository, read AGENTS.md and the make-video skill, author a VideoSpec, validate it, preview representative frames, and render only after validation passes."
      : args.client === "claude-code"
      ? "Ask Claude Code to clone the repository, read CLAUDE.md and the make-video skill, author a VideoSpec, validate it, preview representative frames, and render only after validation passes."
      : "Follow the repository README and run the commands in order.";
  return result(
    {
      repository: TEMPLATE_REPOSITORY,
      client: args.client,
      guidance,
      commands,
    },
    `${guidance}\n\n${commands.join("\n")}`
  );
}

export function runDiagnoseRenderErrorTool(args: {
  errorText: string;
}): CallToolResult {
  const text = args.errorText.toLowerCase();
  let diagnosis =
    "Run validation first, confirm Node 22 or newer, and retry with the smallest included example.";
  let code = "unknown-render-error";
  if (text.includes("enoent") || text.includes("not found")) {
    code = "missing-file";
    diagnosis =
      "A referenced spec, media, font, or asset path is missing. Resolve paths relative to the repository and confirm exact filename case.";
  } else if (text.includes("ffmpeg") || text.includes("codec")) {
    code = "media-codec";
    diagnosis =
      "The source media or local ffmpeg setup is incompatible. Probe the file, then transcode to H.264 video with AAC audio.";
  } else if (
    text.includes("schema") ||
    text.includes("invalid") ||
    text.includes("zod")
  ) {
    code = "invalid-video-spec";
    diagnosis =
      "The VideoSpec does not match schema version 1.0. Fetch get_video_schema and correct the reported field before rendering.";
  } else if (text.includes("chrome") || text.includes("browser")) {
    code = "browser-runtime";
    diagnosis =
      "Remotion could not start its browser runtime. Reinstall dependencies and follow the platform-specific browser setup in the repository README.";
  }
  return result(
    {
      code,
      diagnosis,
      nextStep: "Use get_render_instructions for the canonical local workflow.",
    },
    `${code}: ${diagnosis}`
  );
}

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  openWorldHint: false,
  destructiveHint: false,
} as const;

export const SHARED_TEMPLATE_TOOL_NAMES = [
  "list_carousel_templates",
  "get_carousel_schema",
  "scaffold_carousel_deck",
  "list_templates",
  "get_template",
  "get_video_schema",
  "get_example",
  "propose_video_storyboard",
  "scaffold_video_spec",
  "get_render_instructions",
  "diagnose_render_error",
] as const;
export type SharedTemplateToolName =
  (typeof SHARED_TEMPLATE_TOOL_NAMES)[number];

/**
 * Registers the shared account-free tools. `toolMeta` lets the hosted route
 * attach its ChatGPT widget metadata; it never changes inputs or outputs.
 */
export function registerSharedTemplateTools(
  server: Pick<McpServer, "registerTool">,
  options: {
    pairedTemplates: boolean;
    toolMeta?: (name: SharedTemplateToolName) => Record<string, unknown>;
    acceptedPreview?: AcceptedPreviewBuilder;
  }
): void {
  const paired = options.pairedTemplates;
  const meta = (name: SharedTemplateToolName) =>
    options.toolMeta ? { _meta: options.toolMeta(name) } : {};
  const catalogue = paired ? "video" : "Remotion";

  server.registerTool(
    "list_carousel_templates",
    {
      title: "List carousel templates",
      description: "List the account-free editorial carousel story structures.",
      inputSchema: {},
      annotations: {
        title: "List carousel templates",
        ...READ_ONLY_ANNOTATIONS,
      },
      ...meta("list_carousel_templates"),
    },
    async () => runListCarouselTemplatesTool()
  );

  server.registerTool(
    "get_carousel_schema",
    {
      title: "Get CarouselDeck schema",
      description:
        "Return the JSON Schema for deterministic Instavar carousel decks.",
      inputSchema: {},
      annotations: { title: "Get carousel schema", ...READ_ONLY_ANNOTATIONS },
      ...meta("get_carousel_schema"),
    },
    async () => runGetCarouselSchemaTool()
  );

  server.registerTool(
    "scaffold_carousel_deck",
    {
      title: "Scaffold carousel deck",
      description:
        "Build a deterministic editorial carousel deck from accepted copy. This does not render, save, or publish it.",
      inputSchema: {
        templateId: carouselTemplateIdSchema.describe(
          "Story structure from list_carousel_templates."
        ),
        hook: z
          .string()
          .min(1)
          .max(100)
          .describe("Cover line on the first slide."),
        subtitle: z
          .string()
          .min(1)
          .max(160)
          .optional()
          .describe("Optional cover subtitle under the hook."),
        points: z
          .array(z.string().min(1).max(120))
          .min(1)
          .max(5)
          .describe(
            "Body beats in order. listicle lists them on one slide, manifesto gives each its own slide, before-after uses the first as the problem and the last as the contrast, and value-first-reveal uses the first three."
          ),
        payoff: z
          .string()
          .min(1)
          .max(120)
          .describe("Closing takeaway on the final slide."),
        cta: z
          .string()
          .min(1)
          .max(140)
          .optional()
          .describe("Optional call to action on the final slide."),
        handle: z
          .string()
          .min(1)
          .max(40)
          .optional()
          .describe("Optional brand handle shown in the slide footer."),
        aspect: z
          .enum(["4:5", "1:1", "9:16"])
          .default("4:5")
          .describe("Slide aspect ratio. Defaults to 4:5."),
      },
      annotations: {
        title: "Scaffold carousel deck",
        ...READ_ONLY_ANNOTATIONS,
      },
      ...meta("scaffold_carousel_deck"),
    },
    async (args) => runScaffoldCarouselDeckTool(args)
  );

  server.registerTool(
    "list_templates",
    {
      title: `List ${catalogue} templates`,
      description: paired
        ? "List the published video template families, each available in Remotion and HyperFrames, and optionally filter by output aspect ratio."
        : "List the published Remotion template families and optionally filter by output aspect ratio.",
      inputSchema: {
        aspect: aspectSchema
          .optional()
          .describe(
            "Only list templates that support this aspect ratio. Omit to list them all."
          ),
      },
      annotations: { title: "List templates", ...READ_ONLY_ANNOTATIONS },
      ...meta("list_templates"),
    },
    async (args) => runListTemplatesTool(args, paired)
  );

  server.registerTool(
    "get_template",
    {
      title: `Get ${catalogue} template`,
      description:
        "Get one template's purpose, aspect ratios, scene kinds, and example identifier.",
      inputSchema: {
        templateId: templateIdSchema.describe(
          "Template family from list_templates."
        ),
      },
      annotations: { title: "Get template", ...READ_ONLY_ANNOTATIONS },
      ...meta("get_template"),
    },
    async (args) => runGetTemplateTool(args, paired)
  );

  server.registerTool(
    "get_video_schema",
    {
      title: "Get VideoSpec schema",
      description:
        "Return the published JSON Schema for VideoSpec version 1.0.",
      inputSchema: {},
      annotations: { title: "Get video schema", ...READ_ONLY_ANNOTATIONS },
      ...meta("get_video_schema"),
    },
    async () => runGetVideoSchemaTool()
  );

  server.registerTool(
    "get_example",
    {
      title: "Get VideoSpec example",
      description: "Return a valid starter example for one template family.",
      inputSchema: {
        templateId: templateIdSchema.describe(
          "Template family whose starter VideoSpec to return."
        ),
      },
      annotations: { title: "Get example", ...READ_ONLY_ANNOTATIONS },
      ...meta("get_example"),
    },
    async (args) => runGetExampleTool(args, paired)
  );

  server.registerTool(
    "propose_video_storyboard",
    {
      title: "Propose a video storyboard",
      description:
        "Turn an ordinary video request into a three-beat visual proposal and recommended template. Pass templateId to preserve an accepted template when changing only the aspect; omit it for a new direction. This tool does not generate images, save a project, render, or publish.",
      inputSchema: {
        brief: storyboardBriefSchema.describe(
          "The user's video request in their own words. It picks the recommended template and, without a title, the working title."
        ),
        templateId: templateIdSchema
          .optional()
          .describe(
            "Accepted template family to keep, for example when only the aspect changes. Omit for a new direction."
          ),
        title: z
          .string()
          .min(1)
          .max(160)
          .optional()
          .describe(
            "Accepted title, if the user supplied one. Omit to derive one from the brief."
          ),
        body: z
          .string()
          .min(1)
          .max(2000)
          .optional()
          .describe("Accepted body copy, kept exactly as supplied."),
        cta: z
          .string()
          .min(1)
          .max(500)
          .optional()
          .describe("Accepted call to action, kept exactly as supplied."),
        acceptedDesign: acceptedDesignSchema
          .optional()
          .describe(
            "The design the user accepted: style, duration in seconds, audio, illustration and exclusions. Pass it on to scaffold_video_spec and hosted tools."
          ),
        aspect: aspectSchema
          .default("9:16")
          .describe("Output aspect ratio. Defaults to 9:16."),
      },
      annotations: {
        title: "Propose video storyboard",
        ...READ_ONLY_ANNOTATIONS,
      },
      ...meta("propose_video_storyboard"),
    },
    async (args) => runProposeVideoStoryboardTool(args, options.acceptedPreview)
  );

  server.registerTool(
    "scaffold_video_spec",
    {
      title: "Scaffold VideoSpec",
      description:
        "Return a deterministic VideoSpec skeleton. This tool does not generate creative copy or write files.",
      inputSchema: {
        templateId: templateIdSchema.describe(
          "Template family from list_templates."
        ),
        title: z
          .string()
          .min(1)
          .max(160)
          .describe(
            "Video title, shown in the opening scene and used for the spec ID."
          ),
        brief: z
          .string()
          .min(1)
          .max(600)
          .optional()
          .describe(
            "Original intent and constraints to preserve through planning and handoff. This is not generated video copy."
          ),
        aspect: aspectSchema
          .default("9:16")
          .describe("Output aspect ratio. Defaults to 9:16."),
        mediaSrc: z
          .string()
          .min(1)
          .max(500)
          .optional()
          .describe(
            "Source video path for the video window in qa-ad and social-remix. Other templates ignore it; without it the spec holds a placeholder path."
          ),
        body: z
          .string()
          .min(1)
          .max(2000)
          .optional()
          .describe(
            "Accepted body copy. It replaces the placeholder copy and appears once."
          ),
        cta: z
          .string()
          .min(1)
          .max(500)
          .optional()
          .describe("Accepted call to action for the closing scene."),
        acceptedDesign: acceptedDesignSchema
          .optional()
          .describe(
            "The design the user accepted. Returned in planningContext for later steps; it does not change the VideoSpec."
          ),
      },
      annotations: { title: "Scaffold video spec", ...READ_ONLY_ANNOTATIONS },
      ...meta("scaffold_video_spec"),
    },
    async (args) =>
      runScaffoldVideoSpecTool(args, paired, options.acceptedPreview)
  );

  server.registerTool(
    "get_render_instructions",
    {
      title: "Get local render instructions",
      description:
        "Return the clone, install, validate, preview, render, and QA workflow.",
      inputSchema: {
        client: z
          .enum(["codex", "claude-code", "manual"])
          .default("manual")
          .describe(
            "Who will run the workflow. It changes only the guidance text. Defaults to manual."
          ),
      },
      annotations: {
        title: "Get render instructions",
        ...READ_ONLY_ANNOTATIONS,
      },
      ...meta("get_render_instructions"),
    },
    async (args) => runGetRenderInstructionsTool(args)
  );

  server.registerTool(
    "diagnose_render_error",
    {
      title: "Diagnose render error",
      description:
        "Classify a local validation or render error and return a safe next step.",
      inputSchema: {
        errorText: z
          .string()
          .min(1)
          .max(10_000)
          .describe("The validation or render error output to classify."),
      },
      annotations: { title: "Diagnose render error", ...READ_ONLY_ANNOTATIONS },
      ...meta("diagnose_render_error"),
    },
    async (args) => runDiagnoseRenderErrorTool(args)
  );
}
