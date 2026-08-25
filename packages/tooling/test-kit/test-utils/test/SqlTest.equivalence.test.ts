import { SqlTestHarnessError } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const sameSqlTestHarnessError = S.toEquivalence(SqlTestHarnessError);

describe("SqlTestHarnessError declared-field equivalence", () => {
  it("compares stable fields and ignores the opaque cause", () => {
    const a = SqlTestHarnessError.make({
      cause: O.some("same cause"),
      driver: "node-sqlite",
      message: "setup failed",
      phase: "provision",
    });
    const b = SqlTestHarnessError.make({
      cause: O.some("same cause"),
      driver: "node-sqlite",
      message: "setup failed",
      phase: "provision",
    });
    const different = SqlTestHarnessError.make({
      cause: O.some("same cause"),
      driver: "bun-sqlite",
      message: "setup failed",
      phase: "provision",
    });
    const differentCause = SqlTestHarnessError.make({
      cause: O.some("different cause"),
      driver: "node-sqlite",
      message: "setup failed",
      phase: "provision",
    });

    expect(sameSqlTestHarnessError(a, b)).toBe(true);
    expect(sameSqlTestHarnessError(a, different)).toBe(false);
    expect(sameSqlTestHarnessError(a, differentCause)).toBe(true);
  });
});
