import type {
  McpServer,
  ReadResourceCallback,
  ResourceMetadata,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CREATIVE_GUIDES } from "./creative-guides.generated";

export const creativeGuideIdSchema = z.enum([
  "visual-copy",
  "carousel-stories",
  "visual-design",
  "human-review",
]);

export const CREATIVE_GUIDE_INDEX = CREATIVE_GUIDES.map(
  ({ id, title, uri }) => ({
    id,
    title,
    uri,
  })
);

/** Same public content over HTTP and stdio; no filesystem or network reads. */
export function registerCreativeGuides(
  server: Pick<McpServer, "registerTool"> & {
    registerResource(
      name: string,
      uri: string,
      config: ResourceMetadata,
      callback: ReadResourceCallback
    ): unknown;
  }
): void {
  for (const guide of CREATIVE_GUIDES) {
    server.registerResource(
      guide.id,
      guide.uri,
      {
        title: guide.title,
        description: guide.title,
        mimeType: "text/markdown",
      },
      async () => ({
        contents: [
          { uri: guide.uri, mimeType: "text/markdown", text: guide.text },
        ],
      })
    );
  }

  server.registerTool(
    "get_creative_guide",
    {
      title: "Get a visual communication guide",
      description:
        "Read practical guidance before drafting concise plain or poetic copy, choosing carousel stories, designing visuals or recording human feedback. Returns guidance for the calling assistant to apply, not generated copy or saved feedback. Omit guideId to list guides.",
      inputSchema: {
        guideId: creativeGuideIdSchema
          .optional()
          .describe("Guide to read. Omit to list the guides."),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: { securitySchemes: [{ type: "noauth" }] },
    },
    async ({ guideId }) => {
      const guide = CREATIVE_GUIDES.find((entry) => entry.id === guideId);
      return {
        structuredContent: guide ? { guide } : { guides: CREATIVE_GUIDE_INDEX },
        content: [
          {
            type: "text" as const,
            text: guide
              ? guide.text
              : CREATIVE_GUIDE_INDEX.map(
                  (entry) => `${entry.id}: ${entry.title} (${entry.uri})`
                ).join("\n"),
          },
        ],
      };
    }
  );
}
