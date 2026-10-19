import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { announcementFiles } from "./announcement-source";

const framework = z.enum(["remotion", "hyperframes"]);
const text = (max: number) => z.string().trim().min(1).max(max);
const copyFields = { title: text(70), body: text(100), cta: text(40) };
const copySchema = z.object(copyFields).strict();
export const announcementProjectSchema = z
  .object({
    templateId: z.literal("announcement-card-v1"),
    framework,
    revision: z
      .number()
      .int()
      .min(1)
      .max(Number.MAX_SAFE_INTEGER - 1),
    copy: copySchema,
  })
  .strict();
export type AnnouncementProject = z.infer<typeof announcementProjectSchema>;
export const pairedAnnouncementInput = {
  framework: z
    .enum(["remotion", "hyperframes", "no-preference"])
    .optional()
    .describe(
      "Only supply an explicit user choice. Omit for an ambiguous request or to inherit the existing project framework."
    ),
  copy: copySchema.optional().describe("Accepted copy for a new project only."),
  project: announcementProjectSchema
    .optional()
    .describe(
      "The latest project document returned by this tool. Caller-held, not a saved hosted project."
    ),
  expectedRevision: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe(
      "Required with project. Must match its revision. This checks the supplied document, not a server-side stored version."
    ),
  edits: copySchema
    .partial()
    .optional()
    .describe(
      "Explicit copy edits to apply before switching. Other source or timeline edits cannot be preserved."
    ),
};
const inputSchema = z.object(pairedAnnouncementInput).strict();
export const PAIRED_ANNOUNCEMENT_CAPABILITY = {
  templateId: "announcement-card-v1",
  frameworks: ["remotion", "hyperframes"],
  tool: "prepare_announcement",
  dimensions: { width: 1280, height: 720, fps: 30, durationSeconds: 10 },
  scope:
    "One silent announcement card. Returns portable source and caller-held copy state; does not save or render. Only title, body and action survive switching.",
};
export const PAIRED_ANNOUNCEMENT_INSTRUCTIONS =
  "For the paired announcement-card-v1 or a HyperFrames announcement request, use prepare_announcement. Never infer a framework from creative wording. Omit framework unless the user explicitly chooses one or says no preference. If needs-selection, ask the user. Continue with the latest returned project and expectedRevision; apply edits through edits before switching. Keep the returned project document for later calls. Never describe this caller-held document as a saved hosted project. The existing VideoSpec catalogue remains Remotion-only.";

export function prepareAnnouncement(raw: unknown): Record<string, unknown> {
  const input = inputSchema.parse(raw);
  // Return only this bounded tool schema, not transport metadata or credentials.
  // JSON cloning preserves omitted fields and separates the receipt from output.
  const inputReceipt = {
    contract: "paired-announcement-input-receipt/v1",
    stage: "validated-input",
    normalizedInput: JSON.parse(JSON.stringify(input)) as z.infer<
      typeof inputSchema
    >,
  };
  const old = input.project;
  if (old && input.expectedRevision !== old.revision)
    throw new Error(
      "Supply the latest project document and its matching expectedRevision."
    );
  if (old && input.copy)
    throw new Error(
      "Use edits to change existing copy; do not replace it with new-project copy."
    );
  if (!old && (input.edits || input.expectedRevision !== undefined))
    throw new Error("Edits and expectedRevision require an existing project.");
  const selected =
    input.framework === "remotion" || input.framework === "hyperframes"
      ? input.framework
      : old?.framework ??
        (input.framework === "no-preference" ? "remotion" : undefined);
  if (!selected)
    return {
      inputReceipt,
      status: "needs-selection",
      options: ["remotion", "hyperframes", "no-preference"],
      message:
        "Which framework would you like: Remotion, HyperFrames, or no preference? No source was generated.",
    };
  if (!old && !input.copy)
    return {
      inputReceipt,
      status: "needs-copy",
      framework: selected,
      required: ["title", "body", "cta"],
    };
  const copy = copySchema.parse({
    ...(old?.copy ?? input.copy),
    ...input.edits,
  });
  const changed =
    old &&
    Object.keys(copyFields).some(
      (key) =>
        copy[key as keyof typeof copy] !== old.copy[key as keyof typeof copy]
    );
  const project: AnnouncementProject = {
    templateId: "announcement-card-v1",
    framework: selected,
    revision: (old?.revision ?? 1) + (changed ? 1 : 0),
    copy,
  };
  return {
    inputReceipt,
    status: "ready",
    reason:
      input.framework && input.framework !== "no-preference"
        ? "explicit"
        : old
        ? "existing-project"
        : "visible-default",
    project,
    files: {
      ...announcementFiles(project),
      "announcement.project.json": JSON.stringify(project, null, 2) + "\n",
    },
    commands: [
      "npm install",
      "npm run setup",
      ...(selected === "hyperframes"
        ? ["npx hyperframes check --samples 15 --strict"]
        : []),
      "npm run preview",
      "npm run render",
    ],
    instructions:
      "Save these files in a new directory. Install and setup download pinned dependencies and Instavar fonts; setup embeds fonts locally before rendering. Review preview frames before rendering. Keep announcement.project.json as the copy source of truth. This tool has not written files, saved a hosted project or rendered video. Regenerating source preserves only the three copy fields, not custom source edits.",
  };
}

export function registerPairedAnnouncement(
  server: Pick<McpServer, "registerTool">
): void {
  server.registerTool(
    "prepare_announcement",
    {
      title: "Prepare an announcement in Remotion or HyperFrames",
      description:
        "Prepare one paired announcement-card-v1 template, continue its caller-held project, edit copy or switch frameworks. Returns source files for local rendering. " +
        PAIRED_ANNOUNCEMENT_INSTRUCTIONS,
      inputSchema: pairedAnnouncementInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: { securitySchemes: [{ type: "noauth" }] },
    },
    async (args) => {
      try {
        const result = prepareAnnouncement(args);
        return {
          structuredContent: result,
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text:
                error instanceof Error
                  ? error.message
                  : "Invalid announcement input",
            },
          ],
        };
      }
    }
  );
}
