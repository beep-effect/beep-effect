import { PacerAuthError } from "@beep/pacer";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const samePacerAuthError = S.toEquivalence(PacerAuthError);

describe("Pacer declared-field equivalence", () => {
  it("treats field-equal errors as equivalent and field-different ones as distinct", () => {
    const a = PacerAuthError.fromReason("transport", { cause: "connection reset" });
    const b = PacerAuthError.fromReason("transport", { cause: "connection reset" });
    const c = PacerAuthError.fromReason("response-decoding", { cause: "connection reset" });

    expect(samePacerAuthError(a, b)).toBe(true);
    expect(samePacerAuthError(a, c)).toBe(false);
  });
});
