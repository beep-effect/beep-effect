import { BoxError } from "@beep/box";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const sameBoxError = S.toEquivalence(BoxError);

describe("Box declared-field equivalence", () => {
  it("treats field-equal BoxError instances as equivalent and field-different ones as distinct", () => {
    const a = BoxError.fromReason("response status", { code: "rate_limit" });
    const b = BoxError.fromReason("response status", { code: "rate_limit" });
    const c = BoxError.fromReason("response status", { code: "not_found" });

    expect(sameBoxError(a, b)).toBe(true);
    expect(sameBoxError(a, c)).toBe(false);
  });
});
