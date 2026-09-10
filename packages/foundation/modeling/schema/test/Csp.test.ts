import { CspDirectives } from "@beep/schema/Csp";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeUnknownCspDirectivesSync = S.decodeUnknownSync(CspDirectives);
const encodeCspDirectivesSync = S.encodeSync(CspDirectives);

describe("CspDirectives", () => {
  it("round-trips schema-derived directive-field samples through encode/decode", () => {
    const arbitrary = Arbitrary.schema(CspDirectives);
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([arbitrary]),
          ([directives]) => {
            const encoded = encodeCspDirectivesSync(directives);
            const decoded = decodeUnknownCspDirectivesSync(encoded);
            expect(encodeCspDirectivesSync(decoded)).toEqual(encoded);

            return true;
          },
          { runs: 25 }
        )
      )
    ).toMatchObject({ _tag: "Passed" });
  });

  it("still supports mapFields after the S.Class conversion", () => {
    expect(typeof CspDirectives.mapFields).toBe("function");
  });
});
