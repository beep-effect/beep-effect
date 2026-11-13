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

/**
 * The run a review acts as now, and the provenance it acts under. A run that
 * reached its history bound continues as a new run; every report returns the
 * live one, and the next report is made as it.
 *
 * @category models
 * @since 0.0.0
 */
export const LiveRun = S.Struct({ run: RunId, provenance: Provenance });
/**
 * @category models
 * @since 0.0.0
 */
export type LiveRun = typeof LiveRun.Type;

/** Every report names the run, the provenance it continues, and its hop. */
const call = { provenance: Provenance, hop: Hop, run: RunId };

/**
 * Party's port to the runs context, in Party's words: open a review run
 * under a delegation from the requester, then report its budget, steps and
 * outcome as the run itself, following it across continuations. How a run
 * ends once a person decides the claim is not reported here: the runs
 * context learns it from Party's published fact (D11). The host adapts the
 * port to the runs contract.
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
    reserve: {
      args: { ...call, reservation: S.String, units: S.Int },
      success: LiveRun,
      error: [RunRefused, BudgetRefused],
    },
    settle: { args: { ...call, reservation: S.String, units: S.Int }, success: LiveRun, error: RunRefused },
    release: { args: { ...call, reservation: S.String }, success: LiveRun, error: RunRefused },
    step: { args: { ...call, step: S.String }, success: LiveRun, error: RunRefused },
    awaitApproval: { args: call, success: LiveRun, error: RunRefused },
    exhaust: { args: call, success: LiveRun, error: RunRefused },
    refuse: { args: { ...call, reason: S.String }, success: LiveRun, error: RunRefused },
  },
  { description: "Opens review runs and reports their budget, steps and outcome to the runs context." },
) {}
