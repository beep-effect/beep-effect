/**
 * Read the fields of a serialized Vitest error without trusting them: a
 * value a test threw may be any object, and a live getter (Effect's
 * `ConfigError.message` when its cause lacks `toString`) throws at the
 * property access itself. Ported from upstream `coerce-error-text.ts` and the
 * error mapping of `build-report.ts`.
 *
 * @since 0.0.0
 */
import { ItemDetail } from "@beep/gate-report/Item";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as Inspectable from "effect/Inspectable";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import type { LazyArg } from "effect/Function";
import type { VitestError } from "./VitestShapes.ts";

type VitestFrame = Exclude<NonNullable<VitestError["stacks"]>[number], string>;

/**
 * What a field reads as when its getter throws.
 *
 * @since 0.0.0
 */
export const UNREADABLE_FIELD = "<unreadable field>";

/**
 * The message an error without one is recorded with.
 *
 * @since 0.0.0
 */
export const MISSING_MESSAGE = "<missing message>";

const UNSERIALIZABLE = "<unserializable>";

/**
 * Turn an unknown field value into text: absent for `null` and `undefined`,
 * a string unchanged, anything else as compact JSON, and a marker when even
 * that throws (a null-prototype object).
 *
 * @since 0.0.0
 */
export const coerceErrorText = (value: unknown): O.Option<string> =>
  P.isNullish(value)
    ? O.none()
    : O.some(
        P.isString(value)
          ? value
          : Result.getOrElse(
              Result.try(() => Inspectable.toStringUnknown(value, 0)),
              () => UNSERIALIZABLE
            )
      );

/**
 * Read one field through a guarded access and coerce it: a getter that
 * throws reads as {@link UNREADABLE_FIELD}.
 *
 * @since 0.0.0
 */
export const readField = (read: LazyArg<unknown>): O.Option<string> =>
  Result.match(Result.try(read), {
    onFailure: () => O.some(UNREADABLE_FIELD),
    onSuccess: coerceErrorText,
  });

/**
 * Format one stack frame: a string passes through, a parsed frame renders
 * as `at <method> (<file>:<line>:<column>)`, an empty method as
 * `<anonymous>`.
 *
 * @since 0.0.0
 */
export const formatStackFrame = (frame: string | VitestFrame): string =>
  P.isString(frame)
    ? frame
    : `at ${pipe(
        O.fromNullishOr(frame.method),
        O.filter((method) => method.length > 0),
        O.getOrElse(() => "<anonymous>")
      )} (${frame.file ?? "<unknown>"}:${frame.line ?? 0}:${frame.column ?? 0})`;

/**
 * The parsed frames of an error, guarded: absent when reading them throws.
 *
 * @since 0.0.0
 */
export const framesOf = (error: VitestError): ReadonlyArray<string | VitestFrame> =>
  Result.getOrElse(
    Result.try(() => error.stacks ?? []),
    () => []
  );

const stackOf = (error: VitestError): O.Option<string> =>
  pipe(
    O.liftPredicate(framesOf(error), A.isReadonlyArrayNonEmpty),
    O.flatMap((frames) => Result.getSuccess(Result.try(() => A.join(A.map(frames, formatStackFrame), "\n")))),
    O.orElse(() => readField(() => error.stack))
  );

/**
 * The message an error reports, or {@link MISSING_MESSAGE}.
 *
 * @since 0.0.0
 */
export const messageOf = (error: VitestError): string =>
  O.getOrElse(
    readField(() => error.message),
    () => MISSING_MESSAGE
  );

/**
 * The detail an item records for an error: its message, its diff and its
 * formatted stack.
 *
 * @since 0.0.0
 */
export const errorDetail = (error: VitestError): ItemDetail =>
  ItemDetail.make({
    message: messageOf(error),
    diff: readField(() => error.diff),
    stack: stackOf(error),
  });
