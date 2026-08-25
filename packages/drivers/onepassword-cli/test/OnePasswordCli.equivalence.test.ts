import { OnePasswordCliError } from "@beep/onepassword-cli";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const sameOnePasswordCliError = S.toEquivalence(OnePasswordCliError);

describe("1Password CLI declared-field equivalence", () => {
  it("treats field-equal errors as equivalent and field-different ones as distinct", () => {
    const a = OnePasswordCliError.fromUnknown("read", "Secret read failed.", { command: "op" });
    const b = OnePasswordCliError.fromUnknown("read", "Secret read failed.", { command: "op" });
    const c = OnePasswordCliError.fromUnknown("read", "Secret read timed out.", { command: "op" });

    expect(sameOnePasswordCliError(a, b)).toBe(true);
    expect(sameOnePasswordCliError(a, c)).toBe(false);
  });

  it("treats defect-only differences as equivalent", () => {
    const a = OnePasswordCliError.fromUnknown("read", "Secret read failed.", { cause: new Error("first failure") });
    const b = OnePasswordCliError.fromUnknown("read", "Secret read failed.", { cause: new Error("second failure") });

    // the defect cause is payload, never identity
    expect(sameOnePasswordCliError(a, b)).toBe(true);
  });
});
