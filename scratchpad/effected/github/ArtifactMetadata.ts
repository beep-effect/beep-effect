import { $ScratchpadId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { GitHubClient } from "./GitHubClient.ts";
import type { GitHubError } from "./GitHubError.ts";
import { Repo } from "./Repo.ts";
import * as P from "effect/Predicate";
import * as O from "@beep/utils/Option";

const $I = $ScratchpadId.create("effected/github/ArtifactMetadata");

class UnstubbedError extends S.TaggedError<UnstubbedError>($I`UnstubbedError`)("UnstubbedError", {
	message: S.String,
}, $I.annote("UnstubbedError", { description: "An unconfigured test-double member was called." })) {}

/**
 * Describes where a published artifact is stored for GitHub's storage-record endpoint.
 *
 * **Details**
 *
 * These are the fields the storage-record endpoint accepts.
 *
 * **Example** (Construct an artifact storage record)
 *
 * ```ts
 * import { StorageRecordInput } from "@beep/scratchpad/effected/github/ArtifactMetadata";
 *
 * const input = StorageRecordInput.make({
 *   name: "pkg:npm/example@1.0.0",
 *   digest: "sha256:abc123",
 *   registryUrl: "https://registry.npmjs.org",
 *   repository: "example",
 * });
 * console.log(input.digest) // sha256:abc123
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class StorageRecordInput extends S.Class<StorageRecordInput>($I`StorageRecordInput`)({
	/**
	 * The artifact's package URL (purl).
	 *
	 * @since 0.0.0
	 */
	name: S.NonEmptyString.annotateKey({ description: "The artifact's package URL (purl)." }),
	/**
	 * Its content digest, as `algorithm:hex`.
	 *
	 * @since 0.0.0
	 */
	digest: S.NonEmptyString.annotateKey({ description: "Its content digest, as `algorithm:hex`." }),
	/**
	 * The registry's base URL.
	 *
	 * @since 0.0.0
	 */
	registryUrl: S.NonEmptyString.annotateKey({ description: "The registry's base URL." }),
	/**
	 * The repository name **within the registry**.
	 *
	 * @since 0.0.0
	 */
	repository: S.NonEmptyString.annotateKey({ description: "The repository name **within the registry**." }),
	/**
	 * Where the artifact is stored, when there is a direct URL.
	 *
	 * @since 0.0.0
	 */
	artifactUrl: S.optionalKey(S.String).annotateKey({ description: "Where the artifact is stored, when there is a direct URL." }),
	/**
	 * The artifact's path within the registry, when there is one.
	 *
	 * @since 0.0.0
	 */
	path: S.optionalKey(S.String).annotateKey({ description: "The artifact's path within the registry, when there is one." }),
}, $I.annote("StorageRecordInput", { description: "What to record about a published artifact." })) {}

/**
 * Organization-level artifact metadata.
 *
 * **Details**
 *
 * The endpoint is org-scoped rather than repository-scoped, but the
 * organization is resolved from {@link Repo}'s `owner` per call like every
 * other resource. `Repo.provide` covers the cross-org case, exactly as it
 * covers the cross-repository one.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface ArtifactMetadataShape {
	/**
	 * Record where a published artifact lives; returns the ids GitHub stored.
	 *
	 * @since 0.0.0
	 */
	readonly createStorageRecord: (input: StorageRecordInput) => Effect.Effect<ReadonlyArray<number>, GitHubError, Repo>;
}

/**
 * Records where published artifacts are stored, at the organization level.
 *
 * **Details**
 *
 * Provide it with {@link ArtifactMetadata.layer}, which needs a `GitHubClient`;
 * `createStorageRecord` also needs a `Repo` in `R`.
 *
 * **Example** (Compose the ArtifactMetadata service)
 *
 * ```ts
 * import { ArtifactMetadata, StorageRecordInput } from "@beep/scratchpad/effected/github/ArtifactMetadata";
 * import * as Effect from "effect/Effect";
 *
 * const input = StorageRecordInput.make({
 *   name: "pkg:npm/example@1.0.0", digest: "sha256:abc123",
 *   registryUrl: "https://registry.npmjs.org", repository: "example",
 * });
 * const program = Effect.flatMap(ArtifactMetadata, (service) => service.createStorageRecord(input));
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class ArtifactMetadata extends Context.Service<ArtifactMetadata, ArtifactMetadataShape>()(
	$I`ArtifactMetadata`,
) {
	/**
	 * The live service, built over a `GitHubClient`.
	 *
	 * **Example** (Build the live ArtifactMetadata layer)
	 *
	 * ```ts
	 * import { ArtifactMetadata } from "@beep/scratchpad/effected/github/ArtifactMetadata";
	 * import * as Layer from "effect/Layer";
	 *
	 * console.log(Layer.isLayer(ArtifactMetadata.layer)) // true
	 * ```
	 *
	 * @category layers
	 * @since 0.0.0
	 */
	static readonly layer: Layer.Layer<ArtifactMetadata, never, GitHubClient> = Layer.effect(
		this,
		Effect.map(GitHubClient, (client) => make(client)),
	);

	/**
	 * An in-memory double; unstubbed members die naming themselves.
	 *
	 * **Example** (Stub ArtifactMetadata operations)
	 *
	 * ```ts
	 * import { ArtifactMetadata } from "@beep/scratchpad/effected/github/ArtifactMetadata";
	 * import * as Effect from "effect/Effect";
	 *
	 * const service = ArtifactMetadata.makeTest({
	 *   createStorageRecord: () => Effect.succeed([]),
	 * });
	 * console.log(typeof service.createStorageRecord) // function
	 * ```
	 *
	 * @category testing
	 * @since 0.0.0
	 */
	static readonly makeTest = (overrides: Partial<ArtifactMetadataShape> = {}): ArtifactMetadataShape => ({
		createStorageRecord: overrides.createStorageRecord ?? (() => unstubbed("createStorageRecord")),
	});

	/**
	 * {@link ArtifactMetadata.makeTest} behind a `Layer`.
	 *
	 * **Example** (Provide a ArtifactMetadata test layer)
	 *
	 * ```ts
	 * import { ArtifactMetadata } from "@beep/scratchpad/effected/github/ArtifactMetadata";
	 * import * as Layer from "effect/Layer";
	 *
	 * console.log(Layer.isLayer(ArtifactMetadata.layerTest())) // true
	 * ```
	 *
	 * @category layers
	 * @since 0.0.0
	 */
	static readonly layerTest = (overrides: Partial<ArtifactMetadataShape> = {}): Layer.Layer<ArtifactMetadata> =>
		Layer.succeed(ArtifactMetadata, ArtifactMetadata.makeTest(overrides));
}

const unstubbed = (member: string): never => {
	throw UnstubbedError.make({ message: `ArtifactMetadata.makeTest: ${member}() was called but not stubbed — pass an override.` });
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
			...O.getSomesStruct({ artifact_url: O.fromUndefinedOr(input.artifactUrl) }),
			...O.getSomesStruct({ path: O.fromUndefinedOr(input.path) }),
		});
		return (stored.storage_records ?? []).flatMap((record) => (P.isNumber(record.id) ? [record.id] : []));
	}),
});
