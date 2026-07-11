/**
 * Typed error models and normalization helpers for the DuckDB driver boundary.
 *
 * @remarks
 * Native `@duckdb/node-api` failures enter this package as `unknown`. The
 * exported normalizer converts them into a single tagged error shape so callers
 * can catch `DuckDbError` without depending on native error internals.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DuckdbId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { O, P } from "@beep/utils";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $DuckdbId.create("DuckDb.errors");
const DuckDbDefect = S.Defect({ includeStack: true });

type DuckDbErrorContextInput = {
  readonly cause?: unknown;
  readonly databasePath?: string;
  readonly message?: string;
  readonly statement?: string;
};

const isDuckDbDefect = S.is(DuckDbDefect);

const causeFromUnknown = (cause: unknown): O.Option<unknown> =>
  P.hasInspectableObjectShape(cause) && isDuckDbDefect(cause) ? O.some(cause) : O.none();

const errorOptionsFromInput = (options: DuckDbErrorContextInput): DuckDbErrorFromUnknownOptions =>
  DuckDbErrorFromUnknownOptions.make({
    cause: causeFromUnknown(options.cause),
    databasePath: O.fromUndefinedOr(options.databasePath),
    ...O.getSomesStruct({
      message: O.fromUndefinedOr(options.message),
    }),
    statement: O.fromUndefinedOr(options.statement),
  });

/**
 * Driver operation names surfaced in {@link DuckDbError} diagnostics.
 *
 * @example
 * ```ts
 * import { DuckDbOperation } from "@beep/duckdb"
 *
 * console.log(DuckDbOperation.Enum.query)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const DuckDbOperation = LiteralKit(["copyTableToParquet", "query", "run", "runMany", "withTransaction"]).pipe(
  $I.annoteSchema("DuckDbOperation", {
    description: "DuckDB driver operation names used in technical error diagnostics.",
  })
);

/**
 * Runtime TypeScript type represented by {@link DuckDbOperation}.
 *
 * @example
 * ```ts
 * import type { DuckDbOperation } from "@beep/duckdb"
 *
 * const operation: DuckDbOperation = "query"
 * console.log(operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type DuckDbOperation = typeof DuckDbOperation.Type;

/**
 * Diagnostic context captured while normalizing an unknown DuckDB failure.
 *
 * @remarks
 * `databasePath` and `statement` are copied into the resulting
 * {@link DuckDbError} when present. The unknown failure value supplied to
 * {@link DuckDbError.fromUnknown} is retained only when it has an inspectable
 * defect shape, keeping opaque native values out of the public error payload.
 *
 * @example
 * ```ts
 * import { DuckDbErrorFromUnknownOptions } from "@beep/duckdb"
 * import * as O from "effect/Option"
 *
 * const options = DuckDbErrorFromUnknownOptions.make({
 *   databasePath: O.some("metrics.duckdb"),
 *   statement: O.some("select * from missing_table")
 * })
 *
 * console.log(O.getOrUndefined(options.statement)) // "select * from missing_table"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DuckDbErrorFromUnknownOptions extends S.Class<DuckDbErrorFromUnknownOptions>(
  $I`DuckDbErrorFromUnknownOptions`
)(
  {
    cause: S.OptionFromOptionalKey(S.Unknown).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Inspectable originating defect, when available.",
    }),
    databasePath: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "DuckDB database path active when the failure occurred.",
    }),
    message: S.String.pipe(SchemaUtils.withKeyDefaults("DuckDB operation failed.")).annotateKey({
      description: "Human-readable failure summary.",
    }),
    statement: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "SQL statement active when the failure occurred.",
    }),
  },
  $I.annote("DuckDbErrorFromUnknownOptions", {
    description: "Options used when normalizing unknown DuckDB boundary failures.",
  })
) {}

/**
 * Recoverable technical failure raised by the DuckDB driver boundary.
 *
 * @remarks
 * The error captures the driver operation that failed plus optional database
 * path and SQL statement context. Native failures are normalized through
 * {@link DuckDbError.fromUnknown}; callers usually handle this error by tag in
 * the Effect failure channel.
 *
 * @example
 * ```ts
 * import { DuckDbError } from "@beep/duckdb"
 * import { Effect } from "effect"
 *
 * const failing = Effect.fail(DuckDbError.make({
 *   message: "DuckDB query failed.",
 *   operation: "query"
 * }))
 *
 * const recovered = failing.pipe(
 *   Effect.catchTag("DuckDbError", (error) => Effect.succeed(error.operation))
 * )
 *
 * Effect.runPromise(recovered).then(console.log) // "query"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DuckDbError extends TaggedErrorClass<DuckDbError>($I`DuckDbError`)(
  "DuckDbError",
  {
    cause: S.OptionFromOptionalKey(S.Unknown).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Inspectable originating defect, when available.",
    }),
    databasePath: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "DuckDB database path active when the failure occurred.",
    }),
    message: S.String.annotateKey({
      description: "Human-readable failure summary.",
    }),
    operation: DuckDbOperation.annotateKey({
      description: "DuckDB driver operation that failed.",
    }),
    statement: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "SQL statement active when the failure occurred.",
    }),
  },
  $I.annote("DuckDbError", {
    description: "Technical DuckDB driver failure scoped to a driver operation.",
  })
) {
  static readonly is = S.is(DuckDbError);

  /**
   * Normalize an unknown native DuckDB failure into a tagged driver error.
   *
   * @remarks
   * Existing {@link DuckDbError} values are returned unchanged, which lets
   * adapter code call the normalizer at multiple boundaries without wrapping
   * the same failure repeatedly. The helper supports both data-first and
   * data-last forms for use in `Effect.mapError` and `Effect.try*` callbacks.
   *
   * @example
   * ```ts
   * import { DuckDbError } from "@beep/duckdb"
   *
   * const normalizeRunFailure = DuckDbError.fromUnknown(new Error("boom"), {
   *   databasePath: ":memory:"
   * })
   *
   * const error = normalizeRunFailure("run")
   * console.log(error.operation) // "run"
   * ```
   *
   * @category errors
   * @since 0.0.0
   */
  static readonly fromUnknown: {
    (operation: DuckDbOperation, cause: unknown, options?: DuckDbErrorContextInput): DuckDbError;
    (cause: unknown, options?: DuckDbErrorContextInput): (operation: DuckDbOperation) => DuckDbError;
  } = dual(
    (args) => args.length >= 2 && P.isString(args[0]),
    (operation: DuckDbOperation, cause: unknown, options: DuckDbErrorContextInput = {}): DuckDbError => {
      const context = errorOptionsFromInput({ ...options, cause: options.cause ?? cause });
      return O.getOrElse(O.liftPredicate(cause, DuckDbError.is), () =>
        DuckDbError.make({
          cause: context.cause,
          databasePath: context.databasePath,
          message: context.message,
          operation,
          statement: context.statement,
        })
      );
    }
  );
}
