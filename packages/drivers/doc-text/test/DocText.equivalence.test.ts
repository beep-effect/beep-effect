import { DocTextError } from "@beep/doc-text";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as S from "effect/Schema";

const sameDocTextError = S.toEquivalence(DocTextError);

describe("DocText declared-field equivalence", () => {
  it("treats field-equal DocTextError instances as equivalent and field-different ones as distinct", () => {
    const a = DocTextError.fromReason("extraction");
    const b = DocTextError.fromReason("extraction");
    const c = DocTextError.fromReason("input-limit");

    expect(sameDocTextError(a, b)).toBe(true);
    expect(sameDocTextError(a, c)).toBe(false);
  });
});
