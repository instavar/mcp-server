import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it } from "vitest";

import { registerPublicTemplateTools } from "../public-templates";

const names: string[] = [];
const fakeServer = {
  registerTool: (name: string) => {
    names.push(name);
  },
} as unknown as McpServer;

registerPublicTemplateTools(fakeServer);

describe("public template tools", () => {
  it("registers the eight no-key tools", () => {
    expect(names.sort()).toEqual([
      "diagnose_render_error",
      "get_capabilities",
      "get_example",
      "get_render_instructions",
      "get_template",
      "get_video_schema",
      "list_templates",
      "scaffold_video_spec",
    ]);
  });
});
