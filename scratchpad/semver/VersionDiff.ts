import { Schema } from "effect";
import { SemVer } from "./SemVer.ts";

const arraysEqual = (a: ReadonlyArray<string | number>, b: ReadonlyArray<string | number>): boolean =>
	a.length === b.length && a.every((v, i) => v === b[i]);

const classifyDiff = (a: SemVer, b: SemVer): "major" | "minor" | "patch" | "prerelease" | "build" | "none" => {
	if (a.major !== b.major) return "major";
	if (a.minor !== b.minor) return "minor";
	if (a.patch !== b.patch) return "patch";
	if (!arraysEqual(a.prerelease, b.prerelease)) return "prerelease";
	if (!arraysEqual(a.build, b.build)) return "build";
	return "none";
};

/**
 * The difference between two {@link SemVer} versions: the classification of
 * the change plus signed numeric deltas. A `Schema.TaggedClass` — the one
 * concept in this package where serialized tag discrimination earns its
 * keep.
 *
 * The `type` field is the highest-precedence field that differs: `"major"`,
 * `"minor"`, `"patch"`, `"prerelease"` (only prerelease identifiers differ),
 * `"build"` (only build metadata differs) or `"none"`.
 *
 * @example
 * ```ts
 * import { SemVer, VersionDiff } from "@effected/semver";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const a = yield* SemVer.parse("1.2.3");
 *   const b = yield* SemVer.parse("2.0.0");
 *   const diff = VersionDiff.between(a, b);
 *   return [diff.type, diff.major] as const;
 * });
 *
 * console.log(Effect.runSync(program));
 * // => ["major", 1]
 * ```
 *
 * @public
 */
export class VersionDiff extends Schema.TaggedClass<VersionDiff>()("VersionDiff", {
	/** The highest-precedence field that differs between `from` and `to`; see the class doc for the classification order. */
	type: Schema.Literals(["major", "minor", "patch", "prerelease", "build", "none"]),
	/** The earlier version being compared. */
	from: SemVer,
	/** The later version being compared. */
	to: SemVer,
	/** Signed delta of the major component (`to.major - from.major`). */
	major: Schema.Number,
	/** Signed delta of the minor component (`to.minor - from.minor`). */
	minor: Schema.Number,
	/** Signed delta of the patch component (`to.patch - from.patch`). */
	patch: Schema.Number,
}) {
	/**
	 * Compute the diff from `a` to `b`.
	 *
	 * @param a - the earlier version
	 * @param b - the later version
	 * @returns the classified diff with signed numeric deltas
	 */
	static between(a: SemVer, b: SemVer): VersionDiff {
		return VersionDiff.make({
			type: classifyDiff(a, b),
			from: a,
			to: b,
			major: b.major - a.major,
			minor: b.minor - a.minor,
			patch: b.patch - a.patch,
		});
	}

	/** Human-readable summary, e.g. `major (1.2.3 → 2.0.0)`. */
	override toString(): string {
		return `${this.type} (${this.from.toString()} → ${this.to.toString()})`;
	}
}
