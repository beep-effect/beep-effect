import * as Domain from "@alchemy.run/domain";
import { RunId } from "@proto/kernel/Ids";
import { Provenance } from "@proto/kernel/Invocation";
import { Count, Text } from "@proto/kernel/Measure";
import { RunEvent } from "./RunEvent.ts";

/**
 * The fact: the child run finished; what it spent counts against this run,
 * what it did not spend returns to it, and this run runs on.
 *
 * @category events
 * @since 0.0.0
 */
export class ChildRunFinished extends Domain.Event(
  "ChildRunFinished",
  RunEvent.fields({ child: RunId, allowance: Count, spent: Count, outcome: Text }),
  { description: "The child run finished. What it spent counts against this run, what it did not spend returns to it, and this run continues." },
) {}

/**
 * Tell a parent its child finished; `child` names the child's lineage and
 * `returned` is what the lineage did not spend. Sent only by the runs
 * model's own policy; no Api serves it.
 *
 * @category commands
 * @since 0.0.0
 */
export class ChildFinished extends Domain.Command(
  "ChildFinished",
  {
    target: RunId,
    input: { child: RunId, returned: Count, outcome: Text, provenance: Provenance },
    events: [ChildRunFinished],
  },
  { description: "Resume a parent run whose child finished, settling the child's share." },
) {}
