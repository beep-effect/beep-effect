import { it } from "@beep/test-runner";
import { makeUsptoError, UsptoError } from "@beep/uspto";
import { describe, expect } from "@effect/vitest";
import * as S from "effect/Schema";

const sameUsptoError = S.toEquivalence(UsptoError);

describe("USPTO declared-field equivalence", () => {
  it("treats field-equal UsptoError instances as equivalent and field-different ones as distinct", () => {
    const a = UsptoError.fromReason("response-status", { cause: "bad status", status: S.Natural.make(429) });
    const b = UsptoError.fromReason("response-status", { cause: "bad status", status: S.Natural.make(429) });
    const c = UsptoError.fromReason("response-status", { cause: "bad status", status: S.Natural.make(500) });

    expect(sameUsptoError(a, b)).toBe(true);
    expect(sameUsptoError(a, c)).toBe(false);
  });

  it("rejects a negative or fractional status at construction", () => {
    expect(() => UsptoError.fromReason("response-status", { status: -1 })).toThrow();
    expect(() => UsptoError.fromReason("response-status", { status: 1.5 })).toThrow();
    expect(() => makeUsptoError("response-status", { status: -1 })).toThrow();
  });
});
