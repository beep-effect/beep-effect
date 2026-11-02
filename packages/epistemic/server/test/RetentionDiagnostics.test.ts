import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as SqlError from "effect/sql/SqlError";
import { retentionReadFailureKind } from "#retention-diagnostics";

it("preserves diagnostic categories while excluding messages, SQL and credentials", () => {
  const sensitive = "redaction-canary: password, SQL and payload";
  const connection = SqlError.SqlError.make({ reason: SqlError.ConnectionError.make({ cause: sensitive }) });
  const permission = SqlError.SqlError.make({ reason: SqlError.AuthorizationError.make({ cause: sensitive }) });
  const cases: ReadonlyArray<readonly [unknown, string]> = [
    [{ _tag: "EdgeVersionConverterError", message: sensitive }, "EdgeVersionConverterError"],
    [{ _tag: "ClaimDispositionConverterError", message: sensitive }, "ClaimDispositionConverterError"],
    [connection, "ConnectionError"],
    [permission, "AuthorizationError"],
    [{ _tag: "EffectDrizzleQueryError", cause: Cause.fail(connection) }, "ConnectionError"],
    [{ _tag: "EffectDrizzleQueryError", cause: permission }, "AuthorizationError"],
    [{ _tag: "EffectDrizzleQueryError", cause: sensitive }, "QueryError"],
    [new Error(sensitive), "DatabaseError"],
  ];
  for (const [error, expected] of cases) {
    const category = retentionReadFailureKind(error);
    expect(category).toBe(expected);
    expect(category).not.toContain(sensitive);
  }
});
