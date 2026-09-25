import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import shared, { vitestDoctestActive } from "../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    test: {
      // Tests here mock modules, stub globals, or change the working directory; keep every file in
      // its own worker even under coverage (vitest.shared.ts shares the graph there by default).
      isolate: true,
      environment: "jsdom",
      include: vitestDoctestActive ? [] : ["test/**/*.test.{ts,tsx}"],
      setupFiles: [new URL("./test/setup.dom.ts", import.meta.url).pathname],
    },
  })
);
