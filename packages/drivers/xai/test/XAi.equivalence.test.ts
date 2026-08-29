import { XAiError } from "@beep/xai";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const sameXAiError = S.toEquivalence(XAiError);

describe("xAI declared-field equivalence", () => {
  it("treats field-equal errors as equivalent and field-different errors as distinct", () => {
    const a = XAiError.config();
    const b = XAiError.config();
    const c = XAiError.make({ reason: "transport" });

    expect(sameXAiError(a, b)).toBe(true);
    expect(sameXAiError(a, c)).toBe(false);
  });

  it("treats defect-only differences as equivalent", () => {
    const a = XAiError.config(new Error("first failure"));
    const b = XAiError.config(new Error("second failure"));

    // the defect cause is payload, never identity
    expect(sameXAiError(a, b)).toBe(true);
  });
});
