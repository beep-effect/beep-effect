import { fcRuns } from "@beep/fc-runs";
import { makeLayer, PgliteClient, PgliteError, PgliteTestLayer } from "@beep/pglite";
import { it } from "@beep/test-runner";
import * as Pg from "@effect/sql-pg/PgClient";
import { describe, expect } from "@effect/vitest";
import { Context, Effect, Exit, Layer, Result, Scope } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as SqlClient from "effect/unstable/sql/SqlClient";

const PgliteErrorArbitrary = Arbitrary.schema(PgliteError).pipe(Arbitrary.filter((error) => O.isNone(error.cause)));
// Generate the declared fields from the production schema, then constrain the
// opaque payload to a native Error with stable, explicitly retained fields.
const PgliteErrorWithCauseArbitrary = Arbitrary.schema(PgliteError).pipe(
  Arbitrary.map((error) => {
    const cause = new Error(error.operation, { cause: "native database failure" });
    cause.name = "PgliteNativeError";
    cause.stack = "PGlite native stack";
    return PgliteError.make({ operation: error.operation, message: error.message, cause: O.some(cause) });
  })
);
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

  it.prop(
    "round-trips schema-derived driver errors through their encoded shape",
    [PgliteErrorArbitrary],
    ([error]) => {
      const encoded = Result.getOrThrow(encodePgliteError(error));
      const decoded = Result.getOrThrow(decodePgliteError(encoded));

      expect(decoded).toEqual(error);
    },
    { arbitrary: fcRuns(50) }
  );

  it.effect.prop(
    "preserves cause-bearing driver error fields and encoded codec stability",
    [PgliteErrorWithCauseArbitrary],
    ([error]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(PgliteError)(error);
        const decoded = yield* S.decodeEffect(PgliteError)(encoded);
        expect(yield* S.encodeEffect(PgliteError)(decoded)).toEqual(encoded);
        expect(decoded.operation).toBe(error.operation);
        expect(decoded.message).toEqual(error.message);
        const cause = yield* S.decodeUnknownEffect(S.ErrorInstance())(yield* Effect.fromOption(decoded.cause));
        expect(cause.name).toBe("PgliteNativeError");
        expect(cause.message).toBe(error.operation);
        expect(cause.stack).toBe("PGlite native stack");
        expect(cause.cause).toBe("native database failure");
      }),
    { arbitrary: fcRuns(50) }
  );
});

describe("PgliteClient layer lifecycle", () => {
  it.effect(
    "closes the managed PGlite instance when the layer scope closes",
    () =>
      Effect.scopedWith((scope) =>
        Effect.gen(function* () {
          yield* Effect.log("PGlite phase: acquire in-process database");
          const context = yield* Layer.buildWithScope(makeLayer(), scope);
          const client = Context.get(context, PgliteClient);

          yield* Effect.log("PGlite phase: explicitly close database scope");
          yield* Scope.close(scope, Exit.void);

          yield* Effect.log("PGlite phase: verify query failure after close");
          const queryAfterClose = yield* Effect.exit(Effect.tryPromise(() => client.pglite.query("SELECT 1")));
          expect(queryAfterClose._tag).toBe("Failure");
        })
      ),
    { timeout: 90_000 }
  );
});

it.layer(PgliteTestLayer, { timeout: "30 seconds" })("PgliteClient (in-memory)", (it) => {
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
