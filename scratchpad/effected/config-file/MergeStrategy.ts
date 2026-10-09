import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import type { ConfigMatch } from "./ConfigResolver.ts";
import { canMerge, deepMerge } from "./internal/deepMerge.ts";

/**
 * A single configuration source discovered during a resolver-chain pass.
 *
 * @public
 */
export interface ConfigSource<A> {
	/** The filesystem path the value was read from. */
	readonly path: string;
	/** The name of the resolver that found it. */
	readonly resolver: string;
	/**
	 * How the resolver found it — the anchor directory and the candidate that
	 * matched.
	 *
	 * @remarks
	 * Populated by `ConfigFile.discover` for every source it produces: a
	 * resolver implementing `ConfigResolver.resolveMatch` reports its own
	 * detail, and one that does not yields a bare `{ path }`. Optional on the
	 * type so a hand-built `ConfigSource` — a merge-strategy test, a synthetic
	 * source — stays valid without one.
	 */
	readonly match?: ConfigMatch;
	/** The decoded, validated configuration value. */
	readonly value: A;
}

/** A source list guaranteed non-empty by the caller. @public */
export type NonEmptySources<A> = readonly [ConfigSource<A>, ...ConfigSource<A>[]];

/**
 * Strategy for combining several {@link ConfigSource} entries into one value.
 *
 * @remarks
 * Sources arrive in priority order, highest first. The list is non-empty by
 * construction — the empty case is the pipeline's concern and raises
 * `ConfigFileNotFoundError` before a strategy is ever consulted — so a strategy
 * cannot fail.
 *
 * @public
 */
export interface MergeStrategy<A> {
	/** The strategy's name, reported on the `Resolved` event. */
	readonly name: string;
	/** Combine the sources, highest priority first, into one value. */
	readonly resolve: (sources: NonEmptySources<A>) => Effect.Effect<A>;
}

const firstMatch = <A>(): MergeStrategy<A> => ({
	name: "first-match",
	resolve: (sources) => Effect.succeed(sources[0].value),
});

/**
 * Deep-merge every contributing source, higher priority winning on conflict.
 *
 * @remarks
 * Two values merge only when both are record-like and share a prototype, so a
 * document decoded through `Schema.Class` merges with another of the same class
 * and **survives as a real instance** — `instanceof` holds and its getters
 * still work. Everything else is atomic: a nested `Date`, `Map`, `Set`,
 * `RegExp`, array, or class instance is taken whole from the highest-priority
 * source that defines it, never reshaped field-by-field.
 *
 * The alternative — spreading each value into a fresh object — would make
 * `load`'s declared `Effect<A>` a lie, handing back a structurally-equal plain
 * object whose class methods are gone and whose `Date` fields have decayed to
 * `{}`.
 *
 * Nested *plain* objects (a `Schema.Struct` section) still merge field-wise.
 */
const layeredMerge = <A>(): MergeStrategy<A> => ({
	name: "layered-merge",
	resolve: (sources) => {
		// Fold from lowest priority upward so higher-priority keys overwrite.
		const [lowest, ...higherSources] = A.reverse(sources);
		let merged = lowest.value;
		for (const source of higherSources) {
			const higher = source.value;
			merged = canMerge(merged, higher) && P.isObject(higher) && P.isObject(merged)
				? deepMerge(higher, merged)
				: higher;
		}
		return Effect.succeed(merged);
	},
});

/**
 * Built-in merge strategies: `firstMatch` (the highest-priority source wins
 * whole) and `layeredMerge` (every source deep-merged, higher priority winning).
 *
 * @remarks
 * Strategies only combine sources; the walk up the directory tree belongs to
 * the `upwardWalk` resolver.
 *
 * @example
 * ```ts
 * import { MergeStrategy } from "./index.ts";
 *
 * const strategy = MergeStrategy.layeredMerge<{ port: number }>();
 * ```
 *
 * @public
 */
export const MergeStrategy = { firstMatch, layeredMerge } as const;
