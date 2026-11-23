import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it } from "vitest";

import { registerConfiguredTools } from "../configured-tools";

// Release gate. The tag workflow runs the tests before npm publish, so a
// release whose listing files disagree with the package stops here.
// To refresh the LobeHub declaration after a tool change:
//   npm run listings:sync

const root = new URL("../../", import.meta.url);
const path = (name: string) => fileURLToPath(new URL(name, root));
const readJson = (name: string) => JSON.parse(readFileSync(path(name), "utf8"));

const pkg = readJson("package.json");
const serverJson = readJson("server.json");
const lobehub = readJson("lhm.plugin.json");
const version: string = pkg.version;

async function freeSurface() {
  const server = new McpServer({ name: pkg.name, version });
  registerConfiguredTools(server, "");
  const client = new Client({ name: "release-consistency", version: "1.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(a), server.connect(b)]);
  try {
    const { tools } = await client.listTools();
    const { resources } = await client.listResources();
    // Through JSON, as the files are stored: drops undefined fields.
    return JSON.parse(JSON.stringify({ tools, resources }));
  } finally {
    await client.close();
  }
}

describe("release consistency", () => {
  it("uses one version in package.json, server.json and lhm.plugin.json", () => {
    expect(serverJson.version).toBe(version);
    const npmEntries = serverJson.packages.filter(
      (p: { registryType: string }) => p.registryType === "npm"
    );
    expect(npmEntries).toHaveLength(1);
    expect(npmEntries[0].identifier).toBe(pkg.name);
    expect(npmEntries[0].version).toBe(version);
    expect(serverJson.name).toBe(pkg.mcpName);
    expect(lobehub.version).toBe(version);
  });

  it("names the current npm version in the LobeHub summary", () => {
    for (const localization of lobehub.localizations) {
      expect(localization.summary).toContain(`npm ${version} `);
    }
  });

  it("has release notes for the current version in CHANGELOG.md", () => {
    const changelog = readFileSync(path("CHANGELOG.md"), "utf8");
    const section = changelog.split(/^## /m).find((s) => s.split("\n")[0].trim().split(" ")[0] === version);
    expect(section, `CHANGELOG.md needs a "## ${version}" section`).toBeDefined();
    expect(section!.split("\n").slice(1).join("\n").trim()).not.toBe("");
  });

  it("declares to LobeHub exactly the tools and resources served without a key", async () => {
    const surface = await freeSurface();
    if (process.env.LISTINGS_SYNC === "1") {
      const next = { ...lobehub, ...surface };
      writeFileSync(path("lhm.plugin.json"), JSON.stringify(next, null, 2) + "\n");
      return;
    }
    expect(lobehub.tools).toEqual(surface.tools);
    expect(lobehub.resources).toEqual(surface.resources);
  });
});
