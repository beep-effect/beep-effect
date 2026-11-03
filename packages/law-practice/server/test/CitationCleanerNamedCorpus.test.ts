import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { replayNamedCleanerScenes } from "./CitationCleanerNamedReplay.fixtures.ts";

it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("admitted named source sequences", (it) => {
  it.effect(
    "matches all 600 non-HTML named/official outcomes, builtin boundaries and final registry state",
    () =>
      Effect.gen(function* () {
        const citationResult1 = yield* replayNamedCleanerScenes("literal");
        expect(citationResult1).toEqual({
          cases: 600,
          successes: 599,
          parseFailures: 0,
          declarationFailures: 0,
          unknownSteps: 1,
          events: 3200,
        });
      }),
    { timeout: 30_000 }
  );
});
