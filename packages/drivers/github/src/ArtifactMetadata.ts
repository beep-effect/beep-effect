/**
 * Organization artifact storage records through GitHub's REST API.
 *
 * **Details**
 *
 * Records where a published artifact is stored, keyed by its package URL and
 * digest. The endpoint is organization-scoped; the organization comes from the
 * `Repo` owner on each call.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GithubId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import { unstubbedFor } from "@beep/utils/TestDouble";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { GitHubClient } from "./GitHubClient.ts";
import { Repo } from "./Repo.ts";
import type { GitHubError } from "./GitHubError.ts";

const $I = $GithubId.create("ArtifactMetadata");

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
 * import { StorageRecordInput } from "@beep/github/ArtifactMetadata";
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
export class StorageRecordInput extends S.Opaque<StorageRecordInput, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * The artifact's package URL (purl).
     *
     * @since 0.0.0
     */
    name: S.NonEmptyString.pipe(
      $I.annoteKey("StorageRecordInput.name", { description: "The artifact's package URL (purl)." })
    ),
    /**
     * Its content digest, as `algorithm:hex`.
     *
     * @since 0.0.0
     */
    digest: S.NonEmptyString.pipe(
      $I.annoteKey("StorageRecordInput.digest", { description: "Its content digest, as `algorithm:hex`." })
    ),
    /**
     * The registry's base URL.
     *
     * @since 0.0.0
     */
    registryUrl: S.NonEmptyString.pipe(
      $I.annoteKey("StorageRecordInput.registryUrl", { description: "The registry's base URL." })
    ),
    /**
     * The repository name **within the registry**.
     *
     * @since 0.0.0
     */
    repository: S.NonEmptyString.pipe(
      $I.annoteKey("StorageRecordInput.repository", { description: "The repository name **within the registry**." })
    ),
    /**
     * Where the artifact is stored, when there is a direct URL.
     *
     * @since 0.0.0
     */
    artifactUrl: S.optionalKey(S.String).pipe(
      $I.annoteKey("StorageRecordInput.artifactUrl", {
        description: "Where the artifact is stored, when there is a direct URL.",
      })
    ),
    /**
     * The artifact's path within the registry, when there is one.
     *
     * @since 0.0.0
     */
    path: S.optionalKey(S.String).pipe(
      $I.annoteKey("StorageRecordInput.path", {
        description: "The artifact's path within the registry, when there is one.",
      })
    ),
  }).pipe($I.annoteSchema("StorageRecordInput", { description: "What to record about a published artifact." }))
) {}

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
 * import { ArtifactMetadata, StorageRecordInput } from "@beep/github/ArtifactMetadata";
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
export class ArtifactMetadata extends Context.Service<ArtifactMetadata, ArtifactMetadataShape>()($I`ArtifactMetadata`) {
  /**
   * The live service, built over a `GitHubClient`.
   *
   * **Example** (Build the live ArtifactMetadata layer)
   *
   * ```ts
   * import { ArtifactMetadata } from "@beep/github/ArtifactMetadata";
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
    Effect.map(GitHubClient, (client) => make(client))
  );

  /**
   * An in-memory double; unstubbed members die naming themselves.
   *
   * **Example** (Stub ArtifactMetadata operations)
   *
   * ```ts
   * import { ArtifactMetadata } from "@beep/github/ArtifactMetadata";
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
   * import { ArtifactMetadata } from "@beep/github/ArtifactMetadata";
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

const unstubbed = unstubbedFor({ service: "ArtifactMetadata" });

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
    return A.flatMap(stored.storage_records ?? [], (record) => (P.isNumber(record.id) ? [record.id] : []));
  }),
});
