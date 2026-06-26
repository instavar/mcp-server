import { defineConfig } from "vitest/config";

// Local config so vitest does NOT walk up and inherit the root monorepo's
// `projects` config (which references files outside this package).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
