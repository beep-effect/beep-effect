import * as Domain from "@alchemy.run/domain";
import { RunId } from "@proto/kernel/Ids";
import { Count, IdText, Text } from "@proto/kernel/Measure";
import { Disposition } from "@proto/party-contract/Disposition";
import { EvidenceSignal } from "@proto/party-contract/Evidence";
import { Proposition } from "@proto/party-contract/Proposition";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

/**
 * The model could not be reached, gave no usable answer, or (replay) has no
 * recording for the call.
 *
 * @category errors
 * @since 0.0.0
 */
export class ReasonerUnavailable extends S.TaggedError<ReasonerUnavailable, { readonly brand: unique symbol }>()("ReasonerUnavailable", {
  reason: Text,
}) {}

/**
 * What the reasoner concluded about a claim.
 *
 * @category models
 * @since 0.0.0
 */
export const Assessment = S.Struct({ disposition: Disposition, rationale: Text });
/**
 * @category models
 * @since 0.0.0
 */
export type Assessment = typeof Assessment.Type;

/**
 * What one call cost, in the run's budget units.
 *
 * @category models
 * @since 0.0.0
 */
export const Usage = S.Struct({
  units: Count,
  // Added in phase 4 (D35): stored results and tapes without it read 0.
  cachedUnits: Count.pipe(S.withDecodingDefaultKey(Effect.succeed(0)), S.withConstructorDefault(Effect.succeed(0))),
});

/**
 * The call's receipt: the idempotency key it was made under, the prompt
 * version, and the model that answered. Replay serves the same receipt.
 *
 * @category models
 * @since 0.0.0
 */
export const ReasonerReceipt = S.Struct({ idempotencyKey: IdText, promptVersion: IdText, model: IdText });

/**
 * An assessment with its usage and receipt.
 *
 * @category models
 * @since 0.0.0
 */
export const Assessed = S.Struct({ assessment: Assessment, usage: Usage, receipt: ReasonerReceipt });
/**
 * @category models
 * @since 0.0.0
 */
export type Assessed = typeof Assessed.Type;

/**
 * One assessment call: the run and step it serves, its idempotency key, the
 * prompt version, the most it may spend, and the claim to assess.
 *
 * @category models
 * @since 0.0.0
 */
export const AssessRequest = S.Struct({
  run: RunId,
  step: IdText,
  idempotencyKey: IdText,
  promptVersion: IdText,
  maxAllowance: Count,
  proposition: Proposition,
  signals: S.Array(EvidenceSignal),
});
/**
 * @category models
 * @since 0.0.0
 */
export type AssessRequest = typeof AssessRequest.Type;

/**
 * Inference is a port with an evaluation contract (D19). Each call names the
 * run and step it serves, an idempotency key (a retried call returns the
 * first answer), the prompt version, and the most it may spend; the receipt
 * reports what it spent. Every adapter passes one contract suite, and a
 * recording adapter writes fixtures a replay adapter serves.
 *
 * @category external systems
 * @since 0.0.0
 */
export class Reasoner extends Domain.ExternalSystem(
  "Reasoner",
  {
    assess: {
      args: AssessRequest.fields,
      success: Assessed,
      error: ReasonerUnavailable,
    },
  },
  { description: "Assesses a claim's evidence and proposes a disposition, reporting usage within an allowance." },
) {}
