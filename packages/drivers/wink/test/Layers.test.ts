import { tokenCount } from "@beep/nlp-processing/Core/Tokenization";
import { it } from "@beep/test-runner";
import { WinkEngine, WinkLayerAllLive } from "@beep/wink";
import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";

describe("Layers", () => {
  it.layer(WinkLayerAllLive)("provides the wink driver bundle with engine and tokenization access", (it) => {
    it.effect("provides the wink driver bundle with engine and tokenization access", () =>
      Effect.gen(function* () {
        const engine = yield* WinkEngine;
        const count = yield* tokenCount("Ada wrote code.");
        const its = yield* engine.its;

        const result = {
          count,
          hasIts: typeof its === "object",
        };

        expect(result.count).toBe(4);
        expect(result.hasIts).toBe(true);
      })
    );
  });
});
