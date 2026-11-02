import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { replayNamedCleanerScenes } from "../CitationCleanerNamedReplay.fixtures.ts";
import { CitationNativeExitCounts, makeCitationObservedSpawner } from "../CitationNativeSpawner.fixtures.ts";

// Real HTML bodies run in hosted integration; declaration rejection stays before spawn.
it.layer(Layer.merge(BunServices.layer, BunCrypto.layer), { excludeTestServices: true })(
  "native named cleaner source sequences",
  (it) => {
    it.effect(
      "matches all 504 HTML sequences, builtin boundaries, failure categories, identities and final bindings",
      () =>
        Effect.gen(function* () {
          const native = yield* makeCitationObservedSpawner();
          expect(yield* replayNamedCleanerScenes("html", native.spawner)).toEqual({
            cases: 504,
            successes: 304,
            parseFailures: 142,
            declarationFailures: 58,
            unknownSteps: 0,
            events: 2416,
          });
          expect(yield* native.snapshot).toEqual(CitationNativeExitCounts.make({ spawned: 507, confirmed: 507 }));
        }),
      { timeout: 1_200_000 }
    );
  }
);
