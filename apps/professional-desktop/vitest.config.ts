import * as NodeURL from "node:url";
import * as Str from "effect/String";
import { defineConfig, mergeConfig } from "vitest/config";
import shared, { vitestDoctestActive } from "../../vitest.shared.ts";

// decision: vitest-unit-files-run-isolated
const isolateEachTestFile = true;
const reactConcurrentRenderRecoveryNotice = "error during concurrent rendering";
const extensionlessEsmImportFamilies = [/@mui\/x-/, /core-js-pure/];

export default mergeConfig(
  shared,
  defineConfig({
    resolve: {
      alias: {
        "@": NodeURL.fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    test: {
      isolate: isolateEachTestFile,
      environment: "jsdom",
      onUnhandledError(error: unknown): boolean | undefined {
        const message = error instanceof Error ? error.message : String(error);
        return Str.includes(reactConcurrentRenderRecoveryNotice)(message) ? false : undefined;
      },
      include: vitestDoctestActive ? [] : ["test/**/*.test.{ts,tsx}"],
      exclude: ["test/integration/**"],
      setupFiles: [NodeURL.fileURLToPath(new URL("./test/setup.dom.ts", import.meta.url))],
      server: {
        deps: {
          inline: extensionlessEsmImportFamilies,
        },
      },
    },
  })
);
