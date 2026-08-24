import { VeniceAIError } from "@beep/venice-ai";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const sameVeniceAIError = S.toEquivalence(VeniceAIError);

describe("Venice AI declared-field equivalence", () => {
  it("treats field-equal errors as equivalent and field-different errors as distinct", () => {
    const a = VeniceAIError.config();
    const b = VeniceAIError.config();
    const c = VeniceAIError.make({ reason: "transport" });

    expect(sameVeniceAIError(a, b)).toBe(true);
    expect(sameVeniceAIError(a, c)).toBe(false);
  });
});
