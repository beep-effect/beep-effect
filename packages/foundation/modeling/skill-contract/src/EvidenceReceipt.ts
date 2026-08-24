/**
 * Unsigned, in-toto Statement-aligned evidence receipt schemas.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SkillContractId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { Sha256Hex } from "@beep/schema/Sha256";
import { ISOStr } from "@beep/schema/Timestamp";
import { URLStr } from "@beep/schema/URL";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { EvidencePredicateType, GateId, GateOutcome, GateSeverity } from "./Gate.ts";

const $I = $SkillContractId.create("EvidenceReceipt");

/**
 * Digest map used by evidence subjects and attestation resources.
 *
 * **Details**
 *
 * This is the explicit migration seam for a future versioned canonical-digest
 * substrate. Receipt and resource fields reference this single current family.
 *
 * **Example** (Bind a SHA-256 digest)
 *
 * ```ts
 * import { EvidenceDigest } from "@beep/skill-contract"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 *
 * const digest = EvidenceDigest.make({
 *   sha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 * })
 * console.log(digest.sha256.length) // 64
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EvidenceDigest extends S.Class<EvidenceDigest>($I`EvidenceDigest`)(
  {
    sha256: Sha256Hex.annotateKey({
      description: "Canonical lowercase SHA-256 digest of the named subject.",
    }),
  },
  $I.annote("EvidenceDigest", {
    description: "Current digest family and explicit migration seam for evidence-bound resources.",
  })
) {}

/**
 * Named, digest-bound subject of an evidence receipt.
 *
 * **Example** (Describe a receipt subject)
 *
 * ```ts
 * import { EvidenceDigest, EvidenceSubject } from "@beep/skill-contract"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 *
 * const subject = EvidenceSubject.make({
 *   digest: EvidenceDigest.make({
 *     sha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   }),
 *   name: "frames/drag.png"
 * })
 * console.log(subject.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EvidenceSubject extends S.Class<EvidenceSubject>($I`EvidenceSubject`)(
  {
    digest: EvidenceDigest,
    name: S.NonEmptyString.annotateKey({
      description: "Stable subject name interpreted by the receipt producer and consumer.",
    }),
  },
  $I.annote("EvidenceSubject", {
    description: "Named evidence subject bound to the current digest family.",
  })
) {}

const evidenceReceiptImpl = <const Type extends EvidencePredicateType, Predicate extends S.Top>(
  predicateType: Type,
  predicate: Predicate
) => {
  const identifier: string = `EvidenceReceipt(${predicateType})`;
  return S.Struct({
    predicate,
    predicateType: S.Literal(predicateType),
    subject: S.NonEmptyArray(EvidenceSubject),
  }).pipe(
    $I.annoteSchema(identifier, {
      description: "Unsigned in-toto Statement-aligned receipt with a pinned predicate identity.",
    })
  );
};

/**
 * Builds an unsigned evidence receipt whose predicate identity is pinned to its schema.
 *
 * **Details**
 *
 * The shape follows the in-toto Statement split: digest-bound `subject`,
 * versioned `predicateType`, and a schema-owned `predicate`. The literal
 * predicate type also gives each parameterized schema instance a distinct
 * identity. Signing and DSSE envelopes are outside this package.
 *
 * **Example** (Build a typed receipt schema)
 *
 * ```ts
 * import { EvidencePredicateType, EvidenceReceipt } from "@beep/skill-contract"
 * import * as S from "effect/Schema"
 *
 * const ArtifactCheckReceipt = EvidenceReceipt(
 *   EvidencePredicateType.make("https://example.test/evidence/artifact-check/v1"),
 *   S.Struct({ checkedPaths: S.Array(S.String) })
 * )
 * console.log(S.is(ArtifactCheckReceipt))
 * ```
 *
 * @param predicateType - Literal versioned identity pinned into the receipt schema.
 * @param predicate - Schema for the receipt's evidence payload.
 * @returns Unsigned, digest-bound evidence receipt schema.
 * @category factories
 * @since 0.0.0
 */
export const EvidenceReceipt: {
  <Predicate extends S.Top>(
    predicate: Predicate
  ): <const Type extends EvidencePredicateType>(
    predicateType: Type
  ) => ReturnType<typeof evidenceReceiptImpl<Type, Predicate>>;
  <const Type extends EvidencePredicateType, Predicate extends S.Top>(
    predicateType: Type,
    predicate: Predicate
  ): ReturnType<typeof evidenceReceiptImpl<Type, Predicate>>;
} = dual(2, evidenceReceiptImpl);

/**
 * Digest-bound resource referenced by a gate-summary attestation.
 *
 * **Example** (Inspect attestation resource fields)
 *
 * ```ts
 * import { AttestationResource } from "@beep/skill-contract"
 *
 * console.log(AttestationResource.fields.uri !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AttestationResource extends S.Class<AttestationResource>($I`AttestationResource`)(
  {
    digest: EvidenceDigest,
    uri: URLStr,
  },
  $I.annote("AttestationResource", {
    description: "URI-addressed resource bound to the current evidence digest family.",
  })
) {}

/**
 * Identity and component versions of the gate-summary verifier.
 *
 * **Example** (Inspect verifier fields)
 *
 * ```ts
 * import { GateSummaryVerifier } from "@beep/skill-contract"
 *
 * console.log(GateSummaryVerifier.fields.version !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GateSummaryVerifier extends S.Class<GateSummaryVerifier>($I`GateSummaryVerifier`)(
  {
    id: URLStr,
    version: S.Record(S.NonEmptyString, S.NonEmptyString),
  },
  $I.annote("GateSummaryVerifier", {
    description: "Verifier identity and named component versions used for one gate summary.",
  })
) {}

/**
 * SLSA VSA-compatible top-level verification result vocabulary.
 *
 * **Example** (Inspect verification results)
 *
 * ```ts
 * import { GateVerificationResult } from "@beep/skill-contract"
 *
 * console.log(GateVerificationResult.Options) // ["PASSED", "FAILED"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GateVerificationResult = LiteralKit(["PASSED", "FAILED"]).pipe(
  $I.annoteSchema("GateVerificationResult", {
    description: "Top-level pass or failure result for a gate-summary attestation.",
  })
);

/**
 * Runtime type decoded by {@link GateVerificationResult}.
 *
 * @category models
 * @since 0.0.0
 */
export type GateVerificationResult = typeof GateVerificationResult.Type;

/**
 * Verified-level vocabulary without a SLSA build-level claim.
 *
 * **Example** (Inspect verified levels)
 *
 * ```ts
 * import { GateVerifiedLevel } from "@beep/skill-contract"
 *
 * console.log(GateVerifiedLevel.Options)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GateVerifiedLevel = LiteralKit(["BEEP_SKILL_CONTRACT_BLOCKING_GATES", "FAILED"]).pipe(
  $I.annoteSchema("GateVerifiedLevel", {
    description: "Gate-policy verification level or explicit failure without a build-provenance claim.",
  })
);

/**
 * Runtime type decoded by {@link GateVerifiedLevel}.
 *
 * @category models
 * @since 0.0.0
 */
export type GateVerifiedLevel = typeof GateVerifiedLevel.Type;

const GateResultSummaryFields = S.Struct({
  applicable: S.Boolean,
  evidenceSubjects: S.Array(EvidenceSubject),
  evidenceType: EvidencePredicateType,
  gateId: GateId,
  outcome: GateOutcome,
  severity: GateSeverity,
});

const AllowedGateEvidenceCheck = S.makeFilter(
  (result: typeof GateResultSummaryFields.Type) =>
    !result.applicable || !GateOutcome.is.allowed(result.outcome) || A.isReadonlyArrayNonEmpty(result.evidenceSubjects),
  {
    identifier: $I`AllowedGateEvidenceCheck`,
    title: "Allowed gate evidence",
    description: "Every applicable allowed gate result must cite at least one digest-bound evidence subject.",
    message: "Applicable allowed gate results require non-empty evidence subjects",
  }
);

/**
 * Normalized common evidence for one evaluated gate.
 *
 * **Example** (Inspect gate result fields)
 *
 * ```ts
 * import { GateResultSummary } from "@beep/skill-contract"
 *
 * console.log(GateResultSummary.fields.gateId !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GateResultSummary extends S.Class<GateResultSummary>($I`GateResultSummary`)(
  GateResultSummaryFields.check(AllowedGateEvidenceCheck),
  $I.annote("GateResultSummary", {
    description: "Normalized common fields for one evaluated gate without consumer-specific audit detail.",
  })
) {}

const blockingGateLevel = GateVerifiedLevel.make("BEEP_SKILL_CONTRACT_BLOCKING_GATES");
const failedGateLevel = GateVerifiedLevel.make("FAILED");
const PassedLevels = S.Array(GateVerifiedLevel);
const verifiedLevelsEquivalence = S.toEquivalence(PassedLevels);
const passingVerifiedLevels = [blockingGateLevel];
const failedVerifiedLevels = [failedGateLevel];

const gateResultsPassBlockingPolicy = (gateResults: ReadonlyArray<GateResultSummary>): boolean =>
  A.every(
    gateResults,
    (result) =>
      !result.applicable || !GateSeverity.is.blocking(result.severity) || GateOutcome.is.allowed(result.outcome)
  );

const GateSummaryFields = S.Struct({
  contractSubject: EvidenceSubject,
  gateResults: S.Array(GateResultSummary),
  inputAttestations: S.NonEmptyArray(AttestationResource),
  policy: AttestationResource,
  resourceUri: URLStr,
  timeVerified: ISOStr,
  verificationResult: GateVerificationResult,
  verifiedLevels: S.NonEmptyArray(GateVerifiedLevel),
  verifier: GateSummaryVerifier,
});

const GateSummaryCoherenceCheck = S.makeFilter(
  (summary: typeof GateSummaryFields.Type) => {
    const passed = gateResultsPassBlockingPolicy(summary.gateResults);
    const resultMatches = passed
      ? GateVerificationResult.is.PASSED(summary.verificationResult)
      : GateVerificationResult.is.FAILED(summary.verificationResult);
    const levelsMatch = passed
      ? verifiedLevelsEquivalence(summary.verifiedLevels, passingVerifiedLevels)
      : verifiedLevelsEquivalence(summary.verifiedLevels, failedVerifiedLevels);

    return resultMatches && levelsMatch
      ? undefined
      : {
          path: ["verificationResult"],
          issue: "Gate summary result and verifiedLevels must agree with every applicable blocking gate result.",
        };
  },
  {
    identifier: $I`GateSummaryCoherenceCheck`,
    title: "Gate summary coherence",
    description: "Gate summary result and verified levels agree with applicable blocking gate outcomes.",
  }
);

/**
 * SLSA VSA-shaped summary of typed gate evaluations.
 *
 * **Details**
 *
 * The VSA vocabulary is retained without claiming a SLSA build level.
 * `gateResults` is the skill-contract extension, and schema decoding enforces
 * coherent result and level fields.
 *
 * **Example** (Inspect gate summary fields)
 *
 * ```ts
 * import { GateSummary } from "@beep/skill-contract"
 *
 * console.log(GateSummary.fields.verificationResult !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GateSummary extends S.Class<GateSummary>($I`GateSummary`)(
  GateSummaryFields.check(GateSummaryCoherenceCheck),
  $I.annote("GateSummary", {
    description: "VSA-shaped gate summary with coherent blocking-policy results and no build-level claim.",
  })
) {}

/**
 * Canonical predicate identity of {@link GateSummaryReceipt}.
 *
 * **Example** (Inspect gate summary predicate identity)
 *
 * ```ts
 * import { GateSummaryPredicateType } from "@beep/skill-contract"
 *
 * console.log(GateSummaryPredicateType)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const GateSummaryPredicateType = EvidencePredicateType.make(
  "https://beep-effect.dev/skill-contract/evidence/gate-summary/v1"
);

/**
 * Unsigned digest-bound receipt carrying a coherent {@link GateSummary}.
 *
 * **Example** (Inspect the pinned predicate field)
 *
 * ```ts
 * import { GateSummaryReceipt } from "@beep/skill-contract"
 *
 * console.log(GateSummaryReceipt.fields.predicateType !== undefined) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GateSummaryReceipt = EvidenceReceipt(GateSummaryPredicateType, GateSummary);

/**
 * Runtime type decoded by {@link GateSummaryReceipt}.
 *
 * @category models
 * @since 0.0.0
 */
export type GateSummaryReceipt = typeof GateSummaryReceipt.Type;
