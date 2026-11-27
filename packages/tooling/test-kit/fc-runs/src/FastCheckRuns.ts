/**
 * Env-max Effect Arbitrary run-count helpers (one-round-loop P1).
 *
 * These helpers make every migrated site env-raisable: the effective run
 * count is `max(inline ?? default, BEEP_FC_NUM_RUNS)` — inline values
 * are floors and can never be lowered by the environment. `fcRunsCapped`
 * is the opt-out for I/O-heavy properties: a fixed count the floor
 * cannot raise, with the seed pin kept.
 *
 * Lives in this leaf package (upstream of the entire `@beep/test-utils`
 * dependency closure) so that `@beep/schema`, `@beep/utils`, and
 * `@beep/pglite` — which `@beep/test-utils` itself depends on — can
 * import `fcRuns` without forming a package cycle. `@beep/test-utils`
 * re-exports these helpers so existing `@beep/test-utils` imports keep
 * working unchanged.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import { constant, identity, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Str from "effect/String";
import type * as Arbitrary from "effect/Arbitrary";

/**
 * The historical default run count, used when a site passes no inline value.
 *
 * **Example** (Default run count value)
 *
 * ```ts
 * import { DEFAULT_FC_NUM_RUNS } from "@beep/fc-runs"
 *
 * console.log(DEFAULT_FC_NUM_RUNS) // 100
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const DEFAULT_FC_NUM_RUNS = 100;

/**
 * Parse a raw `BEEP_FC_NUM_RUNS` value into a usable floor.
 *
 * **Details**
 *
 * Non-integers, non-positives, and absent values collapse to 0 so the
 * result can feed the environment side of a `max()` directly.
 *
 * **Example** (Parse floor from raw values)
 *
 * ```ts
 * import { parseFcNumRunsFloor } from "@beep/fc-runs"
 *
 * console.log(parseFcNumRunsFloor("400")) // 400
 * console.log(parseFcNumRunsFloor("2.5")) // 0
 * console.log(parseFcNumRunsFloor(undefined)) // 0
 * ```
 *
 * @param raw - Raw environment value, if any.
 * @returns The parsed positive-integer floor, or 0.
 * @category testing
 * @since 0.0.0
 */
export const parseFcNumRunsFloor = (raw: string | undefined): number =>
  O.match(O.flatMap(O.fromNullishOr(raw), parsePositiveInteger), {
    onNone: constant(0),
    onSome: identity,
  });

const parsePositiveInteger = (raw: string): O.Option<number> => {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? O.some(parsed) : O.none();
};

const fcNumRunsConfig = Config.option(Config.String("BEEP_FC_NUM_RUNS"));

const fcSeedConfig = Config.option(Config.String("BEEP_FC_SEED"));

/**
 * Parse a raw `BEEP_FC_SEED` value into a seed.
 *
 * **Details**
 *
 * A seed is a 32-bit signed integer, -2147483648 to 2147483647; anything
 * else, an empty value and an absent one collapse to `O.none()`. The range is
 * what both generators replay exactly: fast-check wraps a larger seed modulo
 * 2^32, so two different logged seeds would draw the same values, while
 * `effect/Arbitrary` hashes the seed's text. The shared Vitest configuration,
 * its setup and {@link envFcSeed} all parse the seed with this, so a seed one
 * accepts is never dropped by another.
 *
 * **Example** (Parse seeds)
 *
 * ```ts
 * import { parseFcSeed } from "@beep/fc-runs"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrNull(parseFcSeed("42"))) // 42
 * console.log(O.getOrNull(parseFcSeed("2147483648"))) // null
 * console.log(O.getOrNull(parseFcSeed(" "))) // null
 * ```
 *
 * @param raw - Raw environment value, if any.
 * @returns The seed, or none when absent or not a 32-bit signed integer.
 * @category testing
 * @since 0.0.0
 */
export const parseFcSeed = (raw: string | undefined): O.Option<number> =>
  pipe(O.fromNullishOr(raw), O.map(Str.trim), O.filter(Str.isNonEmpty), O.map(Number), O.filter(isInt32));

const INT32_MIN = -2_147_483_648;
const INT32_MAX = 2_147_483_647;

function isInt32(seed: number): boolean {
  return Number.isInteger(seed) && seed >= INT32_MIN && seed <= INT32_MAX;
}

/**
 * Read the `BEEP_FC_SEED` environment seed pin.
 *
 * **Details**
 *
 * The seed-pin lane exports `BEEP_FC_SEED` so a rerun tests identical
 * inputs and a local green predicts a CI green. Ordinary runs leave it
 * unset and rotate seeds for breadth. Non-integer values collapse to
 * `O.none()`.
 *
 * **Example** (Read environment seed pin)
 *
 * ```ts
 * import { envFcSeed } from "@beep/fc-runs"
 * import * as O from "effect/Option"
 *
 * const seed = envFcSeed()
 * console.log(O.isOption(seed)) // true
 * ```
 *
 * @returns The pinned integer seed, or none when absent or invalid.
 * @category testing
 * @since 0.0.0
 */
export const envFcSeed = (): O.Option<number> => pipe(Effect.runSync(fcSeedConfig), O.getOrUndefined, parseFcSeed);

/**
 * Read the `BEEP_FC_NUM_RUNS` environment floor.
 *
 * **Details**
 *
 * Returns 0 when the variable is unset or not a positive integer, so it
 * can be used directly as the environment side of a `max()`.
 *
 * **Gotchas**
 *
 * The floor is read through Effect's default ConfigProvider, which snapshots the
 * environment once; a later change to `BEEP_FC_NUM_RUNS` in the same process is
 * not observed. The lanes export the floor before vitest starts.
 *
 * **Example** (Read environment floor value)
 *
 * ```ts
 * import { envFcNumRunsFloor } from "@beep/fc-runs"
 *
 * const floor = envFcNumRunsFloor()
 * console.log(floor >= 0) // true
 * ```
 *
 * @returns The configured floor, or 0 when absent or invalid.
 * @category testing
 * @since 0.0.0
 */
export const envFcNumRunsFloor = (): number =>
  pipe(Effect.runSync(fcNumRunsConfig), O.getOrUndefined, parseFcNumRunsFloor);

/**
 * Build Effect Arbitrary run options whose effective `runs` is
 * `max(inline ?? DEFAULT_FC_NUM_RUNS, BEEP_FC_NUM_RUNS)`.
 *
 * **Details**
 *
 * Inline values are floors: the environment can raise the run count for
 * a deep sweep (the nightly property lane runs with
 * `BEEP_FC_NUM_RUNS=1000`), but can never lower a site below the value
 * it declares (one-round-loop fence 3). When `BEEP_FC_SEED` pins an
 * integer seed, the options carry it so reruns test identical inputs;
 * an explicit inline `seed` spread over these options still wins.
 *
 * **Example** (Build maxed runs options)
 *
 * ```ts
 * import { fcRuns } from "@beep/fc-runs"
 *
 * const options = fcRuns(40)
 * console.log(options.runs >= 40) // true; higher when BEEP_FC_NUM_RUNS is set
 * ```
 *
 * @param inline - The site's own run count; defaults to 100.
 * @returns Check options for `Arbitrary.checkEffect`; pass `{ arbitrary: fcRuns(n) }` to `it.prop`.
 * @category testing
 * @since 0.0.0
 */
export const fcRuns = (inline?: number): Arbitrary.CheckOptions & { readonly runs: number } => ({
  runs: Math.max(inline ?? DEFAULT_FC_NUM_RUNS, envFcNumRunsFloor()),
  ...envSeedOption(),
});

const envSeedOption = (): { readonly seed: number } | undefined =>
  O.getOrUndefined(O.map(envFcSeed(), (seed) => ({ seed })));

/**
 * Build Effect Arbitrary run options with a fixed `runs` that the
 * `BEEP_FC_NUM_RUNS` floor cannot raise, while still honouring the
 * `BEEP_FC_SEED` pin.
 *
 * **Details**
 *
 * Use it for properties whose every run does real I/O or service work
 * (filesystem writes, ledger audits, subprocesses) over a small input
 * space, where the nightly property lane's `BEEP_FC_NUM_RUNS=1000` floor
 * would multiply wall time without exploring new behaviour. Pick `runs`
 * to cover the arbitrary's meaningful classes and say why at the call
 * site. Pure, cheap properties keep using {@link fcRuns} so the nightly
 * sweep can deepen them. The seed pin still applies, so a seeded rerun of
 * a nightly failure tests identical inputs; an explicit inline `seed`
 * spread over these options still wins.
 *
 * **Example** (Build capped runs options)
 *
 * ```ts
 * import { fcRunsCapped } from "@beep/fc-runs"
 *
 * const options = fcRunsCapped(10)
 * console.log(options.runs) // 10, even when BEEP_FC_NUM_RUNS=1000
 * ```
 *
 * @param runs - The fixed run count for the property.
 * @returns Check options for `Arbitrary.checkEffect`; pass `{ arbitrary: fcRunsCapped(n) }` to `it.prop`.
 * @category testing
 * @since 0.0.0
 */
export const fcRunsCapped = (runs: number): Arbitrary.CheckOptions & { readonly runs: number } => ({
  runs,
  ...envSeedOption(),
});
