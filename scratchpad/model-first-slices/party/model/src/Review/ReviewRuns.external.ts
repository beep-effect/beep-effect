import * as Domain from "@alchemy.run/domain";
import { GrantTerms } from "@proto/kernel/Capability";
import { RunId } from "@proto/kernel/Ids";
import { GrantRef, Hop, Provenance } from "@proto/kernel/Invocation";
import * as S from "effect/Schema";

/**
 * The runs context refused the call, and why.
 *
 * @category errors
 * @since 0.0.0
 */
export class RunRefused extends S.TaggedError<RunRefused>()("RunRefused", { reason: S.String }) {}

/**
 * The run's remaining allowance cannot cover the reservation.
 *
 * @category errors
 * @since 0.0.0
 */
export class BudgetRefused extends S.TaggedError<BudgetRefused>()("BudgetRefused", { remaining: S.Int }) {}

/**
 * The versions a review run records: prompt, model and tool contract.
 *
 * @category models
 * @since 0.0.0
 */
export const ReviewVersions = S.Struct({ prompt: S.String, model: S.String, tools: S.String });
/**
 * @category models
 * @since 0.0.0
 */
export type ReviewVersions = typeof ReviewVersions.Type;

/** Every report names the run, the provenance it continues, and its hop. */
const call = { provenance: Provenance, hop: Hop, run: RunId };

/**
 * Party's port to the runs context, in Party's words: open a review run
 * under a delegation from the requester, then report its budget, steps and
 * outcome as the run itself. The host adapts it to the runs contract.
 *
 * @category external systems
 * @since 0.0.0
 */
export class ReviewRuns extends Domain.ExternalSystem(
  "ReviewRuns",
  {
    open: {
      args: {
        ...call,
        session: S.String,
        purpose: S.String,
        versions: ReviewVersions,
        allowance: S.Int,
        historyBound: S.Int,
        source: GrantRef,
        terms: GrantTerms,
      },
      success: { provenance: Provenance },
      error: RunRefused,
    },
    reserve: { args: { ...call, reservation: S.String, units: S.Int }, error: [RunRefused, BudgetRefused] },
    settle: { args: { ...call, reservation: S.String, units: S.Int }, error: RunRefused },
    release: { args: { ...call, reservation: S.String }, error: RunRefused },
    step: { args: { ...call, step: S.String }, error: RunRefused },
    awaitApproval: { args: call, error: RunRefused },
    complete: { args: { ...call, outcome: S.String }, error: RunRefused },
    exhaust: { args: call, error: RunRefused },
    refuse: { args: { ...call, reason: S.String }, error: RunRefused },
  },
  { description: "Opens review runs and reports their budget, steps and outcome to the runs context." },
) {}
