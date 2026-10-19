import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it } from "vitest";

import { registerConfiguredTools } from "../configured-tools";

function registeredNames(apiKey?: string): string[] {
  const names: string[] = [];
  const fakeServer = {
    registerResource: () => {},
    registerTool: (name: string) => {
      names.push(name);
    },
  } as unknown as McpServer;
  registerConfiguredTools(fakeServer, apiKey);
  return names;
}

describe("configured MCP surface", () => {
  it("exposes only the ten local tools without a key", () => {
    expect(registeredNames()).toHaveLength(10);
    expect(registeredNames()).toContain("scaffold_video_spec");
    expect(registeredNames()).not.toContain("publish_job");
  });

  it("adds the hosted tools when a key is configured", () => {
    const names = registeredNames("ik_live_test");
    expect(names).toHaveLength(34);
    expect(names).toContain("scaffold_video_spec");
    expect(names).toContain("create_video_brief");
    expect(names).toContain("diagnose_render");
    expect(names).toContain("publish_job");
  });
});
