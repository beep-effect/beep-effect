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

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { Range } from "../semver/index.ts";
import type * as Brand from "effect/Brand";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Str from "effect/String";

const $I = $ScratchpadId.create("effected/npm/DependencySpecifier");

/**
 * Indicates that a string could not be parsed as a valid dependency specifier.
 *
 * Raised by {@link DependencySpecifier.decode}. The offending string is
 * preserved on `input`.
 *
 * @public
 */
export class InvalidDependencySpecifierError extends S.TaggedError<InvalidDependencySpecifierError>($I`InvalidDependencySpecifierError`)(
	"InvalidDependencySpecifierError",
	{
		/** The raw input string that failed validation. */
		input: S.String.annotateKey({ description: "The raw input string that failed validation." }),
	}, $I.annote("InvalidDependencySpecifierError", { description: "Indicates that a string could not be parsed as a valid dependency specifier." }),
) {
	override get message(): string {
		return `Invalid dependency specifier "${this.input}": not a recognized specifier`;
	}
}

/**
 * The classification of a dependency specifier's protocol.
 *
 * **Example** (Recognizing a dependency protocol)
 * ```ts
 * import { DependencyProtocol } from "./index.ts";
 * import * as S from "effect/Schema";
 *
 * S.is(DependencyProtocol)("workspace"); // => true
 * DependencyProtocol.Enum.unknown; // => "unknown"
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const DependencyProtocol = LiteralKit([
    "range", "tag", "git", "url", "npm", "file", "link", "portal", "catalog", "workspace", "unknown",
]).annotate($I.annote("DependencyProtocol", { description: "The ordered taxonomy of dependency specifier protocols, including unknown input." }));

/**
 * The decoded dependency protocol classification.
 * @category type-level
 * @since 0.0.0
 */
export type DependencyProtocol = typeof DependencyProtocol.Type;

const CATALOG_PREFIX = "catalog:";
const WORKSPACE_PREFIX = "workspace:";

const BarePath = S.String.annotate($I.annote("BarePath", { description: "A bare local dependency path." })).check(S.isPattern(/^(?:\.\/|\.\.\/|~\/|\/)/, $I.annote("BarePathCheck", {
    title: "Bare dependency path", description: "A path beginning with ./, ../, ~/ or /.",
})));
const GitHubShorthand = S.String.annotate($I.annote("GitHubShorthand", { description: "A bare hosted GitHub dependency reference." })).check(S.isPattern(/^(?![.~\/])[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(#.*)?$/, $I.annote("GitHubShorthandCheck", {
    title: "GitHub shorthand", description: "A user/repository reference with an optional ref, excluding local-looking prefixes.",
})));
const GitPrefix = S.String.annotate($I.annote("GitPrefix", { description: "A dependency with an explicit git protocol prefix." })).check(S.isPattern(/^(?:git\+|git:\/\/|github:|gist:|bitbucket:|gitlab:)/, $I.annote("GitPrefixCheck", {
    title: "Git protocol prefix", description: "A git URL or hosted-git protocol prefix.",
})));
const GitSource = S.Union([GitPrefix, GitHubShorthand]).annotate($I.annote("GitSource", { description: "An explicit git source or bare GitHub reference." }));
const FileSource = S.String.annotate($I.annote("FileSource", { description: "A file-protocol dependency." })).check(S.isStartingWith("file:", $I.annote("FileSourceCheck", {
    title: "File protocol", description: "A dependency beginning with file:.",
})));
const LinkSource = S.String.annotate($I.annote("LinkSource", { description: "A link-protocol dependency." })).check(S.isStartingWith("link:", $I.annote("LinkSourceCheck", {
    title: "Link protocol", description: "A dependency beginning with link:.",
})));
const PortalSource = S.String.annotate($I.annote("PortalSource", { description: "A portal-protocol dependency." })).check(S.isStartingWith("portal:", $I.annote("PortalSourceCheck", {
    title: "Portal protocol", description: "A dependency beginning with portal:.",
})));
const CatalogSource = S.String.annotate($I.annote("CatalogSource", { description: "A catalog-protocol dependency." })).check(S.isStartingWith(CATALOG_PREFIX, $I.annote("CatalogSourceCheck", {
    title: "Catalog protocol", description: "A dependency beginning with catalog:.",
})));
const WorkspaceSource = S.String.annotate($I.annote("WorkspaceSource", { description: "A workspace-protocol dependency." })).check(S.isStartingWith(WORKSPACE_PREFIX, $I.annote("WorkspaceSourceCheck", {
    title: "Workspace protocol", description: "A dependency beginning with workspace:.",
})));
const UrlSource = S.String.annotate($I.annote("UrlSource", { description: "An HTTP or HTTPS dependency URL." })).check(S.isPattern(/^https?:\/\//, $I.annote("UrlSourceCheck", {
    title: "HTTP URL prefix", description: "A dependency beginning with http:// or https://.",
})));
const NpmSource = S.String.annotate($I.annote("NpmSource", { description: "An npm alias dependency." })).check(S.isStartingWith("npm:", $I.annote("NpmSourceCheck", {
    title: "npm alias protocol", description: "A dependency beginning with npm:.",
})));
const BareTag = S.String.annotate($I.annote("BareTag", { description: "The bare dist-tag string grammar before semver precedence is applied." })).check(S.isPattern(/^[a-zA-Z][a-zA-Z0-9._-]*$/, $I.annote("BareTagCheck", {
    title: "Dist-tag grammar", description: "An ASCII letter followed by letters, digits, dots, underscores or hyphens.",
})));
const LocalSource = S.Union([FileSource, LinkSource, PortalSource, BarePath]).annotate($I.annote("LocalSource", { description: "A local file, link, portal or bare path dependency." }));

const FileOrPathSource = S.Union([FileSource, BarePath]).annotate(
    $I.annote("FileOrPathSource", { description: "A file-protocol dependency or a bare local dependency path." }),
);
const isFile: (value: string) => boolean = S.is(FileOrPathSource);
const isGit: (value: string) => boolean = S.is(GitSource);
const isLocal: (value: string) => boolean = S.is(LocalSource);
const isLink: (value: string) => boolean = S.is(LinkSource);
const isPortal: (value: string) => boolean = S.is(PortalSource);
const isCatalog: (value: string) => boolean = S.is(CatalogSource);
const isWorkspace: (value: string) => boolean = S.is(WorkspaceSource);
const isUrl: (value: string) => boolean = S.is(UrlSource);
const isNpm: (value: string) => boolean = S.is(NpmSource);
const isBareTag: (value: string) => boolean = S.is(BareTag);

// Pure Option-returning range parse: decode `Range.FromString` synchronously via
// an Exit, never running an Effect inside a getter.
const parseRange = (value: string): O.Option<Range> => {
	const exit = S.decodeExit(Range.FromString)(value);
	return Exit.isSuccess(exit) ? O.some(exit.value) : O.none();
};

const RangeString = S.String.annotate($I.annote("RangeString", { description: "A parseable semver range or exact version." })).check(S.makeFilter((value) => O.isSome(parseRange(value)), $I.annote("RangeStringCheck", {
    title: "Semver range", description: "A string accepted by the shared semver Range.FromString codec.",
})));
const isRange: (value: string) => boolean = S.is(RangeString);
const TagString = BareTag.check(S.makeFilter((value) => !isRange(value), $I.annote("TagStringCheck", {
    title: "Dist-tag precedence", description: "A bare tag that is not already a parseable semver range.",
}))).annotate($I.annote("TagString", { description: "A dist-tag after applying semver range precedence." }));

const protocolOf = (value: string): DependencyProtocol => {
	if (isCatalog(value)) return "catalog";
	if (isWorkspace(value)) return "workspace";
	if (isLink(value)) return "link";
	if (isPortal(value)) return "portal";
	if (isFile(value)) return "file";
	if (isNpm(value)) return "npm";
	if (isGit(value)) return "git";
	if (isUrl(value)) return "url";
	if (isRange(value)) return "range";
	if (isBareTag(value)) return "tag";
	return "unknown";
};

const isTag: (value: string) => boolean = S.is(TagString);

// The one catalog-name extraction: shared by `classify` and the public
// `catalogNameOf` static so the two can never disagree. Empty (after
// trimming) selects the default catalog.
const catalogNameOf = (specifier: string): O.Option<string> => {
	if (!isCatalog(specifier)) return O.none();
	const rest = Str.trim(Str.slice(CATALOG_PREFIX.length)(specifier));
	return rest.length === 0 ? O.none() : O.some(rest);
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
	const at = O.getOrElse(Str.lastIndexOf("@")(rest), () => -1);
	return at > 0 ? { target: Str.slice(0, at)(rest), range: Str.slice(at + 1)(rest) } : { target: undefined, range: rest };
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
	isWorkspace(specifier) ? projectWorkspaceRange(Str.slice(WORKSPACE_PREFIX.length)(specifier), version) : specifier;

// The target package name of an alias-form `workspace:` specifier, `None` for
// the plain form and for non-workspace input. Shared by `Manifest.resolve`
// and `@effected/package-json`'s `Package.resolve`, which must look up the
// TARGET's version before projecting.
const workspaceTargetOf = (specifier: string): O.Option<string> => {
	if (!isWorkspace(specifier)) return O.none();
	const { target } = splitWorkspaceRest(Str.slice(WORKSPACE_PREFIX.length)(specifier));
	return target === undefined ? O.none() : O.some(target);
};

const RecognizedSpecifier = S.Union([CatalogSource, WorkspaceSource, LocalSource, NpmSource, GitSource, UrlSource, RangeString, BareTag]).check(
    S.isNonEmpty($I.annote("RecognizedSpecifierCheck", { title: "Nonempty dependency specifier", description: "A recognized dependency specifier must contain at least one character." })),
).annotate($I.annote("RecognizedSpecifier", { description: "A nonempty dependency specifier in one of the supported protocols." }));
/**
 * Whether a string is a recognized dependency specifier: a semver range, exact
 * version, dist-tag, URL, git ref, GitHub shorthand, file path, or an
 * `npm:` / `catalog:` / `workspace:` protocol.
 *
 * @public
 */
export const isValidDependencySpecifier = S.is(RecognizedSpecifier);

/**
 * A `catalog:` reference. `name` carries the catalog name, or `Option.none()`
 * for the default catalog (`catalog:`).
 *
 * @public
 */
export class CatalogSpecifier extends S.TaggedClass<CatalogSpecifier>($I`CatalogSpecifier`)("catalog", {
	/** The original specifier string. */
	raw: S.String.annotateKey({ description: "The original specifier string." }),
	/** The catalog name, or `Option.none()` for the default catalog. */
	name: S.Option(S.String).annotateKey({ description: "The catalog name, or `Option.none()` for the default catalog." }),
}, $I.annote("CatalogSpecifier", { description: "A `catalog:` reference. `name` carries the catalog name, or `Option.none()` for the default catalog (`catalog:`)." })) {}

/**
 * A `workspace:` reference. `range` carries the part after `workspace:` — a
 * range modifier (`*`, `^`, `~`), a concrete range, or an alias form.
 *
 * @public
 */
export class WorkspaceSpecifier extends S.TaggedClass<WorkspaceSpecifier>($I`WorkspaceSpecifier`)("workspace", {
	/** The original specifier string. */
	raw: S.String.annotateKey({ description: "The original specifier string." }),
	/** The part after `workspace:` (e.g. `*`, `^1.2.3`, or an alias form). */
	range: S.String.annotateKey({ description: "The part after `workspace:` (e.g. `*`, `^1.2.3`, or an alias form)." }),
}, $I.annote("WorkspaceSpecifier", { description: "A `workspace:` reference. `range` carries the part after `workspace:` — a range modifier (`*`, `^`, `~`), a concrete range, or an alias form." })) {
	/**
  * The pnpm publish-time projection of this specifier against a concrete
  * workspace version: `*` (or an empty range) becomes `version`, `~` becomes
  * `~version`, `^` becomes `^version`, and a pinned range passes through
  * unchanged. The alias form (`workspace:<name>@<range>`) becomes pnpm's
  * publish-time aliased dependency `npm:<name>@<projected>`, with the range
  * modifier projected the same way — `version` must then be the TARGET
  * package's version (see `DependencySpecifier.workspaceTargetOf`).
  *
  * **Details**
  *
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
export class RangeSpecifier extends S.TaggedClass<RangeSpecifier>($I`RangeSpecifier`)("range", {
	/** The original specifier string. */
	raw: S.String.annotateKey({ description: "The original specifier string." }),
}, $I.annote("RangeSpecifier", { description: "A plain semver range or exact version (e.g. `^1.2.3`, `1.x`, `>=1 <2`)." })) {}

/**
 * A bare dist-tag (e.g. `latest`, `next`).
 *
 * @public
 */
export class DistTagSpecifier extends S.TaggedClass<DistTagSpecifier>($I`DistTagSpecifier`)("dist-tag", {
	/** The original specifier string (also the tag name). */
	raw: S.String.annotateKey({ description: "The original specifier string (also the tag name)." }),
}, $I.annote("DistTagSpecifier", { description: "A bare dist-tag (e.g. `latest`, `next`)." })) {}

/**
 * The honest fallback for `file:` / `link:` / `portal:` / git / URL / `npm:`
 * forms this concept does not further interpret.
 *
 * @public
 */
export class RawSpecifier extends S.TaggedClass<RawSpecifier>($I`RawSpecifier`)("raw", {
	/** The original specifier string. */
	raw: S.String.annotateKey({ description: "The original specifier string." }),
}, $I.annote("RawSpecifier", { description: "The honest fallback for `file:` / `link:` / `portal:` / git / URL / `npm:` forms this concept does not further interpret." })) {}

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

const Classified = S.Union([CatalogSpecifier, WorkspaceSpecifier, RangeSpecifier, DistTagSpecifier, RawSpecifier]);

// Group a *valid* specifier into one of the five coarse cases, reusing the
// taxonomy predicates above. Order matters: catalog/workspace prefixes first,
// then a parseable range, then a bare tag, with everything else (git, url,
// file, link, portal, npm) preserved as `raw`.
const classify = (value: string): ClassifiedSpecifier => {
	if (isCatalog(value)) {
		return CatalogSpecifier.make({ raw: value, name: catalogNameOf(value) });
	}
	if (isWorkspace(value)) {
		return WorkspaceSpecifier.make({ raw: value, range: Str.slice(WORKSPACE_PREFIX.length)(value) });
	}
	if (isRange(value)) return RangeSpecifier.make({ raw: value });
	if (isTag(value)) return DistTagSpecifier.make({ raw: value });
	return RawSpecifier.make({ raw: value });
};

const fromString: S.Codec<ClassifiedSpecifier, string> = S.String.pipe(
	S.decodeTo(
		Classified,
		// Pinned to the union's ENCODED side (plain records, without instance
		// methods like WorkspaceSpecifier#resolve): letting inference unify the
		// transformation's target from decode/encode rejects the instance methods.
		SchemaTransformation.transformEffect<(typeof Classified)["Encoded"], string>({
			decode: (input) => S.decodeEffect(DependencySpecifier)(input).pipe(
                Effect.map(classify),
                Effect.mapError(() => new SchemaIssue.InvalidValue({ message: `Invalid dependency specifier: "${input}"` }, input)),
            ),
			encode: (classified) => Effect.succeed(classified.raw),
		}),
	),
);

/**
 * The branded dependency-specifier type: any string `DependencySpecifier`
 * validates.
 *
 * @public
 */
export type DependencySpecifierBrand = string & Brand.Brand<"DependencySpecifier">;

const brandedSpecifier = S.String.pipe(
    $I.annoteSchema("DependencySpecifier", { description: "A branded dependency specifier accepted by the shared protocol taxonomy." }),
	S.check(
		S.makeFilter((value) =>
			isValidDependencySpecifier(value) ? undefined : "Expected a valid dependency specifier",
            $I.annote("DependencySpecifierCheck", { title: "Valid dependency specifier", description: "A nonempty string classified as a supported dependency protocol." }),
		),
	),
	S.brand("DependencySpecifier"),
);

const decode = Effect.fn("DependencySpecifier.decode")((input: string): Effect.Effect<DependencySpecifierBrand, InvalidDependencySpecifierError> =>
    S.decodeEffect(DependencySpecifier)(input).pipe(Effect.mapError(() => InvalidDependencySpecifierError.make({ input }))),
);

// Widen only the unused constructor: schema Type and decoded values stay branded strings.
const DependencySpecifierBase: Omit<S.Opaque<DependencySpecifierBrand, typeof brandedSpecifier, {}>, never> &
    (new (_: never) => Pick<DependencySpecifierBrand, keyof DependencySpecifierBrand>) = S.Opaque<DependencySpecifierBrand>()(brandedSpecifier);

/**
 * A valid dependency version specifier, carrying the protocol taxonomy statics
 * (`DependencySpecifier.protocolOf` and friends) that classify any specifier
 * string, plus the {@link (DependencySpecifier:variable).FromString} codec that
 * decodes a string into a {@link ClassifiedSpecifier} tagged union. Use it as a
 * schema for a specifier field and reach for the statics to inspect a raw
 * string.
 *
 * **Example** (Classify and project dependency specifiers)
 *
 * ```ts
 * import { DependencySpecifier } from "./index.ts";
 * import * as S from "effect/Schema";
 *
 * DependencySpecifier.protocolOf("workspace:^"); // => "workspace"
 * DependencySpecifier.resolveWorkspace("workspace:^", "1.2.3"); // => "^1.2.3"
 *
 * const classified = S.decodeUnknownSync(DependencySpecifier.FromString)("catalog:");
 * // => CatalogSpecifier { raw: "catalog:", name: Option.none() }
 * ```
 *
 * @public
 */
export class DependencySpecifier extends DependencySpecifierBase {
    /** Classify a specifier into a single protocol; `"unknown"` for unrecognized input. */
    static readonly protocolOf = protocolOf;
    /** Parse the specifier as a semver `Range`, `None` when it is not a range. Pure. */
    static readonly parseRange = parseRange;
    /** Whether the specifier is a parseable semver range. */
    static readonly isRange = isRange;
    /** Whether the specifier is a dist-tag (`latest`, `next`, ...). */
    static readonly isTag = isTag;
    /** Whether the specifier resolves to a git source (URLs and hosted-git shorthands). */
    static readonly isGit = isGit;
    /** Whether the specifier is an HTTP(S) URL. */
    static readonly isUrl = isUrl;
    /** Whether the specifier points to a local path (`file:`/`link:`/`portal:` or a bare path). */
    static readonly isLocal = isLocal;
    /** Whether the specifier uses the `link:` protocol. */
    static readonly isLink = isLink;
    /** Whether the specifier uses the `portal:` protocol. */
    static readonly isPortal = isPortal;
    /** Whether the specifier uses the `catalog:` protocol. */
    static readonly isCatalog = isCatalog;
    /** Whether the specifier uses the `workspace:` protocol. */
    static readonly isWorkspace = isWorkspace;
    /**
	 * The catalog name of a `catalog:` specifier: `Some(name)` for a named
	 * catalog, `None` for the default catalog (nothing but whitespace after the
	 * prefix). The result is only meaningful when `isCatalog(specifier)` is
	 * true — non-catalog input also returns `None`.
	 */
    static readonly catalogNameOf = catalogNameOf;
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
    static readonly resolveWorkspace = resolveWorkspace;
    /**
	 * The target package name of an alias-form `workspace:` specifier
	 * (`workspace:<name>@<range>` — e.g. `workspace:foo@^`,
	 * `workspace:@scope/charts@*`): `Some(name)` for the alias form, `None`
	 * for the plain form and for non-workspace input. Resolvers must look up
	 * this package's version (not the dependency-map key's) before projecting
	 * with `resolveWorkspace`.
	 */
    static readonly workspaceTargetOf = workspaceTargetOf;
    /** Whether the string is a valid dependency specifier. */
    static readonly isValid = isValidDependencySpecifier;
    /** Validate a string, failing with a typed {@link InvalidDependencySpecifierError}. */
    static readonly decode = decode;
    /**
	 * Codec between a specifier string and a {@link ClassifiedSpecifier} tagged
	 * union. Decoding classifies; encoding returns the original `raw` string
	 * byte-for-byte.
	 */
    static readonly FromString = fromString;
}
