import { N3TurtleCodecError } from "@beep/n3";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const sameN3TurtleCodecError = S.toEquivalence(N3TurtleCodecError);

describe("N3 declared-field equivalence", () => {
  it("treats field-equal errors as equivalent and field-different errors as distinct", () => {
    const a = N3TurtleCodecError.make({ message: "N3 rejected the source", reason: "parseFailed" });
    const b = N3TurtleCodecError.make({ message: "N3 rejected the source", reason: "parseFailed" });
    const c = N3TurtleCodecError.make({ message: "N3 rejected the source", reason: "serializeFailed" });

    expect(sameN3TurtleCodecError(a, b)).toBe(true);
    expect(sameN3TurtleCodecError(a, c)).toBe(false);
  });
});
