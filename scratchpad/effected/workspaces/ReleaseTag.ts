// What a release's git tag is called.
//
// A pure leaf: this module imports nothing from the rest of the package, and
// nothing about git or GitHub. A tag NAME is a string-formatting concern, and
// keeping it here rather than on a git-shaped service is what lets a release
// planner compute its tags before it has decided to talk to anything.
//
// The default version prefix is "" uniformly, for scoped and unscoped tags
// alike — strict SemVer. A tool that needs GitHub's `v<semver>` release-tag
// convention passes `versionPrefix: "v"` explicitly. Git tag history is not an
// API, so changing a default here would not rewrite a consumer's existing tags.

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/workspaces/ReleaseTag");

/**
 * Whether one shared tag names a whole release, or one tag names each package.
 *
 * @remarks
 * `single` is the shape of a single-package repo and of a monorepo whose
 * publishable packages all version in lockstep; `scoped` is the shape of
 * independent versioning, where a shared tag would be ambiguous.
 *
 * @public
 */
export const TagStyle = LiteralKit(["single", "scoped"]).pipe($I.annoteSchema("TagStyle", { description: "Whether one shared tag names a whole release, or one tag names each package." }));

/**
 * The decoded type of {@link (TagStyle:variable)}: `"single" | "scoped"`.
 *
 * @public
 */
export type TagStyle = typeof TagStyle.Type;

/**
 * Formatting knobs for {@link ReleaseTag.single} and {@link ReleaseTag.scoped}.
 *
 * @public
 */
export interface TagFormatOptions {
	/**
	 * The prefix on the version segment.
	 *
	 * @remarks
	 * Defaults to `""` uniformly, for both {@link ReleaseTag.single} and
	 * {@link ReleaseTag.scoped} — strict SemVer, deliberately chosen. Pass
	 * `"v"` for the GitHub release-tag convention (`v1.2.3`), which tools such
	 * as `actions/checkout`'s ref resolution and third-party changelog
	 * generators expect.
	 */
	readonly versionPrefix?: string;
}

// The numeric core of a SemVer version, plus whether it carries a prerelease.
//
// Parsed here rather than through `@effected/semver` on purpose: the
// tracking-tag grammar is deliberately NOT SemVer (a truncated `v1` is not a
// version at all), and the only facts the derivation needs are the major and
// minor segments and the presence of a prerelease. A dependency edge for that
// is disproportionate; real semver *comparison* would justify one.
interface VersionCore {
	readonly major: number;
	readonly minor: number;
	readonly prerelease: boolean;
}

/** Digits only, and no leading zeros beyond `0` itself — SemVer's numeric identifier. */
const NUMERIC_IDENTIFIER = /^(?:0|[1-9]\d*)$/;

/** Complete SemVer grammar, including non-empty prerelease and build identifiers. */
const VersionText = S.String.check(
	S.isPattern(/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$(?![\s\S])/),
).pipe($I.annoteSchema("VersionText", { description: "A complete SemVer version with valid prerelease and build identifiers." }));
const isVersionText = S.is(VersionText);

/**
 * Read a version's numeric core, or nothing when it is not `X.Y.Z[-pre][+build]`.
 *
 * Build metadata is stripped **before** the prerelease test: `+build` carries
 * no precedence meaning in SemVer, so `1.2.3+sha.abc` is the stable `1.2.3`,
 * and treating any `-`-or-`+` suffix as a prerelease is the obvious wrong
 * reading.
 */
const versionCore = (version: string): VersionCore | undefined => {
	if (!isVersionText(version)) return undefined;
	const withoutBuild = version.split("+", 1)[0] ?? "";
	const dash = withoutBuild.indexOf("-");
	const prerelease = dash !== -1;
	const core = prerelease ? withoutBuild.slice(0, dash) : withoutBuild;

	const segments = core.split(".");
	if (segments.length !== 3) return undefined;
	if (!segments.every((segment) => NUMERIC_IDENTIFIER.test(segment))) return undefined;

	return { major: Number(segments[0]), minor: Number(segments[1]), prerelease };
};

/**
 * Options for {@link TrackingTag.forVersion}.
 *
 * @public
 */
export interface TrackingTagOptions {
	/**
	 * Prefix the alias with a package name, for a monorepo that namespaces its
	 * tags: `@scope/pkg@v1`. Omit it for a single-package repo's bare `v1`.
	 */
	readonly packageName?: string;
	/**
	 * Which aliases to derive. `"both"` (the default) gives `v1` and `v1.2`;
	 * `"major"` gives only the broad `v1`.
	 */
	readonly precision?: "major" | "both";
	/**
	 * Derive aliases for a prerelease version too. **Off by default, and you
	 * almost certainly want it off** — see {@link TrackingTag.forVersion}.
	 */
	readonly includePrerelease?: boolean;
}

/**
 * A floating alias tag — `v1`, `v1.2` — that a repo re-points at its newest
 * matching release.
 *
 * @remarks
 * This is the GitHub Actions distribution convention: a consumer writes
 * `uses: owner/repo@v1` and receives whatever 1.x the repo last pointed `v1` at.
 *
 * **Deliberately not SemVer, and deliberately not a {@link (TagStyle:variable)}.**
 * A release tag names one immutable version; a tracking tag is an alias derived
 * *from* a version, carrying a truncated number that is not a version at all.
 * Folding it into `ReleaseTag` as a third style would put a mutable pointer and
 * an immutable name behind one type.
 *
 * Everything here is derivation, formatting and parsing. **Actually moving a
 * git tag is not this package's business** — a consumer does that through git,
 * and the deliberate omission is what keeps this module a pure leaf.
 *
 * @example
 * ```ts
 * import { TrackingTag } from "./index.ts";
 *
 * TrackingTag.forVersion("1.2.3").map((t) => t.value);        // ["v1", "v1.2"]
 * TrackingTag.forVersion("1.0.0-beta.3");                     // [] — never float onto a beta
 * TrackingTag.forVersion("1.2.3", { packageName: "@acme/cli" });
 * // ["@acme/cli@v1", "@acme/cli@v1.2"]
 * ```
 *
 * @public
 */
export class TrackingTag extends S.Class<TrackingTag>($I`TrackingTag`)({
	/** The tag string exactly as it appears in git. */
	value: S.NonEmptyString.annotateKey({ description: "The tag string exactly as it appears in git." }),
	/** The package the alias namespaces; absent on a bare `v1`. */
	packageName: S.optionalKey(S.NonEmptyString).annotateKey({ description: "The package the alias namespaces; absent on a bare `v1`." }),
	/** The major version the alias tracks. */
	major: S.Int.annotateKey({ description: "The major version the alias tracks." }),
	/** The minor version, on a `v1.2`-precision alias; absent on `v1`. */
	minor: S.optionalKey(S.Int).annotateKey({ description: "The minor version, on a `v1.2`-precision alias; absent on `v1`." }),
}, $I.annote("TrackingTag", { description: "A floating alias tag — `v1`, `v1.2` — that a repo re-points at its newest matching release." })) {
	/** Whether this alias tracks a whole major line, or one minor line inside it. */
	get precision(): "major" | "minor" {
		return this.minor === undefined ? "major" : "minor";
	}

	/**
	 * The tracking tags a release of `version` should be pointed at.
	 *
	 * @remarks
	 * **A prerelease derives nothing.** Anyone depending on `owner/repo@v1` is
	 * asking for the newest *stable* 1.x, so re-pointing that alias at
	 * `1.0.0-beta.3` would ship a prerelease to every such consumer with no
	 * signal at all. `includePrerelease` exists for callers who genuinely mean
	 * it — a prerelease-only distribution channel — and should be rare.
	 *
	 * **Total, never throwing.** A version that is not `X.Y.Z` derives nothing
	 * rather than failing: this is a query about a version, not a validation of
	 * one, and `WorkspacePackage.version` is deliberately tolerant, so odd
	 * versions reach here routinely.
	 *
	 * 0.x versions DO derive aliases. Floating `v0` across 0.x minors is a real
	 * hazard, but which aliases to publish is the caller's policy, decided where
	 * the tags are moved — not something a derivation should quietly withhold.
	 *
	 * @param version - The version being released.
	 * @param options - Package prefix, precision and the prerelease override.
	 * @returns The aliases, broadest first; empty when none apply.
	 */
	static forVersion(version: string, options?: TrackingTagOptions): ReadonlyArray<TrackingTag> {
		const core = versionCore(version);
		if (core === undefined) return [];
		if (!S.is(TrackingTag.fields.major)(core.major) || !S.is(TrackingTag.fields.minor)(core.minor)) return [];
		if (core.prerelease && options?.includePrerelease !== true) return [];

		const packageName = options?.packageName;
		const prefix = packageName === undefined ? "" : `${packageName}@`;
		const named = (suffix: string, fields: { readonly major: number; readonly minor?: number }): TrackingTag =>
			TrackingTag.make({
				value: `${prefix}v${suffix}`,
				...(packageName !== undefined && { packageName }),
				major: fields.major,
				...(fields.minor !== undefined && { minor: fields.minor }),
			});

		const major = named(`${core.major}`, { major: core.major });
		if (options?.precision === "major") return [major];
		return [major, named(`${core.major}.${core.minor}`, { major: core.major, minor: core.minor })];
	}
}

/** A tag string split into an optional package prefix and the version part. */
const splitTag = (tag: string): { readonly packageName?: string; readonly rest: string } | undefined => {
	const at = tag.lastIndexOf("@");
	// No `@` at all: the whole string is the version part (a single-style tag).
	if (at === -1) return { rest: tag };
	// A leading `@` with nothing after it is a scope with no version.
	const packageName = tag.slice(0, at);
	const rest = tag.slice(at + 1);
	if (packageName === "" || rest === "") return undefined;
	return { packageName, rest };
};

/**
 * Decide whether a tag string is a release tag, a tracking alias, or neither.
 *
 * @remarks
 * The two families are told apart by **segment count**, not by the `v` prefix:
 * three numeric segments is a version (so `1.0.0` and `v1.0.0` are both release
 * tags), while one or two segments is a truncated alias. The `v` *is* required
 * on an alias — a bare `1` is neither valid SemVer nor the tracking convention,
 * and accepting it would make this function guess.
 *
 * The package prefix splits at the **last** `@`, so a leading npm scope
 * survives: `@scope/pkg@1.0.0` is package `@scope/pkg` at version `1.0.0`.
 *
 * Round-tripping is a tested property: every tag {@link ReleaseTag} and
 * {@link TrackingTag} format classifies back to the family that produced it,
 * with its fields intact.
 *
 * @param tag - Any tag string.
 * @returns The classification.
 *
 * @public
 */
export const classifyTag = (tag: string): TagClassification => {
	const split = splitTag(tag);
	if (split === undefined) return { kind: "unrecognized" };

	const { packageName, rest } = split;
	const withoutV = rest.startsWith("v") ? rest.slice(1) : rest;
	const hasV = rest.startsWith("v");

	// Three segments (plus optional prerelease/build) is a version.
	const core = versionCore(withoutV);
	if (core !== undefined) {
		return {
			kind: "release",
			tag: ReleaseTag.make({
				value: tag,
				...(packageName !== undefined && { packageName }),
				version: withoutV,
				style: packageName === undefined ? "single" : "scoped",
			}),
		};
	}

	// One or two numeric segments behind a `v` is a tracking alias.
	if (!hasV) return { kind: "unrecognized" };
	const segments = withoutV.split(".");
	if (segments.length > 2 || !segments.every((segment) => NUMERIC_IDENTIFIER.test(segment))) {
		return { kind: "unrecognized" };
	}

	const major = Number(segments[0]);
	const minor = segments.length === 2 ? Number(segments[1]) : undefined;
	if (!S.is(TrackingTag.fields.major)(major) || (minor !== undefined && !S.is(TrackingTag.fields.minor)(minor))) {
		return { kind: "unrecognized" };
	}
	return {
		kind: "tracking",
		tag: TrackingTag.make({
			value: tag,
			...(packageName !== undefined && { packageName }),
			major,
			...(minor !== undefined && { minor }),
		}),
	};
};

/**
 * A git tag naming a release, and the parts it was built from.
 *
 * @remarks
 * `value` is the tag exactly as it appears in git; `version` stays **bare**
 * even when `value` carries a prefix, so a consumer comparing versions never
 * has to strip one back off.
 *
 * Formatting has **no error channel**: an empty version is rejected by
 * `Schema.NonEmptyString` when the value is constructed. A bad version
 * reaching these statics is developer wiring rather than untrusted input, so it
 * dies as a defect, the same posture as an uncompilable glob literal in
 * `WorkspacePackage.matchesDependency`.
 *
 * @example
 * ```ts
 * import { ReleaseTag } from "./index.ts";
 *
 * ReleaseTag.single("1.2.3").value;               // "1.2.3"
 * ReleaseTag.scoped("@acme/cli", "1.2.3").value;  // "@acme/cli@1.2.3"
 * ReleaseTag.scoped("cli", "1.2.3").value;        // "cli@1.2.3"
 * ReleaseTag.scoped("cli", "1.2.3", { versionPrefix: "v" }).value; // "cli@v1.2.3"
 * ```
 *
 * @public
 */
export class ReleaseTag extends S.Class<ReleaseTag>($I`ReleaseTag`)({
	/** The tag string exactly as it appears in git. */
	value: S.NonEmptyString.annotateKey({ description: "The tag string exactly as it appears in git." }),
	/** The package the tag names; absent on a workspace-wide single tag. */
	packageName: S.optionalKey(S.NonEmptyString).annotateKey({ description: "The package the tag names; absent on a workspace-wide single tag." }),
	/** The version the tag names, without any prefix. */
	version: S.NonEmptyString.annotateKey({ description: "The version the tag names, without any prefix." }),
	/** Which style produced it. */
	style: TagStyle.annotateKey({ description: "Which style produced it." }),
}, $I.annote("ReleaseTag", { description: "A git tag naming a release, and the parts it was built from." })) {
	/**
	 * One shared tag for a whole release: `1.2.3`.
	 *
	 * @param version - The version being released. Must not be empty.
	 * @param options - Formatting overrides.
	 * @returns the single-style {@link ReleaseTag}.
	 */
	static single(version: string, options?: TagFormatOptions): ReleaseTag {
		const prefix = options?.versionPrefix ?? "";
		return ReleaseTag.make({
			value: `${prefix}${version}`,
			version,
			style: "single",
		});
	}

	/**
	 * A per-package tag: `<packageName>@<version>` — `@scope/pkg@1.2.3` for a
	 * scoped name, `pkg@1.2.3` for an unscoped one, uniformly, unless
	 * `options.versionPrefix` says otherwise.
	 *
	 * @param packageName - The package being released. Must not be empty.
	 * @param version - The version being released. Must not be empty.
	 * @param options - Formatting overrides.
	 */
	static scoped(packageName: string, version: string, options?: TagFormatOptions): ReleaseTag {
		const prefix = options?.versionPrefix ?? "";
		return ReleaseTag.make({
			value: `${packageName}@${prefix}${version}`,
			packageName,
			version,
			style: "scoped",
		});
	}
}

/**
 * What an arbitrary tag string denotes.
 *
 * **Details**
 *
 * `unrecognized` is a real answer, not a failure: a repository's tags include
 * branches-turned-tags, `latest`, and whatever else humans wrote, and forcing
 * those into a bucket is exactly what a classifier must not do.
 *
 * **Example** (Recognize a classification)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { TagClassification, classifyTag } from "./ReleaseTag.ts";
 *
 * S.is(TagClassification)(classifyTag("v1")); // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const TagClassification = S.Union([
	S.Struct({
		kind: S.Literal("release").annotateKey({ description: "An immutable release tag." }),
		tag: ReleaseTag.annotateKey({ description: "The recognized release tag." }),
	}),
	S.Struct({
		kind: S.Literal("tracking").annotateKey({ description: "A floating tracking alias." }),
		tag: TrackingTag.annotateKey({ description: "The recognized tracking tag." }),
	}),
	S.Struct({
		kind: S.Literal("unrecognized").annotateKey({ description: "A tag outside both supported grammars." }),
	}),
]).pipe(
	S.toTaggedUnion("kind"),
	$I.annoteSchema("TagClassification", { description: "Whether an arbitrary tag denotes a release, a tracking alias, or neither." }),
);

/**
 * The structural result of classifying a tag string.
 *
 * @category type-level
 * @since 0.0.0
 */
export type TagClassification = typeof TagClassification.Type;
