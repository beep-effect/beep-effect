import { fcRuns } from "@beep/fc-runs";
import { CspDirectives } from "@beep/schema/Csp";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeUnknownCspDirectivesEffect = S.decodeUnknownEffect(CspDirectives);
const encodeCspDirectivesEffect = S.encodeEffect(CspDirectives);

describe("CspDirectives", () => {
  {
    const arbitrary = Arbitrary.schema(CspDirectives);
    it.effect.prop(
      "round-trips schema-derived directive-field samples through encode/decode",
      [arbitrary],
      Effect.fnUntraced(function* ([directives]) {
        const encoded = yield* encodeCspDirectivesEffect(directives);
        const decoded = yield* decodeUnknownCspDirectivesEffect(encoded);
        expect(yield* encodeCspDirectivesEffect(decoded)).toEqual(encoded);

        return true;
      }),
      { arbitrary: fcRuns(25) }
    );
  }

  it("still supports mapFields after the S.Class conversion", () => {
    expect(typeof CspDirectives.mapFields).toBe("function");
  });
});
