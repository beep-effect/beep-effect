import * as Domain from "@alchemy.run/domain";
import { RunId } from "@proto/kernel/Ids";
import { Session } from "@proto/kernel/Session.middleware";
import { Count } from "@proto/kernel/Measure";
import { NotThisRun } from "./NotThisRun.rejection.ts";
import { RunEvent } from "./RunEvent.ts";
import { RunNotRunning } from "./RunNotRunning.rejection.ts";

/**
 * The fact: the run stopped because its budget could not cover its next call.
 *
 * @category events
 * @since 0.0.0
 */
export class RunExhausted extends Domain.Event("RunExhausted", RunEvent.fields({ remaining: Count }), { description: "The run stopped because its budget could not cover its next call." }) {}

/**
 * Stop the run because its budget cannot cover its next call, as the run itself.
 *
 * @category commands
 * @since 0.0.0
 */
export class ExhaustRun extends Domain.Command(
  "ExhaustRun",
  {
    target: RunId,
    middleware: [Session],
    events: [RunExhausted],
    rejects: [RunNotRunning, NotThisRun],
  },
  { description: "Stop the run because its budget cannot cover its next call, as the run itself." },
) {}
