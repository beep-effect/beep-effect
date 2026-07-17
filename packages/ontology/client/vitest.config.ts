import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      // Browser-mode suites live under test/browser/** and run via the
      // separate vitest.browser.config.ts (`bun run test:browser`) so the
      // default CI test lane never needs a Playwright browser install.
      exclude: ["test/browser/**"],
    },
  })
);
