/**
 * Thin HTTP client for the Instavar `/api/v1` surface. The server holds no
 * database connection — it authenticates every call with the per-user API key
 * (`x-api-key` header) and talks only to the hosted API.
 */

export const API_KEY_HEADER = "x-api-key";

export function getApiKey(): string {
  const key = process.env.INSTAVAR_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "INSTAVAR_API_KEY is not set. Create a key at https://instavar.com/studio/settings " +
        "and add it to the MCP server env block (env.INSTAVAR_API_KEY)."
    );
  }
  return key;
}

export function baseUrl(): string {
  return (process.env.INSTAVAR_BASE_URL || "https://instavar.com").replace(
    /\/+$/,
    ""
  );
}

export interface HttpResult {
  ok: boolean;
  status: number;
  body: unknown;
}

function explain(status: number, body: unknown): string {
  if (status === 401) {
    return "API key invalid or revoked (401). Check INSTAVAR_API_KEY or mint a new key at /studio/settings.";
  }
  if (status === 403) {
    const reason =
      body && typeof body === "object" && "reason" in body
        ? String((body as { reason: unknown }).reason)
        : "insufficient scope";
    return `Forbidden (403): ${reason}. The key lacks the required scope for this action.`;
  }
  return "";
}

async function parse(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function apiGet(path: string): Promise<HttpResult> {
  const res = await fetch(`${baseUrl()}${path}`, {
    headers: { [API_KEY_HEADER]: getApiKey() },
  });
  const body = await parse(res);
  const hint = explain(res.status, body);
  return { ok: res.ok, status: res.status, body: hint ? { error: hint, body } : body };
}

export async function apiPost(
  path: string,
  payload: Record<string, unknown>
): Promise<HttpResult> {
  // Drop undefined fields so the route's zod schema sees a clean body.
  const clean = Object.fromEntries(
    Object.entries(payload).filter(([, v]) => v !== undefined)
  );
  const res = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: {
      [API_KEY_HEADER]: getApiKey(),
      "content-type": "application/json",
    },
    body: JSON.stringify(clean),
  });
  const body = await parse(res);
  const hint = explain(res.status, body);
  return { ok: res.ok, status: res.status, body: hint ? { error: hint, body } : body };
}

/** Render an HttpResult as an MCP tool result. */
export function toToolResult(result: HttpResult) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(result.body, null, 2),
      },
    ],
    isError: !result.ok,
  };
}

/** Wrap a tool body so a thrown error (e.g. missing key) becomes a clean result. */
export async function runTool(
  fn: () => Promise<HttpResult>
): Promise<ReturnType<typeof toToolResult>> {
  try {
    return toToolResult(await fn());
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: error instanceof Error ? error.message : String(error),
        },
      ],
      isError: true,
    };
  }
}
