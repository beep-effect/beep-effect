import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import { withDuckDb } from "@beep/repo-cli-kit/duckdb/WithDuckDb";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";

const memory = DuckDbConnectionOptions.make({ databasePath: ":memory:" });

const answer = Effect.gen(function* () {
  const duckdb = yield* DuckDb;
  return yield* duckdb.query("SELECT 41 + 1 AS answer");
});

describe("duckdb/WithDuckDb", () => {
  it.effect("provides a scoped DuckDb connection, data-first and data-last", () =>
    Effect.gen(function* () {
      const dataFirst = yield* withDuckDb(answer, memory);
      expect(Number(dataFirst[0]?.answer)).toBe(42);
      const dataLast = yield* pipe(answer, withDuckDb(memory));
      expect(Number(dataLast[0]?.answer)).toBe(42);
    })
  );

  it.effect("keeps the wrapped effect's failure", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(withDuckDb(Effect.fail("wrapped" as const), memory));
      expect(failure).toBe("wrapped");
    })
  );
});
