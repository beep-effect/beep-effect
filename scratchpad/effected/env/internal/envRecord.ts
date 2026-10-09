import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import type { Env } from "./types.ts";

/**
 * Drop an absent or empty value from a plain record, so it carries non-empty values only: the normalisation
 * {@link readEnv} applies to what it reads, for a record a caller already holds.
 *
 * @internal
 */
export const normalizeEnv = (record: Env): Env =>
	R.fromEntries(R.toEntries(record).filter(([, value]) => value !== undefined && value !== ""));

/**
 * Read a fixed key set from the ambient `ConfigProvider` into a plain {@link Env} record.
 *
 * @remarks
 * A key that is absent, or whose read fails for any reason, is left out of the record, so the record carries
 * non-empty values only. An empty string is normalized to absent here, under every provider, including one built
 * with `preserveEmptyStrings: true`, so `FORCE_COLOR=""` reads as unset whichever provider is ambient.
 *
 * @internal
 */
export const readEnv = (keys: ReadonlyArray<string>): Effect.Effect<Env> =>
	Effect.forEach(keys, (key) =>
		Config.option(Config.String(key)).pipe(
			Effect.orElseSucceed(O.none<string>),
			Effect.map((value) => [key, value] as const),
		),
	).pipe(
		Effect.map((entries) =>
			R.fromEntries(
				entries.flatMap(([key, value]) => (O.isSome(value) && value.value !== "" ? [[key, value.value]] : [])),
			),
		),
	);
