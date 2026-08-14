import { DuckDbError } from "@beep/duckdb";
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const sameDuckDbError = S.toEquivalence(DuckDbError);

describe("DuckDB declared-field equivalence", () => {
  it("treats field-equal DuckDbError instances as equivalent and field-different ones as distinct", () => {
    const a = DuckDbError.make({
      cause: O.some(new Error("native failed")),
      message: "query failed",
      operation: "query",
    });
    const b = DuckDbError.make({
      cause: O.some(new Error("native failed")),
      message: "query failed",
      operation: "query",
    });
    const c = DuckDbError.make({
      cause: O.some(new Error("other failure")),
      message: "query failed",
      operation: "query",
    });

    expect(sameDuckDbError(a, b)).toBe(true);
    expect(sameDuckDbError(a, c)).toBe(false);
  });
});
