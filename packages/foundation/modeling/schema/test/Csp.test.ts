import { CspDirectives } from "@beep/schema/Csp";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const decodeUnknownCspDirectivesSync = S.decodeUnknownSync(CspDirectives);
const encodeCspDirectivesSync = S.encodeSync(CspDirectives);

describe("CspDirectives", () => {
  it("round-trips schema-derived directive-field samples through encode/decode", () => {
    const arbitrary = S.toArbitrary(CspDirectives)(fc);
    fc.assert(
      fc.property(arbitrary, (directives) => {
        const encoded = encodeCspDirectivesSync(directives);
        const decoded = decodeUnknownCspDirectivesSync(encoded);
        expect(encodeCspDirectivesSync(decoded)).toEqual(encoded);
      }),
      { numRuns: 25 }
    );
  });

  it("still supports mapFields after the S.Class conversion", () => {
    expect(typeof CspDirectives.mapFields).toBe("function");
  });
});
