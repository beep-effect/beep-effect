/**
 * Authenticated cache-producer envelope contracts; shape alone grants no trust.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { CacheClientChannel, CacheClientPin, CacheQualificationKey } from "@beep/repo-configs/cache";
import { NonNegativeInt, Sha256Hex } from "@beep/schema";
import { GitObjectId } from "@beep/schema/Conformance";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Cache/Cache.producer.schemas");

/**
 * Trusted workflow and live computation identities expected by a receipt verifier.
 *
 * **Example** (Inspect envelope contract fields)
 * ```ts
 * import { CacheProducerBinding } from "@beep/repo-cli/commands/Cache"
 * console.assert("workflowRevision" in CacheProducerBinding.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheProducerBinding extends S.Class<CacheProducerBinding>($I`CacheProducerBinding`)(
  {
    sourceRevision: GitObjectId,
    workflowRevision: GitObjectId,
    workflowImplementation: Sha256Hex,
    policyDigest: Sha256Hex,
    key: CacheQualificationKey,
    client: CacheClientPin,
    channel: CacheClientChannel,
    runtimeKeyDigest: Sha256Hex,
    configurationDigest: Sha256Hex,
    toolchainDigest: Sha256Hex,
    signedRootConfiguration: Sha256Hex,
  },
  $I.annote("CacheProducerBinding", {
    description: "Trusted workflow and live computation identities expected by a receipt verifier.",
  })
) {}

/**
 * Versioned identity, payload digest and bounded validity authenticated by an issuer.
 *
 * **Example** (Inspect envelope contract fields)
 * ```ts
 * import { CacheProducerBody } from "@beep/repo-cli/commands/Cache"
 * console.assert("payloadSha256" in CacheProducerBody.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheProducerBody extends S.Class<CacheProducerBody>($I`CacheProducerBody`)(
  {
    schemaVersion: S.tag("cache-producer-envelope-body/v1"),
    issuer: Sha256Hex,
    binding: CacheProducerBinding,
    payloadSha256: Sha256Hex,
    issuedAtMs: NonNegativeInt,
    expiresAtMs: NonNegativeInt,
  },
  $I.annote("CacheProducerBody", {
    description: "Versioned identity, payload digest and bounded validity authenticated by an issuer.",
  })
) {}

/**
 * Authenticated producer body requiring a separately trusted issuer to verify.
 *
 * **Example** (Inspect envelope contract fields)
 * ```ts
 * import { CacheProducerEnvelope } from "@beep/repo-cli/commands/Cache"
 * console.assert("mac" in CacheProducerEnvelope.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheProducerEnvelope extends S.Class<CacheProducerEnvelope>($I`CacheProducerEnvelope`)(
  { body: CacheProducerBody, mac: Sha256Hex },
  $I.annote("CacheProducerEnvelope", {
    description: "Authenticated producer body requiring a separately trusted issuer to verify.",
  })
) {}
