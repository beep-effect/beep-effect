import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      server: {
        deps: {
          // One module instance for Alchemy's engine and this package's providers:
          // `Unowned` brands `read` results with a module-private symbol.
          inline: [/[\\/]node_modules[\\/]alchemy[\\/]/, /[\\/]node_modules[\\/]@alchemy\.run[\\/]/],
        },
      },
    },
  })
);
