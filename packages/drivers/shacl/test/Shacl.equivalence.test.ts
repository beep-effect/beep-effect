import { ShaclEngineError } from "@beep/shacl";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const sameShaclEngineError = S.toEquivalence(ShaclEngineError);

describe("SHACL declared-field equivalence", () => {
  it("treats field-equal errors as equivalent and field-different errors as distinct", () => {
    const a = ShaclEngineError.make({ message: "validation failed", reason: "validationFailed" });
    const b = ShaclEngineError.make({ message: "validation failed", reason: "validationFailed" });
    const c = ShaclEngineError.make({ message: "validation failed", reason: "datasetLoadFailed" });

    expect(sameShaclEngineError(a, b)).toBe(true);
    expect(sameShaclEngineError(a, c)).toBe(false);
  });
});
