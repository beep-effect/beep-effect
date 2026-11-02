/**
 * Digest-bound gate certificates with EARL/ACT check outcomes, explicit reach,
 * a settled aggregate, and a separate apply-by-id plan.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SkillContractId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { EvidenceReceipt, EvidenceSubject, GateSummaryVerifier } from "./EvidenceReceipt.ts";
import { EvidencePredicateType, GateId, GateSeverity, IsoDateTimeString } from "./Gate.ts";

const $I = $SkillContractId.create("GateCertificate");

/**
 * EARL/ACT outcome vocabulary for one certified check and for the aggregate.
 *
 * **Details**
 *
 * `passed` and `failed` are conclusive. `cantTell` (evaluated without a
 * conclusive answer) and `untested` (in scope but never evaluated) are
 * inconclusive. `inapplicable` means the check did not apply to the subject.
 * The kernel's two-valued gate verdicts stay unchanged; certificates use this
 * vocabulary instead.
 *
 * **Example** (Inspect the outcome vocabulary)
 *
 * ```ts import.meta.vitest name="Inspect the outcome vocabulary"
 * import { CheckOutcome } from "@beep/skill-contract/GateCertificate"
 *
 * CheckOutcome.literals // => ["passed", "failed", "cantTell", "untested", "inapplicable"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CheckOutcome = LiteralKit(["passed", "failed", "cantTell", "untested", "inapplicable"]).pipe(
  $I.annoteSchema("CheckOutcome", {
    description: "EARL/ACT outcome of one certified check or of a certificate aggregate.",
  })
);

/**
 * Runtime type decoded by {@link CheckOutcome}.
 *
 * @category models
 * @since 0.0.0
 */
export type CheckOutcome = typeof CheckOutcome.Type;

/**
 * Inconclusive subset of {@link CheckOutcome}: `cantTell` and `untested`.
 *
 * **Example** (Recognize an inconclusive outcome)
 *
 * ```ts import.meta.vitest name="Recognize an inconclusive outcome"
 * import { InconclusiveCheckOutcome } from "@beep/skill-contract/GateCertificate"
 * import * as S from "effect/Schema"
 *
 * S.is(InconclusiveCheckOutcome)("untested") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const InconclusiveCheckOutcome = CheckOutcome.pick(["cantTell", "untested"]).pipe(
  $I.annoteSchema("InconclusiveCheckOutcome", {
    description: "Check outcomes that never count toward aggregate success.",
  })
);

/**
 * Runtime type decoded by {@link InconclusiveCheckOutcome}.
 *
 * @category models
 * @since 0.0.0
 */
export type InconclusiveCheckOutcome = typeof InconclusiveCheckOutcome.Type;

/**
 * How much of the declared check scope a certificate covers.
 *
 * **Details**
 *
 * Reach is always explicit. `complete` means every declared check is listed
 * and in reach (`inReach: true`); a decoded certificate never pairs
 * `complete` with an out-of-reach check. `incomplete` means some declared
 * check is out of reach or not listed; `unknown` means the producer cannot
 * say. There is no nullable `conforms`.
 *
 * **Example** (Inspect reach values)
 *
 * ```ts import.meta.vitest name="Inspect reach values"
 * import { CertificateReach } from "@beep/skill-contract/GateCertificate"
 *
 * CertificateReach.literals // => ["complete", "incomplete", "unknown"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CertificateReach = LiteralKit(["complete", "incomplete", "unknown"]).pipe(
  $I.annoteSchema("CertificateReach", {
    description: "Explicit coverage of the declared check scope by one certificate.",
  })
);

/**
 * Runtime type decoded by {@link CertificateReach}.
 *
 * @category models
 * @since 0.0.0
 */
export type CertificateReach = typeof CertificateReach.Type;

const CertificateCheckFields = S.Struct({
  checkId: GateId.annotateKey({
    description: "Gate identifier of the certified check, unique within the certificate.",
  }),
  evidenceSubjects: S.Array(EvidenceSubject).annotateKey({
    description: "Digest-bound subjects the check outcome rests on.",
  }),
  evidenceType: EvidencePredicateType,
  inReach: S.Boolean.annotateKey({
    description: "Whether the check lies inside the certificate's evaluated scope.",
  }),
  outcome: CheckOutcome,
  severity: GateSeverity,
});

const PassedCheckEvidence = S.makeFilter(
  (check: typeof CertificateCheckFields.Type) =>
    !CheckOutcome.is.passed(check.outcome) || A.isReadonlyArrayNonEmpty(check.evidenceSubjects),
  $I.annote("PassedCheckEvidence", {
    title: "Passed check evidence",
    description: "A passed check cites at least one digest-bound evidence subject.",
    message: "Passed certificate checks require non-empty evidence subjects",
  })
);

/**
 * One certified check: its outcome, reach, severity, and evidence.
 *
 * **Example** (Certify an untested check)
 *
 * ```ts import.meta.vitest name="Certify an untested check"
 * import { CertificateCheck } from "@beep/skill-contract/GateCertificate"
 * import { EvidencePredicateType, GateId } from "@beep/skill-contract/Gate"
 *
 * const check = CertificateCheck.make({
 *   checkId: GateId.make("artifact-exists"),
 *   evidenceSubjects: [],
 *   evidenceType: EvidencePredicateType.make("https://example.test/evidence/artifact/v1"),
 *   inReach: true,
 *   outcome: "untested",
 *   severity: "blocking"
 * })
 * check.outcome // => "untested"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CertificateCheck extends S.Opaque<CertificateCheck, { readonly brand: unique symbol }>()(
  CertificateCheckFields.check(PassedCheckEvidence).pipe(
    $I.annoteSchema("CertificateCheck", {
      description: "One certified check with its EARL/ACT outcome, reach, severity, and digest-bound evidence.",
    })
  )
) {}

const settleGateCertificateOutcomeImpl = (
  reach: CertificateReach,
  checks: ReadonlyArray<CertificateCheck>
): CheckOutcome => {
  const inReach = A.filter(checks, (check) => check.inReach);
  const has = (outcome: CheckOutcome, blockingOnly = false): boolean =>
    A.some(
      inReach,
      (check) => Eq.equals(check.outcome, outcome) && (!blockingOnly || GateSeverity.is.blocking(check.severity))
    );
  if (has("failed", true)) {
    return "failed";
  }
  if (has("cantTell")) {
    return "cantTell";
  }
  if (has("untested")) {
    return "untested";
  }
  if (!CertificateReach.is.complete(reach) || A.length(inReach) < A.length(checks)) {
    return "cantTell";
  }
  return has("passed") ? "passed" : "inapplicable";
};

/**
 * Settles the aggregate outcome of a certificate from its reach and checks.
 *
 * **Details**
 *
 * Only in-reach checks count. The first matching rule wins:
 *
 * 1. Any blocking `failed` check settles `failed`.
 * 2. Any `cantTell` check settles `cantTell`; otherwise any `untested`
 *    check settles `untested`. Inconclusive checks never count as success.
 * 3. Reach other than `complete`, or a `complete` reach that lists an
 *    out-of-reach check, settles `cantTell`.
 * 4. At least one `passed` check settles `passed`; otherwise `inapplicable`.
 *
 * An advisory `failed` check does not fail the aggregate, matching the
 * kernel's gate-summary blocking policy.
 *
 * **Example** (Settle an aggregate with an untested check)
 *
 * ```ts import.meta.vitest name="Settle an aggregate with an untested check"
 * import { CertificateCheck, settleGateCertificateOutcome } from "@beep/skill-contract/GateCertificate"
 * import { EvidencePredicateType, GateId } from "@beep/skill-contract/Gate"
 *
 * const check = CertificateCheck.make({
 *   checkId: GateId.make("artifact-exists"),
 *   evidenceSubjects: [],
 *   evidenceType: EvidencePredicateType.make("https://example.test/evidence/artifact/v1"),
 *   inReach: true,
 *   outcome: "untested",
 *   severity: "blocking"
 * })
 * settleGateCertificateOutcome("complete", [check]) // => "untested"
 * ```
 *
 * @param reach - Explicit coverage of the declared check scope.
 * @param checks - Certified checks in declaration order.
 * @returns The only aggregate outcome a coherent certificate may state.
 * @category utilities
 * @since 0.0.0
 */
export const settleGateCertificateOutcome: {
  (checks: ReadonlyArray<CertificateCheck>): (reach: CertificateReach) => CheckOutcome;
  (reach: CertificateReach, checks: ReadonlyArray<CertificateCheck>): CheckOutcome;
} = dual(2, settleGateCertificateOutcomeImpl);

const uniqueCheckIds = (checks: ReadonlyArray<CertificateCheck>): boolean => {
  const ids = A.map(checks, (check) => check.checkId);
  return Eq.equals(HashSet.size(HashSet.fromIterable(ids)), A.length(ids));
};

const GateCertificateFields = S.Struct({
  checks: S.Array(CertificateCheck),
  contractSubject: EvidenceSubject,
  outcome: CheckOutcome.annotateKey({
    description: "Aggregate outcome; it must equal settleGateCertificateOutcome(reach, checks).",
  }),
  reach: CertificateReach,
  timeVerified: IsoDateTimeString,
  verifier: GateSummaryVerifier,
});

const GateCertificateCoherenceCheck = S.makeFilter(
  (certificate: typeof GateCertificateFields.Type) => {
    if (!uniqueCheckIds(certificate.checks)) {
      return { path: ["checks"], issue: "Gate certificate checks must use unique check ids." };
    }
    if (CertificateReach.is.complete(certificate.reach) && A.some(certificate.checks, (check) => !check.inReach)) {
      return { path: ["reach"], issue: "A complete gate certificate reach requires every listed check in reach." };
    }
    return Eq.equals(settleGateCertificateOutcomeImpl(certificate.reach, certificate.checks), certificate.outcome)
      ? undefined
      : {
          path: ["outcome"],
          issue: "Gate certificate outcome must equal the outcome settled from its reach and in-reach checks.",
        };
  },
  $I.annote("GateCertificateCoherenceCheck", {
    title: "Gate certificate coherence",
    description:
      "Check ids are unique, complete reach has no out-of-reach check, and the aggregate outcome is the settled one.",
  })
);

/**
 * Certificate predicate: contract binding, checks, reach, and settled aggregate.
 *
 * **Details**
 *
 * Decoding rejects duplicate check ids and any aggregate outcome other than
 * the one {@link settleGateCertificateOutcome} derives, so a decoded
 * certificate never states `passed` while an in-reach check is inconclusive.
 *
 * **Example** (Inspect certificate fields)
 *
 * ```ts import.meta.vitest name="Inspect certificate fields"
 * import { GateCertificate } from "@beep/skill-contract/GateCertificate"
 *
 * GateCertificate.fields.reach !== undefined // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GateCertificate extends S.Opaque<GateCertificate, { readonly brand: unique symbol }>()(
  GateCertificateFields.check(GateCertificateCoherenceCheck).pipe(
    $I.annoteSchema("GateCertificate", {
      description: "Gate certificate predicate with unique checks, explicit reach, and a settled aggregate outcome.",
    })
  )
) {}

/**
 * Canonical predicate identity of {@link GateCertificateReceipt}.
 *
 * **Example** (Inspect the certificate predicate identity)
 *
 * ```ts import.meta.vitest name="Inspect the certificate predicate identity"
 * import { GateCertificatePredicateType } from "@beep/skill-contract/GateCertificate"
 *
 * GateCertificatePredicateType.endsWith("/evidence/gate-certificate/v1") // => true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const GateCertificatePredicateType = EvidencePredicateType.make(
  $SkillContractId.create("evidence/gate-certificate/v1").iri
);

/**
 * Unsigned, digest-bound in-toto Statement-shaped envelope for a {@link GateCertificate}.
 *
 * **Details**
 *
 * Reuses the kernel {@link EvidenceReceipt} envelope: digest-bound `subject`,
 * pinned `predicateType`, and the certificate as `predicate`. Signing and
 * external verification are out of scope.
 *
 * **Example** (Inspect the pinned predicate field)
 *
 * ```ts import.meta.vitest name="Inspect the certificate envelope"
 * import { GateCertificateReceipt } from "@beep/skill-contract/GateCertificate"
 *
 * GateCertificateReceipt.fields.subject !== undefined // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GateCertificateReceipt = EvidenceReceipt(GateCertificatePredicateType, GateCertificate);

/**
 * Runtime type decoded by {@link GateCertificateReceipt}.
 *
 * @category models
 * @since 0.0.0
 */
export type GateCertificateReceipt = typeof GateCertificateReceipt.Type;

const ApplyPlanFields = S.Struct({
  certificate: EvidenceSubject.annotateKey({
    description: "Name and digest of the exact certificate envelope the plan was made against.",
  }),
  checkIds: S.NonEmptyArray(GateId).annotateKey({
    description: "Certificate check ids to apply, in application order.",
  }),
});

const UniquePlanCheckIds = S.makeFilter(
  (plan: typeof ApplyPlanFields.Type) =>
    Eq.equals(HashSet.size(HashSet.fromIterable(plan.checkIds)), A.length(plan.checkIds)),
  $I.annote("UniquePlanCheckIds", {
    title: "Unique plan check ids",
    description: "An apply plan names each check id at most once.",
    message: "Gate certificate apply plans must name unique check ids",
  })
);

/**
 * Separate digest-bound plan that applies certificate checks by id.
 *
 * **Details**
 *
 * The plan binds to the certificate envelope's own digest, not to its
 * predicate, so any change to the certificate makes the plan stale.
 *
 * **Example** (Inspect plan fields)
 *
 * ```ts import.meta.vitest name="Inspect plan fields"
 * import { GateCertificateApplyPlan } from "@beep/skill-contract/GateCertificate"
 *
 * GateCertificateApplyPlan.fields.checkIds !== undefined // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GateCertificateApplyPlan extends S.Opaque<GateCertificateApplyPlan, { readonly brand: unique symbol }>()(
  ApplyPlanFields.check(UniquePlanCheckIds).pipe(
    $I.annoteSchema("GateCertificateApplyPlan", {
      description: "Digest-bound plan naming unique certificate check ids to apply.",
    })
  )
) {}

/**
 * Why an apply plan was refused.
 *
 * **Example** (Inspect refusal reasons)
 *
 * ```ts import.meta.vitest name="Inspect refusal reasons"
 * import { ApplyPlanRefusalReason } from "@beep/skill-contract/GateCertificate"
 *
 * ApplyPlanRefusalReason.literals // => ["stale-digest", "unknown-id"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ApplyPlanRefusalReason = LiteralKit(["stale-digest", "unknown-id"]).pipe(
  $I.annoteSchema("ApplyPlanRefusalReason", {
    description: "Reasons a gate certificate apply plan is refused.",
  })
);

/**
 * Runtime type decoded by {@link ApplyPlanRefusalReason}.
 *
 * @category models
 * @since 0.0.0
 */
export type ApplyPlanRefusalReason = typeof ApplyPlanRefusalReason.Type;

/**
 * Result of applying a plan: the selected checks, or a refusal value.
 *
 * **Details**
 *
 * Refusal is a value, never an error. `unknownIds` lists plan ids absent
 * from the certificate and is empty for a stale-digest refusal.
 *
 * **Example** (Inspect verdict cases)
 *
 * ```ts import.meta.vitest name="Inspect apply verdict cases"
 * import { GateCertificateApplyVerdict } from "@beep/skill-contract/GateCertificate"
 *
 * GateCertificateApplyVerdict.cases.refused !== undefined // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GateCertificateApplyVerdict = LiteralKit(["applied", "refused"])
  .toTaggedUnion("verdict")({
    applied: { checks: S.Array(CertificateCheck) },
    refused: { reason: ApplyPlanRefusalReason, unknownIds: S.Array(GateId) },
  })
  .pipe(
    $I.annoteSchema("GateCertificateApplyVerdict", {
      description: "Selected certificate checks for an apply plan, or the reason the plan was refused.",
    })
  );

/**
 * Runtime type decoded by {@link GateCertificateApplyVerdict}.
 *
 * @category models
 * @since 0.0.0
 */
export type GateCertificateApplyVerdict = typeof GateCertificateApplyVerdict.Type;

const subjectEquivalence = S.toEquivalence(EvidenceSubject);

const applyGateCertificatePlanImpl = (
  plan: GateCertificateApplyPlan,
  certificate: EvidenceSubject,
  receipt: GateCertificateReceipt
): GateCertificateApplyVerdict => {
  if (!subjectEquivalence(plan.certificate, certificate)) {
    return GateCertificateApplyVerdict.cases.refused.make({ reason: "stale-digest", unknownIds: [] });
  }
  const byId = HashMap.fromIterable(A.map(receipt.predicate.checks, (check) => [check.checkId, check] as const));
  const [checks, unknownIds] = A.partition(plan.checkIds, (id) => Result.fromOption(HashMap.get(byId, id), () => id));
  return A.match(unknownIds, {
    onEmpty: () => GateCertificateApplyVerdict.cases.applied.make({ checks }),
    onNonEmpty: (ids) => GateCertificateApplyVerdict.cases.refused.make({ reason: "unknown-id", unknownIds: ids }),
  });
};

/**
 * Applies a plan to the certificate it was made against, refusing stale or unknown ids.
 *
 * **Details**
 *
 * `certificate` is the name and digest the caller computed for `receipt`'s
 * encoded bytes. A plan bound to any other subject is refused as
 * `stale-digest` before ids are inspected. Otherwise any plan id the
 * certificate does not contain refuses the whole plan as `unknown-id`.
 *
 * **Example** (Refuse a stale plan)
 *
 * ```ts import.meta.vitest name="Refuse a stale plan"
 * import { EvidenceDigest, EvidenceSubject, GateSummaryVerifier } from "@beep/skill-contract/EvidenceReceipt"
 * import { EvidencePredicateType, GateId } from "@beep/skill-contract/Gate"
 * import {
 *   applyGateCertificatePlan,
 *   CertificateCheck,
 *   GateCertificate,
 *   GateCertificateApplyPlan,
 *   GateCertificatePredicateType,
 *   GateCertificateReceipt
 * } from "@beep/skill-contract/GateCertificate"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import { URLStr } from "@beep/schema/URL"
 *
 * const subject = (name: string, hex: string) =>
 *   EvidenceSubject.make({ digest: EvidenceDigest.make({ sha256: Sha256Hex.make(hex) }), name })
 * const inventory = subject("inventory.json", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
 * const receipt = GateCertificateReceipt.make({
 *   predicate: GateCertificate.make({
 *     checks: [
 *       CertificateCheck.make({
 *         checkId: GateId.make("artifact-exists"),
 *         evidenceSubjects: [inventory],
 *         evidenceType: EvidencePredicateType.make("https://example.test/evidence/artifact/v1"),
 *         inReach: true,
 *         outcome: "passed",
 *         severity: "blocking"
 *       })
 *     ],
 *     contractSubject: subject("contract@1.0.0", "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"),
 *     outcome: "passed",
 *     reach: "complete",
 *     timeVerified: "2026-11-02T00:00:00.000Z",
 *     verifier: GateSummaryVerifier.make({ id: URLStr.make("https://example.test/verifier/v1"), version: { kernel: "1.0.0" } })
 *   }),
 *   predicateType: GateCertificatePredicateType,
 *   subject: [inventory]
 * })
 * const current = subject("certificate.json", "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc")
 * const stale = subject("certificate.json", "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd")
 * const plan = GateCertificateApplyPlan.make({ certificate: stale, checkIds: [GateId.make("artifact-exists")] })
 *
 * applyGateCertificatePlan(plan, current, receipt).verdict // => "refused"
 * ```
 *
 * @param plan - Digest-bound apply-by-id plan.
 * @param certificate - Name and digest of the current certificate envelope.
 * @param receipt - Current certificate envelope.
 * @returns Applied checks in plan order, or a refusal value.
 * @category utilities
 * @since 0.0.0
 */
export const applyGateCertificatePlan: {
  (
    certificate: EvidenceSubject,
    receipt: GateCertificateReceipt
  ): (plan: GateCertificateApplyPlan) => GateCertificateApplyVerdict;
  (
    plan: GateCertificateApplyPlan,
    certificate: EvidenceSubject,
    receipt: GateCertificateReceipt
  ): GateCertificateApplyVerdict;
} = dual(3, applyGateCertificatePlanImpl);
