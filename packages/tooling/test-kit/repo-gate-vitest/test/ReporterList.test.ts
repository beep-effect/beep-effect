import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import { configDefaults } from "vitest/config";
import { createVitest } from "vitest/node";

const nameOf = (reporter: unknown): unknown => (A.isArray(reporter) ? reporter[0] : reporter);

it.layer(NodeServices.layer, { timeout: "60 seconds" })("shared config", (it) => {
  it.effect("the resolved reporter list is Vitest's default selection plus the adapter", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const config = path.resolve(import.meta.dirname, "../vitest.config.ts");
      yield* Effect.acquireUseRelease(
        Effect.promise(() => createVitest({ config, watch: false })),
        (vitest) =>
          Effect.sync(() => {
            assert.deepStrictEqual(A.map(vitest.config.reporters, nameOf), [
              ...configDefaults.reporters,
              "@beep/repo-gate-vitest/Vitest.reporter",
            ]);
          }),
        (vitest) => Effect.promise(() => vitest.close())
      );
    })
  );
});
