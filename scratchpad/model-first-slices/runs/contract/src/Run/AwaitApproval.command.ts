import * as Domain from "@alchemy.run/domain";
import { RunId } from "@proto/kernel/Ids";
import { Session } from "@proto/kernel/Session.middleware";
import { NotThisRun } from "./NotThisRun.rejection.ts";
import { RunEvent } from "./RunEvent.ts";
import { RunNotRunning } from "./RunNotRunning.rejection.ts";

/**
 * The fact: the run waits for a person's approval.
 *
 * @category events
 * @since 0.0.0
 */
export class RunAwaitingApproval extends Domain.Event("RunAwaitingApproval", RunEvent.fields({}), { description: "The run is waiting for a person's approval." }) {}

/**
 * Report that the run waits for a person's approval, as the run itself.
 *
 * @category commands
 * @since 0.0.0
 */
export class AwaitApproval extends Domain.Command(
  "AwaitApproval",
  {
    target: RunId,
    middleware: [Session],
    events: [RunAwaitingApproval],
    rejects: [RunNotRunning, NotThisRun],
  },
  { description: "Report that the run waits for a person's approval, as the run itself." },
) {}
