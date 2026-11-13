import * as Domain from "@alchemy.run/domain";
import { RunId } from "@proto/kernel/Ids";
import { Session } from "@proto/kernel/Session.middleware";
import * as S from "effect/Schema";
import { NotThisRun } from "./NotThisRun.rejection.ts";
import { RunEvent } from "./RunEvent.ts";
import { RunNotRunning } from "./RunNotRunning.rejection.ts";

/**
 * The fact: the run finished its work, with this outcome.
 *
 * @category events
 * @since 0.0.0
 */
export class RunCompleted extends Domain.Event("RunCompleted", RunEvent.fields({ outcome: S.String })) {}

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
    input: { outcome: S.String },
    events: [RunCompleted],
    rejects: [RunNotRunning, NotThisRun],
  },
  { description: "Complete the run, as the run itself." },
) {}
