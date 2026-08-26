import * as Doctest from "@effect/doctest/Plugin";
import { defineConfig } from "vitest/config";
import shared from "../../../../../../../../vitest.shared.ts";

export default defineConfig({
  ...shared,
  plugins: [...(shared.plugins ?? []), Doctest.plugin()],
  test: {
    ...shared.test,
    include: [],
    includeSource: ["src/**/*.{ts,tsx}"],
    passWithNoTests: false,
    sequence: { ...shared.test?.sequence, concurrent: false },
  },
});
