import * as NodeURL from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// decision: eager-browser-dependencies
const config = defineConfig({
  optimizeDeps: {
    include: [
      "effect/Number",
      "effect/Utils",
      "effect/encoding/Hex",
      "effect/http/FetchHttpClient",
      "effect/reactivity/AsyncResult",
      "effect/reactivity/Atom",
      "effect/reactivity/AtomRegistry",
      "effect/reactivity/AtomRpc",
      "effect/reactivity/Reactivity",
      "effect/rpc/Rpc",
      "effect/rpc/RpcClient",
      "effect/rpc/RpcGroup",
      "effect/rpc/RpcSerialization",
      "effect/schema/Model",
    ],
  },
  plugins: [
    storybookTest({
      configDir: NodeURL.fileURLToPath(new URL(".storybook", import.meta.url)),
    }),
  ],
  resolve: {
    alias: [
      {
        find: /^@beep\/utils$/,
        replacement: NodeURL.fileURLToPath(new URL(".storybook/utils-browser.ts", import.meta.url)),
      },
    ],
  },
  test: {
    name: "storybook",
    fileParallelism: false,
    maxConcurrency: 1,
    maxWorkers: 1,
    sequence: {
      concurrent: false,
    },
    setupFiles: [NodeURL.fileURLToPath(new URL("vitest.storybook.setup.ts", import.meta.url))],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({}),
      instances: [{ browser: "chromium" }],
    },
  },
});

export default config;
