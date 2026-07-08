import { CspDirectives } from "@beep/schema/Csp";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

describe("CspDirectives", () => {
  it("round-trips schema-derived directive-field samples through encode/decode", () => {
    const arbitrary = S.toArbitrary(CspDirectives);
    const decode = S.decodeUnknownSync(CspDirectives);
    const encode = S.encodeSync(CspDirectives);

    fc.assert(
      fc.property(arbitrary, (directives) => {
        const encoded = encode(directives);
        const decoded = decode(encoded);
        expect(encode(decoded)).toEqual(encoded);
      }),
      { numRuns: 25 }
    );
  });

  it("still supports mapFields after the S.Class conversion", () => {
    expect(typeof CspDirectives.mapFields).toBe("function");
  });
});
