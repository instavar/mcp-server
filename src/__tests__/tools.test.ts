import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerTools } from "../tools";

type Handler = (args: Record<string, unknown>) => Promise<{
  isError?: boolean;
  content: Array<{ text: string }>;
}>;

const handlers = new Map<string, Handler>();
const fakeServer = {
  tool: (_n: string, _d: string, _shape: unknown, handler: Handler) => {
    handlers.set(_n, handler);
  },
} as unknown as Parameters<typeof registerTools>[0];

registerTools(fakeServer);

const fetchMock = vi.fn();

beforeEach(() => {
  process.env.INSTAVAR_API_KEY = "ik_live_test";
  delete process.env.INSTAVAR_BASE_URL;
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ jobs: [] }), { status: 200 })
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function call(name: string, args: Record<string, unknown> = {}) {
  const h = handlers.get(name);
  if (!h) throw new Error(`tool ${name} not registered`);
  return h(args);
}

function lastFetch() {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  const headers = (init?.headers ?? {}) as Record<string, string>;
  return { url: String(url), method: init?.method, headers, body: init?.body };
}

describe("registration", () => {
  it("registers all 11 tools", () => {
    expect([...handlers.keys()].sort()).toEqual(
      [
        "approve_job",
        "connect_account",
        "connect_account_status",
        "create_video_brief",
        "edit_video_brief",
        "get_cost_summary",
        "get_job_metrics",
        "get_job_status",
        "get_video_state",
        "list_jobs",
        "publish_job",
      ].sort()
    );
  });
});

describe("read tools → correct GET + x-api-key", () => {
  it("list_jobs", async () => {
    await call("list_jobs", { limit: 5, status: "draft_ready" });
    const f = lastFetch();
    expect(f.url).toContain("/api/v1/jobs?");
    expect(f.url).toContain("limit=5");
    expect(f.url).toContain("status=draft_ready");
    expect(f.headers["x-api-key"]).toBe("ik_live_test");
    expect(f.method).toBeUndefined(); // GET
  });

  it("get_job_status", async () => {
    await call("get_job_status", { jobId: "job-1" });
    expect(lastFetch().url).toMatch(/\/api\/v1\/jobs\/job-1$/);
  });

  it("get_video_state", async () => {
    await call("get_video_state", { jobId: "job-1" });
    expect(lastFetch().url).toMatch(/\/api\/v1\/jobs\/job-1\/video-state$/);
  });

  it("get_job_metrics", async () => {
    await call("get_job_metrics", { jobId: "job-1", limit: 7 });
    expect(lastFetch().url).toMatch(/\/api\/v1\/jobs\/job-1\/metrics\?limit=7$/);
  });

  it("get_cost_summary", async () => {
    await call("get_cost_summary", {
      provider: "lambda",
      groupBy: "day",
      since: "2026-01-01",
      includeReconciliation: true,
    });
    const f = lastFetch();
    expect(f.url).toContain("/api/v1/cost-summary?");
    expect(f.url).toContain("provider=lambda");
    expect(f.url).toContain("groupBy=day");
    expect(f.url).toContain("since=2026-01-01");
    expect(f.url).toContain("includeReconciliation=true");
  });
});

describe("write tools → correct POST + path", () => {
  it("create_video_brief → POST /api/v1/jobs", async () => {
    await call("create_video_brief", {
      title: "T",
      script: "s",
      caption: "c",
      publishTarget: "youtube",
      objective: "other",
    });
    const f = lastFetch();
    expect(f.url).toMatch(/\/api\/v1\/jobs$/);
    expect(f.method).toBe("POST");
    expect(f.headers["x-api-key"]).toBe("ik_live_test");
    expect(String(f.body)).toContain("\"title\":\"T\"");
  });

  it("edit_video_brief → POST /api/v1/jobs/:id/brief (jobId stripped from body)", async () => {
    await call("edit_video_brief", { jobId: "job-1", script: "new" });
    const f = lastFetch();
    expect(f.url).toMatch(/\/api\/v1\/jobs\/job-1\/brief$/);
    expect(f.method).toBe("POST");
    expect(String(f.body)).toContain("\"script\":\"new\"");
    expect(String(f.body)).not.toContain("jobId");
  });

  it("approve_job → POST /api/v1/jobs/:id/approve", async () => {
    await call("approve_job", { jobId: "job-1" });
    const f = lastFetch();
    expect(f.url).toMatch(/\/api\/v1\/jobs\/job-1\/approve$/);
    expect(f.method).toBe("POST");
  });

  it("publish_job → POST /api/jobs/:id/publish (NOT /api/v1)", async () => {
    await call("publish_job", { jobId: "job-1", youtubePrivacyStatus: "private" });
    const f = lastFetch();
    expect(f.url).toMatch(/\/api\/jobs\/job-1\/publish$/);
    expect(f.url).not.toContain("/api/v1/");
    expect(String(f.body)).toContain("private");
  });
});

describe("connect tools → device-pairing endpoints", () => {
  it("connect_account → POST /api/v1/connect/start with provider", async () => {
    await call("connect_account", { provider: "youtube" });
    const f = lastFetch();
    expect(f.url).toMatch(/\/api\/v1\/connect\/start$/);
    expect(f.method).toBe("POST");
    expect(f.headers["x-api-key"]).toBe("ik_live_test");
    expect(String(f.body)).toContain("\"provider\":\"youtube\"");
  });

  it("connect_account_status → GET /api/v1/connect/poll?pairingId=", async () => {
    await call("connect_account_status", { pairingId: "pair-1" });
    const f = lastFetch();
    expect(f.url).toMatch(/\/api\/v1\/connect\/poll\?pairingId=pair-1$/);
    expect(f.method).toBeUndefined(); // GET
    expect(f.headers["x-api-key"]).toBe("ik_live_test");
  });
});

describe("auth + error surfacing", () => {
  it("missing INSTAVAR_API_KEY → clear error, no fetch", async () => {
    delete process.env.INSTAVAR_API_KEY;
    const res = await call("list_jobs", { limit: 5 });
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain("INSTAVAR_API_KEY");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("401 surfaces 'invalid or revoked'", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    );
    const res = await call("list_jobs", { limit: 5 });
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain("invalid or revoked");
  });

  it("403 surfaces the scope reason", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ reason: "scope_publish_required" }), {
        status: 403,
      })
    );
    const res = await call("publish_job", { jobId: "job-1" });
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain("scope_publish_required");
  });

  it("honors INSTAVAR_BASE_URL override", async () => {
    process.env.INSTAVAR_BASE_URL = "https://staging.instavar.com/";
    await call("list_jobs", { limit: 1 });
    expect(lastFetch().url).toMatch(/^https:\/\/staging\.instavar\.com\/api\/v1\/jobs/);
  });
});
