import * as Doctest from "@effect/doctest/Plugin";
import { defineConfig } from "vitest/config";

// The module under test is selected by the runner through EFFECTED_MODULE
// (scratchpad/effected/audit.ts); `runner` is the runner's own pseudo-module.
const target = process.env["EFFECTED_MODULE"] ?? "runner";
const include =
  target === "jsonl"
    ? ["scratchpad/test/jsonl.test.ts", "scratchpad/test/jsonl/**/*.test.ts"]
    : [`scratchpad/test/${target}/**/*.test.ts`];

export default defineConfig({
  plugins: [Doctest.plugin()],
  test: {
    include,
    includeSource: [`scratchpad/effected/${target}/**/*.ts`],
    passWithNoTests: false,
    // engine: upstream's test task runs after build:dev; the entrypoint suite walks its output.
    globalSetup: target === "engine" ? ["scratchpad/test/engine/build.setup.ts"] : [],
    // cli registers its snapshot serializer through the config, as upstream's root config does (effected#909).
    snapshotSerializers: target === "cli" ? ["scratchpad/effected/cli/ui-testing-serializer.ts"] : [],
    // memfs: the node-adapter errno parity fixtures assume tmpfs semantics (btrfs lets
    // copyFile read an empty directory, where the asserted EISDIR comes from tmpfs).
    env: target === "memfs" ? { TMPDIR: "/tmp" } : {},
    coverage: {
      provider: "v8",
      include: [`scratchpad/effected/${target}/**/*.ts`],
      reporter: ["text", "json", "json-summary", "html"],
      reportsDirectory: `coverage/scratchpad-effected/${target}`,
      thresholds: { perFile: true, statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
