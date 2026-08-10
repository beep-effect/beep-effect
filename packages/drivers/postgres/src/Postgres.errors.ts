/**
 * Technical Postgres driver errors and diagnostics.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PostgresId } from "@beep/identity";
import { SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { A, O, P, Str } from "@beep/utils";
import { Cause, pipe, Result } from "effect";
import * as S from "effect/Schema";
import { isCause, isObject, readCauseReasons, safeBoolean } from "./internal/PostgresDiagnosticGuards.ts";
import { getPgErrorName, PgErrorName } from "./PostgresSqlState.models.ts";

const $I = $PostgresId.create("Postgres.errors");
const REDACTED_SQL_PARAMETER = "<redacted>";

/**
 * Optional diagnostic context captured while normalizing Postgres-adjacent failures.
 *
 * **Example** (Make context with options)
 *
 * ```ts
 * import { PostgresErrorContext } from "@beep/postgres"
 * import * as O from "effect/Option"
 *
 * const context = PostgresErrorContext.make({
 *   query: O.some("select 1"),
 *   sqlStateName: O.some("UNIQUE_VIOLATION")
 * })
 *
 * console.log(context)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PostgresErrorContext extends S.Class<PostgresErrorContext>($I`PostgresErrorContext`)(
  {
    columnName: S.OptionFromOptionalKey(S.String)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Column name reported by Postgres diagnostics." }),
    constraintName: S.OptionFromOptionalKey(S.String)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Constraint name reported by Postgres diagnostics." }),
    detail: S.OptionFromOptionalKey(S.String)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Detailed diagnostic text reported by Postgres." }),
    hint: S.OptionFromOptionalKey(S.String)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Hint text reported by Postgres." }),
    message: S.OptionFromOptionalKey(S.String)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Primary diagnostic message reported by Postgres or an adjacent driver." }),
    params: S.OptionFromOptionalKey(S.Unknown.pipe(S.Array))
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Opaque query parameters captured for redacted diagnostics." }),
    query: S.OptionFromOptionalKey(S.String)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "SQL statement associated with the normalized failure." }),
    schemaName: S.OptionFromOptionalKey(S.String)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Schema name reported by Postgres diagnostics." }),
    severity: S.OptionFromOptionalKey(S.String)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Severity reported by Postgres diagnostics." }),
    sourceLocation: S.OptionFromOptionalKey(S.String)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Best-effort source file and position associated with the failure." }),
    sqlState: S.OptionFromOptionalKey(S.String)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Five-character SQLSTATE code reported by Postgres." }),
    sqlStateName: S.OptionFromOptionalKey(PgErrorName)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Canonical SQLSTATE name derived from the SQLSTATE code." }),
    tableName: S.OptionFromOptionalKey(S.String)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Table name reported by Postgres diagnostics." }),
    where: S.OptionFromOptionalKey(S.String)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Contextual where-clause or stack detail reported by Postgres." }),
  },
  $I.annote("PostgresErrorContext", {
    description: "Optional diagnostic context captured while normalizing Postgres-adjacent failures.",
  })
) {
  static readonly is = S.is(PostgresErrorContext);
}

type PostgresErrorContextInput = {
  readonly columnName?: string;
  readonly constraintName?: string;
  readonly detail?: string;
  readonly hint?: string;
  readonly message?: string;
  readonly params?: ReadonlyArray<unknown>;
  readonly query?: string;
  readonly schemaName?: string;
  readonly severity?: string;
  readonly sourceLocation?: string;
  readonly sqlState?: string;
  readonly sqlStateName?: PgErrorName;
  readonly tableName?: string;
  readonly where?: string;
};
type PostgresErrorContextLike = PostgresErrorContext | PostgresErrorContextInput;

const normalizePostgresErrorContext = (context: PostgresErrorContextLike): PostgresErrorContext =>
  PostgresErrorContext.is(context)
    ? context
    : PostgresErrorContext.make({
        columnName: O.fromUndefinedOr(context.columnName),
        constraintName: O.fromUndefinedOr(context.constraintName),
        detail: O.fromUndefinedOr(context.detail),
        hint: O.fromUndefinedOr(context.hint),
        message: O.fromUndefinedOr(context.message),
        params: O.fromUndefinedOr(context.params),
        query: O.fromUndefinedOr(context.query),
        schemaName: O.fromUndefinedOr(context.schemaName),
        severity: O.fromUndefinedOr(context.severity),
        sourceLocation: O.fromUndefinedOr(context.sourceLocation),
        sqlState: O.fromUndefinedOr(context.sqlState),
        sqlStateName: O.fromUndefinedOr(context.sqlStateName),
        tableName: O.fromUndefinedOr(context.tableName),
        where: O.fromUndefinedOr(context.where),
      });

const readProperty = <A>(value: object, key: string, guard: (candidate: unknown) => candidate is A): O.Option<A> =>
  pipe(
    Result.try(() => Reflect.get(value, key) as unknown),
    Result.getOrUndefined,
    O.fromUndefinedOr,
    O.filter(guard)
  );

const isError = (value: unknown): value is Error => safeBoolean(() => value instanceof Error);

const isPostgresError = (value: unknown): value is PostgresError => safeBoolean(() => PostgresError.is(value));

const hasSeen = (seen: ReadonlyArray<object>, value: object): boolean =>
  pipe(
    seen,
    A.some((seenValue) => Object.is(seenValue, value))
  );

const readString = (value: unknown, key: string): O.Option<string> =>
  isObject(value) ? readProperty(value, key, P.isString) : O.none();

const readArray = (value: unknown, key: string): O.Option<ReadonlyArray<unknown>> =>
  isObject(value)
    ? readProperty(value, key, (candidate): candidate is ReadonlyArray<unknown> => A.isArray(candidate))
    : O.none();

const readUnknown = (value: unknown, key: string): O.Option<unknown> =>
  isObject(value) ? readProperty(value, key, P.isUnknown) : O.none();

const getErrorMessage = (value: unknown): O.Option<string> =>
  isError(value) ? readProperty(value, "message", P.isString) : readString(value, "message");

const readCause = (value: unknown): O.Option<unknown> =>
  isObject(value) ? O.firstSomeOf([readUnknown(value, "cause"), readUnknown(value, "reason")]) : O.none();

const firstMapped = <Input, Output>(
  values: ReadonlyArray<Input>,
  map: (value: Input) => O.Option<Output>
): O.Option<Output> =>
  A.reduce(values, O.none<Output>(), (current, value) => (O.isSome(current) ? current : map(value)));

const reasonValue = (reason: Cause.Reason<unknown>): O.Option<unknown> =>
  pipe(
    Result.try((): O.Option<unknown> => {
      if (Cause.isFailReason(reason)) {
        return O.some(reason.error);
      }
      if (Cause.isDieReason(reason)) {
        return O.some(reason.defect);
      }
      return O.none();
    }),
    Result.getOrElse(O.none)
  );

const findInCause = <A>(
  cause: Cause.Cause<unknown>,
  seen: ReadonlyArray<object>,
  extract: (value: unknown, seen: ReadonlyArray<object>) => O.Option<A>
): O.Option<A> =>
  firstMapped(readCauseReasons(cause), (reason) =>
    pipe(
      reasonValue(reason),
      O.flatMap((value) => extract(value, seen))
    )
  );

const extractSourceLocation = (value: unknown): O.Option<string> => {
  const stack = isError(value) ? O.getOrUndefined(readString(value, "stack")) : undefined;
  if (stack === undefined) {
    return O.none();
  }

  for (const line of Str.split(stack, "\n")) {
    const match = pipe(line, Str.match(/at\s+(?:.*?\s+)?\(?([^()]+):(\d+):(\d+)\)?/), O.getOrUndefined);
    const filePath = match?.[1];
    const lineNumber = match?.[2];
    const columnNumber = match?.[3];

    if (
      filePath !== undefined &&
      lineNumber !== undefined &&
      columnNumber !== undefined &&
      Str.startsWith("/")(filePath) &&
      !Str.includes("node_modules")(filePath)
    ) {
      return O.some(`${filePath}:${lineNumber}:${columnNumber}`);
    }
  }

  return O.none();
};

const extractPgLikeError = (value: unknown, seen: ReadonlyArray<object> = []): O.Option<object> => {
  if (!isObject(value) || hasSeen(seen, value)) {
    return O.none();
  }

  const nextSeen = A.append(seen, value);

  if (isCause(value)) {
    return findInCause(value, nextSeen, extractPgLikeError);
  }

  if (O.isSome(readString(value, "code"))) {
    return O.some(value);
  }

  return pipe(
    readCause(value),
    O.flatMap((cause) => extractPgLikeError(cause, nextSeen))
  );
};

const makeQueryContext = (
  query: string | undefined,
  params: ReadonlyArray<unknown> | undefined
): Pick<PostgresErrorContextInput, "params" | "query"> =>
  O.getSomesStruct({
    query: O.fromUndefinedOr(query),
    params: O.map(
      O.fromUndefinedOr(params),
      A.map(() => REDACTED_SQL_PARAMETER)
    ),
  });

const parseDrizzleMessage = (value: unknown): PostgresErrorContextInput => {
  const message = O.getOrUndefined(getErrorMessage(value));
  const match = pipe(
    message,
    O.fromUndefinedOr,
    O.flatMap(Str.match(/^Failed query:\s*(.+?)(?:\nparams:\s*(.*))?$/s)),
    O.getOrUndefined
  );

  if (match === null || match === undefined) {
    return {};
  }

  const paramsText = pipe(match[2], O.fromUndefinedOr, O.map(Str.trim), O.getOrUndefined);
  return makeQueryContext(
    pipe(match[1], O.fromUndefinedOr, O.map(Str.trim), O.getOrUndefined),
    paramsText === undefined || paramsText.length === 0 ? undefined : A.of(paramsText)
  );
};

const extractDrizzleQueryContext = (
  value: unknown,
  seen: ReadonlyArray<object> = []
): Pick<PostgresErrorContextInput, "params" | "query"> => {
  if (!isObject(value) || hasSeen(seen, value)) {
    return parseDrizzleMessage(value);
  }

  const nextSeen = A.append(seen, value);

  if (isCause(value)) {
    return pipe(
      firstMapped(readCauseReasons(value), (reason) =>
        pipe(
          reasonValue(reason),
          O.map((reasonCause) => extractDrizzleQueryContext(reasonCause, nextSeen)),
          O.filter((context) => context.query !== undefined || context.params !== undefined)
        )
      ),
      O.getOrElse(() => ({}))
    );
  }

  const tag = O.getOrUndefined(readUnknown(value, "_tag"));
  if (tag === "EffectDrizzleQueryError") {
    return makeQueryContext(O.getOrUndefined(readString(value, "query")), O.getOrUndefined(readArray(value, "params")));
  }

  const messageContext = parseDrizzleMessage(value);
  if (messageContext.query !== undefined) {
    return messageContext;
  }

  return O.match(readCause(value), {
    onNone: () => ({}),
    onSome: (cause) => extractDrizzleQueryContext(cause, nextSeen),
  });
};

const extractPostgresError = (value: unknown, seen: ReadonlyArray<object> = []): O.Option<PostgresError> => {
  if (isPostgresError(value)) {
    return O.some(value);
  }
  if (!isObject(value) || hasSeen(seen, value)) {
    return O.none();
  }

  const nextSeen = A.append(seen, value);

  if (isCause(value)) {
    return findInCause(value, nextSeen, extractPostgresError);
  }

  return pipe(
    readCause(value),
    O.flatMap((cause) => extractPostgresError(cause, nextSeen))
  );
};

const optionFrom = <A>(value: A | undefined): O.Option<A> => O.fromUndefinedOr(value);

const optionFromSafeDefect = (value: unknown): O.Option<unknown> =>
  !isCause(value) &&
  P.hasInspectableObjectShape(value) &&
  safeBoolean(() => S.is(S.Defect({ includeStack: true }))(value))
    ? optionFrom(value)
    : O.none();

/**
 * Technical failure raised by the `@beep/postgres` driver boundary.
 *
 * **Example** (Create error from unknown)
 *
 * ```ts
 * import { PostgresError } from "@beep/postgres"
 *
 * const error = PostgresError.fromUnknown("connect", new Error("boom"))
 * console.log(error)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PostgresError extends TaggedErrorClass<PostgresError>($I`PostgresError`)(
  "PostgresError",
  {
    operation: S.String.annotateKey({ description: "Driver operation being performed when the failure occurred." }),
    cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true }))
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Schema-safe defect captured from the original failure when available." }),
    message: S.OptionFromOptionalKey(S.String)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Primary diagnostic message reported by Postgres or an adjacent driver." }),
    sqlState: S.OptionFromOptionalKey(S.String)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Five-character SQLSTATE code reported by Postgres." }),
    sqlStateName: S.OptionFromOptionalKey(S.String)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Canonical SQLSTATE name derived from the SQLSTATE code." }),
    severity: S.OptionFromOptionalKey(S.String)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Severity reported by Postgres diagnostics." }),
    detail: S.OptionFromOptionalKey(S.String)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Detailed diagnostic text reported by Postgres." }),
    hint: S.OptionFromOptionalKey(S.String)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Hint text reported by Postgres." }),
    where: S.OptionFromOptionalKey(S.String)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Contextual where-clause or stack detail reported by Postgres." }),
    schemaName: S.OptionFromOptionalKey(S.String)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Schema name reported by Postgres diagnostics." }),
    tableName: S.OptionFromOptionalKey(S.String)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Table name reported by Postgres diagnostics." }),
    columnName: S.OptionFromOptionalKey(S.String)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Column name reported by Postgres diagnostics." }),
    constraintName: S.OptionFromOptionalKey(S.String)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Constraint name reported by Postgres diagnostics." }),
    query: S.OptionFromOptionalKey(S.String)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "SQL statement associated with the normalized failure." }),
    params: S.OptionFromOptionalKey(S.Unknown.pipe(S.Array))
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Opaque query parameters captured for redacted diagnostics." }),
    sourceLocation: S.OptionFromOptionalKey(S.String)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Best-effort source file and position associated with the failure." }),
  },
  $I.annote("PostgresError", {
    description: "Technical Postgres driver failure scoped to a driver operation.",
  })
) {
  static readonly is = S.is(PostgresError);

  /**
   * Normalize an unknown Postgres-adjacent failure into a {@link PostgresError}.
   *
   * **Example** (Normalize unknown failure)
   *
   * ```ts
   * import { PostgresError } from "@beep/postgres"
   *
   * const error = PostgresError.fromUnknown("query", new Error("failed"))
   * console.log(error.operation)
   * ```
   *
   * @category errors
   * @since 0.0.0
   */
  static readonly fromUnknown = (
    operation: string,
    cause?: unknown,
    context: PostgresErrorContextLike = {}
  ): PostgresError => {
    const existingError = O.getOrUndefined(extractPostgresError(cause));
    if (existingError !== undefined) {
      return existingError;
    }

    const diagnosticContext = normalizePostgresErrorContext(context);
    const pgError = O.getOrUndefined(extractPgLikeError(cause));
    const drizzleContext = normalizePostgresErrorContext(extractDrizzleQueryContext(cause));
    const sqlState = O.orElse(diagnosticContext.sqlState, () => readString(pgError, "code"));
    const sqlStateName = O.orElse(diagnosticContext.sqlStateName, () => O.flatMap(sqlState, getPgErrorName));

    return PostgresError.make({
      operation,
      cause: optionFromSafeDefect(cause),
      message: O.firstSomeOf([diagnosticContext.message, getErrorMessage(pgError), getErrorMessage(cause)]),
      sqlState,
      sqlStateName,
      severity: O.orElse(diagnosticContext.severity, () => readString(pgError, "severity")),
      detail: O.orElse(diagnosticContext.detail, () => readString(pgError, "detail")),
      hint: O.orElse(diagnosticContext.hint, () => readString(pgError, "hint")),
      where: O.orElse(diagnosticContext.where, () => readString(pgError, "where")),
      schemaName: O.orElse(diagnosticContext.schemaName, () => readString(pgError, "schema")),
      tableName: O.orElse(diagnosticContext.tableName, () => readString(pgError, "table")),
      columnName: O.orElse(diagnosticContext.columnName, () => readString(pgError, "column")),
      constraintName: O.orElse(diagnosticContext.constraintName, () => readString(pgError, "constraint")),
      query: O.orElse(diagnosticContext.query, () => drizzleContext.query),
      params: O.map(
        O.orElse(diagnosticContext.params, () => drizzleContext.params),
        A.map(() => REDACTED_SQL_PARAMETER)
      ),
      sourceLocation: O.orElse(diagnosticContext.sourceLocation, () => extractSourceLocation(cause)),
    });
  };
}

/**
 * Normalize unknown Postgres-adjacent failures into structured diagnostics.
 *
 * **Example** (Extract diagnostics from error)
 *
 * ```ts
 * import { extractPostgresDiagnostics } from "@beep/postgres"
 *
 * const diagnostics = extractPostgresDiagnostics(new Error("failed"))
 * console.log(diagnostics)
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export const extractPostgresDiagnostics = (cause: unknown): PostgresError =>
  PostgresError.fromUnknown("diagnostics", cause);
