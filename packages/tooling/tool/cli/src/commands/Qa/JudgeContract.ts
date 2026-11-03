/**
 * Typed gate composition for the complete `qa-inventory/v1` judge.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $I as $BeepId, $QaId, $RepoCliId } from "@beep/identity/packages";
import { RoundNumber } from "@beep/qa-capture";
import { decodeQaInventory, QaInventory } from "@beep/qa-capture/QaInventory.schemas";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { SemanticVersion } from "@beep/schema/SemanticVersion";
import { Sha256Hex } from "@beep/schema/Sha256";
import { URLStr } from "@beep/schema/URL";
import {
  AlwaysGateApplicability,
  CertificateCheck,
  CheckOutcome,
  EvidenceDigest,
  EvidenceLadderReceiptTypes,
  EvidencePredicateType,
  EvidenceSubject,
  FailurePredicateType,
  GateCertificate,
  GateCertificatePredicateType,
  GateCertificateReceipt,
  GateDeclaration,
  GateEvidenceRequirement,
  GateOutcome,
  GateRegistry,
  GateSummaryPredicateType,
  GateSummaryVerifier,
  GateVerdict,
  NoRecoveryPolicy,
  ReceiptTypeBindings,
  SchemaReference,
  SchemaReferenceId,
  SkillContract,
  SkillContractId,
  settleGateCertificateOutcome,
} from "@beep/skill-contract";
import { A } from "@beep/utils";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { CitedArtifactExistsGate, CitedArtifactExistsVerdict } from "./CitedArtifactExistsGate.ts";
import { QaJudgeGateId } from "./QaJudgeGateId.ts";
import type { GateEvaluator } from "@beep/skill-contract";

const decodeJsonEffect = S.decodeEffect(S.fromJsonString(S.Unknown));

const $I = $RepoCliId.create("commands/Qa/JudgeContract");
const remediationOwner = "@beep/repo-cli/Qa";
const auditTimestamp = DateTime.now.pipe(Effect.map(DateTime.formatIso));

const citedEventIdExistsGateId = QaJudgeGateId.make("cited-event-id-exists");
const declaredRoundCoherentGateId = QaJudgeGateId.make("declared-round-coherent");
const evidenceCrossCheckCleanGateId = QaJudgeGateId.make("evidence-cross-check-clean");
const judgeOutputInventoryDecodesGateId = QaJudgeGateId.make("judge-output-inventory-decodes");

const $QaEvidence = $QaId.create("evidence");

const citedEventIdExistsPredicateType = EvidencePredicateType.make($QaEvidence.create("cited-event-id-exists/v2").iri);
const declaredRoundCoherentPredicateType = EvidencePredicateType.make(
  $QaEvidence.create("declared-round-coherent/v2").iri
);
const evidenceCrossCheckPredicateType = EvidencePredicateType.make($QaEvidence.create("evidence-cross-check/v2").iri);
const judgeOutputInventoryPredicateType = EvidencePredicateType.make(
  $QaEvidence.create("judge-output-inventory/v2").iri
);

const alwaysBlockingGate = (id: QaJudgeGateId, predicateType: EvidencePredicateType): GateDeclaration =>
  GateDeclaration.make({
    applicability: AlwaysGateApplicability.make({}),
    evidence: GateEvidenceRequirement.make({ predicateType }),
    id,
    remediationOwner,
    severity: "blocking",
  });

/**
 * Ordered event citations and witness ids consumed by the event-existence gate.
 *
 * **Example** (Create event gate input)
 *
 * ```ts
 * import { CitedEventIdExistsInput } from "@beep/repo-cli/commands/Qa"
 *
 * const input = CitedEventIdExistsInput.make({ citedEventIds: [4, 7], knownEventIds: [4] })
 * console.log(input.citedEventIds) // [4, 7]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CitedEventIdExistsInput extends S.Opaque<CitedEventIdExistsInput, { readonly brand: unique symbol }>()(
  S.Struct({
    citedEventIds: S.Array(S.Int),
    knownEventIds: S.Array(S.Int),
  }).pipe(
    $I.annoteSchema("CitedEventIdExistsInput", {
      description: "Ordered event citations and known witness ids consumed by the event-existence gate.",
    })
  )
) {}

class CitedEventIdExistsAllowed extends S.Opaque<CitedEventIdExistsAllowed, { readonly brand: unique symbol }>()(
  S.Struct({ checkedEventIds: S.Array(S.Int) }).pipe(
    $I.annoteSchema("CitedEventIdExistsAllowed", {
      description: "Event citations inspected by an allowed event-existence evaluation.",
    })
  )
) {}

class CitedEventIdExistsDenied extends S.Opaque<CitedEventIdExistsDenied, { readonly brand: unique symbol }>()(
  S.Struct({
    checkedEventIds: S.Array(S.Int),
    missingEventIds: S.NonEmptyArray(S.Int),
  }).pipe(
    $I.annoteSchema("CitedEventIdExistsDenied", {
      description: "Event citations inspected by a denied evaluation and the ids absent from the witness log.",
    })
  )
) {}

/**
 * Audited verdict for witness-event citation existence.
 *
 * **Example** (Inspect verdict cases)
 *
 * ```ts
 * import { CitedEventIdExistsVerdict } from "@beep/repo-cli/commands/Qa"
 *
 * console.log(CitedEventIdExistsVerdict.discriminants) // ["allowed", "denied"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CitedEventIdExistsVerdict = GateVerdict(
  "CitedEventIdExistsVerdict",
  CitedEventIdExistsAllowed,
  CitedEventIdExistsDenied
);

/**
 * Runtime type decoded by {@link CitedEventIdExistsVerdict}.
 *
 * @category models
 * @since 0.0.0
 */
export type CitedEventIdExistsVerdict = typeof CitedEventIdExistsVerdict.Type;

/**
 * Blocking declaration for witness-event citation existence.
 *
 * **Example** (Inspect the event gate)
 *
 * ```ts
 * import { CitedEventIdExistsGate } from "@beep/repo-cli/commands/Qa"
 *
 * console.log(CitedEventIdExistsGate.id) // "cited-event-id-exists"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CitedEventIdExistsGate = alwaysBlockingGate(citedEventIdExistsGateId, citedEventIdExistsPredicateType);

/**
 * Finds cited event ids absent from the witness log in first-citation order.
 *
 * **Example** (Build an event evaluation)
 *
 * ```ts
 * import { CitedEventIdExistsInput, evaluateCitedEventIdExists } from "@beep/repo-cli/commands/Qa"
 * import * as Effect from "effect/Effect";
 * const program = evaluateCitedEventIdExists(
 *   CitedEventIdExistsInput.make({ citedEventIds: [4, 7], knownEventIds: [4] })
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const evaluateCitedEventIdExists: GateEvaluator<CitedEventIdExistsInput, CitedEventIdExistsVerdict> = Effect.fn(
  "QaJudgeContract.evaluateCitedEventIdExists"
)(function* (input: CitedEventIdExistsInput): Effect.fn.Return<CitedEventIdExistsVerdict> {
  const checkedEventIds = A.dedupe(input.citedEventIds);
  const knownEventIds = HashSet.fromIterable(input.knownEventIds);
  const missingEventIds = A.filter(checkedEventIds, (eventId) => !HashSet.has(knownEventIds, eventId));
  const occurredAt = yield* auditTimestamp;

  return A.match(missingEventIds, {
    onEmpty: () =>
      CitedEventIdExistsVerdict.cases.allowed.make({
        audit: {
          detail: CitedEventIdExistsAllowed.make({ checkedEventIds }),
          evaluator: "@beep/repo-cli/qa/cited-event-id-exists",
          gateId: citedEventIdExistsGateId,
          occurredAt,
          outcome: "allowed",
          reason: "Every cited event id appears in the round witness log.",
        },
      }),
    onNonEmpty: (missing) =>
      CitedEventIdExistsVerdict.cases.denied.make({
        audit: {
          detail: CitedEventIdExistsDenied.make({ checkedEventIds, missingEventIds: missing }),
          evaluator: "@beep/repo-cli/qa/cited-event-id-exists",
          gateId: citedEventIdExistsGateId,
          occurredAt,
          outcome: "denied",
          reason: "One or more cited event ids are absent from the round witness log.",
        },
      }),
  });
});

/**
 * Requested and declared round numbers consumed by the coherence gate.
 *
 * **Example** (Create round-coherence input)
 *
 * ```ts
 * import { DeclaredRoundCoherentInput } from "@beep/repo-cli/commands/Qa"
 *
 * const input = DeclaredRoundCoherentInput.make({ declaredRound: 2, requestedRound: 1 })
 * console.log(input.declaredRound) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DeclaredRoundCoherentInput extends S.Opaque<
  DeclaredRoundCoherentInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    declaredRound: RoundNumber,
    requestedRound: RoundNumber,
  }).pipe(
    $I.annoteSchema("DeclaredRoundCoherentInput", {
      description: "Requested and inventory-declared round numbers consumed by the coherence gate.",
    })
  )
) {}

class DeclaredRoundCoherenceDetail extends S.Opaque<DeclaredRoundCoherenceDetail, { readonly brand: unique symbol }>()(
  S.Struct({
    declaredRound: RoundNumber,
    requestedRound: RoundNumber,
  }).pipe(
    $I.annoteSchema("DeclaredRoundCoherenceDetail", {
      description: "Requested and declared round numbers recorded by a coherence verdict.",
    })
  )
) {}

/**
 * Audited verdict for inventory round coherence.
 *
 * **Example** (Inspect verdict cases)
 *
 * ```ts
 * import { DeclaredRoundCoherentVerdict } from "@beep/repo-cli/commands/Qa"
 *
 * console.log(DeclaredRoundCoherentVerdict.discriminants) // ["allowed", "denied"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DeclaredRoundCoherentVerdict = GateVerdict(
  "DeclaredRoundCoherentVerdict",
  DeclaredRoundCoherenceDetail,
  DeclaredRoundCoherenceDetail
);

/**
 * Runtime type decoded by {@link DeclaredRoundCoherentVerdict}.
 *
 * @category models
 * @since 0.0.0
 */
export type DeclaredRoundCoherentVerdict = typeof DeclaredRoundCoherentVerdict.Type;

/**
 * Blocking declaration for requested and declared round coherence.
 *
 * **Example** (Inspect the round gate)
 *
 * ```ts
 * import { DeclaredRoundCoherentGate } from "@beep/repo-cli/commands/Qa"
 *
 * console.log(DeclaredRoundCoherentGate.id) // "declared-round-coherent"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DeclaredRoundCoherentGate = alwaysBlockingGate(
  declaredRoundCoherentGateId,
  declaredRoundCoherentPredicateType
);

const roundNumberEquivalence = S.toEquivalence(RoundNumber);

/**
 * Compares the requested round with the round declared by an inventory.
 *
 * **Example** (Build a round evaluation)
 *
 * ```ts
 * import { DeclaredRoundCoherentInput, evaluateDeclaredRoundCoherent } from "@beep/repo-cli/commands/Qa"
 * import * as Effect from "effect/Effect";
 * const program = evaluateDeclaredRoundCoherent(
 *   DeclaredRoundCoherentInput.make({ declaredRound: 1, requestedRound: 1 })
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const evaluateDeclaredRoundCoherent: GateEvaluator<DeclaredRoundCoherentInput, DeclaredRoundCoherentVerdict> =
  Effect.fn("QaJudgeContract.evaluateDeclaredRoundCoherent")(function* (
    input: DeclaredRoundCoherentInput
  ): Effect.fn.Return<DeclaredRoundCoherentVerdict> {
    const occurredAt = yield* auditTimestamp;
    const detail = DeclaredRoundCoherenceDetail.make(input);
    return roundNumberEquivalence(input.declaredRound, input.requestedRound)
      ? DeclaredRoundCoherentVerdict.cases.allowed.make({
          audit: {
            detail,
            evaluator: "@beep/repo-cli/qa/declared-round-coherent",
            gateId: declaredRoundCoherentGateId,
            occurredAt,
            outcome: "allowed",
            reason: "The inventory declares the requested QA round.",
          },
        })
      : DeclaredRoundCoherentVerdict.cases.denied.make({
          audit: {
            detail,
            evaluator: "@beep/repo-cli/qa/declared-round-coherent",
            gateId: declaredRoundCoherentGateId,
            occurredAt,
            outcome: "denied",
            reason: "The inventory declares a different QA round than the requested round.",
          },
        });
  });

/**
 * Artifact and event leaf verdicts consumed by the aggregate consistency gate.
 *
 * **Example** (Inspect aggregate input fields)
 *
 * ```ts
 * import { EvidenceCrossCheckCleanInput } from "@beep/repo-cli/commands/Qa"
 *
 * console.log(EvidenceCrossCheckCleanInput.fields.artifactVerdict !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EvidenceCrossCheckCleanInput extends S.Opaque<
  EvidenceCrossCheckCleanInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    artifactVerdict: CitedArtifactExistsVerdict,
    eventIdVerdict: CitedEventIdExistsVerdict,
  }).pipe(
    $I.annoteSchema("EvidenceCrossCheckCleanInput", {
      description: "Artifact and event leaf verdicts consumed by the aggregate evidence consistency gate.",
    })
  )
) {}

class EvidenceCrossCheckCleanAllowed extends S.Opaque<
  EvidenceCrossCheckCleanAllowed,
  { readonly brand: unique symbol }
>()(
  S.Struct({}).pipe(
    $I.annoteSchema("EvidenceCrossCheckCleanAllowed", {
      description: "Observation detail for an evidence cross-check with no missing citations.",
    })
  )
) {}

const EvidenceCrossCheckCleanDeniedFields = S.Struct({
  missingEventIds: S.Array(S.Int),
  missingPaths: S.Array(S.String),
});
const EvidenceCrossCheckHasMissingCitation = S.makeFilter(
  (detail: typeof EvidenceCrossCheckCleanDeniedFields.Type) =>
    A.isReadonlyArrayNonEmpty(detail.missingPaths) || A.isReadonlyArrayNonEmpty(detail.missingEventIds),
  $I.annote("EvidenceCrossCheckHasMissingCitation", {
    title: "Evidence cross-check has a missing citation",
    description: "A denied aggregate cross-check names at least one missing artifact or event id.",
    message: "Expected at least one missing artifact path or event id",
  })
);

class EvidenceCrossCheckCleanDenied extends S.Opaque<
  EvidenceCrossCheckCleanDenied,
  { readonly brand: unique symbol }
>()(
  EvidenceCrossCheckCleanDeniedFields.check(EvidenceCrossCheckHasMissingCitation).pipe(
    $I.annoteSchema("EvidenceCrossCheckCleanDenied", {
      description: "Ordered missing artifact paths and event ids recorded by a denied aggregate cross-check.",
    })
  )
) {}

/**
 * Audited verdict for the derived evidence consistency check.
 *
 * **Example** (Inspect aggregate verdict cases)
 *
 * ```ts
 * import { EvidenceCrossCheckCleanVerdict } from "@beep/repo-cli/commands/Qa"
 *
 * console.log(EvidenceCrossCheckCleanVerdict.discriminants) // ["allowed", "denied"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EvidenceCrossCheckCleanVerdict = GateVerdict(
  "EvidenceCrossCheckCleanVerdict",
  EvidenceCrossCheckCleanAllowed,
  EvidenceCrossCheckCleanDenied
);

/**
 * Runtime type decoded by {@link EvidenceCrossCheckCleanVerdict}.
 *
 * @category models
 * @since 0.0.0
 */
export type EvidenceCrossCheckCleanVerdict = typeof EvidenceCrossCheckCleanVerdict.Type;

/**
 * Blocking declaration for the derived artifact-and-event settlement.
 *
 * **Example** (Inspect the aggregate gate)
 *
 * ```ts
 * import { EvidenceCrossCheckCleanGate } from "@beep/repo-cli/commands/Qa"
 *
 * console.log(EvidenceCrossCheckCleanGate.id) // "evidence-cross-check-clean"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EvidenceCrossCheckCleanGate = alwaysBlockingGate(
  evidenceCrossCheckCleanGateId,
  evidenceCrossCheckPredicateType
);

const missingPathsFromArtifactVerdict = (verdict: CitedArtifactExistsVerdict): ReadonlyArray<string> =>
  CitedArtifactExistsVerdict.match(verdict, {
    allowed: A.empty<string>,
    denied: ({ audit }) => audit.detail.missingPaths,
  });

const missingEventIdsFromVerdict = (verdict: CitedEventIdExistsVerdict): ReadonlyArray<number> =>
  CitedEventIdExistsVerdict.match(verdict, {
    allowed: A.empty<number>,
    denied: ({ audit }) => audit.detail.missingEventIds,
  });

/**
 * Settles artifact and event leaf verdicts as one derived aggregate verdict.
 *
 * **Example** (Inspect the evaluator)
 *
 * ```ts
 * import { evaluateEvidenceCrossCheckClean } from "@beep/repo-cli/commands/Qa"
 *
 * console.log(typeof evaluateEvidenceCrossCheckClean) // "function"
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const evaluateEvidenceCrossCheckClean: GateEvaluator<
  EvidenceCrossCheckCleanInput,
  EvidenceCrossCheckCleanVerdict
> = Effect.fn("QaJudgeContract.evaluateEvidenceCrossCheckClean")(function* (
  input: EvidenceCrossCheckCleanInput
): Effect.fn.Return<EvidenceCrossCheckCleanVerdict> {
  const missingPaths = missingPathsFromArtifactVerdict(input.artifactVerdict);
  const missingEventIds = missingEventIdsFromVerdict(input.eventIdVerdict);
  const occurredAt = yield* auditTimestamp;

  return A.match(missingPaths, {
    onEmpty: () =>
      A.match(missingEventIds, {
        onEmpty: () =>
          EvidenceCrossCheckCleanVerdict.cases.allowed.make({
            audit: {
              detail: EvidenceCrossCheckCleanAllowed.make({}),
              evaluator: "@beep/repo-cli/qa/evidence-cross-check-clean",
              gateId: evidenceCrossCheckCleanGateId,
              occurredAt,
              outcome: "allowed",
              reason: "Every artifact and event citation is backed by the round.",
            },
          }),
        onNonEmpty: (events) =>
          EvidenceCrossCheckCleanVerdict.cases.denied.make({
            audit: {
              detail: EvidenceCrossCheckCleanDenied.make({ missingEventIds: events, missingPaths: A.empty() }),
              evaluator: "@beep/repo-cli/qa/evidence-cross-check-clean",
              gateId: evidenceCrossCheckCleanGateId,
              occurredAt,
              outcome: "denied",
              reason: "One or more artifact or event citations are not backed by the round.",
            },
          }),
      }),
    onNonEmpty: (paths) =>
      EvidenceCrossCheckCleanVerdict.cases.denied.make({
        audit: {
          detail: EvidenceCrossCheckCleanDenied.make({ missingEventIds, missingPaths: paths }),
          evaluator: "@beep/repo-cli/qa/evidence-cross-check-clean",
          gateId: evidenceCrossCheckCleanGateId,
          occurredAt,
          outcome: "denied",
          reason: "One or more artifact or event citations are not backed by the round.",
        },
      }),
  });
});

/**
 * Extracted JSON candidate consumed by the conditional inventory-decode gate.
 *
 * **Example** (Create output-decode input)
 *
 * ```ts
 * import { JudgeOutputInventoryDecodesInput } from "@beep/repo-cli/commands/Qa"
 *
 * const input = JudgeOutputInventoryDecodesInput.make({ candidate: "{}" })
 * console.log(input.candidate) // "{}"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JudgeOutputInventoryDecodesInput extends S.Opaque<
  JudgeOutputInventoryDecodesInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({ candidate: S.String }).pipe(
    $I.annoteSchema("JudgeOutputInventoryDecodesInput", {
      description: "JSON candidate already extracted from judge output for inventory schema decoding.",
    })
  )
) {}

class JudgeOutputInventoryDecodesAllowed extends S.Opaque<
  JudgeOutputInventoryDecodesAllowed,
  { readonly brand: unique symbol }
>()(
  S.Struct({ inventory: QaInventory }).pipe(
    $I.annoteSchema("JudgeOutputInventoryDecodesAllowed", {
      description: "Schema-decoded QA inventory carried by an allowed judge-output verdict.",
    })
  )
) {}

/**
 * Decode stage that denies a judge-output inventory candidate.
 *
 * **Details**
 *
 * Adapters match on this domain to restore their flow-specific operator
 * messages (`judge-ingest` and `judge-lint` word the same failure differently)
 * while the gate reason itself stays flow-neutral.
 *
 * **Example** (Match a decode failure)
 *
 * ```ts
 * import { JudgeOutputDecodeFailure } from "@beep/repo-cli/commands/Qa"
 *
 * console.log(JudgeOutputDecodeFailure.match("malformed-json", {
 *   "inventory-schema-rejected": () => "schema",
 *   "malformed-json": () => "json"
 * })) // "json"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JudgeOutputDecodeFailure = LiteralKit(["malformed-json", "inventory-schema-rejected"]).pipe(
  $I.annoteSchema("JudgeOutputDecodeFailure", {
    description: "Fail-closed decode stages that deny a judge-output inventory candidate.",
  })
);

/**
 * Runtime type decoded by {@link JudgeOutputDecodeFailure}.
 *
 * @category models
 * @since 0.0.0
 */
export type JudgeOutputDecodeFailure = typeof JudgeOutputDecodeFailure.Type;

class JudgeOutputInventoryDecodesDenied extends S.Opaque<
  JudgeOutputInventoryDecodesDenied,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    failure: JudgeOutputDecodeFailure,
    issue: S.String.annotateKey({
      description: "Rendered parser or schema issue that denied the candidate, kept for diagnostics.",
    }),
  }).pipe(
    $I.annoteSchema("JudgeOutputInventoryDecodesDenied", {
      description: "Decode stage and rendered issue that denied an extracted judge-output inventory candidate.",
    })
  )
) {}

/**
 * Audited verdict for an extracted judge-output inventory candidate.
 *
 * **Example** (Inspect decode verdict cases)
 *
 * ```ts
 * import { JudgeOutputInventoryDecodesVerdict } from "@beep/repo-cli/commands/Qa"
 *
 * console.log(JudgeOutputInventoryDecodesVerdict.discriminants) // ["allowed", "denied"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JudgeOutputInventoryDecodesVerdict = GateVerdict(
  "JudgeOutputInventoryDecodesVerdict",
  JudgeOutputInventoryDecodesAllowed,
  JudgeOutputInventoryDecodesDenied
);

/**
 * Runtime type decoded by {@link JudgeOutputInventoryDecodesVerdict}.
 *
 * @category models
 * @since 0.0.0
 */
export type JudgeOutputInventoryDecodesVerdict = typeof JudgeOutputInventoryDecodesVerdict.Type;

/**
 * Blocking declaration for judge-output inventory decode.
 *
 * **Details**
 *
 * The gate is always applicable: `judge-ingest` feeds it the JSON block
 * extracted from raw judge output and `judge-lint` feeds it the committed
 * inventory file, so both flows run every declared gate and the kernel's
 * completion evaluator never sees an unverifiable conditional blocker.
 *
 * **Example** (Inspect decode gate applicability)
 *
 * ```ts
 * import { JudgeOutputInventoryDecodesGate } from "@beep/repo-cli/commands/Qa"
 *
 * console.log(JudgeOutputInventoryDecodesGate.applicability.kind) // "always"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const JudgeOutputInventoryDecodesGate = alwaysBlockingGate(
  judgeOutputInventoryDecodesGateId,
  judgeOutputInventoryPredicateType
);

const outputDecodeDenial = (
  failure: JudgeOutputDecodeFailure,
  issue: string,
  occurredAt: string
): JudgeOutputInventoryDecodesVerdict =>
  JudgeOutputInventoryDecodesVerdict.cases.denied.make({
    audit: {
      detail: JudgeOutputInventoryDecodesDenied.make({ failure, issue }),
      evaluator: "@beep/repo-cli/qa/judge-output-inventory-decodes",
      gateId: judgeOutputInventoryDecodesGateId,
      occurredAt,
      outcome: "denied",
      reason: JudgeOutputDecodeFailure.match(failure, {
        "inventory-schema-rejected": () => "The judge output candidate does not decode as qa-inventory/v1.",
        "malformed-json": () => "The judge output candidate does not parse as JSON.",
      }),
    },
  });

/**
 * Schema-decodes an extracted judge-output candidate without moving extraction into the gate.
 *
 * **Details**
 *
 * Malformed JSON and inventory-schema rejection are denied verdict values that
 * carry the rendered decoder issue, so adapters keep the parser or schema
 * detail as the error cause and match the failure stage to restore their
 * existing `QaCommandError` messages.
 *
 * **Example** (Build an output-decode evaluation)
 *
 * ```ts
 * import {
 *   JudgeOutputInventoryDecodesInput,
 *   evaluateJudgeOutputInventoryDecodes
 * } from "@beep/repo-cli/commands/Qa"
 * import * as Effect from "effect/Effect";
 * const program = evaluateJudgeOutputInventoryDecodes(
 *   JudgeOutputInventoryDecodesInput.make({ candidate: "{}" })
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const evaluateJudgeOutputInventoryDecodes: GateEvaluator<
  JudgeOutputInventoryDecodesInput,
  JudgeOutputInventoryDecodesVerdict
> = Effect.fn("QaJudgeContract.evaluateJudgeOutputInventoryDecodes")(function* (
  input: JudgeOutputInventoryDecodesInput
): Effect.fn.Return<JudgeOutputInventoryDecodesVerdict> {
  const occurredAt = yield* auditTimestamp;
  const parsed = yield* Effect.result(decodeJsonEffect(input.candidate));

  return yield* Result.match(parsed, {
    onFailure: (issue) => Effect.succeed(outputDecodeDenial("malformed-json", issue.message, occurredAt)),
    onSuccess: (value) =>
      Effect.result(decodeQaInventory(value)).pipe(
        Effect.map(
          Result.match({
            onFailure: (issue) => outputDecodeDenial("inventory-schema-rejected", issue.message, occurredAt),
            onSuccess: (inventory) =>
              JudgeOutputInventoryDecodesVerdict.cases.allowed.make({
                audit: {
                  detail: JudgeOutputInventoryDecodesAllowed.make({ inventory }),
                  evaluator: "@beep/repo-cli/qa/judge-output-inventory-decodes",
                  gateId: judgeOutputInventoryDecodesGateId,
                  occurredAt,
                  outcome: "allowed",
                  reason: "The extracted judge output decodes as qa-inventory/v1.",
                },
              }),
          })
        )
      ),
  });
});

const qaReceiptType = (name: string): EvidencePredicateType =>
  EvidencePredicateType.make($QaId.create(`receipts/${name}/v2`).iri);

const qaJudgeContractId = SkillContractId.make($BeepId.create("contracts").create("qa-inventory/v1").iri);
const $QaJudgeSchemas = $BeepId.create("schemas");
const qaJudgeContractVersion = SemanticVersion.make("2.0.0");

/**
 * Evidence subject every gate summary for the judge contract must be bound to.
 *
 * **Details**
 *
 * The subject names the contract identity as `<id>@<version>` and carries the
 * SHA-256 of that UTF-8 name. The digest is pinned here and re-derived in the
 * parity suite, so a version bump that forgets the digest fails a test rather
 * than silently rebinding completion evidence.
 *
 * **Example** (Inspect the contract subject)
 *
 * ```ts
 * import { QaJudgeContractSubject } from "@beep/repo-cli/commands/Qa"
 *
 * console.log(QaJudgeContractSubject.name) // "https://beep-effect.com/ns/contracts/qa-inventory/v1@2.0.0"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const QaJudgeContractSubject = EvidenceSubject.make({
  digest: EvidenceDigest.make({
    sha256: Sha256Hex.make("6a41c1628f333f0eb40897417655ee86d39b786cc065ec92590aa8d64a07b371"),
  }),
  name: `${qaJudgeContractId}@${qaJudgeContractVersion}`,
});

/**
 * Complete typed contract instance for the `qa-inventory/v1` judge.
 *
 * **Details**
 *
 * Declaration order is observable and matches the executable dependency order
 * shared by `judge-ingest` and `judge-lint`: output decode first (its allowed
 * detail is the inventory every later gate reads), round coherence, the
 * artifact and event leaves, then aggregate settlement. Every declaration is
 * always applicable, so the kernel's completion evaluator can settle this
 * contract from a gate summary.
 *
 * **Example** (Inspect gate order)
 *
 * ```ts
 * import { QaJudgeContract } from "@beep/repo-cli/commands/Qa"
 * import * as A from "effect/Array"
 *
 * console.log(A.map(QaJudgeContract.gates.declarations, (gate) => gate.id))
 * ```
 *
 * @category aggregates
 * @since 0.0.0
 */
export const QaJudgeContract = SkillContract.make({
  evidenceSubject: QaJudgeContractSubject,
  gates: GateRegistry.make({
    declarations: [
      JudgeOutputInventoryDecodesGate,
      DeclaredRoundCoherentGate,
      CitedArtifactExistsGate,
      CitedEventIdExistsGate,
      EvidenceCrossCheckCleanGate,
    ],
  }),
  id: qaJudgeContractId,
  input: SchemaReference.make({
    schemaId: SchemaReferenceId.make($QaJudgeSchemas.create("qa-judge-input/v1").iri),
  }),
  output: SchemaReference.make({
    schemaId: SchemaReferenceId.make($QaJudgeSchemas.create("qa-judge-settlement/v1").iri),
  }),
  promise: "Validate a qa-inventory/v1 value against its declared round and cited evidence.",
  receiptTypes: ReceiptTypeBindings.make({
    failure: FailurePredicateType,
    gateSummary: GateSummaryPredicateType,
    ladder: EvidenceLadderReceiptTypes.make({
      accepted: qaReceiptType("accepted"),
      delivered: qaReceiptType("delivered"),
      persisted: qaReceiptType("persisted"),
      semanticallyApplied: qaReceiptType("semantically-applied"),
    }),
    recoveryAttempt: qaReceiptType("recovery-attempt"),
  }),
  recovery: NoRecoveryPolicy.make({}),
  version: qaJudgeContractVersion,
});

/**
 * Artifact, event, and aggregate verdicts of one round cross-check.
 *
 * **Example** (Inspect settlement fields)
 *
 * ```ts
 * import { RoundCrossCheckSettlement } from "@beep/repo-cli/commands/Qa"
 *
 * console.log(RoundCrossCheckSettlement.fields.crossCheck !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RoundCrossCheckSettlement extends S.Opaque<RoundCrossCheckSettlement, { readonly brand: unique symbol }>()(
  S.Struct({
    artifact: CitedArtifactExistsVerdict,
    crossCheck: EvidenceCrossCheckCleanVerdict,
    eventId: CitedEventIdExistsVerdict,
  }).pipe(
    $I.annoteSchema("RoundCrossCheckSettlement", {
      description: "Artifact, event, and aggregate verdicts settled for one round cross-check.",
    })
  )
) {}

/**
 * Leaf and aggregate verdicts of one QA judge settlement, bound to the judged inventory.
 *
 * **Details**
 *
 * Each verdict is optional because the flows stop early: a denied output
 * decode means no later gate runs. A gate that did not run is certified as
 * `untested`, never as passed.
 *
 * **Example** (Describe a settlement that stopped at decode)
 *
 * ```ts
 * import { QaJudgeSettlement } from "@beep/repo-cli/commands/Qa"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import { EvidenceDigest, EvidenceSubject } from "@beep/skill-contract/EvidenceReceipt"
 * import * as O from "effect/Option"
 *
 * const settlement = QaJudgeSettlement.make({
 *   artifact: O.none(),
 *   crossCheck: O.none(),
 *   decode: O.none(),
 *   eventId: O.none(),
 *   inventory: EvidenceSubject.make({
 *     digest: EvidenceDigest.make({
 *       sha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *     }),
 *     name: "qa/round-1/inventory.json"
 *   }),
 *   round: O.none()
 * })
 * console.log(O.isNone(settlement.decode)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QaJudgeSettlement extends S.Opaque<QaJudgeSettlement, { readonly brand: unique symbol }>()(
  S.Struct({
    artifact: S.Option(CitedArtifactExistsVerdict),
    crossCheck: S.Option(EvidenceCrossCheckCleanVerdict),
    decode: S.Option(JudgeOutputInventoryDecodesVerdict),
    eventId: S.Option(CitedEventIdExistsVerdict),
    inventory: EvidenceSubject.annotateKey({
      description: "Name and digest of the judged inventory bytes; the certificate envelope subject.",
    }),
    round: S.Option(DeclaredRoundCoherentVerdict),
  }).pipe(
    $I.annoteSchema("QaJudgeSettlement", {
      description: "Optional per-gate verdicts of one QA judge settlement bound to the judged inventory digest.",
    })
  )
) {}

const qaJudgeCertificateVerifier = GateSummaryVerifier.make({
  id: URLStr.make($QaId.create("verifiers/judge-settlement/v1").iri),
  version: { [qaJudgeContractId]: qaJudgeContractVersion },
});

const certifiedOutcome = (verdict: O.Option<{ readonly verdict: GateOutcome }>): CheckOutcome =>
  O.match(verdict, {
    onNone: () => CheckOutcome.Enum.untested,
    onSome: ({ verdict }) =>
      GateOutcome.match(verdict, { allowed: () => CheckOutcome.Enum.passed, denied: () => CheckOutcome.Enum.failed }),
  });

/**
 * Produces the gate certificate for one QA judge settlement.
 *
 * **Details**
 *
 * One check per `QaJudgeContract` declaration, in declaration order (each
 * declaration is paired with its own verdict, so a renamed or reordered gate
 * fails the parity suite instead of vanishing): an
 * allowed verdict is `passed`, a denied verdict is `failed`, and a gate that
 * did not run is `untested`. Every declared gate is listed and in reach, so
 * reach is `complete`; the aggregate is settled by the kernel and is never
 * `passed` while any gate is untested. The envelope subject is the judged
 * inventory digest. The certificate is unsigned.
 *
 * **Example** (Certify a settlement that never ran)
 *
 * ```ts
 * import { certifyQaJudgeSettlement, QaJudgeSettlement } from "@beep/repo-cli/commands/Qa"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import { EvidenceDigest, EvidenceSubject } from "@beep/skill-contract/EvidenceReceipt"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const inventory = EvidenceSubject.make({
 *   digest: EvidenceDigest.make({
 *     sha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   }),
 *   name: "qa/round-1/inventory.json"
 * })
 * const receipt = Effect.runSync(
 *   certifyQaJudgeSettlement(
 *     QaJudgeSettlement.make({
 *       artifact: O.none(),
 *       crossCheck: O.none(),
 *       decode: O.none(),
 *       eventId: O.none(),
 *       inventory,
 *       round: O.none()
 *     })
 *   )
 * )
 * console.log(receipt.predicate.outcome) // "untested"
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const certifyQaJudgeSettlement = Effect.fn("QaJudgeContract.certifyQaJudgeSettlement")(function* (
  settlement: QaJudgeSettlement
): Effect.fn.Return<GateCertificateReceipt> {
  const timeVerified = yield* auditTimestamp;
  const certified: ReadonlyArray<readonly [GateDeclaration, CheckOutcome]> = [
    [JudgeOutputInventoryDecodesGate, certifiedOutcome(settlement.decode)],
    [DeclaredRoundCoherentGate, certifiedOutcome(settlement.round)],
    [CitedArtifactExistsGate, certifiedOutcome(settlement.artifact)],
    [CitedEventIdExistsGate, certifiedOutcome(settlement.eventId)],
    [EvidenceCrossCheckCleanGate, certifiedOutcome(settlement.crossCheck)],
  ];
  const checks = A.map(certified, ([declaration, outcome]) =>
    CertificateCheck.make({
      checkId: declaration.id,
      evidenceSubjects: CheckOutcome.is.untested(outcome) ? [] : [settlement.inventory],
      evidenceType: declaration.evidence.predicateType,
      inReach: true,
      outcome,
      severity: declaration.severity,
    })
  );
  return GateCertificateReceipt.make({
    predicate: GateCertificate.make({
      checks,
      contractSubject: QaJudgeContractSubject,
      outcome: settleGateCertificateOutcome("complete", checks),
      reach: "complete",
      timeVerified,
      verifier: qaJudgeCertificateVerifier,
    }),
    predicateType: GateCertificatePredicateType,
    subject: [settlement.inventory],
  });
});

/**
 * A written QA judge certificate and the subject bound to its exact bytes.
 *
 * **Details**
 *
 * `subject` is the SHA-256 of the encoded `gate-certificate.json` bytes the
 * producer wrote. Apply-by-id plans bind to it, so any change to the written
 * certificate makes a plan stale.
 *
 * **Example** (Inspect the written-certificate fields)
 *
 * ```ts
 * import { QaJudgeCertificate } from "@beep/repo-cli/commands/Qa"
 *
 * console.log(Object.keys(QaJudgeCertificate.fields).sort()) // ["receipt", "subject"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QaJudgeCertificate extends S.Opaque<QaJudgeCertificate, { readonly brand: unique symbol }>()(
  S.Struct({
    receipt: GateCertificateReceipt,
    subject: EvidenceSubject.annotateKey({
      description: "Name and SHA-256 of the exact encoded certificate bytes written by the producer.",
    }),
  }).pipe(
    $I.annoteSchema("QaJudgeCertificate", {
      description: "Written QA judge gate certificate with the subject bound to its exact encoded bytes.",
    })
  )
) {}
