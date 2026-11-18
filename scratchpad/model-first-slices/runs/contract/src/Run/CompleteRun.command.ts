import * as Domain from "@alchemy.run/domain";
import { RunId } from "@proto/kernel/Ids";
import { Session } from "@proto/kernel/Session.middleware";
import { Count, Text } from "@proto/kernel/Measure";
import { NotThisRun } from "./NotThisRun.rejection.ts";
import { RunEvent } from "./RunEvent.ts";
import { Since } from "./Since.ts";
import { RunNotRunning } from "./RunNotRunning.rejection.ts";

/**
 * The fact: the run finished, with this outcome; `released` is what its open
 * reservations held, now returned.
 *
 * @category events
 * @since 0.0.0
 */
export class RunCompleted extends Domain.Event(
  "RunCompleted",
  RunEvent.fields({ outcome: Text, released: Since.phase3(Count, 0) }),
  { description: "The run finished with this outcome. `released` is the units its open reservations held, now returned." },
) {}

/**
 * Complete the run, as the run itself.
 *
 * @category commands
 * @since 0.0.0
 */
export class CompleteRun extends Domain.Command(
  "CompleteRun",
  {
    target: RunId,
    middleware: [Session],
    input: { outcome: Text },
    events: [RunCompleted],
    rejects: [RunNotRunning, NotThisRun],
  },
  { description: "Complete the run, as the run itself." },
) {}
