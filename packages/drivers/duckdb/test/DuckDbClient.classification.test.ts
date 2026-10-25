import { DuckDbClient } from "@beep/duckdb";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as Stream from "effect/Stream";
import * as SqlClient from "effect/sql/SqlClient";
import type { DuckDBConnection } from "@duckdb/node-api";
import type { SqlErrorReason } from "effect/sql/SqlError";

// Fake native connection (SPEC §8.3): answers only the `duckdb_databases()`
// setup query of `fromConnection` and rejects every probed statement.
const setupResult = {
  closeSync: () => undefined,
  returnType: 3,
  rowsChanged: 0,
  convertRowObjects: () => Promise.resolve([{ database_name: "memory", path: null }]),
  convertRows: () => Promise.resolve([]),
};

const makeFailingConnection = (cause: unknown) => ({
  run: (sql: string) =>
    /^SET TimeZone|duckdb_databases/.test(sql) ? Promise.resolve(setupResult) : Promise.reject(cause),
  prepare: () => Promise.reject(cause),
  interrupt: () => undefined,
  closeSync: () => undefined,
});

const clientOver = (cause: unknown) =>
  DuckDbClient.fromConnection({ connection: makeFailingConnection(cause) as unknown as DuckDBConnection });

const reasonOf = Effect.fnUntraced(function* (cause: unknown) {
  const client = yield* clientOver(cause);
  const error = yield* Effect.flip(client.unsafe("SELECT 1").unprepared);
  return error.reason;
});

const preparedReasonOf = Effect.fnUntraced(function* (cause: unknown) {
  const client = yield* clientOver(cause);
  const error = yield* Effect.flip(client.unsafe("SELECT ? AS n", [1]));
  return error.reason;
});

type Expected = {
  readonly name: string;
  readonly cause: unknown;
  readonly tag: SqlErrorReason["_tag"];
  readonly retryable: boolean;
  readonly constraint?: string;
};

const nativeError = (message: string): Error => new Error(message);

const CASES: ReadonlyArray<Expected> = [
  {
    name: "rule 1: INTERRUPT Error",
    cause: nativeError("INTERRUPT Error: Interrupted!"),
    tag: "StatementTimeoutError",
    retryable: true,
  },
  {
    name: "rule 2: duplicate primary key",
    cause: nativeError('Constraint Error: Duplicate key "id: 1" violates primary key constraint.'),
    tag: "UniqueViolation",
    retryable: false,
    constraint: "id: 1",
  },
  {
    name: "rule 2: duplicate unique key",
    cause: nativeError('Constraint Error: Duplicate key "u: a" violates unique constraint.'),
    tag: "UniqueViolation",
    retryable: false,
    constraint: "u: a",
  },
  {
    name: "rule 3: in-statement duplicate key",
    cause: nativeError('Constraint Error: PRIMARY KEY or UNIQUE constraint violation: duplicate key "5"'),
    tag: "UniqueViolation",
    retryable: false,
    constraint: "5",
  },
  {
    name: "rule 4: NOT NULL",
    cause: nativeError("Constraint Error: NOT NULL constraint failed: p.nn"),
    tag: "ConstraintError",
    retryable: false,
  },
  {
    name: "rule 4: foreign key",
    cause: nativeError(
      'Constraint Error: Violates foreign key constraint because key "id: 999" does not exist in the referenced table'
    ),
    tag: "ConstraintError",
    retryable: false,
  },
  {
    name: "rule 5: conflict on update",
    cause: nativeError("TransactionContext Error: Conflict on update!"),
    tag: "SerializationError",
    retryable: true,
  },
  {
    name: "rule 5: failed to commit",
    cause: nativeError(
      'TransactionContext Error: Failed to commit: PRIMARY KEY or UNIQUE constraint violation: duplicate key "10"'
    ),
    tag: "SerializationError",
    retryable: true,
  },
  {
    name: "rule 5: catalog write-write conflict",
    cause: nativeError(
      'TransactionContext Error: Catalog write-write conflict on create with "Schema\0main\0main\0Table\0main\0cc"'
    ),
    tag: "SerializationError",
    retryable: true,
  },
  {
    name: "rule 5: statement-time transaction conflict on insert",
    cause: nativeError(
      'TransactionContext Error: Transaction conflict: attempting to insert into table "t" but it has been altered by a different transaction'
    ),
    tag: "SerializationError",
    retryable: true,
  },
  {
    name: "rule 5: statement-time transaction conflict on index",
    cause: nativeError(
      "TransactionContext Error: Transaction conflict: cannot add an index to a table that has been altered or dropped"
    ),
    tag: "SerializationError",
    retryable: true,
  },
  {
    name: "rule 5: commit-time transaction conflict",
    cause: nativeError(
      'TransactionContext Error: Failed to commit: Transaction conflict: attempting to insert into table "t" but it has been dropped by a different transaction'
    ),
    tag: "SerializationError",
    retryable: true,
  },
  {
    name: "rule 5b: read-only transaction write",
    cause: nativeError(
      'TransactionContext Error: Cannot write to database "memory" - transaction is launched in read-only mode'
    ),
    tag: "AuthorizationError",
    retryable: false,
  },
  {
    name: "rule 6: aborted transaction",
    cause: nativeError("TransactionContext Error: Current transaction is aborted (please ROLLBACK)"),
    tag: "UnknownError",
    retryable: false,
  },
  {
    name: "rule 7: file lock",
    cause: nativeError('IO Error: Could not set lock on file "/x": Conflicting lock is held in ...'),
    tag: "LockTimeoutError",
    retryable: true,
  },
  {
    name: "rule 8: permission denied",
    cause: nativeError('IO Error: Cannot open file "/x": Permission denied'),
    tag: "AuthorizationError",
    retryable: false,
  },
  {
    name: "rule 9: read-only attached database",
    cause: nativeError(
      'Invalid Input Error: Cannot execute statement of type "INSERT" on database "f" which is attached in read-only mode!'
    ),
    tag: "AuthorizationError",
    retryable: false,
  },
  {
    name: "rule 10: connection configuration mismatch",
    cause: nativeError(
      "Connection Error: Can't open a connection to same database file with a different configuration than existing connections"
    ),
    tag: "ConnectionError",
    retryable: true,
  },
  {
    name: "rule 11: query on a disconnected connection",
    cause: nativeError("Failed to query: connection disconnected"),
    tag: "ConnectionError",
    retryable: true,
  },
  {
    name: "rule 11: prepare on a disconnected connection",
    cause: nativeError("Failed to prepare: connection disconnected"),
    tag: "ConnectionError",
    retryable: true,
  },
  {
    name: "rule 11: failed prepared execution",
    cause: nativeError("Failed to execute prepared statement"),
    tag: "ConnectionError",
    retryable: true,
  },
  {
    name: "rule 12 does not apply outside connect: other IO Error",
    cause: nativeError('IO Error: Cannot open file "/x": No such file or directory'),
    tag: "UnknownError",
    retryable: false,
  },
  {
    name: "rule 13: Parser Error",
    cause: nativeError('Parser Error: syntax error at or near "frobnicate"'),
    tag: "SqlSyntaxError",
    retryable: false,
  },
  {
    name: "rule 13: Catalog Error",
    cause: nativeError("Catalog Error: Table with name nope does not exist!"),
    tag: "SqlSyntaxError",
    retryable: false,
  },
  {
    name: "rule 13: Binder Error",
    cause: nativeError('Binder Error: Referenced column "nocol" not found in FROM clause!'),
    tag: "SqlSyntaxError",
    retryable: false,
  },
  {
    name: "rule 14: Conversion Error",
    cause: nativeError("Conversion Error: Could not convert string 'abc' to INT32"),
    tag: "UnknownError",
    retryable: false,
  },
  {
    name: "rule 14: non-Error string cause",
    cause: "boom",
    tag: "UnknownError",
    retryable: false,
  },
  {
    name: "prefixed: Failed to extract statements + Parser Error",
    cause: nativeError('Failed to extract statements: Parser Error: syntax error at or near "frobnicate"'),
    tag: "SqlSyntaxError",
    retryable: false,
  },
  {
    name: "prefixed: Failed to bind value + Invalid Input Error",
    cause: nativeError(
      "Failed to bind value: Invalid Input Error: Can not bind to parameter number 2, statement only has 1 parameter(s)"
    ),
    tag: "UnknownError",
    retryable: false,
  },
];

const assertReason = (reason: SqlErrorReason, expected: Expected): void => {
  assert.strictEqual(reason._tag, expected.tag);
  assert.strictEqual(reason.isRetryable, expected.retryable);
  assert.strictEqual(reason.cause, expected.cause);
  assert.strictEqual(reason.operation, "executeUnprepared");
  assert.strictEqual(reason.message, "Failed to execute statement");
  if (expected.constraint !== undefined) {
    assert.strictEqual(reason._tag === "UniqueViolation" ? reason.constraint : undefined, expected.constraint);
  }
};

describe("DuckDbClient SqlError classification", () => {
  it.layer(Reactivity.layer, { timeout: "30 seconds" })((it) => {
    A.forEach(CASES, (expected) => {
      it.effect(`classifies ${expected.name}`, () =>
        Effect.map(reasonOf(expected.cause), (reason) => assertReason(reason, expected))
      );
    });

    it.effect("keeps the unstripped prefixed native error as the reason cause", () =>
      Effect.gen(function* () {
        const message = 'Failed to extract statements: Parser Error: syntax error at or near "frobnicate"';
        const cause = nativeError(message);
        const reason = yield* reasonOf(cause);
        assert.strictEqual(reason.cause, cause);
        assert.strictEqual(cause.message, message);
      })
    );

    it.effect("reports operation prepare on the prepared path", () =>
      Effect.gen(function* () {
        const cause = nativeError('Parser Error: syntax error at or near "frobnicate"');
        const reason = yield* preparedReasonOf(cause);
        assert.strictEqual(reason._tag, "SqlSyntaxError");
        assert.strictEqual(reason.operation, "prepare");
        assert.strictEqual(reason.message, "Failed to prepare statement");
        assert.strictEqual(reason.cause, cause);
      })
    );
  });

  it.layer(DuckDbClient.layer({ databasePath: ":memory:" }), { timeout: "30 seconds" })((it) => {
    it.effect("classifies bad SQL with a bound param through unprepared as SqlSyntaxError", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const error = yield* Effect.flip(sql`frobnicate ${1}`.unprepared);
        assert.strictEqual(error.reason._tag, "SqlSyntaxError");
        assert.strictEqual(error.reason.operation, "executeUnprepared");
      })
    );

    it.effect("classifies bad SQL through stream as SqlSyntaxError", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const error = yield* sql.unsafe("frobnicate 1").stream.pipe(Stream.runCollect, Effect.flip);
        assert.strictEqual(error.reason._tag, "SqlSyntaxError");
      })
    );
  });
});
