/**
 * Environment records: normalising a record a caller holds, and reading one from the ambient `ConfigProvider`.
 *
 * **Details**
 *
 * Both paths agree on one rule: an absent or empty value is unset, so the detectors downstream see only non-empty
 * values whichever way the record was built.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import type * as ConfigProvider from "effect/ConfigProvider";
import type { Env } from "./types.ts";

const isNonEmpty = (value: string | undefined): value is string => value !== undefined && value !== "";

/**
 * Drop an absent or empty value from a plain record, so it carries non-empty values only: the normalisation
 * {@link readEnv} applies to what it reads, for a record a caller already holds.
 *
 * **Example** (Remove empty and absent environment values)
 *
 * ```ts
 * import { normalizeEnv } from "@beep/runtime-env/internal/envRecord";
 * import * as R from "effect/Record";
 *
 * const env = normalizeEnv({ KEEP: "yes", EMPTY: "", MISSING: undefined });
 * console.log(R.size(env)) // 1
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const normalizeEnv = (record: Env): Env =>
  R.fromEntries(A.filter(R.toEntries(record), ([, value]) => isNonEmpty(value)));

/**
 * Read a fixed key set from the ambient `ConfigProvider` into a plain {@link Env} record.
 *
 * **Details**
 *
 * A key that is absent, or whose read fails for whatever reason, is left out of the record, so the record carries
 * non-empty values only. An empty string is normalized to absent here, under every provider, including one built
 * with `preserveEmptyStrings: true`, so `FORCE_COLOR=""` reads as unset whichever provider is ambient.
 *
 * **Example** (Construct a fixed-key environment read)
 *
 * ```ts
 * import { readEnv } from "@beep/runtime-env/internal/envRecord";
 * import * as Effect from "effect/Effect";
 *
 * const program = readEnv(["CI", "FORCE_COLOR"]);
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const readEnv = (keys: ReadonlyArray<string>): Effect.Effect<Env> =>
  Effect.forEach(
    keys,
    (key) =>
      Config.option(Config.String(key)).pipe(
        Effect.orElseSucceed(O.none<string>),
        Effect.map((value) => [key, value] as const)
      ),
    { concurrency: 1 }
  ).pipe(
    Effect.map((entries) =>
      R.fromEntries(
        A.flatMap(entries, ([key, value]) => (O.isSome(value) && isNonEmpty(value.value) ? [[key, value.value]] : []))
      )
    )
  );

/**
 * Whether an explicit environment source is a `ConfigProvider` rather than a plain record.
 *
 * **Details**
 *
 * A record's values are strings or `undefined`, so a function-valued `load` identifies a provider.
 *
 * **Example** (Tell a record from a provider)
 *
 * ```ts
 * import { isConfigProvider } from "@beep/runtime-env/internal/envRecord";
 * import * as ConfigProvider from "effect/ConfigProvider";
 *
 * console.log(isConfigProvider({ CI: "1" })) // false
 * console.log(isConfigProvider(ConfigProvider.fromEnv())) // true
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isConfigProvider = (
  source: Env | ConfigProvider.ConfigProvider
): source is ConfigProvider.ConfigProvider => P.isFunction(source.load);
