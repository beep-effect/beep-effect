/**
 * App-local helpers for optional OIP runtime configuration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { O, Str } from "@beep/utils";
import { Config, Effect, flow, pipe, Redacted } from "effect";
import { dual } from "effect/Function";

type ConfigErrorFactory<Error> = () => Error;
type TextConfigOptionReader<Error> = (key: string) => Effect.Effect<O.Option<string>, Error>;
type RedactedConfigOptionReader<Error> = (key: string) => Effect.Effect<O.Option<Redacted.Redacted<string>>, Error>;

/**
 * Trim optional text configuration and discard blank values.
 *
 * **Example** (Trimming config option)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { trimTextConfigOption } from "@/runtime/OipRuntimeConfig"
 *
 * const value = trimTextConfigOption(O.some("  oip  "))
 * console.log(O.getOrThrow(value)) // "oip"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
const trimTextConfigOption: (value: O.Option<string>) => O.Option<string> = flow(
  O.map(Str.trim),
  O.filter(Str.isNonEmpty)
);

/**
 * Build an optional plain-text configuration reader for an OIP runtime.
 *
 * **Example** (Building text config reader)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { makeTextConfigOptionReader } from "@/runtime/OipRuntimeConfig"
 *
 * const readOption = makeTextConfigOptionReader("Example.readOption", () => "config")
 * const program = Effect.option(readOption("OPTIONAL_NAME"))
 * console.log(program)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeTextConfigOptionReader: {
  <Error>(onConfigError: ConfigErrorFactory<Error>): (effectName: string) => TextConfigOptionReader<Error>;
  <Error>(effectName: string, onConfigError: ConfigErrorFactory<Error>): TextConfigOptionReader<Error>;
} = dual(
  2,
  <Error>(effectName: string, onConfigError: ConfigErrorFactory<Error>): TextConfigOptionReader<Error> =>
    Effect.fn(effectName)(function* (key: string) {
      const value = yield* Config.string(key).pipe(
        Config.option,
        Effect.mapError(() => onConfigError())
      );
      return trimTextConfigOption(value);
    })
);

/**
 * Build an optional redacted configuration reader for an OIP runtime.
 *
 * **Example** (Building redacted config reader)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { makeRedactedConfigOptionReader } from "@/runtime/OipRuntimeConfig"
 *
 * const readSecret = makeRedactedConfigOptionReader("Example.readSecret", () => "config")
 * const program = Effect.option(readSecret("OPTIONAL_TOKEN"))
 * console.log(program)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeRedactedConfigOptionReader: {
  <Error>(onConfigError: ConfigErrorFactory<Error>): (effectName: string) => RedactedConfigOptionReader<Error>;
  <Error>(effectName: string, onConfigError: ConfigErrorFactory<Error>): RedactedConfigOptionReader<Error>;
} = dual(
  2,
  <Error>(effectName: string, onConfigError: ConfigErrorFactory<Error>): RedactedConfigOptionReader<Error> =>
    Effect.fn(effectName)(function* (key: string) {
      const value = yield* Config.redacted(key).pipe(
        Config.option,
        Effect.mapError(() => onConfigError())
      );
      return pipe(
        value,
        O.filter((secret) => Str.isNonEmpty(Str.trim(Redacted.value(secret))))
      );
    })
);
