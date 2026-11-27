import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../vitest.shared.ts";

const filesMockModulesStubGlobalsOrChdir = true;

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      isolate: filesMockModulesStubGlobalsOrChdir,
      environment: "happy-dom",
      testTimeout: 30_000,
    },
  })
);
