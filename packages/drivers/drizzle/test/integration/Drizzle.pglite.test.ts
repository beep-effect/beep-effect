import { Drizzle, DrizzleError, DrizzleErrorContext } from "@beep/drizzle";
import { makePgliteIntegrationGate } from "@beep/test-utils";
import { A } from "@beep/utils";
import { describe, expect, layer } from "@effect/vitest";
import { Effect, Exit, Layer, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import type { DrizzleClient, DrizzleRows } from "@beep/drizzle";

const { shouldRunPgliteIntegration, makePgliteLayer } = makePgliteIntegrationGate();
const NoteRow = S.Struct({ body: S.String });
const decodeNoteRows = S.decodeUnknownEffect(S.Array(NoteRow));

const createNeutralNotesTable = SqlClient.SqlClient.use((sqlClient) => {
  const sql = sqlClient.withoutTransforms();
  return sql`
    CREATE TABLE neutral_notes (
      id SERIAL PRIMARY KEY,
      body TEXT NOT NULL
    )
  `;
});

const makeSqlBackedDrizzleClient = (sqlClient: SqlClient.SqlClient): DrizzleClient => {
  let client: DrizzleClient;
  const sql = sqlClient.withoutTransforms();

  client = {
    execute: (statement, parameters) =>
      sql.unsafe<Record<string, unknown>>(statement, parameters).pipe(
        Effect.map((rows): DrizzleRows => rows),
        Effect.mapError((cause) =>
          DrizzleError.fromUnknown(
            "execute",
            cause,
            DrizzleErrorContext.make({
              params: O.some(parameters),
              query: O.some(statement),
            })
          )
        )
      ),
    withTransaction: Effect.fn("withTransaction")(
      function* (use) {
        yield* sql`BEGIN`;
        const exit = yield* Effect.exit(use(client));
        if (Exit.isSuccess(exit)) {
          return yield* sql`COMMIT`.pipe(Effect.as(exit.value));
        }

        yield* sql`ROLLBACK`.pipe(Effect.catch(() => Effect.void));
        return yield* Effect.failCause(exit.cause);
      },
      Effect.mapError((cause) => DrizzleError.fromUnknown("withTransaction", cause))
    ),
  };

  return client;
};

const DrizzlePgliteLayer = Layer.unwrap(
  SqlClient.SqlClient.use((sqlClient) => Effect.succeed(Drizzle.makeLayer(makeSqlBackedDrizzleClient(sqlClient))))
).pipe(Layer.provideMerge(makePgliteLayer({ migrate: createNeutralNotesTable })));

const readBodies = (rows: DrizzleRows) =>
  pipe(
    decodeNoteRows(rows),
    Effect.map(A.map((row) => row.body)),
    Effect.mapError((cause) => DrizzleError.fromUnknown("decodeRows", cause))
  );

if (!shouldRunPgliteIntegration) {
  describe.skip("Drizzle PgLite integration", () => {});
} else {
  describe.concurrent("Drizzle PgLite integration", () => {
    layer(DrizzlePgliteLayer, { timeout: "2 minutes" })((it) => {
      it.effect(
        "runs execute and transaction flows against a PgLite-backed adapter",
        Effect.fnUntraced(function* () {
          const drizzle = yield* Drizzle;

          yield* drizzle.execute("INSERT INTO neutral_notes (body) VALUES ($1), ($2)", ["alpha", "beta"]);
          const committed = yield* drizzle.withTransaction(
            Effect.fnUntraced(function* (tx) {
              yield* tx.execute("INSERT INTO neutral_notes (body) VALUES ($1)", ["gamma"]);
              const rows = yield* tx.execute("SELECT body FROM neutral_notes ORDER BY id ASC", []);
              return yield* readBodies(rows);
            })
          );
          const rollback = DrizzleError.fromUnknown("withTransaction", "rollback");
          const rollbackFailure = yield* drizzle
            .withTransaction(
              Effect.fnUntraced(function* (tx) {
                yield* tx.execute("INSERT INTO neutral_notes (body) VALUES ($1)", ["rolled back"]);
                return yield* rollback;
              })
            )
            .pipe(Effect.flip);
          const afterRollback = yield* drizzle.execute("SELECT body FROM neutral_notes ORDER BY id ASC", []);
          const afterRollbackBodies = yield* readBodies(afterRollback);

          expect(committed).toEqual(["alpha", "beta", "gamma"]);
          expect(afterRollbackBodies).toEqual(["alpha", "beta", "gamma"]);
          expect(rollbackFailure).toBeInstanceOf(DrizzleError);
          expect(rollbackFailure.operation).toBe("withTransaction");
        }),
        120_000
      );
    });
  });
}
