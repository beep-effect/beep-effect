import { ReactContextInvariantError } from "@beep/ui/lib/react-invariant";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const sameReactContextInvariantError = S.toEquivalence(ReactContextInvariantError);

describe("React invariant tagged-error declared equivalence", () => {
  it("compares ReactContextInvariantError by declared fields", () => {
    const a = ReactContextInvariantError.make({ message: "Provider missing" });
    const b = ReactContextInvariantError.make({ message: "Provider missing" });
    const c = ReactContextInvariantError.make({ message: "Context missing" });

    expect(sameReactContextInvariantError(a, b)).toBe(true);
    expect(sameReactContextInvariantError(a, c)).toBe(false);
  });
});
