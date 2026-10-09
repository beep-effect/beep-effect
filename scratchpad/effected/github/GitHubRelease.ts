import { $ScratchpadId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "@beep/utils/Option";
import * as S from "effect/Schema";
import { GitHubClient } from "./GitHubClient.ts";
import { GitHubError } from "./GitHubError.ts";
import { Repo } from "./Repo.ts";
import type { PageOptions } from "./Rest.ts";

const $I = $ScratchpadId.create("effected/github/GitHubRelease");

class UnstubbedError extends S.TaggedError<UnstubbedError>($I`UnstubbedError`)("UnstubbedError", {
	message: S.String,
}, $I.annote("UnstubbedError", { description: "An unconfigured test-double member was called." })) {}

/**
 * A release, projected to the fields callers read.
 *
 * @public
 */
export class ReleaseInfo extends S.Class<ReleaseInfo>($I`ReleaseInfo`)({
	id: S.Int.annotateKey({ description: "GitHub's identifier for updating the release and uploading or listing its assets" }),
	tag: S.String.annotateKey({ description: "The Git tag associated with the release, used to look it up" }),
	name: S.String.annotateKey({ description: "The release's display heading, or an empty string when GitHub leaves it unset" }),
	body: S.String.annotateKey({ description: "The release's description, or an empty string when GitHub leaves it unset" }),
	draft: S.Boolean.annotateKey({ description: "Whether GitHub marks the release as a draft" }),
	prerelease: S.Boolean.annotateKey({ description: "Whether GitHub marks the release as a prerelease" }),
	/** The web URL. */
	url: S.String.annotateKey({ description: "The web URL." }),
	/** The templated upload endpoint GitHub hands back for assets. */
	uploadUrl: S.String.annotateKey({ description: "The templated upload endpoint GitHub hands back for assets." }),
}, $I.annote("ReleaseInfo", { description: "A release, projected to the fields callers read." })) {}

/**
 * A file attached to a release.
 *
 * @public
 */
export class ReleaseAsset extends S.Class<ReleaseAsset>($I`ReleaseAsset`)({
	id: S.Int.annotateKey({ description: "GitHub's identifier for the file attached to the release" }),
	name: S.String.annotateKey({ description: "The attached file's filename as reported by GitHub" }),
	/** The browser download URL. */
	url: S.String.annotateKey({ description: "The browser download URL." }),
	/** Size in bytes. */
	size: S.Int.annotateKey({ description: "Size in bytes." }),
}, $I.annote("ReleaseAsset", { description: "A file attached to a release." })) {}

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
	readonly getByTagOption: (tag: string) => Effect.Effect<O.Option<ReleaseInfo>, GitHubError, Repo>;
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
  * **Gotchas**
  *
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
 * **Details**
 *
 * Provide it with {@link GitHubRelease.layer}, which needs a `GitHubClient`;
 * each method also needs a `Repo` in `R`.
 *
 * **Example** (Create a release with generated notes)
 *
 * ```ts
 * import { GitHubRelease } from "./index.ts";
 * import * as Effect from "effect/Effect";
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
	$I`GitHubRelease`,
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
	throw UnstubbedError.make({ message: `GitHubRelease.makeTest: ${member}() was called but not stubbed — pass an override.` });
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

const AssetResponse = S.Struct({
	id: S.Int,
	name: S.String,
	browser_download_url: S.String,
	size: S.Int,
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
				...O.getSomesStruct({ name: O.fromUndefinedOr(input.name) }),
				...O.getSomesStruct({ body: O.fromUndefinedOr(input.body) }),
				...O.getSomesStruct({ draft: O.fromUndefinedOr(input.draft) }),
				...O.getSomesStruct({ prerelease: O.fromUndefinedOr(input.prerelease) }),
				...O.getSomesStruct({ generate_release_notes: O.fromUndefinedOr(input.generateReleaseNotes) }),
			});
			return project(created);
		}),

		getByTagOption: Effect.fn("GitHubRelease.getByTagOption")(function* (tag: string) {
			return yield* getByTag(tag).pipe(
				Effect.asSome,
				Effect.catchIf(GitHubError.hasKind("notFound"), () => Effect.succeed(O.none<ReleaseInfo>())),
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
				...O.getSomesStruct({ name: O.fromUndefinedOr(patch.name) }),
				...O.getSomesStruct({ body: O.fromUndefinedOr(patch.body) }),
				...O.getSomesStruct({ draft: O.fromUndefinedOr(patch.draft) }),
				...O.getSomesStruct({ prerelease: O.fromUndefinedOr(patch.prerelease) }),
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
					...O.getSomesStruct({ label: O.fromUndefinedOr(asset.label) }),
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
