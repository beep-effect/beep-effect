import { Drizzle, DrizzleError, DrizzleErrorContext } from "@beep/drizzle";
import { makePgliteIntegrationGate } from "@beep/test-utils";
import { A } from "@beep/utils";
import { describe, expect, layer } from "@effect/vitest";
import { Deferred, Effect, Exit, Fiber, Layer, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
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
      (use) => sqlClient.withTransaction(Effect.suspend(() => use(client))),
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
    layer(Layer.fresh(DrizzlePgliteLayer), { timeout: "2 minutes" })((it) => {
      it.effect(
        "rolls back an interrupted transaction and remains usable",
        Effect.fnUntraced(function* () {
          const drizzle = yield* Drizzle;
          const inserted = yield* Deferred.make<void>();
          const transaction = yield* drizzle
            .withTransaction(
              Effect.fnUntraced(function* (tx) {
                yield* tx.execute("INSERT INTO neutral_notes (body) VALUES ($1)", ["interrupted"]);
                yield* Deferred.succeed(inserted, undefined);
                return yield* Effect.never;
              })
            )
            .pipe(Effect.forkChild({ startImmediately: true }));

          yield* Deferred.await(inserted);
          yield* Fiber.interrupt(transaction);
          const exit = yield* Fiber.await(transaction);
          expect(Exit.hasInterrupts(exit)).toBe(true);
          const afterInterruption = yield* drizzle.execute("SELECT body FROM neutral_notes ORDER BY id ASC", []);
          expect(yield* readBodies(afterInterruption)).toEqual([]);

          const committed = yield* drizzle.withTransaction(
            Effect.fnUntraced(function* (tx) {
              yield* tx.execute("INSERT INTO neutral_notes (body) VALUES ($1)", ["after interruption"]);
              return "committed";
            })
          );
          expect(committed).toBe("committed");
          const afterCommit = yield* drizzle.execute("SELECT body FROM neutral_notes ORDER BY id ASC", []);
          expect(yield* readBodies(afterCommit)).toEqual(["after interruption"]);
        }),
        120_000
      );
    });
  });
}
