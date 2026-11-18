import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      // alchemy brands Unowned reads with a module-private symbol; inlining keeps the
      // engine and the providers on one module instance.
      server: { deps: { inline: [/alchemy/] } },
    },
  })
);
