import { Errors } from "@beep/acp";
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const sameAcpError = S.toEquivalence(Errors.AcpError);

describe("ACP declared-field equivalence", () => {
  it("treats field-equal defect-bearing errors as equivalent and field-different ones as distinct", () => {
    const a = Errors.AcpTransportError.make({ cause: O.some(new Error("transport failed")), detail: "closed" });
    const b = Errors.AcpTransportError.make({ cause: O.some(new Error("transport failed")), detail: "closed" });
    const c = Errors.AcpTransportError.make({ cause: O.some(new Error("other failure")), detail: "closed" });

    expect(sameAcpError(a, b)).toBe(true);
    expect(sameAcpError(a, c)).toBe(false);
  });
});
