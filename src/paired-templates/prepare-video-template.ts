import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { contractForFamily, FRAMEWORKS, PAIRED_FAMILIES } from "./catalogue";
import { REMOTION_TEMPLATES } from "./remotion-videospec";
import { HYPERFRAMES_RUNTIME } from "./hyperframes-videospec";
import { PAIRED_FPS, PAIRED_VIDEOSPEC_CONTRACT } from "./videospec-contract";

/**
 * Exposure gate. On since the founder approved the paired catalogue on
 * 26 October 2026; INSTAVAR_PAIRED_TEMPLATES set to exactly "0" turns it off,
 * restoring the Remotion-only tool list, descriptions and outputs.
 */
export function pairedTemplatesEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return env.INSTAVAR_PAIRED_TEMPLATES !== "0";
}

export const PAIRED_TEMPLATE_CAPABILITY = {
  tool: "prepare_video_template",
  contract: PAIRED_VIDEOSPEC_CONTRACT,
  frameworks: FRAMEWORKS,
  families: PAIRED_FAMILIES.map((family) => family.id),
  fps: PAIRED_FPS,
  aspects: ["9:16", "4:5", "1:1"],
  realisations: {
    remotion: `${REMOTION_TEMPLATES.repository} at ${REMOTION_TEMPLATES.commit}`,
    hyperframes: `hyperframes ${HYPERFRAMES_RUNTIME.hyperframes} source generated from the same VideoSpec`,
  },
  scope:
    "One VideoSpec document, realised in either framework. Returns local source and commands; does not save, upload or render. Fields neither renderer honours are rejected, not dropped.",
};

export const PAIRED_TEMPLATE_INSTRUCTIONS =
  "For a VideoSpec template in Remotion or HyperFrames, use prepare_video_template with the VideoSpec. Never infer a framework from creative wording; omit framework unless the user chose one or said no preference, and ask the user on needs-selection. Continue with the returned project: edit project.spec, then call again to regenerate or to switch frameworks. A rejected field is unsupported in both frameworks; fix it rather than dropping it. The tool returns local source and commands; it does not render, save or upload.";

const framework = z.enum(["remotion", "hyperframes"]);
export const prepareVideoTemplateInput = {
  framework: z
    .enum(["remotion", "hyperframes", "no-preference"])
    .optional()
    .describe(
      "Only supply an explicit user choice. Omit for an ambiguous request or to inherit the existing project framework."
    ),
  spec: z
    .record(z.unknown())
    .optional()
    .describe("A VideoSpec 1.0 document for a new project."),
  project: z
    .object({
      contract: z.literal(PAIRED_VIDEOSPEC_CONTRACT),
      framework,
      spec: z.record(z.unknown()),
    })
    .strict()
    .optional()
    .describe(
      "The latest project returned by this tool, with any edits made to project.spec. Caller-held, not a saved hosted project."
    ),
};
const inputSchema = z.object(prepareVideoTemplateInput).strict();

export function prepareVideoTemplate(raw: unknown): {
  isError: boolean;
  result: Record<string, unknown>;
} {
  const input = inputSchema.parse(raw);
  if (input.spec && input.project)
    throw new Error(
      "Supply spec for a new project or project to continue one, not both."
    );
  const spec = input.project?.spec ?? input.spec;
  if (!spec)
    return {
      isError: false,
      result: {
        status: "needs-spec",
        message:
          "Supply a VideoSpec 1.0 document. Use scaffold_video_spec for a starting point.",
      },
    };
  const contract = contractForFamily(spec.templateFamily);
  if (!contract)
    return {
      isError: true,
      result: {
        status: "rejected",
        issues: [
          {
            path: "templateFamily",
            code: "unsupported-family",
            message: `Paired templates cover ${PAIRED_FAMILIES.map(
              (family) => family.id
            ).join(", ")}.`,
          },
        ],
      },
    };
  // Validation is framework-independent: the verdict is the same for both.
  const validated = contract.validate(spec);
  if (!validated.ok)
    return {
      isError: true,
      result: {
        status: "rejected",
        contract: contract.id,
        issues: validated.issues,
        message:
          "No source was generated. These fields are unsupported in both frameworks; change them and call again.",
      },
    };
  const selected =
    input.framework === "remotion" || input.framework === "hyperframes"
      ? input.framework
      : input.project?.framework ??
        (input.framework === "no-preference" ? "remotion" : undefined);
  if (!selected)
    return {
      isError: false,
      result: {
        status: "needs-selection",
        options: ["remotion", "hyperframes", "no-preference"],
        message:
          "Which framework would you like: Remotion, HyperFrames, or no preference? No source was generated.",
      },
    };
  const realisation = validated.realise(selected);
  return {
    isError: false,
    result: {
      status: "ready",
      reason:
        input.framework && input.framework !== "no-preference"
          ? "explicit"
          : input.project
          ? "existing-project"
          : "visible-default",
      project: {
        contract: contract.id,
        framework: selected,
        spec: validated.document,
      },
      timeline: validated.timeline,
      qualityNotes: validated.qualityNotes,
      runtime: realisation.runtime,
      files: realisation.files,
      commands: realisation.commands,
      instructions:
        "Save these files in a new directory and place each media file at the public/ path the spec names. The same preflight checks media for both frameworks. Equation blocks are shown as source text, not typeset. Keep project.spec as the content source of truth: regenerating or switching frameworks keeps only what the spec holds, not edits made to generated files. This tool has not written files, saved a hosted project or rendered video.",
    },
  };
}

export function registerPairedTemplates(
  server: Pick<McpServer, "registerTool">
): void {
  server.registerTool(
    "prepare_video_template",
    {
      title: "Prepare a template video in Remotion or HyperFrames",
      description:
        "Validate one VideoSpec against the paired template contract and return local source for the chosen framework, or switch an existing project's framework. " +
        PAIRED_TEMPLATE_INSTRUCTIONS,
      inputSchema: prepareVideoTemplateInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: { securitySchemes: [{ type: "noauth" }] },
    },
    async (args) => {
      try {
        const { isError, result } = prepareVideoTemplate(args);
        return {
          ...(isError ? { isError: true } : {}),
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
                  : "Invalid template input",
            },
          ],
        };
      }
    }
  );
}
