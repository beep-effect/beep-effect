/**
 * The tagged classification of the change between two SemVer versions.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SemverId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { SemVer } from "./SemVer.ts";

const $I = $SemverId.create("VersionDiff");

const arraysEqual: {
  (a: ReadonlyArray<string | number>, b: ReadonlyArray<string | number>): boolean;
  (b: ReadonlyArray<string | number>): (a: ReadonlyArray<string | number>) => boolean;
} = dual(
  2,
  (a: ReadonlyArray<string | number>, b: ReadonlyArray<string | number>): boolean =>
    a.length === b.length && A.every(a, (v, i) => v === b[i])
);

const classifyDiff: {
  (a: SemVer, b: SemVer): "major" | "minor" | "patch" | "prerelease" | "build" | "none";
  (b: SemVer): (a: SemVer) => "major" | "minor" | "patch" | "prerelease" | "build" | "none";
} = dual(2, (a: SemVer, b: SemVer): "major" | "minor" | "patch" | "prerelease" | "build" | "none" => {
  if (a.major !== b.major) return "major";
  if (a.minor !== b.minor) return "minor";
  if (a.patch !== b.patch) return "patch";
  if (!arraysEqual(a.prerelease, b.prerelease)) return "prerelease";
  if (!arraysEqual(a.build, b.build)) return "build";
  return "none";
});

/**
 * **Details**
 *
 * The `type` field is the highest-precedence field that differs: `"major"`,
 * `"minor"`, `"patch"`, `"prerelease"` (only prerelease identifiers differ),
 * `"build"` (only build metadata differs) or `"none"`.
 *
 * **Example** (Classify a major version change and its delta)
 *
 * ```ts
 * import { SemVer } from "@beep/semver/SemVer";
 * import { VersionDiff } from "@beep/semver/VersionDiff";
 *
 * const diff = VersionDiff.between(SemVer.of(1, 2, 3), SemVer.of(2, 0, 0));
 * console.log(`${diff.type}: ${diff.major}`); // major: 1
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class VersionDiff extends S.TaggedClass<VersionDiff, { readonly brand: unique symbol }>($I`VersionDiff`)(
  "VersionDiff",
  {
    /** The highest-precedence field that differs between `from` and `to`; see the class doc for the classification order. */
    type: S.Literals(["major", "minor", "patch", "prerelease", "build", "none"]).pipe(
      $I.annoteKey("VersionDiff.type", {
        description:
          "The highest-precedence field that differs between `from` and `to`; see the class doc for the classification order.",
      })
    ),
    /** The earlier version being compared. */
    from: SemVer.pipe($I.annoteKey("VersionDiff.from", { description: "The earlier version being compared." })),
    /** The later version being compared. */
    to: SemVer.pipe($I.annoteKey("VersionDiff.to", { description: "The later version being compared." })),
    /** Signed delta of the major component (`to.major - from.major`). */
    major: S.Finite.pipe(
      $I.annoteKey("VersionDiff.major", {
        description: "Signed delta of the major component (`to.major - from.major`).",
      })
    ),
    /** Signed delta of the minor component (`to.minor - from.minor`). */
    minor: S.Finite.pipe(
      $I.annoteKey("VersionDiff.minor", {
        description: "Signed delta of the minor component (`to.minor - from.minor`).",
      })
    ),
    /** Signed delta of the patch component (`to.patch - from.patch`). */
    patch: S.Finite.pipe(
      $I.annoteKey("VersionDiff.patch", {
        description: "Signed delta of the patch component (`to.patch - from.patch`).",
      })
    ),
  },
  $I.annote("VersionDiff", {
    description:
      "The difference between two SemVer versions: the classification of the change plus signed numeric deltas. A `Schema.TaggedClass`, so a serialized diff carries a `_tag` discriminator.",
  })
) {
  /**
   * Compute the diff from `a` to `b`.
   *
   * **Example** (Measure signed component deltas)
   *
   * ```ts
   * import { SemVer } from "@beep/semver/SemVer";
   * import { VersionDiff } from "@beep/semver/VersionDiff";
   *
   * const diff = VersionDiff.between(SemVer.of(1, 2, 3), SemVer.of(2, 0, 0));
   * console.log(`${diff.type}: ${diff.major}`); // major: 1
   * ```
   *
   * @param a - the earlier version
   * @param b - the later version
   * @returns the classified diff with signed numeric deltas
   * @category constructors
   * @since 0.0.0
   */
  static readonly between: {
    (a: SemVer, b: SemVer): VersionDiff;
    (b: SemVer): (a: SemVer) => VersionDiff;
  } = dual(
    2,
    (a: SemVer, b: SemVer): VersionDiff =>
      VersionDiff.make({
        type: classifyDiff(a, b),
        from: a,
        to: b,
        major: b.major - a.major,
        minor: b.minor - a.minor,
        patch: b.patch - a.patch,
      })
  );

  /**
   * Human-readable summary, e.g. `major (1.2.3 → 2.0.0)`.
   *
   * **Example** (Format a version difference)
   *
   * ```ts
   * import { SemVer } from "@beep/semver/SemVer";
   * import { VersionDiff } from "@beep/semver/VersionDiff";
   *
   * const diff = VersionDiff.between(SemVer.of(1, 2, 3), SemVer.of(2, 0, 0));
   * console.log(diff.toString()); // major (1.2.3 → 2.0.0)
   * ```
   *
   * @category formatting
   * @since 0.0.0
   */
  override toString(): string {
    return `${this.type} (${this.from.toString()} → ${this.to.toString()})`;
  }
}
