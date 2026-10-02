/**
 * Authenticated cache-producer envelope contracts; shape alone grants no trust.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import {
  CacheClientChannel,
  CacheClientPin,
  CacheEvidenceReference,
  CacheQualificationKey,
  CacheQualificationObservation,
  CacheTaskContract,
} from "@beep/repo-configs/cache";
import { Sha256Hex } from "@beep/schema";
import { GitObjectId } from "@beep/schema/Conformance";
import * as S from "effect/Schema";
import { CacheSignedPilotReceipt } from "./Cache.pilot.signed.schemas.ts";
import { CacheProtocolExecution } from "./Cache.protocol.runner.schemas.ts";

const $I = $RepoCliId.create("commands/Cache/Cache.producer.schemas");

/**
 * Complete pilot and conformance payload for one protected producer run.
 *
 * **Details**
 * Shape validation alone grants no trust. Both native matrices must be
 * validated and authenticated together before an acceptance importer can use
 * them with an independently approved task contract.
 *
 * **Example** (Require complete conformance)
 * ```ts
 * import { CacheProducerBundle } from "@beep/repo-cli/commands/Cache"
 * console.assert("protocol" in CacheProducerBundle.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheProducerBundle extends S.Class<CacheProducerBundle>($I`CacheProducerBundle`)(
  {
    schemaVersion: S.tag("cache-producer-bundle/v1"),
    pilot: CacheSignedPilotReceipt,
    protocol: CacheProtocolExecution,
  },
  $I.annote("CacheProducerBundle", {
    description: "One channel's complete native pilot and conformance observations; authentication remains separate.",
  })
) {}

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
    protocolClient: CacheClientPin,
    channel: CacheClientChannel,
    runtimeKeyDigest: Sha256Hex,
    configurationDigest: Sha256Hex,
    activatedConfigurationDigest: Sha256Hex,
    signedConfigurationDigest: Sha256Hex,
    toolchainDigest: Sha256Hex,
    signedRootConfiguration: Sha256Hex,
  },
  $I.annote("CacheProducerBinding", {
    description: "Trusted workflow and live computation identities expected by a receipt verifier.",
  })
) {}

/**
 * Independently provisioned full policy and exact producer identity.
 *
 * **Example** (Keep reviewed obligations outside receipt authority)
 * ```ts
 * import { CacheProducerApproval } from "@beep/repo-cli/commands/Cache"
 * console.assert("contract" in CacheProducerApproval.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheProducerApproval extends S.Class<CacheProducerApproval>($I`CacheProducerApproval`)(
  { schemaVersion: S.tag("cache-producer-approval/v3"), binding: CacheProducerBinding, contract: CacheTaskContract },
  $I.annote("CacheProducerApproval", {
    description: "Private complete task contract and its independently approved workflow binding.",
  })
) {}

/**
 * Canonical child evidence and its derived policy observation.
 *
 * **Details**
 * The importer must persist and verify these exact bytes. Child identities
 * preserve independent comparisons; the enclosing bundle hash cannot stand
 * in for every counted receipt. This projection grants no qualification.
 *
 * **Example** (Inspect the retained evidence bytes)
 * ```ts
 * import { CacheProducerEvidenceFragment } from "@beep/repo-cli/commands/Cache"
 * console.assert("contents" in CacheProducerEvidenceFragment.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheProducerEvidenceFragment extends S.Class<CacheProducerEvidenceFragment>(
  $I`CacheProducerEvidenceFragment`
)(
  { reference: CacheEvidenceReference, contents: S.NonEmptyString, observation: CacheQualificationObservation },
  $I.annote("CacheProducerEvidenceFragment", {
    description: "Exact projected native evidence bytes and their bound policy row.",
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
    schemaVersion: S.tag("cache-producer-envelope-body/v2"),
    issuer: Sha256Hex,
    binding: CacheProducerBinding,
    payloadSha256: Sha256Hex,
    issuedAtMs: S.Natural,
    expiresAtMs: S.Natural,
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
