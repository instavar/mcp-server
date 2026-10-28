import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerTools } from "../tools";

const fetchMock = vi.fn();

beforeEach(() => {
  process.env.INSTAVAR_API_KEY = "ik_live_wire_test";
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ ok: true, forwarded: true }), { status: 200 })
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function connectPair() {
  const server = new McpServer({ name: "instavar-test", version: "1.0.0" });
  registerTools(server);
  const client = new Client({ name: "wire-test", version: "1.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return { client, server };
}

describe("standalone MCP wire contract", () => {
  it("advertises the complete workflow tool set with concurrency inputs", async () => {
    const { client, server } = await connectPair();
    try {
      const result = await client.listTools();
      const names = result.tools.map((tool) => tool.name);
      expect(names).toEqual(
        expect.arrayContaining([
          "inspect_workflow",
          "draft_workflow",
          "patch_workflow",
          "validate_workflow",
          "preview_workflow",
          "compare_workflows",
          "approve_workflow",
        ])
      );
      for (const name of [
        "draft_workflow",
        "patch_workflow",
        "validate_workflow",
        "approve_workflow",
      ]) {
        const schema = result.tools.find((tool) => tool.name === name)
          ?.inputSchema as { required?: string[] } | undefined;
        expect(schema?.required, name).toEqual(
          expect.arrayContaining(["jobId", "expectedVersion"])
        );
      }
      const patch = result.tools.find((tool) => tool.name === "patch_workflow")
        ?.inputSchema as { required?: string[] } | undefined;
      expect(patch?.required).toContain("patch");
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("advertises and forwards documentary and montage scene primitives", async () => {
    const { client, server } = await connectPair();
    try {
      const tools = await client.listTools();
      const create = tools.tools.find(
        (tool) => tool.name === "create_video_brief"
      );
      const schema = create?.inputSchema as
        | {
            properties?: {
              scenes?: {
                items?: {
                  properties?: { type?: { enum?: string[] } };
                };
              };
            };
          }
        | undefined;
      const sceneTypes =
        schema?.properties?.scenes?.items?.properties?.type?.enum ?? [];
      expect(sceneTypes).toEqual(
        expect.arrayContaining(["source-clip", "source-image", "route-card"])
      );

      const result = await client.callTool({
        name: "create_video_brief",
        arguments: {
          title: "Evidence-bound journey",
          script: "The source journey becomes a practical lab story.",
          caption: "From source evidence to a finished story.",
          publishTarget: "tiktok",
          objective: "build_log",
          scenes: [
            {
              type: "source-image",
              src: "https://assets.instavar.com/fixtures/source.jpg",
              objectFit: "cover",
              objectPosition: "50% 45%",
              scaleFrom: 1,
              scaleTo: 1.08,
              panFromX: -4,
              panToX: 4,
              title: "The journey begins",
              durationInFrames: 60,
            },
            {
              type: "route-card",
              routeFrom: "China",
              routeTo: "Singapore",
              routeLabel: "Furniture journey",
              accentColor: "#FACC15",
              durationInFrames: 60,
            },
          ],
          audioLayers: [
            {
              id: "music-bed",
              src: "https://assets.instavar.com/audio/music.wav",
              role: "music",
              volume: 0.25,
            },
          ],
        },
      });

      expect(result.isError).not.toBe(true);
      expect(fetchMock).toHaveBeenCalledOnce();
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const forwarded = JSON.parse(String(init.body));
      expect(
        forwarded.scenes.map((scene: { type: string }) => scene.type)
      ).toEqual(["source-image", "route-card"]);
      expect(forwarded.audioLayers[0].role).toBe("music");
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("rejects unsafe documentary motion before the HTTP handler", async () => {
    const { client, server } = await connectPair();
    try {
      const result = await client.callTool({
        name: "create_video_brief",
        arguments: {
          title: "Unsafe journey",
          script: "Test.",
          caption: "Test.",
          publishTarget: "tiktok",
          objective: "build_log",
          scenes: [
            {
              type: "source-image",
              src: "https://assets.instavar.com/fixtures/source.jpg",
              panToX: 90,
            },
          ],
        },
      });
      expect(result.isError).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("rejects an invalid workflow patch before making an HTTP request", async () => {
    const { client, server } = await connectPair();
    try {
      const result = await client.callTool({
        name: "patch_workflow",
        arguments: {
          jobId: "123e4567-e89b-12d3-a456-426614174000",
          expectedVersion: 0,
          patch: { label: "Invalid version" },
        },
      });
      expect(result.isError).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("rejects unknown workflow action fields before making an HTTP request", async () => {
    const { client, server } = await connectPair();
    try {
      const result = await client.callTool({
        name: "approve_workflow",
        arguments: {
          jobId: "123e4567-e89b-12d3-a456-426614174000",
          expectedVersion: 1,
          publish: true,
        },
      });
      expect(result.isError).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      await client.close();
      await server.close();
    }
  });

  it.each(["draft_workflow", "validate_workflow", "approve_workflow"])(
    "rejects %s without an inspected expected version",
    async (name) => {
      const { client, server } = await connectPair();
      try {
        const result = await client.callTool({
          name,
          arguments: {
            jobId: "123e4567-e89b-12d3-a456-426614174000",
            ...(name === "draft_workflow"
              ? { document: { kind: "transformation-montage" } }
              : {}),
          },
        });
        expect(result.isError).toBe(true);
        expect(fetchMock).not.toHaveBeenCalled();
      } finally {
        await client.close();
        await server.close();
      }
    }
  );

  it("surfaces workflow conflicts with an actionable re-inspection hint", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "Workflow changed. Expected version 1, current version is 2",
        }),
        { status: 409 }
      )
    );
    const { client, server } = await connectPair();
    try {
      const result = await client.callTool({
        name: "patch_workflow",
        arguments: {
          jobId: "123e4567-e89b-12d3-a456-426614174000",
          expectedVersion: 1,
          patch: { label: "Stale update" },
        },
      });
      expect(result.isError).toBe(true);
      const text = (result.content as Array<{ type: string; text?: string }>)
        .filter((item) => item.type === "text")
        .map((item) => item.text ?? "")
        .join("\n");
      expect(text).toContain("Conflict (409)");
      expect(text).toContain("Inspect the latest workflow state");
    } finally {
      await client.close();
      await server.close();
    }
  });
});

describe("standalone create_video_brief admission", () => {
  it("rejects a framework choice instead of rendering with the default", async () => {
    const { client, server } = await connectPair();
    try {
      const brief = {
        title: "Framework probe",
        script: "Hello there.",
        caption: "Probe",
        publishTarget: "linkedin",
        objective: "other",
      };
      for (const extra of [
        { framework: "hyperframes" },
        { experimentalRenderer: "hyperframes" },
      ]) {
        const result = await client.callTool({
          name: "create_video_brief",
          arguments: { ...brief, ...extra },
        });
        expect(result.isError).toBe(true);
      }
      expect(fetchMock).not.toHaveBeenCalled();
      const accepted = await client.callTool({
        name: "create_video_brief",
        arguments: brief,
      });
      expect(accepted.isError).not.toBe(true);
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(brief);
    } finally {
      await client.close();
      await server.close();
    }
  });
});
