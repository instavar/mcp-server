import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it } from "vitest";

import {
  registerPublicTemplateTools,
  scaffoldVideoSpec,
} from "../public-templates";

const names: string[] = [];
const fakeServer = {
  registerResource: () => {},
  registerTool: (name: string) => {
    names.push(name);
  },
} as unknown as McpServer;

registerPublicTemplateTools(fakeServer);

describe("public template tools", () => {
  it("registers the fifteen no-key tools", () => {
    expect(names.sort()).toEqual([
      "diagnose_render_error",
      "get_capabilities",
      "get_carousel_schema",
      "get_creative_guide",
      "get_example",
      "get_render_instructions",
      "get_template",
      "get_video_schema",
      "list_carousel_templates",
      "list_templates",
      "prepare_announcement",
      "prepare_video_template",
      "propose_video_storyboard",
      "scaffold_carousel_deck",
      "scaffold_video_spec",
    ]);
  });

  it("scaffolds an editorial announcement with explicit silent audio", () => {
    const spec = scaffoldVideoSpec({
      templateId: "announcement-brief",
      title: "A clear announcement",
      aspect: "9:16",
    }) as {
      style: { showSceneLabels: boolean; theme: string };
      audio: { mode: string };
      scenes: Array<{ kind: string }>;
    };

    expect(spec.style).toMatchObject({
      theme: "editorial-light",
      showSceneLabels: false,
    });
    expect(spec.audio.mode).toBe("silent");
    expect(spec.scenes.map((scene) => scene.kind)).toEqual([
      "hero",
      "statement",
      "mechanism",
      "points",
      "cta",
    ]);
  });
});
