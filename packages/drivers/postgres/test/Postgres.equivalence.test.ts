import { PostgresError } from "@beep/postgres";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const samePostgresError = S.toEquivalence(PostgresError);

describe("Postgres declared-field equivalence", () => {
  it("treats field-equal PostgresError instances as equivalent and field-different ones as distinct", () => {
    const a = PostgresError.fromUnknown("connect");
    const b = PostgresError.fromUnknown("connect");
    const c = PostgresError.fromUnknown("query");

    expect(samePostgresError(a, b)).toBe(true);
    expect(samePostgresError(a, c)).toBe(false);
  });

  it("treats defect-only differences as equivalent", () => {
    const context = { message: "connection reset", sourceLocation: "db.ts:1:1" };
    const a = PostgresError.fromUnknown("connect", new Error("first failure"), context);
    const b = PostgresError.fromUnknown("connect", new Error("second failure"), context);

    // the defect cause is payload, never identity
    expect(samePostgresError(a, b)).toBe(true);
  });
});
