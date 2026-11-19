import * as Domain from "@alchemy.run/domain";
import { DelegationId, PrincipalId, RunId } from "@proto/kernel/Ids";
import { Provenance } from "@proto/kernel/Invocation";
import { RunEvent } from "./RunEvent.ts";

/**
 * The fact: the run's delegation is open and a human answers for it; the
 * run acts under `runProvenance` (an agent root, its delegation as its only grant).
 *
 * @category events
 * @since 0.0.0
 */
export class RunActivated extends Domain.Event(
  "RunActivated",
  RunEvent.fields({ delegation: DelegationId, accountable: PrincipalId, runProvenance: Provenance }),
  { description: "The run's delegation is open and a human answers for it. The run acts under `runProvenance`: an agent root with its delegation as its only grant." },
) {}

/**
 * Start a requested run once the authority context granted it. Sent only by
 * the runs model's own policy, with the provenance it acted on; no Api serves it.
 *
 * @category commands
 * @since 0.0.0
 */
export class ActivateRun extends Domain.Command(
  "ActivateRun",
  {
    target: RunId,
    input: { delegation: DelegationId, accountable: PrincipalId, runProvenance: Provenance, provenance: Provenance },
    events: [RunActivated],
  },
  { description: "Start a requested run under the delegation the authority context opened for it." },
) {}
