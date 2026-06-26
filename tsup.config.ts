import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  outDir: "dist",
  clean: true,
  // Preserve the shebang so `npx`/the bin entry runs under node.
  banner: { js: "#!/usr/bin/env node" },
});
