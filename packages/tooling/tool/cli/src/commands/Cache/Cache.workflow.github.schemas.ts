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
 * Unverified run identity available before its artifact is uploaded.
 *
 * **Details**
 * A producer can publish its run and attempt without inventing a future artifact
 * identifier. These numbers grant no workflow or publication authority.
 *
 * **Example** (Prepare a run identity before upload)
 * ```ts
 * import { CacheHostedProducerRunReference } from "@beep/repo-cli/test/Cache"
 * const run = CacheHostedProducerRunReference.make({ runId: 1, attempt: 2 })
 * console.assert(run.attempt === 2)
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class CacheHostedProducerRunReference extends S.Opaque<
  CacheHostedProducerRunReference,
  { readonly brand: unique symbol }
>()(
  S.Struct({ runId: Identifier, attempt: Identifier }).pipe(
    $I.annoteSchema("CacheHostedProducerRunReference", {
      description: "Run and attempt carried before upload; authenticated artifact selection remains a later boundary.",
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
  S.Struct({ ...CacheHostedProducerRunReference.fields, artifactId: Identifier }).pipe(
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
 * Immutable publication binding for one complete owned observation and upload.
 *
 * **Details**
 * The digest covers the canonical schema encoding of the complete observation,
 * including its envelope, pilot and conformance matrices. It carries no raw
 * observation, artifact payload or credential. Verification and qualification
 * remain independent of shape validation.
 *
 * **Example** (Require complete observation identity)
 * ```ts
 * import { CacheHostedProducerCompleteReport } from "@beep/repo-cli/test/Cache"
 * console.assert("observationSha256" in CacheHostedProducerCompleteReport.fields)
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class CacheHostedProducerCompleteReport extends S.Opaque<
  CacheHostedProducerCompleteReport,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    ...CacheHostedProducerReport.fields,
    schemaVersion: S.tag("cache-hosted-producer-upload/v2"),
    observationSha256: Sha256Hex,
    uploads: S.NonEmptyArray(CacheHostedProducerUpload).check(S.isMaxLength(1)),
  }).pipe(
    $I.annoteSchema("CacheHostedProducerCompleteReport", {
      description:
        "One complete canonical observation digest and its owned upload; published shape alone grants no trust.",
    })
  )
) {}

const HostedReport = S.Union([CacheHostedProducerReport, CacheHostedProducerCompleteReport]).pipe(
  S.toTaggedUnion("schemaVersion"),
  $I.annoteSchema("HostedReport", {
    description: "Legacy upload-only or complete-observation publication, with explicit versioned authority limits.",
  })
);

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
    report: HostedReport,
  }).pipe(
    $I.annoteSchema("CacheHostedProducerObservation", {
      description:
        "GitHub-bound upload evidence; deployed environment protection, source qualification and activation remain separate gates.",
    })
  )
) {}
