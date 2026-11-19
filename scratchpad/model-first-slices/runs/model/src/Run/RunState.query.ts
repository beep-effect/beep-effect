import * as Domain from "@alchemy.run/domain";
import { Session } from "@proto/kernel/Session.middleware";
import { PublicRunState, RunStateInput, RunStateRead } from "@proto/runs-contract/Run/RunState.read";
import { NotInSession } from "@proto/runs-contract/Run/SessionRuns.read";
import { SessionRuns } from "./SessionRuns.view.ts";

/**
 * A run's status, and its outcome once it completed, for someone who takes
 * part in its session. Declared from the contract's parts; it waits on this
 * model's own `SessionRuns` view, where the rule reads who takes part, which
 * the contract's `RunStateRead` cannot name.
 *
 * @category queries
 * @since 0.0.0
 */
export class RunState extends Domain.Query(
  "RunState",
  {
    input: RunStateInput,
    success: PublicRunState,
    waitsFor: [SessionRuns],
    middleware: [Session],
    rejects: [NotInSession],
  },
  RunStateRead.annotations,
) {}
