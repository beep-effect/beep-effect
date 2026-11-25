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

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      // Tests here mock modules, stub globals, or change the working directory; keep every file in
      // its own worker even under coverage (vitest.shared.ts shares the graph there by default).
      isolate: true,
      globals: true,
      // Runtime harnesses opt in when launching their fixture subprocesses.
      exclude: instrumentedFixture ? [] : ["test/fixtures/**"],
      // This package owns the shared PGLite integration harness. The CI server
      // is single-connection, so package files cannot run concurrently when the
      // shared external URL is present.
      sequence: {
        concurrent: false,
      },
    },
  })
);
