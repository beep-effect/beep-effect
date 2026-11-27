import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../../vitest.shared.ts";

// decision: alchemy-inlined-in-vitest
const alchemySingleModuleInstance = [/alchemy/];

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      server: { deps: { inline: alchemySingleModuleInstance } },
    },
  })
);
