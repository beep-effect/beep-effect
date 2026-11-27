import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Str from "effect/String";
import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../../vitest.shared.ts";

const instrumentedFixture = Config.String("BEEP_INSTRUMENTED_IT_FIXTURE").pipe(
  Config.withDefault(""),
  Effect.map(Str.isNonEmpty),
  Effect.runSync
);

/**
 * Vitest configuration for the shared test utilities.
 *
 * **Gotchas**
 *
 * Tests run in order: this package owns the shared PGLite integration harness, and the CI
 * server behind the shared external URL accepts one connection at a time.
 *
 * @category configuration
 * @since 0.0.0
 */
export default mergeConfig(
  shared,
  defineConfig({
    test: {
      isolate: true,
      globals: true,
      exclude: instrumentedFixture ? [] : ["test/fixtures/**"],
      sequence: {
        concurrent: false,
      },
    },
  })
);
