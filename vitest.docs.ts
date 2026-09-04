import * as Doctest from "@effect/doctest/Plugin";
import { defineConfig } from "vitest/config";
import shared from "./vitest.shared.ts";

export default defineConfig({
  ...shared,
  plugins: [...(shared.plugins ?? []), Doctest.plugin()],
  test: {
    ...shared.test,
    exclude: [...(shared.test?.exclude ?? []), "**/test/fixtures/**"],
    include: [],
    includeSource: ["packages/**/src/**/*.{ts,tsx}", "apps/**/src/**/*.{ts,tsx}"],
    passWithNoTests: true,
    testTimeout: 30_000,
    sequence: {
      ...shared.test?.sequence,
      concurrent: false,
    },
  },
});
