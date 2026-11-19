import * as Domain from "@alchemy.run/domain";
import { RunId } from "@proto/kernel/Ids";
import * as Initial from "@proto/kernel/Initial";
import { Text } from "@proto/kernel/Measure";
import { Session } from "@proto/kernel/Session.middleware";
import * as S from "effect/Schema";
import { RunStatus } from "./RunStatus.ts";
import { NotInSession, SessionRunsRead } from "./SessionRuns.read.ts";

/**
 * A run as a caller may see it: where it is, and what it concluded once it
 * completed. It is not the stored state: no budget, grant, lineage or
 * provenance reaches the caller.
 *
 * **Example** (A run that completed)
 * ```ts
 * import { PublicRunState } from "@proto/runs-contract/Run/RunState.read";
 * import * as O from "@beep/utils/Option";
 *
 * const done = PublicRunState.make({ status: "completed", outcome: O.some("approved") });
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PublicRunState = S.Struct({
  status: RunStatus,
  outcome: Initial.none(Text, { description: "What the run concluded; absent until it completes." }),
});
/**
 * @category models
 * @since 0.0.0
 */
export type PublicRunState = typeof PublicRunState.Type;

/**
 * What `RunState` asks: the run to read.
 *
 * @category models
 * @since 0.0.0
 */
export const RunStateInput = { run: RunId };

/**
 * The `RunState` query's client contract. The model declares its own
 * `RunState` from the same parts, waiting on its `SessionRuns` view.
 *
 * **Details**
 *
 * Only someone who takes part in the run's session may read it, by the rule
 * `SessionRuns` applies, and is refused with the same `NotInSession`. A run
 * nobody requested reads as `unrequested`, as a session nobody started
 * reads as empty.
 *
 * **Gotchas**
 *
 * Interim (D9): the model's query waits on its own `SessionRuns` view, where
 * the rule reads who takes part; this one names the contract's
 * `SessionRunsRead`, which the catalog holds. Only the length of `waitsFor`
 * shapes the RPC; the parity test checks the two match.
 *
 * @category reads
 * @since 0.0.0
 */
export class RunStateRead extends Domain.Query(
  "RunState",
  {
    input: RunStateInput,
    success: PublicRunState,
    waitsFor: [SessionRunsRead],
    middleware: [Session],
    rejects: [NotInSession],
  },
  { description: "A run's status, and its outcome once it completed, for someone who takes part in its session." },
) {}
