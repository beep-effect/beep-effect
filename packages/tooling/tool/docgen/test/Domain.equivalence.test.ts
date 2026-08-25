import { Domain } from "@beep/repo-docgen";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const sameDocgenError = S.toEquivalence(Domain.DocgenError);

describe("DocgenError declared-field equivalence", () => {
  it("treats field-equal instances as equivalent and field-different instances as distinct", () => {
    const a = Domain.DocgenError.make({ message: "generation failed" });
    const b = Domain.DocgenError.make({ message: "generation failed" });
    const different = Domain.DocgenError.make({ message: "parsing failed" });

    expect(sameDocgenError(a, b)).toBe(true);
    expect(sameDocgenError(a, different)).toBe(false);
  });
});
