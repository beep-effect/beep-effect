import * as Domain from "@alchemy.run/domain";
import "@proto/kernel/Audience";
import * as S from "effect/Schema";
import { Disposition } from "../Disposition.ts";
import { EvidenceSignal } from "../Evidence.ts";
import { Proposition } from "../Proposition.ts";

/**
 * The model could not be reached or gave no usable answer.
 *
 * @category errors
 * @since 0.0.0
 */
export class ReasonerUnavailable extends S.TaggedError<ReasonerUnavailable>()("ReasonerUnavailable", {
  reason: S.String,
}) {}

/**
 * What the reasoner concluded about a claim.
 *
 * @category models
 * @since 0.0.0
 */
export const Assessment = S.Struct({ disposition: Disposition, rationale: S.String });
/**
 * @category models
 * @since 0.0.0
 */
export type Assessment = typeof Assessment.Type;

/**
 * Inference is a port, with a schema on both sides: the adapter's calls are
 * checked against them, and stories stub it so agent behaviour is
 * deterministic to test.
 *
 * @category external systems
 * @since 0.0.0
 */
export class Reasoner extends Domain.ExternalSystem(
  "Reasoner",
  {
    assess: {
      args: { proposition: Proposition, signals: S.Array(EvidenceSignal) },
      success: Assessment,
      error: ReasonerUnavailable,
    },
  },
  { description: "Assesses a claim's evidence and proposes a disposition with a rationale." },
) {}
