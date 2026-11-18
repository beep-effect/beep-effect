import * as Domain from "@alchemy.run/domain";
import { RunId } from "@proto/kernel/Ids";
import { Provenance } from "@proto/kernel/Invocation";
import * as S from "effect/Schema";
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
  RunEvent.fields({ child: RunId, allowance: S.Int, spent: S.Int, outcome: S.String }),
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
    input: { child: RunId, returned: S.Int, outcome: S.String, provenance: Provenance },
    events: [ChildRunFinished],
  },
  { description: "Resume a parent run whose child finished, settling the child's share." },
) {}
