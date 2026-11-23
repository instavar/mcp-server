#!/usr/bin/env node
// Read back where each listing stands against package.json's version.
//   npm run listings:verify                       (all; exits 1 if a required one lags)
//   node scripts/verify-listings.mjs --require npm,registry --wait 300
// LobeHub's public record is cached for a long time, so it never fails the run.
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const expected =
  flag("version") ??
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))
    .version;
const required = flag("require", "npm,registry,mirror-release").split(",");
const waitSeconds = Number(flag("wait", "0"));

const getJson = async (url) => {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "listings-verify" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
};

const sources = {
  npm: async () =>
    (await getJson("https://registry.npmjs.org/@instavar%2Fmcp-server/latest"))
      .version,
  registry: async () => {
    const body = await getJson(
      "https://registry.modelcontextprotocol.io/v0.1/servers/com.instavar%2Fmcp-server/versions/latest"
    );
    const server = body.server ?? body;
    const npm = server.packages?.find((p) => p.registryType === "npm");
    if (npm?.version !== server.version) {
      return `${server.version} (points at npm ${npm?.version})`;
    }
    return server.version;
  },
  "mirror-release": async () =>
    (
      await getJson(
        "https://api.github.com/repos/instavar/mcp-server/releases/latest"
      )
    ).tag_name.replace(/^v/, ""),
  lobehub: async () =>
    (
      await getJson(
        "https://market.lobehub.com/api/v1/plugins/instavar-mcp-server?locale=en-US"
      )
    ).version,
};

async function check() {
  const rows = [];
  for (const [name, read] of Object.entries(sources)) {
    let found;
    try {
      found = String(await read());
    } catch (error) {
      found = `unreadable: ${error.message}`;
    }
    rows.push({ name, found, ok: found === expected });
  }
  return rows;
}

const deadline = Date.now() + waitSeconds * 1000;
let rows;
for (;;) {
  rows = await check();
  const lagging = rows.filter((r) => !r.ok && required.includes(r.name));
  if (lagging.length === 0 || Date.now() >= deadline) break;
  await new Promise((resolve) => setTimeout(resolve, 15000));
}

console.log(`expected ${expected} at ${new Date().toISOString()}`);
let failed = false;
for (const row of rows) {
  const needed = required.includes(row.name);
  const state = row.ok ? "ok" : needed ? "LAGGING" : "lagging (not required)";
  if (!row.ok && needed) failed = true;
  console.log(`${row.name.padEnd(15)} ${row.found.padEnd(28)} ${state}`);
}
process.exit(failed ? 1 : 0);
