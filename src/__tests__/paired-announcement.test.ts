import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { expect, it } from "vitest";
import { registerPublicTemplateTools } from "../public-templates";

it("preserves copy through selection, continuation, edits and switches over MCP", async () => {
  const server = new McpServer({ name: "paired-test", version: "1" });
  registerPublicTemplateTools(server);
  const client = new Client({ name: "test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(a), server.connect(b)]);
  const call = (args: Record<string, unknown>) =>
    client.callTool({ name: "prepare_announcement", arguments: args });
  const copy = {
    title: "Meet the new workspace.",
    body: "One place to shape your next story.",
    cta: "Take a closer look.",
  };
  try {
    const tools = await client.listTools();
    expect(
      tools.tools.find((t) => t.name === "prepare_announcement")
    ).toMatchObject({
      annotations: { readOnlyHint: true, destructiveHint: false },
    });
    const ambiguous = await call({ copy });
    expect(ambiguous.structuredContent).toEqual({
      inputReceipt: {
        contract: "paired-announcement-input-receipt/v1",
        stage: "validated-input",
        normalizedInput: { copy },
      },
      status: "needs-selection",
      options: ["remotion", "hyperframes", "no-preference"],
      message: expect.any(String),
    });
    for (const framework of ["remotion", "hyperframes"]) {
      const first = (await call({ framework, copy }))
        .structuredContent as Record<string, unknown>;
      expect(first).toMatchObject({
        inputReceipt: { normalizedInput: { framework, copy } },
        status: "ready",
        reason: "explicit",
        project: { framework, revision: 1, copy },
      });
      const continued = (
        await call({ project: first.project, expectedRevision: 1 })
      ).structuredContent as Record<string, unknown>;
      expect(
        (continued.inputReceipt as { normalizedInput: Record<string, unknown> })
          .normalizedInput
      ).toEqual({
        project: first.project,
        expectedRevision: 1,
      });
      expect(continued).toMatchObject({
        reason: "existing-project",
        project: first.project,
      });
      const explicitEmptyEdits = (
        await call({
          project: continued.project,
          expectedRevision: 1,
          edits: {},
        })
      ).structuredContent as Record<string, unknown>;
      expect(
        (explicitEmptyEdits.inputReceipt as { normalizedInput: unknown })
          .normalizedInput
      ).toEqual({
        project: continued.project,
        expectedRevision: 1,
        edits: {},
      });
      expect(explicitEmptyEdits.project).toEqual(continued.project);
      const edited = (
        await call({
          project: continued.project,
          expectedRevision: 1,
          edits: { title: "Your next story starts here." },
        })
      ).structuredContent as Record<string, unknown>;
      expect(
        (edited.inputReceipt as { normalizedInput: Record<string, unknown> })
          .normalizedInput
      ).toEqual({
        project: continued.project,
        expectedRevision: 1,
        edits: { title: "Your next story starts here." },
      });
      const other = framework === "remotion" ? "hyperframes" : "remotion";
      const switched = (
        await call({
          project: edited.project,
          expectedRevision: 2,
          framework: other,
        })
      ).structuredContent as Record<string, unknown>;
      expect(
        (switched.inputReceipt as { normalizedInput: Record<string, unknown> })
          .normalizedInput
      ).toEqual({
        project: edited.project,
        expectedRevision: 2,
        framework: other,
      });
      expect(switched).toMatchObject({
        project: {
          framework: other,
          revision: 2,
          copy: { ...copy, title: "Your next story starts here." },
        },
      });
      const files = switched.files as Record<string, string>;
      expect(
        files[other === "remotion" ? "index.jsx" : "index.html"]
      ).toContain("Your next story starts here.");
      expect(JSON.parse(files["announcement.project.json"])).toEqual(
        switched.project
      );
      expect(
        (
          await call({
            project: edited.project,
            expectedRevision: 1,
            framework: other,
          })
        ).isError
      ).toBe(true);
      expect(
        (await call({ project: edited.project, copy, expectedRevision: 2 }))
          .isError
      ).toBe(true);
      expect((await call({ project: edited.project })).isError).toBe(true);
    }
    expect(
      (await call({ framework: "no-preference", copy })).structuredContent
    ).toMatchObject({
      reason: "visible-default",
      project: { framework: "remotion" },
    });
    expect((await call({ framework: "unknown", copy })).isError).toBe(true);
    expect(
      (
        await call({
          framework: "hyperframes",
          copy: { ...copy, title: "x".repeat(71) },
        })
      ).isError
    ).toBe(true);
    const needsCopy = (await call({ framework: "hyperframes" }))
      .structuredContent as Record<string, unknown>;
    expect(needsCopy).toMatchObject({
      status: "needs-copy",
      inputReceipt: { normalizedInput: { framework: "hyperframes" } },
    });
    const trimmed = (
      await call({
        framework: "remotion",
        copy: {
          title: "  A quiet morning  ",
          body: "  Room for a story.  ",
          cta: "  Come by  ",
        },
      })
    ).structuredContent as Record<string, unknown>;
    expect(trimmed).toMatchObject({
      inputReceipt: {
        normalizedInput: {
          framework: "remotion",
          copy: {
            title: "A quiet morning",
            body: "Room for a story.",
            cta: "Come by",
          },
        },
      },
    });
    const unknown = await call({
      framework: "remotion",
      copy,
      authorization: "synthetic-not-a-credential",
    });
    // SDK object parsing strips unknown transport fields before our callback.
    expect(unknown.structuredContent).toMatchObject({
      status: "ready",
      inputReceipt: { normalizedInput: { framework: "remotion", copy } },
    });
    expect(
      (
        (unknown.structuredContent as Record<string, unknown>).inputReceipt as {
          normalizedInput: unknown;
        }
      ).normalizedInput
    ).toEqual({ framework: "remotion", copy });
    expect(JSON.stringify(unknown)).not.toContain("synthetic-not-a-credential");
    const escaped = (
      await call({
        framework: "hyperframes",
        copy: { ...copy, title: "</h1><script>alert(1)</script>" },
      })
    ).structuredContent as Record<string, unknown>;
    expect((escaped.files as Record<string, string>)["index.html"]).toContain(
      "&lt;script&gt;"
    );
    expect(
      (escaped.files as Record<string, string>)["index.html"]
    ).not.toContain("<script>alert(1)");
  } finally {
    await client.close();
    await server.close();
  }
});
