import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../../vitest.shared.ts";

/**
 * Vitest configuration for the test runner package.
 *
 * **Details**
 *
 * Every test file shares one worker and one module graph, so each package run exercises the
 * instrumentation cached across files. Tests run in order because lifecycle assertions inspect
 * earlier tests.
 *
 * @category configuration
 * @since 0.0.0
 */
export default mergeConfig(
  shared,
  defineConfig({
    test: {
      isolate: false,
      maxWorkers: 1,
      sequence: { concurrent: false },
    },
  })
);
