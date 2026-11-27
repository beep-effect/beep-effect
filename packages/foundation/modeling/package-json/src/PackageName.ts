/**
 * Valid npm package names: the `ScopedPackageName` / `UnscopedPackageName`
 * branded schemas, the `PackageName` union with its classification statics
 * (`PackageName.isValid`, `PackageName.scope`, `PackageName.unscoped`,
 * `PackageName.isScoped`), and the `InvalidPackageNameError` the concept
 * raises.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PackageJsonId } from "@beep/identity/packages";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type * as Brand from "effect/Brand";

const $I = $PackageJsonId.create("PackageName");

/**
 * **Details**
 *
 * Raised by {@link Package.setName} and the decode direction of
 * `PackageName`. The offending string is preserved on `input`.
 *
 * **Example** (Report an invalid package name)
 *
 * ```ts
 * import { InvalidPackageNameError } from "@beep/package-json/PackageName";
 *
 * const error = InvalidPackageNameError.make({ input: "Bad Name" });
 * console.log(error.message) // Invalid package name "Bad Name": does not satisfy npm naming rules
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class InvalidPackageNameError extends S.TaggedError<InvalidPackageNameError, { readonly brand: unique symbol }>(
  $I`InvalidPackageNameError`
)(
  "InvalidPackageNameError",
  {
    /**
     * The raw input string that failed validation.
     *
     * @category models
     * @since 0.0.0
     */
    input: S.String.pipe(
      $I.annoteKey("InvalidPackageNameError.input", { description: "The raw input string that failed validation." })
    ),
  },
  $I.annoteError<InvalidPackageNameError>("InvalidPackageNameError", {
    description: "Indicates that a string could not be used as a valid npm package name.",
  })
) {
  /**
   * Explains which input failed npm naming rules.
   *
   * **Example** (Read the invalid-name report)
   *
   * ```ts
   * import { InvalidPackageNameError } from "@beep/package-json/PackageName";
   *
   * console.log(InvalidPackageNameError.make({ input: "Bad Name" }).message) // Invalid package name "Bad Name": does not satisfy npm naming rules
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    return `Invalid package name "${this.input}": does not satisfy npm naming rules`;
  }
}

// decision: lookahead-free-package-name-grammar
const UNSCOPED_RE = /^[a-z0-9][a-z0-9._-]*$/u;
const SCOPED_RE = /^@[a-z0-9-][a-z0-9._-]*\/[a-z0-9-][a-z0-9._-]*$/u;
const MAX_LENGTH = 214;
const RESERVED_NAMES = HashSet.make("node_modules", "favicon.ico");

const isNotReserved = S.makeFilter(
  (name: string) => (HashSet.has(RESERVED_NAMES, name) ? `"${name}" is reserved by npm` : undefined),
  $I.annote("UnscopedPackageNameReserved", {
    message: "Unreserved package name",
    description: "An unscoped package name other than the two npm reserves outright: node_modules and favicon.ico.",
  })
);

/**
 * **Example** (Decode a scoped package name)
 *
 * ```ts
 * import { ScopedPackageName } from "@beep/package-json/PackageName";
 * import * as S from "effect/Schema";
 *
 * console.log(S.decodeUnknownSync(ScopedPackageName)("@beep/semver")) // @beep/semver
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ScopedPackageName = S.String.pipe(
  S.check(S.isPattern(SCOPED_RE), S.isMaxLength(MAX_LENGTH)),
  S.brand("ScopedPackageName"),
  $I.annoteSchema("ScopedPackageName", { description: "A valid npm scoped package name (`@scope/name`)." })
);

/**
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ScopedPackageName = string & Brand.Brand<"ScopedPackageName">;

/**
 * **Example** (Decode an unscoped package name)
 *
 * ```ts
 * import { UnscopedPackageName } from "@beep/package-json/PackageName";
 * import * as S from "effect/Schema";
 *
 * console.log(S.decodeUnknownSync(UnscopedPackageName)("semver")) // semver
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const UnscopedPackageName = S.String.pipe(
  S.check(S.isPattern(UNSCOPED_RE), S.isMaxLength(MAX_LENGTH), isNotReserved),
  S.brand("UnscopedPackageName"),
  $I.annoteSchema("UnscopedPackageName", { description: "A valid npm unscoped package name (no `@scope/` prefix)." })
);

/**
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type UnscopedPackageName = string & Brand.Brand<"UnscopedPackageName">;

/**
 * A valid npm package name, scoped or unscoped.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type PackageName = ScopedPackageName | UnscopedPackageName;

const isValid: (name: string) => boolean = S.is(S.Union([ScopedPackageName, UnscopedPackageName]));

const scope = (name: string): O.Option<string> => {
  if (!Str.startsWith("@")(name)) return O.none();
  return O.map(Str.indexOf("/")(name), (slash) => Str.slice(1, slash)(name));
};

const unscoped = (name: string): string => {
  if (!Str.startsWith("@")(name)) return name;
  return O.getOrElse(
    O.map(Str.indexOf("/")(name), (slash) => Str.slice(slash + 1)(name)),
    () => name
  );
};

const isScoped = Str.startsWith("@");

const PackageNameUnion = S.Union([ScopedPackageName, UnscopedPackageName]).pipe(
  $I.annoteSchema("PackageName", {
    description: "A valid npm package name, scoped or unscoped, with classification statics.",
  })
);
const PackageNameBase: Omit<S.Opaque<PackageName, typeof PackageNameUnion, {}>, never> &
  (new (
    _: never
  ) => Pick<PackageName, keyof string>) = S.Opaque<PackageName>()(PackageNameUnion);

/**
 * The union of `ScopedPackageName` and `UnscopedPackageName`,
 * carrying the classification statics (`PackageName.isValid`,
 * `PackageName.scope`, `PackageName.unscoped`, `PackageName.isScoped`).
 *
 * **When to use**
 *
 * Use as the schema for a package-name field and reach for the statics to inspect a raw
 * string.
 *
 * **Example** (Validate and inspect a scoped package name)
 *
 * ```ts
 * import { PackageName } from "@beep/package-json/PackageName";
 * import * as O from "effect/Option";
 *
 * console.log(PackageName.isValid("@beep/semver")) // true
 * console.log(O.getOrElse(PackageName.scope("@beep/semver"), () => "no scope")) // beep
 * console.log(PackageName.unscoped("@beep/semver")) // semver
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const PackageName = class extends PackageNameBase {
  /**
   * Whether the string satisfies npm's package-name rules.
   *
   * **Example** (Check a raw package name)
   *
   * ```ts
   * import { PackageName } from "@beep/package-json/PackageName";
   * console.log(PackageName.isValid("@beep/semver")) // true
   * console.log(PackageName.isValid("Bad Name")) // false
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */
  static readonly isValid = isValid;
  /**
   * The scope of a scoped name (`@scope/x` → `Some("scope")`), else `None`.
   *
   * **Example** (Inspect a scope or its absence)
   *
   * ```ts
   * import { PackageName } from "@beep/package-json/PackageName";
   * import * as O from "effect/Option";
   *
   * console.log(O.getOrElse(PackageName.scope("@scope/x"), () => "no scope")) // scope
   * console.log(O.isNone(PackageName.scope("x"))) // true
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  static readonly scope = scope;
  /**
   * The unscoped portion of a name (`@scope/x` → `"x"`; `x` → `"x"`).
   *
   * **Example** (Extract the unscoped portion)
   *
   * ```ts
   * import { PackageName } from "@beep/package-json/PackageName";
   * console.log(PackageName.unscoped("@scope/x")) // x
   * console.log(PackageName.unscoped("x")) // x
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  static readonly unscoped = unscoped;
  /**
   * Whether the name is scoped (starts with `@`).
   *
   * **Example** (Classify scoped and unscoped names)
   *
   * ```ts
   * import { PackageName } from "@beep/package-json/PackageName";
   * console.log(PackageName.isScoped("@scope/x")) // true
   * console.log(PackageName.isScoped("x")) // false
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */
  static readonly isScoped = isScoped;
};
