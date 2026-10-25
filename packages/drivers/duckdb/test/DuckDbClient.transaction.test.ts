import { DuckDbClient } from "@beep/duckdb";
import { it } from "@beep/test-runner";
import { DuckDBInstance } from "@duckdb/node-api";
import { assert, describe, expect } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Ref from "effect/Ref";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import * as TestClock from "effect/testing/TestClock";
import type { DuckDBConnection } from "@duckdb/node-api";
import type { SqlError } from "effect/sql/SqlError";

const NESTED_MESSAGE =
  "DuckDB cannot roll back a nested transaction on its own; COMMIT refused and the whole transaction rolled back";
const ABORTED_MESSAGE =
  "DuckDB aborted this transaction after an earlier statement failed; COMMIT refused because DuckDB would roll it back silently";

const MULTI_STATEMENT_MESSAGE =
  "DuckDB transaction control (BEGIN, COMMIT, ROLLBACK, SAVEPOINT) must be sent as its own statement; multi-statement text containing it was refused without running";

const LONG_QUERY = "select count(*) from range(20000000000)";

// `it.effect` installs TestClock, so wall-clock waits must run with the live clock.
const liveSleep = (millis: number): Effect.Effect<void> => Effect.sleep(`${millis} millis`).pipe(TestClock.withLive);

const countRows = (sql: SqlClient.SqlClient, table: string): Effect.Effect<number, SqlError> =>
  sql
    .unsafe<{ readonly n: number }>(`select count(*)::INTEGER as n from ${table}`)
    .pipe(Effect.map((rows) => rows[0]?.n ?? -1));

const expectRefusedCommit = (error: SqlError, message: string): void => {
  expect(error.reason._tag).toBe("UnknownError");
  expect(error.reason.operation).toBe("commitTransaction");
  expect(error.reason.message).toBe(message);
};

const expectRefusedMultiStatement = (error: SqlError): void => {
  expect(error.reason._tag).toBe("UnknownError");
  expect(error.reason.message).toBe(MULTI_STATEMENT_MESSAGE);
};

const expectUsable = (sql: SqlClient.SqlClient): Effect.Effect<void, SqlError> =>
  sql
    .unsafe<{ readonly one: number }>("select 1 as one")
    .pipe(Effect.map((rows) => expect(rows).toEqual([{ one: 1 }])));

const acquireInstance = Effect.acquireRelease(
  Effect.promise(() => DuckDBInstance.create(":memory:")),
  (instance) => Effect.sync(() => instance.closeSync())
);

const acquireRawConnection = (instance: DuckDBInstance) =>
  Effect.acquireRelease(
    Effect.promise(() => instance.connect()),
    (connection) => Effect.sync(() => connection.closeSync())
  );

const runRaw = (connection: DuckDBConnection, sqlText: string): Effect.Effect<void> =>
  Effect.promise(() => connection.run(sqlText)).pipe(Effect.asVoid);

describe("DuckDbClient transactions", { concurrent: false }, () => {
  it.layer(DuckDbClient.layer({ databasePath: ":memory:" }), { timeout: "30 seconds" })((it) => {
    it.effect(
      "commits a successful transaction",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`create table tx_commit (id INTEGER)`;
        yield* sql.withTransaction(
          Effect.gen(function* () {
            yield* sql`insert into tx_commit values (1)`;
            yield* sql`insert into tx_commit values (2)`;
          })
        );
        expect(yield* countRows(sql, "tx_commit")).toBe(2);
      })
    );

    it.effect(
      "rolls back on failure",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`create table tx_rollback (id INTEGER)`;
        const error = yield* sql
          .withTransaction(sql`insert into tx_rollback values (1)`.pipe(Effect.andThen(Effect.fail("boom" as const))))
          .pipe(Effect.flip);
        expect(error).toBe("boom");
        expect(yield* countRows(sql, "tx_rollback")).toBe(0);
      })
    );

    it.effect(
      "commits both levels of a nested transaction",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`create table tx_nested_commit (id INTEGER)`;
        yield* sql.withTransaction(
          Effect.gen(function* () {
            yield* sql`insert into tx_nested_commit values (1)`;
            yield* sql.withTransaction(sql`insert into tx_nested_commit values (2)`);
          })
        );
        expect(yield* countRows(sql, "tx_nested_commit")).toBe(2);
      })
    );

    it.effect(
      "refuses the outer commit after a nested rollback the outer body caught",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`create table tx_nested_rollback (id INTEGER)`;
        const error = yield* sql
          .withTransaction(
            Effect.gen(function* () {
              yield* sql`insert into tx_nested_rollback values (1)`;
              yield* sql
                .withTransaction(
                  sql`insert into tx_nested_rollback values (2)`.pipe(Effect.andThen(Effect.fail("inner" as const)))
                )
                .pipe(Effect.ignore);
            })
          )
          .pipe(Effect.flip);
        expectRefusedCommit(error, NESTED_MESSAGE);
        expect(yield* countRows(sql, "tx_nested_rollback")).toBe(0);
        yield* expectUsable(sql);
      })
    );

    it.effect(
      "refuses the commit after a swallowed constraint error",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`create table tx_constraint (id INTEGER PRIMARY KEY)`;
        const error = yield* sql
          .withTransaction(
            Effect.gen(function* () {
              yield* sql`insert into tx_constraint values (1)`;
              yield* sql`insert into tx_constraint values (1)`.pipe(Effect.ignore);
            })
          )
          .pipe(Effect.flip);
        expectRefusedCommit(error, ABORTED_MESSAGE);
        expect(yield* countRows(sql, "tx_constraint")).toBe(0);
      })
    );

    it.effect(
      "refuses a raw COMMIT after a swallowed constraint error and rolls back",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`create table tx_raw_commit (id INTEGER PRIMARY KEY)`;
        yield* sql.unsafe("BEGIN TRANSACTION");
        yield* sql`insert into tx_raw_commit values (1)`;
        const duplicate = yield* sql`insert into tx_raw_commit values (1)`.pipe(Effect.flip);
        const error = yield* sql.unsafe("COMMIT").pipe(Effect.flip);
        expect(duplicate.reason._tag).toBe("UniqueViolation");
        expectRefusedCommit(error, ABORTED_MESSAGE);
        expect(yield* countRows(sql, "tx_raw_commit")).toBe(0);
        yield* sql`insert into tx_raw_commit values (2)`;
        expect(yield* countRows(sql, "tx_raw_commit")).toBe(1);
      })
    );

    for (const begin of ["BEGIN WORK", "START", "START WORK"]) {
      for (const commit of ["COMMIT WORK", "END WORK"]) {
        it.effect(
          `guards ${commit} after ${begin} and a swallowed constraint error`,
          Effect.fnUntraced(function* () {
            const sql = yield* SqlClient.SqlClient;
            yield* sql`create or replace table tx_work_commit (id INTEGER PRIMARY KEY)`;
            yield* sql.unsafe(begin);
            yield* sql`insert into tx_work_commit values (1)`;
            yield* sql`insert into tx_work_commit values (1)`.pipe(Effect.ignore);
            const error = yield* sql.unsafe(commit).pipe(Effect.flip);
            expectRefusedCommit(error, ABORTED_MESSAGE);
            expect(yield* countRows(sql, "tx_work_commit")).toBe(0);
            yield* expectUsable(sql);
          })
        );
      }
    }

    for (const rollback of ["ROLLBACK WORK", "ABORT WORK"]) {
      it.effect(
        `tracks ${rollback} and permits a subsequent transaction`,
        Effect.fnUntraced(function* () {
          const sql = yield* SqlClient.SqlClient;
          yield* sql`create or replace table tx_work_rollback (id INTEGER PRIMARY KEY)`;
          yield* sql.unsafe("BEGIN WORK");
          yield* sql`insert into tx_work_rollback values (1)`;
          yield* sql`insert into tx_work_rollback values (1)`.pipe(Effect.ignore);
          yield* sql.unsafe(rollback);
          yield* sql.unsafe("START");
          yield* sql`insert into tx_work_rollback values (2)`;
          yield* sql.unsafe("COMMIT WORK");
          expect(yield* countRows(sql, "tx_work_rollback")).toBe(1);
        })
      );
    }

    it.effect(
      "refuses multi-statement COMMIT WORK before running the insert",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`create table tx_multi_work (id INTEGER)`;
        yield* sql.unsafe("BEGIN WORK");
        const error = yield* sql.unsafe("insert into tx_multi_work values (1); COMMIT WORK").pipe(Effect.flip);
        expectRefusedMultiStatement(error);
        expect(yield* countRows(sql, "tx_multi_work")).toBe(0);
        yield* sql.unsafe("ROLLBACK WORK");
        yield* expectUsable(sql);
      })
    );

    it.effect(
      "refuses a comment-prefixed raw COMMIT after a comment-prefixed BEGIN and a swallowed error",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`create table tx_comment_raw (id INTEGER PRIMARY KEY)`;
        yield* sql.unsafe("/* tx */ BEGIN");
        yield* sql`insert into tx_comment_raw values (1)`;
        yield* sql`insert into tx_comment_raw values (1)`.pipe(Effect.ignore);
        const error = yield* sql.unsafe("-- note\nCOMMIT").pipe(Effect.flip);
        expectRefusedCommit(error, ABORTED_MESSAGE);
        expect(yield* countRows(sql, "tx_comment_raw")).toBe(0);
        yield* expectUsable(sql);
      })
    );

    it.effect(
      "tracks raw control text behind line and nested block comments",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`create table tx_comment_nested (id INTEGER PRIMARY KEY)`;
        yield* sql.unsafe("-- open\n  BEGIN TRANSACTION -- trailing");
        yield* sql`insert into tx_comment_nested values (1)`;
        yield* sql`insert into tx_comment_nested values (1)`.pipe(Effect.ignore);
        const error = yield* sql.unsafe("/* outer /* inner */ still outer */ COMMIT;").pipe(Effect.flip);
        expectRefusedCommit(error, ABORTED_MESSAGE);
        expect(yield* countRows(sql, "tx_comment_nested")).toBe(0);
      })
    );

    it.effect(
      "refuses multi-statement text that opens a transaction without running it",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`create table tx_multi_begin (id INTEGER PRIMARY KEY)`;
        const open = yield* sql.unsafe("BEGIN; insert into tx_multi_begin values (1)").pipe(Effect.flip);
        const whole = yield* sql.unsafe("BEGIN; insert into tx_multi_begin values (2); COMMIT").pipe(Effect.flip);
        expectRefusedMultiStatement(open);
        expectRefusedMultiStatement(whole);
        expect(yield* countRows(sql, "tx_multi_begin")).toBe(0);
        // Nothing ran: DuckDB is still in autocommit, so a raw BEGIN opens a fresh transaction.
        yield* sql.unsafe("BEGIN");
        yield* sql`insert into tx_multi_begin values (3)`;
        yield* sql.unsafe("COMMIT");
        expect(yield* countRows(sql, "tx_multi_begin")).toBe(1);
      })
    );

    it.effect(
      "refuses multi-statement COMMIT text after a swallowed error so the guarded COMMIT still decides",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`create table tx_multi_commit (id INTEGER PRIMARY KEY)`;
        yield* sql.unsafe("BEGIN");
        yield* sql`insert into tx_multi_commit values (1)`;
        yield* sql`insert into tx_multi_commit values (1)`.pipe(Effect.ignore);
        const head = yield* sql.unsafe("COMMIT; select 1").pipe(Effect.flip);
        const tail = yield* sql.unsafe("select 1; COMMIT").pipe(Effect.flip);
        expectRefusedMultiStatement(head);
        expectRefusedMultiStatement(tail);
        const error = yield* sql.unsafe("COMMIT").pipe(Effect.flip);
        expectRefusedCommit(error, ABORTED_MESSAGE);
        expect(yield* countRows(sql, "tx_multi_commit")).toBe(0);
      })
    );

    it.effect(
      "refuses multi-statement COMMIT text hidden behind a dollar sign inside an identifier",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`create table tx_multi_dollar_ident (id INTEGER PRIMARY KEY)`;
        yield* sql.unsafe("BEGIN");
        yield* sql`insert into tx_multi_dollar_ident values (1)`;
        yield* sql`insert into tx_multi_dollar_ident values (1)`.pipe(Effect.ignore);
        // `a$b$c` is an identifier, not the `$b$` dollar-quote opener.
        const hidden = yield* sql.unsafe("select 1 as a$b$c; COMMIT").pipe(Effect.flip);
        expectRefusedMultiStatement(hidden);
        const unicodeHidden = yield* sql.unsafe("select 1 as aé$b$c; COMMIT").pipe(Effect.flip);
        expectRefusedMultiStatement(unicodeHidden);
        const astralHidden = yield* sql.unsafe("select 1 as a😀$b$c; COMMIT").pipe(Effect.flip);
        expectRefusedMultiStatement(astralHidden);
        const taggedHidden = yield* sql.unsafe("SELECT $é$ $b$ $é$; COMMIT; SELECT $b$x$b$").pipe(Effect.flip);
        expectRefusedMultiStatement(taggedHidden);
        const error = yield* sql.unsafe("COMMIT").pipe(Effect.flip);
        expectRefusedCommit(error, ABORTED_MESSAGE);
        expect(yield* countRows(sql, "tx_multi_dollar_ident")).toBe(0);
      })
    );

    it.effect(
      "runs multi-statement text whose control keywords sit in strings or comments",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`create table tx_multi_quoted (id INTEGER, note VARCHAR)`;
        yield* sql.unsafe(
          "insert into tx_multi_quoted values (1, 'BEGIN; COMMIT'); insert into tx_multi_quoted values (2, $$x; ROLLBACK$$); -- COMMIT"
        );
        yield* sql.unsafe("/* a /* b */ BEGIN */ insert into tx_multi_quoted values (3, 'c')");
        // Neither text opened a transaction, so every row is already committed.
        yield* sql.unsafe("BEGIN");
        yield* sql.unsafe("ROLLBACK");
        expect(yield* countRows(sql, "tx_multi_quoted")).toBe(3);
      })
    );

    it.effect(
      "refuses multi-statement control text sent as a stream",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        const error = yield* sql.unsafe("BEGIN; select 1 as one").stream.pipe(Stream.runCollect, Effect.flip);
        expectRefusedMultiStatement(error);
        yield* expectUsable(sql);
      })
    );

    it.effect(
      "sends text with an unterminated block comment or dollar quote to DuckDB as one statement",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        // The unterminated comment and dollar quote run to the end of the text, so the
        // control keywords inside them are not statements and nothing is refused.
        const comment = yield* sql.unsafe("select 1 as one; /* BEGIN; COMMIT").pipe(Effect.flip);
        const dollar = yield* sql.unsafe("select $q$BEGIN; COMMIT").pipe(Effect.flip);
        expect(comment.reason.message).not.toBe(MULTI_STATEMENT_MESSAGE);
        expect(dollar.reason.message).not.toBe(MULTI_STATEMENT_MESSAGE);
        // Neither text opened a transaction, so a raw BEGIN still opens a fresh one.
        yield* sql.unsafe("BEGIN");
        yield* sql.unsafe("ROLLBACK");
        yield* expectUsable(sql);
      })
    );

    it.effect(
      "refuses a raw commit after a swallowed parser error",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`create table tx_raw_parser (id INTEGER)`;
        yield* sql.unsafe("BEGIN TRANSACTION");
        yield* sql`insert into tx_raw_parser values (1)`;
        yield* sql.unsafe("frobnicate nonsense from").pipe(Effect.ignore);
        // DuckDB 2.0 aborts even on parser errors; COMMIT would silently roll back.
        const error = yield* sql.unsafe("COMMIT").pipe(Effect.flip);
        expectRefusedCommit(error, ABORTED_MESSAGE);
        expect(yield* countRows(sql, "tx_raw_parser")).toBe(0);
        yield* expectUsable(sql);
      })
    );

    it.effect(
      "keeps the connection usable after a refused commit",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`create table tx_usable (id INTEGER PRIMARY KEY)`;
        yield* sql
          .withTransaction(
            Effect.gen(function* () {
              yield* sql`insert into tx_usable values (1)`;
              yield* sql`insert into tx_usable values (1)`.pipe(Effect.ignore);
            })
          )
          .pipe(Effect.flip);
        yield* expectUsable(sql);
        yield* sql.withTransaction(sql`insert into tx_usable values (2)`);
        expect(yield* countRows(sql, "tx_usable")).toBe(1);
      })
    );

    it.effect(
      "refuses the commit after a swallowed parser error",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`create table tx_parser (id INTEGER)`;
        // DuckDB 2.0 aborts even on parser errors; retain the safe-COMMIT guarantee.
        const error = yield* sql
          .withTransaction(
            Effect.gen(function* () {
              yield* sql`insert into tx_parser values (1)`;
              const parserError = yield* sql.unsafe("frobnicate nonsense from").pipe(Effect.flip, Effect.orDie);
              expect(parserError.reason._tag).toBe("SqlSyntaxError");
            })
          )
          .pipe(Effect.flip);
        expectRefusedCommit(error, ABORTED_MESSAGE);
        expect(yield* countRows(sql, "tx_parser")).toBe(0);
        yield* expectUsable(sql);
      })
    );

    it.effect(
      "refuses the commit after a swallowed interrupted statement",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`create table tx_interrupt (id INTEGER)`;
        const error = yield* sql
          .withTransaction(
            Effect.gen(function* () {
              yield* sql`insert into tx_interrupt values (1)`;
              yield* sql.unsafe(LONG_QUERY).pipe(Effect.timeout("200 millis"), TestClock.withLive, Effect.ignore);
            })
          )
          .pipe(Effect.flip);
        expectRefusedCommit(error, ABORTED_MESSAGE);
        expect(yield* countRows(sql, "tx_interrupt")).toBe(0);
        yield* expectUsable(sql);
      })
    );

    it.effect(
      "refuses the commit after a failed nested BEGIN TRANSACTION",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`create table tx_nested_begin (id INTEGER)`;
        const error = yield* sql
          .withTransaction(
            Effect.gen(function* () {
              yield* sql`insert into tx_nested_begin values (1)`;
              yield* sql`BEGIN TRANSACTION`.pipe(Effect.ignore);
            })
          )
          .pipe(Effect.flip);
        expectRefusedCommit(error, ABORTED_MESSAGE);
        expect(yield* countRows(sql, "tx_nested_begin")).toBe(0);
        yield* expectUsable(sql);
      })
    );

    it.effect(
      "refuses the commit after a failed nested START TRANSACTION",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`create table tx_nested_start (id INTEGER)`;
        const error = yield* sql
          .withTransaction(
            Effect.gen(function* () {
              yield* sql`insert into tx_nested_start values (1)`;
              yield* sql`START TRANSACTION`.pipe(Effect.ignore);
            })
          )
          .pipe(Effect.flip);
        expectRefusedCommit(error, ABORTED_MESSAGE);
        expect(yield* countRows(sql, "tx_nested_start")).toBe(0);
        yield* expectUsable(sql);
      })
    );

    it.effect(
      "serializes concurrent nested transactions inside one outer transaction",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`create table tx_nested_concurrent (name VARCHAR)`;
        const firstStarted = yield* Deferred.make<void>();
        const events = yield* Ref.make<ReadonlyArray<string>>([]);
        const record = (event: string) => Ref.update(events, (all) => [...all, event]);

        yield* sql.withTransaction(
          Effect.all(
            [
              sql.withTransaction(
                Effect.gen(function* () {
                  yield* Deferred.succeed(firstStarted, undefined);
                  yield* liveSleep(100);
                  yield* sql`insert into tx_nested_concurrent values ('first')`;
                  yield* record("first-end");
                })
              ),
              Deferred.await(firstStarted).pipe(
                Effect.andThen(
                  sql.withTransaction(
                    Effect.gen(function* () {
                      yield* record("second-start");
                      yield* sql`insert into tx_nested_concurrent values ('second')`;
                    })
                  )
                )
              ),
            ],
            { concurrency: "unbounded" }
          )
        );

        expect(yield* Ref.get(events)).toEqual(["first-end", "second-start"]);
        const rows = yield* sql<{ readonly name: string }>`select name from tx_nested_concurrent order by name`;
        expect(rows).toEqual([{ name: "first" }, { name: "second" }]);
      })
    );

    it.effect(
      "rolls back when the transaction fiber is interrupted",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`create table tx_fiber_interrupt (id INTEGER)`;
        const inserted = yield* Deferred.make<void>();
        const fiber = yield* sql
          .withTransaction(
            Effect.gen(function* () {
              yield* sql`insert into tx_fiber_interrupt values (1)`;
              yield* Deferred.succeed(inserted, undefined);
              return yield* Effect.never;
            })
          )
          .pipe(Effect.forkChild);
        yield* Deferred.await(inserted);
        yield* Fiber.interrupt(fiber);
        expect(yield* countRows(sql, "tx_fiber_interrupt")).toBe(0);
        yield* expectUsable(sql);
      })
    );

    it.effect(
      "rejects a manual SAVEPOINT outside a transaction as a syntax error",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        const error = yield* sql.unsafe("SAVEPOINT effect_sql_1").pipe(Effect.flip);
        expect(error.reason._tag).toBe("SqlSyntaxError");
      })
    );
  });

  it.layer(Reactivity.layer, { timeout: "30 seconds" })((it) => {
    it.effect(
      "fails reader setup when the writer session snapshot does not decode",
      Effect.fnUntraced(function* () {
        const instance = yield* acquireInstance;
        // The writer answers the session-settings query with a row DuckDB never produces.
        const connect = (): Promise<DuckDBConnection> =>
          instance.connect().then((connection) => {
            const runAndReadAll = connection.runAndReadAll.bind(connection);
            return Object.assign(connection, {
              runAndReadAll: (sqlText: string) =>
                Str.includes("current_setting('TimeZone') AS timeZone")(sqlText)
                  ? Promise.resolve({ getRowObjects: () => [{ database: 1 }] })
                  : runAndReadAll(sqlText),
            }) as unknown as DuckDBConnection;
          });
        const patched = Object.assign(Object.create(instance), { connect }) as DuckDBInstance;

        const error = yield* DuckDbClient.fromInstance({ instance: patched, readerConnections: 1 }).pipe(Effect.flip);

        expect(error._tag).toBe("SqlError");
      })
    );

    it.effect(
      "maps a commit-time conflict to SerializationError and keeps the client usable",
      Effect.fnUntraced(function* () {
        const instance = yield* acquireInstance;
        const conn2 = yield* acquireRawConnection(instance);
        const sql = yield* DuckDbClient.fromInstance({ instance });
        yield* sql`create table tx_commit_conflict (id INTEGER PRIMARY KEY)`;

        const error = yield* sql
          .withTransaction(
            Effect.gen(function* () {
              yield* sql`insert into tx_commit_conflict values (3)`;
              yield* runRaw(conn2, "BEGIN TRANSACTION");
              yield* runRaw(conn2, "insert into tx_commit_conflict values (3)");
              yield* runRaw(conn2, "COMMIT");
            })
          )
          .pipe(Effect.flip);

        expect(error.reason._tag).toBe("SerializationError");
        assert.isTrue(error.isRetryable);
        yield* expectUsable(sql);
        expect(yield* countRows(sql, "tx_commit_conflict")).toBe(1);
        yield* sql.withTransaction(sql`insert into tx_commit_conflict values (4)`);
        expect(yield* countRows(sql, "tx_commit_conflict")).toBe(2);
      })
    );

    it.effect(
      "maps a statement-time transaction conflict to SerializationError and keeps the client usable",
      Effect.fnUntraced(function* () {
        const instance = yield* acquireInstance;
        const conn2 = yield* acquireRawConnection(instance);
        const sql = yield* DuckDbClient.fromInstance({ instance });
        yield* sql`create table tx_statement_conflict (id INTEGER)`;

        const error = yield* sql
          .withTransaction(
            Effect.gen(function* () {
              yield* sql`select * from tx_statement_conflict`;
              yield* runRaw(conn2, "alter table tx_statement_conflict add column extra INTEGER");
              yield* sql`insert into tx_statement_conflict (id) values (1)`;
            })
          )
          .pipe(Effect.flip);

        expect(error.reason._tag).toBe("SerializationError");
        assert.isTrue(error.isRetryable);
        yield* expectUsable(sql);
        expect(yield* countRows(sql, "tx_statement_conflict")).toBe(0);
        yield* sql.withTransaction(sql`insert into tx_statement_conflict (id) values (2)`);
        expect(yield* countRows(sql, "tx_statement_conflict")).toBe(1);
      })
    );

    it.effect(
      "maps a catalog write-write conflict to SerializationError and keeps the client usable",
      Effect.fnUntraced(function* () {
        const instance = yield* acquireInstance;
        const conn2 = yield* acquireRawConnection(instance);
        const sql = yield* DuckDbClient.fromInstance({ instance });

        yield* runRaw(conn2, "BEGIN TRANSACTION");
        yield* runRaw(conn2, "create table cc (i INTEGER)");
        const error = yield* sql.withTransaction(sql`create table cc (i INTEGER)`).pipe(Effect.flip);
        expect(error.reason._tag).toBe("SerializationError");
        yield* runRaw(conn2, "COMMIT");

        yield* expectUsable(sql);
        expect(yield* countRows(sql, "cc")).toBe(0);
      })
    );
  });
});
