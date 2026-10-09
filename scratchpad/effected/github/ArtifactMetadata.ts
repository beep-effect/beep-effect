import { Context, Effect, Layer, Schema } from "effect";
import { GitHubClient } from "./GitHubClient.ts";
import type { GitHubError } from "./GitHubError.ts";
import { Repo } from "./Repo.ts";

/**
 * What to record about a published artifact.
 *
 * @remarks
 * These are the fields the storage-record endpoint accepts.
 *
 * @public
 */
export class StorageRecordInput extends Schema.Class<StorageRecordInput>("StorageRecordInput")({
	/** The artifact's package URL (purl). */
	name: Schema.NonEmptyString,
	/** Its content digest, as `algorithm:hex`. */
	digest: Schema.NonEmptyString,
	/** The registry's base URL. */
	registryUrl: Schema.NonEmptyString,
	/** The repository name **within the registry**. */
	repository: Schema.NonEmptyString,
	/** Where the artifact is stored, when there is a direct URL. */
	artifactUrl: Schema.optionalKey(Schema.String),
	/** The artifact's path within the registry, when there is one. */
	path: Schema.optionalKey(Schema.String),
}) {}

/**
 * Organization-level artifact metadata.
 *
 * @remarks
 * The endpoint is org-scoped rather than repository-scoped, but the
 * organization is resolved from {@link Repo}'s `owner` per call like every
 * other resource. `Repo.provide` covers the cross-org case, exactly as it
 * covers the cross-repository one.
 *
 * @public
 */
export interface ArtifactMetadataShape {
	/** Record where a published artifact lives; returns the ids GitHub stored. */
	readonly createStorageRecord: (input: StorageRecordInput) => Effect.Effect<ReadonlyArray<number>, GitHubError, Repo>;
}

/**
 * Records where published artifacts are stored, at the organization level.
 *
 * @remarks
 * Provide it with {@link ArtifactMetadata.layer}, which needs a `GitHubClient`;
 * `createStorageRecord` also needs a `Repo` in `R`.
 *
 * @public
 */
export class ArtifactMetadata extends Context.Service<ArtifactMetadata, ArtifactMetadataShape>()(
	"@effected/github/ArtifactMetadata",
) {
	/** The live service, built over a `GitHubClient`. */
	static readonly layer: Layer.Layer<ArtifactMetadata, never, GitHubClient> = Layer.effect(
		this,
		Effect.map(GitHubClient, (client) => make(client)),
	);

	/** An in-memory double; unstubbed members die naming themselves. */
	static readonly makeTest = (overrides: Partial<ArtifactMetadataShape> = {}): ArtifactMetadataShape => ({
		createStorageRecord: overrides.createStorageRecord ?? (() => unstubbed("createStorageRecord")),
	});

	/** {@link ArtifactMetadata.makeTest} behind a `Layer`. */
	static readonly layerTest = (overrides: Partial<ArtifactMetadataShape> = {}): Layer.Layer<ArtifactMetadata> =>
		Layer.succeed(ArtifactMetadata, ArtifactMetadata.makeTest(overrides));
}

const unstubbed = (member: string): never => {
	throw new Error(`ArtifactMetadata.makeTest: ${member}() was called but not stubbed — pass an override.`);
};

const make = (client: GitHubClient["Service"]): ArtifactMetadataShape => ({
	createStorageRecord: Effect.fn("ArtifactMetadata.createStorageRecord")(function* (input: StorageRecordInput) {
		const { owner } = yield* Repo;
		yield* Effect.annotateCurrentSpan({ org: owner, artifact: input.name });
		// The route is in GitHub's OpenAPI description, so this is a typed call.
		const stored = yield* client.request("POST /orgs/{org}/artifacts/metadata/storage-record", {
			org: owner,
			name: input.name,
			digest: input.digest,
			registry_url: input.registryUrl,
			repository: input.repository,
			...(input.artifactUrl !== undefined ? { artifact_url: input.artifactUrl } : {}),
			...(input.path !== undefined ? { path: input.path } : {}),
		});
		return (stored.storage_records ?? []).flatMap((record) => (typeof record.id === "number" ? [record.id] : []));
	}),
});
