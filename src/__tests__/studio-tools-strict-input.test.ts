import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerTools } from "../tools";

// The remote Studio tools reject unknown arguments, so the API-key tools in
// this package must too. A raw input shape strips an unknown key silently, so
// a misspelt confirmation flag or an unsupported option would reach the API as
// if the caller had never sent it.

const UNKNOWN_KEY = "__unexpected";
const JOB_ID = "123e4567-e89b-12d3-a456-426614174000";
const RUN_ID = "0b6ee81a-92c3-4a5c-8b2f-1e15aa1c2d3e";
const ARTIFACT_ID = "550e8400-e29b-41d4-a716-446655440000";
const PROJECT_ID = "17c9e75e-cdb1-45b5-9e81-ec418118de12";
const DOCUMENT_ID = "8e157ca4-ad29-4414-a8b7-36a3ef7f4ec4";

// Minimal arguments each tool accepts. The acceptance tests below prove they
// are valid, so each rejection comes from the unknown key alone. A tool added
// to registerTools without an entry here fails the coverage test.
const VALID_ARGS: Record<string, Record<string, unknown>> = {
  list_jobs: {},
  get_job_status: { jobId: JOB_ID },
  get_video_state: { jobId: JOB_ID },
  diagnose_render: { jobId: JOB_ID },
  get_job_metrics: { jobId: JOB_ID },
  get_cost_summary: {},
  inspect_workflow: { jobId: JOB_ID },
  inspect_design_document: { projectId: PROJECT_ID, documentId: DOCUMENT_ID },
  apply_design_actions: {
    projectId: PROJECT_ID,
    documentId: DOCUMENT_ID,
    actionGroupId: "group-1",
    expectedVersion: 1,
    actions: [
      {
        actionId: "a1",
        sceneId: "s1",
        kind: "set-layer-visibility",
        layerId: "l1",
        visible: false,
      },
    ],
    clientCreatedAt: "2026-09-01T12:00:00.000Z",
  },
  create_video_brief: {
    title: "Strict input probe",
    script: "Hello there.",
    caption: "Probe",
    publishTarget: "youtube",
    objective: "other",
  },
  edit_video_brief: { jobId: JOB_ID },
  draft_workflow: {
    jobId: JOB_ID,
    expectedVersion: 0,
    document: { kind: "transformation-montage" },
  },
  patch_workflow: {
    jobId: JOB_ID,
    expectedVersion: 1,
    patch: { label: "New label" },
  },
  validate_workflow: { jobId: JOB_ID, expectedVersion: 1 },
  preview_workflow: { jobId: JOB_ID },
  compare_workflows: { jobId: JOB_ID, fromVersion: 1, toVersion: 2 },
  approve_workflow: { jobId: JOB_ID, expectedVersion: 1 },
  retry_video_qa: {
    jobId: JOB_ID,
    runId: RUN_ID,
    videoArtifactId: ARTIFACT_ID,
  },
  audit_video_qa: {
    jobId: JOB_ID,
    runId: RUN_ID,
    videoArtifactId: ARTIFACT_ID,
  },
  regenerate_narration: {
    jobId: JOB_ID,
    sourceRunId: RUN_ID,
    trigger: "user_requested",
  },
  approve_job: { jobId: JOB_ID },
  publish_job: { jobId: JOB_ID, youtubePrivacyStatus: "private" },
  connect_account: { provider: "youtube" },
  connect_account_status: { pairingId: RUN_ID },
};

const fetchMock = vi.fn();

beforeEach(() => {
  process.env.INSTAVAR_API_KEY = "ik_live_strict_input_test";
  delete process.env.INSTAVAR_BASE_URL;
  fetchMock.mockReset();
  // A fresh Response per call: diagnose_render reads two bodies.
  fetchMock.mockImplementation(
    async () => new Response(JSON.stringify({ ok: true }), { status: 200 })
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function connectPair() {
  const server = new McpServer({ name: "instavar-test", version: "1.0.0" });
  registerTools(server);
  const client = new Client({ name: "strict-input-test", version: "1.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return { client, server };
}

async function callTool(name: string, args: Record<string, unknown>) {
  const { client, server } = await connectPair();
  try {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as Array<{ type: string; text?: string }>)
      .filter((item) => item.type === "text")
      .map((item) => item.text ?? "")
      .join("\n");
    return { isError: result.isError, text };
  } finally {
    await client.close();
    await server.close();
  }
}

// Read the tool names from the wire rather than a hard-coded list, so a tool
// registered later with a raw (stripping) input shape is covered automatically.
const TOOL_NAMES = await (async () => {
  const { client, server } = await connectPair();
  try {
    return (await client.listTools()).tools.map((tool) => tool.name).sort();
  } finally {
    await client.close();
    await server.close();
  }
})();

describe("Studio tools reject unknown input keys", () => {
  it("has valid arguments for every listed tool", () => {
    expect(TOOL_NAMES.length).toBeGreaterThan(0);
    expect(TOOL_NAMES).toEqual(Object.keys(VALID_ARGS).sort());
  });

  it.each(TOOL_NAMES)(
    "%s rejects an unknown key before any request",
    async (name) => {
      const base = VALID_ARGS[name];
      expect(base, `${name} needs an entry in VALID_ARGS`).toBeDefined();
      const result = await callTool(name, { ...base, [UNKNOWN_KEY]: true });
      expect(result.isError).toBe(true);
      expect(result.text).toMatch(/unrecognized key/i);
      expect(result.text).toContain(UNKNOWN_KEY);
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it.each(TOOL_NAMES)(
    "%s accepts the same arguments without the unknown key",
    async (name) => {
      const base = VALID_ARGS[name];
      expect(base, `${name} needs an entry in VALID_ARGS`).toBeDefined();
      const result = await callTool(name, base);
      expect(result.isError, result.text).not.toBe(true);
      expect(fetchMock).toHaveBeenCalled();
    }
  );
});
