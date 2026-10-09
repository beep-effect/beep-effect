// The `ReleaseAgeGate` concept: pnpm's publish-time release-age gate as shared
// npm dependency vocabulary. A gate says how long (in minutes) a published
// version must age before it is eligible, and which package names are exempt.
//
// pnpm reads two config keys — `minimumReleaseAge` (minutes) and
// `minimumReleaseAgeExclude` (name patterns) — and refuses to install a version
// younger than the cutoff (`ERR_PNPM_NO_MATURE_MATCHING_VERSION`). A resolver
// that picks the highest in-range version with no publish-time awareness will
// pick a version pnpm then rejects; mirroring the gate at resolution time (drop
// candidates younger than the cutoff, unless excluded, before picking) fixes it.
//
// This module is the pure vocabulary: a `Schema.Class` gate, a partial-source
// input shape, `combine` for merging contributions from multiple sources, the
// name matcher, and a pure version filter. The clock is the caller's — every
// operation is pure. Reading the gate from `pnpm-workspace.yaml` keys or from
// replayed `updateConfig` hooks is a consumer concern (config IO), not this
// pure-tier module's.

import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/npm/ReleaseAgeGate");

// pnpm's release-age is measured in minutes; the filter converts to ms.
const MS_PER_MINUTE = 60_000;

/**
 * A source's partial contribution to a {@link ReleaseAgeGate}: the effective
 * gate is assembled from more than one place (inline `pnpm-workspace.yaml`
 * keys, replayed `updateConfig` hooks, `pnpm config get` output), and each
 * source may set the age, the exclude list, both, or neither. Absent fields
 * contribute nothing to the combination.
 *
 * Deliberately permissive: unlike {@link ReleaseAgeGate} it does not constrain
 * `ageMinutes` to be non-negative, because the raw values arrive from arbitrary
 * config sources and {@link ReleaseAgeGate.combine} is the single authority
 * that clamps them.
 *
 * @public
 */
export const PartialReleaseAgeGate = S.Struct({
	/** Minutes a release must age; absent means this source sets no age. */
	ageMinutes: S.optionalKey(S.Finite).annotateKey({ description: "Minutes a release must age; absent means this source sets no age." }),
	/** Exempt package-name patterns; absent means this source adds no exemptions. */
	exclude: S.String.pipe(S.Array, S.optionalKey).annotateKey({ description: "Exempt package-name patterns; absent means this source adds no exemptions." }),
}).pipe($I.annoteSchema("PartialReleaseAgeGate", { description: "A source's partial contribution to a ReleaseAgeGate: the effective gate is assembled from more than one place (inline `pnpm-workspace.yaml` keys, replayed `updateConfig` hooks, `pnpm config get` output), and each source may set the age, the exclude list, both, or neither. Absent fields contribute nothing to the combination." }));

/**
 * One source's partial contribution to a release-age gate. All fields optional.
 *
 * @public
 */
export type PartialReleaseAgeGate = typeof PartialReleaseAgeGate.Type;

// A non-negative, finite minute count. `isGreaterThanOrEqualTo(0)` already
// rejects `NaN` (NaN >= 0 is false); `isFinite` additionally rejects Infinity.
// Integrality is deliberately NOT enforced — pnpm's config is a non-negative
// integer of minutes, but `combine` takes `Math.max` of arbitrary finite
// contributions, and requiring an integer here would make a fractional
// contribution throw at construction, breaking `combine`'s totality.
const AgeMinutes = S.Finite.check(S.isGreaterThanOrEqualTo(0), S.isFinite());

// Match a package name against a single pattern with pnpm `@pnpm/matcher`
// semantics: an exact-name match, or a `*`-glob where `*` matches ANY run of
// characters INCLUDING `/`. Every other character matches literally, so `*`
// is the only wildcard. See the divergence note on `matchesExclude`.
const matchesPattern = (name: string, pattern: string): boolean => {
	if (pattern === name) return true;
	if (!pattern.includes("*")) return false;
	// Linear two-pointer wildcard scan (greedy `*` with backtrack-to-star):
	// `*` matches any run of characters including `/` (crosses `/`, unlike
	// minimatch); every other character matches literally. No RegExp is built
	// from the pattern — a config-supplied pattern like `*a*a*a*b` must not be
	// able to trigger catastrophic regex backtracking against a near-match.
	let nameIndex = 0;
	let patternIndex = 0;
	let starIndex = -1;
	let retryNameIndex = 0;
	while (nameIndex < name.length) {
		if (pattern[patternIndex] === "*") {
			starIndex = patternIndex;
			patternIndex += 1;
			retryNameIndex = nameIndex;
		} else if (pattern[patternIndex] === name[nameIndex]) {
			patternIndex += 1;
			nameIndex += 1;
		} else if (starIndex !== -1) {
			patternIndex = starIndex + 1;
			retryNameIndex += 1;
			nameIndex = retryNameIndex;
		} else {
			return false;
		}
	}
	while (pattern[patternIndex] === "*") patternIndex += 1;
	return patternIndex === pattern.length;
};

const matchesExclude = (name: string, patterns: readonly string[]): boolean =>
	patterns.some((pattern) => matchesPattern(name, pattern));

/**
 * pnpm's publish-time release-age gate: the number of minutes a published
 * version must age before it is eligible, and the set of package-name patterns
 * exempt from the gate. Mirrors pnpm's `minimumReleaseAge` /
 * `minimumReleaseAgeExclude` config so a resolver can drop too-young candidate
 * versions before picking, avoiding `ERR_PNPM_NO_MATURE_MATCHING_VERSION`.
 *
 * `ageMinutes` is constrained non-negative and finite; a `ReleaseAgeGate` with
 * `ageMinutes <= 0` is an inert gate that filters nothing. Assemble a gate from
 * multiple config sources with {@link ReleaseAgeGate.combine}, and apply it to
 * a package's candidate versions with {@link ReleaseAgeGate.filterVersions}.
 *
 * @example
 * ```ts
 * import { ReleaseAgeGate } from "./index.ts";
 *
 * const gate = ReleaseAgeGate.combine(
 *   { ageMinutes: 1440 },
 *   { exclude: ["@my-scope/*"] },
 * );
 * // gate.ageMinutes === 1440, gate.exclude === ["@my-scope/*"]
 *
 * const eligible = gate.filterVersions(
 *   ["1.0.0", "1.0.1"],
 *   { "1.0.0": "2020-01-01T00:00:00Z", "1.0.1": "2026-07-21T00:00:00Z" },
 *   "prettier",
 *   Date.now(),
 * );
 * ```
 *
 * @public
 */
export class ReleaseAgeGate extends S.Class<ReleaseAgeGate>($I`ReleaseAgeGate`)({
	/** Minutes a published version must age before it is eligible (non-negative, finite). */
	ageMinutes: AgeMinutes.annotateKey({ description: "Minutes a published version must age before it is eligible (non-negative, finite)." }),
	/** Package-name patterns exempt from the gate (exact names or `*`-globs). */
	exclude: S.Array(S.String).annotateKey({ description: "Package-name patterns exempt from the gate (exact names or `*`-globs)." }),
}, $I.annote("ReleaseAgeGate", { description: "pnpm's publish-time release-age gate: the number of minutes a published version must age before it is eligible, and the set of package-name patterns exempt from the gate. Mirrors pnpm's `minimumReleaseAge` / `minimumReleaseAgeExclude` config so a resolver can drop too-young candidate versions before picking, avoiding `ERR_PNPM_NO_MATURE_MATCHING_VERSION`." })) {
	/**
	 * Combine partial contributions from multiple sources into one effective
	 * gate: **strictest age wins** (the maximum of the contributed ages,
	 * clamped to be non-negative) and the exclude sets **union** (deduplicated,
	 * lexicographically sorted — a canonical wire form, so the combined gate is
	 * deterministic regardless of the order contributions arrive in). A
	 * contribution's absent field adds nothing; a
	 * negative or non-finite contributed age is ignored by the clamp. With no
	 * contributions (or only empty ones) the result is the inert zero gate
	 * (`ageMinutes: 0`, `exclude: []`).
	 *
	 * `combine` is total — it never throws on a fractional, negative, or
	 * non-finite contribution — which is why {@link (PartialReleaseAgeGate:variable)}
	 * does not constrain its `ageMinutes` and this method owns the clamp.
	 *
	 * @param contributions - the partial gates to merge, one per source.
	 */
	static combine(...contributions: readonly PartialReleaseAgeGate[]): ReleaseAgeGate {
		const ages = contributions
			.map((contribution) => contribution.ageMinutes)
			.filter((age): age is number => typeof age === "number" && Number.isFinite(age));
		const ageMinutes = ages.length > 0 ? Math.max(0, ...ages) : 0;
		const exclude = [...new Set(contributions.flatMap((contribution) => contribution.exclude ?? []))].sort();
		return ReleaseAgeGate.make({ ageMinutes, exclude });
	}

	/**
	 * Whether a package name matches any of `patterns`, using pnpm's
	 * `@pnpm/matcher` semantics: an exact-name match, or a `*`-glob where `*`
	 * matches any run of characters **including `/`** — so a bare `*` matches a
	 * scoped name like `@scope/pkg`, and `@scope/*` matches every package in a
	 * scope.
	 *
	 * @remarks
	 * This is deliberately **NOT** `@effected/glob`'s minimatch dialect, in
	 * which `*` refuses to cross `/` (there `*` matches `pkg` but not
	 * `@scope/pkg`, and you would need `**`). pnpm treats the package name as a
	 * flat string, so this matcher does too. Do not "fix" this to route through
	 * `@effected/glob`: it would silently change which packages a gate exempts
	 * and diverge from pnpm's own behavior.
	 *
	 * @param name - the package name to test.
	 * @param patterns - the exclude patterns (exact names or `*`-globs).
	 */
	static matchesExclude(name: string, patterns: readonly string[]): boolean {
		return matchesExclude(name, patterns);
	}

	/**
	 * Whether this gate exempts the given package name from the release-age
	 * check — `ReleaseAgeGate.matchesExclude(name, this.exclude)`.
	 *
	 * @param name - the package name to test.
	 */
	isExcluded(name: string): boolean {
		return matchesExclude(name, this.exclude);
	}

	/**
	 * Filter a package's candidate versions to those old enough to pass the
	 * gate, given each version's publish timestamp and a caller-supplied `now`.
	 *
	 * A version is kept when it has a parseable publish timestamp at or before
	 * the cutoff (`now - ageMinutes * 60000`). A version with a **missing or
	 * unparseable** timestamp in `times` is **dropped** — matching pnpm's strict
	 * posture: a version whose age cannot be established is treated as too young.
	 * The clock is the caller's; this method reads no wall clock.
	 *
	 * Returns all versions unchanged (a no-op) when the gate is inert
	 * (`ageMinutes <= 0`) or the package name is excluded.
	 *
	 * @param versions - the candidate version strings.
	 * @param times - a map from version string to its ISO-8601 publish date.
	 * @param name - the package name (checked against the gate's `exclude` list).
	 * @param now - the current time in epoch milliseconds (the caller's clock).
	 */
	filterVersions(
		versions: readonly string[],
		times: Readonly<Record<string, string>>,
		name: string,
		now: number,
	): readonly string[] {
		if (this.ageMinutes <= 0 || this.isExcluded(name)) return versions;
		const cutoff = now - this.ageMinutes * MS_PER_MINUTE;
		return versions.filter((version) => {
			const time = times[version];
			if (time === undefined) return false;
			const published = Date.parse(time);
			return Number.isFinite(published) && published <= cutoff;
		});
	}
}
