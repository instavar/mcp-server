#!/usr/bin/env node
// Set one version everywhere a release names it, then refresh the LobeHub
// declaration from the server's own tool list.
//   npm run release:prepare -- 0.9.1
// Afterwards: write the "## <version>" section in CHANGELOG.md, run `npm test`,
// commit, and push the tag `mcp-server-v<version>`.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const next = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(next ?? "")) {
  console.error("usage: npm run release:prepare -- <major.minor.patch>");
  process.exit(2);
}
const root = new URL("../", import.meta.url);
const file = (name) => fileURLToPath(new URL(name, root));

const previous = JSON.parse(readFileSync(file("package.json"), "utf8")).version;

// Text replacement keeps each file's formatting. The counts are fixed so a
// file that gains or loses a version field stops the script.
function setVersion(name, expectedCount, extra = (text) => text) {
  const text = readFileSync(file(name), "utf8");
  const needle = `"version": "${previous}"`;
  const count = text.split(needle).length - 1;
  if (count !== expectedCount) {
    console.error(
      `${name}: expected ${expectedCount} of ${needle}, found ${count}. Nothing in this file was changed.`
    );
    process.exit(1);
  }
  writeFileSync(file(name), extra(text.split(needle).join(`"version": "${next}"`)));
}

setVersion("package.json", 1);
setVersion("server.json", 2);
setVersion("lhm.plugin.json", 1, (text) =>
  text.split(`npm ${previous} `).join(`npm ${next} `)
);

execFileSync("npm", ["run", "listings:sync"], {
  cwd: file("."),
  stdio: "inherit",
});

const changelog = readFileSync(file("CHANGELOG.md"), "utf8");
console.log(`\n${previous} -> ${next} in package.json, server.json, lhm.plugin.json.`);
if (!changelog.split(/^## /m).some((s) => s.split("\n")[0].trim().split(" ")[0] === next)) {
  console.log(`Next: add a "## ${next}" section to CHANGELOG.md (the test gate needs it).`);
}
