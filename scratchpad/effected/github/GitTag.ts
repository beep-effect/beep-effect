import { $ScratchpadId } from "@beep/identity/packages";
import { SemVer } from "../semver/index.ts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { GitHubClient } from "./GitHubClient.ts";
import { GitHubError } from "./GitHubError.ts";
import { Repo } from "./Repo.ts";
import type { PageOptions } from "./Rest.ts";

const $I = $ScratchpadId.create("effected/github/GitTag");

/** How many annotated-tag dereferences to follow before giving up. */
const MAX_TAG_PEEL = 5;

/**
 * A tag and the commit it ultimately points at.
 *
 * @public
 */
export class TagRef extends S.Class<TagRef>($I`TagRef`)({
	/** The tag name, without `refs/tags/`. */
	tag: S.NonEmptyString.annotateKey({ description: "The tag name, without `refs/tags/`." }),
	/** The **commit** sha, with annotated tags already dereferenced. */
	sha: S.String.annotateKey({ description: "The **commit** sha, with annotated tags already dereferenced." }),
}, $I.annote("TagRef", { description: "A tag and the commit it ultimately points at." })) {}

/**
 * A tag whose name carries a version.
 *
 * @public
 */
export class SemverTag extends S.Class<SemverTag>($I`SemverTag`)({
	/** The tag name as GitHub has it. */
	tag: S.NonEmptyString.annotateKey({ description: "The tag name as GitHub has it." }),
	/** The commit sha. */
	sha: S.String.annotateKey({ description: "The commit sha." }),
	/** The version read out of the name. */
	version: SemVer.annotateKey({ description: "The version read out of the name." }),
}, $I.annote("SemverTag", { description: "A tag whose name carries a version." })) {}

/**
 * Read a version out of a tag name.
 *
 * @remarks
 * The default covers the three shapes `@effected/workspaces`' `ReleaseTag`
 * produces: `v1.2.3`, `pkg@v1.2.3` and
 * `@scope/pkg@1.2.3`. Taking the substring after the **last** `@` is what makes
 * the scoped form work, since the scope itself contains one.
 *
 * @public
 */
export type VersionFromTag = (tag: string) => O.Option<string>;

/** The default {@link VersionFromTag}. @public */
export const versionFromTag: VersionFromTag = (tag) => {
	const at = tag.lastIndexOf("@");
	const candidate = at > 0 ? tag.slice(at + 1) : tag;
	const stripped = candidate.startsWith("v") ? candidate.slice(1) : candidate;
	return stripped === "" ? O.none() : O.some(stripped);
};

/**
 * How to pick the newest version-shaped tag.
 *
 * @public
 */
export interface LatestSemverOptions {
	/** Only consider tags starting with this. */
	readonly prefix?: string | undefined;
	/** Consider prereleases too. Off by default: `1.0.0-rc.1` is not the latest release. */
	readonly includePrerelease?: boolean | undefined;
	/** Override the tag-name → version convention. */
	readonly extract?: VersionFromTag | undefined;
	/** How far to walk. */
	readonly page?: PageOptions | undefined;
}

/**
 * Tag refs in GitHub's Git Database API.
 *
 * @public
 */
export interface GitTagShape {
	/** Create a tag ref at `sha`. Fails `alreadyExists` when it is already there. */
	readonly create: (tag: string, sha: string) => Effect.Effect<void, GitHubError, Repo>;
	/** Point `tag` at `sha`, creating it if needed. */
	readonly upsert: (tag: string, sha: string) => Effect.Effect<void, GitHubError, Repo>;
	/** Delete the tag ref. */
	readonly delete: (tag: string) => Effect.Effect<void, GitHubError, Repo>;
	/** Every tag, in GitHub's order. `prefix` filters client-side. */
	readonly list: (options?: {
		readonly prefix?: string | undefined;
		readonly page?: PageOptions | undefined;
	}) => Effect.Effect<ReadonlyArray<TagRef>, GitHubError, Repo>;
	/**
	 * The commit a tag points at, dereferencing annotated tags.
	 *
	 * @remarks
	 * Fails typed past five levels of nesting rather than looping.
	 */
	readonly resolve: (tag: string) => Effect.Effect<string, GitHubError, Repo>;
	/**
	 * The newest version-shaped tag.
	 *
	 * @remarks
	 * Parsing and comparison are both synchronous in `@effected/semver`
	 * (`parseResult`, `compare`), so this is a single pass over the page stream
	 * with no extra round trips.
	 *
	 * **"Newest" means highest version, not most recent.** That is the right
	 * answer for a single-versioned repository and the wrong instrument for a
	 * **monorepo publishing independently versioned packages**, where version
	 * ordering and recency are unrelated: a `pkg-a@2.0.0` tag outranks a
	 * `pkg-b@1.4.0` cut yesterday, so the result can sit several releases behind
	 * the actual head and never move. Nothing about the failure is visible —
	 * a stale-but-plausible tag comes back. In a monorepo, filter by the
	 * package's tag prefix (see {@link LatestSemverOptions}) so the comparison
	 * runs within one version line, or order by tagged-commit date instead.
	 */
	readonly latestSemver: (options?: LatestSemverOptions) => Effect.Effect<O.Option<SemverTag>, GitHubError, Repo>;
}

/**
 * Create, move, resolve, list and delete tag refs through GitHub's Git Database
 * API, and find the newest version-shaped tag.
 *
 * @remarks
 * Provide it with {@link GitTag.layer}, which needs a `GitHubClient`; each
 * method also needs a `Repo` in `R`.
 *
 * @example
 * ```ts
 * import { GitTag } from "./index.ts";
 * import { Effect, Option } from "effect";
 *
 * const latest = Effect.gen(function* () {
 *   const tags = yield* GitTag;
 *   const newest = yield* tags.latestSemver({ prefix: "v" });
 *   return Option.map(newest, (tag) => tag.version.toString());
 * });
 * ```
 *
 * @public
 */
export class GitTag extends Context.Service<GitTag, GitTagShape>()($I`GitTag`) {
	/** The live service, built over a `GitHubClient`. */
	static readonly layer: Layer.Layer<GitTag, never, GitHubClient> = Layer.effect(
		this,
		Effect.map(GitHubClient, (client) => make(client)),
	);

	/** An in-memory double; unstubbed members die naming themselves. */
	static readonly makeTest = (overrides: Partial<GitTagShape> = {}): GitTagShape => ({
		create: overrides.create ?? (() => unstubbed("create")),
		upsert: overrides.upsert ?? (() => unstubbed("upsert")),
		delete: overrides.delete ?? (() => unstubbed("delete")),
		list: overrides.list ?? (() => unstubbed("list")),
		resolve: overrides.resolve ?? (() => unstubbed("resolve")),
		latestSemver: overrides.latestSemver ?? (() => unstubbed("latestSemver")),
	});

	/** {@link GitTag.makeTest} behind a `Layer`. */
	static readonly layerTest = (overrides: Partial<GitTagShape> = {}): Layer.Layer<GitTag> =>
		Layer.succeed(GitTag, GitTag.makeTest(overrides));
}

const unstubbed = (member: string): never => {
	throw new Error(`GitTag.makeTest: ${member}() was called but not stubbed — pass an override.`);
};

const shortTag = (tag: string): string => tag.replace(/^refs\/tags\//, "").replace(/^tags\//, "");

const rejectEmpty = (operation: string, tag: string): Effect.Effect<string, GitHubError> => {
	const short = shortTag(tag).trim();
	return short === ""
		? Effect.fail(GitHubError.rejected(operation, 422, "a tag name is required"))
		: Effect.succeed(short);
};

const make = (client: GitHubClient["Service"]): GitTagShape => {
	const create = Effect.fn("GitTag.create")(function* (tag: string, sha: string) {
		const { owner, repo } = yield* Repo;
		const short = yield* rejectEmpty("GitTag.create", tag);
		yield* Effect.annotateCurrentSpan({ owner, repo, tag: short });
		yield* client.request("POST /repos/{owner}/{repo}/git/refs", {
			owner,
			repo,
			ref: `refs/tags/${short}`,
			sha,
		});
	});

	const reset = Effect.fn("reset")(function*(tag: string, sha: string) {
			const { owner, repo } = yield* Repo;
			yield* client.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
				owner,
				repo,
				ref: `tags/${tag}`,
				sha,
				force: true,
			});
		});

	const listStream = (options?: { readonly page?: PageOptions | undefined }) =>
		Stream.unwrap(
			Effect.map(Repo, ({ owner, repo }) =>
				client.paginateStream("GET /repos/{owner}/{repo}/tags", { owner, repo }, options?.page),
			),
		);

	const list = Effect.fn("GitTag.list")(function* (options?: {
		readonly prefix?: string | undefined;
		readonly page?: PageOptions | undefined;
	}) {
		const { owner, repo } = yield* Repo;
		yield* Effect.annotateCurrentSpan({ owner, repo, prefix: options?.prefix ?? "" });
		const tags = yield* Stream.runCollect(listStream(options));
		// GitHub has no server-side ref-prefix filter for this endpoint, so the
		// filter is client-side by necessity — which is exactly why latestSemver
		// exists rather than leaving callers to list-then-sort.
		const prefix = options?.prefix;
		return tags
			.filter((entry) => prefix === undefined || entry.name.startsWith(prefix))
			.map((entry) => TagRef.make({ tag: entry.name, sha: entry.commit.sha }));
	});

	return {
		create,
		upsert: Effect.fn("GitTag.upsert")(function* (tag: string, sha: string) {
			const short = yield* rejectEmpty("GitTag.upsert", tag);
			yield* Effect.annotateCurrentSpan({ tag: short });
			yield* create(short, sha).pipe(Effect.catchIf(GitHubError.hasKind("alreadyExists"), () => reset(short, sha)));
		}),
		delete: Effect.fn("GitTag.delete")(function* (tag: string) {
			const { owner, repo } = yield* Repo;
			const short = yield* rejectEmpty("GitTag.delete", tag);
			yield* Effect.annotateCurrentSpan({ owner, repo, tag: short });
			return yield* client.request("DELETE /repos/{owner}/{repo}/git/refs/{ref}", {
    owner,
    repo,
    ref: `tags/${short}`,
});
		}),
		list,
		resolve: Effect.fn("GitTag.resolve")(function* (tag: string) {
			const { owner, repo } = yield* Repo;
			const short = yield* rejectEmpty("GitTag.resolve", tag);
			yield* Effect.annotateCurrentSpan({ owner, repo, tag: short });
			const ref = yield* client.request("GET /repos/{owner}/{repo}/git/ref/{ref}", {
				owner,
				repo,
				ref: `tags/${short}`,
			});
			let sha = ref.object.sha;
			let type = ref.object.type;
			for (let peeled = 0; type === "tag"; peeled += 1) {
				if (peeled >= MAX_TAG_PEEL) {
					return yield*
						GitHubError.rejected("GitTag.resolve", 422, `tag ${short} nests deeper than ${MAX_TAG_PEEL} levels`);
				}
				const annotated = yield* client.request("GET /repos/{owner}/{repo}/git/tags/{tag_sha}", {
					owner,
					repo,
					tag_sha: sha,
				});
				sha = annotated.object.sha;
				type = annotated.object.type;
			}
			if (type !== "commit") {
				return yield* GitHubError.rejected("GitTag.resolve", 422, `tag ${short} points at a ${type}, not a commit`);
			}
			return sha;
		}),
		latestSemver: Effect.fn("GitTag.latestSemver")(function* (options?: LatestSemverOptions) {
			const { owner, repo } = yield* Repo;
			yield* Effect.annotateCurrentSpan({ owner, repo, prefix: options?.prefix ?? "" });
			const extract = options?.extract ?? versionFromTag;
			let best: SemverTag | undefined;
			// One pass, no Effect per candidate: parsing and comparison are both
			// synchronous in @effected/semver.
			yield* Stream.runForEach(listStream({ page: options?.page }), (entry) =>
				Effect.sync(() => {
					if (options?.prefix !== undefined && !entry.name.startsWith(options.prefix)) return;
					const raw = extract(entry.name);
					if (O.isNone(raw)) return;
					const parsed = SemVer.parseResult(raw.value);
					if (Result.isFailure(parsed)) return;
					const version = parsed.success;
					if (version.prerelease.length > 0 && options?.includePrerelease !== true) return;
					if (best === undefined || version.compare(best.version) === 1) {
						best = SemverTag.make({ tag: entry.name, sha: entry.commit.sha, version });
					}
				}),
			);
			return O.fromUndefinedOr(best);
		}),
	};
};
