/**
 * Bounded GitHub artifact references for independently approved cache producers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { RepoRef } from "@beep/github/Repo";
import { $RepoCliId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";
import { CacheProducerBinding } from "./Cache.producer.schemas.ts";
import { CacheHostedProducerUpload } from "./Cache.workflow.upload.schemas.ts";

export { CacheHostedProducerUpload } from "./Cache.workflow.upload.schemas.ts";

const $I = $RepoCliId.create("commands/Cache/Cache.workflow.github.schemas");
const Identifier = S.Int.check(S.isBetween({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER })).pipe(
  $I.annoteSchema("Identifier", { description: "A positive exact GitHub database identifier or run attempt." })
);

/**
 * Repository and exact reviewed workflow identity supplied outside uploaded data.
 *
 * **Example** (Inspect independent approval fields)
 * ```ts
 * import { CacheHostedProducerApproval } from "@beep/repo-cli/test/Cache"
 * console.assert("binding" in CacheHostedProducerApproval.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheHostedProducerApproval extends S.Opaque<
  CacheHostedProducerApproval,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    repository: RepoRef,
    repositoryId: Identifier,
    workflowPath: S.NonEmptyString.check(S.isPattern(/^\.github\/workflows\/[A-Za-z0-9_-]+\.ya?ml$/)),
    workflowSha256: Sha256Hex,
    binding: CacheProducerBinding,
  }).pipe(
    $I.annoteSchema("CacheHostedProducerApproval", {
      description:
        "Separately approved repository, exact ASCII workflow bytes and computation/profile/epoch binding; never selected by a report.",
    })
  )
) {}

/**
 * Exact immutable Actions artifact and attempt to inspect.
 *
 * **Example** (Select an artifact without a report-supplied URL)
 * ```ts
 * import { CacheHostedProducerReference } from "@beep/repo-cli/test/Cache"
 * const ref = CacheHostedProducerReference.make({ runId: 1, attempt: 1, artifactId: 2 })
 * console.assert(ref.artifactId === 2)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheHostedProducerReference extends S.Opaque<
  CacheHostedProducerReference,
  { readonly brand: unique symbol }
>()(
  S.Struct({ runId: Identifier, attempt: Identifier, artifactId: Identifier }).pipe(
    $I.annoteSchema("CacheHostedProducerReference", {
      description: "Database identifiers only; no caller-selected endpoint, workflow approval or archive member.",
    })
  )
) {}

/**
 * Safe uploaded report whose authority comes from separately checked GitHub metadata.
 *
 * **Example** (Require actual upload observations)
 * ```ts
 * import { CacheHostedProducerReport } from "@beep/repo-cli/test/Cache"
 * console.assert("uploads" in CacheHostedProducerReport.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheHostedProducerReport extends S.Opaque<CacheHostedProducerReport, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("cache-hosted-producer-upload/v1"),
    binding: CacheProducerBinding,
    runId: Identifier,
    attempt: Identifier,
    uploads: S.NonEmptyArray(CacheHostedProducerUpload).check(S.isMaxLength(64)),
  }).pipe(
    $I.annoteSchema("CacheHostedProducerReport", {
      description:
        "At most sixty-four transport observations from one exact approved computation and run attempt; shape alone grants no trust.",
    })
  )
) {}

/**
 * Verified immutable artifact observation, without qualification or reuse authority.
 *
 * **Example** (Keep the observation boundary explicit)
 * ```ts
 * import { CacheHostedProducerObservation } from "@beep/repo-cli/test/Cache"
 * console.assert("artifactSha256" in CacheHostedProducerObservation.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheHostedProducerObservation extends S.Opaque<
  CacheHostedProducerObservation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    authority: S.tag("verified-github-artifact-observation-only"),
    reference: CacheHostedProducerReference,
    artifactSha256: Sha256Hex,
    reportSha256: Sha256Hex,
    report: CacheHostedProducerReport,
  }).pipe(
    $I.annoteSchema("CacheHostedProducerObservation", {
      description:
        "GitHub-bound upload evidence; deployed environment protection, source qualification and activation remain separate gates.",
    })
  )
) {}
