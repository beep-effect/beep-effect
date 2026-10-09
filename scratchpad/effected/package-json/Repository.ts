// The `repository` and `bugs` field models: where a package lives, and where
// to report problems with it.
//
// Both accept npm's two encodings — a shorthand string or an object — and both
// hold the same wire-fidelity requirement the `Person` model does: a formatter
// must not rewrite one legal encoding into another, so a value read from the
// string form re-encodes to that exact string. The mechanism is `Person`'s: a
// WeakMap of provenance, because the wire form is provenance rather than data —
// it must not appear in the encoded output, must not affect structural
// equality, and must not survive being copied into a hand-built value.
//
// Normalization is exposed as DERIVED GETTERS over a verbatim `url`, never by
// rewriting the field. A caller that wants a browsable link asks for one; a
// caller that wants the bytes it read keeps them.

import { $ScratchpadId } from "@beep/identity/packages";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as P from "effect/Predicate";
import * as R from "effect/Record";

const $I = $ScratchpadId.create("effected/package-json/Repository");

/** The shorthand hosts npm resolves without a scheme. */
const SHORTHAND_HOSTS: ReadonlyMap<string, string> = new Map([
	["github", "https://github.com"],
	["gitlab", "https://gitlab.com"],
	["bitbucket", "https://bitbucket.org"],
]);

/** `owner/name`, the bare GitHub shorthand. Deliberately strict about segment shape. */
const BARE_SHORTHAND = /^[\w.-]+\/[\w.-]+$/;

/** `github:owner/name`, `gist:id`, … */
const PREFIXED_SHORTHAND = /^([a-z]+):(.+)$/;

/** The scp-like form git accepts: `git@host:owner/name.git`. */
const SCP_LIKE = /^(?:([\w.-]+)@)?([\w.-]+):(.+)$/;

/**
 * How each known forge spells "browse this subdirectory". `HEAD` is used
 * rather than a branch name because the default branch is not knowable from a
 * manifest, and every one of these hosts resolves `HEAD` to it.
 */
const DIRECTORY_PATHS: ReadonlyMap<string, string> = new Map([
	["github.com", "tree/HEAD"],
	// GitLab routes repository browsing under `/-/` to keep it clear of group
	// and project namespaces, which can otherwise collide with `tree`.
	["gitlab.com", "-/tree/HEAD"],
	["bitbucket.org", "src/HEAD"],
]);

const stripGitSuffix = (value: string): string => (value.endsWith(".git") ? value.slice(0, -4) : value);

/**
 * The browsable `https://host/path` form of a repository reference, or none
 * when the value is not one this model recognizes.
 *
 * Total by construction: `repository` is caller data, and a value that cannot
 * be interpreted is a missing answer rather than a failure.
 */
const browseUrlOf = (raw: string): O.Option<string> => {
	const url = raw.trim();
	if (url === "") return O.none();

	// `owner/name` — GitHub is npm's default host for the bare form.
	if (BARE_SHORTHAND.test(url)) return O.some(`https://github.com/${url}`);

	const prefixed = PREFIXED_SHORTHAND.exec(url);
	if (prefixed !== null) {
		const [, scheme, rest] = prefixed;
		// `gist:id` resolves to a different host than the code-forge shorthands.
		if (scheme === "gist") return O.some(`https://gist.github.com/${stripGitSuffix(rest ?? "")}`);
		const host = SHORTHAND_HOSTS.get(scheme ?? "");
		if (host !== undefined) return O.some(`${host}/${stripGitSuffix(rest ?? "")}`);
	}

	// Anything with a scheme: normalize the transport away and keep host + path.
	// `git+ssh://git@github.com/o/n.git` and `git://github.com/o/n.git` both
	// browse at `https://github.com/o/n`.
	const withoutGitPlus = url.startsWith("git+") ? url.slice(4) : url;
	const schemeMatch = /^([a-z][a-z0-9+.-]*):\/\/(.*)$/i.exec(withoutGitPlus);
	if (schemeMatch !== null) {
		const authorityAndPath = schemeMatch[2] ?? "";
		// Drop any `user@` credential prefix — it is transport, not identity.
		const withoutCredentials = authorityAndPath.replace(/^[^/@]+@/, "");
		return withoutCredentials === "" ? O.none() : O.some(`https://${stripGitSuffix(withoutCredentials)}`);
	}

	// The scp-like form has no scheme: `git@github.com:owner/name.git`.
	const scp = SCP_LIKE.exec(withoutGitPlus);
	if (scp !== null) {
		const [, , host, path] = scp;
		if (host !== undefined && path !== undefined && path !== "") {
			return O.some(`https://${host}/${stripGitSuffix(path)}`);
		}
	}

	return O.none();
};

/** The wire value a repository or bugs entry was decoded from. */
type FieldWire = string | { readonly [k: string]: unknown };

const repositoryWires = new WeakMap<Repository, FieldWire>();
const bugsWires = new WeakMap<Bugs, FieldWire>();

const KNOWN_REPOSITORY_KEYS: ReadonlySet<string> = new Set(["type", "url", "directory"]);
const KNOWN_BUGS_KEYS: ReadonlySet<string> = new Set(["url", "email"]);

// A remembered OBJECT wire is replayed only while it still describes the value
// faithfully — the same discipline `Person` already applies, and for the same
// reason. An unguarded replay hands back the bytes that were read, so a value
// edited after decoding re-encodes as the stale original and the edit is
// silently lost. `Person` guarded this; `Repository` and `Bugs` did not.
const sameRest = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});

/** The keys of `wire` outside the documented set, which is what `rest` holds. */
const restOf = (wire: { readonly [k: string]: unknown }, known: ReadonlySet<string>): Record<string, unknown> => {
	const rest: Record<string, unknown> = {};
	for (const [key, value] of R.toEntries(wire)) {
		if (!known.has(key)) rest[key] = value;
	}
	return rest;
};

/**
 * Whether the shorthand string can still carry everything this value holds.
 *
 * @remarks
 * A shorthand is only a `url` — it has no syntax for `type`, `directory` or an
 * unknown key. So a repository decoded from a string that later GAINS one of
 * those is no longer described by the wire it remembers, and replaying that
 * wire drops the addition silently. This is the same stale-provenance class the
 * object branch guards, reached through the one field the shorthand cannot
 * express, and `Person.isShorthandExpressible` / `Funding.isStringExpressible`
 * already gate their own string branches this way.
 *
 * `directory` is the live case: this package ships `Repository.directoryUrl`,
 * so a consumer reading a bare-string `repository` and making it a monorepo
 * member is the natural mutator.
 */
const isStringExpressibleRepository = (repository: Repository): boolean =>
	repository.type === undefined &&
	repository.directory === undefined &&
	R.keys(repository.rest ?? {}).length === 0;

/** Whether the bare URL string can still carry everything this `bugs` entry holds. */
const isStringExpressibleBugs = (bugs: Bugs): boolean =>
	bugs.email === undefined && R.keys(bugs.rest ?? {}).length === 0;

const isFaithfulRepository = (wire: { readonly [k: string]: unknown }, repository: Repository): boolean =>
	wire.url === repository.url &&
	wire.type === repository.type &&
	wire.directory === repository.directory &&
	sameRest(restOf(wire, KNOWN_REPOSITORY_KEYS), repository.rest);

const isFaithfulBugs = (wire: { readonly [k: string]: unknown }, bugs: Bugs): boolean =>
	wire.url === bugs.url &&
	wire.email === bugs.email &&
	sameRest(restOf(wire, KNOWN_BUGS_KEYS), bugs.rest);

/**
 * Where a package's source lives.
 *
 * @remarks
 * `url` is **verbatim** — exactly the string the manifest carried, shorthand
 * and all. Normalization is offered through {@link Repository.browseUrl} and
 * {@link Repository.gitUrl}, so reading a manifest never rewrites it and a
 * caller that wants the original still has it.
 *
 * @example
 * ```ts
 * import { Repository } from "./index.ts";
 * import * as S from "effect/Schema";
 *
 * const repo = S.decodeUnknownSync(Repository.FromValue)("effected/kit");
 * repo.url; // => "effected/kit"
 * repo.browseUrl; // => Option.some("https://github.com/effected/kit")
 * // "git@github.com:effected/kit.git" browses to the same URL
 * ```
 *
 * @public
 */
export class Repository extends S.Class<Repository>($I`Repository`)({
	/** The `type` field, when the object form carried one (`"git"`, …). */
	type: S.optionalKey(S.String).annotateKey({ description: "The `type` field, when the object form carried one (`\"git\"`, …)." }),
	/** The reference exactly as written: a shorthand, a git URL, or an https URL. */
	url: S.String.annotateKey({ description: "The reference exactly as written: a shorthand, a git URL, or an https URL." }),
	/** The subdirectory within the repository, for a monorepo member. */
	directory: S.optionalKey(S.String).annotateKey({ description: "The subdirectory within the repository, for a monorepo member." }),
	/** Keys outside the documented set, preserved so encoding does not drop them. */
	rest: S.optionalKey(S.Record(S.String, S.Unknown)).annotateKey({ description: "Keys outside the documented set, preserved so encoding does not drop them." }),
}, $I.annote("Repository", { description: "Where a package's source lives." })) {
	/**
	 * The browsable `https://` URL, or `Option.none()` when `url` is not a form
	 * this model recognizes.
	 */
	get browseUrl(): O.Option<string> {
		return browseUrlOf(this.url);
	}

	/** The canonical https clone URL, or none when it cannot be derived. */
	get gitUrl(): O.Option<string> {
		return O.map(this.browseUrl, (url) => `${url}.git`);
	}

	/**
	 * The browsable URL of **this package** — {@link Repository.browseUrl}
	 * descended into `directory` when the package is a monorepo
	 * member.
	 *
	 * @remarks
	 * Prefer this over `browseUrl` whenever the question is "where does this
	 * package live". For a monorepo, `browseUrl` answers with the repository
	 * root, so every member of the repository reports the same location — which
	 * matters because that URL is exactly what a consumer (a docs site's
	 * structured data, say) uses to tell two packages apart.
	 *
	 * The three outcomes are deliberately distinct:
	 *
	 * - **No `directory`** — the package *is* the repository root, so this is
	 *   `browseUrl`. A correct answer, not a missing one.
	 * - **`directory` on a host this model knows** (GitHub, GitLab, Bitbucket) —
	 *   the descended URL.
	 * - **`directory` on any other host** — `Option.none()`. The path convention
	 *   for browsing a subdirectory is per-forge and cannot be guessed, and
	 *   fabricating one would produce a URL that resolves to nothing while
	 *   looking authoritative.
	 *
	 * What to do with that `none` is a policy this getter deliberately leaves to
	 * the caller, because it depends on what is being filled in. Falling back to
	 * {@link Repository.browseUrl} is reasonable wherever a less precise answer
	 * beats no answer — the repository root is a *true* location for the package,
	 * merely one that does not distinguish it from its siblings. Omit the value
	 * instead wherever that lack of distinction is the whole point. What is never
	 * reasonable is inventing a subdirectory path for a host this model does not
	 * recognize, which is the case this `none` exists to prevent.
	 *
	 * A `directory` that escapes the repository (any `..` segment) is refused the
	 * same way. One that resolves to the root itself (`"."`, `"/"`) is the root.
	 *
	 * @example
	 * ```ts
	 * import { Repository } from "./index.ts";
	 * import * as S from "effect/Schema";
	 *
	 * const repo = S.decodeUnknownSync(Repository.FromValue)({
	 *   url: "effected/kit",
	 *   directory: "packages/spdx",
	 * });
	 * repo.directoryUrl;
	 * // => Option.some("https://github.com/effected/kit/tree/HEAD/packages/spdx")
	 * ```
	 */
	get directoryUrl(): O.Option<string> {
		const directory = this.directory;
		if (directory === undefined) return this.browseUrl;

		const segments = directory
			.split("/")
			.map((segment) => segment.trim())
			.filter((segment) => segment !== "" && segment !== ".");
		// `..` would climb out of the repository the manifest names.
		if (segments.some((segment) => segment === "..")) return O.none();
		// `"."`, `"/"`, `""` — the member is the root after all.
		if (segments.length === 0) return this.browseUrl;

		return O.flatMap(this.browseUrl, (url) => {
			const host = /^https:\/\/([^/]+)/.exec(url)?.[1];
			const path = host === undefined ? undefined : DIRECTORY_PATHS.get(host);
			if (path === undefined) return O.none();
			return O.some(`${url}/${path}/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`);
		});
	}

	/**
	 * The `repository` field: the shorthand string or the object form, always
	 * decoded to a {@link Repository}, and always re-encoded in the form it was
	 * read from.
	 */
	static readonly FromValue: S.Codec<Repository, string | { readonly [k: string]: unknown }> = S.Union([
		S.Record(S.String, S.Unknown),
		S.String,
	]).pipe(
		S.decodeTo(
			S.instanceOf(Repository),
			SchemaTransformation.transform({
				decode: (input: string | { readonly [k: string]: unknown }): Repository => {
					if (P.isString(input)) {
						const repository = Repository.make({ url: input });
						repositoryWires.set(repository, input);
						return repository;
					}
					const rest: Record<string, unknown> = {};
					for (const [key, value] of R.toEntries(input)) {
						if (!KNOWN_REPOSITORY_KEYS.has(key)) rest[key] = value;
					}
					const repository = Repository.make({
						url: P.isString(input.url) ? input.url : "",
						...(P.isString(input.type) && { type: input.type }),
						...(P.isString(input.directory) && { directory: input.directory }),
						...(R.keys(rest).length > 0 && { rest }),
					});
					repositoryWires.set(repository, input);
					return repository;
				},
				encode: (repository: Repository): string | { readonly [k: string]: unknown } => {
					const wire = repositoryWires.get(repository);
					// Replay the shorthand only while it still describes this value —
					// an edited url must not re-encode as the stale original.
					if (P.isString(wire) && wire === repository.url && isStringExpressibleRepository(repository))
						return wire;
					if (wire !== undefined && !P.isString(wire) && isFaithfulRepository(wire, repository)) return wire;
					return {
						...(repository.type !== undefined && { type: repository.type }),
						url: repository.url,
						...(repository.directory !== undefined && { directory: repository.directory }),
						...repository.rest,
					};
				},
			}),
		),
	);
}

/**
 * Where to report problems with a package.
 *
 * @remarks
 * npm permits a bare URL string, or an object with `url`, `email`, or both —
 * an email-only entry is legal, which is why `url` is optional.
 *
 * @public
 */
export class Bugs extends S.Class<Bugs>($I`Bugs`)({
	/** The issue-tracker URL. */
	url: S.optionalKey(S.String).annotateKey({ description: "The issue-tracker URL." }),
	/** The address to mail instead of, or alongside, filing an issue. */
	email: S.optionalKey(S.String).annotateKey({ description: "The address to mail instead of, or alongside, filing an issue." }),
	/** Keys outside the documented set, preserved so encoding does not drop them. */
	rest: S.optionalKey(S.Record(S.String, S.Unknown)).annotateKey({ description: "Keys outside the documented set, preserved so encoding does not drop them." }),
}, $I.annote("Bugs", { description: "Where to report problems with a package." })) {
	/** The `bugs` field: a URL string or the object form. */
	static readonly FromValue: S.Codec<Bugs, string | { readonly [k: string]: unknown }> = S.Union([
		S.Record(S.String, S.Unknown),
		S.String,
	]).pipe(
		S.decodeTo(
			S.instanceOf(Bugs),
			SchemaTransformation.transform({
				decode: (input: string | { readonly [k: string]: unknown }): Bugs => {
					if (P.isString(input)) {
						const bugs = Bugs.make({ url: input });
						bugsWires.set(bugs, input);
						return bugs;
					}
					const rest: Record<string, unknown> = {};
					for (const [key, value] of R.toEntries(input)) {
						if (!KNOWN_BUGS_KEYS.has(key)) rest[key] = value;
					}
					const bugs = Bugs.make({
						...(P.isString(input.url) && { url: input.url }),
						...(P.isString(input.email) && { email: input.email }),
						...(R.keys(rest).length > 0 && { rest }),
					});
					bugsWires.set(bugs, input);
					return bugs;
				},
				encode: (bugs: Bugs): string | { readonly [k: string]: unknown } => {
					const wire = bugsWires.get(bugs);
					if (P.isString(wire) && wire === bugs.url && isStringExpressibleBugs(bugs)) return wire;
					if (wire !== undefined && !P.isString(wire) && isFaithfulBugs(wire, bugs)) return wire;
					return {
						...(bugs.url !== undefined && { url: bugs.url }),
						...(bugs.email !== undefined && { email: bugs.email }),
						...bugs.rest,
					};
				},
			}),
		),
	);
}
