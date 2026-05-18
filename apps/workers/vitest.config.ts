import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      // Point workspace packages at their TypeScript source so vitest
      // doesn't need pre-built dist/ artifacts to run tests.
      "@praxisa/audit-sdk": resolve(
        __dirname,
        "../../packages/audit-sdk/src/index.ts",
      ),
      "@praxisa/shared-types": resolve(
        __dirname,
        "../../packages/shared-types/src/index.ts",
      ),
      "@praxisa/policy-engine": resolve(
        __dirname,
        "../../packages/policy-engine/src/index.ts",
      ),
    },
  },
  test: {
    globals: false,
    environment: "node",
  },
});
