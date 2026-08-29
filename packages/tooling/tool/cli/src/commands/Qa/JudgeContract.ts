/**
 * Typed gate composition for the complete `qa-inventory/v1` judge.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { RoundNumber } from "@beep/qa-capture";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { SemanticVersion } from "@beep/schema/SemanticVersion";
import { ISOStr } from "@beep/schema/Timestamp";
import { Unknown } from "@beep/schema/Unknown";
import {
  AlwaysGateApplicability,
  ConditionalGateApplicability,
  EvidenceLadderReceiptTypes,
  EvidencePredicateType,
  FailurePredicateType,
  GateDeclaration,
  GateEvidenceRequirement,
  GateRegistry,
  GateSummaryPredicateType,
  GateVerdict,
  NoRecoveryPolicy,
  ReceiptTypeBindings,
  SchemaReference,
  SchemaReferenceId,
  SkillContract,
  SkillContractId,
} from "@beep/skill-contract";
import { A, O } from "@beep/utils";
import { DateTime, Effect, HashSet } from "effect";
import * as S from "effect/Schema";
import { CitedArtifactExistsGate, CitedArtifactExistsVerdict } from "./CitedArtifactExistsGate.ts";
import { decodeQaInventory, QaInventory } from "./Inventory.schemas.ts";
import { QaJudgeGateId } from "./QaJudgeGateId.ts";
import type { GateEvaluator } from "@beep/skill-contract";

const $I = $RepoCliId.create("commands/Qa/JudgeContract");
const remediationOwner = "@beep/repo-cli/Qa";
const auditTimestamp = DateTime.now.pipe(Effect.map(DateTime.formatIso), Effect.map(ISOStr.make));

const citedEventIdExistsGateId = QaJudgeGateId.make("cited-event-id-exists");
const declaredRoundCoherentGateId = QaJudgeGateId.make("declared-round-coherent");
const evidenceCrossCheckCleanGateId = QaJudgeGateId.make("evidence-cross-check-clean");
const judgeOutputInventoryDecodesGateId = QaJudgeGateId.make("judge-output-inventory-decodes");

const citedEventIdExistsPredicateType = EvidencePredicateType.make(
  "https://beep-effect.dev/qa/evidence/cited-event-id-exists/v1"
);
const declaredRoundCoherentPredicateType = EvidencePredicateType.make(
  "https://beep-effect.dev/qa/evidence/declared-round-coherent/v1"
);
const evidenceCrossCheckPredicateType = EvidencePredicateType.make(
  "https://beep-effect.dev/qa/evidence/evidence-cross-check/v1"
);
const judgeOutputInventoryPredicateType = EvidencePredicateType.make(
  "https://beep-effect.dev/qa/evidence/judge-output-inventory/v1"
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
export class CitedEventIdExistsInput extends S.Class<CitedEventIdExistsInput>($I`CitedEventIdExistsInput`)(
  {
    citedEventIds: S.Array(S.Int),
    knownEventIds: S.Array(S.Int),
  },
  $I.annote("CitedEventIdExistsInput", {
    description: "Ordered event citations and known witness ids consumed by the event-existence gate.",
  })
) {}

class CitedEventIdExistsAllowed extends S.Class<CitedEventIdExistsAllowed>($I`CitedEventIdExistsAllowed`)(
  { checkedEventIds: S.Array(S.Int) },
  $I.annote("CitedEventIdExistsAllowed", {
    description: "Event citations inspected by an allowed event-existence evaluation.",
  })
) {}

class CitedEventIdExistsDenied extends S.Class<CitedEventIdExistsDenied>($I`CitedEventIdExistsDenied`)(
  {
    checkedEventIds: S.Array(S.Int),
    missingEventIds: S.NonEmptyArray(S.Int),
  },
  $I.annote("CitedEventIdExistsDenied", {
    description: "Event citations inspected by a denied evaluation and the ids absent from the witness log.",
  })
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
 * import { Effect } from "effect"
 *
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
export class DeclaredRoundCoherentInput extends S.Class<DeclaredRoundCoherentInput>($I`DeclaredRoundCoherentInput`)(
  {
    declaredRound: RoundNumber,
    requestedRound: RoundNumber,
  },
  $I.annote("DeclaredRoundCoherentInput", {
    description: "Requested and inventory-declared round numbers consumed by the coherence gate.",
  })
) {}

class DeclaredRoundCoherenceDetail extends S.Class<DeclaredRoundCoherenceDetail>($I`DeclaredRoundCoherenceDetail`)(
  {
    declaredRound: RoundNumber,
    requestedRound: RoundNumber,
  },
  $I.annote("DeclaredRoundCoherenceDetail", {
    description: "Requested and declared round numbers recorded by a coherence verdict.",
  })
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
 * import { Effect } from "effect"
 *
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
export class EvidenceCrossCheckCleanInput extends S.Class<EvidenceCrossCheckCleanInput>(
  $I`EvidenceCrossCheckCleanInput`
)(
  {
    artifactVerdict: CitedArtifactExistsVerdict,
    eventIdVerdict: CitedEventIdExistsVerdict,
  },
  $I.annote("EvidenceCrossCheckCleanInput", {
    description: "Artifact and event leaf verdicts consumed by the aggregate evidence consistency gate.",
  })
) {}

class EvidenceCrossCheckCleanAllowed extends S.Class<EvidenceCrossCheckCleanAllowed>(
  $I`EvidenceCrossCheckCleanAllowed`
)(
  {},
  $I.annote("EvidenceCrossCheckCleanAllowed", {
    description: "Observation detail for an evidence cross-check with no missing citations.",
  })
) {}

const EvidenceCrossCheckCleanDeniedFields = S.Struct({
  missingEventIds: S.Array(S.Int),
  missingPaths: S.Array(S.String),
});
const EvidenceCrossCheckHasMissingCitation = S.makeFilter(
  (detail: typeof EvidenceCrossCheckCleanDeniedFields.Type) =>
    A.isReadonlyArrayNonEmpty(detail.missingPaths) || A.isReadonlyArrayNonEmpty(detail.missingEventIds),
  {
    identifier: $I`EvidenceCrossCheckHasMissingCitation`,
    title: "Evidence cross-check has a missing citation",
    description: "A denied aggregate cross-check names at least one missing artifact or event id.",
    message: "Expected at least one missing artifact path or event id",
  }
);

class EvidenceCrossCheckCleanDenied extends S.Class<EvidenceCrossCheckCleanDenied>($I`EvidenceCrossCheckCleanDenied`)(
  EvidenceCrossCheckCleanDeniedFields.check(EvidenceCrossCheckHasMissingCitation),
  $I.annote("EvidenceCrossCheckCleanDenied", {
    description: "Ordered missing artifact paths and event ids recorded by a denied aggregate cross-check.",
  })
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
    allowed: () => A.empty<string>(),
    denied: ({ audit }) => audit.detail.missingPaths,
  });

const missingEventIdsFromVerdict = (verdict: CitedEventIdExistsVerdict): ReadonlyArray<number> =>
  CitedEventIdExistsVerdict.match(verdict, {
    allowed: () => A.empty<number>(),
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
export class JudgeOutputInventoryDecodesInput extends S.Class<JudgeOutputInventoryDecodesInput>(
  $I`JudgeOutputInventoryDecodesInput`
)(
  { candidate: S.String },
  $I.annote("JudgeOutputInventoryDecodesInput", {
    description: "JSON candidate already extracted from judge output for inventory schema decoding.",
  })
) {}

class JudgeOutputInventoryDecodesAllowed extends S.Class<JudgeOutputInventoryDecodesAllowed>(
  $I`JudgeOutputInventoryDecodesAllowed`
)(
  { inventory: QaInventory },
  $I.annote("JudgeOutputInventoryDecodesAllowed", {
    description: "Schema-decoded QA inventory carried by an allowed judge-output verdict.",
  })
) {}

const JudgeOutputDecodeFailure = LiteralKit(["malformed-json", "inventory-schema-rejected"]).pipe(
  $I.annoteSchema("JudgeOutputDecodeFailure", {
    description: "Fail-closed reasons emitted after judge-output extraction succeeds.",
  })
);

class JudgeOutputInventoryDecodesDenied extends S.Class<JudgeOutputInventoryDecodesDenied>(
  $I`JudgeOutputInventoryDecodesDenied`
)(
  { failure: JudgeOutputDecodeFailure },
  $I.annote("JudgeOutputInventoryDecodesDenied", {
    description: "Decode stage that denied an extracted judge-output inventory candidate.",
  })
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
 * Conditional blocking declaration for extracted judge-output inventory decode.
 *
 * **Example** (Inspect decode gate applicability)
 *
 * ```ts
 * import { JudgeOutputInventoryDecodesGate } from "@beep/repo-cli/commands/Qa"
 *
 * console.log(JudgeOutputInventoryDecodesGate.applicability.kind) // "conditional"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const JudgeOutputInventoryDecodesGate = GateDeclaration.make({
  applicability: ConditionalGateApplicability.make({
    condition: SchemaReference.make({
      schemaId: SchemaReferenceId.make("https://beep-effect.dev/qa/conditions/qa-source-kind/v1"),
    }),
  }),
  evidence: GateEvidenceRequirement.make({ predicateType: judgeOutputInventoryPredicateType }),
  id: judgeOutputInventoryDecodesGateId,
  remediationOwner,
  severity: "blocking",
});

const outputDecodeDenial = (
  failure: typeof JudgeOutputDecodeFailure.Type,
  occurredAt: ISOStr
): JudgeOutputInventoryDecodesVerdict =>
  JudgeOutputInventoryDecodesVerdict.cases.denied.make({
    audit: {
      detail: JudgeOutputInventoryDecodesDenied.make({ failure }),
      evaluator: "@beep/repo-cli/qa/judge-output-inventory-decodes",
      gateId: judgeOutputInventoryDecodesGateId,
      occurredAt,
      outcome: "denied",
      reason: JudgeOutputDecodeFailure.$match(failure, {
        "inventory-schema-rejected": () =>
          "qa judge-ingest rejected the judge inventory. Check schemaVersion, finding ids (R<round>-<nn>), lens values, and that requiredCount equals the P0+P1 count.",
        "malformed-json": () => "qa judge-ingest could not parse the judge's final JSON block.",
      }),
    },
  });

/**
 * Schema-decodes an extracted judge-output candidate without moving extraction into the gate.
 *
 * **Details**
 *
 * Malformed JSON and inventory-schema rejection are denied verdict values.
 * The adapter retains the existing `QaCommandError` messages.
 *
 * **Example** (Build an output-decode evaluation)
 *
 * ```ts
 * import {
 *   JudgeOutputInventoryDecodesInput,
 *   evaluateJudgeOutputInventoryDecodes
 * } from "@beep/repo-cli/commands/Qa"
 * import { Effect } from "effect"
 *
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
  const parsed = yield* Effect.option(Unknown.decodeEffectFromJsonString(input.candidate));

  return yield* O.match(parsed, {
    onNone: () => Effect.succeed(outputDecodeDenial("malformed-json", occurredAt)),
    onSome: (value) =>
      Effect.option(decodeQaInventory(value)).pipe(
        Effect.map(
          O.match({
            onNone: () => outputDecodeDenial("inventory-schema-rejected", occurredAt),
            onSome: (inventory) =>
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
  EvidencePredicateType.make(`https://beep-effect.dev/qa/receipts/${name}/v1`);

/**
 * Complete typed contract instance for the `qa-inventory/v1` judge.
 *
 * **Details**
 *
 * Declaration order is observable and matches judge execution: artifact and
 * event leaves, round coherence, aggregate settlement, then conditional output
 * decode. The output-decode declaration is conditional because lint starts
 * from a committed JSON inventory rather than raw judge output.
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
  gates: GateRegistry.make({
    declarations: [
      CitedArtifactExistsGate,
      CitedEventIdExistsGate,
      DeclaredRoundCoherentGate,
      EvidenceCrossCheckCleanGate,
      JudgeOutputInventoryDecodesGate,
    ],
  }),
  id: SkillContractId.make("https://beep-effect.dev/contracts/qa-inventory/v1"),
  input: SchemaReference.make({
    schemaId: SchemaReferenceId.make("https://beep-effect.dev/schemas/qa-judge-input/v1"),
  }),
  output: SchemaReference.make({
    schemaId: SchemaReferenceId.make("https://beep-effect.dev/schemas/qa-judge-settlement/v1"),
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
  version: SemanticVersion.make("1.0.0"),
});
