/**
 * Source-bound entrypoint review attachments for the executable census.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { CacheEvidenceReference } from "@beep/repo-configs/cache";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Cache/Cache.entrypoints.schemas");

/**
 * Source document dialects understood by the entrypoint attachment boundary.
 *
 * **Example** (Recognize a workflow source snapshot)
 *
 * ```ts
 * import { CacheEntrypointArtifactFormat } from "@beep/repo-cli/commands/Cache"
 * console.assert(CacheEntrypointArtifactFormat.is["cache-workflow-source-snapshot/v1"]("cache-workflow-source-snapshot/v1"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheEntrypointArtifactFormat = LiteralKit([
  "cache-entrypoint-plans/v2",
  "cache-yeet-planner-review/v1",
  "cache-workflow-source-snapshot/v1",
  "cache-command-groups/v1",
]).pipe(
  $I.annoteSchema("CacheEntrypointArtifactFormat", {
    description: "Recognized source-review document dialects; none describes observed execution.",
  })
);

/**
 * Exact source snapshot bytes and their declared document dialect.
 *
 * **Example** (Reject an unbound snapshot)
 *
 * ```ts
 * import { CacheEntrypointArtifactReference } from "@beep/repo-cli/commands/Cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CacheEntrypointArtifactReference)({ format: "cache-entrypoint-plans/v2" }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheEntrypointArtifactReference extends S.Class<CacheEntrypointArtifactReference>(
  $I`CacheEntrypointArtifactReference`
)(
  { format: CacheEntrypointArtifactFormat, reference: CacheEvidenceReference },
  $I.annote("CacheEntrypointArtifactReference", {
    description: "A portable immutable source snapshot reference and its expected versioned dialect.",
  })
) {}

/**
 * Reviewed source population, generator snapshots and outstanding interpretation work.
 *
 * **Details**
 *
 * Every current census source must be bound. Additional recipe and interpreter
 * sources may be supplied. Artifact bytes are preserved in the resulting
 * census; their owner remains responsible for their complete semantic schema.
 *
 * **Example** (Reject an empty review)
 *
 * ```ts
 * import { CacheEntrypointReviewRequest } from "@beep/repo-cli/commands/Cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CacheEntrypointReviewRequest)({ sources: [], artifacts: [], reviews: [] }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheEntrypointReviewRequest extends S.Class<CacheEntrypointReviewRequest>(
  $I`CacheEntrypointReviewRequest`
)(
  {
    schemaVersion: S.tag("cache-entrypoint-review-request/v1"),
    sources: S.NonEmptyArray(CacheEvidenceReference),
    artifacts: S.NonEmptyArray(CacheEntrypointArtifactReference),
    reviews: S.NonEmptyArray(CacheEvidenceReference),
    unresolved: S.Array(S.NonEmptyString),
  },
  $I.annote("CacheEntrypointReviewRequest", {
    description: "Reviewed source and artifact bindings without runtime or qualification authority.",
  })
) {}

/**
 * Complete parsed source snapshot with its original immutable byte reference.
 *
 * **Example** (Require the full source document)
 *
 * ```ts
 * import { CacheEntrypointArtifact } from "@beep/repo-cli/commands/Cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CacheEntrypointArtifact)({ format: "cache-entrypoint-plans/v2" }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheEntrypointArtifact extends S.Class<CacheEntrypointArtifact>($I`CacheEntrypointArtifact`)(
  { ...CacheEntrypointArtifactReference.fields, document: S.JsonObject },
  $I.annote("CacheEntrypointArtifact", {
    description: "Complete parsed source document; the original bytes remain bound by reference.",
  })
) {}

/**
 * Verified source bindings attached to a census, explicitly excluding runtime authority.
 *
 * **Example** (Reject a runtime-authority claim)
 *
 * ```ts
 * import { CacheCensusEntrypointReview } from "@beep/repo-cli/commands/Cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CacheCensusEntrypointReview)({ authority: "qualified" }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheCensusEntrypointReview extends S.Class<CacheCensusEntrypointReview>($I`CacheCensusEntrypointReview`)(
  {
    ...CacheEntrypointReviewRequest.fields,
    schemaVersion: S.tag("cache-census-entrypoint-review/v1"),
    authority: S.tag("source-review-only"),
    artifacts: S.NonEmptyArray(CacheEntrypointArtifact),
  },
  $I.annote("CacheCensusEntrypointReview", {
    description: "Hash-verified source attachment that cannot assert executions, hosted proof or qualification.",
  })
) {}
