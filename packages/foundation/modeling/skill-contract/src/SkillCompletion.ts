/**
 * Evaluator-only completion proof and terminal skill states.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SkillContractId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { SemanticVersion } from "@beep/schema/SemanticVersion";
import { Effect, Tuple } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Delivered, EvidenceLadderState, evidenceLadderFor, SemanticallyApplied } from "./EvidenceLadder.ts";
import { EvidenceSubject, GateSummaryReceipt } from "./EvidenceReceipt.ts";
import { EvidencePredicateType, GateApplicability, GateId, GateOutcome, GateSeverity } from "./Gate.ts";
import { FailureReceipt } from "./Recovery.ts";
import { SkillContract, SkillContractId } from "./SkillContract.ts";

const $I = $SkillContractId.create("SkillCompletion");
const predicateTypeEquivalence = S.toEquivalence(EvidencePredicateType);
const gateIdEquivalence = S.toEquivalence(GateId);
const gateSeverityEquivalence = S.toEquivalence(GateSeverity);

/**
 * Persistable structural evidence emitted from a live completion proof.
 *
 * **Details**
 *
 * This receipt is historical evidence, not live proof. Decoding it never
 * grants {@link SkillCompletion}; callers must run the evaluator again.
 *
 * **Example** (Inspect completion receipt fields)
 *
 * ```ts
 * import { SkillCompletionReceipt } from "@beep/skill-contract"
 *
 * console.log(SkillCompletionReceipt.fields.gateSummary !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillCompletionReceipt extends S.Class<SkillCompletionReceipt>($I`SkillCompletionReceipt`)(
  {
    contractId: SkillContractId,
    contractVersion: SemanticVersion,
    gateSummary: GateSummaryReceipt,
    ladder: SemanticallyApplied,
    outputSubjects: S.NonEmptyArray(EvidenceSubject),
  },
  $I.annote("SkillCompletionReceipt", {
    description: "Persistable structural receipt projected from an evaluator-only live completion proof.",
  })
) {}

class SkillCompletionValue {
  readonly #completed = true;
  readonly receipt: SkillCompletionReceipt;

  private constructor(receipt: SkillCompletionReceipt) {
    this.receipt = receipt;
  }

  static readonly make = (receipt: SkillCompletionReceipt): SkillCompletionValue => new SkillCompletionValue(receipt);

  static readonly is = (input: unknown): input is SkillCompletionValue =>
    input instanceof SkillCompletionValue && input.#completed;
}

/**
 * Opaque runtime proof that a skill completed with top-rung and blocking-gate evidence.
 *
 * **Details**
 *
 * The implementation class is module-private and the schema is from-self.
 * Structural completion receipts cannot be decoded or constructed as live
 * proof; only {@link evaluateSkillCompletion} can create this value.
 *
 * @category models
 * @since 0.0.0
 */
export type SkillCompletion = SkillCompletionValue;

/**
 * From-self schema refusing structural construction of live completion proof.
 *
 * **Example** (Reject structural completion data)
 *
 * ```ts
 * import { SkillCompletion } from "@beep/skill-contract"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(SkillCompletion)({ receipt: {} })) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SkillCompletion = S.declare<SkillCompletion>(SkillCompletionValue.is).pipe(
  $I.annoteSchema("SkillCompletion", {
    description: "Evaluator-only live completion proof that refuses structural receipt decoding.",
  })
);

/**
 * Projects live completion proof to its persistable structural receipt.
 *
 * **Details**
 *
 * The reverse conversion is intentionally unavailable. A stored receipt must
 * be re-evaluated against a live contract and its complete gate evidence.
 *
 * **Example** (Inspect projection function)
 *
 * ```ts
 * import { toSkillCompletionReceipt } from "@beep/skill-contract"
 *
 * console.log(typeof toSkillCompletionReceipt) // "function"
 * ```
 *
 * @param completion - Live proof returned by {@link evaluateSkillCompletion}.
 * @returns Stable structural completion receipt.
 * @category encoding
 * @since 0.0.0
 */
export const toSkillCompletionReceipt = (completion: SkillCompletion): SkillCompletionReceipt =>
  SkillCompletionReceipt.make({
    contractId: completion.receipt.contractId,
    contractVersion: completion.receipt.contractVersion,
    gateSummary: completion.receipt.gateSummary,
    ladder: completion.receipt.ladder,
    outputSubjects: completion.receipt.outputSubjects,
  });

/**
 * Inputs required to evaluate opaque skill completion.
 *
 * **Example** (Inspect completion evaluator inputs)
 *
 * ```ts
 * import { EvaluateSkillCompletionInput } from "@beep/skill-contract"
 *
 * console.log(EvaluateSkillCompletionInput.fields.contract !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EvaluateSkillCompletionInput extends S.Class<EvaluateSkillCompletionInput>(
  $I`EvaluateSkillCompletionInput`
)(
  {
    contract: SkillContract,
    gateSummary: GateSummaryReceipt,
    ladder: SemanticallyApplied,
    outputSubjects: S.NonEmptyArray(EvidenceSubject),
  },
  $I.annote("EvaluateSkillCompletionInput", {
    description: "Contract, top-rung evidence, gate summary, and output subjects evaluated for live completion.",
  })
) {}

/**
 * Machine-readable evaluator invariant failures.
 *
 * **Example** (Inspect invariant reasons)
 *
 * ```ts
 * import { CompletionInvariantReason } from "@beep/skill-contract"
 *
 * console.log(CompletionInvariantReason.Options)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const CompletionInvariantReason = LiteralKit([
  "gate-summary-predicate-type-mismatch",
  "ladder-predicate-type-mismatch",
  "gate-summary-registry-mismatch",
]).pipe(
  $I.annoteSchema("CompletionInvariantReason", {
    description: "Malformed internal receipt and registry bindings rejected by completion evaluation.",
  })
);

/**
 * Runtime type decoded by {@link CompletionInvariantReason}.
 *
 * @category errors
 * @since 0.0.0
 */
export type CompletionInvariantReason = typeof CompletionInvariantReason.Type;

/**
 * Boundary failure for malformed internal completion bindings.
 *
 * **Example** (Construct an invariant error)
 *
 * ```ts
 * import { CompletionInvariantError } from "@beep/skill-contract"
 *
 * const error = CompletionInvariantError.make({
 *   message: "Gate summary predicate type does not match the contract binding.",
 *   reason: "gate-summary-predicate-type-mismatch"
 * })
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CompletionInvariantError extends S.TaggedError<CompletionInvariantError>($I`CompletionInvariantError`)(
  "CompletionInvariantError",
  {
    message: S.NonEmptyString,
    reason: CompletionInvariantReason,
  },
  $I.annote("CompletionInvariantError", {
    description: "Malformed internal contract, ladder, or gate-summary binding rejected by completion evaluation.",
  })
) {}

/**
 * Allowed completion evaluation carrying evaluator-only live proof.
 *
 * **Example** (Inspect allowed completion fields)
 *
 * ```ts
 * import { CompletionAllowed } from "@beep/skill-contract"
 *
 * console.log(CompletionAllowed.fields.completion !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CompletionAllowed extends S.Class<CompletionAllowed>($I`CompletionAllowed`)(
  {
    completion: SkillCompletion,
    verdict: S.tag("allowed"),
  },
  $I.annote("CompletionAllowed", {
    description: "Allowed completion evaluation carrying evaluator-only live proof.",
  })
) {
  static readonly thunkThis = () => this;
}

/**
 * Denied completion evaluation carrying the audited gate summary as a value.
 *
 * **Example** (Inspect denied completion fields)
 *
 * ```ts
 * import { CompletionDenied } from "@beep/skill-contract"
 *
 * console.log(CompletionDenied.fields.gateSummary !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CompletionDenied extends S.Class<CompletionDenied>($I`CompletionDenied`)(
  {
    gateSummary: GateSummaryReceipt,
    verdict: S.tag("denied"),
  },
  $I.annote("CompletionDenied", {
    description: "Denied completion evaluation carrying the audited gate summary as a successful value.",
  })
) {
  static readonly thunkThis = () => this;
}

/**
 * Value result of completion evaluation; denials do not use the Effect error channel.
 *
 * **Example** (Inspect completion verdicts)
 *
 * ```ts
 * import { CompletionEvaluation } from "@beep/skill-contract"
 *
 * console.log(CompletionEvaluation.discriminants) // ["allowed", "denied"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CompletionEvaluation = LiteralKit(["allowed", "denied"])
  .mapMembers(Tuple.evolve([CompletionAllowed.thunkThis, CompletionDenied.thunkThis]))
  .pipe(
    S.toTaggedUnion("verdict"),
    $I.annoteSchema("CompletionEvaluation", {
      description: "Allowed evaluator-only completion proof or audited denial value.",
    })
  );

/**
 * Runtime type decoded by {@link CompletionEvaluation}.
 *
 * @category models
 * @since 0.0.0
 */
export type CompletionEvaluation = typeof CompletionEvaluation.Type;

const summaryBindingsMatchRegistry = (input: EvaluateSkillCompletionInput): boolean => {
  const resultIds = A.map(input.gateSummary.predicate.gateResults, (result) => result.gateId);
  const uniqueResultIds = Eq.equals(HashSet.size(HashSet.fromIterable(resultIds)), A.length(resultIds));
  const resultsMatchDeclarations = A.every(input.gateSummary.predicate.gateResults, (result) =>
    O.exists(
      A.findFirst(input.contract.gates.declarations, (declaration) => gateIdEquivalence(declaration.id, result.gateId)),
      (declaration) =>
        gateSeverityEquivalence(declaration.severity, result.severity) &&
        predicateTypeEquivalence(declaration.evidence.predicateType, result.evidenceType) &&
        GateApplicability.match(declaration.applicability, {
          always: () => result.applicable,
          conditional: () => true,
        })
    )
  );

  return uniqueResultIds && resultsMatchDeclarations;
};

const blockingGateIsMissingOrDenied = (input: EvaluateSkillCompletionInput): boolean =>
  A.some(input.contract.gates.declarations, (declaration) => {
    if (!GateSeverity.is.blocking(declaration.severity)) {
      return false;
    }
    return O.match(
      A.findFirst(input.gateSummary.predicate.gateResults, (result) =>
        gateIdEquivalence(result.gateId, declaration.id)
      ),
      {
        onNone: () => true,
        onSome: (result) => result.applicable && GateOutcome.is.denied(result.outcome),
      }
    );
  });

/**
 * Evaluates top-rung and blocking-gate evidence into live opaque completion proof.
 *
 * **Details**
 *
 * Missing or denied blocking-gate evidence returns a `denied` value. The error
 * channel is reserved for malformed internal predicate, ladder, or registry
 * bindings. Only this evaluator can call the module-private completion constructor.
 *
 * **Example** (Inspect completion evaluator)
 *
 * ```ts
 * import { evaluateSkillCompletion } from "@beep/skill-contract"
 *
 * console.log(typeof evaluateSkillCompletion) // "function"
 * ```
 *
 * @param input - Contract and evidence to evaluate.
 * @returns An allowed opaque completion proof or audited denial value.
 * @effects Fails only when internal receipt or registry bindings violate the contract.
 * @category validation
 * @since 0.0.0
 */
export const evaluateSkillCompletion = Effect.fn("SkillCompletion.evaluate")(function* (
  input: EvaluateSkillCompletionInput
): Effect.fn.Return<CompletionEvaluation, CompletionInvariantError> {
  if (!predicateTypeEquivalence(input.gateSummary.predicateType, input.contract.receiptTypes.gateSummary)) {
    return yield* CompletionInvariantError.make({
      message: "Gate summary predicate type does not match the contract binding.",
      reason: "gate-summary-predicate-type-mismatch",
    });
  }
  if (!S.is(evidenceLadderFor(input.contract.receiptTypes.ladder))(input.ladder)) {
    return yield* CompletionInvariantError.make({
      message: "Evidence ladder receipt types do not match the contract bindings.",
      reason: "ladder-predicate-type-mismatch",
    });
  }
  if (!summaryBindingsMatchRegistry(input)) {
    return yield* CompletionInvariantError.make({
      message: "Gate summary results do not bind uniquely and coherently to the contract registry.",
      reason: "gate-summary-registry-mismatch",
    });
  }
  if (blockingGateIsMissingOrDenied(input)) {
    return CompletionDenied.make({ gateSummary: input.gateSummary });
  }

  const receipt = SkillCompletionReceipt.make({
    contractId: input.contract.id,
    contractVersion: input.contract.version,
    gateSummary: input.gateSummary,
    ladder: input.ladder,
    outputSubjects: input.outputSubjects,
  });
  return CompletionAllowed.make({ completion: SkillCompletionValue.make(receipt) });
});

/**
 * Successfully completed live skill terminal carrying opaque evaluator proof.
 *
 * **Example** (Inspect live terminal fields)
 *
 * ```ts
 * import { LiveVerified } from "@beep/skill-contract"
 *
 * console.log(LiveVerified.fields.completion !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LiveVerified extends S.Class<LiveVerified>($I`LiveVerified`)(
  {
    completion: SkillCompletion,
    terminal: S.tag("LiveVerified"),
  },
  $I.annote("LiveVerified", {
    description: "Successful live terminal carrying evaluator-only completion proof.",
  })
) {
  static readonly thunkThis = () => this;
}

/**
 * Delivered but non-deployable terminal blocked by gate evidence.
 *
 * **Example** (Inspect blocked terminal fields)
 *
 * ```ts
 * import { DeployableBlocked } from "@beep/skill-contract"
 *
 * console.log(DeployableBlocked.fields.reason !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DeployableBlocked extends S.Class<DeployableBlocked>($I`DeployableBlocked`)(
  {
    gateSummary: GateSummaryReceipt,
    ladder: Delivered,
    reason: S.NonEmptyString,
    terminal: S.tag("DeployableBlocked"),
  },
  $I.annote("DeployableBlocked", {
    description: "Delivered terminal that remains non-deployable because gate evidence blocks completion.",
  })
) {
  static readonly thunkThis = () => this;
}

/**
 * Failed terminal retaining the highest evidence rung and partial effects.
 *
 * **Example** (Inspect partial-failure fields)
 *
 * ```ts
 * import { FailedWithPartialEffects } from "@beep/skill-contract"
 *
 * console.log(FailedWithPartialEffects.fields.highestRung !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FailedWithPartialEffects extends S.Class<FailedWithPartialEffects>($I`FailedWithPartialEffects`)(
  {
    failure: FailureReceipt,
    highestRung: S.Option(EvidenceLadderState),
    terminal: S.tag("FailedWithPartialEffects"),
  },
  $I.annote("FailedWithPartialEffects", {
    description: "Failed terminal retaining the highest evidence rung, bounded-recovery receipt, and partial effects.",
  })
) {
  static readonly thunkThis = () => this;
}

/**
 * Terminal skill outcomes distinguished by proof and partial-effect semantics.
 *
 * **Example** (Inspect terminal variants)
 *
 * ```ts
 * import { SkillTerminal } from "@beep/skill-contract"
 *
 * console.log(SkillTerminal.discriminants)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SkillTerminal = LiteralKit(["LiveVerified", "DeployableBlocked", "FailedWithPartialEffects"])
  .mapMembers(Tuple.evolve([LiveVerified.thunkThis, DeployableBlocked.thunkThis, FailedWithPartialEffects.thunkThis]))
  .pipe(
    S.toTaggedUnion("terminal"),
    $I.annoteSchema("SkillTerminal", {
      description: "Live verified completion, deployable blockage, or failure with partial effects.",
    })
  );

/**
 * Runtime type decoded by {@link SkillTerminal}.
 *
 * @category models
 * @since 0.0.0
 */
export type SkillTerminal = typeof SkillTerminal.Type;
