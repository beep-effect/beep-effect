import * as Domain from "@alchemy.run/domain";
import { RunId } from "@proto/kernel/Ids";
import { Hop } from "@proto/kernel/Invocation";
import { Text } from "@proto/kernel/Measure";
import { RunCompleted } from "./CompleteRun.command.ts";

/**
 * Close a run because what it works on was decided elsewhere: a fact another
 * context published (D11). Sent only by the runs host's inbox, with the
 * inbox's `Fact` hop; no Api serves it. The fact carries no provenance, so
 * the run concludes under its own provenance extended by that hop. It
 * records nothing for a run that has already finished or continued.
 *
 * @category commands
 * @since 0.0.0
 */
export class ConcludeRun extends Domain.Command(
  "ConcludeRun",
  { target: RunId, input: { outcome: Text, hop: Hop }, events: [RunCompleted] },
  { description: "Close a run whose subject another context decided." },
) {}
