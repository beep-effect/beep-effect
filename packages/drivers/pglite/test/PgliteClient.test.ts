import { fcRuns } from "@beep/fc-runs";
import { makeLayer, PgliteClient, PgliteError, PgliteTestLayer } from "@beep/pglite";
import * as Pg from "@effect/sql-pg/PgClient";
import { describe, expect, it, layer } from "@effect/vitest";
import { Context, Effect, Exit, Layer, Result, Scope } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import * as SqlClient from "effect/unstable/sql/SqlClient";

const PgliteErrorArbitrary = S.toArbitrary(PgliteError);
const encodePgliteError = S.encodeUnknownResult(PgliteError);
const decodePgliteError = S.decodeUnknownResult(PgliteError);

describe("PgliteError", () => {
  it("normalizes an unknown failure into the tagged driver error", () => {
    const error = PgliteError.fromUnknown("connect", new Error("boom"));

    expect(error).toBeInstanceOf(PgliteError);
    expect(error._tag).toBe("PgliteError");
    expect(error.operation).toBe("connect");
    expect(O.getOrNull(error.message)).toBe("boom");
  });

  it("round-trips schema-derived driver errors through their encoded shape", () =>
    fc.assert(
      fc.property(PgliteErrorArbitrary, (error) => {
        const encoded = Result.getOrThrow(encodePgliteError(error));
        const decoded = Result.getOrThrow(decodePgliteError(encoded));

        expect(decoded).toEqual(error);
      }),
      fcRuns(50)
    ));
});

describe("PgliteClient layer lifecycle", () => {
  it.effect(
    "closes the managed PGlite instance when the layer scope closes",
    () =>
      Effect.gen(function* () {
        const scope = yield* Scope.make();
        const context = yield* Layer.buildWithScope(makeLayer(), scope);
        const client = Context.get(context, PgliteClient);

        yield* Scope.close(scope, Exit.void);

        const queryAfterClose = yield* Effect.exit(Effect.tryPromise(() => client.pglite.query("SELECT 1")));
        expect(queryAfterClose._tag).toBe("Failure");
      }),
    { timeout: 90_000 }
  );
});

layer(PgliteTestLayer)("PgliteClient (in-memory)", (it) => {
  it.effect(
    "executes PostgreSQL-dialect SQL through the generic SqlClient",
    Effect.fnUntraced(function* () {
      const sql = (yield* SqlClient.SqlClient).withoutTransforms();
      yield* sql`CREATE TABLE notes (id SERIAL PRIMARY KEY, body TEXT NOT NULL)`;
      yield* sql`INSERT INTO notes (body) VALUES ('hello'), ('world')`;
      const rows = yield* sql<{ readonly body: string }>`SELECT body FROM notes ORDER BY id`;

      expect(rows.map((row) => row.body)).toEqual(["hello", "world"]);
    })
  );

  it.effect(
    "aliases the in-process client under the @effect/sql-pg PgClient tag",
    Effect.fnUntraced(function* () {
      const pg = yield* Pg.PgClient;
      const pglite = yield* PgliteClient;

      // The tag-shim exposes the very same PgliteClient value under the PgClient
      // tag, which is what lets drizzle-orm/effect-postgres run in-process.
      expect(pg).toBe(pglite);
    })
  );
});
