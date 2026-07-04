import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools";
import pkg from "../package.json";

// Single source of truth: derived from package.json at build time (tsup inlines
// the JSON import), so the runtime --version can never drift from the published
// package version the way the old hardcoded constant did (0.1.2 and 0.1.3 both
// shipped reporting a stale 0.1.1).
const VERSION = pkg.version;

const HELP = [
  "instavar-mcp — Instavar Studio MCP server",
  "",
  "Runs over stdio (launched by Claude Code / Codex). Configure via env:",
  "  INSTAVAR_API_KEY   (required) your key from https://instavar.com/studio/settings",
  "  INSTAVAR_BASE_URL  (optional) defaults to https://instavar.com",
  "",
  "Flags: --version, --help",
  "",
].join("\n");

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv.includes("--version") || argv.includes("-v")) {
    process.stdout.write(`${VERSION}\n`);
    return;
  }
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(HELP);
    return;
  }

  // Fail fast with a clear message before connecting — the server needs only an
  // API key, never a database connection.
  if (!process.env.INSTAVAR_API_KEY?.trim()) {
    process.stderr.write(
      "instavar-mcp: INSTAVAR_API_KEY is not set. Create a key at " +
        "https://instavar.com/studio/settings and add it to the MCP server env " +
        "block (env.INSTAVAR_API_KEY).\n"
    );
    process.exit(1);
  }

  const server = new McpServer({ name: "instavar", version: VERSION });
  registerTools(server);
  await server.connect(new StdioServerTransport());
}

main().catch((error) => {
  process.stderr.write(
    `instavar-mcp: fatal: ${
      error instanceof Error ? error.message : String(error)
    }\n`
  );
  process.exit(1);
});
