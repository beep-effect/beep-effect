import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { SemVer } from "./SemVer.ts";

const $I = $ScratchpadId.create("effected/semver/VersionDiff");

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
 * the change plus signed numeric deltas. A `Schema.TaggedClass`, so a serialized
 * diff carries a `_tag` discriminator.
 *
 * **Details**
 *
 * The `type` field is the highest-precedence field that differs: `"major"`,
 * `"minor"`, `"patch"`, `"prerelease"` (only prerelease identifiers differ),
 * `"build"` (only build metadata differs) or `"none"`.
 *
 * **Example** (Classify a major version change and its delta)
 *
 * ```ts
 * import { SemVer, VersionDiff } from "./index.ts";
 * import * as Effect from "effect/Effect";
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
export class VersionDiff extends S.TaggedClass<VersionDiff>($I`VersionDiff`)("VersionDiff", {
	/** The highest-precedence field that differs between `from` and `to`; see the class doc for the classification order. */
	type: S.Literals(["major", "minor", "patch", "prerelease", "build", "none"]).annotateKey({ description: "The highest-precedence field that differs between `from` and `to`; see the class doc for the classification order." }),
	/** The earlier version being compared. */
	from: SemVer.annotateKey({ description: "The earlier version being compared." }),
	/** The later version being compared. */
	to: SemVer.annotateKey({ description: "The later version being compared." }),
	/** Signed delta of the major component (`to.major - from.major`). */
	major: S.Finite.annotateKey({ description: "Signed delta of the major component (`to.major - from.major`)." }),
	/** Signed delta of the minor component (`to.minor - from.minor`). */
	minor: S.Finite.annotateKey({ description: "Signed delta of the minor component (`to.minor - from.minor`)." }),
	/** Signed delta of the patch component (`to.patch - from.patch`). */
	patch: S.Finite.annotateKey({ description: "Signed delta of the patch component (`to.patch - from.patch`)." }),
}, $I.annote("VersionDiff", { description: "The difference between two SemVer versions: the classification of the change plus signed numeric deltas. A `Schema.TaggedClass`, so a serialized diff carries a `_tag` discriminator." })) {
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
