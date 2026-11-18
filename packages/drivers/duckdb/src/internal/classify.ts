/**
 * DuckDB native error classification into `effect/sql` error reasons.
 *
 * **Details**
 *
 * Native `@duckdb/node-api` failures carry their category only in the message
 * text (`Constraint Error: ...`, `TransactionContext Error: ...`). This module
 * strips the node-api wrapper prefix, matches the remaining text against an
 * ordered rule table (first match wins) and wraps the reason in a `SqlError`
 * whose `message` is the human operation message and whose reason `cause` is
 * the raw native value.
 *
 * @packageDocumentation
 * @internal
 * @since 0.0.0
 */

import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Str from "effect/String";
import {
  AuthorizationError,
  ConnectionError,
  ConstraintError,
  LockTimeoutError,
  SerializationError,
  SqlError,
  SqlSyntaxError,
  StatementTimeoutError,
  UniqueViolation,
  UnknownError,
} from "effect/sql/SqlError";
import type { SqlErrorReason } from "effect/sql/SqlError";

type ReasonBase = {
  readonly cause: unknown;
  readonly message: string;
  readonly operation: string;
};

type ClassifyRule = readonly [RegExp, (match: RegExpMatchArray, base: ReasonBase) => O.Option<SqlErrorReason>];

const EXECUTE_MESSAGE = "Failed to execute statement";

const OPERATION_MESSAGES: Readonly<Record<string, string>> = {
  connect: "Failed to open DuckDB database",
  prepare: "Failed to prepare statement",
  bind: "Failed to bind statement parameters",
  execute: EXECUTE_MESSAGE,
  executeRaw: EXECUTE_MESSAGE,
  executeValues: EXECUTE_MESSAGE,
  executeUnprepared: EXECUTE_MESSAGE,
  executeValuesUnprepared: EXECUTE_MESSAGE,
  executeStream: EXECUTE_MESSAGE,
  beginTransaction: "Failed to begin transaction",
  commitTransaction: "Failed to commit transaction",
  rollbackTransaction: "Failed to roll back transaction",
  copyTableToParquet: "Failed to export table to Parquet",
  appendRows: "Failed to append rows",
  checkpoint: "Failed to checkpoint database",
  loadExtension: "Failed to load extension",
  installExtension: "Failed to install extension",
  attach: "Failed to attach database",
  detach: "Failed to detach database",
  query: EXECUTE_MESSAGE,
  run: EXECUTE_MESSAGE,
  runMany: EXECUTE_MESSAGE,
  withTransaction: EXECUTE_MESSAGE,
};

const operationMessage = (operation: string): string =>
  pipe(
    R.get(OPERATION_MESSAGES, operation),
    O.getOrElse(() => "DuckDB operation failed")
  );

const WRAPPER_PREFIX = /^(?:Failed to extract statements|Failed to bind value): /;

const nativeText = (cause: unknown): string =>
  pipe(
    P.hasProperty(cause, "message") && P.isString(cause.message) ? cause.message : String(cause),
    Str.replace(WRAPPER_PREFIX, "")
  );

const always =
  (make: (match: RegExpMatchArray, base: ReasonBase) => SqlErrorReason) =>
  (match: RegExpMatchArray, base: ReasonBase): O.Option<SqlErrorReason> =>
    O.some(make(match, base));

const uniqueViolation = always((match, base) =>
  UniqueViolation.make({
    ...base,
    constraint: pipe(
      A.get(match, 1),
      O.getOrElse(() => match[0])
    ),
  })
);

const RULES: ReadonlyArray<ClassifyRule> = [
  [/^INTERRUPT Error:/, always((_, base) => StatementTimeoutError.make(base))],
  [/^Failed to append: Duplicate key "(.+)" violates (?:primary key|unique) constraint/, uniqueViolation],
  [/^Failed to append:/, always((_, base) => ConstraintError.make(base))],
  [/^Constraint Error: Duplicate key "(.+)" violates (?:primary key|unique) constraint/, uniqueViolation],
  [/^Constraint Error: PRIMARY KEY or UNIQUE constraint violation: duplicate key "(.+)"/, uniqueViolation],
  [/^Constraint Error:/, always((_, base) => ConstraintError.make(base))],
  [
    /^TransactionContext Error: (?:Conflict on|Failed to commit|Catalog write-write conflict|Transaction conflict)/,
    always((_, base) => SerializationError.make(base)),
  ],
  [
    /^TransactionContext Error: Cannot write to database .* transaction is launched in read-only mode/,
    always((_, base) => AuthorizationError.make(base)),
  ],
  [/^TransactionContext Error:/, always((_, base) => UnknownError.make(base))],
  [/^IO Error: Could not set lock on file/, always((_, base) => LockTimeoutError.make(base))],
  [/^IO Error:.*Permission denied/, always((_, base) => AuthorizationError.make(base))],
  [/^Invalid Input Error:.*attached in read-only mode/, always((_, base) => AuthorizationError.make(base))],
  [/^Connection Error:/, always((_, base) => ConnectionError.make(base))],
  [
    /^(?:(?:Failed to (?:connect|query|prepare): )?(?:instance closed|connection disconnected)|Failed to execute prepared statement)/,
    always((_, base) => ConnectionError.make(base)),
  ],
  [/^IO Error:/, (_, base) => (base.operation === "connect" ? ConnectionError.makeOption(base) : O.none())],
  [/^(?:Parser|Catalog|Binder) Error:/, always((_, base) => SqlSyntaxError.make(base))],
];

const classifyDuckDbError = (
  cause: unknown,
  options: { readonly message: string; readonly operation: string }
): SqlErrorReason => {
  const base: ReasonBase = { cause, message: options.message, operation: options.operation };
  const text = nativeText(cause);
  return pipe(
    RULES,
    A.findFirst(([pattern, make]) =>
      pipe(
        Str.match(pattern)(text),
        O.flatMap((match) => make(match, base))
      )
    ),
    O.getOrElse((): SqlErrorReason => UnknownError.make(base))
  );
};

/**
 * Classify a raw DuckDB native failure into an `effect/sql` `SqlError`.
 *
 * **Details**
 *
 * The reason's `message` is the human message for `operation`; its `cause` is
 * the raw native value, unwrapped, so `reason.cause.message` keeps the native
 * text. One leading `Failed to extract statements: ` or `Failed to bind value: `
 * wrapper prefix is ignored when matching.
 *
 * **Example** (Classifying a duplicate-key failure)
 *
 * ```ts
 * import { toSqlError } from "./classify.ts"
 *
 * const error = toSqlError(
 *   { message: 'Constraint Error: Duplicate key "id: 1" violates primary key constraint.' },
 *   "execute"
 * )
 * // error.reason._tag === "UniqueViolation"
 *
 * // Data-last form for `Effect.mapError`:
 * const toExecuteError = toSqlError("execute")
 * console.log(toExecuteError({ message: "Parser Error: syntax error" }).reason.message)
 * // "Failed to execute statement"
 * ```
 *
 * @internal
 * @category errors
 * @since 0.0.0
 */
export const toSqlError: {
  (operation: string): (cause: unknown) => SqlError;
  (cause: unknown, operation: string): SqlError;
} = dual(
  2,
  (cause: unknown, operation: string): SqlError =>
    SqlError.make({ reason: classifyDuckDbError(cause, { message: operationMessage(operation), operation }) })
);
