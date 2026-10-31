/**
 * Safe bounded upload facts shared by owned and hosted producer observations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";
import { CacheConformanceBackendResult } from "./Cache.conformance.schemas.ts";
import { CacheSyntheticRun } from "./Cache.experiment.schemas.ts";

const $I = $RepoCliId.create("commands/Cache/Cache.workflow.upload.schemas");

/**
 * One upload observed by the approved producer after its owned task completed.
 *
 * **Details**
 * A successful transport result does not prove native signature validity,
 * complete semantic inputs, or qualification. Payloads, tags and credentials
 * are deliberately absent.
 *
 * **Example** (Inspect safe upload identities)
 * ```ts
 * import { CacheHostedProducerUpload } from "@beep/repo-cli/test/Cache"
 * console.assert("archiveSha256" in CacheHostedProducerUpload.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheHostedProducerUpload extends S.Opaque<CacheHostedProducerUpload, { readonly brand: unique symbol }>()(
  S.Struct({
    taskHash: CacheSyntheticRun.fields.taskHash,
    archiveSha256: Sha256Hex,
    archiveBytes: S.Int.check(S.isBetween({ minimum: 1, maximum: 50 * 1024 * 1024 })),
    status: S.Int.check(S.isBetween({ minimum: 200, maximum: 299 })),
    backendResult: S.tag(CacheConformanceBackendResult.Enum.allowed),
  }).pipe(
    $I.annoteSchema("CacheHostedProducerUpload", {
      description:
        "Finite successful-upload projection with canonical task/content identities and no raw request material.",
    })
  )
) {}

/**
 * Independent approval of one destination and its native artifact-key identity.
 *
 * **Details**
 * Both identities are required together. The key digest is domain-separated;
 * neither the key value nor a secret reference enters a producer report.
 *
 * **Example** (Inspect independent upload approval)
 * ```ts
 * import { CacheProducerUploadApproval } from "@beep/repo-cli/test/Cache"
 * console.assert("artifactKeySha256" in CacheProducerUploadApproval.fields)
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class CacheProducerUploadApproval extends S.Opaque<
  CacheProducerUploadApproval,
  { readonly brand: unique symbol }
>()(
  S.Struct({ targetSha256: Sha256Hex, artifactKeySha256: Sha256Hex }).pipe(
    $I.annoteSchema("CacheProducerUploadApproval", {
      description: "Paired independent descriptor and artifact-key identities for one approved upload epoch.",
    })
  )
) {}
