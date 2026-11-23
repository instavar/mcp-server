#!/usr/bin/env node
// Print the CHANGELOG.md section for one version (the GitHub Release body).
//   node scripts/changelog-section.mjs 0.9.0 [path/to/CHANGELOG.md]
import { readFileSync } from "node:fs";

const [version, path = new URL("../CHANGELOG.md", import.meta.url)] =
  process.argv.slice(2);
const section = readFileSync(path, "utf8")
  .split(/^## /m)
  .find((s) => s.split("\n")[0].trim().split(" ")[0] === version);
const body = section?.split("\n").slice(1).join("\n").trim();
if (!body) {
  console.error(`CHANGELOG.md has no notes for ${version}`);
  process.exit(1);
}
console.log(body);
