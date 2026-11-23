// Shared comparison primitives over structural version parts.
//
// Every module in the package compares versions through these functions, so
// SemVer 2.0.0 precedence rules live exactly once. Operating on structural
// parts (not the `SemVer` class) keeps this module import-cycle-free: the
// grammar, desugar and normalize pipeline and the `SemVer` class itself all
// consume it.

import { $SemverId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $SemverId.create("internal/order");

/**
 * Structural fields of a parsed version, shared by the parser pipeline.
 *
 * **Details**
 *
 * Numeric prerelease identifiers are numbers; alphanumeric prerelease identifiers and all build identifiers are strings. Empty arrays represent absent prerelease or build suffixes.
 *
 * **Example** (Recognize structural parser output)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { VersionParts } from "@beep/semver/internal/order";
 *
 * S.is(VersionParts)({ major: 1, minor: 2, patch: 3, prerelease: [], build: [] }); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class VersionParts extends S.Opaque<VersionParts, { readonly brand: unique symbol }>()(
  S.Struct({
    major: S.Finite.pipe(
      $I.annoteKey("VersionParts.major", { description: "The numeric major component before final SemVer validation." })
    ),
    minor: S.Finite.pipe(
      $I.annoteKey("VersionParts.minor", { description: "The numeric minor component before final SemVer validation." })
    ),
    patch: S.Finite.pipe(
      $I.annoteKey("VersionParts.patch", { description: "The numeric patch component before final SemVer validation." })
    ),
    prerelease: S.Array(S.Union([S.String, S.Finite])).pipe(
      $I.annoteKey("VersionParts.prerelease", {
        description: "Ordered numeric or text prerelease identifiers; empty for a stable release.",
      })
    ),
    build: S.Array(S.String).pipe(
      $I.annoteKey("VersionParts.build", { description: "Ordered build identifiers, ignored by version precedence." })
    ),
  }).pipe(
    $I.annoteSchema("VersionParts", {
      description:
        "Plain structural version parts shared by the parser and comparison pipeline before final SemVer validation.",
    })
  )
) {}

/**
 * Defines the relational operator prefix of a comparator (`=`, `>`, `>=`, `<`, `<=`).
 *
 * **Example** (Validate comparator operator literals)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ComparatorOperator } from "@beep/semver/internal/order"
 *
 * console.log(S.is(ComparatorOperator)(">=")) // true
 * console.log(S.is(ComparatorOperator)("~")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ComparatorOperator = LiteralKit(["=", ">", ">=", "<", "<="]).pipe(
  $I.annoteSchema("ComparatorOperator", {
    description: "The five relational operators supported by SemVer comparators.",
  })
);
/**
 * The relational operator literals accepted by the comparator operator schema.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ComparatorOperator = typeof ComparatorOperator.Type;

/**
 * Structural fields of a parsed comparator.
 *
 * **Details**
 *
 * Pairs a relational operator with the complete structural version used as its comparison bound.
 *
 * **Example** (Recognize a structural comparator)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { ComparatorParts } from "@beep/semver/internal/order";
 *
 * S.is(ComparatorParts)({ operator: ">=", version: { major: 1, minor: 0, patch: 0, prerelease: [], build: [] } }); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ComparatorParts extends S.Opaque<ComparatorParts, { readonly brand: unique symbol }>()(
  S.Struct({
    operator: ComparatorOperator.pipe(
      $I.annoteKey("ComparatorParts.operator", { description: "The relational operator applied to the version bound." })
    ),
    version: VersionParts.pipe(
      $I.annoteKey("ComparatorParts.version", {
        description: "The structural comparison bound before final SemVer validation.",
      })
    ),
  }).pipe(
    $I.annoteSchema("ComparatorParts", {
      description: "A plain structural comparator pairing an operator with its version bound.",
    })
  )
) {}

/**
 * Builds the positional, dual version constructor shared by `SemVer.of` and range desugaring.
 *
 * **Details**
 *
 * The returned function takes `major, minor, patch` plus optional prerelease and build identifiers (both default to empty) and hands the assembled fields to `make`. When called without `major` (its third argument is not a number) it returns a function awaiting `major`.
 *
 * **Example** (Build structural version parts positionally)
 *
 * ```ts
 * import { VersionParts, versionConstructor } from "@beep/semver/internal/order"
 *
 * const of = versionConstructor((fields) => VersionParts.make(fields))
 * console.log(of(1, 2, 3, ["rc", 1]).prerelease) // ["rc", 1]
 * console.log(of(2, 3)(1).major) // 1
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const versionConstructor = <A>(
  make: (fields: typeof VersionParts.Encoded) => A
): {
  (
    major: number,
    minor: number,
    patch: number,
    prerelease?: ReadonlyArray<string | number>,
    build?: ReadonlyArray<string>
  ): A;
  (
    minor: number,
    patch: number,
    prerelease?: ReadonlyArray<string | number>,
    build?: ReadonlyArray<string>
  ): (major: number) => A;
} =>
  dual(
    (args) => P.isNumber(args[2]),
    (
      major: number,
      minor: number,
      patch: number,
      prerelease: ReadonlyArray<string | number> = [],
      build: ReadonlyArray<string> = []
    ): A => make({ major, minor, patch, prerelease, build })
  );

const sign = (n: number): -1 | 0 | 1 => (n < 0 ? -1 : n > 0 ? 1 : 0);

// Orders two finite numbers.
const compareNumber = (a: number, b: number): -1 | 0 | 1 => (a === b ? 0 : a > b ? 1 : -1);

// Orders two strings by code unit, as the `<`/`>` operators do.
const compareText = (a: string, b: string): -1 | 0 | 1 => (a < b ? -1 : a > b ? 1 : 0);

// Orders two identifier sequences element by element; when every shared
// position matches, the shorter sequence sorts first.
const compareSequences = <I>(a: ReadonlyArray<I>, b: ReadonlyArray<I>, compare: (x: I, y: I) => number): -1 | 0 | 1 => {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const cmp = compare(A.getUnsafe(a, i), A.getUnsafe(b, i));
    if (cmp !== 0) return sign(cmp);
  }
  return compareNumber(a.length, b.length);
};

// Orders the `major.minor.patch` core, ignoring prerelease and build.
const compareCore = (a: typeof VersionParts.Encoded, b: typeof VersionParts.Encoded): -1 | 0 | 1 => {
  const major = compareNumber(a.major, b.major);
  if (major !== 0) return major;
  const minor = compareNumber(a.minor, b.minor);
  return minor === 0 ? compareNumber(a.patch, b.patch) : minor;
};

/**
 * Compares two prerelease identifiers per SemVer 2.0.0 §11.
 *
 * **Details**
 *
 * Numeric identifiers always have lower precedence than alphanumeric ones; numerics compare numerically, alphanumerics lexically. The sign determines ordering; comparing two numeric identifiers returns their difference rather than a normalized ordering value.
 *
 * **Example** (Compare numeric and alphanumeric identifiers)
 *
 * ```ts
 * import { comparePrereleaseIdentifier } from "@beep/semver/internal/order"
 *
 * console.log(comparePrereleaseIdentifier(2, 10)) // -8
 * console.log(comparePrereleaseIdentifier(1, "alpha")) // -1
 * console.log(comparePrereleaseIdentifier("beta")("alpha")) // -1
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const comparePrereleaseIdentifier: {
  (b: string | number): (a: string | number) => number;
  (a: string | number, b: string | number): number;
} = dual(2, (a: string | number, b: string | number): number => {
  // Numerics sort before alphanumerics; like kinds compare by value.
  if (P.isNumber(a)) return P.isNumber(b) ? a - b : -1;
  return P.isString(b) ? compareText(a, b) : 1;
});

// Orders prerelease sequences: a release (empty sequence) sorts after any
// prerelease of the same core; otherwise identifiers compare in sequence.
const comparePrerelease = (a: ReadonlyArray<string | number>, b: ReadonlyArray<string | number>): -1 | 0 | 1 =>
  a.length === 0 || b.length === 0
    ? compareNumber(b.length, a.length)
    : compareSequences(a, b, comparePrereleaseIdentifier);

/**
 * Compares two versions per SemVer 2.0.0 precedence (§11).
 *
 * **Details**
 *
 * Build metadata is ignored (§10). Major, minor, and patch components are compared first. A release sorts after a prerelease of the same core version; prerelease identifiers are compared in sequence, with the shorter sequence sorting first when its identifiers all match.
 *
 * **Example** (Order a prerelease before a release)
 *
 * ```ts
 * import { compareParts, VersionParts } from "@beep/semver/internal/order"
 *
 * const release = VersionParts.make({ major: 1, minor: 2, patch: 3, prerelease: [], build: ["first"] })
 * console.log(compareParts({ ...release, prerelease: ["alpha"] }, release)) // -1
 * console.log(compareParts(release, { ...release, build: ["second"] })) // 0
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const compareParts: {
  (b: typeof VersionParts.Encoded): (a: typeof VersionParts.Encoded) => -1 | 0 | 1;
  (a: typeof VersionParts.Encoded, b: typeof VersionParts.Encoded): -1 | 0 | 1;
} = dual(2, (a: typeof VersionParts.Encoded, b: typeof VersionParts.Encoded): -1 | 0 | 1 => {
  const core = compareCore(a, b);
  return core === 0 ? comparePrerelease(a.prerelease, b.prerelease) : core;
});

/**
 * Compares build metadata lexically, identifier by identifier.
 *
 * **Details**
 *
 * Versions without build metadata sort before versions with it. This is a total-order tiebreaker outside the SemVer spec (which ignores build metadata), used only by `SemVer.OrderWithBuild`. If matching identifiers exhaust one array first, the shorter array sorts first.
 *
 * **Example** (Break ties using build identifiers)
 *
 * ```ts
 * import { compareBuild } from "@beep/semver/internal/order"
 *
 * console.log(compareBuild([], ["build"])) // -1
 * console.log(compareBuild(["10"], ["2"])) // -1
 * console.log(compareBuild(["build", "1"], ["build"])) // 1
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const compareBuild: {
  (b: ReadonlyArray<string>): (a: ReadonlyArray<string>) => -1 | 0 | 1;
  (a: ReadonlyArray<string>, b: ReadonlyArray<string>): -1 | 0 | 1;
} = dual(
  2,
  // An empty build array is the shortest sequence, so it sorts before any
  // build metadata without a dedicated presence check.
  (a: ReadonlyArray<string>, b: ReadonlyArray<string>): -1 | 0 | 1 => compareSequences(a, b, compareText)
);
