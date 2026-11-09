import { SqliteError } from "@beep/sqlite/Sqlite.errors";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const sameSqliteError = S.toEquivalence(SqliteError);

describe("SqliteError declared-field equivalence", () => {
  it("treats field-equal errors as equivalent and field-different errors as distinct", () => {
    const a = SqliteError.make({ cause: O.some(new Error("database is locked")), operation: "connect" });
    const b = SqliteError.make({ cause: O.some(new Error("database is locked")), operation: "connect" });
    const c = SqliteError.make({ cause: O.some(new Error("database is locked")), operation: "loadExtension" });
    const d = SqliteError.make({ cause: O.some(new Error("other failure")), operation: "connect" });

    expect(sameSqliteError(a, b)).toBe(true);
    expect(sameSqliteError(a, c)).toBe(false);
    // the defect cause is payload, never identity
    expect(sameSqliteError(a, d)).toBe(true);
  });

  it("keeps the native failure as the cause and leaves both options empty without one", () => {
    const cause = new Error("no such module: fts5");
    assertSome(SqliteError.fromUnknown("probeFts5", cause).cause, cause);

    const bare = SqliteError.fromUnknown("loadExtension");
    assertNone(bare.cause);
    assertNone(bare.message);
  });
});
