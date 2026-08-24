import { PhoenixError } from "@beep/phoenix";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const samePhoenixError = S.toEquivalence(PhoenixError);

describe("Phoenix declared-field equivalence", () => {
  it("treats field-equal errors as equivalent and field-different errors as distinct", () => {
    const a = PhoenixError.operation("doctor", "transport", { cause: "offline" });
    const b = PhoenixError.operation("doctor", "transport", { cause: "offline" });
    const c = PhoenixError.operation("init", "transport", { cause: "offline" });

    expect(samePhoenixError(a, b)).toBe(true);
    expect(samePhoenixError(a, c)).toBe(false);
  });
});
