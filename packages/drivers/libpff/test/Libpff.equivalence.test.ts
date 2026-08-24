import { LibpffError } from "@beep/libpff";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const sameLibpffError = S.toEquivalence(LibpffError);

describe("Libpff declared-field equivalence", () => {
  it("treats field-equal LibpffError instances as equivalent and field-different ones as distinct", () => {
    const a = LibpffError.fromReason("process");
    const b = LibpffError.fromReason("process");
    const c = LibpffError.fromReason("timeout");

    expect(sameLibpffError(a, b)).toBe(true);
    expect(sameLibpffError(a, c)).toBe(false);
  });
});
