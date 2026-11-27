/**
 * Transaction tracking for the DuckDB `effect/sql` connection.
 *
 * **Details**
 *
 * DuckDB has no savepoints and aborts an open transaction after many kinds of
 * statement failure (constraint, conversion, interrupt, a nested `BEGIN`),
 * after which `COMMIT` succeeds and silently discards every write. This module
 * classifies SQL text into transaction control kinds, folds statement outcomes
 * into a {@link TransactionPhase}, and decides whether a `COMMIT` may run, must
 * be probed first, or must be refused.
 *
 * Classification strips SQL comments (line and nested block comments, as
 * DuckDB parses them) and splits the text into statements outside quoted
 * strings, identifiers and dollar-quoted strings. Transaction control is
 * tracked only when it is the single statement of the text: multi-statement
 * text that contains `BEGIN`, `COMMIT`, `ROLLBACK` or a savepoint statement is
 * refused before it reaches DuckDB, because a failure part-way through leaves
 * a transaction state the error alone cannot reveal (D59).
 *
 * `SAVEPOINT effect_sql_<n>` and `ROLLBACK TO SAVEPOINT effect_sql_<n>` (the
 * exact text `SqlClient.make` generates for nested `withTransaction`) are
 * emulated: the connection never sends them to DuckDB inside a transaction,
 * and a nested rollback marks the phase so the outer `COMMIT` is refused.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DuckdbId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Data from "effect/Data";
import { dual, flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import { SqlError, StatementTimeoutError, UnknownError } from "effect/sql/SqlError";

const $I = $DuckdbId.create("internal/transaction");

const TransactionControl = LiteralKit([
  "begin",
  "commit",
  "rollback",
  "savepoint",
  "rollbackSavepoint",
  "catalogContext",
  "multiStatementControl",
  "statement",
]).pipe(
  $I.annoteSchema("TransactionControl", {
    description: "Kind of SQL text as seen by the transaction tracker.",
  })
);

type TransactionControl = typeof TransactionControl.Type;

const RefusedCommitReason = LiteralKit(["nested", "aborted"]).pipe(
  $I.annoteSchema("RefusedCommitReason", {
    description: "Why the driver refused a COMMIT.",
  })
);

type RefusedCommitReason = typeof RefusedCommitReason.Type;

const SAVEPOINT_PATTERN = /^SAVEPOINT effect_sql_(\d+)$/;
const ROLLBACK_SAVEPOINT_PATTERN = /^ROLLBACK TO SAVEPOINT effect_sql_(\d+)$/;
const ABORTED_TRANSACTION_PATTERN = /Current transaction is aborted/;

const CONTROL_RULES: ReadonlyArray<readonly [TransactionControl, RegExp]> = [
  ["savepoint", SAVEPOINT_PATTERN],
  ["rollbackSavepoint", ROLLBACK_SAVEPOINT_PATTERN],
  ["begin", /^\s*(?:BEGIN|START)(?:\s+(?:TRANSACTION|WORK))?(?:\s+READ\s+(?:ONLY|WRITE))?\s*;?\s*$/i],
  ["commit", /^\s*(?:COMMIT|END)(?:\s+(?:TRANSACTION|WORK))?\s*;?\s*$/i],
  ["rollback", /^\s*(?:ROLLBACK|ABORT)(?:\s+(?:TRANSACTION|WORK))?\s*;?\s*$/i],
  ["catalogContext", /^\s*(?:USE\s|(?:SET|RESET)\s+(?:(?:SESSION|LOCAL|GLOBAL)\s+)?(?:schema|search_path)\b)/i],
];

const LEXEME_SOURCE =
  /--[^\n]*|\/\*|(?<![\w$\u{80}-\u{10FFFF}])[Ee]'(?:[^'\\]|\\[\s\S]|'')*'?|'(?:[^']|'')*'?|"(?:[^"]|"")*"?|(?<![\w$\u{80}-\u{10FFFF}])\$(?:[A-Za-z_\u{80}-\u{10FFFF}][\w\u{80}-\u{10FFFF}]*)?\$|;|[^-'"$/;Ee]+|[\s\S]/u
    .source;

const BLOCK_COMMENT_EDGE_SOURCE = /\/\*|\*\//.source;

const DOLLAR_TAG_PATTERN = /^\$(?:[A-Za-z_\u{80}-\u{10FFFF}][\w\u{80}-\u{10FFFF}]*)?\$$/u;

const INTERRUPTED_MESSAGE = "DuckDB statement interrupted";

const REFUSED_NESTED_MESSAGE =
  "DuckDB cannot roll back a nested transaction on its own; COMMIT refused and the whole transaction rolled back";

const REFUSED_ABORTED_MESSAGE =
  "DuckDB aborted this transaction after an earlier statement failed; COMMIT refused because DuckDB would roll it back silently";

const REFUSED_MULTI_STATEMENT_MESSAGE =
  "DuckDB transaction control (BEGIN, COMMIT, ROLLBACK, SAVEPOINT) must be sent as its own statement; multi-statement text containing it was refused without running";

const blockCommentEnd = (sql: string, start: number): number => {
  const edge = new RegExp(BLOCK_COMMENT_EDGE_SOURCE, "g");
  edge.lastIndex = start;
  let depth = 1;
  for (let match = edge.exec(sql); match !== null; match = edge.exec(sql)) {
    depth += match[0] === "/*" ? 1 : -1;
    if (depth === 0) {
      return edge.lastIndex;
    }
  }
  return sql.length;
};

const dollarQuoteEnd = (sql: string, tag: string, start: number): number =>
  pipe(
    sql,
    Str.slice(start),
    Str.indexOf(tag),
    O.match({
      onNone: () => sql.length,
      onSome: (close) => start + close + tag.length,
    })
  );

/**
 * Splits SQL text into its statements with comments removed.
 *
 * **Details**
 *
 * Line comments and (nested) block comments become a single space; quoted
 * strings, quoted identifiers and dollar-quoted strings are kept verbatim and
 * never split. Statements are trimmed and empty ones (blank text, a lone or
 * trailing `;`, a comment-only statement) are dropped. Escape strings
 * (`E'...'`) are lexed with their backslash escapes.
 *
 * **Gotchas**
 *
 * Unterminated quotes, dollar quotes and block comments run to the end of the
 * text. A `$` that continues an identifier (`a$b$c`) never opens a dollar
 * quote, so it cannot hide a trailing statement from the multi-statement
 * refusal. The lexer's final `[\s\S]` alternative matches any character, so
 * its sticky match never fails inside the text; the fallback after `??` only
 * satisfies the type.
 *
 * **Example** (Split a comment-prefixed script)
 *
 * ```ts
 * import { splitStatements } from "./transaction.ts"
 *
 * console.log(splitStatements("-- tx\nBEGIN; select ';' as s; -- done")) // ["BEGIN", "select ';' as s"]
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const splitStatements = (sql: string): ReadonlyArray<string> => {
  const lexeme = new RegExp(LEXEME_SOURCE, "uy");
  const statements: Array<string> = [];
  let current = "";
  let index = 0;
  while (index < sql.length) {
    lexeme.lastIndex = index;
    const token = lexeme.exec(sql)?.[0] ?? Str.slice(index)(sql);
    const next = index + token.length;
    if (Str.startsWith("--")(token)) {
      current += " ";
      index = next;
    } else if (token === "/*") {
      current += " ";
      index = blockCommentEnd(sql, next);
    } else if (DOLLAR_TAG_PATTERN.test(token)) {
      const end = dollarQuoteEnd(sql, token, next);
      current += Str.slice(index, end)(sql);
      index = end;
    } else if (token === ";") {
      statements.push(current);
      current = "";
      index = next;
    } else {
      current += token;
      index = next;
    }
  }
  statements.push(current);
  return pipe(statements, A.map(Str.trim), A.filter(Str.isNonEmpty));
};

const classifyStatement = (statement: string): TransactionControl =>
  pipe(
    CONTROL_RULES,
    A.findFirst(([, pattern]) => pattern.test(statement)),
    O.match({
      onNone: () => TransactionControl.Enum.statement,
      onSome: ([control]) => control,
    })
  );

const isTransactionControl = (control: TransactionControl): boolean =>
  !TransactionControl.is.statement(control) && !TransactionControl.is.catalogContext(control);

/**
 * Classifies SQL text into the transaction control kind the tracker reacts to.
 *
 * **Details**
 *
 * The text is split with {@link splitStatements}, so leading comments do not
 * hide a control keyword. A single statement is classified by first match:
 * the exact savepoint texts `SqlClient.make` generates, then `BEGIN` /
 * `START TRANSACTION`, `COMMIT` / `END`, `ROLLBACK` / `ABORT`, then
 * catalog-context statements (`USE`, `SET`/`RESET schema|search_path`) that
 * change how unqualified names resolve. Text with several statements is
 * `multiStatementControl` when any of them is transaction control (the
 * connection refuses it, D59), `catalogContext` when any of them is one, and
 * a plain `statement` otherwise. Everything else, including
 * `RELEASE SAVEPOINT` and comment-only text, is a plain `statement`.
 *
 * **Example** (Classify control statements)
 *
 * ```ts
 * import { classifyControl } from "./transaction.ts"
 *
 * console.log(classifyControl("BEGIN TRANSACTION")) // "begin"
 * console.log(classifyControl("-- note\nCOMMIT")) // "commit"
 * console.log(classifyControl("BEGIN; insert into t values (1)")) // "multiStatementControl"
 * console.log(classifyControl("SAVEPOINT effect_sql_1")) // "savepoint"
 * console.log(classifyControl("select 1")) // "statement"
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const classifyControl = (sql: string): TransactionControl => {
  const controls = A.map(splitStatements(sql), classifyStatement);
  return controls.length <= 1
    ? O.getOrElse(A.head(controls), () => TransactionControl.Enum.statement)
    : A.some(controls, isTransactionControl)
      ? TransactionControl.Enum.multiStatementControl
      : A.some(controls, TransactionControl.is.catalogContext)
        ? TransactionControl.Enum.catalogContext
        : TransactionControl.Enum.statement;
};

/**
 * Builds the `SqlError` for multi-statement text that contains transaction
 * control (D59).
 *
 * **Details**
 *
 * The reason is an `UnknownError` (not retryable, D22) carrying the caller's
 * `operation`. Nothing was sent to DuckDB, so the transaction phase is
 * unchanged.
 *
 * **Example** (Refuse a script that opens a transaction)
 *
 * ```ts
 * import { refusedMultiStatementControl } from "./transaction.ts"
 *
 * const error = refusedMultiStatementControl("execute")
 * console.log(error.reason.operation) // "execute"
 * ```
 *
 * @internal
 * @category errors
 * @since 0.0.0
 */
export const refusedMultiStatementControl = (operation: string): SqlError =>
  SqlError.make({
    reason: UnknownError.make({
      cause: REFUSED_MULTI_STATEMENT_MESSAGE,
      message: REFUSED_MULTI_STATEMENT_MESSAGE,
      operation,
    }),
  });

/**
 * Transaction phase of one DuckDB connection.
 *
 * **Details**
 *
 * `Idle` outside a transaction. `Active` inside one, carrying the first
 * statement failure seen in the transaction (`failure`) and the marker of a
 * nested rollback DuckDB could not perform (`nestedRollback`). Internal runtime
 * state holding `SqlError` instances, so it is a `Data.TaggedEnum`, not a
 * schema union (D39).
 *
 * **Example** (Inspect a phase)
 *
 * ```ts
 * import { TransactionPhase } from "./transaction.ts"
 *
 * const phase: TransactionPhase = TransactionPhase.Idle()
 * console.log(phase._tag) // "Idle"
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export type TransactionPhase = Data.TaggedEnum<{
  Idle: {};
  Active: { readonly failure: O.Option<SqlError>; readonly nestedRollback: O.Option<string> };
}>;

/**
 * Constructors, guards and matcher for {@link TransactionPhase}.
 *
 * **Example** (Start a transaction phase)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { TransactionPhase } from "./transaction.ts"
 *
 * const active = TransactionPhase.Active({ failure: O.none(), nestedRollback: O.none() })
 * console.log(TransactionPhase.$is("Active")(active)) // true
 * ```
 *
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const TransactionPhase: Data.TaggedEnum.Constructor<TransactionPhase> = Data.taggedEnum<TransactionPhase>();

type ActivePhase = Data.TaggedEnum.Value<TransactionPhase, "Active">;

const endsTransaction = (control: TransactionControl): boolean =>
  TransactionControl.is.commit(control) || TransactionControl.is.rollback(control);

const recordFailure = (active: ActivePhase, error: SqlError): TransactionPhase =>
  TransactionPhase.Active({
    failure: O.orElse(active.failure, () => O.some(error)),
    nestedRollback: active.nestedRollback,
  });

const nestedRollbackMarker: (sql: string) => string = flow(
  Str.match(ROLLBACK_SAVEPOINT_PATTERN),
  O.flatMap((match) => O.fromUndefinedOr(match[1])),
  O.match({
    onNone: () => "nested transaction rolled back",
    onSome: (id) => `nested transaction effect_sql_${id} rolled back`,
  })
);

/**
 * Next phase after a statement of the given control kind succeeded.
 *
 * **Details**
 *
 * From `Idle`, a successful `begin` opens `Active(none, none)`; everything
 * else stays `Idle`. From `Active`, `commit` / `rollback` return to `Idle`, an
 * emulated `rollbackSavepoint` keeps the first nested-rollback marker, and
 * every other kind leaves the phase unchanged (a second `BEGIN` cannot
 * succeed inside a DuckDB transaction).
 *
 * **Example** (Open a transaction)
 *
 * ```ts
 * import { afterSuccess, TransactionPhase } from "./transaction.ts"
 *
 * const next = afterSuccess(TransactionPhase.Idle(), "begin", "BEGIN")
 * console.log(next._tag) // "Active"
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const afterSuccess: {
  (control: TransactionControl, sql: string): (phase: TransactionPhase) => TransactionPhase;
  (phase: TransactionPhase, control: TransactionControl, sql: string): TransactionPhase;
} = dual(
  3,
  (phase: TransactionPhase, control: TransactionControl, sql: string): TransactionPhase =>
    TransactionPhase.$match(phase, {
      Idle: (idle) =>
        TransactionControl.is.begin(control)
          ? TransactionPhase.Active({ failure: O.none(), nestedRollback: O.none() })
          : idle,
      Active: (active) =>
        endsTransaction(control)
          ? TransactionPhase.Idle()
          : TransactionControl.is.rollbackSavepoint(control)
            ? TransactionPhase.Active({
                failure: active.failure,
                nestedRollback: O.orElse(active.nestedRollback, () => O.some(nestedRollbackMarker(sql))),
              })
            : active,
    })
);

/**
 * Next phase after a statement of the given control kind failed with `error`.
 *
 * **Details**
 *
 * From `Idle` the phase stays `Idle` (a failed `begin` opened nothing). From
 * `Active`, a failed `commit` / `rollback` returns to `Idle`; every other
 * failure, including a failed nested `BEGIN` (DuckDB aborts the open
 * transaction on `cannot start a transaction within a transaction`), keeps
 * the first recorded failure.
 *
 * **Example** (Record a failure inside a transaction)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { SqlError, UnknownError } from "effect/sql/SqlError"
 * import { afterFailure, TransactionPhase } from "./transaction.ts"
 *
 * const error = SqlError.make({ reason: UnknownError.make({ cause: "boom" }) })
 * const active = TransactionPhase.Active({ failure: O.none(), nestedRollback: O.none() })
 * const next = afterFailure(active, "statement", error)
 * console.log(next._tag) // "Active"
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const afterFailure: {
  (control: TransactionControl, error: SqlError): (phase: TransactionPhase) => TransactionPhase;
  (phase: TransactionPhase, control: TransactionControl, error: SqlError): TransactionPhase;
} = dual(
  3,
  (phase: TransactionPhase, control: TransactionControl, error: SqlError): TransactionPhase =>
    TransactionPhase.$match(phase, {
      Idle: (idle) => idle,
      Active: (active) => (endsTransaction(control) ? TransactionPhase.Idle() : recordFailure(active, error)),
    })
);

/**
 * Next phase after a statement of the given control kind was interrupted.
 *
 * **Details**
 *
 * An interrupt aborts the DuckDB transaction, so inside `Active` it is
 * recorded as a `StatementTimeoutError` failure (unless an earlier failure is
 * already recorded). An interrupted `commit` / `rollback` returns to `Idle`,
 * matching their success and failure rows; `Idle` stays `Idle`.
 *
 * **Example** (Record an interrupt inside a transaction)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { afterInterrupt, TransactionPhase } from "./transaction.ts"
 *
 * const active = TransactionPhase.Active({ failure: O.none(), nestedRollback: O.none() })
 * const next = afterInterrupt(active, "statement", "execute")
 * console.log(next._tag) // "Active"
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const afterInterrupt: {
  (control: TransactionControl, operation: string): (phase: TransactionPhase) => TransactionPhase;
  (phase: TransactionPhase, control: TransactionControl, operation: string): TransactionPhase;
} = dual(
  3,
  (phase: TransactionPhase, control: TransactionControl, operation: string): TransactionPhase =>
    TransactionPhase.$match(phase, {
      Idle: (idle) => idle,
      Active: (active) =>
        endsTransaction(control)
          ? TransactionPhase.Idle()
          : recordFailure(
              active,
              SqlError.make({
                reason: StatementTimeoutError.make({
                  cause: INTERRUPTED_MESSAGE,
                  message: INTERRUPTED_MESSAGE,
                  operation,
                }),
              })
            ),
    })
);

/**
 * What the connection does when `effect/sql` asks it to commit.
 *
 * **Details**
 *
 * `Commit` runs `COMMIT`. `Refuse` fails with `error` without touching the
 * native connection. `ProbeThenCommit` first runs {@link ABORT_PROBE_SQL}: if
 * DuckDB reports the transaction aborted, the commit is refused with the
 * recorded `failure` as cause; otherwise `COMMIT` runs. Internal runtime state,
 * so a `Data.TaggedEnum` (D39).
 *
 * **Example** (Match a decision)
 *
 * ```ts
 * import { CommitDecision } from "./transaction.ts"
 *
 * const label = CommitDecision.$match(CommitDecision.Commit(), {
 *   Commit: () => "commit",
 *   Refuse: () => "refuse",
 *   ProbeThenCommit: () => "probe"
 * })
 * console.log(label) // "commit"
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export type CommitDecision = Data.TaggedEnum<{
  Commit: {};
  Refuse: { readonly error: SqlError };
  ProbeThenCommit: { readonly failure: SqlError };
}>;

/**
 * Constructors, guards and matcher for {@link CommitDecision}.
 *
 * **Example** (Build a commit decision)
 *
 * ```ts
 * import { CommitDecision } from "./transaction.ts"
 *
 * console.log(CommitDecision.Commit()._tag) // "Commit"
 * ```
 *
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const CommitDecision: Data.TaggedEnum.Constructor<CommitDecision> = Data.taggedEnum<CommitDecision>();

/**
 * Builds the `SqlError` for a COMMIT the driver refused.
 *
 * **Details**
 *
 * The reason is an `UnknownError` with operation `commitTransaction` (not
 * retryable, D22): the caller swallowed an error DuckDB would otherwise turn
 * into a silent rollback. `cause` is the original failure or the nested
 * rollback marker.
 *
 * **Example** (Refuse a commit after a nested rollback)
 *
 * ```ts
 * import { refusedCommit } from "./transaction.ts"
 *
 * const error = refusedCommit("nested", "nested transaction effect_sql_1 rolled back")
 * console.log(error.reason.operation) // "commitTransaction"
 * ```
 *
 * @internal
 * @category errors
 * @since 0.0.0
 */
export const refusedCommit: {
  (cause: unknown): (why: RefusedCommitReason) => SqlError;
  (why: RefusedCommitReason, cause: unknown): SqlError;
} = dual(
  2,
  (why: RefusedCommitReason, cause: unknown): SqlError =>
    SqlError.make({
      reason: UnknownError.make({
        cause,
        operation: "commitTransaction",
        message: RefusedCommitReason.match(why, {
          nested: () => REFUSED_NESTED_MESSAGE,
          aborted: () => REFUSED_ABORTED_MESSAGE,
        }),
      }),
    })
);

/**
 * Decides how the connection commits from its current phase (D3).
 *
 * **Details**
 *
 * 1. `Active` with a nested-rollback marker → `Refuse` (cause: the first
 *    recorded failure, else the marker).
 * 2. `Active` with a recorded failure → `ProbeThenCommit`.
 * 3. Otherwise → `Commit`.
 *
 * **Example** (Commit a clean transaction)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { decideCommit, TransactionPhase } from "./transaction.ts"
 *
 * const decision = decideCommit(TransactionPhase.Active({ failure: O.none(), nestedRollback: O.none() }))
 * console.log(decision._tag) // "Commit"
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const decideCommit = (phase: TransactionPhase): CommitDecision =>
  TransactionPhase.$match(phase, {
    Idle: () => CommitDecision.Commit(),
    Active: ({ failure, nestedRollback }) =>
      pipe(
        nestedRollback,
        O.map(
          (marker): CommitDecision =>
            CommitDecision.Refuse({
              error: refusedCommit(
                RefusedCommitReason.Enum.nested,
                O.getOrElse(failure, (): unknown => marker)
              ),
            })
        ),
        O.orElse(() =>
          O.map(failure, (recorded): CommitDecision => CommitDecision.ProbeThenCommit({ failure: recorded }))
        ),
        O.getOrElse((): CommitDecision => CommitDecision.Commit())
      ),
  });

/**
 * Probe statement that tells whether DuckDB has aborted the open transaction.
 *
 * **Details**
 *
 * Inside an aborted transaction DuckDB rejects it with
 * `TransactionContext Error: Current transaction is aborted (please ROLLBACK)`;
 * inside a healthy one it succeeds.
 *
 * **Example** (Run the probe)
 *
 * ```ts
 * import { ABORT_PROBE_SQL } from "./transaction.ts"
 *
 * console.log(ABORT_PROBE_SQL) // "SELECT 1 AS effect_sql_abort_probe"
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const ABORT_PROBE_SQL = "SELECT 1 AS effect_sql_abort_probe";

const causeMessage = (cause: unknown): O.Option<string> =>
  P.isString(cause)
    ? O.some(cause)
    : P.hasProperty(cause, "message") && P.isString(cause.message)
      ? O.some(cause.message)
      : O.none();

/**
 * Returns `true` when a `SqlError` reports that DuckDB aborted the open
 * transaction.
 *
 * **Details**
 *
 * Matches `Current transaction is aborted` in the message of the reason's raw
 * native `cause`.
 *
 * **Example** (Detect an aborted transaction)
 *
 * ```ts
 * import { SqlError, UnknownError } from "effect/sql/SqlError"
 * import { isAbortedTransactionError } from "./transaction.ts"
 *
 * const error = SqlError.make({
 *   reason: UnknownError.make({
 *     cause: "TransactionContext Error: Current transaction is aborted (please ROLLBACK)"
 *   })
 * })
 * console.log(isAbortedTransactionError(error)) // true
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const isAbortedTransactionError = (error: SqlError): boolean =>
  pipe(
    causeMessage(error.reason.cause),
    O.exists((message) => ABORTED_TRANSACTION_PATTERN.test(message))
  );
