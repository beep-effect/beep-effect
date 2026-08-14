import { NonNegativeInt } from "@beep/schema";
import { UsptoError } from "@beep/uspto";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const sameUsptoError = S.toEquivalence(UsptoError);

describe("USPTO declared-field equivalence", () => {
  it("treats field-equal UsptoError instances as equivalent and field-different ones as distinct", () => {
    const a = UsptoError.fromReason("response-status", { cause: "bad status", status: NonNegativeInt.make(429) });
    const b = UsptoError.fromReason("response-status", { cause: "bad status", status: NonNegativeInt.make(429) });
    const c = UsptoError.fromReason("response-status", { cause: "bad status", status: NonNegativeInt.make(500) });

    expect(sameUsptoError(a, b)).toBe(true);
    expect(sameUsptoError(a, c)).toBe(false);
  });
});
