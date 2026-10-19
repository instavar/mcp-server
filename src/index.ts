import { PAIRED_ANNOUNCEMENT_INSTRUCTIONS } from "./paired-announcement";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerConfiguredTools } from "./configured-tools";
import pkg from "../package.json";

// Single source of truth: derived from package.json at build time (tsup inlines
// the JSON import), so the runtime --version can never drift from the published
// package version the way the old hardcoded constant did (0.1.2 and 0.1.3 both
// shipped reporting a stale 0.1.1).
const VERSION = pkg.version;

const HELP = [
  "instavar-mcp — Instavar Studio MCP server",
  "",
  "Runs over stdio (launched by Claude Code / Codex).",
  "Public template tools work without configuration.",
  "Optional env:",
  "  INSTAVAR_API_KEY   unlocks hosted Studio tools",
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

  const server = new McpServer(
    { name: "instavar", version: VERSION },
    {
      instructions:
        PAIRED_ANNOUNCEMENT_INSTRUCTIONS +
        " " +
        "Before drafting concise carousel or video copy, call get_creative_guide for visual-copy. Use the carousel-stories, visual-design and human-review guides as relevant. Apply them to the user brief; the guides do not generate, render, save or publish media.",
    }
  );
  registerConfiguredTools(server);
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
