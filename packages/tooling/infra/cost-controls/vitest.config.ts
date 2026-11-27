import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../../vitest.shared.ts";

// decision: alchemy-inlined-in-vitest
const alchemySingleModuleInstance = [/[\\/]node_modules[\\/]alchemy[\\/]/, /[\\/]node_modules[\\/]@alchemy\.run[\\/]/];

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      server: {
        deps: {
          inline: alchemySingleModuleInstance,
        },
      },
    },
  })
);
