import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../../vitest.shared.ts";

// goals/ is not a workspace package, so it is not picked up by the root
// `projects` globs. This standalone config reuses the shared @beep/* alias
// resolution and points the include at the codemod golden-diff tests. Run:
//   npx vitest run --config goals/one-round-loop/ops/codemods/vitest.config.ts
export default mergeConfig(
  shared,
  defineConfig({
    test: {
      root: new URL(".", import.meta.url).pathname,
      include: ["*.test.ts"],
      sequence: {
        concurrent: false,
      },
      testTimeout: 300_000,
    },
  })
);
