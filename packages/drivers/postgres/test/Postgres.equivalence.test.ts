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
});
