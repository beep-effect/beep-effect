import { DrizzleError, DrizzleOperation } from "@beep/drizzle";
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const sameDrizzleError = S.toEquivalence(DrizzleError);

describe("DrizzleError declared-field equivalence", () => {
  it("treats field-equal errors as equivalent and field-different errors as distinct", () => {
    const a = DrizzleError.make({
      cause: O.some(new Error("query failed")),
      operation: DrizzleOperation.Enum.execute,
    });
    const b = DrizzleError.make({
      cause: O.some(new Error("query failed")),
      operation: DrizzleOperation.Enum.execute,
    });
    const c = DrizzleError.make({
      cause: O.some(new Error("other failure")),
      operation: DrizzleOperation.Enum.execute,
    });

    expect(sameDrizzleError(a, b)).toBe(true);
    expect(sameDrizzleError(a, c)).toBe(false);
  });
});
