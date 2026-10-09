// The pattern grammar pnpm applies to `peerDependencyRules.ignoreMissing` and
// `peerDependencyRules.allowAny` — a re-statement of `@pnpm/matcher@1000.1.0`'s
// `createMatcher`. A kit reimplementation rather than a dependency because the
// grammar is tiny and measured (`*` and a leading `!`, nothing else), and a
// pnpm-major-pinned `@pnpm/*` dependency for forty lines would widen the
// tier-3 blast radius that is deliberately confined to `internal/catalogs.ts`.
//
// An entry on either axis is a pattern over the PEER NAME. There is no parent
// in the grammar: `react-dom>react` is a literal name nothing declares, so it
// matches nothing — measured on pnpm 12.5.1 (`__test__/fixtures/peers/
// allowany/peers-check-parent-key.json` and the `ignoremissing/` twins). The
// `allowedVersions` key grammar does not carry over.
//
// Provenance for every rule below is the upstream source, read rather than
// recalled:
//
// - A lone `*` matches everything. Otherwise `*` is a wildcard within the
//   name spanning any run of characters, `/` included, and a pattern without
//   `*` is plain equality. That single-pattern grammar is exactly the one
//   `@effected/npm`'s `ReleaseAgeGate.matchesExclude` implements for pnpm's
//   `minimumReleaseAgeExclude` (same `@pnpm/matcher` source), as a
//   backtracking-safe linear scan — a RegExp built from a config-supplied
//   pattern is the hazard — so the per-pattern primitive delegates there.
// - A leading `!` negates the pattern that follows it.
// - Composition over a list: if no pattern is a negation, match when any
//   matches; if ALL are negations, match unless any negated pattern matches
//   (so `["!redux"]` and `["!a", "!b"]` both match everything not excluded);
//   if mixed, walk in order: an include sets the match when nothing has
//   matched yet, and a later negation that matches RESETS it (`["*",
//   "!redux"]` is everything except redux, while `["!redux", "*"]` is
//   everything — order matters).
// - An empty list matches nothing.

import { ReleaseAgeGate } from "../../npm/index.ts";

/** A predicate over a peer name. */
export type PeerNameMatcher = (name: string) => boolean;

/** One pattern (negation stripped) as a predicate, on the shared single-pattern grammar. */
const matcherFromPattern =
	(pattern: string): PeerNameMatcher =>
	(name) =>
		ReleaseAgeGate.matchesExclude(name, [pattern]);

const isNegation = (pattern: string): boolean => pattern.startsWith("!");

/**
 * Compile one `ignoreMissing` / `allowAny` list into a predicate over peer
 * names, with `@pnpm/matcher`'s composition rules (see the module header).
 *
 * @internal
 */
export const peerNameMatcher = (patterns: ReadonlyArray<string>): PeerNameMatcher => {
	if (patterns.length === 0) return () => false;
	const compiled = patterns.map((pattern) =>
		isNegation(pattern)
			? { negation: true, match: matcherFromPattern(pattern.slice(1)) }
			: { negation: false, match: matcherFromPattern(pattern) },
	);
	const negations = compiled.filter((entry) => entry.negation);
	if (negations.length === 0) return (name) => compiled.some((entry) => entry.match(name));
	if (negations.length === compiled.length) return (name) => !negations.some((entry) => entry.match(name));
	return (name) => {
		let matched = false;
		for (const entry of compiled) {
			if (entry.negation) {
				if (entry.match(name)) matched = false;
			} else if (!matched && entry.match(name)) {
				matched = true;
			}
		}
		return matched;
	};
};
