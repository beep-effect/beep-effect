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
 * Raised by {@link Package.setName} and the decode direction of
 * `PackageName`. The offending string is preserved on `input`.
 *
 * @public
 */
export class InvalidPackageNameError extends S.TaggedError<InvalidPackageNameError>($I`InvalidPackageNameError`)("InvalidPackageNameError", {
	/** The raw input string that failed validation. */
	input: S.String.annotateKey({ description: "The raw input string that failed validation." }),
}, $I.annote("InvalidPackageNameError", { description: "Indicates that a string could not be used as a valid npm package name." })) {
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
 * @public
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
 */
export type ScopedPackageName = string & Brand.Brand<"ScopedPackageName">;

/**
 * A valid npm unscoped package name (no `@scope/` prefix).
 *
 * @public
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
 */
export type UnscopedPackageName = string & Brand.Brand<"UnscopedPackageName">;

/**
 * A valid npm package name, scoped or unscoped.
 *
 * @public
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
 * `PackageName.scope`, `PackageName.unscoped`, `PackageName.isScoped`). Use it as
 * the schema for a package-name field and reach for the statics to inspect a raw
 * string.
 *
 * **Example** (Validate and inspect a scoped package name)
 *
 * ```ts
 * import { PackageName } from "./index.ts";
 *
 * PackageName.isValid("@effected/semver"); // => true
 * PackageName.scope("@effected/semver"); // => Option.some("effected")
 * PackageName.unscoped("@effected/semver"); // => "semver"
 * ```
 *
 * @public
 */
export const PackageName = class extends PackageNameBase {
	/** Whether the string satisfies npm's package-name rules. */
	static readonly isValid = isValid;
	/** The scope of a scoped name (`@scope/x` → `Some("scope")`), else `None`. */
	static readonly scope = scope;
	/** The unscoped portion of a name (`@scope/x` → `"x"`; `x` → `"x"`). */
	static readonly unscoped = unscoped;
	/** Whether the name is scoped (starts with `@`). */
	static readonly isScoped = isScoped;
};
