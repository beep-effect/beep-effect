// The single dependency-specifier concept, shared with `@effected/package-json`.
//
// Two forms sit side by side and share one classifier:
//   - the branded `DependencySpecifier` schema + its protocol taxonomy statics
//     (`DependencySpecifier.protocolOf` and friends, classifying eleven
//     protocols), the fine-grained view package-json's `Dependency` reads; and
//   - a coarse tagged union (`catalog | workspace | range | dist-tag | raw`)
//     that resolvers and lockfile importers pattern-match on, reached through
//     the `DependencySpecifier.FromString` codec.
//
// The union is *decoded from the brand*: `FromString.decode` validates a string
// through the same taxonomy the brand uses, then groups the eleven protocols
// into the five resolver-relevant cases. Every case stores the original `raw`
// string, so `FromString.encode` returns the input byte-for-byte — the
// exact-string round-trip guarantee consumers rely on.
//
// Range detection decodes `@effected/semver`'s `Range.FromString` purely via
// `Schema.decodeUnknownExit` — no `Effect.runSync` inside a getter.

import { Range } from "../semver/index.ts";
import type { Brand } from "effect";
import { Effect, Exit, Option, Schema, SchemaIssue, SchemaTransformation } from "effect";

/**
 * Indicates that a string could not be parsed as a valid dependency specifier.
 *
 * Raised by {@link DependencySpecifier.decode}. The offending string is
 * preserved on `input`.
 *
 * @public
 */
export class InvalidDependencySpecifierError extends Schema.TaggedError<InvalidDependencySpecifierError>()(
	"InvalidDependencySpecifierError",
	{
		/** The raw input string that failed validation. */
		input: Schema.String,
	},
) {
	override get message(): string {
		return `Invalid dependency specifier "${this.input}": not a recognized specifier`;
	}
}

/**
 * The classification of a dependency specifier's protocol.
 *
 * @public
 */
export type DependencyProtocol =
	| "range"
	| "tag"
	| "git"
	| "url"
	| "npm"
	| "file"
	| "link"
	| "portal"
	| "catalog"
	| "workspace"
	| "unknown";

const CATALOG_PREFIX = "catalog:";
const WORKSPACE_PREFIX = "workspace:";

const isBarePath = (value: string): boolean =>
	value.startsWith("./") || value.startsWith("../") || value.startsWith("~/") || value.startsWith("/");

// Bare GitHub shorthand `user/repo[#ref]`, excluding local-path-looking strings.
const isGitHubShorthand = (value: string): boolean =>
	!value.startsWith(".") &&
	!value.startsWith("~") &&
	!value.startsWith("/") &&
	/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(#.*)?$/.test(value);

const isGit = (value: string): boolean =>
	value.startsWith("git+") ||
	value.startsWith("git://") ||
	value.startsWith("github:") ||
	value.startsWith("gist:") ||
	value.startsWith("bitbucket:") ||
	value.startsWith("gitlab:") ||
	isGitHubShorthand(value);

const isLocal = (value: string): boolean =>
	value.startsWith("file:") || value.startsWith("link:") || value.startsWith("portal:") || isBarePath(value);

const isLink = (value: string): boolean => value.startsWith("link:");
const isPortal = (value: string): boolean => value.startsWith("portal:");
const isCatalog = (value: string): boolean => value.startsWith(CATALOG_PREFIX);
const isWorkspace = (value: string): boolean => value.startsWith(WORKSPACE_PREFIX);
const isUrl = (value: string): boolean => value.startsWith("http://") || value.startsWith("https://");

// Pure Option-returning range parse: decode `Range.FromString` synchronously via
// an Exit, never running an Effect inside a getter.
const parseRange = (value: string): Option.Option<Range> => {
	const exit = Schema.decodeUnknownExit(Range.FromString)(value);
	return Exit.isSuccess(exit) ? Option.some(exit.value) : Option.none();
};

const isRange = (value: string): boolean => Option.isSome(parseRange(value));

const protocolOf = (value: string): DependencyProtocol => {
	if (value.startsWith(CATALOG_PREFIX)) return "catalog";
	if (value.startsWith(WORKSPACE_PREFIX)) return "workspace";
	if (value.startsWith("link:")) return "link";
	if (value.startsWith("portal:")) return "portal";
	if (value.startsWith("file:") || isBarePath(value)) return "file";
	if (value.startsWith("npm:")) return "npm";
	if (isGit(value)) return "git";
	if (isUrl(value)) return "url";
	if (isRange(value)) return "range";
	if (/^[a-zA-Z][a-zA-Z0-9._-]*$/.test(value)) return "tag";
	return "unknown";
};

const isTag = (value: string): boolean => protocolOf(value) === "tag";

// The one catalog-name extraction: shared by `classify` and the public
// `catalogNameOf` static so the two can never disagree. Empty (after
// trimming) selects the default catalog.
const catalogNameOf = (specifier: string): Option.Option<string> => {
	if (!isCatalog(specifier)) return Option.none();
	const rest = specifier.slice(CATALOG_PREFIX.length).trim();
	return rest.length === 0 ? Option.none() : Option.some(rest);
};

// The range-modifier projection pnpm applies at publish time: `*` (or an
// empty modifier) pins to the version, `~`/`^` prefix it, anything else — a
// pinned or concrete range — passes through as-is.
const projectRangeModifier = (range: string, version: string): string =>
	range === "*" || range === "" ? version : range === "~" ? `~${version}` : range === "^" ? `^${version}` : range;

// Split the part after `workspace:` into pnpm's alias form (`<name>@<range>`,
// e.g. `foo@^` or `@scope/charts@1.2.3`) and the plain form. The LAST `@` at
// an index past 0 separates the target package name from the range modifier,
// so scoped names keep their leading `@`; a lone scoped name with no second
// `@` is not the alias form.
const splitWorkspaceRest = (rest: string): { readonly target: string | undefined; readonly range: string } => {
	const at = rest.lastIndexOf("@");
	return at > 0 ? { target: rest.slice(0, at), range: rest.slice(at + 1) } : { target: undefined, range: rest };
};

// The one workspace-range projection: shared by the `resolveWorkspace` static
// and `WorkspaceSpecifier#resolve`. `rest` is the part after `workspace:`.
// Plain forms project the modifier directly; the alias form becomes pnpm's
// publish-time aliased dependency `npm:<name>@<projected>`.
const projectWorkspaceRange = (rest: string, version: string): string => {
	const { target, range } = splitWorkspaceRest(rest);
	const projected = projectRangeModifier(range, version);
	return target === undefined ? projected : `npm:${target}@${projected}`;
};

const resolveWorkspace = (specifier: string, version: string): string =>
	isWorkspace(specifier) ? projectWorkspaceRange(specifier.slice(WORKSPACE_PREFIX.length), version) : specifier;

// The target package name of an alias-form `workspace:` specifier, `None` for
// the plain form and for non-workspace input. Shared by `Manifest.resolve`
// and `@effected/package-json`'s `Package.resolve`, which must look up the
// TARGET's version before projecting.
const workspaceTargetOf = (specifier: string): Option.Option<string> => {
	if (!isWorkspace(specifier)) return Option.none();
	const { target } = splitWorkspaceRest(specifier.slice(WORKSPACE_PREFIX.length));
	return target === undefined ? Option.none() : Option.some(target);
};

/**
 * Whether a string is a recognized dependency specifier: a semver range, exact
 * version, dist-tag, URL, git ref, GitHub shorthand, file path, or an
 * `npm:` / `catalog:` / `workspace:` protocol.
 *
 * @public
 */
export const isValidDependencySpecifier = (value: string): boolean =>
	value.length > 0 && protocolOf(value) !== "unknown";

/**
 * A `catalog:` reference. `name` carries the catalog name, or `Option.none()`
 * for the default catalog (`catalog:`).
 *
 * @public
 */
export class CatalogSpecifier extends Schema.TaggedClass<CatalogSpecifier>()("catalog", {
	/** The original specifier string. */
	raw: Schema.String,
	/** The catalog name, or `Option.none()` for the default catalog. */
	name: Schema.Option(Schema.String),
}) {}

/**
 * A `workspace:` reference. `range` carries the part after `workspace:` — a
 * range modifier (`*`, `^`, `~`), a concrete range, or an alias form.
 *
 * @public
 */
export class WorkspaceSpecifier extends Schema.TaggedClass<WorkspaceSpecifier>()("workspace", {
	/** The original specifier string. */
	raw: Schema.String,
	/** The part after `workspace:` (e.g. `*`, `^1.2.3`, or an alias form). */
	range: Schema.String,
}) {
	/**
	 * The pnpm publish-time projection of this specifier against a concrete
	 * workspace version: `*` (or an empty range) becomes `version`, `~` becomes
	 * `~version`, `^` becomes `^version`, and a pinned range passes through
	 * unchanged. The alias form (`workspace:<name>@<range>`) becomes pnpm's
	 * publish-time aliased dependency `npm:<name>@<projected>`, with the range
	 * modifier projected the same way — `version` must then be the TARGET
	 * package's version (see `DependencySpecifier.workspaceTargetOf`).
	 *
	 * @remarks
	 * The same projection as `DependencySpecifier.resolveWorkspace`, applied to
	 * this instance's already-extracted `range`; the two share one internal
	 * implementation.
	 *
	 * @param version - The concrete version of the workspace package the
	 *   specifier points at (the alias target's version for the alias form).
	 */
	resolve(version: string): string {
		return projectWorkspaceRange(this.range, version);
	}
}

/**
 * A plain semver range or exact version (e.g. `^1.2.3`, `1.x`, `>=1 <2`).
 *
 * @public
 */
export class RangeSpecifier extends Schema.TaggedClass<RangeSpecifier>()("range", {
	/** The original specifier string. */
	raw: Schema.String,
}) {}

/**
 * A bare dist-tag (e.g. `latest`, `next`).
 *
 * @public
 */
export class DistTagSpecifier extends Schema.TaggedClass<DistTagSpecifier>()("dist-tag", {
	/** The original specifier string (also the tag name). */
	raw: Schema.String,
}) {}

/**
 * The honest fallback for `file:` / `link:` / `portal:` / git / URL / `npm:`
 * forms this concept does not further interpret.
 *
 * @public
 */
export class RawSpecifier extends Schema.TaggedClass<RawSpecifier>()("raw", {
	/** The original specifier string. */
	raw: Schema.String,
}) {}

/**
 * A dependency specifier classified into one of the five resolver-relevant
 * cases. Decoded from a string by {@link DependencySpecifier.FromString};
 * every case preserves the original `raw` string.
 *
 * @public
 */
export type ClassifiedSpecifier =
	| CatalogSpecifier
	| WorkspaceSpecifier
	| RangeSpecifier
	| DistTagSpecifier
	| RawSpecifier;

const Classified = Schema.Union([CatalogSpecifier, WorkspaceSpecifier, RangeSpecifier, DistTagSpecifier, RawSpecifier]);

// Group a *valid* specifier into one of the five coarse cases, reusing the
// taxonomy predicates above. Order matters: catalog/workspace prefixes first,
// then a parseable range, then a bare tag, with everything else (git, url,
// file, link, portal, npm) preserved as `raw`.
const classify = (value: string): ClassifiedSpecifier => {
	if (isCatalog(value)) {
		return CatalogSpecifier.make({ raw: value, name: catalogNameOf(value) });
	}
	if (isWorkspace(value)) {
		return WorkspaceSpecifier.make({ raw: value, range: value.slice(WORKSPACE_PREFIX.length) });
	}
	if (isRange(value)) return RangeSpecifier.make({ raw: value });
	if (isTag(value)) return DistTagSpecifier.make({ raw: value });
	return RawSpecifier.make({ raw: value });
};

const fromString: Schema.Codec<ClassifiedSpecifier, string> = Schema.String.pipe(
	Schema.decodeTo(
		Classified,
		// Pinned to the union's ENCODED side (plain records, without instance
		// methods like WorkspaceSpecifier#resolve): letting inference unify the
		// transformation's target from decode/encode rejects the instance methods.
		SchemaTransformation.transformEffect<(typeof Classified)["Encoded"], string>({
			decode: (input) =>
				isValidDependencySpecifier(input)
					? Effect.succeed(classify(input))
					: Effect.fail(new SchemaIssue.InvalidValue({ message: `Invalid dependency specifier: "${input}"` }, input)),
			encode: (classified) => Effect.succeed(classified.raw),
		}),
	),
);

/** Taxonomy statics attached to the `DependencySpecifier` schema value. */
interface DependencySpecifierStatics {
	/** Classify a specifier into a single protocol; `"unknown"` for unrecognized input. */
	readonly protocolOf: (value: string) => DependencyProtocol;
	/** Parse the specifier as a semver `Range`, `None` when it is not a range. Pure. */
	readonly parseRange: (value: string) => Option.Option<Range>;
	/** Whether the specifier is a parseable semver range. */
	readonly isRange: (value: string) => boolean;
	/** Whether the specifier is a dist-tag (`latest`, `next`, ...). */
	readonly isTag: (value: string) => boolean;
	/** Whether the specifier resolves to a git source (URLs and hosted-git shorthands). */
	readonly isGit: (value: string) => boolean;
	/** Whether the specifier is an HTTP(S) URL. */
	readonly isUrl: (value: string) => boolean;
	/** Whether the specifier points to a local path (`file:`/`link:`/`portal:` or a bare path). */
	readonly isLocal: (value: string) => boolean;
	/** Whether the specifier uses the `link:` protocol. */
	readonly isLink: (value: string) => boolean;
	/** Whether the specifier uses the `portal:` protocol. */
	readonly isPortal: (value: string) => boolean;
	/** Whether the specifier uses the `catalog:` protocol. */
	readonly isCatalog: (value: string) => boolean;
	/** Whether the specifier uses the `workspace:` protocol. */
	readonly isWorkspace: (value: string) => boolean;
	/**
	 * The catalog name of a `catalog:` specifier: `Some(name)` for a named
	 * catalog, `None` for the default catalog (nothing but whitespace after the
	 * prefix). The result is only meaningful when `isCatalog(specifier)` is
	 * true — non-catalog input also returns `None`.
	 */
	readonly catalogNameOf: (specifier: string) => Option.Option<string>;
	/**
	 * The pnpm publish-time projection of a `workspace:` specifier against a
	 * concrete version: `workspace:*` (or a bare `workspace:`) becomes
	 * `version`, `workspace:~` becomes `~version`, `workspace:^` becomes
	 * `^version`, and a pinned range passes through as-is (the part after the
	 * prefix). pnpm's alias form (`workspace:<name>@<range>`, the last `@`
	 * separating a possibly scoped target name from the range) becomes the
	 * aliased dependency pnpm publishes: `npm:<name>@<projected>`, with the
	 * range modifier projected the same way — `version` must then be the
	 * TARGET package's version, resolved via
	 * `workspaceTargetOf`.
	 * Non-workspace input is returned unchanged.
	 */
	readonly resolveWorkspace: (specifier: string, version: string) => string;
	/**
	 * The target package name of an alias-form `workspace:` specifier
	 * (`workspace:<name>@<range>` — e.g. `workspace:foo@^`,
	 * `workspace:@scope/charts@*`): `Some(name)` for the alias form, `None`
	 * for the plain form and for non-workspace input. Resolvers must look up
	 * this package's version (not the dependency-map key's) before projecting
	 * with `resolveWorkspace`.
	 */
	readonly workspaceTargetOf: (specifier: string) => Option.Option<string>;
	/** Whether the string is a valid dependency specifier. */
	readonly isValid: (value: string) => boolean;
	/** Validate a string, failing with a typed {@link InvalidDependencySpecifierError}. */
	readonly decode: (input: string) => Effect.Effect<DependencySpecifierBrand, InvalidDependencySpecifierError>;
	/**
	 * Codec between a specifier string and a {@link ClassifiedSpecifier} tagged
	 * union. Decoding classifies; encoding returns the original `raw` string
	 * byte-for-byte.
	 */
	readonly FromString: Schema.Codec<ClassifiedSpecifier, string>;
}

/**
 * The branded dependency-specifier type: any string `DependencySpecifier`
 * validates.
 *
 * @public
 */
export type DependencySpecifierBrand = string & Brand.Brand<"DependencySpecifier">;

const brandedSpecifier = Schema.String.pipe(
	Schema.check(
		Schema.makeFilter((value) =>
			isValidDependencySpecifier(value) ? undefined : "Expected a valid dependency specifier",
		),
	),
	Schema.brand("DependencySpecifier"),
);

const decode = (input: string): Effect.Effect<DependencySpecifierBrand, InvalidDependencySpecifierError> =>
	Schema.decodeUnknownEffect(brandedSpecifier)(input).pipe(
		Effect.mapError(() => new InvalidDependencySpecifierError({ input })),
	);

/**
 * A valid dependency version specifier, carrying the protocol taxonomy statics
 * (`DependencySpecifier.protocolOf` and friends) that classify any specifier
 * string, plus the {@link (DependencySpecifier:variable).FromString} codec that
 * decodes a string into a {@link ClassifiedSpecifier} tagged union. Use it as a
 * schema for a specifier field and reach for the statics to inspect a raw
 * string.
 *
 * @example
 * ```ts
 * import { DependencySpecifier } from "./index.ts";
 * import { Schema } from "effect";
 *
 * DependencySpecifier.protocolOf("workspace:^"); // => "workspace"
 * DependencySpecifier.resolveWorkspace("workspace:^", "1.2.3"); // => "^1.2.3"
 *
 * const classified = Schema.decodeUnknownSync(DependencySpecifier.FromString)("catalog:");
 * // => CatalogSpecifier { raw: "catalog:", name: Option.none() }
 * ```
 *
 * @public
 */
export const DependencySpecifier = Object.assign(brandedSpecifier, {
	protocolOf,
	parseRange,
	isRange,
	isTag,
	isGit,
	isUrl,
	isLocal,
	isLink,
	isPortal,
	isCatalog,
	isWorkspace,
	catalogNameOf,
	resolveWorkspace,
	workspaceTargetOf,
	isValid: isValidDependencySpecifier,
	decode,
	FromString: fromString,
} satisfies DependencySpecifierStatics);
