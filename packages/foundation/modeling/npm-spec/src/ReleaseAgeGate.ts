/**
 * The `ReleaseAgeGate` concept: pnpm's publish-time release-age gate as shared
 * npm dependency vocabulary. A gate says how long (in minutes) a published
 * version must age before it is eligible, and which package names are exempt.
 *
 * **Details**
 *
 * pnpm reads two config keys — `minimumReleaseAge` (minutes) and
 * `minimumReleaseAgeExclude` (name patterns) — and refuses to install a version
 * younger than the cutoff (`ERR_PNPM_NO_MATURE_MATCHING_VERSION`). A resolver
 * that picks the highest in-range version with no publish-time awareness will
 * pick a version pnpm then rejects; mirroring the gate at resolution time (drop
 * candidates younger than the cutoff, unless excluded, before picking) fixes it.
 *
 * This module is the pure vocabulary: a `Schema.Class` gate, a partial-source
 * input shape, `combine` for merging contributions from multiple sources, the
 * name matcher, and a pure version filter. The clock is the caller's — every
 * operation is pure. Reading the gate from `pnpm-workspace.yaml` keys or from
 * replayed `updateConfig` hooks is a consumer concern (config IO), not this
 * pure-tier module's.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $NpmSpecId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import { constVoid, dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $NpmSpecId.create("ReleaseAgeGate");

const MS_PER_MINUTE = 60_000;

const decodePublishDateNativelyIncludingZonelessLocalTime = S.decodeOption(S.DateFromString);

/**
 * **Details**
 *
 * Deliberately permissive: unlike {@link ReleaseAgeGate} it does not constrain
 * `ageMinutes` to be non-negative, because the raw values arrive from arbitrary
 * config sources and {@link ReleaseAgeGate.combine} is the single authority
 * that clamps them.
 *
 * **Example** (Decode a partial gate contribution)
 *
 * ```ts
 * import { PartialReleaseAgeGate } from "@beep/npm-spec/ReleaseAgeGate";
 * import * as S from "effect/Schema";
 *
 * const contribution = S.decodeUnknownSync(PartialReleaseAgeGate)({ ageMinutes: -5 });
 * console.log(contribution.ageMinutes) // -5
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class PartialReleaseAgeGate extends S.Opaque<PartialReleaseAgeGate, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * Minutes a release must age; absent means this source sets no age.
     *
     * @since 0.0.0
     */
    ageMinutes: S.optionalKey(S.Finite).pipe(
      $I.annoteKey("PartialReleaseAgeGate.ageMinutes", {
        description: "Minutes a release must age; absent means this source sets no age.",
      })
    ),
    /**
     * Exempt package-name patterns; absent means this source adds no exemptions.
     *
     * @since 0.0.0
     */
    exclude: S.String.pipe(
      S.Array,
      S.optionalKey,
      $I.annoteKey("PartialReleaseAgeGate.exclude", {
        description: "Exempt package-name patterns; absent means this source adds no exemptions.",
      })
    ),
  }).pipe(
    $I.annoteSchema("PartialReleaseAgeGate", {
      description:
        "A source's partial contribution to a ReleaseAgeGate: the effective gate is assembled from more than one place (inline `pnpm-workspace.yaml` keys, replayed `updateConfig` hooks, `pnpm config get` output), and each source may set the age, the exclude list, both, or neither. Absent fields contribute nothing to the combination.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PartialReleaseAgeGate {
  /**
   * The plain, unbranded contribution shape accepted by `ReleaseAgeGate.combine`, so a config source can pass an object literal.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PartialReleaseAgeGate.Encoded;
}

// decision: release-age-minutes-not-integral
const AgeMinutes = S.Number.check(S.isGreaterThanOrEqualTo(0), S.isFinite()).pipe(
  $I.annoteSchema("AgeMinutes", {
    description: "A non-negative, finite minute count; fractional minutes are allowed.",
  })
);

type WildcardScan = readonly [nameIndex: number, patternIndex: number, starIndex: number, retryNameIndex: number];
const stepWildcardConsumingStarOrLiteralElseBacktrackingToLastStar = (
  name: string,
  pattern: string,
  scan: WildcardScan
): O.Option<WildcardScan> => {
  const [nameIndex, patternIndex, starIndex, retryNameIndex] = scan;
  if (pattern[patternIndex] === "*") return O.some([nameIndex, patternIndex + 1, patternIndex, nameIndex]);
  if (pattern[patternIndex] === name[nameIndex]) {
    return O.some([nameIndex + 1, patternIndex + 1, starIndex, retryNameIndex]);
  }
  return starIndex === -1 ? O.none() : O.some([retryNameIndex + 1, starIndex + 1, starIndex, retryNameIndex + 1]);
};

const ONLY_STARS = /^\**$/;

const matchesWildcardWithoutBuildingARegExpThatCouldBacktrackCatastrophically = (
  name: string,
  pattern: string
): boolean => {
  let scan: O.Option<WildcardScan> = O.some([0, 0, -1, 0]);
  while (O.isSome(scan) && scan.value[0] < name.length) {
    scan = stepWildcardConsumingStarOrLiteralElseBacktrackingToLastStar(name, pattern, scan.value);
  }
  return O.isSome(scan) && ONLY_STARS.test(Str.slice(scan.value[1])(pattern));
};

const matchesPattern: {
  (name: string, pattern: string): boolean;
  (pattern: string): (name: string) => boolean;
} = dual(
  2,
  (name: string, pattern: string): boolean =>
    pattern === name ||
    (Str.includes("*")(pattern) &&
      matchesWildcardWithoutBuildingARegExpThatCouldBacktrackCatastrophically(name, pattern))
);

const matchesExclude: {
  (name: string, patterns: readonly string[]): boolean;
  (patterns: readonly string[]): (name: string) => boolean;
} = dual(2, (name: string, patterns: readonly string[]): boolean =>
  A.some(patterns, (pattern) => matchesPattern(name, pattern))
);

/**
 * **Details**
 *
 * `ageMinutes` is constrained non-negative and finite; a `ReleaseAgeGate` with
 * `ageMinutes <= 0` is an inert gate that filters nothing. Assemble a gate from
 * multiple config sources with {@link ReleaseAgeGate.combine}, and apply it to
 * a package's candidate versions with {@link ReleaseAgeGate.filterVersions}.
 *
 * **Example** (Combine release-age settings and filter candidate versions)
 *
 * ```ts
 * import { ReleaseAgeGate } from "@beep/npm-spec/ReleaseAgeGate";
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
 *   Date.parse("2026-07-21T12:00:00Z"),
 * );
 * console.log(eligible.join(", ")) // 1.0.0
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class ReleaseAgeGate extends S.Class<ReleaseAgeGate, { readonly brand: unique symbol }>($I`ReleaseAgeGate`)(
  {
    /**
     * Minutes a published version must age before it is eligible (non-negative, finite).
     *
     * @since 0.0.0
     */
    ageMinutes: AgeMinutes.pipe(
      $I.annoteKey("ReleaseAgeGate.ageMinutes", {
        description: "Minutes a published version must age before it is eligible (non-negative, finite).",
      })
    ),
    /**
     * Package-name patterns exempt from the gate (exact names or `*`-globs).
     *
     * @since 0.0.0
     */
    exclude: S.Array(S.String).pipe(
      $I.annoteKey("ReleaseAgeGate.exclude", {
        description: "Package-name patterns exempt from the gate (exact names or `*`-globs).",
      })
    ),
  },
  $I.annote("ReleaseAgeGate", {
    description:
      "pnpm's publish-time release-age gate: the number of minutes a published version must age before it is eligible, and the set of package-name patterns exempt from the gate. Mirrors pnpm's `minimumReleaseAge` / `minimumReleaseAgeExclude` config so a resolver can drop too-young candidate versions before picking, avoiding `ERR_PNPM_NO_MATURE_MATCHING_VERSION`.",
  })
) {
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
   * **Details**
   *
   * `combine` is total — it never throws on a fractional, negative, or
   * non-finite contribution — which is why {@link (PartialReleaseAgeGate:variable)}
   * does not constrain its `ageMinutes` and this method owns the clamp.
   *
   * **Example** (Merge ages and exemptions)
   *
   * ```ts
   * import { ReleaseAgeGate } from "@beep/npm-spec/ReleaseAgeGate";
   *
   * const gate = ReleaseAgeGate.combine(
   *   { ageMinutes: 60, exclude: ["z", "a"] },
   *   { ageMinutes: 120, exclude: ["a"] },
   * );
   * console.log(gate.ageMinutes, gate.exclude.join(", ")) // 120 a, z
   * ```
   *
   * @param contributions - the partial gates to merge, one per source.
   * @category constructors
   * @since 0.0.0
   */
  static combine(...contributions: ReadonlyArray<PartialReleaseAgeGate.Encoded>): ReleaseAgeGate {
    const ages = A.filterMap(contributions, (contribution) => {
      const age = contribution.ageMinutes;
      return Result.fromOption(P.isNumber(age) && Number.isFinite(age) ? O.some(age) : O.none(), constVoid);
    });
    const ageMinutes = ages.length > 0 ? Math.max(0, ...ages) : 0;
    const exclude = A.sort(
      A.fromIterable(HashSet.fromIterable(A.flatMap(contributions, (contribution) => contribution.exclude ?? []))),
      Str.Order
    );
    return ReleaseAgeGate.make({ ageMinutes, exclude });
  }

  /**
   * Whether a package name matches any of `patterns`, using pnpm's
   * `@pnpm/matcher` semantics: an exact-name match, or a `*`-glob where `*`
   * matches any run of characters **including `/`** — so a bare `*` matches a
   * scoped name like `@scope/pkg`, and `@scope/*` matches every package in a
   * scope.
   *
   * **Gotchas**
   *
   * This is deliberately **NOT** `@beep/glob`'s minimatch dialect, in
   * which `*` refuses to cross `/` (there `*` matches `pkg` but not
   * `@scope/pkg`, and you would need `**`). pnpm treats the package name as a
   * flat string, so this matcher does too. Do not "fix" this to route through
   * `@beep/glob`: it would silently change which packages a gate exempts
   * and diverge from pnpm's own behavior.
   *
   * **Example** (Match scoped package names)
   *
   * ```ts
   * import { ReleaseAgeGate } from "@beep/npm-spec/ReleaseAgeGate";
   *
   * console.log(ReleaseAgeGate.matchesExclude("@scope/pkg", ["*"])) // true
   * ```
   *
   * @param name - the package name to test.
   * @param patterns - the exclude patterns (exact names or `*`-globs).
   * @category predicates
   * @since 0.0.0
   */
  static readonly matchesExclude: {
    (name: string, patterns: readonly string[]): boolean;
    (patterns: readonly string[]): (name: string) => boolean;
  } = matchesExclude;

  /**
   * Whether this gate exempts the given package name from the release-age
   * check — `ReleaseAgeGate.matchesExclude(name, this.exclude)`.
   *
   * **Example** (Check a gate exemption)
   *
   * ```ts
   * import { ReleaseAgeGate } from "@beep/npm-spec/ReleaseAgeGate";
   *
   * const gate = ReleaseAgeGate.combine({ ageMinutes: 60, exclude: ["@scope/*"] });
   * console.log(gate.isExcluded("@scope/pkg")) // true
   * ```
   *
   * @param name - the package name to test.
   * @category predicates
   * @since 0.0.0
   */
  isExcluded(name: string): boolean {
    return matchesExclude(name, this.exclude);
  }

  /**
   * Filter a package's candidate versions to those old enough to pass the
   * gate, given each version's publish timestamp and a caller-supplied `now`.
   *
   * **Details**
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
   * **Example** (Drop unknown and recent publication times)
   *
   * ```ts
   * import { ReleaseAgeGate } from "@beep/npm-spec/ReleaseAgeGate";
   *
   * const gate = ReleaseAgeGate.combine({ ageMinutes: 60 });
   * const versions = gate.filterVersions(
   *   ["1.0.0", "1.0.1", "1.0.2"],
   *   { "1.0.0": "2026-01-01T00:00:00Z", "1.0.1": "2026-01-01T01:30:00Z" },
   *   "example",
   *   Date.parse("2026-01-01T02:00:00Z"),
   * );
   * console.log(versions.join(", ")) // 1.0.0
   * ```
   *
   * @param versions - the candidate version strings.
   * @param times - a map from version string to its ISO-8601 publish date.
   * @param name - the package name (checked against the gate's `exclude` list).
   * @param now - the current time in epoch milliseconds (the caller's clock).
   * @category filtering
   * @since 0.0.0
   */
  filterVersions(
    versions: readonly string[],
    times: Readonly<Record<string, string>>,
    name: string,
    now: number
  ): readonly string[] {
    if (this.ageMinutes <= 0 || this.isExcluded(name)) return versions;
    const cutoff = now - this.ageMinutes * MS_PER_MINUTE;
    return A.filter(versions, (version) => {
      const time = times[version];
      if (time === undefined) return false;
      return O.exists(
        O.flatMap(decodePublishDateNativelyIncludingZonelessLocalTime(time), DateTime.make),
        (published) => DateTime.toEpochMillis(published) <= cutoff
      );
    });
  }
}
