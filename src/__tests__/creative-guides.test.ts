import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { expect, it, vi } from "vitest";
import { registerPublicTemplateTools } from "../public-templates";
import { CREATIVE_GUIDE_INDEX } from "../creative-guides";

it("delivers every guide identically through resources and the no-key tool", async () => {
  const server = new McpServer({ name: "guides-test", version: "1.0.0" });
  registerPublicTemplateTools(server);
  const client = new Client({ name: "guides-client", version: "1.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  try {
    await Promise.all([client.connect(a), server.connect(b)]);
    const resources = await client.listResources();
    expect(resources.resources.map((r) => r.uri)).toEqual(
      CREATIVE_GUIDE_INDEX.map((g) => g.uri)
    );
    const tools = await client.listTools();
    expect(
      tools.tools.find((t) => t.name === "get_creative_guide")
    ).toMatchObject({
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    });
    const index = await client.callTool({
      name: "get_creative_guide",
      arguments: {},
    });
    expect(index.structuredContent).toEqual({ guides: CREATIVE_GUIDE_INDEX });
    for (const guide of CREATIVE_GUIDE_INDEX) {
      const resource = await client.readResource({ uri: guide.uri });
      const tool = await client.callTool({
        name: "get_creative_guide",
        arguments: { guideId: guide.id },
      });
      const content = resource.contents[0];
      if (!("text" in content)) throw new Error("Expected a Markdown resource");
      expect(tool.content).toEqual([{ type: "text", text: content.text }]);
      expect(content.text).not.toMatch(/\/Users\/|\.openclaw|t\.me\/c\//);
    }
    const bad = await client.callTool({
      name: "get_creative_guide",
      arguments: { guideId: "../../private" },
    });
    expect(bad.isError).toBe(true);
    await expect(
      client.readResource({ uri: "instavar://creative-guides/../../private" })
    ).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  } finally {
    fetchSpy.mockRestore();
    await client.close();
    await server.close();
  }
});
