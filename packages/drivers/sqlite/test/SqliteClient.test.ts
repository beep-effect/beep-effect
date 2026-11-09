/**
 * The client half of this suite is Bun-only: `@effect/sql-sqlite-bun` imports
 * `bun:sqlite`, so the driver module is loaded with a dynamic import inside a
 * block that is skipped under Node. The error schema half runs on both
 * runtimes because `@beep/sqlite/Sqlite.errors` has no Bun dependency.
 */
import { SqliteError } from "@beep/sqlite/Sqlite.errors";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";

class SqliteClientTestLoadError extends S.TaggedError<SqliteClientTestLoadError, { readonly brand: unique symbol }>()(
  "SqliteClientTestLoadError",
  { cause: S.Defect({ includeStack: true }) },
  { description: "Failed to load the Bun-only @beep/sqlite driver module in SqliteClient.test.ts." }
) {}

const isBunRuntime = P.isNotUndefined(process.versions.bun);

const loadDriver = Effect.tryPromise({
  try: () => import("@beep/sqlite"),
  catch: (cause) => SqliteClientTestLoadError.make({ cause }),
});

const DriverTestLayer = Layer.unwrap(Effect.map(loadDriver, (driver) => driver.SqliteTestLayer));

describe("SqliteError", () => {
  it("normalizes an unknown failure into the tagged driver error", () => {
    const error = SqliteError.fromUnknown("connect", new Error("boom"));

    expect(error).toBeInstanceOf(SqliteError);
    expect(error._tag).toBe("SqliteError");
    expect(error.operation).toBe("connect");
    expect(O.getOrNull(error.message)).toBe("boom");
  });
});

describe.skipIf(!isBunRuntime)("SqliteClient (Bun runtime)", () => {
  it.layer(DriverTestLayer, { timeout: "30 seconds" })("in-memory test layer", (it) => {
    it.effect(
      "executes select 1 through the generic SqlClient",
      Effect.fnUntraced(function* () {
        const sql = (yield* SqlClient.SqlClient).withoutTransforms();
        const rows = yield* sql<{ readonly one: number }>`SELECT 1 AS one`;

        expect(A.map(rows, (row) => row.one)).toEqual([1]);
      })
    );

    it.effect(
      "probes FTS5 support as a boolean without failing",
      Effect.fnUntraced(function* () {
        const driver = yield* loadDriver;
        const enabled = yield* driver.probeFts5;

        expect(enabled).toBeTypeOf("boolean");
      })
    );

    it.effect(
      "fails loadExtensions with a loadExtension-scoped SqliteError",
      Effect.fnUntraced(function* () {
        const driver = yield* loadDriver;
        const error = yield* Effect.flip(driver.loadExtensions(["/nonexistent"]));

        expect(error).toBeInstanceOf(SqliteError);
        expect(error.operation).toBe("loadExtension");
      })
    );
  });
});
