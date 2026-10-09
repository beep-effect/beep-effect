// Valid npm package names: the `ScopedPackageName` / `UnscopedPackageName`
// branded schemas, the `PackageName` union with its classification statics
// (`PackageName.isValid`, `PackageName.scope`, `PackageName.unscoped`,
// `PackageName.isScoped`), and the `InvalidPackageNameError` the concept
// raises.

import { $ScratchpadId } from "@beep/identity/packages";
import type * as Brand from "effect/Brand";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/package-json/PackageName");

/**
 * Indicates that a string could not be used as a valid npm package name.
 *
 * **Details**
 *
 * Raised by {@link Package.setName} and the decode direction of
 * `PackageName`. The offending string is preserved on `input`.
 *
 * **Example** (Report an invalid package name)
 *
 * ```ts
 * import { InvalidPackageNameError } from "@beep/scratchpad/effected/package-json/PackageName";
 *
 * const error = InvalidPackageNameError.make({ input: "Bad Name" });
 * console.log(error.message) // Invalid package name "Bad Name": does not satisfy npm naming rules
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class InvalidPackageNameError extends S.TaggedError<InvalidPackageNameError>($I`InvalidPackageNameError`)("InvalidPackageNameError", {
	/**
	 * The raw input string that failed validation.
	 *
	 * @category models
	 * @since 0.0.0
	 */
	input: S.String.annotateKey({ description: "The raw input string that failed validation." }),
}, $I.annote("InvalidPackageNameError", { description: "Indicates that a string could not be used as a valid npm package name." })) {
	/**
	 * Explains which input failed npm naming rules.
	 *
	 * **Example** (Read the invalid-name report)
	 *
	 * ```ts
	 * import { InvalidPackageNameError } from "@beep/scratchpad/effected/package-json/PackageName";
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

// npm name grammar, written lookahead-free so `Arbitrary.schema` can derive a
// generator: the native regex compiler in `effect/Arbitrary` rejects
// `(?=`/`(?!` and would fall back to filtering random strings, none of which
// is ever a package name. The first character may not be `.` or `_`; the
// remainder is URL-safe lowercase.
const UNSCOPED_RE = /^[a-z0-9-][a-z0-9._-]*$/u;
const SCOPED_RE = /^@[a-z0-9-][a-z0-9._-]*\/[a-z0-9-][a-z0-9._-]*$/u;
const MAX_LENGTH = 214;

/**
 * A valid npm scoped package name (`@scope/name`).
 *
 * **Example** (Decode a scoped package name)
 *
 * ```ts
 * import { ScopedPackageName } from "@beep/scratchpad/effected/package-json/PackageName";
 * import * as S from "effect/Schema";
 *
 * console.log(S.decodeUnknownSync(ScopedPackageName)("@effected/semver")) // @effected/semver
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ScopedPackageName = S.String.pipe(
	S.check(S.isPattern(SCOPED_RE), S.isMaxLength(MAX_LENGTH)),
	S.brand("ScopedPackageName"),
	$I.annoteSchema("ScopedPackageName", { description: "A valid npm scoped package name (`@scope/name`)." }),
);

/**
 * A valid npm scoped package name.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ScopedPackageName = string & Brand.Brand<"ScopedPackageName">;

/**
 * A valid npm unscoped package name (no `@scope/` prefix).
 *
 * **Example** (Decode an unscoped package name)
 *
 * ```ts
 * import { UnscopedPackageName } from "@beep/scratchpad/effected/package-json/PackageName";
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
	S.check(S.isPattern(UNSCOPED_RE), S.isMaxLength(MAX_LENGTH)),
	S.brand("UnscopedPackageName"),
	$I.annoteSchema("UnscopedPackageName", { description: "A valid npm unscoped package name (no `@scope/` prefix)." }),
);

/**
 * A valid npm unscoped package name.
 *
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

const isValid = (name: string): boolean =>
	name.length > 0 && name.length <= MAX_LENGTH && (UNSCOPED_RE.test(name) || SCOPED_RE.test(name));

const scope = (name: string): O.Option<string> => {
	if (!name.startsWith("@")) return O.none();
	const slash = name.indexOf("/");
	return slash === -1 ? O.none() : O.some(name.slice(1, slash));
};

const unscoped = (name: string): string => {
	if (!name.startsWith("@")) return name;
	const slash = name.indexOf("/");
	return slash === -1 ? name : name.slice(slash + 1);
};

const isScoped = (name: string): boolean => name.startsWith("@");

const PackageNameUnion = S.Union([ScopedPackageName, UnscopedPackageName]).pipe(
	$I.annoteSchema("PackageName", { description: "A valid npm package name, scoped or unscoped, with classification statics." }),
);
// TypeScript cannot extend a primitive union. Widen only the unused constructor
// surface to its common string members, preserving every schema value/type role.
const PackageNameBase: Omit<S.Opaque<PackageName, typeof PackageNameUnion, {}>, never> &
	(new (_: never) => Pick<PackageName, keyof string>) = S.Opaque<PackageName>()(PackageNameUnion);

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
 * import { PackageName } from "@beep/scratchpad/effected/package-json/PackageName";
 * import * as O from "effect/Option";
 *
 * console.log(PackageName.isValid("@effected/semver")) // true
 * console.log(O.getOrElse(PackageName.scope("@effected/semver"), () => "no scope")) // effected
 * console.log(PackageName.unscoped("@effected/semver")) // semver
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
	 * import { PackageName } from "@beep/scratchpad/effected/package-json/PackageName";
	 * console.log(PackageName.isValid("@effected/semver")) // true
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
	 * import { PackageName } from "@beep/scratchpad/effected/package-json/PackageName";
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
	 * import { PackageName } from "@beep/scratchpad/effected/package-json/PackageName";
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
	 * import { PackageName } from "@beep/scratchpad/effected/package-json/PackageName";
	 * console.log(PackageName.isScoped("@scope/x")) // true
	 * console.log(PackageName.isScoped("x")) // false
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	static readonly isScoped = isScoped;
};
