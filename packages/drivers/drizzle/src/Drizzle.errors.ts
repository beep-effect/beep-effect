/**
 * Technical errors raised by the Drizzle driver boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DrizzleId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { A, O, P, Str } from "@beep/utils";
import { Cause, flow, pipe, Result } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $DrizzleId.create("Drizzle.errors");
const REDACTED_SQL_PARAMETER = "<redacted>";

const RedactedSqlParameter = S.Literal(REDACTED_SQL_PARAMETER).pipe(
  $I.annoteSchema("RedactedSqlParameter", {
    description: "SQL parameter redaction marker emitted by Drizzle error normalization.",
  })
);

const RedactedSqlParams = S.Array(RedactedSqlParameter).pipe(
  $I.annoteSchema("RedactedSqlParams", {
    description: "Redacted SQL parameter values emitted by Drizzle error normalization.",
  })
);

/**
 * Driver operation names surfaced in {@link DrizzleError} diagnostics.
 *
 * **Example** (Log execute operation enum)
 *
 * ```ts
 * import { DrizzleOperation } from "@beep/drizzle"
 *
 * console.log(DrizzleOperation.Enum.execute)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const DrizzleOperation = LiteralKit(["decodeRows", "execute", "withTransaction"]).pipe(
  $I.annoteSchema("DrizzleOperation", {
    description: "Drizzle driver operation names used in technical error diagnostics.",
  })
);

/**
 * Runtime type for {@link DrizzleOperation}.
 *
 * **Example** (Assign typed operation value)
 *
 * ```ts
 * import type { DrizzleOperation } from "@beep/drizzle"
 *
 * const operation: DrizzleOperation = "execute"
 * console.log(operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type DrizzleOperation = typeof DrizzleOperation.Type;

/**
 * Optional SQL text and parameter context captured while normalizing Drizzle failures.
 *
 * **Details**
 *
 * The context class stores the values supplied by the adapter. Parameter
 * redaction happens when the context is passed through
 * {@link DrizzleError.fromUnknown}.
 *
 * **Example** (Build context with query)
 *
 * ```ts
 * import { deepStrictEqual, strictEqual } from "node:assert"
 * import { DrizzleErrorContext } from "@beep/drizzle"
 * import * as O from "effect/Option"
 *
 * const context = DrizzleErrorContext.make({
 *   query: O.some("select * from accounts where id = $1"),
 *   params: O.some([123])
 * })
 *
 * strictEqual(O.getOrThrow(context.query), "select * from accounts where id = $1")
 * deepStrictEqual(O.getOrThrow(context.params), [123])
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DrizzleErrorContext extends S.Class<DrizzleErrorContext>($I`DrizzleErrorContext`)(
  {
    params: S.OptionFromOptionalKey(S.Unknown.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Raw SQL parameter values captured before normalized errors redact them.",
    }),
    query: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "SQL statement text captured from an explicit or native Drizzle error context.",
    }),
  },
  $I.annote("DrizzleErrorContext", {
    description: "Optional query context captured while normalizing Drizzle driver failures.",
  })
) {}

const emptyContext = (): DrizzleErrorContext => DrizzleErrorContext.make({});

const makeContext = (query: string | undefined, params: ReadonlyArray<unknown> | undefined): DrizzleErrorContext =>
  DrizzleErrorContext.make({
    query: O.fromUndefinedOr(query),
    params: O.map(
      O.fromUndefinedOr(params),
      A.map(() => REDACTED_SQL_PARAMETER)
    ),
  });

// shared driver boundary idiom; no in-family home; future foundation capability candidate.
// fallow-ignore-next-line code-duplication -- safe reflection keeps unknown SQL causes inside the Drizzle boundary
const readProperty = (value: unknown, key: PropertyKey): O.Option<unknown> => {
  if (!P.isObject(value)) {
    return O.none();
  }

  return O.fromUndefinedOr(
    Result.getOrElse(
      Result.try(() => Reflect.get(value, key)),
      () => undefined
    )
  );
};

const readString = (value: unknown, key: string): O.Option<string> => O.filter(readProperty(value, key), P.isString);

const readArray = (value: unknown, key: string): O.Option<ReadonlyArray<unknown>> =>
  O.filter(readProperty(value, key), (candidate): candidate is ReadonlyArray<unknown> => A.isArray(candidate));

const readCause = (value: unknown): O.Option<unknown> => readProperty(value, "cause");

const safeBoolean = (evaluate: () => boolean): boolean => Result.getOrElse(Result.try(evaluate), () => false);

const isCause = (value: unknown): value is Cause.Cause<unknown> => safeBoolean(() => Cause.isCause(value));

const readCauseReasons = (cause: Cause.Cause<unknown>): ReadonlyArray<Cause.Reason<unknown>> =>
  Result.getOrElse(
    Result.try(() => cause.reasons),
    A.empty<Cause.Reason<unknown>>
  );

const optionFromSafeDefect = (value: unknown): O.Option<unknown> =>
  P.hasInspectableObjectShape(value) && safeBoolean(() => S.is(S.Defect({ includeStack: true }))(value))
    ? O.some(value)
    : O.none();

const contextFromDrizzleMessageMatch = (matched: RegExpMatchArray): DrizzleErrorContext => {
  const paramsText = O.getOrUndefined(O.map(O.fromUndefinedOr(matched[2]), Str.trim));
  return makeContext(
    O.getOrUndefined(O.map(O.fromUndefinedOr(matched[1]), Str.trim)),
    paramsText === undefined || Str.isEmpty(paramsText) ? undefined : A.of(paramsText)
  );
};

const parseDrizzleMessage = (cause: unknown): DrizzleErrorContext => {
  const message = readString(cause, "message");

  return pipe(
    message,
    O.flatMap(Str.match(/^Failed query:\s*(.+?)(?:\nparams:\s*(.*))?$/s)),
    O.map(contextFromDrizzleMessageMatch),
    O.getOrElse(emptyContext)
  );
};

const hasQueryContext = (context: DrizzleErrorContext): boolean => O.isSome(context.query);

const hasSeenReference = (seen: ReadonlyArray<object>, value: object): boolean =>
  A.some(seen, (seenValue) => seenValue === value);

const contextFromDrizzleError = (error: DrizzleError): DrizzleErrorContext =>
  makeContext(O.getOrUndefined(error.query), O.getOrUndefined(error.params));

const existingDrizzleError = (value: unknown): O.Option<DrizzleError> =>
  DrizzleError.is(value) ? O.some(value) : O.none();

const reasonPayload = (reason: Cause.Reason<unknown>): O.Option<unknown> => {
  if (safeBoolean(() => Cause.isFailReason(reason))) {
    return readProperty(reason, "error");
  }
  if (safeBoolean(() => Cause.isDieReason(reason))) {
    return readProperty(reason, "defect");
  }
  return O.none();
};

const existingDrizzleErrorFromReason = (reason: Cause.Reason<unknown>): O.Option<DrizzleError> =>
  O.flatMap(reasonPayload(reason), existingDrizzleError);

const existingDrizzleErrorFromCause = (cause: Cause.Cause<unknown>): O.Option<DrizzleError> =>
  O.flatMap(
    A.findFirst(readCauseReasons(cause), flow(existingDrizzleErrorFromReason, O.isSome)),
    existingDrizzleErrorFromReason
  );

const existingDrizzleErrorFromUnknown = (value: unknown): O.Option<DrizzleError> => {
  const direct = existingDrizzleError(value);
  if (O.isSome(direct)) {
    return direct;
  }

  return isCause(value) ? existingDrizzleErrorFromCause(value) : O.none();
};

const extractCauseReasonContext: {
  (reason: Cause.Reason<unknown>, seen: ReadonlyArray<object>): DrizzleErrorContext;
  (seen: ReadonlyArray<object>): (reason: Cause.Reason<unknown>) => DrizzleErrorContext;
} = dual(2, (reason: Cause.Reason<unknown>, seen: ReadonlyArray<object>): DrizzleErrorContext => {
  const payload = reasonPayload(reason);
  if (O.isNone(payload)) {
    return emptyContext();
  }

  const existing = existingDrizzleError(payload.value);
  return O.isSome(existing) ? contextFromDrizzleError(existing.value) : extractNativeQueryContext(payload.value, seen);
});

const extractCauseContext = (cause: Cause.Cause<unknown>, seen: ReadonlyArray<object>): DrizzleErrorContext => {
  const reason = A.findFirst(readCauseReasons(cause), flow(extractCauseReasonContext(seen), hasQueryContext));

  return O.match(reason, {
    onNone: emptyContext,
    onSome: extractCauseReasonContext(seen),
  });
};

const redactedExistingDrizzleError = (error: DrizzleError): DrizzleError =>
  DrizzleError.make({
    operation: error.operation,
    cause: error.cause,
    query: error.query,
    params: O.map(
      error.params,
      A.map(() => REDACTED_SQL_PARAMETER)
    ),
  });

const extractNativeQueryContext = (cause: unknown, seen: ReadonlyArray<object> = []): DrizzleErrorContext => {
  if (P.isObject(cause) && hasSeenReference(seen, cause)) {
    return parseDrizzleMessage(cause);
  }

  if (isCause(cause)) {
    return extractCauseContext(cause, A.append(seen, cause));
  }

  if (!P.isObject(cause)) {
    return parseDrizzleMessage(cause);
  }

  if (O.exists(readString(cause, "_tag"), (tag) => tag === "EffectDrizzleQueryError")) {
    return makeContext(O.getOrUndefined(readString(cause, "query")), O.getOrUndefined(readArray(cause, "params")));
  }

  const messageContext = parseDrizzleMessage(cause);
  if (O.isSome(messageContext.query)) {
    return messageContext;
  }

  const nextSeen = A.append(seen, cause);

  return O.match(readCause(cause), {
    onNone: emptyContext,
    onSome: (nestedCause) => extractNativeQueryContext(nestedCause, nextSeen),
  });
};

/**
 * Technical failure normalized at the `@beep/drizzle` driver boundary.
 *
 * **Details**
 *
 * `operation` identifies the driver operation that failed. Optional query
 * context is captured from explicit context or native Drizzle Effect query
 * errors, with parameter values redacted before they leave the boundary.
 *
 * **Example** (Construct bare DrizzleError)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { DrizzleError, DrizzleOperation } from "@beep/drizzle"
 * import * as O from "effect/Option"
 *
 * const error = DrizzleError.make({
 *   operation: DrizzleOperation.Enum.execute,
 *   cause: O.none(),
 *   query: O.none(),
 *   params: O.none()
 * })
 *
 * strictEqual(error._tag, "DrizzleError")
 * strictEqual(error.operation, "execute")
 * strictEqual(O.isNone(error.params), true)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DrizzleError extends S.TaggedError<DrizzleError>($I`DrizzleError`)(
  "DrizzleError",
  {
    operation: DrizzleOperation.annotateKey({
      description: "Driver operation being normalized.",
    }),
    cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true }))
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({
        description: "Inspectable defect retained as the normalized technical cause.",
      }),
    query: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Optional SQL statement text retained for diagnostics.",
    }),
    params: S.OptionFromOptionalKey(RedactedSqlParams).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Optional SQL parameter values after redaction.",
    }),
  },
  $I.annote("DrizzleError", {
    description: "Technical Drizzle driver failure scoped to a driver operation.",
  })
) {
  static readonly is = (value: unknown): value is DrizzleError => safeBoolean(() => S.is(DrizzleError)(value));

  /**
   * Normalize an unknown driver failure into a {@link DrizzleError}.
   *
   * **Gotchas**
   *
   * Existing `DrizzleError` values keep their original operation and query
   * context, but parameter values are replaced with redaction markers. Native
   * Drizzle Effect query errors and `Failed query:` messages are inspected
   * defensively so hostile or cyclic causes do not escape normalization.
   *
   * **Example** (Normalize error with redaction)
   *
   * ```ts
   * import { deepStrictEqual, strictEqual } from "node:assert"
   * import { DrizzleError, DrizzleErrorContext } from "@beep/drizzle"
   * import * as O from "effect/Option"
   *
   * const error = DrizzleError.fromUnknown(
   *   "execute",
   *   new Error("driver failed"),
   *   DrizzleErrorContext.make({
   *     query: O.some("select * from accounts where id = $1"),
   *     params: O.some([123])
   *   })
   * )
   *
   * strictEqual(O.getOrThrow(error.query), "select * from accounts where id = $1")
   * deepStrictEqual(O.getOrThrow(error.params), ["<redacted>"])
   * ```
   *
   * @category errors
   * @since 0.0.0
   */
  static readonly fromUnknown = (
    operation: DrizzleOperation,
    cause?: unknown,
    context: DrizzleErrorContext = DrizzleErrorContext.make({})
  ): DrizzleError =>
    O.getOrElse(O.map(existingDrizzleErrorFromUnknown(cause), redactedExistingDrizzleError), () => {
      const nativeContext = extractNativeQueryContext(cause);
      return DrizzleError.make({
        operation,
        cause: optionFromSafeDefect(cause),
        query: O.orElse(context.query, () => nativeContext.query),
        params: O.map(
          O.orElse(context.params, () => nativeContext.params),
          A.map(() => REDACTED_SQL_PARAMETER)
        ),
      });
    });
}
