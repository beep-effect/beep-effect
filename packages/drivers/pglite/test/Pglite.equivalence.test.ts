import { PgliteError } from "@beep/pglite";
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const samePgliteError = S.toEquivalence(PgliteError);

describe("PgliteError declared-field equivalence", () => {
  it("treats field-equal errors as equivalent and field-different errors as distinct", () => {
    const a = PgliteError.make({ cause: O.some(new Error("connect failed")), operation: "connect" });
    const b = PgliteError.make({ cause: O.some(new Error("connect failed")), operation: "connect" });
    const c = PgliteError.make({ cause: O.some(new Error("connect failed")), operation: "query" });
    const d = PgliteError.make({ cause: O.some(new Error("other failure")), operation: "connect" });

    expect(samePgliteError(a, b)).toBe(true);
    expect(samePgliteError(a, c)).toBe(false);
    // the defect cause is payload, never identity
    expect(samePgliteError(a, d)).toBe(true);
  });
});
