/**
 * SemVer 2.0.0 §11 comparison primitives over structural version parts.
 *
 * Every module in the package compares versions through these functions, so
 * precedence rules live exactly once. Operating on parts (not the `SemVer`
 * class) keeps this module import-cycle-free: the grammar, desugar, and
 * normalize pipeline and the `SemVer` class itself all consume it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { Schema } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";

const $I = $ScratchpadId.create("semver/internal/order");

/**
 * Structural fields of a parsed version, shared by the parser pipeline.
 *
 * **Example** (Construct structural version parts)
 *
 * ```ts
 * import { VersionParts } from "../../../semver/internal/order.ts"
 *
 * const version = VersionParts.make({ major: 1, minor: 2, patch: 3, prerelease: [], build: [] })
 * console.log(version.major) // 1
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export const VersionParts = Schema.Struct({
  major: Schema.Finite,
  minor: Schema.Finite,
  patch: Schema.Finite,
  prerelease: Schema.Array(Schema.Union([Schema.String, Schema.Finite])),
  build: Schema.Array(Schema.String),
}).pipe(
  $I.annoteSchema("VersionParts", {
    description: "Structural major, minor, patch, prerelease, and build fields shared by the SemVer parser pipeline.",
  })
);

/**
 * Decoded structural version fields.
 *
 * @see {@link VersionParts} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type VersionParts = typeof VersionParts.Type;

/**
 * The relational operator prefix of a comparator (`=`, `>`, `>=`, `<`, `<=`).
 *
 * **Example** (Guard a comparator operator)
 *
 * ```ts
 * import { ComparatorOperator } from "../../../semver/internal/order.ts"
 * import { Schema } from "effect"
 *
 * console.log(Schema.is(ComparatorOperator)(">=")) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export const ComparatorOperator = Schema.Literals(["=", ">", ">=", "<", "<="]).pipe(
  $I.annoteSchema("ComparatorOperator", {
    description: "The closed relational-operator family accepted by SemVer comparators.",
  })
);

/**
 * Decoded comparator operator.
 *
 * @see {@link ComparatorOperator} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type ComparatorOperator = typeof ComparatorOperator.Type;

/**
 * Structural fields of a parsed comparator.
 *
 * **Example** (Construct structural comparator parts)
 *
 * ```ts
 * import { ComparatorParts, VersionParts } from "../../../semver/internal/order.ts"
 *
 * const version = VersionParts.make({ major: 1, minor: 0, patch: 0, prerelease: [], build: [] })
 * const comparator = ComparatorParts.make({ operator: ">=", version })
 * console.log(comparator.operator) // ">="
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export const ComparatorParts = Schema.Struct({
  operator: ComparatorOperator,
  version: VersionParts,
}).pipe(
  $I.annoteSchema("ComparatorParts", {
    description: "Structural operator and version fields shared by the SemVer comparator parser pipeline.",
  })
);

/**
 * Decoded structural comparator fields.
 *
 * @see {@link ComparatorParts} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type ComparatorParts = typeof ComparatorParts.Type;

/**
 * Compare two prerelease identifiers per SemVer 2.0.0 §11: numeric
 * identifiers always have lower precedence than alphanumeric ones; numerics
 * compare numerically, alphanumerics lexically.
 *
 * **Example** (Numeric identifiers sort before alphanumeric)
 *
 * ```ts
 * import { comparePrereleaseIdentifier } from "../../../semver/internal/order.ts";
 *
 * console.log(comparePrereleaseIdentifier(1, "alpha"));
 * // => -1
 * console.log(comparePrereleaseIdentifier("alpha", "beta"));
 * // => -1
 * ```
 *
 * @see {@link compareParts} for the full version comparison that uses this identifier rule.
 * @category combinators
 * @since 0.0.0
 */
export const comparePrereleaseIdentifier: {
  (a: string | number, b: string | number): number;
  (b: string | number): (a: string | number) => number;
} = dual(2, (a: string | number, b: string | number): number => {
  if (P.isNumber(a) && P.isNumber(b)) return a - b;
  if (P.isString(a) && P.isString(b)) return a < b ? -1 : a > b ? 1 : 0;
  if (P.isNumber(a)) return -1;
  return 1;
});

/**
 * Compare two versions per SemVer 2.0.0 precedence (§11). Build metadata is
 * ignored (§10).
 *
 * **Example** (Prerelease loses to the matching stable version)
 *
 * ```ts
 * import { compareParts } from "../../../semver/internal/order.ts";
 *
 * const alpha = { major: 1, minor: 0, patch: 0, prerelease: ["alpha"], build: [] };
 * const stable = { major: 1, minor: 0, patch: 0, prerelease: [], build: ["b"] };
 *
 * console.log(compareParts(alpha, stable));
 * // => -1
 * console.log(compareParts({ ...stable, build: ["a"] }, stable));
 * // => 0
 * ```
 *
 * @see {@link SemVer.Order} for the class-level Order that uses this comparison.
 * @see {@link compareBuild} when a total order over distinct version strings is required.
 * @category combinators
 * @since 0.0.0
 */
export const compareParts: {
  (a: VersionParts, b: VersionParts): -1 | 0 | 1;
  (b: VersionParts): (a: VersionParts) => -1 | 0 | 1;
} = dual(2, (a: VersionParts, b: VersionParts): -1 | 0 | 1 => {
  if (a.major !== b.major) return a.major > b.major ? 1 : -1;
  if (a.minor !== b.minor) return a.minor > b.minor ? 1 : -1;
  if (a.patch !== b.patch) return a.patch > b.patch ? 1 : -1;

  const aPre = a.prerelease;
  const bPre = b.prerelease;
  if (aPre.length === 0 && bPre.length === 0) return 0;
  if (aPre.length === 0) return 1;
  if (bPre.length === 0) return -1;

  const len = Math.min(aPre.length, bPre.length);
  for (let i = 0; i < len; i++) {
    const cmp = comparePrereleaseIdentifier(aPre[i], bPre[i]);
    if (cmp !== 0) return cmp < 0 ? -1 : 1;
  }

  if (aPre.length !== bPre.length) return aPre.length > bPre.length ? 1 : -1;
  return 0;
});

/**
 * Compare build metadata lexically, identifier by identifier. Versions
 * without build metadata sort before versions with it. This is a total-order
 * tiebreaker outside the SemVer spec (which ignores build metadata), used
 * only by `SemVer.OrderWithBuild`.
 *
 * **Example** (Empty build sorts before any identifier)
 *
 * ```ts
 * import { compareBuild } from "../../../semver/internal/order.ts";
 *
 * console.log(compareBuild(["a"], []));
 * // => 1
 * console.log(compareBuild(["a"], ["b"]));
 * // => -1
 * ```
 *
 * @see {@link SemVer.OrderWithBuild} for the class-level Order that uses this as a tiebreaker.
 * @see {@link compareParts} for spec precedence, which ignores build.
 * @category combinators
 * @since 0.0.0
 */
export const compareBuild: {
  (a: ReadonlyArray<string>, b: ReadonlyArray<string>): -1 | 0 | 1;
  (b: ReadonlyArray<string>): (a: ReadonlyArray<string>) => -1 | 0 | 1;
} = dual(2, (a: ReadonlyArray<string>, b: ReadonlyArray<string>): -1 | 0 | 1 => {
  const aHasBuild = a.length > 0;
  const bHasBuild = b.length > 0;
  if (!aHasBuild && bHasBuild) return -1;
  if (aHasBuild && !bHasBuild) return 1;

  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }

  if (a.length !== b.length) {
    return a.length < b.length ? -1 : 1;
  }

  return 0;
});
