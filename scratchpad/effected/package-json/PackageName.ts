// Valid npm package names: the `ScopedPackageName` / `UnscopedPackageName`
// branded schemas, the `PackageName` union with its classification statics
// (`PackageName.isValid`, `PackageName.scope`, `PackageName.unscoped`,
// `PackageName.isScoped`), and the `InvalidPackageNameError` the concept
// raises.

import type { Brand } from "effect";
import { Option, Schema } from "effect";

/**
 * Indicates that a string could not be used as a valid npm package name.
 *
 * Raised by {@link Package.setName} and the decode direction of
 * `PackageName`. The offending string is preserved on `input`.
 *
 * @public
 */
export class InvalidPackageNameError extends Schema.TaggedError<InvalidPackageNameError>()("InvalidPackageNameError", {
	/** The raw input string that failed validation. */
	input: Schema.String,
}) {
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
export const ScopedPackageName = Schema.String.pipe(
	Schema.check(Schema.isPattern(SCOPED_RE), Schema.isMaxLength(MAX_LENGTH)),
	Schema.brand("ScopedPackageName"),
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
export const UnscopedPackageName = Schema.String.pipe(
	Schema.check(Schema.isPattern(UNSCOPED_RE), Schema.isMaxLength(MAX_LENGTH)),
	Schema.brand("UnscopedPackageName"),
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

/** Classification statics attached to the `PackageName` schema value. */
interface PackageNameStatics {
	/** Whether the string satisfies npm's package-name rules. */
	readonly isValid: (name: string) => boolean;
	/** The scope of a scoped name (`@scope/x` → `Some("scope")`), else `None`. */
	readonly scope: (name: string) => Option.Option<string>;
	/** The unscoped portion of a name (`@scope/x` → `"x"`; `x` → `"x"`). */
	readonly unscoped: (name: string) => string;
	/** Whether the name is scoped (starts with `@`). */
	readonly isScoped: (name: string) => boolean;
}

const isValid = (name: string): boolean =>
	name.length > 0 && name.length <= MAX_LENGTH && (UNSCOPED_RE.test(name) || SCOPED_RE.test(name));

const scope = (name: string): Option.Option<string> => {
	if (!name.startsWith("@")) return Option.none();
	const slash = name.indexOf("/");
	return slash === -1 ? Option.none() : Option.some(name.slice(1, slash));
};

const unscoped = (name: string): string => {
	if (!name.startsWith("@")) return name;
	const slash = name.indexOf("/");
	return slash === -1 ? name : name.slice(slash + 1);
};

const isScoped = (name: string): boolean => name.startsWith("@");

/**
 * The union of `ScopedPackageName` and `UnscopedPackageName`,
 * carrying the classification statics (`PackageName.isValid`,
 * `PackageName.scope`, `PackageName.unscoped`, `PackageName.isScoped`). Use it as
 * the schema for a package-name field and reach for the statics to inspect a raw
 * string.
 *
 * @example
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
export const PackageName = Object.assign(Schema.Union([ScopedPackageName, UnscopedPackageName]), {
	isValid,
	scope,
	unscoped,
	isScoped,
} satisfies PackageNameStatics);
