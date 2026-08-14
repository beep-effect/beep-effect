import { EcfrError } from "@beep/ecfr";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const sameEcfrError = S.toEquivalence(EcfrError);

describe("eCFR declared-field equivalence", () => {
  it("treats field-equal EcfrError instances as equivalent and field-different ones as distinct", () => {
    const a = EcfrError.of("transport");
    const b = EcfrError.of("transport");
    const c = EcfrError.of("response decoding");

    expect(sameEcfrError(a, b)).toBe(true);
    expect(sameEcfrError(a, c)).toBe(false);
  });
});
