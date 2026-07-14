import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      environment: "jsdom",
      include: ["scratchpad/dockview-react/test/**/*.test.{ts,tsx}"],
      setupFiles: [new URL("./test/setup.dom.ts", import.meta.url).pathname],
    },
  })
);
