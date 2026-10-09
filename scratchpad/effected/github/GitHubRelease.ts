import { Context, Effect, Layer, Option, Schema } from "effect";
import { GitHubClient } from "./GitHubClient.ts";
import { GitHubError } from "./GitHubError.ts";
import { Repo } from "./Repo.ts";
import type { PageOptions } from "./Rest.ts";

/**
 * A release, projected to the fields callers read.
 *
 * @public
 */
export class ReleaseInfo extends Schema.Class<ReleaseInfo>("ReleaseInfo")({
	id: Schema.Int,
	tag: Schema.String,
	name: Schema.String,
	body: Schema.String,
	draft: Schema.Boolean,
	prerelease: Schema.Boolean,
	/** The web URL. */
	url: Schema.String,
	/** The templated upload endpoint GitHub hands back for assets. */
	uploadUrl: Schema.String,
}) {}

/**
 * A file attached to a release.
 *
 * @public
 */
export class ReleaseAsset extends Schema.Class<ReleaseAsset>("ReleaseAsset")({
	id: Schema.Int,
	name: Schema.String,
	/** The browser download URL. */
	url: Schema.String,
	/** Size in bytes. */
	size: Schema.Int,
}) {}

/**
 * Create, read, list and update releases, and upload and list their assets.
 *
 * @public
 */
export interface GitHubReleaseShape {
	/** Create a release for `tag`. Unset fields are left to GitHub's defaults. */
	readonly create: (input: {
		readonly tag: string;
		readonly name?: string | undefined;
		readonly body?: string | undefined;
		readonly draft?: boolean | undefined;
		readonly prerelease?: boolean | undefined;
		readonly generateReleaseNotes?: boolean | undefined;
	}) => Effect.Effect<ReleaseInfo, GitHubError, Repo>;
	/** Read the release for `tag`. Fails `notFound` when there is none. */
	readonly getByTag: (tag: string) => Effect.Effect<ReleaseInfo, GitHubError, Repo>;
	/** As {@link GitHubReleaseShape.getByTag}, with absence as `Option.none`. */
	readonly getByTagOption: (tag: string) => Effect.Effect<Option.Option<ReleaseInfo>, GitHubError, Repo>;
	/** List releases, paginated. */
	readonly list: (options?: {
		readonly page?: PageOptions | undefined;
	}) => Effect.Effect<ReadonlyArray<ReleaseInfo>, GitHubError, Repo>;
	/** Patch a release by id; only the fields given are sent. */
	readonly update: (
		id: number,
		patch: {
			readonly name?: string | undefined;
			readonly body?: string | undefined;
			readonly draft?: boolean | undefined;
			readonly prerelease?: boolean | undefined;
		},
	) => Effect.Effect<ReleaseInfo, GitHubError, Repo>;
	/**
	 * Attach a file to a release.
	 *
	 * @remarks
	 * The one route in this package that is **not** in GitHub's generated
	 * endpoint map: asset upload goes to `uploads.github.com` with a raw binary
	 * body, and the map omits it. So it goes through `requestDecoded` with an
	 * owned schema — the escape hatch is from the route table, never from typing.
	 *
	 * Being outside the map cuts the other way too: octokit has no schema
	 * saying `name` is a **query** parameter, so the route template must carry
	 * it (`assets{?name}`) or octokit silently drops it and GitHub answers 400
	 * `Invalid name for request` — a hand-written route owns its query
	 * parameters in the template, always. `label` is the endpoint's optional
	 * display label, shown in place of the file name on the release page.
	 */
	readonly uploadAsset: (
		release: ReleaseInfo,
		asset: {
			readonly name: string;
			readonly data: Uint8Array | string;
			readonly contentType: string;
			readonly label?: string | undefined;
		},
	) => Effect.Effect<ReleaseAsset, GitHubError, Repo>;
	/** List a release's assets, paginated. */
	readonly listAssets: (
		id: number,
		options?: { readonly page?: PageOptions | undefined },
	) => Effect.Effect<ReadonlyArray<ReleaseAsset>, GitHubError, Repo>;
}

/**
 * Create, read, list and update GitHub releases, and upload and list their
 * assets.
 *
 * @remarks
 * Provide it with {@link GitHubRelease.layer}, which needs a `GitHubClient`;
 * each method also needs a `Repo` in `R`.
 *
 * @example
 * ```ts
 * import { GitHubRelease } from "./index.ts";
 * import { Effect } from "effect";
 *
 * const publish = Effect.gen(function* () {
 *   const releases = yield* GitHubRelease;
 *   const release = yield* releases.create({ tag: "v1.2.3", generateReleaseNotes: true });
 *   return release.url;
 * });
 * ```
 *
 * @public
 */
export class GitHubRelease extends Context.Service<GitHubRelease, GitHubReleaseShape>()(
	"@beep/scratchpad/effected/github/GitHubRelease",
) {
	/** The live service, built over a `GitHubClient`. */
	static readonly layer: Layer.Layer<GitHubRelease, never, GitHubClient> = Layer.effect(
		this,
		Effect.map(GitHubClient, (client) => make(client)),
	);

	/** An in-memory double; unstubbed members die naming themselves. */
	static readonly makeTest = (overrides: Partial<GitHubReleaseShape> = {}): GitHubReleaseShape => ({
		create: overrides.create ?? (() => unstubbed("create")),
		getByTag: overrides.getByTag ?? (() => unstubbed("getByTag")),
		getByTagOption: overrides.getByTagOption ?? (() => unstubbed("getByTagOption")),
		list: overrides.list ?? (() => unstubbed("list")),
		update: overrides.update ?? (() => unstubbed("update")),
		uploadAsset: overrides.uploadAsset ?? (() => unstubbed("uploadAsset")),
		listAssets: overrides.listAssets ?? (() => unstubbed("listAssets")),
	});

	/** {@link GitHubRelease.makeTest} behind a `Layer`. */
	static readonly layerTest = (overrides: Partial<GitHubReleaseShape> = {}): Layer.Layer<GitHubRelease> =>
		Layer.succeed(GitHubRelease, GitHubRelease.makeTest(overrides));
}

const unstubbed = (member: string): never => {
	throw new Error(`GitHubRelease.makeTest: ${member}() was called but not stubbed — pass an override.`);
};

interface RawRelease {
	readonly id: number;
	readonly tag_name: string;
	readonly name?: string | null | undefined;
	readonly body?: string | null | undefined;
	readonly draft: boolean;
	readonly prerelease: boolean;
	readonly html_url: string;
	readonly upload_url: string;
}

const project = (raw: RawRelease): ReleaseInfo =>
	ReleaseInfo.make({
		id: raw.id,
		tag: raw.tag_name,
		// GitHub sends null for an unset name or body; the empty string is what
		// every caller does with it anyway.
		name: raw.name ?? "",
		body: raw.body ?? "",
		draft: raw.draft,
		prerelease: raw.prerelease,
		url: raw.html_url,
		uploadUrl: raw.upload_url,
	});

const AssetResponse = Schema.Struct({
	id: Schema.Int,
	name: Schema.String,
	browser_download_url: Schema.String,
	size: Schema.Int,
});

const assetOf = (raw: { id: number; name: string; browser_download_url: string; size: number }): ReleaseAsset =>
	ReleaseAsset.make({ id: raw.id, name: raw.name, url: raw.browser_download_url, size: raw.size });

const make = (client: GitHubClient["Service"]): GitHubReleaseShape => {
	const getByTag = Effect.fn("GitHubRelease.getByTag")(function* (tag: string) {
		const { owner, repo } = yield* Repo;
		yield* Effect.annotateCurrentSpan({ owner, repo, tag });
		const raw = yield* client.request("GET /repos/{owner}/{repo}/releases/tags/{tag}", { owner, repo, tag });
		return project(raw);
	});

	return {
		getByTag,

		create: Effect.fn("GitHubRelease.create")(function* (input: {
			readonly tag: string;
			readonly name?: string | undefined;
			readonly body?: string | undefined;
			readonly draft?: boolean | undefined;
			readonly prerelease?: boolean | undefined;
			readonly generateReleaseNotes?: boolean | undefined;
		}) {
			const { owner, repo } = yield* Repo;
			yield* Effect.annotateCurrentSpan({ owner, repo, tag: input.tag });
			const created = yield* client.request("POST /repos/{owner}/{repo}/releases", {
				owner,
				repo,
				tag_name: input.tag,
				...(input.name !== undefined ? { name: input.name } : {}),
				...(input.body !== undefined ? { body: input.body } : {}),
				...(input.draft !== undefined ? { draft: input.draft } : {}),
				...(input.prerelease !== undefined ? { prerelease: input.prerelease } : {}),
				...(input.generateReleaseNotes !== undefined ? { generate_release_notes: input.generateReleaseNotes } : {}),
			});
			return project(created);
		}),

		getByTagOption: Effect.fn("GitHubRelease.getByTagOption")(function* (tag: string) {
			return yield* getByTag(tag).pipe(
				Effect.asSome,
				Effect.catchIf(GitHubError.hasKind("notFound"), () => Effect.succeed(Option.none<ReleaseInfo>())),
			);
		}),

		list: Effect.fn("GitHubRelease.list")(function* (options?: { readonly page?: PageOptions | undefined }) {
			const { owner, repo } = yield* Repo;
			yield* Effect.annotateCurrentSpan({ owner, repo });
			const raw = yield* client.paginate("GET /repos/{owner}/{repo}/releases", { owner, repo }, options?.page);
			return raw.map(project);
		}),

		update: Effect.fn("GitHubRelease.update")(function* (
			id: number,
			patch: {
				readonly name?: string | undefined;
				readonly body?: string | undefined;
				readonly draft?: boolean | undefined;
				readonly prerelease?: boolean | undefined;
			},
		) {
			const { owner, repo } = yield* Repo;
			yield* Effect.annotateCurrentSpan({ owner, repo, id });
			const updated = yield* client.request("PATCH /repos/{owner}/{repo}/releases/{release_id}", {
				owner,
				repo,
				release_id: id,
				...(patch.name !== undefined ? { name: patch.name } : {}),
				...(patch.body !== undefined ? { body: patch.body } : {}),
				...(patch.draft !== undefined ? { draft: patch.draft } : {}),
				...(patch.prerelease !== undefined ? { prerelease: patch.prerelease } : {}),
			});
			return project(updated);
		}),

		uploadAsset: Effect.fn("GitHubRelease.uploadAsset")(function* (
			release: ReleaseInfo,
			asset: {
				readonly name: string;
				readonly data: Uint8Array | string;
				readonly contentType: string;
				readonly label?: string | undefined;
			},
		) {
			const { owner, repo } = yield* Repo;
			yield* Effect.annotateCurrentSpan({ owner, repo, release: release.id, asset: asset.name });
			// `name` MUST be in the template: this route is outside the generated
			// endpoint map, so no schema routes it to the query string — passed
			// only as a parameter it is silently dropped and GitHub answers 400
			// "Invalid name for request". The two
			// template spellings exist because `{?name,label}` with an absent
			// label expands to a dangling `&` (probed at @octokit/endpoint 11.0.3).
			const raw = yield* client.requestDecoded(
				asset.label === undefined
					? "POST /repos/{owner}/{repo}/releases/{release_id}/assets{?name}"
					: "POST /repos/{owner}/{repo}/releases/{release_id}/assets{?name,label}",
				{
					owner,
					repo,
					release_id: release.id,
					name: asset.name,
					...(asset.label === undefined ? {} : { label: asset.label }),
					data: asset.data,
					baseUrl: UPLOADS_BASE_URL,
					headers: { "content-type": asset.contentType },
				},
				AssetResponse,
			);
			return assetOf(raw);
		}),

		listAssets: Effect.fn("GitHubRelease.listAssets")(function* (
			id: number,
			options?: { readonly page?: PageOptions | undefined },
		) {
			const { owner, repo } = yield* Repo;
			yield* Effect.annotateCurrentSpan({ owner, repo, id });
			// Paginated, and the caller's budget is forwarded.
			const raw = yield* client.paginate(
				"GET /repos/{owner}/{repo}/releases/{release_id}/assets",
				{ owner, repo, release_id: id },
				options?.page,
			);
			return raw.map(assetOf);
		}),
	};
};

/** Release assets do not go to the API host. */
const UPLOADS_BASE_URL = "https://uploads.github.com";
