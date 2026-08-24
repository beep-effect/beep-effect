import { WinkEngineError } from "@beep/wink";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const sameWinkEngineError = S.toEquivalence(WinkEngineError);

describe("Wink declared-field equivalence", () => {
  it("compares diagnostic identity while excluding the opaque defect cause", () => {
    const a = WinkEngineError.make({ cause: "first", message: "runtime failed", operation: "initialize" });
    const b = WinkEngineError.make({ cause: "first", message: "runtime failed", operation: "initialize" });
    const c = WinkEngineError.make({ cause: "first", message: "runtime failed", operation: "read" });
    const differentCause = WinkEngineError.make({
      cause: "second",
      message: "runtime failed",
      operation: "initialize",
    });

    expect(sameWinkEngineError(a, b)).toBe(true);
    expect(sameWinkEngineError(a, c)).toBe(false);
    expect(sameWinkEngineError(a, differentCause)).toBe(true);
  });
});
