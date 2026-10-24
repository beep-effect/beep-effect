/**
 * Artifact attestations through GitHub's REST API.
 *
 * **Details**
 *
 * Uploads a signed attestation bundle to a repository and lists what is
 * attested about a subject digest. Requests pin the `2026-03-10` API version and
 * decode responses with schemas owned by this module.
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
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GitHubClient } from "./GitHubClient.ts";
import { Repo } from "./Repo.ts";
import type { GitHubError } from "./GitHubError.ts";

const $I = $GithubId.create("Attestation");

/**
 * The api-version this surface pins.
 *
 * **Details**
 *
 * The legacy shape, which inlines the whole bundle in the listing, is deprecated
 * with a stated sunset. Pinning the version means the response is on a contract
 * the generated types do not describe — which is why this module is the one that
 * uses `requestDecoded` with owned schemas rather than the route table.
 *
 * @since 0.0.0
 */
const API_VERSION = "2026-03-10";

/**
 * Captures a stored attestation's identifier and human-facing URL.
 *
 * **Example** (Read a stored attestation URL)
 *
 * ```ts
 * import { AttestationRecord } from "@beep/github/Attestation";
 *
 * const record = AttestationRecord.make({ id: 42, url: "https://github.com/example/project/attestations/42" });
 * console.log(record.id) // 42
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class AttestationRecord extends S.Opaque<AttestationRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * GitHub's id for it, when the response carried one.
     *
     * @since 0.0.0
     */
    id: S.optionalKey(S.Int).pipe(
      $I.annoteKey("AttestationRecord.id", { description: "GitHub's id for it, when the response carried one." })
    ),
    /**
     * Where a human can look at it.
     *
     * @since 0.0.0
     */
    url: S.String.pipe($I.annoteKey("AttestationRecord.url", { description: "Where a human can look at it." })),
  }).pipe($I.annoteSchema("AttestationRecord", { description: "A stored attestation." }))
) {}

/**
 * Captures the bundle location and reported predicate type from an attestation listing.
 *
 * **Example** (Read a listed predicate type)
 *
 * ```ts
 * import { AttestationListEntry } from "@beep/github/Attestation";
 *
 * const entry = AttestationListEntry.make({
 *   url: "https://example.com/bundle",
 *   predicateType: "https://slsa.dev/provenance/v1",
 * });
 * console.log(entry.predicateType) // https://slsa.dev/provenance/v1
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class AttestationListEntry extends S.Opaque<AttestationListEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * Where the bundle lives.
     *
     * @since 0.0.0
     */
    url: S.String.pipe($I.annoteKey("AttestationListEntry.url", { description: "Where the bundle lives." })),
    /**
     * The in-toto predicate type, when the listing reported one.
     *
     * @since 0.0.0
     */
    predicateType: S.optionalKey(S.String).pipe(
      $I.annoteKey("AttestationListEntry.predicateType", {
        description: "The in-toto predicate type, when the listing reported one.",
      })
    ),
  }).pipe($I.annoteSchema("AttestationListEntry", { description: "One entry from an attestation listing." }))
) {}

const UploadResponse = S.Struct({ id: S.optionalKey(S.Int) });

const ListResponse = S.Struct({
  attestations: S.Struct({
    id: S.optionalKey(S.Int),
    bundle_url: S.optionalKey(S.String),
    predicate_type: S.optionalKey(S.String),
  }).pipe(S.Array, S.optionalKey),
});

/**
 * The attestation REST surface.
 *
 * **Details**
 *
 * Upload and listing only. Building a statement belongs to `@beep/sbom`, and
 * signing it into a bundle to the Sigstore signer (still in the effected lab);
 * assembling those into a pipeline belongs to the consumer.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface AttestationShape {
  /**
   * Everything attested about a subject digest.
   *
   * **Details**
   *
   * **404 and 422 both mean "none"**, not "broken" — GitHub answers a digest it
   * has never seen either way depending on the path, and a caller asking "is
   * this attested?" wants an empty list for both.
   *
   * @since 0.0.0
   */
  readonly listForSubject: {
    (
      sha256: string,
      options?: { readonly predicateType?: string | undefined }
    ): Effect.Effect<ReadonlyArray<AttestationListEntry>, GitHubError, Repo>;
    (options?: {
      readonly predicateType?: string | undefined;
    }): (sha256: string) => Effect.Effect<ReadonlyArray<AttestationListEntry>, GitHubError, Repo>;
  };
  /**
   * Store a signed bundle against the repository.
   *
   * @since 0.0.0
   */
  readonly upload: (bundle: unknown) => Effect.Effect<AttestationRecord, GitHubError, Repo>;
}

/**
 * Uploads signed attestation bundles to a repository and lists what is attested
 * about a subject digest.
 *
 * **Details**
 *
 * Provide it with {@link Attestation.layer}, which needs a `GitHubClient`; each
 * method also needs a `Repo` in `R`.
 *
 * **Example** (Compose the Attestation service)
 *
 * ```ts
 * import { Attestation } from "@beep/github/Attestation";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.flatMap(Attestation, (service) => service.listForSubject("abc123"));
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class Attestation extends Context.Service<Attestation, AttestationShape>()($I`Attestation`) {
  /**
   * The live service, built over a `GitHubClient`.
   *
   * **Example** (Build the live Attestation layer)
   *
   * ```ts
   * import { Attestation } from "@beep/github/Attestation";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(Attestation.layer)) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<Attestation, never, GitHubClient> = Layer.effect(
    this,
    Effect.map(GitHubClient, (client) => make(client))
  );

  /**
   * An in-memory double; unstubbed members die naming themselves.
   *
   * **Example** (Stub Attestation operations)
   *
   * ```ts
   * import { Attestation } from "@beep/github/Attestation";
   * import * as Effect from "effect/Effect";
   * import { dual } from "effect/Function";
   * import * as P from "effect/Predicate";
   *
   * const service = Attestation.makeTest({
   *   listForSubject: dual((args) => P.isString(args[0]), (_sha256: string, _options?: object) => Effect.succeed([])),
   * });
   * console.log(typeof service.listForSubject) // function
   * ```
   *
   * @category testing
   * @since 0.0.0
   */
  static readonly makeTest = (overrides: Partial<AttestationShape> = {}): AttestationShape => ({
    upload: overrides.upload ?? (() => unstubbed("upload")),
    listForSubject: overrides.listForSubject ?? (() => unstubbed("listForSubject")),
  });

  /**
   * {@link Attestation.makeTest} behind a `Layer`.
   *
   * **Example** (Provide a Attestation test layer)
   *
   * ```ts
   * import { Attestation } from "@beep/github/Attestation";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(Attestation.layerTest())) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerTest = (overrides: Partial<AttestationShape> = {}): Layer.Layer<Attestation> =>
    Layer.succeed(Attestation, Attestation.makeTest(overrides));
}

const unstubbed = unstubbedFor({ service: "Attestation" });

const make = (client: GitHubClient["Service"]): AttestationShape => ({
  upload: Effect.fn("Attestation.upload")(function* (bundle: unknown) {
    const { owner, repo } = yield* Repo;
    yield* Effect.annotateCurrentSpan({ owner, repo });
    const stored = yield* client.requestDecoded(
      "POST /repos/{owner}/{repo}/attestations",
      { owner, repo, bundle, headers: { "x-github-api-version": API_VERSION } },
      UploadResponse
    );
    return AttestationRecord.make({
      ...O.getSomesStruct({ id: O.fromUndefinedOr(stored.id) }),
      url: `https://github.com/${owner}/${repo}/attestations/${stored.id ?? ""}`,
    });
  }),

  listForSubject: dual(
    (args) => P.isString(args[0]),
    Effect.fn("Attestation.listForSubject")(function* (
      sha256: string,
      options?: { readonly predicateType?: string | undefined }
    ) {
      const { owner, repo } = yield* Repo;
      const digest = Str.startsWith("sha256:")(sha256) ? sha256 : `sha256:${sha256}`;
      yield* Effect.annotateCurrentSpan({ owner, repo, digest });
      const listed = yield* client
        .requestDecoded(
          "GET /repos/{owner}/{repo}/attestations/{subject_digest}",
          {
            owner,
            repo,
            subject_digest: digest,
            ...O.getSomesStruct({ predicate_type: O.fromUndefinedOr(options?.predicateType) }),
            headers: { "x-github-api-version": API_VERSION },
          },
          ListResponse
        )
        .pipe(
          Effect.catchIf(
            (error) => error.kind === "notFound" || (error.status === 422 && error.kind === "rejected"),
            () => Effect.succeed({ attestations: [] })
          )
        );
      return A.flatMap(listed.attestations ?? [], (entry) => {
        const url =
          entry.bundle_url ??
          (entry.id !== undefined ? `https://github.com/${owner}/${repo}/attestations/${entry.id}` : undefined);
        if (url === undefined) return [];
        return [
          AttestationListEntry.make({
            url,
            ...O.getSomesStruct({ predicateType: O.fromUndefinedOr(entry.predicate_type) }),
          }),
        ];
      });
    })
  ),
});
