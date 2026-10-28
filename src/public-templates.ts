import { PAIRED_ANNOUNCEMENT_CAPABILITY } from "./paired-announcement";
import { registerPairedAnnouncement } from "./paired-announcement";
import {
  PAIRED_TEMPLATE_CAPABILITY,
  pairedTemplatesEnabled,
  registerPairedTemplates,
} from "./paired-templates/prepare-video-template";
import {
  CREATIVE_GUIDE_INDEX,
  registerCreativeGuides,
} from "./creative-guides";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  registerSharedTemplateTools,
  TEMPLATE_REPOSITORY,
  VOICE_STUDIO_URL,
} from "./public-catalogue";

export { scaffoldVideoSpec } from "./public-catalogue";

const TEMPLATE_ENDPOINT = "https://instavar.com/api/mcp/templates";

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

export function registerPublicTemplateTools(
  server: McpServer,
  options: { pairedTemplates?: boolean } = {}
): void {
  const paired = options.pairedTemplates ?? pairedTemplatesEnabled();
  registerCreativeGuides(server);
  registerPairedAnnouncement(server, { pairedCatalogue: paired });
  if (paired) registerPairedTemplates(server);
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
          ...(paired ? { pairedTemplates: PAIRED_TEMPLATE_CAPABILITY } : {}),
          localFeatures: [
            "template discovery",
            "three-beat storyboard proposals",
            "VideoSpec schema and examples",
            "deterministic scaffolding",
            "editorial carousel discovery and deterministic deck scaffolding",
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

  // Template, storyboard and carousel tools are shared with the hosted route.
  registerSharedTemplateTools(server, { pairedTemplates: paired });
}
