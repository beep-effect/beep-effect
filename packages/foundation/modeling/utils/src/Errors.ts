/**
 * Error-channel mapping helpers for dual `Effect.mapError` wrappers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Effect } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";

/**
 * Dual data-first/data-last mapper for converting an effect's error channel.
 *
 * **Example** (Map effect error to class)
 *
 * ```ts
 * import { Err } from "@beep/utils";
 * import { Effect } from "effect";
 *
 * class CommandError {
 *   readonly cause: unknown;
 *   readonly message: string;
 *
 *   constructor(cause: unknown, message: string) {
 *     this.cause = cause;
 *     this.message = message;
 *   }
 *
 *   static readonly mapError: Err.ErrorMapper<CommandError, [message: string]> =
 *     Err.mapCauseError((cause, message) => new CommandError(cause, message));
 * }
 *
 * const error = Effect.runSync(
 *   Effect.flip(CommandError.mapError(Effect.fail("spawn failed"), "Failed to spawn command."))
 * );
 * console.log(error.message);
 * ```
 *
 * @typeParam Error - Target error type produced by the mapper.
 * @typeParam Args - Configuration arguments accepted after the source effect.
 * @typeParam Input - Source error-channel type accepted by the mapper.
 * @category type-level
 * @since 0.0.0
 */
export type ErrorMapper<Error, Args extends Array<unknown>, Input = unknown> = {
  <A, E extends Input, R>(self: Effect.Effect<A, E, R>, ...args: Args): Effect.Effect<A, Error, R>;
  (...args: Args): <A, E extends Input, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, Error, R>;
};

const isMapErrorDataFirst = (args: IArguments): boolean => Effect.isEffect(args[0]);

type ErrorBuilderFromInput<Input, Error> = (input: Input) => Error;

const isErrorBuilderFromInput = <Input, Error>(
  value: Error | ErrorBuilderFromInput<Input, Error>
): value is ErrorBuilderFromInput<Input, Error> => P.isFunction(value);

/**
 * Builds a dual mapper that preserves the original failure as constructor input.
 *
 * **Details**
 *
 * Use this when the target error shape has a `cause` field or equivalent
 * provenance slot and should retain the original error-channel value.
 *
 * **Example** (Preserve original failure as cause)
 *
 * ```ts import.meta.vitest name="Preserve original failure as cause"
 * import { Err } from "@beep/utils";
 * import { Effect, pipe } from "effect";
 *
 * class CommandError {
 *   readonly cause: unknown;
 *   readonly message: string;
 *
 *   constructor(cause: unknown, message: string) {
 *     this.cause = cause;
 *     this.message = message;
 *   }
 *
 *   static readonly mapError = Err.mapCauseError(
 *     (cause: unknown, message: string) => new CommandError(cause, message)
 *   );
 * }
 *
 * const error = Effect.runSync(
 *   pipe(Effect.fail("spawn failed"), CommandError.mapError("Failed to spawn command."), Effect.flip)
 * );
 * console.log(error.cause);
 * ```
 *
 * @typeParam Error - Target error type produced by the builder.
 * @typeParam Args - Builder arguments accepted after the captured cause.
 * @param build - Creates the target error from the original failure followed by mapper arguments.
 * @category error-handling
 * @since 0.0.0
 */
export const mapCauseError = <Error, Args extends Array<unknown>>(
  build: (cause: unknown, ...args: Args) => Error
): ErrorMapper<Error, Args> =>
  dual<
    (...args: Args) => <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, Error, R>,
    <A, E, R>(self: Effect.Effect<A, E, R>, ...args: Args) => Effect.Effect<A, Error, R>
  >(
    isMapErrorDataFirst,
    <A, E, R>(self: Effect.Effect<A, E, R>, ...args: Args): Effect.Effect<A, Error, R> =>
      Effect.mapError(self, (cause) => build(cause, ...args))
  );

/**
 * Builds a dual mapper that replaces the original failure with a target error.
 *
 * **Gotchas**
 *
 * Static builders receive only the mapper arguments and intentionally discard
 * the original failure. Curried builders may return a function that receives
 * the original failure, which lets dual constructors consume the source
 * error-channel value as their data-last input. Function-valued target errors
 * are treated as curried builders, so wrap function errors in an object before
 * returning them from `build`.
 *
 * **Example** (Replace failure with target error)
 *
 * ```ts import.meta.vitest name="Replace failure with target error"
 * import { Err } from "@beep/utils";
 * import { Effect, pipe } from "effect";
 * import { dual } from "effect/Function";
 *
 * class ExitError {
 *   readonly exitCode: number;
 *
 *   constructor(exitCode: number) {
 *     this.exitCode = exitCode;
 *   }
 *
 *   static readonly mapError = Err.mapToError((exitCode: number) => new ExitError(exitCode));
 * }
 *
 * const error = Effect.runSync(pipe(Effect.fail("ignored"), ExitError.mapError(1), Effect.flip));
 *
 * console.log(error.exitCode);
 *
 * class JoinedError {
 *   static readonly new: {
 *     (prefix: string, suffix: string): string;
 *     (suffix: string): (prefix: string) => string;
 *   } = dual(2, (prefix: string, suffix: string): string => `${prefix}${suffix}`);
 *
 *   static readonly mapError = Err.mapToError(this.new);
 * }
 *
 * const joined = Effect.runSync(
 *   pipe(Effect.fail("hello "), JoinedError.mapError("world"), Effect.flip)
 * );
 * console.log(joined);
 * ```
 *
 * @typeParam Error - Target error type produced by the builder.
 * @typeParam Args - Builder arguments accepted by the mapper.
 * @typeParam Input - Source error-channel type accepted by a curried builder.
 * @param build - Creates the target error from mapper arguments.
 * @category error-handling
 * @since 0.0.0
 */
export function mapToError<Args extends Array<unknown>, Input, Error>(
  build: (...args: Args) => ErrorBuilderFromInput<Input, Error>
): ErrorMapper<Error, Args, Input>;
export function mapToError<Error, Args extends Array<unknown>>(
  build: (...args: Args) => Error
): ErrorMapper<Error, Args>;
export function mapToError<Error, Args extends Array<unknown>, Input = unknown>(
  build: (...args: Args) => Error | ErrorBuilderFromInput<Input, Error>
): ErrorMapper<Error, Args, Input> {
  return dual<
    (...args: Args) => <A, E extends Input, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, Error, R>,
    <A, E extends Input, R>(self: Effect.Effect<A, E, R>, ...args: Args) => Effect.Effect<A, Error, R>
  >(
    isMapErrorDataFirst,
    <A, E extends Input, R>(self: Effect.Effect<A, E, R>, ...args: Args): Effect.Effect<A, Error, R> =>
      Effect.mapError(self, (input) => {
        const errorOrBuild = build(...args);
        return isErrorBuilderFromInput<E, Error>(errorOrBuild) ? errorOrBuild(input) : errorOrBuild;
      })
  );
}
