import { PhoenixError } from "@beep/phoenix";
import { it } from "@beep/test-runner";
import { describe } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import * as S from "effect/Schema";

const samePhoenixError = S.toEquivalence(PhoenixError);

describe("Phoenix declared-field equivalence", () => {
  it("treats field-equal errors as equivalent and field-different errors as distinct", () => {
    const a = PhoenixError.operation("doctor", "transport", { cause: "offline" });
    const b = PhoenixError.operation("doctor", "transport", { cause: "offline" });
    const c = PhoenixError.operation("init", "transport", { cause: "offline" });

    assertTrue(samePhoenixError(a, b));
    assertFalse(samePhoenixError(a, c));
  });

  it("treats defect-only differences as equivalent", () => {
    const a = PhoenixError.operation("doctor", "transport", { cause: new TypeError("boom") });
    const b = PhoenixError.operation("doctor", "transport", { cause: new RangeError("boom") });

    // the defect cause is payload, never identity
    assertTrue(samePhoenixError(a, b));
  });
});
